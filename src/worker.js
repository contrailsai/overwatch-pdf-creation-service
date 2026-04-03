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

const DetailedCasesReportDocument = require('./components/DetailedCaseReport').DetailedCasesReportDocument;

// Normalization function adapted from getPostsByIds.js
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

async function processAndCacheImages(posts) {
  const compressedImages = [];
  for (const post of posts) {
    // Assuming the image URL is stored in post.imageUrl or post.media.url or post.s3_url
    let imageUrl = null;
    if (post.post_content?.media_urls && post.post_content.media_urls.length > 0) {
      imageUrl = post.post_content.media_urls[0].s3_url || post.post_content.media_urls[0].url;
    } else if (post.s3_url) {
      imageUrl = post.s3_url;
    }

    if (!imageUrl) {
      compressedImages.push(null);
      continue;
    }

    const cachedPath = path.join(IMAGE_CACHE_DIR, `${post._id}_processed.jpg`);
    let localPath = cachedPath;

    // Check if already cached
    if (!fs.existsSync(cachedPath)) {
      try {
        // Fetch raw image
        const buffer = await fetchImageFromS3Url(imageUrl);
        
        // Process with sharp
        await sharp(buffer)
          .resize({ width: 800, withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(cachedPath);
      } catch (error) {
        console.error(`Failed to process image ${imageUrl} for post ${post._id}`, error);
        localPath = null;
        // Fallback placeholder logic can be added here
      }
    }
    
    // Convert local path to a URL-like format that react-pdf can read
    // react-pdf in Node environment can read absolute paths if prefixed with 'file://' or just as absolute path string.
    compressedImages.push(localPath);
  }
  return compressedImages;
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
        try {
          const { projectId, postIds, reportHash, reportType, database_name, project } = job.data;
          span.setAttribute('project.id', projectId);
          span.setAttribute('report.type', reportType);
        
        await job.updateProgress(10);
        
        // 1. Fetch full post data from Mongo
        span.addEvent('Fetching posts from DB');
        const db = client.db(database_name);
        const objectIds = postIds.map(id => new ObjectId(id));
        const rawPosts = await db.collection('Posts')
          .find({ _id: { $in: objectIds } })
          .toArray();

        // Maintain order of IDs if possible
        const orderedPosts = objectIds.map(id => rawPosts.find(p => p._id.toString() === id.toString())).filter(Boolean);
          
        await job.updateProgress(30);
        
        // 2. Process/Fetch Images from Volume Cache
        span.addEvent('Processing images');
        const compressedImages = await processAndCacheImages(orderedPosts);
        
        // Normalize posts
        const posts = orderedPosts.map(p => normalizePost(p));
        
        await job.updateProgress(50);
        
        // 3. Render PDF
        span.addEvent('Rendering PDF');
        let pdfStream;
        if (reportType === 'Detailed') {
          pdfStream = await renderToStream(React.createElement(DetailedCasesReportDocument, { posts, project, compressedImages }));
        } else {
          pdfStream = await renderToStream(React.createElement('Document', null, React.createElement('Page', null, React.createElement('Text', null, 'Report (Not Detailed)'))));
        }
        
        await job.updateProgress(70);

        // 4. Upload Stream directly to S3
        span.addEvent('Uploading Stream to S3');
        const s3Url = await uploadStreamToS3(pdfStream, `reports/${reportHash}.pdf`);
        
        await job.updateProgress(90);

        // 5. Save PDF metadata to DB
        span.addEvent('Saving metadata to DB');
        await db.collection('pdf_reports').updateOne(
          { reportHash },
          {
            $set: {
              reportHash,
              url: s3Url,
              created_at: new Date()
            }
          },
          { upsert: true }
        );
        
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
    concurrency: 2 
  });

  worker.on('completed', job => {
    console.log(`Job ${job.id} completed!`);
  });

  worker.on('failed', (job, err) => {
    console.log(`Job ${job.id} failed with error ${err.message}`);
  });
}

startWorker().catch(console.error);
