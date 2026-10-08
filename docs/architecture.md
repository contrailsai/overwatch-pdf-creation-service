# Architecture

Overwatch PDF Creation is a **standalone, event-driven report renderer**. It owns no database and exposes no public HTTP API in production. It is a Dockerised AWS Lambda that consumes SQS messages and writes finished documents to S3.

---

## 1. Runtime shape

```
                      ┌──────────────────────────┐
   UI / API  ──SQS──▶ │  Lambda (Docker, arm64)  │
                      │  src/index.js  handler   │
                      └────────────┬─────────────┘
                                   │ runReportJob()
        ┌──────────────┬───────────┼────────────┬──────────────┐
        ▼              ▼           ▼            ▼              ▼
   MongoDB          S3 (read)   sharp      @react-pdf      S3 (write)
   Posts/Ads/       media       resize     / docx          reports/
   Domains/…        images     → /tmp      renderer        <hash>.pdf
        │                                                  <hash>.docx
        ▼
   Supabase  reports_generation  (progress + final s3_path)
        │
        ▼
   OTLP collector  →  Grafana (traces + metrics)
```

- **Trigger:** SQS → Lambda. `src/index.js` reads `event.Records`, so one invocation can carry a batch.
- **Entry point:** `exports.handler`. `CMD ["src/index.handler"]` in the `Dockerfile`.
- **Local equivalent:** `src/dev-report-server.js` — same `runReportJob` pipeline, HTTP in, file out. See [local-testing.md](./local-testing.md).

---

## 2. Module map

| Module | Responsibility |
| --- | --- |
| `src/index.js` | Lambda handler. Mongo connect-once, per-record body parse, validation, OTEL context extraction, span attributes, `runReportJob`, telemetry `forceFlush` |
| `src/report-job.js` | The pipeline. Branch per `entityType`, Mongo reads, joins, image caching, renderer selection, persistence, progress updates, duration metric |
| `src/core-utils.js` | Validation, hash generation, entity resolution, normalizers (`normalizePost`, `normalizeAd`, `normalizeProfile`, `normalizeAdProfile`, `normalizeApp`), media URL resolution, ad sorting/capping, case-event mapping, app evidence-image slots |
| `src/domain-display.js` | Domain/lander domain logic: review checks, lander selection, screenshot slice planning, screenshot ratios |
| `src/s3.js` | S3 client, multipart upload (stream + buffer), signed-URL generation, image fetch with timeout + exponential backoff |
| `src/mongo.js` | Singleton `MongoClient`; `connectToMongo()` / `getMongoClient()` |
| `src/supabase.js` | Supabase client for the `reports_generation` table; degrades to a no-op stub when unconfigured |
| `src/pdf-watermark.js` | Stamps the Contrails watermark onto every PDF stream |
| `src/instrumentation.js` | OpenTelemetry `NodeSDK` bootstrap + `forceFlush()` |
| `src/dev-report-server.js` | Local HTTP harness (no OTEL, no SQS) |
| `src/components/*.js` | PDF documents built with `@react-pdf/renderer` (JSX) |
| `src/components/docx/*.js` | DOCX generators built with the `docx` package |
| `src/components/utils/FontRegister.js` | One-time font/emoji registration for `@react-pdf/renderer` |
| `src/components/domainPdfShared.js`, `adsProfilesPdfShared.js`, `appPdfShared.js` | Shared layout primitives + palettes for their report families (`appPdfShared` re-exports `DomainTheme` and adds app risk/label helpers) |

JSX is executed in Node via `@babel/register` (`@babel/preset-env`, `@babel/preset-react`), configured in both `src/index.js` and `src/dev-report-server.js`.

---

## 3. Request lifecycle

The `[NN%]` strings below are the exact text written to `reports_generation.status`.

| Step | Status written | What happens |
| --- | --- | --- |
| 1 | — | `isMongoConnected` guard; connect once per container |
| 2 | — | `JSON.parse(record.body)`; unparseable bodies are logged and skipped |
| 3 | — | `validatePayload` → `{ valid, errors, normalizedReportFormat, entityType, entityIds }` |
| 4 | — | Extract W3C trace context from `otelCarrier`, else from SQS `messageAttributes` |
| 5 | — | Start span `sqs.process generate-pdf` (kind `CONSUMER`) with `project.id`, `report.type`, `entity.type`, and a per-entity count attribute |
| 6 | `[10%] Fetching <entity> from DB` | Mongo reads + joins + review filtering + ordering (apps and Telegram groups: no review filter, so nothing is dropped) |
| 7 | `[30%] Processing Images` | S3 download → `sharp` → `/tmp/images` cache |
| 8 | `[60%] Generating PDF report` / `Generating DOCX report` | Render to stream (PDF) or buffer (DOCX) |
| 9 | `[80%] Uploading to Storage` | Watermark (PDF only) → S3 put, or write to local dir |
| 10 | `[100%] Complete` + `s3_path` + `finish_time` | Terminal success |
| — | `[Error] <first 100 chars>` + `finish_time` | Terminal failure; the error is re-thrown |

Status writes are best-effort: failures are logged, never fatal.

### Failure isolation

Inside the batch loop, each record is wrapped in its own `try/catch`. A failing record is logged with `{ messageId, projectId, reportType, error }` and the loop continues. Because the handler returns normally, **SQS does not retry a failed document** — the UI must observe `[Error]` in Supabase and re-queue if needed. Only a Mongo connection failure escapes to fail the whole invocation.

---

## 4. Renderer selection

`runReportJob` dispatches on `entityType`, then on `reportType`. The full matrix lives in [report-catalog.md](./report-catalog.md). The two structural facts worth remembering:

- **Posts** is the only entity type with DOCX output, and the only one where `reportFormat` changes the code path.
- **Ad profiles** ignores `reportType` for layout; the reviewed-profile count picks single dossier vs catalog.
- **Apps** is the only branch that normalizes *before* the image pipeline, because evidence-image cache keys (`sectionIndex:mediaIndex` slots) live on the normalized view model.
- **Telegram groups** renders `Summary`/`Detailed` PDF only. The `analysis_results` AI dossier drives the review narrative and flagged-message gallery; `Telegram_messages` is read for the flagged message ids only, never the whole history.

---

## 5. Data normalisation boundary

Raw Mongo documents are never passed to renderers. `core-utils.js` normalises every document into a **stable view model**, which is what makes schema v3 and legacy documents render identically:

- `normalizePost(post, { joinedProfile, updateHistory })` → dates ISO-or-`null`, engagement from `content.engagement` **or** legacy top-level `engagement`, author from `author_snapshot` / embedded `profile` / `user`, `stats` derived from engagement counts.
- `normalizeAd(ad, { joinedProfile, updateHistory })` → cards flattened, media URL picked, `shown_hostname` vs `card_hostnames` compared to compute `destination_mismatch`, template titles like `{{product.description}}` replaced by the first real card title.
- `normalizeProfile(profile)` → merges legacy `metadata.*` with v3 `enrichment.*` / `list.*`.
- `normalizeAdProfile(profile)` → flattens review verdict, violations, legal codes, risk.
- `normalizeApp(app, { joinedDeveloper, updateHistory })` → screenshots split out of `content.media`, `store.*` / `permissions` / `data_safety` flattened, review scores normalised, and `evidence.sections` reduced to image-only media with capped `sectionIndex:mediaIndex` slots.
- `normalizeTelegramGroup(group, { updateHistory, messagesById })` → group identity (`chat_id`, `username`, `type`, `about`, flags), aggregate counts (`participant_count`, `message_count`), workflow/backfill status, an `ai` model built from `analysis_results` (case summary, analysis prose, legal codes, operator involvement, promoted services/handles, flagged actors, flagged messages, batch summaries, media evidence), and a unified `review` model where human `review_details` wins and the AI dossier is the fallback. Referenced `Telegram_messages` rows are joined in for date/views/text/media.

`case_events` rows are mapped into the legacy `update_history` shape by `mapCaseEventToUpdateHistory`.

The `compressedImages` / `compressedCardImages` / `screenshotSlices` arrays are **positional** — index *n* of the array belongs to index *n* of the ordered entity array. Any reordering must happen before image processing. The apps branch instead attaches paths to the view model (`compressedImage`, `compressedHeaderImage`, `compressedScreenshots`, per-image `localPath`), keyed by the stable evidence slot.

---

## 6. Caching

Two independent caches:

1. **Report-level cache (client-owned).** `reportHash` is a deterministic SHA-256 of the request. The UI checks Supabase for a completed row before enqueueing. The service itself never short-circuits on an existing hash — it regenerates. Deleting the S3 object without clearing the Supabase row leaves a stale pointer.
2. **Image cache (container-local).** `processImage` and `processLanderScreenshot` skip work when the target file already exists under `IMAGE_CACHE_DIR` (`/tmp/images`). Files are keyed by entity id + a suffix/variant token. Within a warm Lambda container this avoids re-downloading. It is best-effort only — `/tmp` is per-environment and can be reclaimed.

---

## 7. Telemetry

`src/instrumentation.js` starts a `NodeSDK` with OTLP trace + metric exporters. Service name defaults to `overwatch-pdf-service`.

Spans created:

| Span | Where |
| --- | --- |
| `sqs.process generate-pdf` | `src/index.js`, kind `CONSUMER` |
| `process-images` / `process-ad-images` / `process-app-images` / `process-domain-images` / `process-profile-images` | `src/report-job.js` |
| `render-pdf` / `render-docx` | `src/report-job.js` |
| `watermark-pdf` | `src/report-job.js` |
| `upload-s3` / `upload-s3-docx` | `src/report-job.js` |

Span attributes: `project.id`, `report.type`, `entity.type`, then `post.count` / `ad.count` / `domain.count` / `ad_profile.count` / `app.count` by branch, plus `report.hash`, `s3.key`, `images.count`, and `ad_profiles.layout` (`summary` vs `profile`).

Metric: histogram **`generate_pdf_duration_seconds`** (unit `s`), labelled `report.type`, `project.id`, `status` (`success` / `failed`).

`telemetry.forceFlush()` runs in the handler's `finally` so buffered spans/metrics leave the container before it freezes.

Noisy auto-instrumentations are disabled: `fs`, `dns`, `net`; outbound HTTP to `record-metrics.contrails.ai` is ignored.

---

## 8. Notes and known constraints

- `report-job.js` keeps the posts branch as the `else` fall-through rather than an explicit `entityType === 'posts'` check — unknown entity types would land there, but validation rejects them first.
- Lambda memory must be generous (4–8 GB). A large multi-case PDF holds a lot of RAM inside `@react-pdf/renderer` before flushing. See [deployment.md](./deployment.md).
- `sharp` binaries are architecture-specific; the image must be built for `linux/arm64`. See [deployment.md](./deployment.md).
- The `export` surface of `src/index.js` re-exports `generateReportHash`, `normalizePost`, `validatePayload`, `orderPostsByRequestedIds` for tests/tooling.
