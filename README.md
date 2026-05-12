# Overwatch PDF Creation Service

This repository contains the standalone, serverless AWS Lambda backend service responsible for dynamically generating PDF reports for the Overwatch platform. It is designed around an event-driven architecture triggered by AWS SQS.

## 🚀 Features

* **Event-Driven Execution:** Runs as a Dockerized AWS Lambda function triggered by SQS queues, ensuring scalability and isolation.
* **React-Based PDF Generation:** Uses `@react-pdf/renderer` to build complex, highly styled PDF documents using familiar React components.
* **On-the-fly Image Optimization:** Fetches media from S3 and heavily compresses/resizes them using `sharp` before embedding them into the PDF, significantly reducing the final file size and memory footprint.
* **Real-time Status Tracking:** Communicates with Supabase at various milestones (10%, 30%, 60%, 80%, 100%) to provide users with a live progress bar on the frontend UI.
* **Comprehensive Telemetry:** Fully instrumented with OpenTelemetry to export traces and metrics to Grafana, providing deep observability into generation times, cache hits, and external service latencies.

---

## 📊 Supported Report Types

The service dynamically selects the React layout based on the `reportType` requested in the SQS payload:

1. **Detailed Report** (`DetailedCaseReport.js`)
   * A comprehensive, multi-case document that iterates over numerous posts, displaying detailed metadata, engagement stats, and full image contents for each case.
   
2. **Single Case Report** (`SingleCaseReport.js`)
   * A focused, in-depth analysis of one specific post/case. Usually contains more granular context around the single event.

3. **Profile Report** (`ProfileReport.js`)
   * Focuses on a specific actor/profile. It processes the user's profile picture and aggregates multiple cases/posts associated with that user to build a unified profile dossier.

4. **Summary / Risk Report** (`SummaryReport.js`)
   * A high-level overview (Risk Report) summarizing multiple posts without going overly deep into individual post metadata. Useful for executive briefs.

---

## 🧠 Logic & Workflow (How Reports are Made)

When an SQS message is received, the Lambda executes the following pipeline:

1. **Initialization & Parsing:** 
   Extracts `projectId`, `postIds`, `reportType`, `database_name`, and tracing context (`otelCarrier` / `messageAttributes`) from the SQS payload.
2. **Data Fetching (10%):** 
   Connects to MongoDB and fetches the full metadata for the requested `postIds` from the `Posts` collection. The array order requested in the SQS payload is strictly maintained.
3. **Image Processing & Caching (30%):** 
   * Iterates through the posts and downloads associated S3 image URLs to Lambda's `/tmp/images` ephemeral storage.
   * Compresses and resizes images to a max width of 800px using `sharp`. 
   * If `sharp` fails, it falls back to raw buffer saving (provided the file passes JPEG/PNG magic byte checks).
4. **PDF Generation (60%):** 
   Normalizes the database post objects and passes them alongside the compressed local images to the appropriate React PDF component. The component renders the document into a Node.js Stream.
5. **S3 Upload (80%):** 
   The generated PDF stream is piped directly into the target AWS S3 bucket under `reports/{reportHash}.pdf`. (The `reportHash` is deterministically generated from the project ID, post IDs, and report type).
6. **Completion & Sync (100%):** 
   Updates the `reports_generation` table in Supabase with the final S3 URL and completion timestamp.
7. **Telemetry Flush:** 
   Before the Lambda environment freezes, OpenTelemetry `forceFlush()` is called to ensure all metrics and traces (e.g., `generate_pdf_duration_seconds`) reach Grafana.

---

## 🛠️ Architecture Setup

- **Language:** Node.js 20 (Babel enabled for JSX parsing outside of a browser context)
- **Containerization:** `public.ecr.aws/lambda/nodejs:20` base image.
- **Image Processing:** `sharp` (specifically compiled for `linux/arm64` via Docker ENVs).
- **Storage/DB:** MongoDB (Data), AWS S3 (PDF Output/Raw Images), Supabase (Status State).
- **Observability:** `@opentelemetry/sdk-node`

### Important Environment Variables

The container requires the following environment variables to run properly:

* **AWS Settings:** Standard AWS credentials for S3 and SQS access.
* **Database & Auth:** MongoDB connection strings and Supabase keys.
* **OpenTelemetry:**
  * `OTEL_EXPORTER_OTLP_ENDPOINT`: Your OTLP collector URL.
  * `OTEL_EXPORTER_OTLP_HEADERS`: Auth headers for the collector.
  * `OTEL_EXPORTER_OTLP_PROTOCOL`: `http/protobuf` or `grpc`.
  * `OTEL_SERVICE_NAME`: Set to `overwatch-pdf-service` to correctly aggregate in Grafana Service Graphs.

---

## Local Verification (No ECR/Lambda Deploy Required)

You can now validate report generation locally with automated tests.

### 1) Install dependencies

```bash
npm install
```

### 2) Run all tests

```bash
npm test
```

This runs:
- Unit tests for payload validation, hash determinism, and ordering logic.
- Local smoke tests that generate:
  - one real PDF stream using the Summary report renderer
  - one real DOCX buffer using the single-case DOCX generator

### 3) Run suites separately (optional)

```bash
npm run test:unit
npm run test:integration
```

### Notes

- These tests do not require Docker, ECR, or Lambda deployment.
- Integration smoke tests validate renderer output signatures (`%PDF` and DOCX zip header `PK`) to catch report-generation regressions quickly.
