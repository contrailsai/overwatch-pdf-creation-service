# Local Testing & the Dev Report Server

Three ways to exercise the pipeline without deploying: the **dev report server** (real Mongo + S3, real documents), the **automated test suite** (no network, fixture data), and **direct renderer invocation**.

---

## 1. Prerequisites

```bash
npm install
```

`npm install` is the only setup step. The dev server and tests both use `@babel/register` internally, so no build step exists.

You need a `.env` at the repo root for anything that talks to Mongo/S3:

```bash
MONGO_URI=mongodb+srv://…
AWS_ACCESS_KEY_ID=…
AWS_SECRET_ACCESS_KEY=…
AWS_REGION=ap-south-1
AWS_S3_BUCKET=cxo-demo
```

`.env` is gitignored. Supabase and OpenTelemetry are **not** required locally — the dev server skips instrumentation entirely, and Supabase degrades to a no-op stub.

---

## 2. Dev report server

`src/dev-report-server.js` is a plain `http` server that accepts the **same JSON you would put in an SQS message body**, runs the real `runReportJob` with `persist: 'local'`, and serves the result back over HTTP. No SQS, no Lambda, no OTEL.

### Start it

```bash
npm run dev:reports
# Report dev server listening on http://127.0.0.1:3847
# POST JSON (same as SQS body) → saves under …/local-reports/output
```

| Env var | Default | Purpose |
| --- | --- | --- |
| `REPORT_DEV_PORT` | `3847` | Listen port |
| `REPORT_DEV_HOST` | `127.0.0.1` | Bind address |
| `LOCAL_REPORT_OUTPUT_DIR` | `local-reports/output` | Where files are written |
| `DEV_REPORT_API_KEY` | *(empty)* | If set, every request needs `Authorization: Bearer <key>` |

### Endpoints

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/health` | `{ ok: true, service: 'report-dev-server' }` |
| `POST` | `/` or `/reports` | Body = SQS payload JSON. Max body 4 MB. Returns the hash, local path, download URL, and a ready-made `wget` line |
| `GET` | `/reports/<64-hex>.<pdf\|docx>` | Streams the file with `Content-Disposition: attachment`. Filename is validated against `/^[a-f0-9]{64}\.(pdf\|docx)$/` and the resolved path is confined to the output dir |

### Response shape

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

Validation failures return **400** with `details: [...]` (the `validatePayload` error strings). Everything else returns **500** with `error`.

### Generate a report

All sample payloads live in [`samples/messages/`](../samples/messages) — copy any of them and change `reportType` / `reportFormat` to exercise a combination that has no sample yet.

```bash
# Posts — schema v3 (lowercase posts/profiles/case_events), Ambani tenant
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" \
  -d @samples/messages/sample_sqs_message_ambani_v2.json

# Posts — Detail / Single / Profile
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_ambani_v2_single.json
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_ambani_v2_profile.json

# Meta Ads — Summary / Detailed
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_sebi_ads_summary.json
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_sebi_ads_detailed.json

# Ad profiles — always reportType Summary; 1 id → dossier, 2+ → catalog
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_sebi_ad_profiles_detailed.json
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_sebi_ad_profiles_summary.json

# Domains — Detailed bare vs param variant must produce different hashes
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_sebi_domains_summary.json
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_sebi_domains_detailed.json
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_sebi_domains_detailed_bare.json
```

> The `sample_sqs_message_sebi_ad_profiles_detailed.json` filename is misleading — its `reportType` is `Summary` with a single profile id, so it exercises the **single-dossier** layout. `…_summary.json` carries two ids and exercises the **catalog**. A full inventory of every sample is in [HOW_TO_TEST_PDFS.md §3](../HOW_TO_TEST_PDFS.md#3-sample-inventory).

### Fetch the output

```bash
curl -O http://localhost:3847/reports/<reportHash>.pdf
curl -O http://localhost:3847/reports/<reportHash>.docx
```

Files also land in `local-reports/output/`. That directory is gitignored.

### With an API key

```bash
DEV_REPORT_API_KEY=secret npm run dev:reports
curl -X POST http://localhost:3847/ -H "Authorization: Bearer secret" \
  -H "Content-Type: application/json" -d @samples/messages/sample_sqs_message_ambani_v2.json
```

### Gotchas

- **Warm image cache.** Processed images are cached under `IMAGE_CACHE_DIR` (default `/tmp/images`) keyed by entity id. If you re-capture or re-upload a screenshot and the PDF looks stale, clear it: `rm -rf /tmp/images`.
- **`compressedImages` is positional.** If outputs look shuffled, the issue is ID ordering, not the cache.
- **Supabase is silent.** Without `SUPABASE_URL`/`SUPABASE_KEY` you will see `[Supabase] Skipping status update …` for every milestone. That is expected, not a failure.
- **`REPORT_DEV_PORT` collisions.** The port is not auto-incremented; a stale server will make your new one fail to bind.

---

## 3. Automated tests

```bash
npm test              # everything (unit + integration)
npm run test:unit     # test/unit/**
npm run test:integration
```

The runner is the built-in **`node --test`** — there is no Jest/Mocha. Current suite: **77 tests, 0 failures**, ~2 s (**61 unit + 16 integration**).

| Suite | File | Covers |
| --- | --- | --- |
| Unit | `test/unit/core-utils.test.js` | `validatePayload` accept/reject per entity type and format, hash determinism and the `-ads` / `-domains` / `-ad_profiles` suffixes, `normalizePost` / `normalizeAd` / `normalizeAdProfile` mapping, ad sorting and the 20-ad cap, `resolveAdMediaUrl` / `resolveAdCardMediaUrls` fallbacks, POI and source passthrough |
| Unit | `test/unit/domain-display.test.js` | Lander resolution and fallbacks, `domainHasCloaking`, screenshot slice plans and extract boxes, variant-key filtering, page-content selection |
| Integration | `test/integration/report-generation.test.js` | One real PDF stream (Summary) and one real DOCX buffer (Single) — asserts the `%PDF` and `PK` signatures |
| Integration | `test/integration/report-layouts.test.js` | Every renderer: Detailed/Single/Profile/Summary PDF, Ads Summary/Detailed PDF, Domains Summary/Detailed PDF (incl. the `posts` prop alias), Ads Profiles Summary + single dossier, and all five DOCX generators |

Fixtures live in `test/integration/smoke-fixtures.js`:

| Helper | Produces |
| --- | --- |
| `makeProject()` | Project with `labels` and `legal_codes` |
| `makeProfile()` | Normalized-style profile with `metadata.*` |
| `makeNormalizedPost(overrides)` | Full post view model incl. `review_details`, `update_history`, `client_notes`, `stats` |
| `makeNormalizedAd(overrides)` | Ad with a 2-card DPA, `shown_hostname: amazon.in` vs `card_hostnames: ['ilnkarip.com']`, `destination_mismatch: true` |
| `makeNormalizedDomain(overrides)` | Domain with a `cloak_probe` (bare + a scam variant) and `reportLander` resolved |
| `makeNormalizedAdProfile(overrides)` | Ad profile with SEBI-style risk, violations, legal codes, verdict |
| `makeAdProfileReportGroup(overrides)` | The full `{ profile, ads, displayAds, domains, compressed* }` group a renderer expects |

Raw Mongo-shaped fixtures for the unit tests are under `test/fixtures/v3/`: `ad.json`, `case_event.json`, `post.json`, `profile_tinytoontunes.json`.

**The tests never touch the network** — no Mongo, no S3, no Supabase. They render with `compressedImages: [null, …]`, so they validate layout and signature, not pixel output. They will not catch a wrong image, only a crash or a broken document.

---

## 4. Renderer smoke test by hand

When you only need to check a layout and do not want Mongo involvement, mirror what the integration tests do:

```js
require('@babel/register')({ presets: ['@babel/preset-env', '@babel/preset-react'], extensions: ['.js', '.jsx'] });
const React = require('react');
const { renderToStream } = require('@react-pdf/renderer');
const { RiskReportDocument } = require('./src/components/SummaryReport');
const { makeProject, makeNormalizedPost } = require('./test/integration/smoke-fixtures');

(async () => {
  const stream = await renderToStream(
    React.createElement(RiskReportDocument, {
      posts: [makeNormalizedPost()],
      project: makeProject(),
      compressedImages: [null],
    }),
  );
  require('fs').writeFileSync('/tmp/smoke.pdf', await require('stream/consumers').buffer(stream));
})();
```

Run with `node -r @babel/register` or keep the explicit `require('@babel/register')` call as above. Note this bypasses the watermark — it renders the raw `@react-pdf` output.

`scripts/generate-sample-simple-docx.js` is a worked example of generating a DOCX outside the job pipeline.

---

## 5. Checking a generated document

There is no automated visual diffing. Review by hand:

1. Look at the PDF/DOCX in `local-reports/output/`.
2. Cross-check against the intent described in [report-themes.md](./report-themes.md) — that doc states what each section is supposed to contain per report type.
3. `local-reports/output/examples/` holds a set of previously generated reference documents (`posts-*`, `ads-*`, `domains-*`, `ad-profiles-*`). They are **gitignored**, so a fresh clone will not have them — use them only as a local baseline.
4. `local-reports/output/sebi-ad-profiles/` holds a bulk run of 57 ad-profile dossiers.

---

## 6. Quick troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `Missing required environment variable MONGO_URI.` | No `.env`, or it was not loaded |
| `Missing AWS bucket configuration` | Neither `AWS_BUCKET_NAME` nor `AWS_S3_BUCKET` set |
| `Invalid payload` with 400 | See the `details` array — refer to [report-catalog.md §3](./report-catalog.md#3-validation-rules) |
| `Image fetch failed after 3 attempts` | Bad S3 credentials, wrong region, or a non-S3 URL that is unreachable |
| PDF renders but every image is blank | Image fetch returned `null`; check the S3 read logs |
| `[Supabase] Skipping status update` | Expected without Supabase credentials |
| `Error: Input file is missing` during watermark | `public/logo_txt.svg` missing from the working tree |
| Tests pass but the real report differs | Tests use `null` images and fixtures — verify with the dev server against real data |
