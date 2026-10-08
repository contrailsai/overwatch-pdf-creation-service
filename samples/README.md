# Samples

Reference inputs for the PDF service, split by what they are.

```
samples/
  messages/   ready-to-post SQS payloads + a legacy curl script
  schemas/    example MongoDB documents, one per collection
```

---

## `messages/` — SQS request payloads

Each file is a complete **SQS `MessageBody`** (a JSON request payload) and can be POSTed verbatim to the local dev server, which runs the same pipeline as Lambda.

```bash
npm run dev:reports

curl -X POST http://localhost:3847/ \
  -H "Content-Type: application/json" \
  -d @samples/messages/sample_sqs_message_ambani_v2.json
```

Payload fields, validation rules, and the hash contract: [../docs/report-catalog.md](../docs/report-catalog.md) and [../docs/ui-report-request-flow.md](../docs/ui-report-request-flow.md).
Dev-server endpoints and troubleshooting: [../docs/local-testing.md](../docs/local-testing.md).

**Full inventory of every payload with its `entityType` / `reportType` / database: [../HOW_TO_TEST_PDFS.md §3](../HOW_TO_TEST_PDFS.md#3-sample-inventory).**

### Notes

- The samples target real tenant databases (`Ambani-Data-v2`, `SEBI-Data-Search`, `ICICI-Data-Search`, `PMO-Data-Search`). They only generate output if that database exists on the `MONGO_URI` cluster and the referenced ObjectIds are still present.
- `sample_sqs_message_sebi_ad_profiles_detailed.json` is **misnamed** — its `reportType` is `Summary` with a single profile id, so it exercises the single-dossier layout, not a `Detailed` request. Tracked in [../docs/roadmap.md](../docs/roadmap.md).
- `sample_curl_requests.sh` is **stale**: it targets `POST localhost:4000/generate` and `GET /job-status/1`, neither of which exists. Kept for history, pending rewrite or deletion.
- No sample covers posts `Summary` or any DOCX type. Copy an existing payload and change `reportType` / `reportFormat` to reach those branches.

---

## `schemas/` — example collection documents

One example document per MongoDB collection the service reads, in **MongoDB Extended JSON** (`$oid`, `$date`). These are the shapes the normalizers in `src/core-utils.js` consume — useful when interpreting a report field, writing a new normalizer, or seeding a test database.

| File | Collection | Key contents |
| --- | --- | --- |
| [`posts.json`](schemas/posts.json) | `Posts` | `content.media` / `engagement`, `list.*`, `workflow.*`, `profile_id` |
| [`profiles.json`](schemas/profiles.json) | `profiles` | `enrichment.*` (incl. `profile_pic_s3`), `list.*`, `platform_user_id` |
| [`case_events.json`](schemas/case_events.json) | `case_events` | `entity_type` / `entity_id`, `occurred_at`, `actor`, `summary` — feeds `update_history` |
| [`pois.json`](schemas/pois.json) | `pois` | Person of interest: `name`, `aliases`, `topics`, `post_count` |
| [`topics.json`](schemas/topics.json) | `topics` | `topic_id`, `narrative`, `category`, `parent_topic_id`, `pois` |
| [`post_embeddings.json`](schemas/post_embeddings.json) | `post_embeddings` | `text_embedding` / `image_embedding`, `effective_threat_score` |
| [`Apps.json`](schemas/Apps.json) | `Apps` | `platform` / `platform_app_id`, `developer_id`, `content.media` (icon/header/screenshots), `store.*`, `evidence.sections`, `list.*` — drives the Apps Summary/Detailed reports |
| [`Ads.json`](schemas/Ads.json) | `Ads` | `ad_profile_id`, `content.media` / `content.cards`, `ad_delivery.*`, `list.*` |
| [`Ad_profiles.json`](schemas/Ad_profiles.json) | `Ad_profiles` | `enrichment.*`, `list.*`, `review_details.*`, `workflow.*` |
| [`Domains.json`](schemas/Domains.json) | `Domains` | `discovery.*`, `analysis_results.cloak_probe`, `list.*`, `review_details.*` |
| [`Telegram_groups.json`](schemas/Telegram_groups.json) | `Telegram_groups` | `chat_id` / `username` / `type` / `about`, `photo.s3_url`, `list.*` (participants, messages, threat types), `review_details.*` (human review), `analysis_results.*` (AI dossier: case summary, analysis, legal codes, operator involvement, promoted services, flagged actors, `message_analysis.flagged_messages`, `media_evidence`), `telegram.backfill` — drives the Telegram group Summary/Detailed reports |
| [`Telegram_messages.json`](schemas/Telegram_messages.json) | `Telegram_messages` | `group_id` / `message_id` / `date` / `views` / `text` / `media[].s3_url` — only the flagged ids referenced by the AI dossier are read |

### Caveats

- These are **example documents, not JSON Schema files**. There is no validation contract in them — nothing in this repo loads or enforces them.
- `post_embeddings.json` is a **sketch and is not valid JSON**: the vector fields use `[...]` as a placeholder for the real float arrays. Every other file parses cleanly. Do not feed it to `jq` or a linter.
- `Apps.json` (like `unique_clusters.json`, `pdf_reports.json`, and `Feeds.json`) uses MongoDB **shell syntax** — `ObjectId('…')`, `NumberInt('…')`, `ISODate('…')` — rather than Extended JSON, so it is **not** parseable by `JSON.parse`. The newer `Ads.json` / `Ad_profiles.json` / `Domains.json` use `{ "$oid": … }` / `{ "$date": … }`. Convert before loading. There is no `App_developers.json` example yet; the Apps branch joins that collection via `developer_id` (see [../docs/connectivity.md §2](../docs/connectivity.md)).
- The schema-v3 field mapping the service actually applies (v3 `content.*` vs legacy top-level, `enrichment.profile_pic_s3` → `metadata.profile_pic`, and so on) is described in [../docs/architecture.md §5](../docs/architecture.md#5-data-normalisation-boundary).

---

## Conventions

- Filenames are unchanged from their previous locations, so references in older notes still match on the basename.
- Paths in commands are relative to the **repository root**.
