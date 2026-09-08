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
  normalizeProfile,
  normalizeAd,
  resolvePostMediaUrl,
  resolveAdCardMediaUrls,
  mapCaseEventToUpdateHistory,
  validatePayload,
  orderPostsByRequestedIds,
} = require('./core-utils');
const {
  attachReportLander,
  isDomainReviewed,
  landerImageSrc,
  screenshotSlicePlan,
  SCREENSHOT_SUMMARY_RATIO,
} = require('./domain-display');
const { uploadStreamToS3, uploadBufferToS3, fetchImageFromS3Url } = require('./s3');
const { supabase, supabaseEnabled } = require('./supabase');

const { DetailedCasesReportDocument } = require('./components/DetailedCaseReport');
const { SingleCaseReportDocument } = require('./components/SingleCaseReport');
const { ProfileReportDocument } = require('./components/ProfileReport');
const { RiskReportDocument } = require('./components/SummaryReport');
const { AdsSummaryReportDocument } = require('./components/AdsSummaryReport');
const { AdsDetailedReportDocument } = require('./components/AdsDetailedReport');
const { DomainsSummaryReportDocument } = require('./components/DomainsSummaryReport');
const { DomainsDetailedReportDocument } = require('./components/DomainsDetailedReport');
const { generateSingleCaseDocxBuffer } = require('./components/docx/SingleCaseReportDocx');
const { generateDetailedCasesDocxBuffer } = require('./components/docx/DetailedCasesReportDocx');
const { generateProfileDocxBuffer } = require('./components/docx/ProfileReportDocx');
const { generateSimpleProfileDocxBuffer } = require('./components/docx/SimpleProfileReportDocx');
const { generateSimpleCaseDocxBuffer } = require('./components/docx/SimpleCaseReportDocx');

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
      const imageUrl = resolvePostMediaUrl(post);
      const localPath = await processImage(imageUrl, post._id);
      results[i + index] = localPath;
    });
    await Promise.all(promises);
  }
  return results;
}

async function processAndCacheAdImages(ads, { includeAllCards = false, concurrency = 5 } = {}) {
  const compressedImages = new Array(ads.length);
  const compressedCardImages = new Array(ads.length);

  for (let i = 0; i < ads.length; i += concurrency) {
    const chunk = ads.slice(i, i + concurrency);
    const promises = chunk.map(async (ad, index) => {
      const cardUrls = resolveAdCardMediaUrls(ad);
      const urlsToFetch = includeAllCards ? cardUrls.slice(0, 6) : cardUrls.slice(0, 1);
      const cardPaths = await Promise.all(
        urlsToFetch.map((url, cardIndex) => processImage(url, ad._id, `card_${cardIndex}`)),
      );
      compressedImages[i + index] = cardPaths[0] || null;
      compressedCardImages[i + index] = includeAllCards ? cardPaths : [];
    });
    await Promise.all(promises);
  }

  return { compressedImages, compressedCardImages };
}

async function writeJpegFromBuffer(buffer, destPath, { width, extract } = {}) {
  let pipeline = sharp(buffer);
  if (extract) pipeline = pipeline.extract(extract);
  if (width) pipeline = pipeline.resize({ width, withoutEnlargement: true });
  await pipeline.jpeg({ quality: 80 }).toFile(destPath);
  return destPath;
}

function landerCacheToken(domain) {
  const raw = domain?.reportVariantKey || domain?.reportLander?.label || 'default';
  return String(raw).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) || 'default';
}

async function processLanderScreenshot(
  imageUrl,
  id,
  variantToken = 'default',
  { includeSlices = true, heroRatio, heroWidth = 900, heroSuffix = 'lander_hero' } = {},
) {
  ensureImageCacheDir();
  if (!imageUrl) return { heroPath: null, slicePaths: [] };

  const safeId = `${String(id).replace(/[^a-zA-Z0-9_-]/g, '_')}_${variantToken}`;
  let buffer;
  try {
    buffer = await fetchImageFromS3Url(imageUrl);
  } catch (error) {
    console.error(`Failed to fetch lander screenshot ${imageUrl} for ${id}:`, error.message);
    return { heroPath: null, slicePaths: [] };
  }

  const heroPath = path.join(IMAGE_CACHE_DIR, `${safeId}_${heroSuffix}.jpg`);

  try {
    const meta = await sharp(buffer).metadata();
    const width = meta.width || 0;
    const height = meta.height || 0;
    const plan = screenshotSlicePlan(width, height, heroRatio != null ? { heroRatio } : {});

    if (!plan.heroHeight || !width) {
      if (!fs.existsSync(heroPath)) {
        await writeJpegFromBuffer(buffer, heroPath, { width: heroWidth });
      }
      return { heroPath, slicePaths: includeSlices ? [heroPath] : [] };
    }

    if (!fs.existsSync(heroPath)) {
      await writeJpegFromBuffer(buffer, heroPath, {
        width: heroWidth,
        extract: { left: 0, top: 0, width, height: plan.heroHeight },
      });
    }

    if (!includeSlices) {
      return { heroPath, slicePaths: [] };
    }

    const slicePaths = [];
    for (let i = 0; i < plan.slices.length; i += 1) {
      const slice = plan.slices[i];
      const slicePath = path.join(IMAGE_CACHE_DIR, `${safeId}_lander_slice_${String(i).padStart(2, '0')}.jpg`);
      if (!fs.existsSync(slicePath)) {
        await writeJpegFromBuffer(buffer, slicePath, {
          width: 720,
          extract: { left: 0, top: slice.top, width, height: slice.height },
        });
      }
      slicePaths.push(slicePath);
    }
    return { heroPath, slicePaths };
  } catch (sharpError) {
    const magicBytes = buffer.toString('hex', 0, 4).toLowerCase();
    if (magicBytes.startsWith('ffd8') || magicBytes.startsWith('8950')) {
      console.warn(
        `[Fallback Triggered] Sharp failed on lander screenshot for ${id}. Saving raw file. Reason: ${sharpError.message}`,
      );
      fs.writeFileSync(heroPath, buffer);
      return { heroPath, slicePaths: includeSlices ? [heroPath] : [] };
    }
    console.error(
      `[Irrecoverable] Failed to slice lander screenshot for ${id}. Magic Bytes: ${magicBytes} - Error:`,
      sharpError.message,
    );
    return { heroPath: null, slicePaths: [] };
  }
}

async function processAndCacheDomainImages(domains, { includeSlices = false, concurrency = 5 } = {}) {
  const compressedImages = new Array(domains.length);
  const screenshotSlices = new Array(domains.length);

  for (let i = 0; i < domains.length; i += concurrency) {
    const chunk = domains.slice(i, i + concurrency);
    const promises = chunk.map(async (domain, index) => {
      const landerUrl = landerImageSrc(domain);
      const variantToken = landerCacheToken(domain);
      const { heroPath, slicePaths } = await processLanderScreenshot(landerUrl, domain._id, variantToken, {
        includeSlices,
        ...(includeSlices
          ? {}
          : { heroRatio: SCREENSHOT_SUMMARY_RATIO, heroWidth: 800, heroSuffix: 'lander_thumb' }),
      });
      compressedImages[i + index] = heroPath;
      screenshotSlices[i + index] = includeSlices ? slicePaths : [];
    });
    await Promise.all(promises);
  }

  return { compressedImages, screenshotSlices };
}

function groupCaseEventsByEntityId(events) {
  const byEntityId = new Map();
  for (const event of events) {
    const key = event.entity_id?.toString?.() || String(event.entity_id);
    if (!byEntityId.has(key)) byEntityId.set(key, []);
    const mapped = mapCaseEventToUpdateHistory(event);
    if (mapped) byEntityId.get(key).push(mapped);
  }
  return byEntityId;
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

  const { projectId, reportType, reportFormat, database_name } = payload;
  const entityType = validation.entityType;
  const entityIds = validation.entityIds;
  const isDocx = validation.normalizedReportFormat === 'docx';
  const isAds = entityType === 'ads';
  const isDomains = entityType === 'domains';

  // Normalize profile before image fetch so v3 enrichment.profile_pic_s3 maps to metadata.profile_pic
  const normalizedProfile = payload.profile ? normalizeProfile(payload.profile) : null;

  const startTime = process.hrtime();
  const reportHash = generateReportHash(
    projectId,
    entityIds,
    reportType,
    normalizedProfile?._id,
    reportFormat || 'pdf',
    entityType,
    isDomains ? payload.variantKeysByDomainId : null,
  );

  console.log(`Created the report Hash as: ${reportHash}`);

  try {
    const db = client.db(database_name);
    const project = normalizeProjectField(payload.project);

    let storageUrl;
    let localPath;

    if (isDomains) {
      await updateReportStatus(reportHash, '[10%] Fetching domains from DB');

      const objectIds = buildObjectIds(entityIds);
      const domainsFromDb = await db.collection('Domains').find({ _id: { $in: objectIds } }).toArray();
      const orderedDomains = orderPostsByRequestedIds(entityIds, domainsFromDb)
        .filter(isDomainReviewed)
        .map((domain) => {
          const id = domain._id?.toString?.() || String(domain._id);
          const variantKey = payload.variantKeysByDomainId?.[id] || payload.variantKeysByDomainId?.[domain._id] || '';
          return attachReportLander(domain, variantKey);
        });

      if (orderedDomains.length === 0) {
        throw new Error('No reviewed domains found for the requested IDs');
      }

      await updateReportStatus(reportHash, '[30%] Processing Images');

      const includeSlices = reportType === 'Detailed';
      const { compressedImages, screenshotSlices } = await withSpan(
        'process-images',
        { 'images.count': orderedDomains.length, 'entity.type': 'domains' },
        async () => processAndCacheDomainImages(orderedDomains, { includeSlices, concurrency: 10 }),
      );

      await updateReportStatus(reportHash, '[60%] Generating PDF report');

      const pdfStream = await withSpan(
        'render-pdf',
        { 'report.type': reportType, 'domain.count': orderedDomains.length, 'entity.type': 'domains' },
        async () => {
          if (reportType === 'Summary') {
            return await renderToStream(
              React.createElement(DomainsSummaryReportDocument, {
                domains: orderedDomains,
                project,
                compressedImages,
              }),
            );
          }
          if (reportType === 'Detailed') {
            return await renderToStream(
              React.createElement(DomainsDetailedReportDocument, {
                domains: orderedDomains,
                project,
                compressedImages,
                screenshotSlices,
              }),
            );
          }
          throw new Error(`Domain PDF report type '${reportType}' is not supported`);
        },
      );

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
    } else if (isAds) {
      await updateReportStatus(reportHash, '[10%] Fetching ads from DB');

      const objectIds = buildObjectIds(entityIds);
      const adsFromDb = await db.collection('Ads').find({ _id: { $in: objectIds } }).toArray();
      const orderedAds = orderPostsByRequestedIds(entityIds, adsFromDb);

      const profileIds = [
        ...new Set(
          orderedAds
            .map((ad) => ad.ad_profile_id)
            .filter(Boolean)
            .map((id) => id.toString()),
        ),
      ];
      const profilesById = new Map();
      if (profileIds.length > 0) {
        const joinedProfiles = await db
          .collection('ad_profiles')
          .find({ _id: { $in: buildObjectIds(profileIds) } })
          .toArray();
        for (const profile of joinedProfiles) {
          profilesById.set(profile._id.toString(), profile);
        }
      }

      const caseEvents = await db
        .collection('case_events')
        .find({
          entity_type: { $in: ['ad', 'ads'] },
          entity_id: { $in: objectIds },
        })
        .sort({ occurred_at: 1 })
        .toArray();
      const eventsByAdId = groupCaseEventsByEntityId(caseEvents);

      await updateReportStatus(reportHash, '[30%] Processing Images');

      const includeAllCards = reportType === 'Detailed';
      const { compressedImages, compressedCardImages } = await withSpan(
        'process-images',
        { 'images.count': orderedAds.length, 'entity.type': 'ads' },
        async () => processAndCacheAdImages(orderedAds, { includeAllCards, concurrency: 10 }),
      );

      const ads = orderedAds.map((ad) => {
        const profileKey = ad.ad_profile_id?.toString?.() || (ad.ad_profile_id ? String(ad.ad_profile_id) : null);
        return normalizeAd(ad, {
          joinedProfile: profileKey ? profilesById.get(profileKey) || null : null,
          updateHistory: eventsByAdId.get(ad._id.toString()) || [],
        });
      });

      await updateReportStatus(reportHash, '[60%] Generating PDF report');

      const pdfStream = await withSpan(
        'render-pdf',
        { 'report.type': reportType, 'ad.count': ads.length, 'entity.type': 'ads' },
        async () => {
          if (reportType === 'Summary') {
            return await renderToStream(
              React.createElement(AdsSummaryReportDocument, { ads, project, compressedImages }),
            );
          }
          if (reportType === 'Detailed') {
            return await renderToStream(
              React.createElement(AdsDetailedReportDocument, {
                ads,
                project,
                compressedImages,
                compressedCardImages,
              }),
            );
          }
          throw new Error(`Ads PDF report type '${reportType}' is not supported`);
        },
      );

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
    } else {
    await updateReportStatus(reportHash, '[10%] Fetching posts from DB');

    const objectIds = buildObjectIds(entityIds);
    const postsFromDb = await db.collection('Posts').find({ _id: { $in: objectIds } }).toArray();

    const orderedPosts = orderPostsByRequestedIds(entityIds, postsFromDb);

    const profileIds = [
      ...new Set(
        orderedPosts
          .map((p) => p.profile_id)
          .filter(Boolean)
          .map((id) => id.toString()),
      ),
    ];
    const profilesById = new Map();
    if (profileIds.length > 0) {
      const joinedProfiles = await db
        .collection('profiles')
        .find({ _id: { $in: buildObjectIds(profileIds) } })
        .toArray();
      for (const p of joinedProfiles) {
        profilesById.set(p._id.toString(), p);
      }
    }

    const caseEvents = await db
      .collection('case_events')
      .find({
        entity_type: 'post',
        entity_id: { $in: objectIds },
      })
      .sort({ occurred_at: 1 })
      .toArray();
    const eventsByPostId = groupCaseEventsByEntityId(caseEvents);

    await updateReportStatus(reportHash, '[30%] Processing Images');

    const { compressedImages, compressedProfilePic } = await withSpan(
      'process-images',
      { 'images.count': orderedPosts.length },
      async () => {
        const imgs = await processAndCacheImages(orderedPosts, 10);
        let profilePic = null;
        const needsProfilePic =
          (reportType === 'Profile' || reportType === 'SimpleProfile') &&
          normalizedProfile?.metadata?.profile_pic;
        if (needsProfilePic) {
          profilePic = await processImage(
            normalizedProfile.metadata.profile_pic,
            normalizedProfile._id,
            'profile',
          );
        }
        return { compressedImages: imgs, compressedProfilePic: profilePic };
      },
    );

    const posts = orderedPosts.map((p) => {
      const profileKey = p.profile_id?.toString?.() || (p.profile_id ? String(p.profile_id) : null);
      return normalizePost(p, {
        joinedProfile: profileKey ? profilesById.get(profileKey) || null : null,
        updateHistory: eventsByPostId.get(p._id.toString()) || [],
      });
    });

    const reportLabel = isDocx ? 'DOCX' : 'PDF';
    await updateReportStatus(reportHash, `[60%] Generating ${reportLabel} report`);

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
          return await generateProfileDocxBuffer(
            normalizedProfile,
            posts,
            project,
            compressedImages,
            compressedProfilePic,
            clientDetails,
          );
        }
        if (reportType === 'SimpleProfile') {
          return await generateSimpleProfileDocxBuffer(normalizedProfile, posts, project, compressedImages);
        }
        if (reportType === 'SimpleCase') {
          return await generateSimpleCaseDocxBuffer(posts[0], project, compressedImages[0]);
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
              profile: normalizedProfile,
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
  processAndCacheAdImages,
  processAndCacheDomainImages,
};
