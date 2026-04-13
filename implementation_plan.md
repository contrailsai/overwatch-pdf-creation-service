# Overwatch PDF Service Lambda Migration Plan

This document outlines the architecture and implementation plan for migrating the standalone PDF generation service to an AWS Lambda function running as a single Docker container triggered by AWS SQS.

## Architecture Overview

1. **AWS SQS:** Acts as the message queue receiving PDF generation requests (previously handled by the Express API).
2. **Lambda Container (Node.js ARM64):** A single unified Docker image that gets invoked by SQS.
   - Replaces the separate API, Worker, and Redis architecture.
   - Evaluates the cache, MongoDB, and S3 right when the SQS event triggers.
   - Decides whether to reuse an existing PDF or generate a new one via `@react-pdf/renderer` and `sharp`.
3. **S3, MongoDB, & Supabase:** MongoDB stores raw post data, S3 stores output PDFs and images, and Supabase tracks real-time PDF generation progress for clients.

## Phase 1: Dependency & Architecture Shift

AWS Lambda cannot natively "listen" to a Redis queue. SQS integrates natively with Lambda, meaning we can drop BullMQ and Redis entirely.

1. **Remove Packages:**
   - Remove `bullmq`, `ioredis`, and `express` from `package.json`.
   - Remove `redis.js`, `api.js`, and `worker.js`.
2. **The New Entrypoint:**
   - Create `src/index.js` that exports the standard Lambda handler: `exports.handler = async (event) => { ... }`.
   - AWS automatically wakes up the container and passes the SQS messages inside `event.Records`.

## Phase 2: Docker & ARM64 Optimization (sharp)

`sharp` uses highly optimized C++ binaries. If we build on Mac (ARM) and deploy to Lambda (x86_64), it will crash.
**The Fix:** We will target the `arm64` architecture for Lambda (it's 20% cheaper and faster).

**Updated Dockerfile Strategy:**
- Use the official AWS Lambda Node.js base image: `FROM public.ecr.aws/lambda/nodejs:20`
- Explicitly tell `npm` to install `sharp` for the `linux/arm64` architecture by setting environment variables (`npm_config_arch=arm64`, `npm_config_platform=linux`).

## Phase 3: Cache Validation & PDF Generation Logic

Since we now execute entirely within the Lambda upon an SQS trigger, the validation logic moves into the Lambda handler.

### 1. Unified SQS Handler (`src/index.js`)
* **Input:** `event.Records` contains the SQS message body (with `projectId`, `postIds`, `reportType`).
* **Step 1:** Sort `postIds` deterministically and generate a `reportHash`.
* **Step 2:** Fetch metadata for `postIds` from MongoDB to get `latest_updated_at`.
* **Step 3:** The client verifies the cache using Supabase. The Lambda uses `reportHash` to update a `reports_generation` row in Supabase with real-time percentage progress updates.
* **Step 4:** Fetch images, process them using `sharp`, and render the PDF using `@react-pdf/renderer`. 
* **Step 5:** Upload to S3 and mark the Supabase row as 100% complete with the S3 URL.

### 2. Rendering & Image Handling (Inside Lambda)
* **Image Processing (`sharp`):**
    * Download raw images from S3.
    * Process via `sharp` (resize, convert to JPEG) directly in Lambda `/tmp` space.
    * *Note: Lambda container disk is read-only except for `/tmp`, which has a 512MB-10GB limit.*
* **Memory Limits (The Silent Killer):**
    * A 1,200+ item PDF holds a massive amount of RAM before flushing it to the file system.
    * **The Fix:** Provision the Lambda with **4 GB to 8 GB of RAM**. This gives `@react-pdf/renderer` the necessary overhead to process without the Node.js Garbage Collector thrashing and crashing with OOM.
* **Streaming to S3:**
    * Render PDF to a stream and upload directly to S3.

## Phase 4: Clean Up & Deployment

- Delete `docker-compose.yml` (since we won't need local Redis/Worker/API multi-container setup anymore).
- Update IAM roles to allow Lambda to consume from the target SQS queue and write to S3/MongoDB.
- Configure SQS queue with an appropriate Visibility Timeout (e.g., 5-10 minutes) so Lambda has enough time to generate the PDF before the message is retried.