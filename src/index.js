require('dotenv').config();
const telemetry = require('./instrumentation');

// Enable Babel for JSX parsing in Node.js
require('@babel/register')({
  presets: ['@babel/preset-env', '@babel/preset-react'],
  extensions: ['.js', '.jsx'],
  cache: false // Disable cache to prevent permission warnings in Lambda
});

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { ObjectId } = require('mongodb');
const { connectToMongo, getMongoClient } = require('./mongo');
const { uploadStreamToS3, uploadBufferToS3, fetchImageFromS3Url } = require('./s3');
const { renderToStream } = require('@react-pdf/renderer');
const React = require('react');
const { trace, context, propagation, SpanKind, metrics, SpanStatusCode } = require('@opentelemetry/api');
const {
  generateReportHash,
  normalizePost,
  validatePayload,
  orderPostsByRequestedIds,
} = require('./core-utils');

const tracer = trace.getTracer('overwatch-pdf-service');
const meter = metrics.getMeter('overwatch-pdf-service');

const pdfGenerationDuration = meter.createHistogram('generate_pdf_duration_seconds', {
  description: 'Time taken to generate a PDF report',
  unit: 's',
});

const { DetailedCasesReportDocument } = require('./components/DetailedCaseReport');
const { SingleCaseReportDocument } = require('./components/SingleCaseReport');
const { ProfileReportDocument } = require('./components/ProfileReport');
const { RiskReportDocument } = require('./components/SummaryReport');
const { supabase, supabaseEnabled } = require('./supabase');

// ── DOCX generators (Node.js / Lambda versions) ──────────────────────────────
const { generateSingleCaseDocxBuffer }   = require('./components/docx/SingleCaseReportDocx');
const { generateDetailedCasesDocxBuffer } = require('./components/docx/DetailedCasesReportDocx');
const { generateProfileDocxBuffer }       = require('./components/docx/ProfileReportDocx');

function buildObjectIds(postIds) {
  return postIds.map((id) => new ObjectId(id));
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
      ...extraFields
    };
    const { error } = await supabase
      .from('reports_generation')
      .update(updatePayload)
      .eq('report_hash', reportHash);
    
    if (error) {
      console.error(`Failed to update status for ${reportHash} to "${statusText}":`, error.message);
    } else {
      console.log(`[Supabase] Updated ${reportHash} status: ${statusText}`);
    }
  } catch (err) {
    console.error(`Exception updating status for ${reportHash}:`, err.message);
  }
}

let isMongoConnected = false;

// Lambda /tmp storage
const IMAGE_CACHE_DIR = '/tmp/images';
if (!fs.existsSync(IMAGE_CACHE_DIR)) {
  fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
}


async function processImage(imageUrl, id, suffix = 'processed') {
  if (!imageUrl) return null;

  const cachedPath = path.join(IMAGE_CACHE_DIR, `${id}_${suffix}.jpg`);
  
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
        console.warn(`[Fallback Triggered] Sharp failed, but recognized valid JPEG/PNG magic bytes (${magicBytes}) for ${id}. Saving raw file. Reason: ${sharpError.message}`);
        fs.writeFileSync(cachedPath, buffer);
        return cachedPath;
      }
      console.error(`[Irrecoverable] Failed to process image ${imageUrl} for ${id}. Magic Bytes: ${magicBytes} - Error:`, sharpError.message);
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

exports.handler = async (event) => {
  try {
    if (!isMongoConnected) {
      await connectToMongo();
      isMongoConnected = true;
    }
    const client = getMongoClient();

    for (const record of event.Records || []) {
    let payload;
    try {
      payload = JSON.parse(record.body);
    } catch (e) {
      console.error("Failed to parse SQS message body", record.body);
      continue;
    }

    const { projectId, postIds, reportType, reportFormat, database_name, project, profile, otelCarrier } = payload;
    const validation = validatePayload(payload);
    const isDocx = validation.normalizedReportFormat === 'docx';

    if (!validation.valid) {
      console.error('Invalid payload:', validation.errors.join('; '), {
        messageId: record.messageId,
        reportType,
        reportFormat,
        projectId,
      });
      continue;
    }

    let parentContext = context.active();
    if (otelCarrier) {
      parentContext = propagation.extract(parentContext, otelCarrier);
    } else if (record.messageAttributes) {
      const carrier = {};
      for (const [key, attr] of Object.entries(record.messageAttributes)) {
        if (attr.stringValue) carrier[key.toLowerCase()] = attr.stringValue;
      }
      parentContext = propagation.extract(parentContext, carrier);
    }

    try {
      await context.with(parentContext, async () => {
      return await tracer.startActiveSpan(`sqs.process generate-pdf`, {
        kind: SpanKind.CONSUMER,
        attributes: {
          'messaging.system': 'aws_sqs',
          'messaging.operation': 'process',
          'message.id': record.messageId,
          'messaging.message.id': record.messageId
        }
      }, async (span) => {
        const startTime = process.hrtime();
        const reportHash = generateReportHash(projectId, postIds, reportType, profile?._id, reportFormat || 'pdf');

        console.log(`Created the report Hash as: ${reportHash}`)
        
        try {
          span.setAttribute('project.id', projectId);
          span.setAttribute('report.type', reportType);
          span.setAttribute('post.count', postIds.length);

          const db = client.db(database_name);
          
          await updateReportStatus(reportHash, '[10%] Fetching Posts from DB');

          const objectIds = buildObjectIds(postIds);
          const postsFromDb = await db.collection('Posts')
            .find({ _id: { $in: objectIds } })
            .toArray();

          span.setAttribute('cache.hit', false);

          // Maintain order of IDs
          const orderedPosts = orderPostsByRequestedIds(postIds, postsFromDb);

          await updateReportStatus(reportHash, '[30%] Processing Images');

          // --- Processing Phase ---
          const { compressedImages, compressedProfilePic } = await withSpan('process-images', { 'images.count': orderedPosts.length }, async () => {
            const imgs = await processAndCacheImages(orderedPosts, 10);
            let profilePic = null;
            if (reportType === 'Profile' && profile?.metadata?.profile_pic) {
              profilePic = await processImage(profile.metadata.profile_pic, profile._id, 'profile');
            }
            return { compressedImages: imgs, compressedProfilePic: profilePic };
          });

          const posts = orderedPosts.map(p => normalizePost(p));

          const reportLabel = isDocx ? 'DOCX' : 'PDF';
          await updateReportStatus(reportHash, `[60%] Generating ${reportLabel} report`);

          let s3Url;

          if (isDocx) {
            // ── DOCX branch ─────────────────────────────────────────────────
            const docxBuffer = await withSpan('render-docx', { 'report.type': reportType, 'post.count': posts.length }, async () => {
              const clientDetails = { organization: project?.project_name || null };
              if (reportType === 'Detailed') {
                return await generateDetailedCasesDocxBuffer(posts, project, compressedImages, clientDetails);
              } else if (reportType === 'Single') {
                return await generateSingleCaseDocxBuffer(posts[0], project, compressedImages[0], clientDetails);
              } else if (reportType === 'Profile') {
                return await generateProfileDocxBuffer(profile, posts, project, compressedImages, compressedProfilePic, clientDetails);
              } else {
                throw new Error(`DOCX report type '${reportType}' is not supported`);
              }
            });

            await updateReportStatus(reportHash, '[80%] Uploading DOCX to Storage');

            s3Url = await withSpan('upload-s3-docx', { 's3.key': `reports/${reportHash}.docx` }, async () => {
              return await uploadBufferToS3(docxBuffer, `reports/${reportHash}.docx`);
            });
          } else {
            // ── PDF branch ──────────────────────────────────────────────────
            const pdfStream = await withSpan('render-pdf', { 'report.type': reportType, 'post.count': posts.length }, async () => {
            if (reportType === 'Detailed') {
              return await renderToStream(React.createElement(DetailedCasesReportDocument, { posts, project, compressedImages }));
            } else if (reportType === 'Single') {
              return await renderToStream(React.createElement(SingleCaseReportDocument, { post: posts[0], project, compressedImage: compressedImages[0] }));
            } else if (reportType === 'Profile') {
              return await renderToStream(React.createElement(ProfileReportDocument, { profile, cases: posts, project, compressedImages, compressedProfilePic }));
            } else if (reportType === 'Summary') {
              return await renderToStream(React.createElement(RiskReportDocument, { posts, project, compressedImages }));
            } else {
              throw new Error(`PDF report type '${reportType}' is not supported`);
            }
          });

          await updateReportStatus(reportHash, '[80%] Uploading to Storage');

          s3Url = await withSpan('upload-s3', { 's3.key': `reports/${reportHash}.pdf` }, async () => {
            return await uploadStreamToS3(pdfStream, `reports/${reportHash}.pdf`);
          });
          }

          await withSpan('supabase-save-metadata', { 'report.hash': reportHash }, async () => {
            await updateReportStatus(reportHash, '[100%] Complete', {
              s3_path: s3Url,
              finish_time: new Date().toISOString()
            });
          });

          console.log(`Successfully generated and saved PDF: ${s3Url}`);

          const [seconds, nanoseconds] = process.hrtime(startTime);
          pdfGenerationDuration.record(seconds + nanoseconds / 1e9, {
            'report.type': reportType,
            'project.id': projectId,
            'status': 'success'
          });

          span.end();
        } catch (error) {
          await updateReportStatus(reportHash, `[Error] ${error.message.substring(0, 100)}`, {
            finish_time: new Date().toISOString()
          });

          const [seconds, nanoseconds] = process.hrtime(startTime);
          pdfGenerationDuration.record(seconds + nanoseconds / 1e9, {
            'report.type': reportType || 'Unknown',
            'project.id': projectId || 'Unknown',
            'status': 'failed'
          });

          span.recordException(error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          span.end();
        }
      });
      });
    } catch (recordError) {
      console.error('Record processing failed', {
        messageId: record.messageId,
        projectId,
        reportType,
        error: recordError.message,
      });
      continue;
    }
  }

  } finally {
    // Force flush telemetry before the Lambda freezes
    await telemetry.forceFlush();
  }
};

module.exports = {
  handler: exports.handler,
  generateReportHash,
  normalizePost,
  validatePayload,
  orderPostsByRequestedIds,
};