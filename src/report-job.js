const fs = require('fs');
const path = require('path');
const { pipeline } = require('node:stream/promises');
const sharp = require('sharp');
const { ObjectId } = require('mongodb');
const { renderToStream } = require('@react-pdf/renderer');
const React = require('react');
const { trace, metrics, SpanStatusCode } = require('@opentelemetry/api');
const {
  generateReportHash,
  normalizePost,
  validatePayload,
  orderPostsByRequestedIds,
} = require('./core-utils');
const { uploadStreamToS3, uploadBufferToS3, fetchImageFromS3Url } = require('./s3');
const { supabase, supabaseEnabled } = require('./supabase');

const { DetailedCasesReportDocument } = require('./components/DetailedCaseReport');
const { SingleCaseReportDocument } = require('./components/SingleCaseReport');
const { ProfileReportDocument } = require('./components/ProfileReport');
const { RiskReportDocument } = require('./components/SummaryReport');
const { generateSingleCaseDocxBuffer } = require('./components/docx/SingleCaseReportDocx');
const { generateDetailedCasesDocxBuffer } = require('./components/docx/DetailedCasesReportDocx');
const { generateProfileDocxBuffer } = require('./components/docx/ProfileReportDocx');
const { generateSimpleProfileDocxBuffer } = require('./components/docx/SimpleProfileReportDocx');

const tracer = trace.getTracer('overwatch-pdf-service');
const meter = metrics.getMeter('overwatch-pdf-service');
const pdfGenerationDuration = meter.createHistogram('generate_pdf_duration_seconds', {
  description: 'Time taken to generate a PDF report',
  unit: 's',
});

/** Lambda uses `/tmp/images`; override with IMAGE_CACHE_DIR if needed. */
const IMAGE_CACHE_DIR = process.env.IMAGE_CACHE_DIR || '/tmp/images';

function ensureImageCacheDir() {
  if (!fs.existsSync(IMAGE_CACHE_DIR)) {
    fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
  }
}

function buildObjectIds(postIds) {
  return postIds.map((id) => new ObjectId(id));
}

/** SQS payloads often send `project` as an array row or stringify `project_details`. */
function normalizeProjectField(project) {
  if (!project) return project;
  if (!Array.isArray(project)) {
    const copy = { ...project };
    if (typeof copy.project_details === 'string') {
      try {
        copy.project_details = JSON.parse(copy.project_details);
      } catch {
        copy.project_details = {};
      }
    }
    return copy;
  }
  const row = project[0] || {};
  let details = row.project_details;
  if (typeof details === 'string') {
    try {
      details = JSON.parse(details);
    } catch {
      details = {};
    }
  }
  return {
    project_name: row.project_name,
    project_details: details && typeof details === 'object' ? details : {},
  };
}

async function updateReportStatus(reportHash, statusText, extraFields = {}) {
  if (!supabaseEnabled) {
    console.warn(`[Supabase] Skipping status update for ${reportHash}: ${statusText}`);
    return;
  }
  try {
    const updatePayload = {
      status: statusText,
      last_update: new Date().toISOString(),
      ...extraFields,
    };
    const { error } = await supabase.from('reports_generation').update(updatePayload).eq('report_hash', reportHash);

    if (error) {
      console.error(`Failed to update status for ${reportHash} to "${statusText}":`, error.message);
    } else {
      console.log(`[Supabase] Updated ${reportHash} status: ${statusText}`);
    }
  } catch (err) {
    console.error(`Exception updating status for ${reportHash}:`, err.message);
  }
}

async function processImage(imageUrl, id, suffix = 'processed') {
  ensureImageCacheDir();
  if (!imageUrl) return null;

  const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
  const cachedPath = path.join(IMAGE_CACHE_DIR, `${safeId}_${suffix}.jpg`);

  if (!fs.existsSync(cachedPath)) {
    let buffer;
    try {
      buffer = await fetchImageFromS3Url(imageUrl);
    } catch (error) {
      console.error(`Failed to fetch image ${imageUrl} for ${id}:`, error.message);
      return null;
    }

    try {
      await sharp(buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(cachedPath);
    } catch (sharpError) {
      const magicBytes = buffer.toString('hex', 0, 4).toLowerCase();
      if (magicBytes.startsWith('ffd8') || magicBytes.startsWith('8950')) {
        console.warn(
          `[Fallback Triggered] Sharp failed, but recognized valid JPEG/PNG magic bytes (${magicBytes}) for ${id}. Saving raw file. Reason: ${sharpError.message}`,
        );
        fs.writeFileSync(cachedPath, buffer);
        return cachedPath;
      }
      console.error(
        `[Irrecoverable] Failed to process image ${imageUrl} for ${id}. Magic Bytes: ${magicBytes} - Error:`,
        sharpError.message,
      );
      return null;
    }
  }
  return cachedPath;
}

async function processAndCacheImages(posts, concurrency = 5) {
  const results = new Array(posts.length);
  for (let i = 0; i < posts.length; i += concurrency) {
    const chunk = posts.slice(i, i + concurrency);
    const promises = chunk.map(async (post, index) => {
      let imageUrl = null;
      if (post.post_content?.media_urls && post.post_content.media_urls.length > 0) {
        imageUrl = post.post_content.media_urls[0].s3_url || post.post_content.media_urls[0].url;
      } else if (post.s3_url) {
        imageUrl = post.s3_url;
      } else if (post.image_url) {
        imageUrl = post.image_url;
      }
      const localPath = await processImage(imageUrl, post._id);
      results[i + index] = localPath;
    });
    await Promise.all(promises);
  }
  return results;
}

async function withSpan(name, attributes, fn) {
  return await tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await fn(span);
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Same pipeline as the SQS Lambda: Mongo posts → images → PDF or DOCX → persist.
 *
 * @param {import('mongodb').MongoClient} client
 * @param {object} payload Parsed SQS message body (projectId, postIds, reportType, database_name, …)
 * @param {object} options
 * @param {'s3' | 'local'} options.persist Where to write the generated file
 * @param {string} [options.localOutputDir] Required when persist === 'local'
 * @returns {Promise<{ reportHash: string, reportType: string, format: 'pdf'|'docx', storageUrl: string, localPath?: string }>}
 */
async function runReportJob(client, payload, options = {}) {
  const persist = options.persist || 's3';
  const localOutputDir = options.localOutputDir;

  const validation = validatePayload(payload);
  if (!validation.valid) {
    const err = new Error(validation.errors.join('; '));
    err.code = 'INVALID_PAYLOAD';
    err.validationErrors = validation.errors;
    throw err;
  }

  const { projectId, postIds, reportType, reportFormat, database_name, profile } = payload;
  const isDocx = validation.normalizedReportFormat === 'docx';

  const startTime = process.hrtime();
  const reportHash = generateReportHash(projectId, postIds, reportType, profile?._id, reportFormat || 'pdf');

  console.log(`Created the report Hash as: ${reportHash}`);

  try {
    const db = client.db(database_name);
    const project = normalizeProjectField(payload.project);

    await updateReportStatus(reportHash, '[10%] Fetching Posts from DB');

    const objectIds = buildObjectIds(postIds);
    const postsFromDb = await db.collection('Posts').find({ _id: { $in: objectIds } }).toArray();

    const orderedPosts = orderPostsByRequestedIds(postIds, postsFromDb);

    await updateReportStatus(reportHash, '[30%] Processing Images');

    const { compressedImages, compressedProfilePic } = await withSpan(
      'process-images',
      { 'images.count': orderedPosts.length },
      async () => {
        const imgs = await processAndCacheImages(orderedPosts, 10);
        let profilePic = null;
        if (reportType === 'Profile' && profile?.metadata?.profile_pic) {
          profilePic = await processImage(profile.metadata.profile_pic, profile._id, 'profile');
        }
        return { compressedImages: imgs, compressedProfilePic: profilePic };
      },
    );

    const posts = orderedPosts.map((p) => normalizePost(p));

    const reportLabel = isDocx ? 'DOCX' : 'PDF';
    await updateReportStatus(reportHash, `[60%] Generating ${reportLabel} report`);

    let storageUrl;
    let localPath;

    if (isDocx) {
      const docxBuffer = await withSpan('render-docx', { 'report.type': reportType, 'post.count': posts.length }, async () => {
        const clientDetails = { organization: project?.project_name || null };
        if (reportType === 'Detailed') {
          return await generateDetailedCasesDocxBuffer(posts, project, compressedImages, clientDetails);
        }
        if (reportType === 'Single') {
          return await generateSingleCaseDocxBuffer(posts[0], project, compressedImages[0], clientDetails);
        }
        if (reportType === 'Profile') {
          return await generateProfileDocxBuffer(profile, posts, project, compressedImages, compressedProfilePic, clientDetails);
        }
        if (reportType === 'SimpleProfile') {
          return await generateSimpleProfileDocxBuffer(profile, posts, project, compressedImages);
        }
        throw new Error(`DOCX report type '${reportType}' is not supported`);
      });

      await updateReportStatus(reportHash, '[80%] Uploading DOCX to Storage');

      if (persist === 'local') {
        if (!localOutputDir) {
          throw new Error('localOutputDir is required when persist === "local"');
        }
        fs.mkdirSync(localOutputDir, { recursive: true });
        const fileName = `${reportHash}.docx`;
        localPath = path.join(localOutputDir, fileName);
        fs.writeFileSync(localPath, docxBuffer);
        storageUrl = `local://${fileName}`;
      } else {
        storageUrl = await withSpan('upload-s3-docx', { 's3.key': `reports/${reportHash}.docx` }, async () => {
          return await uploadBufferToS3(docxBuffer, `reports/${reportHash}.docx`);
        });
      }
    } else {
      const pdfStream = await withSpan('render-pdf', { 'report.type': reportType, 'post.count': posts.length }, async () => {
        if (reportType === 'Detailed') {
          return await renderToStream(
            React.createElement(DetailedCasesReportDocument, { posts, project, compressedImages }),
          );
        }
        if (reportType === 'Single') {
          return await renderToStream(
            React.createElement(SingleCaseReportDocument, {
              post: posts[0],
              project,
              compressedImage: compressedImages[0],
            }),
          );
        }
        if (reportType === 'Profile') {
          return await renderToStream(
            React.createElement(ProfileReportDocument, {
              profile,
              cases: posts,
              project,
              compressedImages,
              compressedProfilePic,
            }),
          );
        }
        if (reportType === 'Summary') {
          return await renderToStream(React.createElement(RiskReportDocument, { posts, project, compressedImages }));
        }
        throw new Error(`PDF report type '${reportType}' is not supported`);
      });

      await updateReportStatus(reportHash, '[80%] Uploading to Storage');

      if (persist === 'local') {
        if (!localOutputDir) {
          throw new Error('localOutputDir is required when persist === "local"');
        }
        fs.mkdirSync(localOutputDir, { recursive: true });
        const fileName = `${reportHash}.pdf`;
        localPath = path.join(localOutputDir, fileName);
        await pipeline(pdfStream, fs.createWriteStream(localPath));
        storageUrl = `local://${fileName}`;
      } else {
        storageUrl = await withSpan('upload-s3', { 's3.key': `reports/${reportHash}.pdf` }, async () => {
          return await uploadStreamToS3(pdfStream, `reports/${reportHash}.pdf`);
        });
      }
    }

    await updateReportStatus(reportHash, '[100%] Complete', {
      s3_path: storageUrl,
      finish_time: new Date().toISOString(),
    });

    console.log(`Successfully generated report: ${storageUrl}`);

    const [seconds, nanoseconds] = process.hrtime(startTime);
    pdfGenerationDuration.record(seconds + nanoseconds / 1e9, {
      'report.type': reportType,
      'project.id': projectId,
      status: 'success',
    });

    return {
      reportHash,
      reportType,
      format: isDocx ? 'docx' : 'pdf',
      storageUrl,
      localPath: localPath || undefined,
    };
  } catch (error) {
    await updateReportStatus(reportHash, `[Error] ${error.message.substring(0, 100)}`, {
      finish_time: new Date().toISOString(),
    });

    const [seconds, nanoseconds] = process.hrtime(startTime);
    pdfGenerationDuration.record(seconds + nanoseconds / 1e9, {
      'report.type': reportType || 'Unknown',
      'project.id': projectId || 'Unknown',
      status: 'failed',
    });

    throw error;
  }
}

module.exports = {
  runReportJob,
  IMAGE_CACHE_DIR,
  processImage,
  processAndCacheImages,
};
