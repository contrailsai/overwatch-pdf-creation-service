# Ads Reports Plan

Branch: `feat/ads-reports`

Create Overwatch **Summary** and **Detailed** PDFs for Meta Ads, matching the Posts report pipeline, using `SEBI-Data-Search`.

---

## Current status

Already on this branch (not wired end-to-end yet):

| Piece | Status | Where |
| --- | --- | --- |
| Payload `entityType` / `adIds` validation | Done | `src/core-utils.js` |
| Hash suffix `-ads` (posts hashes unchanged) | Done | `src/core-utils.js` `generateReportHash` |
| `normalizeAd`, destination mismatch, card URLs | Done | `src/core-utils.js` |
| Ads Summary PDF layout | Done | `src/components/AdsSummaryReport.js` |
| Ads Detailed PDF layout | Done | `src/components/AdsDetailedReport.js` |
| Job pipeline: fetch `Ads` + `ad_profiles`, images, render | **Not done** | `src/report-job.js` (imports only) |
| Lambda span attributes | **Not done** | `src/index.js` |
| Unit / layout tests | **Not done** | `test/` |
| Sample SQS payloads | **Not done** | repo root |
| UI contract docs | **Not done** | `docs/ui-report-request-flow.md` |
| Local test commands | **Not done** | `HOW_TO_TEST_PDFS.md` |

Posts reports on `main` must keep working. Ads is an additive path.

---

## Data source

- **Cluster:** the `MONGO_URI` in `.env`
- **Database:** `SEBI-Data-Search`
- **Collections:** `Ads` (214 docs), `ad_profiles` (151 docs)
- **Join:** `Ads.ad_profile_id` → `ad_profiles._id`
- **Optional:** `case_events` with `entity_type: 'ad'` — collection is missing on SEBI today; query it anyway (empty result is fine)

Every current ad is `display_format: DPA` (6-card carousel). Typical cloaking pattern:

- Shown destination: `content.caption` / `content.link_url` → `amazon.in`
- Actual card landings: `content.cards[].link_url` → `ilnkarip.com`, `iknpior.com`, etc.

Reports must highlight that mismatch.

---

## Payload contract

Reuse Posts `reportType` values. Distinguish ads with `entityType` (or by sending `adIds`).

```json
{
  "projectId": "SEBI",
  "entityType": "ads",
  "adIds": [
    "6a7d79609b3282bb5130f160",
    "6a7d79869b3282bb5130f164",
    "6a7d79699b3282bb5130f161",
    "6a7d86f21f503c02391076e1"
  ],
  "database_name": "SEBI-Data-Search",
  "reportType": "Summary",
  "reportFormat": "pdf",
  "project": {
    "project_name": "SEBI",
    "project_details": {
      "labels": [
        { "name": "Fraud", "severity": "high" },
        { "name": "Impersonation", "severity": "high" },
        { "name": "scam", "severity": "medium" }
      ],
      "legal_codes": []
    }
  },
  "profile": null
}
```

Rules:

- `entityType`: `posts` (default) or `ads`
- If `adIds` is present and `entityType` is omitted, treat as `ads`
- Ads IDs may also be sent as `postIds` when `entityType` is `ads`
- Ads `reportType`: `Summary` or `Detailed` only
- Ads `reportFormat`: `pdf` only (no DOCX in v1)
- Hash for ads: `{projectId}-{sortedIds}-{reportType}-{profileId}-{reportFormat}-ads`
- Posts hashes stay `{projectId}-{sortedIds}-{reportType}-{profileId}-{reportFormat}`

---

## How to finish the wiring

Do these in order. Each step is independently testable.

### 1. Job pipeline (`src/report-job.js`)

After `validatePayload`, read `validation.entityType` and `validation.entityIds`.

If `entityType === 'ads'`:

1. Status `[10%] Fetching ads from DB`
2. `db.collection('Ads').find({ _id: { $in: objectIds } })`
3. Keep request order via existing `orderPostsByRequestedIds`
4. Join `ad_profiles` on `ad_profile_id`
5. Optionally load `case_events` where `entity_type` is `ad` or `ads`
6. Status `[30%] Processing Images`
7. Download card images from S3 (`resolveAdCardMediaUrls`)
   - Summary: first card only
   - Detailed: all cards (cap at 6)
8. `normalizeAd(...)` per document
9. Status `[60%] Generating PDF report`
10. Render:
    - `Summary` → `AdsSummaryReportDocument`
    - `Detailed` → `AdsDetailedReportDocument` (pass `compressedCardImages`)
11. Same local/S3 persist path as posts

Add `processAndCacheAdImages(ads, { includeAllCards, concurrency })` next to `processAndCacheImages`.

Pass `entityType` into `generateReportHash` as the 6th argument.

### 2. Lambda handler (`src/index.js`)

- Use `validation.entityIds` for counts (not only `postIds`)
- Span attrs: `entity.type`, `ad.count` when ads

### 3. Tests

- **Unit** (`test/unit/core-utils.test.js` + `test/fixtures/v3/ad.json`):
  - `normalizeAd` maps page name, cards, mismatch (`amazon.in` vs `ilnkarip.com`)
  - Template title `{{product.description}}` falls back to first real card title
  - `validatePayload` accepts `entityType: ads` + `adIds`
  - `validatePayload` rejects ads + DOCX and ads + Profile
  - Ads hash differs from posts hash for the same IDs
  - Posts hash with default `entityType` is unchanged
- **Layout** (`test/integration/report-layouts.test.js` + `makeNormalizedAd` in `smoke-fixtures.js`):
  - Ads Summary PDF starts with `%PDF`
  - Ads Detailed PDF starts with `%PDF`

### 4. Sample payloads + local test docs

Create:

- `sample_sqs_message_sebi_ads_summary.json`
- `sample_sqs_message_sebi_ads_detailed.json`

Add curls to `HOW_TO_TEST_PDFS.md`:

```bash
npm run dev:reports
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @sample_sqs_message_sebi_ads_summary.json
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @sample_sqs_message_sebi_ads_detailed.json
```

PDFs land in `./local-reports/output`.

### 5. UI contract (`docs/ui-report-request-flow.md`)

Document `entityType`, `adIds`, ads-only PDF, and the `-ads` hash suffix so the client cache key matches Lambda.

### 6. Generate and inspect locally

Need `.env`: `MONGO_URI`, `AWS_*`, `AWS_S3_BUCKET` (card images are on `cxo-demo`).

Checklist while reading the PDFs:

- Summary metrics: total ads, active, destination mismatch, landing domains
- Summary row: thumbnail, advertiser, shown vs card hosts, mismatch badge
- Detailed page: 6-card grid, advertiser, CTA, Ad Library URL
- Detailed right column: shown `amazon.in` vs per-card phishing hosts
- Unreviewed ads show **Unreviewed**, not fake High/Safe scores (SEBI ads currently have empty `analysis_results`)

### 7. Out of scope for v1 (do not start unless asked)

- Ads DOCX
- Ads Profile / Single / SimpleCase
- Narrative threat-intel PDF (the existing `Meta Ads Report.pdf` is a different product)
- Changing Posts layouts

---

## Report layout intent

**Summary** — one table, Posts-style:

1. `#`
2. Creative (thumb + format + card count + Ad Library link)
3. Advertiser (page name, platform, CTA)
4. Destinations (shown host vs card hosts + mismatch)
5. Violations
6. Risk / Unreviewed
7. Started / sourced dates

**Detailed** — one A4 page per ad, Posts-style two columns:

- Left: card image grid, advertiser, creative copy, format / impressions / platforms
- Right: destination analysis first (the important ads signal), then legal / reasoning / labels / risk

---

## Suggested sample IDs (SEBI)

| `_id` | Advertiser | Shown | Card host |
| --- | --- | --- | --- |
| `6a7d79609b3282bb5130f160` | Brooks Hughes Quinn | amazon.in | ilnkarip.com |
| `6a7d79869b3282bb5130f164` | Anthony K Thomas | ilnkarip.com | ilnkarip.com |
| `6a7d79699b3282bb5130f161` | Shauna K Jones | amazon.in | iknpior.com |
| `6a7d86f21f503c02391076e1` | Patrick DeHoff Jerry | amazon.com | (check cards) |

---

## Deploy (after local PDFs look right)

Same as `running_steps.txt`:

```bash
docker build --platform linux/arm64 --provenance=false -t 992382580458.dkr.ecr.ap-south-1.amazonaws.com/overwatch-pdf-creation:latest .
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 992382580458.dkr.ecr.ap-south-1.amazonaws.com
docker push 992382580458.dkr.ecr.ap-south-1.amazonaws.com/overwatch-pdf-creation:latest
aws lambda update-function-code --function-name overwatch-report-generation --image-uri 992382580458.dkr.ecr.ap-south-1.amazonaws.com/overwatch-pdf-creation:latest
```

Do not deploy until step 6 PDFs are signed off.

---

## Execution order

1. Wire `report-job.js` ads branch + `processAndCacheAdImages`
2. Update `src/index.js` spans / id counts
3. Add fixture + unit tests for `normalizeAd` / payload / hash
4. Add layout smoke tests
5. Add SEBI sample JSON + `HOW_TO_TEST_PDFS.md`
6. Update `docs/ui-report-request-flow.md`
7. Generate Summary + Detailed locally and inspect
8. Fix layout issues from the PDFs
9. Deploy only after approval
