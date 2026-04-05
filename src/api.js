require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Queue } = require('bullmq');
const { propagation, context } = require('@opentelemetry/api');
const { connectToMongo, getMongoClient } = require('./mongo');
const { redisConnection } = require('./redis');

const app = express();
app.use(cors());
app.use(express.json());

const pdfQueue = new Queue('pdf-generation', { connection: redisConnection });

function generateReportHash(projectId, postIds, reportType, profileId = '') {
  const sortedIds = [...postIds].sort();
  const rawString = `${projectId}-${sortedIds.join(',')}-${reportType}-${profileId}`;
  return crypto.createHash('sha256').update(rawString).digest('hex');
}

app.post('/generate', async (req, res) => {
  try {
    const { projectId, postIds, reportType, database_name, project, profile } = req.body;

    if (!projectId || !postIds || !Array.isArray(postIds) || !database_name) {
      return res.status(400).json({ error: 'Invalid payload: missing projectId, postIds, or database_name' });
    }

    const reportHash = generateReportHash(projectId, postIds, reportType, profile?._id);
    const client = getMongoClient();
    const db = client.db(database_name);

    // Fetch timestamps for requested postIds
    // Use ObjectId if postIds are strings that represent Mongo ObjectIds
    const { ObjectId } = require('mongodb');
    const objectIds = postIds.map(id => new ObjectId(id));

    const posts = await db.collection('Posts')
      .find({ _id: { $in: objectIds } })
      .project({ 'metadata.updated_at': 1, 'review_details.reviewed_at': 1 })
      .toArray();

    // Determine the latest updated_at
    let latestUpdatedAt = new Date(0);
    for (const post of posts) {
      const updatedAt = post.metadata?.updated_at || post.review_details?.reviewed_at;
      const date = new Date(updatedAt);
      if (date > latestUpdatedAt) {
        latestUpdatedAt = date;
      }
    }

    // Check if we have an existing PDF
    const existingPdf = await db.collection('pdf_reports').findOne({ reportHash });

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    if (existingPdf && new Date(existingPdf.created_at) > latestUpdatedAt && new Date(existingPdf.created_at) > fiveMinutesAgo) {
      // CACHE HIT
      return res.json({ status: 'completed', url: existingPdf.url });
    }

    const otelCarrier = {};
    propagation.inject(context.active(), otelCarrier);

    // CACHE MISS - enqueue job
    const job = await pdfQueue.add('generate-pdf', {
      projectId,
      postIds,
      reportType,
      reportHash,
      database_name,
      project, // Allow passing full project details directly
      profile, // Pass full profile details for profile reports
      otelCarrier,
    });

    return res.json({ status: 'processing', jobId: job.id });
  } catch (error) {
    console.error('Error in /generate:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/job-status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await pdfQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const state = await job.getState();
    const progress = job.progress;

    if (state === 'completed') {
      return res.json({ status: 'completed', url: job.returnvalue.url });
    }

    if (state === 'failed') {
      return res.json({ status: 'failed', error: job.failedReason });
    }

    return res.json({ status: 'processing', progress });
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 4000;

async function startApi() {
  await connectToMongo();
  app.listen(PORT, () => {
    console.log(`API server listening on port ${PORT}`);
  });
}

startApi().catch(console.error);
