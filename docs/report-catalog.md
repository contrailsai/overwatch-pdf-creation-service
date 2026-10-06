# Report Catalog — Entity × Report Type × Format

Canonical reference for **which renderer runs** for a given request. This is the single source of truth for the routing matrix that is otherwise spread across `src/core-utils.js` (validation) and `src/report-job.js` (routing).

Two layers decide the outcome:

1. **Validation** (`validatePayload` in `src/core-utils.js`) — rejects invalid combinations before any work happens.
2. **Routing** (`runReportJob` in `src/report-job.js`) — picks the Mongo collections, image pipeline, and renderer.

---

## 1. The matrix

`reportType` is the key. `entityType` selects the document family. `reportFormat` selects PDF vs DOCX.

| `entityType` | `reportType` | `pdf` | `docx` |
| --- | --- | --- | --- |
| `posts` (default) | `Summary` | `RiskReportDocument` | ❌ not supported |
| `posts` | `Detailed` | `DetailedCasesReportDocument` | `generateDetailedCasesDocxBuffer` |
| `posts` | `Single` | `SingleCaseReportDocument` | `generateSingleCaseDocxBuffer` |
| `posts` | `Profile` | `ProfileReportDocument` | `generateProfileDocxBuffer` |
| `posts` | `SimpleProfile` | ❌ DOCX-only | `generateSimpleProfileDocxBuffer` |
| `posts` | `SimpleCase` | ❌ DOCX-only | `generateSimpleCaseDocxBuffer` |
| `ads` | `Summary` | `AdsSummaryReportDocument` | ❌ PDF only |
| `ads` | `Detailed` | `AdsDetailedReportDocument` | ❌ PDF only |
| `domains` | `Summary` | `DomainsSummaryReportDocument` | ❌ PDF only |
| `domains` | `Detailed` | `DomainsDetailedReportDocument` | ❌ PDF only |
| `ad_profiles` | `Summary` | **layout switch** — see below | ❌ PDF only |
| `apps` | `Summary` | `AppsSummaryReportDocument` | ❌ PDF only |
| `apps` | `Detailed` | `AppsDetailedReportDocument` | ❌ PDF only |

### Ad-profile layout switch

Ad profiles accept **`Summary` only**, but the *layout* is chosen at runtime from the number of profiles that survive the review filter — **not** from `reportType`:

| Reviewed profiles after filter | Document |
| --- | --- |
| exactly **1** | `AdsProfileReportDocument` — single dossier |
| **2 or more** | `AdsProfilesSummaryReportDocument` — combined catalog |

So `reportType: "Summary"` with one `adProfileIds` entry is a different document than the same request with two entries. Do not send `Detailed` for ad profiles — it is rejected.

---

## 2. Payload fields

```json
{
  "projectId": "SEBI",
  "entityType": "domains",
  "domainIds": ["6a8be234abdd8b24b75f1761"],
  "variantKeysByDomainId": { "6a8be234abdd8b24b75f1761": "bare" },
  "database_name": "SEBI-Data-Search",
  "reportType": "Detailed",
  "reportFormat": "pdf",
  "project": { "project_name": "SEBI", "project_details": { "labels": [], "legal_codes": [] } },
  "profile": null,
  "otelCarrier": {}
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `projectId` | ✅ string | Branding + telemetry attribute; part of the hash |
| `database_name` | ✅ string | Mongo database to read |
| `entityType` | optional | `posts` (default), `ads`, `domains`, `ad_profiles`, `apps`. Singular forms (`ad`, `domain`, `post`, `app`) are normalized. Inferred from `adProfileIds` / `domainIds` / `adIds` / `appIds` when omitted |
| entity IDs | ✅ non-empty array | `postIds` for posts; `adIds` / `domainIds` / `adProfileIds` / `appIds` for the others. `postIds` also works as a fallback for any entity type. Must be 24-char Mongo ObjectId strings |
| `reportType` | ✅ | `Detailed \| Single \| Profile \| SimpleProfile \| SimpleCase \| Summary` |
| `reportFormat` | optional | `pdf` (default) or `docx`. Lowercased before comparison |
| `project` | recommended | Object **or** array-of-one row. A stringified `project_details` is `JSON.parse`d. Using an array is legacy but tolerated |
| `profile` | for posts `Profile` / `SimpleProfile` | Must include `_id` — it is part of the hash. Other report types send `null` |
| `variantKeysByDomainId` | required for `domains` | Map of domain id → cloak variant `label` (`bare` or a param like `pEl8X=origtupcls`). Feeds the cache hash so Bare and a param variant never collide |
| `otelCarrier` | optional | W3C trace context. SQS `messageAttributes` are used as a fallback |

### Entity ID field names in validation errors

| `entityType` | Expected field |
| --- | --- |
| `posts` | `postIds` |
| `ads` | `adIds` |
| `domains` | `domainIds` |
| `ad_profiles` | `adProfileIds` |
| `apps` | `appIds` |

---

## 3. Validation rules

Enforced by `validatePayload`; a failure throws `INVALID_PAYLOAD` and the SQS record is skipped (logged, not retried).

- `projectId` must be a string; `database_name` must be a string.
- `reportType` must be one of the six supported types.
- IDs must be a non-empty array of valid `ObjectId`s.
- `reportFormat` must be `pdf` or `docx`.
- `docx` is only allowed for `entityType: posts`, and only for `Detailed | Single | Profile | SimpleProfile | SimpleCase` — **not** `Summary`.
- `SimpleProfile` and `SimpleCase` **must** be `docx`; a `pdf` request is rejected.
- `ads`, `domains`, `ad_profiles`, and `apps` are **PDF only** — any `docx` request is rejected.
- Ads and domains support `Summary | Detailed`; ad profiles support `Summary` only; apps support `Summary | Detailed`.

The constants live in `src/core-utils.js`:

```
SUPPORTED_REPORT_TYPES            = Detailed, Single, Profile, SimpleProfile, SimpleCase, Summary
DOCX_SUPPORTED_REPORT_TYPES       = Detailed, Single, Profile, SimpleProfile, SimpleCase
DOCX_ONLY_REPORT_TYPES            = SimpleProfile, SimpleCase
SUPPORTED_ENTITY_TYPES            = posts, ads, domains, ad_profiles, apps
ADS_SUPPORTED_REPORT_TYPES        = Summary, Detailed
DOMAINS_SUPPORTED_REPORT_TYPES    = Summary, Detailed
AD_PROFILES_SUPPORTED_REPORT_TYPES = Summary
APPS_SUPPORTED_REPORT_TYPES       = Summary, Detailed
MAX_PROFILE_REPORT_ADS            = 20
MAX_APP_SCREENSHOTS               = 6
MAX_APP_EVIDENCE_IMAGES           = 10
MAX_APP_EVIDENCE_IMAGES_PER_SECTION = 4
MAX_APP_PERMISSION_ITEMS          = 10
```

---

## 4. Data sources per branch

| `entityType` | Primary collection | Joins | Review filter |
| --- | --- | --- | --- |
| `posts` | `Posts` (capital P) | `profiles` via `profile_id`; `case_events` where `entity_type: 'post'` | none — all requested posts render |
| `ads` | `Ads` (capital A) | `Ad_profiles` via `ad_profile_id`; `case_events` where `entity_type` ∈ `['ad','ads']` | none — unreviewed ads render with an "Unreviewed" badge |
| `domains` | `Domains` (capital D) | — | `isDomainReviewed` — unreviewed domains are dropped; if none remain the job **fails** |
| `ad_profiles` | `Ad_profiles` (capital A) | `Ads` via `ad_profile_id` **and** `list.reviewed_at != null`; `Domains` via the ads' `linked_domain_ids` | `isAdProfileReviewed` on profiles, `isAdReviewed` on ads, `isDomainReviewed` on domains. If no reviewed profile remains the job **fails** |
| `apps` | `Apps` (capital A) | `App_developers` via `developer_id`; `case_events` where `entity_type` ∈ `['app','apps']` | none — unreviewed apps render with an "Unreviewed" badge. If none of the requested IDs exist the job **fails** |

Request order is always preserved: rows are re-ordered to match the incoming ID array (`orderPostsByRequestedIds`), and missing IDs are silently dropped.

### Ad-profile content cap

`MAX_PROFILE_REPORT_ADS = 20`. Ads are sorted by **threat score desc → feed-like platform → most recent**, then sliced to 20 for display. Metrics and the "showing N of M" summary still use the full reviewed set.

---

## 5. Image pipeline per branch

All branches download from S3 to a local cache, resize to **800 px wide max**, and encode JPEG q80 via `sharp`. On `sharp` failure the raw buffer is kept if the magic bytes are JPEG (`ffd8`) or PNG (`8950`).

| Branch | Cache dir | What is fetched | Slices |
| --- | --- | --- | --- |
| `posts` | `/tmp/images` | First image per post (`resolvePostMediaUrl`). Plus the profile picture for `Profile` / `SimpleProfile` **PDF** | — |
| `ads` | `/tmp/images` | `Summary`: one thumb per ad (`resolveAdMediaUrl`, falling back to first card). `Detailed`: up to 6 card images per ad | — |
| `domains` | `/tmp/images` | Lander screenshot per domain | `Detailed` only |
| `ad_profiles` | `/tmp/images` | One thumb per ad, one lander per linked domain, one profile picture per profile | Always on — evidence hero (portrait ≈9:16) + gallery slices for every domain |
| `apps` | `/tmp/images` | `Summary`: one icon thumb per app (`icon` → `header` → first screenshot). `Detailed`: up to 6 screenshots and up to 10 evidence images (4 per section). Header banners are never fetched. Videos (`.mp4`, …) and non-image media are skipped before download | — |

`IMAGE_CACHE_DIR` overrides the cache directory (default `/tmp/images`). Lambda only guarantees `/tmp`, so that is intentional.

---

## 6. Persistence and watermarking

| Path | Watermark | Destination |
| --- | --- | --- |
| Any **PDF** (all entity types) | ✅ Contrails watermark stamped by `watermarkPdfStream` | `s3://<bucket>/reports/<reportHash>.pdf` or local dir |
| Posts **DOCX** | ❌ none | `s3://<bucket>/reports/<reportHash>.docx` or local dir |

`reportHash` is deterministic SHA-256; it is the S3 key stem and the Supabase lookup key. Formula: [UI request flow §2](./ui-report-request-flow.md#2-client-side-hash-generation-must-match-backend-exactly).

---

## 7. Observable failure modes

| Symptom | Cause |
| --- | --- |
| `Invalid payload: …` logged, record skipped | Validation failure — see §3 |
| `No reviewed domains found for the requested IDs` | All `domainIds` failed `isDomainReviewed` |
| `No reviewed ad profiles found for the requested IDs` | All `adProfileIds` failed `isAdProfileReviewed` |
| `No apps found for the requested IDs` | Every requested `appIds` entry was missing from `Apps` |
| `Domain PDF report type 'X' is not supported` | `reportType` outside `Summary \| Detailed` reached the renderer |
| `App PDF report type 'X' is not supported` | `reportType` outside `Summary \| Detailed` reached the apps renderer |
| `PDF report type 'X' is not supported` | Posts `reportType` not handled by the renderer |
| `DOCX report type 'X' is not supported` | DOCX `reportType` not handled by the generator |
| Supabase row never reaches `[100%] Complete` | See [connectivity](./connectivity.md) — missing `SUPABASE_URL`/`SUPABASE_KEY` makes status updates silent no-ops |

---

## 8. Adding a new report type — checklist

1. Add the type to `SUPPORTED_REPORT_TYPES` in `src/core-utils.js`.
2. Add it to `DOCX_SUPPORTED_REPORT_TYPES` and/or `DOCX_ONLY_REPORT_TYPES` if DOCX applies.
3. Add it to the per-entity allow-list (`ADS_` / `DOMAINS_` / `AD_PROFILES_` / `APPS_SUPPORTED_REPORT_TYPES`) or leave it posts-only.
4. Create the component under `src/components/` (PDF) or `src/components/docx/` (DOCX).
5. Wire the import and the branch in `src/report-job.js`.
6. If it changes the hash inputs, update `generateReportHash` **and** the client-side copy in `docs/ui-report-request-flow.md` — a mismatch reuses the wrong cached file.
7. Add a layout smoke test in `test/integration/report-layouts.test.js` using a fixture from `test/integration/smoke-fixtures.js`.
8. Add a sample payload in the repo root and a curl line in `HOW_TO_TEST_PDFS.md`.
9. Document the visual intent in [report-themes.md](./report-themes.md).
