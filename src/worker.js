require('dotenv').config();

// Enable Babel for JSX parsing in Node.js
require('@babel/register')({
  presets: ['@babel/preset-env', '@babel/preset-react'],
  extensions: ['.js', '.jsx']
});

const { Worker } = require('bullmq');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { ObjectId } = require('mongodb');
const { connectToMongo, getMongoClient } = require('./mongo');
const { redisConnection } = require('./redis');
const { uploadStreamToS3, fetchImageFromS3Url } = require('./s3');
const { renderToStream } = require('@react-pdf/renderer');
const React = require('react');
const { trace, context, propagation, SpanKind, metrics, SpanStatusCode } = require('@opentelemetry/api');

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

// Normalization function
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

const IMAGE_CACHE_DIR = path.join(__dirname, '../cache/images');

// Ensure cache directory exists
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
      // 1. Attempt optimized processing with Sharp
      await sharp(buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(cachedPath);
    } catch (sharpError) {
      // 2. Intelligent Raw Fallback: If Sharp fails but it's a valid JPEG/PNG, React-PDF can read it natively
      const magicBytes = buffer.toString('hex', 0, 4).toLowerCase();
      
      // JPEG (ffd8...), PNG (8950...)
      if (magicBytes.startsWith('ffd8') || magicBytes.startsWith('8950')) {
        console.warn(`[Fallback Triggered] Sharp failed, but recognized valid JPEG/PNG magic bytes (${magicBytes}) for ${id}. Saving raw file. Reason: ${sharpError.message}`);
        fs.writeFileSync(cachedPath, buffer);
        return cachedPath;
      }
      
      console.error(`[Irrecoverable] Failed to process image ${imageUrl} for ${id}. Magic Bytes: ${magicBytes} - Error:`, sharpError.message);
      return null; // Return null instead of throwing to prevent failing the entire report
    }
  }
  return cachedPath;
}

// Optimization: Process images in chunks to prevent Heap OOM
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
    
    // Optional: Small delay to let GC catch up if needed
    // await new Promise(resolve => setTimeout(resolve, 50));
  }

  return results;
}

// OTel Tracing Wrapper
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

async function startWorker() {
  await connectToMongo();
  const client = getMongoClient();

  console.log('Worker is ready and waiting for jobs...');

  const worker = new Worker('pdf-generation', async (job) => {
    const parentContext = propagation.extract(context.active(), job.data.otelCarrier || {});

    return await context.with(parentContext, async () => {
      return await tracer.startActiveSpan(`job-generate-pdf`, {
        kind: SpanKind.CONSUMER,
        attributes: {
          'messaging.system': 'bullmq',
          'messaging.destination': 'pdf-generation',
          'messaging.operation': 'process',
          'job.id': job.id
        }
      }, async (span) => {
        const startTime = process.hrtime();
        const { projectId, postIds, reportHash, reportType, database_name, project, profile } = job.data;
        
        try {
          span.setAttribute('project.id', projectId);
          span.setAttribute('report.type', reportType);
          span.setAttribute('post.count', postIds.length);
          
          await job.updateProgress(10);
          
          // 1. Fetch full post data from Mongo
          const rawPosts = await withSpan('db-fetch-posts', { 'db.name': database_name, 'post.count': postIds.length }, async () => {
            const db = client.db(database_name);
            const objectIds = postIds.map(id => new ObjectId(id));
            return await db.collection('Posts')
              .find({ _id: { $in: objectIds } })
              .toArray();
          });

          // Maintain order of IDs
          const orderedPosts = postIds.map(id => rawPosts.find(p => p._id.toString() === id.toString())).filter(Boolean);
            
          await job.updateProgress(30);
          
          // 2. Process/Fetch Images from Volume Cache with concurrency limit
          const { compressedImages, compressedProfilePic } = await withSpan('process-images', { 'images.count': orderedPosts.length }, async () => {
            const imgs = await processAndCacheImages(orderedPosts, 10); // Process 10 at a time
            let profilePic = null;
            if (reportType === 'Profile' && profile?.metadata?.profile_pic) {
              profilePic = await processImage(profile.metadata.profile_pic, profile._id, 'profile');
            }
            return { compressedImages: imgs, compressedProfilePic: profilePic };
          });
          
          // Normalize posts
          const posts = orderedPosts.map(p => normalizePost(p));
          
          await job.updateProgress(50);
          
          // 3. Render PDF
          // Note: For very large reports, this is the main memory consumer
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
          
          await job.updateProgress(70);

          // 4. Upload Stream directly to S3
          const s3Url = await withSpan('upload-s3', { 's3.key': `reports/${reportHash}.pdf` }, async () => {
            return await uploadStreamToS3(pdfStream, `reports/${reportHash}.pdf`);
          });
          
          await job.updateProgress(90);

          // 5. Save PDF metadata to DB
          await withSpan('db-save-metadata', { 'report.hash': reportHash }, async () => {
            await client.db(database_name).collection('pdf_reports').updateOne(
              { reportHash },
              { $set: { reportHash, url: s3Url, created_at: new Date() } },
              { upsert: true }
            );
          });
          
          await job.updateProgress(100);

          const [seconds, nanoseconds] = process.hrtime(startTime);
          pdfGenerationDuration.record(seconds + nanoseconds / 1e9, {
            'report.type': reportType,
            'project.id': projectId,
            'status': 'success'
          });

          span.end();
          return { url: s3Url };

        } catch (error) {
          const [seconds, nanoseconds] = process.hrtime(startTime);
          pdfGenerationDuration.record(seconds + nanoseconds / 1e9, {
            'report.type': job?.data?.reportType || 'Unknown',
            'project.id': job?.data?.projectId || 'Unknown',
            'status': 'failed'
          });

          span.recordException(error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          span.end();
          throw error;
        }
      });
    }); 
  }, { 
    connection: redisConnection, 
    concurrency: process.env.WORKER_CONCURRENCY ? parseInt(process.env.WORKER_CONCURRENCY, 10) : 1,
    lockDuration: 600000, // 10 minutes lock for massive reports
    lockRenewTime: 30000, // Renew every 30 seconds
  });

  worker.on('completed', job => {
    console.log(`Job ${job.id} completed successfully.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed:`, err.message);
  });
}

startWorker().catch(console.error);
