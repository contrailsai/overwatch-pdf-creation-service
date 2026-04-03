# Overwatch PDF Service Migration Plan

This document outlines the architecture and implementation plan for migrating the client-side PDF generation to a dedicated, scalable server-side Node.js service.

## Architecture Overview

1. **Express API Container:** Handles incoming PDF requests, checks cache validity, and enqueues background jobs.
2. **Worker Container (Node.js):** Consumes jobs, fetches/processes data, renders PDFs via `@react-pdf/renderer`, and streams uploads directly to S3.
3. **Redis Container:** Acts as the message broker for BullMQ and a fast key-value store for Job status.
4. **Docker Volumes:** 
    * `image-cache-volume`: Stores `sharp`-processed, PDF-ready images (e.g., JPEG, 800px width) mapped by Case ID.
    * `font-volume`: Stores pre-loaded fonts (`.ttf`) so React-PDF doesn't re-download them.

---

## Phase 1: Infrastructure & Docker Setup

**`docker-compose.yml`**
```yaml
version: '3.8'
services:
  api:
    build: .
    command: npm run start:api
    ports:
      - "4000:4000"
    environment:
      - REDIS_URL=redis://redis:6379
      - MONGO_URI=${MONGO_URI}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
    volumes:
      - image-cache-volume:/app/cache/images
    depends_on:
      - redis

  worker:
    build: .
    command: npm run start:worker
    environment:
      - REDIS_URL=redis://redis:6379
      - MONGO_URI=${MONGO_URI}
    deploy:
      resources:
        limits:
          memory: 1.5G # Prevent OOM crashes from bringing down the host
    volumes:
      - image-cache-volume:/app/cache/images

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  image-cache-volume:
```

---

## Phase 2: Core Logic & Cache Validation (The "Careful" Part)

Before generating a PDF, the API must determine if a valid cached PDF already exists.

### 1. PDF Versioning Logic (API Route: `POST /generate`)
* **Input:** `projectId`, `postIds` (Array of IDs), `reportType` (Single vs Detailed).
* **Step 1:** Sort `postIds` deterministically and generate a hash (e.g., `SHA256(projectId + sorted_postIds.join(',') + reportType)`). This is the `reportHash`.
* **Step 2:** Fetch metadata for all `postIds` from MongoDB, specifically projecting **only** the `metadata.updated_at` (or `review_details.reviewed_at`) fields.
* **Step 3:** Find the `latest_updated_at` timestamp across all requested cases.
* **Step 4:** Query the DB (or Redis) for an existing PDF record matching the `reportHash`.
* **Step 5 (The Check):** 
    * If `existing_pdf.created_at > latest_updated_at`: **CACHE HIT**. Return the existing S3 URL immediately.
    * If `existing_pdf.created_at <= latest_updated_at` OR no PDF exists: **CACHE MISS**. Push a new job to the Redis queue.

### 2. Image Volume Caching Logic (Worker Process)
When the worker starts processing a job:
* Iterate through the cases. For each image:
    * Check if `/app/cache/images/${caseId}_processed.jpg` exists on the Docker volume.
    * **If Yes:** Read it directly into `@react-pdf`. (Huge network/CPU saving).
    * **If No:** Fetch raw image from S3, pass it through `sharp` (resize to max 800px width, convert to JPEG, quality 80), save to `/app/cache/images/`, and *then* pass to `@react-pdf`.

---

## Phase 3: Worker Implementation (Node.js & BullMQ)

The Worker is where the heavy lifting happens without blocking the API.

### 1. Queue Setup (BullMQ)
```javascript
import { Queue, Worker } from 'bullmq';

const pdfQueue = new Queue('pdf-generation', { connection: redisConnection });

const worker = new Worker('pdf-generation', async (job) => {
    const { projectId, postIds, reportHash } = job.data;
    
    // 1. Fetch full post data from Mongo
    const posts = await fetchFullPostsFromMongo(projectId, postIds);
    
    // 2. Process/Fetch Images from Volume Cache
    await processAndCacheImages(posts); 
    
    // 3. Render PDF
    job.updateProgress(50); // Tell client we are rendering
    const pdfStream = await renderPdfToStream(posts);
    
    // 4. Upload Stream directly to S3 (No RAM bloat)
    const s3Url = await uploadStreamToS3(pdfStream, `reports/${reportHash}.pdf`);
    
    // 5. Save PDF metadata to DB (for future cache hits)
    await savePdfRecordToDb({ reportHash, url: s3Url, created_at: new Date() });
    
    return { url: s3Url };
}, { connection: redisConnection, concurrency: 2 }); // Limit concurrency
```

### 2. `@react-pdf` Server-Side Streaming
```javascript
import { renderToStream } from '@react-pdf/renderer';
import DetailedCasesReportDocument from './components/DetailedCasesReport';

async function renderPdfToStream(posts) {
    // Note: Node server requires Babel/JSX setup to read React components
    return await renderToStream(<DetailedCasesReportDocument posts={posts} />);
}
```

---

## Phase 4: Client-Side Refactoring (Next.js)

The client must change from generating the PDF to *polling* the server.

### 1. Update `DetailedReportButton.js`
* Remove `@react-pdf/renderer` imports entirely from the Next.js bundle (drastically reduces build size).
* **New Flow:**
    1. Click "Export".
    2. Call Next.js Server Action -> Calls new Node Docker API `POST /generate`.
    3. API returns `{ status: 'completed', url: '...' }` (Cache Hit) OR `{ status: 'processing', jobId: '123' }` (Cache Miss).
    4. If processing, start polling `GET /job-status/123` every 2 seconds.
    5. Show progress in the UI (e.g., "Fetching data...", "Rendering PDF...", "Uploading...").
    6. Once returned `completed`, trigger a programmatic download of the provided S3 URL.

---

## Risk Mitigation & Edge Cases

1. **Orphaned Images:** The local Docker volume for images will grow indefinitely. Implement a simple cron job in the API container that runs daily: `find /app/cache/images -type f -mtime +30 -delete` (Deletes images not accessed in 30 days).
2. **Report Hash Collisions:** Ensure your Hash string includes the `projectId`, `reportType` (Detailed vs Summary), and the *exact order* of `postIds` to prevent returning a mismatched layout to the client.
3. **Missing S3 Images:** The worker must handle cases where S3 URLs are expired or 404. If `sharp` fails to fetch, it should copy a default `placeholder.jpg` from the volume instead of crashing the entire document generation.
4. **Database Indexes:** Ensure you have proper indexes in MongoDB on `_id` and `metadata.updated_at` to make the cache-validation check lightning fast.