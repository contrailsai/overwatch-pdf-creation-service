require('dotenv').config();

// Enable Babel for JSX parsing in Node.js
require('@babel/register')({
  presets: ['@babel/preset-env', '@babel/preset-react'],
  extensions: ['.js', '.jsx'],
  cache: false // Disable cache to prevent permission warnings in Lambda
});

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { connectToMongo, getMongoClient } = require('./mongo');
const { uploadStreamToS3, fetchImageFromS3Url } = require('./s3');
const { renderToStream } = require('@react-pdf/renderer');
const React = require('react');
const { trace, context, propagation, SpanKind, metrics, SpanStatusCode } = require('@opentelemetry/api');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { MeterProvider } = require('@opentelemetry/sdk-metrics');

const tracer = trace.getTracer('overwatch-pdf-worker-tracer');
const meter = metrics.getMeter('overwatch-pdf-worker-meter');

const pdfGenerationDuration = meter.createHistogram('job_generate_pdf_duration_seconds', {
  description: 'Time taken to generate a PDF report',
  unit: 's',
});

const { DetailedCasesReportDocument } = require('./components/DetailedCaseReport');
const { SingleCaseReportDocument } = require('./components/SingleCaseReport');
const { ProfileReportDocument } = require('./components/ProfileReport');
const { RiskReportDocument } = require('./components/SummaryReport');
const { supabase } = require('./supabase');

async function updateReportStatus(reportHash, statusText, extraFields = {}) {
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

function generateReportHash(projectId, postIds, reportType, profileId = '') {
  const sortedIds = [...postIds].sort();
  const rawString = `${projectId}-${sortedIds.join(',')}-${reportType}-${profileId}`;
  return crypto.createHash('sha256').update(rawString).digest('hex');
}

function normalizePost(post, signedImageUrl = null) {
  return {
    _id: post._id.toString(),
    created_at: post.metadata?.created_at ? new Date(post.metadata.created_at).toISOString() : null,
    sourcing_date: post.metadata?.sourcing_date ? new Date(post.metadata.sourcing_date).toISOString() : null,
    posted_date: post.engagement?.posted_at ? new Date(post.engagement.posted_at).toISOString() : post.metadata?.posted_date ? new Date(post.metadata.posted_date).toISOString() : null,
    taken_at: post.post_content?.taken_at || post.taken_at || null,
    updated_at: post.metadata?.updated_at ? new Date(post.metadata.updated_at).toISOString() : null,
    reviewed_at: post.review_details?.reviewed_at ? new Date(post.review_details.reviewed_at).toISOString() : null,
    update_history: post.metadata?.update_history ? post.metadata.update_history.map(update => ({
      ...update,
      updated_at: update.updated_at ? new Date(update.updated_at).toISOString() : null,
    })) : [],
    platform: post.platform ? post.platform.toLowerCase() : 'instagram',
    processed: post.processed || false,
    client_status: post.client_status || 'To Be Reviewed',
    caption: post.post_content?.caption || post.caption || '',
    signedImageUrl: signedImageUrl,
    original_url: post.original_url,
    post_id: post.post_id || post.code,
    user: {
      username: post.profile?.username || post.user?.username || 'Unknown',
      full_name: post.profile?.display_name || '',
      profile_pic_url: post.profile?.profile_pic_url || post.profile?.profile_url || '',
      is_verified: post.profile?.is_verified || false
    },
    assigned_to: post?.assigned_to || null,
    content_reviewed_by: post?.content_reviewed_by || null,
    review_details: post.review_details || null,
    takedown_info: post.takedown_info || null,
    analysis_results: post.analysis_results || null,
    client_notes: post.client_notes || [],
    stats: {
      like_count: post.engagement?.likes || 0,
      comment_count: post.engagement?.comments || 0,
      share_count: post.engagement?.shares || 0,
      view_count: post.engagement?.views || 0
    }
  };
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
  if (!isMongoConnected) {
    await connectToMongo();
    isMongoConnected = true;
  }
  const client = getMongoClient();

  for (const record of event.Records) {
    let payload;
    try {
      payload = JSON.parse(record.body);
    } catch (e) {
      console.error("Failed to parse SQS message body", record.body);
      continue;
    }

    const { projectId, postIds, reportType, database_name, project, profile, otelCarrier } = payload;

    if (!projectId || !postIds || !Array.isArray(postIds) || !database_name) {
      console.error('Invalid payload: missing projectId, postIds, or database_name');
      continue;
    }

    const parentContext = otelCarrier ? propagation.extract(context.active(), otelCarrier) : context.active();

    await context.with(parentContext, async () => {
      return await tracer.startActiveSpan(`job-generate-pdf`, {
        kind: SpanKind.CONSUMER,
        attributes: {
          'messaging.system': 'sqs',
          'messaging.operation': 'process',
          'message.id': record.messageId
        }
      }, async (span) => {
        const startTime = process.hrtime();
        const reportHash = generateReportHash(projectId, postIds, reportType, profile?._id);
        
        try {
          span.setAttribute('project.id', projectId);
          span.setAttribute('report.type', reportType);
          span.setAttribute('post.count', postIds.length);

          const db = client.db(database_name);
          
          await updateReportStatus(reportHash, '[10%] Fetching Posts from DB');

          const objectIds = postIds.map(id => new ObjectId(id));
          const postsFromDb = await db.collection('Posts')
            .find({ _id: { $in: objectIds } })
            .toArray();

          span.setAttribute('cache.hit', false);

          // Maintain order of IDs
          const orderedPosts = postIds.map(id => postsFromDb.find(p => p._id.toString() === id.toString())).filter(Boolean);

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

          await updateReportStatus(reportHash, '[60%] Generating PDF report');

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
              return await renderToStream(React.createElement('Document', null, React.createElement('Page', null, React.createElement('Text', null, 'Report type not supported'))));
            }
          });

          await updateReportStatus(reportHash, '[80%] Uploading to S3');

          const s3Url = await withSpan('upload-s3', { 's3.key': `reports/${reportHash}.pdf` }, async () => {
            return await uploadStreamToS3(pdfStream, `reports/${reportHash}.pdf`);
          });

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
          throw error;
        }
      });
    });
  }

  // Force flush telemetry before the Lambda freezes
  try {
    const tracerProvider = trace.getTracerProvider();
    if (tracerProvider instanceof NodeTracerProvider && typeof tracerProvider.forceFlush === 'function') {
      await tracerProvider.forceFlush();
    }
    
    const meterProvider = metrics.getMeterProvider();
    if (meterProvider instanceof MeterProvider && typeof meterProvider.forceFlush === 'function') {
      await meterProvider.forceFlush();
    }
  } catch (e) {
    console.error("Failed to force flush telemetry", e);
  }
};