# How to Test PDFs — Quick Cheatsheet

Full guide (endpoints, env vars, test suite, troubleshooting): [docs/local-testing.md](docs/local-testing.md).
What each report type is supposed to look like: [docs/report-themes.md](docs/report-themes.md).

Run everything from the repository root with a `.env` containing `MONGO_URI` and `AWS_*` / `AWS_S3_BUCKET`.

## 1. Start the dev server

```bash
npm run dev:reports     # http://127.0.0.1:3847
```

## 2. Post a payload

The body is the SQS message body, verbatim. All sample payloads live in [`samples/messages/`](samples/messages).

```bash
# Posts — legacy ICICI / PMO tenants (work only if those DBs still exist)
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message.json
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_3.json

# Posts — schema v3 (Ambani-Data-v2: lowercase posts + profiles + case_events)
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_ambani_v2.json
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_ambani_v2_single.json
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_ambani_v2_profile.json

# SEBI Meta Ads — Summary / Detailed
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_sebi_ads_summary.json
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_sebi_ads_detailed.json

# SEBI Ad Profiles — always reportType Summary
#   ..._detailed.json = 1 id  → single dossier PDF
#   ..._summary.json  = 2 ids → combined catalog PDF
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_sebi_ad_profiles_detailed.json
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_sebi_ad_profiles_summary.json

# SEBI Domains — Detailed bare vs param variant must produce DIFFERENT reportHashes
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_sebi_domains_summary.json
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_sebi_domains_detailed.json
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_sebi_domains_detailed_bare.json
```

> `sample_sqs_message_sebi_ad_profiles_detailed.json` is **misnamed** — its `reportType` is `Summary` with a single profile id. See [roadmap.md](docs/roadmap.md).

## 3. Sample inventory

Every tracked sample in [`samples/messages/`](samples/messages), with its actual request shape:

| File | `entityType` | `reportType` | Format | Database |
| --- | --- | --- | --- | --- |
| [`sample_sqs_message.json`](samples/messages/sample_sqs_message.json) | posts | Detailed | pdf | ICICI-Data-Search |
| [`sample_sqs_message_2.json`](samples/messages/sample_sqs_message_2.json) | posts | Detailed | pdf | PMO-Data-Search |
| [`sample_sqs_message_3.json`](samples/messages/sample_sqs_message_3.json) | posts | Single | pdf | PMO-Data-Search |
| [`sample_sqs_message_ambani_v2.json`](samples/messages/sample_sqs_message_ambani_v2.json) | posts | Detailed | pdf | Ambani-Data-v2 |
| [`sample_sqs_message_ambani_v2_single.json`](samples/messages/sample_sqs_message_ambani_v2_single.json) | posts | Single | pdf | Ambani-Data-v2 |
| [`sample_sqs_message_ambani_v2_profile.json`](samples/messages/sample_sqs_message_ambani_v2_profile.json) | posts | Profile | pdf | Ambani-Data-v2 |
| [`sample_sqs_message_sebi_ads_summary.json`](samples/messages/sample_sqs_message_sebi_ads_summary.json) | ads | Summary | pdf | SEBI-Data-Search |
| [`sample_sqs_message_sebi_ads_detailed.json`](samples/messages/sample_sqs_message_sebi_ads_detailed.json) | ads | Detailed | pdf | SEBI-Data-Search |
| [`sample_sqs_message_sebi_ad_profiles_summary.json`](samples/messages/sample_sqs_message_sebi_ad_profiles_summary.json) | ad_profiles | Summary (2 ids) | pdf | SEBI-Data-Search |
| [`sample_sqs_message_sebi_ad_profiles_detailed.json`](samples/messages/sample_sqs_message_sebi_ad_profiles_detailed.json) | ad_profiles | Summary (1 id) | pdf | SEBI-Data-Search |
| [`sample_sqs_message_sebi_domains_summary.json`](samples/messages/sample_sqs_message_sebi_domains_summary.json) | domains | Summary | pdf | SEBI-Data-Search |
| [`sample_sqs_message_sebi_domains_detailed.json`](samples/messages/sample_sqs_message_sebi_domains_detailed.json) | domains | Detailed (param variant) | pdf | SEBI-Data-Search |
| [`sample_sqs_message_sebi_domains_detailed_bare.json`](samples/messages/sample_sqs_message_sebi_domains_detailed_bare.json) | domains | Detailed (bare variant) | pdf | SEBI-Data-Search |

**Not covered by any sample:** posts `Summary`, and every DOCX type (`Detailed`, `Single`, `Profile`, `SimpleProfile`, `SimpleCase`). Build them from an existing sample by changing `reportType` / `reportFormat`, then POST it.

## 4. Response shape

```json
{
  "ok": true,
  "reportHash": "8a5527e0…",
  "format": "pdf",
  "localPath": "/…/local-reports/output/8a5527e0….pdf",
  "downloadPath": "/reports/8a5527e0….pdf",
  "downloadUrl": "http://127.0.0.1:3847/reports/8a5527e0….pdf",
  "wget": "wget -O 8a5527e0….pdf http://127.0.0.1:3847/reports/8a5527e0….pdf"
}
```

Validation failures return **400** with a `details` array. Everything else returns **500** with `error`.

## 5. Fetch the output

Files are also written to `./local-reports/output/` (gitignored).

```bash
curl -O http://localhost:3847/reports/<reportHash>.pdf
curl -O http://localhost:3847/reports/<reportHash>.docx
```

## 6. Automated tests (no Mongo/S3 required)

```bash
npm test                # 77 tests, unit + integration
npm run test:unit
npm run test:integration
```

These render fixtures with `null` images, so they catch crashes and broken documents — not wrong images or colour regressions. Always confirm a change with the dev server against real data.

## 7. Common gotchas

```bash
rm -rf /tmp/images      # stale processed-image cache (keyed by entity id)
```

- Without `SUPABASE_URL` / `SUPABASE_KEY` you will see `[Supabase] Skipping status update …` — expected, not a failure.
- `DEV_REPORT_API_KEY=<key> npm run dev:reports` makes every request require `Authorization: Bearer <key>`.
- `REPORT_DEV_PORT`, `REPORT_DEV_HOST`, `LOCAL_REPORT_OUTPUT_DIR` override the defaults.
