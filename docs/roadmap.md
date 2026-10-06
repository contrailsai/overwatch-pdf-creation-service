# Roadmap — Pending Tasks & Future Improvements

Working backlog for the PDF service. Items are grouped by area and tagged with an effort estimate and a severity. Nothing here is a commitment; it is a map of what is known to be missing or fragile.

**Legend** — Effort: `S` (hours) · `M` (a day or two) · `L` (a week+). Severity: 🔴 correctness/ops risk · 🟡 maintainability · 🟢 polish.

---

## 1. Documentation (this work)

| Item | Effort | Severity |
| --- | --- | --- |
| ✅ Created `docs/report-catalog.md`, `report-themes.md`, `architecture.md`, `connectivity.md`, `local-testing.md`, `deployment.md`, `roadmap.md`, `docs/README.md` | — | — |
| Archive or clearly label `plan.md` and `implementation_plan.md` as historical. Both describe work that is either long finished or superseded (they still say "not done" for shipped features, and describe the removed Express/Redis/BullMQ architecture) | S | 🟡 |
| `samples/messages/sample_curl_requests.sh` is stale: it targets `POST http://localhost:4000/generate` and `GET /job-status/1`. Neither endpoint exists — the dev server is port `3847` with `POST /reports`. Rewrite or delete | S | 🟡 |
| Rename `samples/messages/sample_sqs_message_sebi_ad_profiles_detailed.json` → `…_single.json`. Its `reportType` is `Summary` with one profile id; the current name implies a `Detailed` request, which validation rejects | S | 🟢 |
| No doc describes the `project_details.labels` / `legal_codes` schema that renderers consume. Add a short reference with a worked example | S | 🟡 |
| `CREATION STEPS.md` and `running_steps.txt` duplicate each other with different levels of parameterisation. Keep the parameterised one as the doc, turn the other into a thin pointer | S | 🟢 |

---

## 2. Theming & design system

The single largest maintainability issue: **there is no theme module.** Each renderer declares its own palette inline, and two incompatible design generations have grown side by side.

| Item | Effort | Severity |
| --- | --- | --- |
| Extract a shared theme module (e.g. `src/components/theme.js`) and make every renderer import from it. Today `#E2E8F0`, `#64748B`, `#F8FAFC`, `#1E293B`/`#0F172A` etc. are re-declared in at least six files | M | 🟡 |
| **Reconcile the two palettes.** Generation A (`SummaryReport`, `ProfileReport`) and Generation B (`DetailedCaseReport`, `SingleCaseReport`) disagree on ink (`#1E293B` vs `#0F172A`), links (`#3B82F6` vs `#2563EB`), and every risk colour (`#F97316` vs `#EA580C`, `#F59E0B` vs `#D97706`, `#10B981` vs `#059669`) | M | 🟡 |
| **Fix the risk threshold off-by-one.** `getRiskLabel` (gen A) uses `> 95 / > 75 / > 40`; `getRiskInfo` (gen B) uses `>= 96 / >= 76 / >= 41`. A score of exactly `96` is "High Risk" in both, but a score of exactly `76` is "Medium" in gen A and "Low" in gen B. Pick one comparison and share the function | S | 🔴 |
| Page padding is inconsistent within a single document: `ProfileReport` page 1 uses `30/30/40` (gen A), while its pages 2+ are `SingleCasePage` at `12/12/12` (gen B). Visible margin jump mid-document | S | 🟡 |
| Numeric font weights (`400/500/600/700`) are used in gen B, but `FontRegister` only declares `'bold'` and `'medium'`. Verify `500`/`600` text is not silently falling back to Regular, then either register the weights or switch to declared names | S | 🟡 |
| `sanitize`/`processText` differ: gen B whitelists Devanagari (`\u0900-\u097F`), gen A does not — so Hindi text is **stripped** from Summary and Profile reports. Unify on the Devanagari-aware version | S | 🔴 |
| Footer/header casing differs (`PAGE X OF Y` vs `Page X of Y`, `CONFIDENTIAL DOCUMENT` vs `Confidential Document`). Cosmetic, but it signals the same drift | S | 🟢 |
| Remove dead styles and dead render blocks: `legalPill`, `timeline*`, `statusBadge`, `getStatusInfo`, `headerID` (Summary), `captionDate`, `statusText`, `sourcedDate`. Several `<Text>`/`<View>` blocks are commented out but their styles remain | S | 🟢 |
| **Dangling divider bug.** In `DetailedCaseReport` and `SingleCaseReport`, `rightSections` still pushes `'logs'` when `updateHistory.length > 0`, but the Action Logs block is commented out. The result is a trailing divider with nothing after it | S | 🟡 |
| No cover page exists on any report; `ProfileReport` page 1 doubles as one. Decide whether client-facing reports need a proper title page | M | 🟢 |
| `profilePicInitials` avatar is always used in gen B because social-CDN images fail server-side rendering. Revisit once images are reliably proxied | M | 🟢 |

---

## 3. Renderers & report coverage

| Item | Effort | Severity |
| --- | --- | --- |
| Posts reports use only the **first** media item per post (`resolvePostMediaUrl`). Carousel posts lose every image after the first | M | 🟡 |
| Ads DOCX, Domains DOCX, Ad-profile DOCX, and Apps DOCX are all unsupported. `validatePayload` rejects them explicitly, so this is a known gap rather than a bug | L | 🟢 |
| Ad profiles support only `reportType: Summary`. A genuine `Detailed` ad-profile product (beyond the automatic single-dossier layout) does not exist | L | 🟢 |
| `AdsProfilesDetailedReport.js` is a deprecated re-export alias of `AdsProfileReport` and is not imported by `report-job.js` — dead file | S | 🟢 |
| Unreviewed ads **do** render in `ads` reports (with an "Unreviewed" badge), but unreviewed domains/profiles are **filtered out and can fail the whole job**. Consider whether ads should filter too, or whether all branches should badge instead of drop | M | 🟡 |
| `MAX_PROFILE_REPORT_ADS = 20` is a hardcoded cap with no payload override. Make it configurable or at least logged in the status text | S | 🟡 |
| `report-job.js` treats `posts` as the `else` fall-through rather than an explicit branch. Add an explicit `entityType === 'posts'` check and a final `throw` so an unknown type cannot silently render as posts | S | 🟡 |

---

## 4. Testing

Current state: **77 tests passing**, all of them unit or renderer-level. Coverage gaps:

| Item | Effort | Severity |
| --- | --- | --- |
| **No test exercises `runReportJob`.** The entire routing matrix — which collection is read, which joins run, which renderer is chosen, the review filters, the ad-profile count switch — is untested. Add a mocked-Mongo/Mongo-memory test per branch | M | 🔴 |
| No test asserts the **review filtering** behaviour (unreviewed domains/profiles dropped, failure when nothing survives) | S | 🔴 |
| No test asserts the **`ad_profiles` layout switch** (1 id → dossier, 2+ → catalog) at the routing level — only the two renderers are rendered independently | S | 🔴 |
| No test covers `processImage` / `processLanderScreenshot`, the `sharp` fallback path, or the magic-byte check | M | 🟡 |
| No test covers `src/s3.js` signed-URL parsing, timeout/retry, or non-standard URL passthrough | S | 🟡 |
| No test covers `persistWatermarkedPdf` / `watermarkPdfStream` (asset missing, multi-page stamping) | S | 🟡 |
| No test covers the **validation/DOCX matrix exhaustively** — e.g. `posts` + `Summary` + `docx` rejection is implied but not asserted per cell | S | 🟡 |
| No coverage reporting. Add `c8` and a threshold | S | 🟢 |
| ✅ **Fixed:** `test:integration` was broken — `node --test test/integration/` fails on Node 22+ because a bare directory is resolved as a module. All three test scripts now pass a **quoted** glob (`"test/integration/**/*.test.js"`) so Node expands it itself and the scripts are shell-independent | S | 🔴 |
| No visual/snapshot regression testing. Every layout sign-off is manual | L | 🟡 |
| Tests use `compressedImages: [null, …]` throughout, so they prove a document renders, never that the right image landed in the right slot | M | 🟡 |
| `local-reports/output/examples/*.pdf` are a useful baseline but are **gitignored**, so a fresh clone has none and there is no script to regenerate them. Add `scripts/generate-examples.sh` (dev server + the sample payloads) and either commit small examples or document regeneration | M | 🟡 |

---

## 5. Reliability & operations

| Item | Effort | Severity |
| --- | --- | --- |
| **Failed records are swallowed.** `src/index.js` catches per-record errors, logs them, and returns normally — so SQS never retries and the message is deleted. The only signal is the `[Error]` row in Supabase. Implement `ReportBatchItemFailures` (return `batchItemFailures`) so genuine failures retry and land in a DLQ | M | 🔴 |
| No DLQ configured or documented | S | 🔴 |
| **No CI/CD.** Deploy is a manual four-command sequence. Add a GitHub Actions workflow that builds `linux/arm64` with `--provenance=false`, pushes with a git-SHA tag, and calls `update-function-code` | M | 🟡 |
| Only the `latest` tag is used. Tag every image with the git SHA as well, so rollback does not depend on someone having recorded a digest | S | 🟡 |
| `running_steps.txt` hardcodes account `992382580458`. Use the parameterised form or an env file so the repo is portable | S | 🟢 |
| `IMAGE_CACHE_DIR` (`/tmp/images`) grows unbounded within a container. A large batch can exhaust ephemeral storage. Add an LRU/size cap or clean up between records | M | 🟡 |
| Report generation has no timeout or cancellation. A pathological post count could run to the Lambda limit and be killed mid-upload, leaving a Supabase row stuck at `[80%]` | M | 🟡 |
| **Supabase is the only cache pointer and the service never inserts rows.** If the client forgets to upsert before enqueueing, generation succeeds invisibly. Consider having the service upsert the row when missing | M | 🟡 |
| Stale Supabase rows point at deleted S3 objects and are served as "complete". Add a lightweight object-existence check on cache hit, or a TTL/sweeper | M | 🟡 |
| No retry/backoff around Supabase writes. A transient failure silently loses a progress update | S | 🟢 |
| `telemetry.forceFlush()` is best-effort; if the collector is unreachable it logs and returns. No alerting on telemetry loss | S | 🟢 |

---

## 6. Housekeeping

| Item | Effort | Severity |
| --- | --- | --- |
| `REDIS_URL`, `PORT`, `WORKER_CONCURRENCY`, `NODE_ENV` remain in `.env` but **no current code reads them** — leftovers from the removed Express/Redis/BullMQ architecture. Remove from `.env` (and any deployed function config) | S | 🟢 |
| `public/Watermark.pdf` is gitignored and referenced by **nothing**. The watermark is rasterised from the tracked `public/logo_txt.svg`. Delete the leftover and its `.gitignore` line | S | 🟢 |
| Watermarking depends on `sharp` rasterising an SVG (librsvg support in the prebuilt `libvips`). If a future `sharp` build drops SVG, **every PDF fails**. Pre-rasterise the watermark to a committed PNG, or add a fallback that skips stamping instead of throwing | M | 🔴 |
| `Font.registerEmojiSource` points at ~3,600 PNGs under `public/fonts/emojis/`, all committed. Consider whether the full set is needed in the image | S | 🟢 |
| `AdsProfilesDetailedReport.js` and other dead exports can be removed (see §3) | S | 🟢 |
| `.claude/settings.local.json` contains an API token. It is covered by a global gitignore and is **not** tracked — but any tool that ever copies the repo will carry it. Rotate it if it has been shared | S | 🔴 |

---

## 7. Suggested order

1. **Correctness first:** SQS partial-batch failures + DLQ (§5), risk-threshold off-by-one (§2), Devanagari stripping (§2).
2. **Guard rails:** `runReportJob` routing tests and review-filter tests (§4).
3. **Structure:** shared theme module and palette reconciliation (§2).
4. **Operations:** CI/CD with SHA tagging, `/tmp` cache cap (§5).
5. **Polish:** dead code removal, doc consolidation, example regeneration script (§1, §3, §6).
