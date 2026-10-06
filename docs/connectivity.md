# Connectivity — Mongo, S3, Supabase, SQS, OpenTelemetry

Every external system this service touches, what it is used for, and how failure behaves.

---

## 1. Overview

| System | Direction | Library | Required | Failure behaviour |
| --- | --- | --- | --- | --- |
| **MongoDB** | read | `mongodb` | ✅ | Connection failure throws → whole invocation fails |
| **AWS S3** | read | `@aws-sdk/client-s3` + presigner | ✅ | Image fetch fails → that image is skipped; PDF still renders |
| **AWS S3** | write | `@aws-sdk/lib-storage` (`Upload`) | ✅ | Upload failure throws → document marked `[Error]` |
| **Supabase** | write | `@supabase/supabase-js` | optional | Degrades to a no-op stub; generation continues, progress is invisible |
| **AWS SQS** | trigger | Lambda event source mapping | ✅ | — |
| **OTLP collector** | write | `@opentelemetry/sdk-node` | optional | Export failures are swallowed; `forceFlush` errors are logged |

---

## 2. MongoDB — source data

`src/mongo.js` holds a module-level singleton. The handler connects once per container execution environment (`isMongoConnected`) and reuses the client for the rest of the warm lifetime.

```js
const { connectToMongo, getMongoClient } = require('./mongo');
await connectToMongo();
const client = getMongoClient();
const db = client.db(payload.database_name);
```

**Configuration**

| Env var | Required | Notes |
| --- | --- | --- |
| `MONGO_URI` | ✅ | Throws `Missing required environment variable MONGO_URI.` if absent |

The database is chosen **per request** from `payload.database_name` — one cluster can hold many tenants.

### Collections and field mappings

| Collection | Exact casing | Read by | Key fields |
| --- | --- | --- | --- |
| `Posts` | capital `P` | `posts` | `_id`, `profile_id`, `content.*`, `list.*`, `system.*`, `workflow.*`, `author_snapshot` |
| `profiles` | lowercase | `posts` (join) | `_id`, `enrichment.*`, `list.*`, `metadata.*` |
| `case_events` | lowercase | `posts`, `ads` | `entity_type`, `entity_id`, `occurred_at`, `actor`, `summary`, `payload` |
| `Ads` | capital `A` | `ads`, `ad_profiles` | `_id`, `ad_profile_id`, `linked_domain_ids`, `content.media`, `content.cards`, `list.reviewed_at` |
| `Ad_profiles` | capital `A`, lowercase `p` | `ad_profiles`, `ads` (join) | `_id`, `enrichment.*`, `list.*`, `review_details.*`, `workflow.*` |
| `Domains` | capital `D` | `domains`, `ad_profiles` | `_id`, `analysis_results.cloak_probe`, `review_details.*`, `list.*` |

Casing is load-bearing — the git history contains a fix specifically for the `Posts` collection casing. Schema-v3 documents are read directly; legacy shapes are tolerated by the normalizers in `src/core-utils.js`.

**Queries used**

- Posts: `find({ _id: { $in: objectIds } })`
- Profiles: `find({ _id: { $in: profileIds } })` where `profileIds` are the distinct `post.profile_id`
- Case events: `find({ entity_type: 'post', entity_id: { $in: objectIds } }).sort({ occurred_at: 1 })`; for ads `entity_type: { $in: ['ad','ads'] }`
- Ads: `find({ _id: { $in: objectIds } })`; inside ad-profiles: `find({ ad_profile_id: { $in: reviewedProfileIds }, 'list.reviewed_at': { $ne: null } })`
- Ad profiles: `find({ _id: { $in: objectIds } })`
- Domains: `find({ _id: { $in: objectIds } })`

---

## 3. AWS S3 — media in, documents out

`src/s3.js`.

| Env var | Required | Default |
| --- | --- | --- |
| `AWS_BUCKET_NAME` or `AWS_S3_BUCKET` | ✅ | `''` → throws on first upload |
| `AWS_REGION` | recommended | `ap-south-1` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | in non-Lambda contexts | — (Lambda uses its execution role) |
| `IMAGE_FETCH_TIMEOUT_MS` | optional | `8000` |
| `IMAGE_FETCH_MAX_RETRIES` | optional | `2` |

### Reading media

`fetchImageFromS3Url(url)`:

1. `parseS3Url` splits `https://<bucket>.s3.<region>.amazonaws.com/<key>`. **Only standard virtual-hosted URLs are parsed** — anything else is returned unchanged and fetched as-is.
2. `getSignedImageUrl(url, 3600)` presigns a `GetObjectCommand` for 1 hour.
3. `fetch` with an `AbortController` timeout, up to `MAX_RETRIES + 1` attempts (default 3), exponential backoff `250ms → 500ms → …`.
4. Content-type must start with `image/` or contain `octet-stream`; otherwise it throws.

A failure here is **non-fatal**: `processImage` logs and returns `null`, and the report renders without that image.

### Writing documents

`uploadBufferToS3(buffer, key, contentType)` and `uploadStreamToS3(stream, key, contentType)` both use the `Upload` helper (multipart, auto-retry).

| Output | Key | Content type |
| --- | --- | --- |
| PDF | `reports/<reportHash>.pdf` | `application/pdf` |
| DOCX | `reports/<reportHash>.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |

The returned URL is `https://<bucket>.s3.<region>.amazonaws.com/<key>` and is written to Supabase as `s3_path`.

---

## 4. Supabase — progress and completion

`src/supabase.js`.

| Env var | Required | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | optional | If either is missing, `supabaseEnabled = false` |
| `SUPABASE_KEY` | optional | Service/anon key with write access to `reports_generation` |

When unconfigured the module logs a warning and installs a stub whose `update().eq()` resolves to `{ error: … }`. **Generation still succeeds** — the UI simply never sees progress. This is a common source of "the report worked but the UI is stuck at 0%" confusion locally.

### Table contract — `reports_generation`

The service only ever issues:

```js
supabase.from('reports_generation')
  .update({ status, last_update, ...extraFields })
  .eq('report_hash', reportHash);
```

| Column | Written by service | Purpose |
| --- | --- | --- |
| `report_hash` | lookup key only | Must be pre-created by the client |
| `status` | ✅ | `[10%] …` → `[100%] Complete` or `[Error] …` |
| `last_update` | ✅ | ISO timestamp |
| `s3_path` | ✅ on completion | Final document URL |
| `finish_time` | ✅ on completion/failure | ISO timestamp |

**The service never inserts a row.** `update().eq()` on a missing `report_hash` silently affects zero rows. The client must upsert the row *before* enqueueing. Full client flow: [ui-report-request-flow.md §3](./ui-report-request-flow.md#3-supabase-tuple-lifecycle-reports_generation).

---

## 5. AWS SQS — the trigger

Not called by this code — the Lambda event source mapping pulls messages. The handler is:

```js
exports.handler = async (event) => {
  for (const record of event.Records || []) { /* … */ }
};
```

- `record.body` is parsed as JSON. If it does not parse as a payload object, it is skipped.
- Trace context is taken from `payload.otelCarrier` first, then from `record.messageAttributes` (attribute names lowercased, `stringValue` only).
- Useful span attributes come from `record.messageId`.
- A record that throws is logged and skipped, so **the message is not retried**. Configure the queue's visibility timeout generously (5–10 minutes) so long renders do not get redelivered mid-flight.

---

## 6. OpenTelemetry

`src/instrumentation.js` is imported at the top of `src/index.js` — before `@babel/register` — so auto-instrumentation can patch modules.

| Env var | Purpose |
| --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Collector URL |
| `OTEL_EXPORTER_OTLP_HEADERS` | Collector auth (e.g. `Authorization=Basic …`) |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/protobuf` or `grpc` |
| `OTEL_SERVICE_NAME` | Defaults to `overwatch-pdf-service`; keep it stable so Grafana service graphs stay intact |
| `DEBUG_OTEL=true` | Enables the diagnostic console logger |

`telemetry.forceFlush()` is awaited in the handler's `finally` block, flushing both the tracer and meter providers. `dev-report-server.js` deliberately does **not** load instrumentation, keeping local startup fast.

---

## 7. Caches

| Cache | Location | Key | Lifetime |
| --- | --- | --- | --- |
| Processed images | `IMAGE_CACHE_DIR` (default `/tmp/images`) | `<entityId>_<suffix>.jpg`; landers add `_<variantToken>` and `_lander_slice_r<ratio>_<NN>.jpg` | Container lifetime; `/tmp` is the only writable path in Lambda |
| Report documents | S3 `reports/` | `<reportHash>` | Until deleted; the Supabase row is the pointer |
| Mongo client | Module singleton | — | Warm container |

`REDIS_URL` appears in `.env` but **nothing in the current code reads it** — it is a leftover from the pre-Lambda BullMQ/worker architecture described in `implementation_plan.md`.

---

## 8. Environment matrix

```bash
# Mongo
MONGO_URI=

# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
AWS_S3_BUCKET=

# Supabase
SUPABASE_URL=
SUPABASE_KEY=

# OpenTelemetry
OTEL_SERVICE_NAME=overwatch-pdf-service
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_EXPORTER_OTLP_HEADERS=
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf

# Optional tuning
IMAGE_CACHE_DIR=/tmp/images
IMAGE_FETCH_TIMEOUT_MS=8000
IMAGE_FETCH_MAX_RETRIES=2

# Local dev server
REPORT_DEV_PORT=3847
REPORT_DEV_HOST=127.0.0.1
LOCAL_REPORT_OUTPUT_DIR=local-reports/output
DEV_REPORT_API_KEY=
```

`.env` is gitignored, and `.dockerignore` excludes it from the image — so credentials are **never** baked into the container. Lambda gets them from its function configuration instead. See [deployment.md](./deployment.md).

The watermark asset `public/logo_txt.svg` **is** tracked, which is required: `watermarkPdfStream` reads it on every PDF and throws if it is missing. (`public/Watermark.pdf` exists locally and is gitignored, but no code references it — it is a leftover.)

One more build-context caveat: `@babel/register` transpiles JSX at runtime rather than at build time, so `src/**` must be present in the image.
