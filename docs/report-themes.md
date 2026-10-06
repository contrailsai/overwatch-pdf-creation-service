# Report Themes — How Each Report Looks and Works

Visual and structural reference for every document the service produces. Read this alongside [report-catalog.md](./report-catalog.md) (which renderer runs) — this doc describes **what that renderer draws**.

> **Reality check first.** There is no central theme module. Each component declares its own `StyleSheet.create` with a local `Theme` object or literal hex values. As a result **two incompatible design generations exist side by side**, and the same semantic idea (a link, a "high risk" badge) renders in a different colour depending on which family a report belongs to. This doc records the de-facto theme as it is, and [§10](#10-consistency-issues) lists the divergences. A consolidated theme module is tracked in [roadmap.md](./roadmap.md).

---

## 1. Shared foundations

### Fonts

`src/components/utils/FontRegister.js` runs once per process (`fontsRegistered` guard) and is called at module load by every PDF component.

| Family | Files | Weights declared |
| --- | --- | --- |
| `Outfit` | `Outfit-Regular.ttf` (default), `Outfit-Bold.ttf`, `Outfit-Medium.ttf` | `'bold'`, `'medium'` only |
| `Mukta` | `Mukta-Regular.ttf` | default — Indian-language glyph coverage |
| Emoji source | `public/fonts/emojis/*.png` (~3,600 files) | `format: 'png'` |

Every PDF page declares `fontFamily: ['Outfit', 'Mukta']`, so Outfit is the primary face with Mukta as the Indic fallback.

> **Caveat.** Generation B components request numeric weights (`400`, `500`, `600`, `700`) while the registry only declares `'bold'` and `'medium'`. Text at `500`/`600` (stat labels, section labels, AI-badge text) may silently render at Regular. See [§10](#10-consistency-issues).

DOCX output uses **different** fonts, and the two DOCX families do not agree with each other:

| DOCX family | Font |
| --- | --- |
| Branded (`Single`, `Detailed`, `Profile`) | `Calibri` (document default) |
| Simple (`SimpleProfile`, `SimpleCase`) | `Times New Roman` |

### Page size

- **All PDFs are A4 portrait.** No renderer passes `orientation` or a non-A4 `size`.
- **All DOCX are A4 portrait**, inherited from the `docx` package default (`11906 × 16838` twips). A comment in `SingleCaseReportDocx.js` claims "US Letter" and is stale.
- DOCX margins are `1080` twips (0.75″) on all sides everywhere. The shared `PAGE_WIDTH = 10080` twips is Letter-derived, so header/footer tables are ~334 twips wider than the true A4 text column (9746).

### Repeated chrome

| Element | Generation A | Generation B | Domains family |
| --- | --- | --- | --- |
| Brand title | `OVERWATCH` (18 / `'900'` / letterSpacing 0.5) | `Overwatch` (18 / 700) | `OVERWATCH` in summary; `Overwatch` in detailed |
| Subtitle | `Digital Risk Protection Report` (Summary) / `Profile Investigation Report` (Profile) | `Digital Risk Protection` | `Domain Integrity Report` (summary) / `Domain Integrity` (detailed) / `Meta Ads Integrity Report` (ads summary) / `Meta Ads Integrity` (ads detailed) |
| Footer | `CONFIDENTIAL DOCUMENT` · `POWERED BY CONTRAILS AI` · `PAGE X OF Y` | `Confidential Document` · `Powered by Contrails AI` · `Page X of Y` | uppercase in summary, title case in detailed |
| Timestamp | `"dd MMM yyyy, hh:mm a 'IST'"` (Asia/Kolkata) | `'dd MMM yyyy, hh:mm a'` (Asia/Kolkata, no suffix) | summary uses the `IST` form, detailed uses the plain form |

- **A brand header with a fixed position repeats on every page**; an inline brand header appears once per logical section. Posts Detailed/Single and Ads Detailed use an inline header (it is deliberately *not* `fixed`, so it appears once per case). Posts Summary/Profile and the Domains/Ads-Summary/Ad-Profile family use a fixed header that repeats.
- **No renderer produces a dedicated cover page.** Posts Profile page 1 is the closest thing (header + profile banner). Posts Summary opens straight into metrics. Posts Detailed/Single have no title page at all.
- Dates are rendered in `Asia/Kolkata` everywhere except `ProfileReport`'s `formatMonthYearSafe`, which uses the host timezone.

---

## 2. The two palettes

Two design systems grew independently. They disagree on **every** accent colour.

| Role | Generation A — "list/summary" | Generation B — "detailed" |
| --- | --- | --- |
| Used by | `SummaryReport`, `ProfileReport` | `DetailedCaseReport`, `SingleCaseReport`, `AdsDetailedReport` |
| Primary ink | `#1E293B` (`PRIMARY_BLUE`) | `#0F172A` (`INK`) |
| Secondary ink | — | `#334155` (`INK_SOFT`) |
| Muted | `#64748B` (`SECONDARY_GRAY`) | `#64748B` (`MUTED`) |
| Faint | — | `#94A3B8` (`SUBTLE`) |
| Border | `#E2E8F0` (`BORDER_LIGHT`) | `#E2E8F0` (`LINE`) |
| Hairline | — | `#F1F5F9` (`LINE_SOFT`) |
| Section fill | `#F8FAFC` (`BG_SECTION`) | `#F8FAFC` (`SURFACE_ALT`) |
| Surface | `#FFFFFF` | `#FFFFFF` |
| Link | `#3B82F6` | `#2563EB` |
| High risk | `#F43F5E` | `#E11D48` |
| Medium risk | `#F97316` | `#EA580C` |
| Low risk | `#F59E0B` | `#D97706` |
| Safe | `#10B981` | `#059669` |
| Warn | `#C2410C` (domains/ads only) | `#C2410C` |
| Page padding (T/H/B) | `30 / 30 / 40` | `12 / 12 / 12` |

**A third, hybrid token set exists:** `DomainTheme` (§7). It borrows Generation B's *neutral naming* (`INK`, `INK_SOFT`, `MUTED`, `LINE`, `SURFACE_ALT`) but keeps Generation A's *accent values* (`LINK #3B82F6`, `RISK_HIGH #F43F5E`, `RISK_MEDIUM #F97316`, `RISK_LOW #F59E0B`, `SAFE #10B981`). Consumers:

| Consumer | Consequence |
| --- | --- |
| `DomainsSummaryReport`, `DomainsDetailedReport` | Import `DomainTheme` directly — the **only** renderers whose detailed variant keeps the summary accents |
| `adsProfilesPdfShared` (→ both ad-profile documents) | Builds its `Theme` by spreading `DomainTheme`, so it is exactly `DomainTheme` |
| `AdsSummaryReport` | Redeclares a value-identical 11-key subset **inline** instead of importing — a drift risk |

So `DomainsDetailedReport` body text is Generation B's `#0F172A`, but its links are `#3B82F6` and its risk colours are `#F43F5E / #F97316 / #F59E0B / #10B981`. `AdsDetailedReport` is the opposite: same detailed page geometry, Generation B accents. Do not infer a report's palette from its layout style.

Shared across **both** palettes: risk badge backgrounds `#FFF1F2` (high), `#FFF7ED` (medium), `#FFFBEB` (low), `#ECFDF5` (safe).

### Ad-hoc literals

| Hex | Where | Purpose |
| --- | --- | --- |
| `#64748B15` | Summary, Profile, Ads Summary, Domains | Violation chip background (8-digit hex alpha) |
| `#0F172A` | Detailed, Single, Ads Detailed | Media letterbox background; Ads Detailed card-grid background |
| `#1E293B` | Ads Detailed | Card thumbnail placeholder |
| `#9CA3AF` | Detailed, Single, Ads Detailed | Avatar initial fallback when the name hashes to nothing |
| `#7C3AED` / `#EA580C` / `#059669` | Detailed, Single, Ads Detailed | `AIGC` / `MIS` / `POI` media badges |
| `#0000A0` @ 0.07 opacity | all PDFs | Contrails watermark (§9) |

### AI-label palette

`DetailedCaseReport`, `SingleCaseReport` and `AdsDetailedReport` map a label to a triple `(text, background, border)` via `labelColorMap` / `getLabelColor`:

| Key | Text | Background | Border |
| --- | --- | --- | --- |
| purple | `#7C3AED` | `#F5F3FF` | `#DDD6FE` |
| rose | `#E11D48` | `#FFF1F2` | `#FECDD3` |
| orange | `#EA580C` | `#FFF7ED` | `#FED7AA` |
| indigo | `#4F46E5` | `#EEF2FF` | `#C7D2FE` |
| red | `#DC2626` | `#FEF2F2` | `#FECACA` |
| yellow | `#CA8A04` | `#FEFCE8` | `#FEF08A` |
| blue | `#2563EB` | `#EFF6FF` | `#BFDBFE` |
| emerald | `#059669` | `#ECFDF5` | `#A7F3D0` |
| amber | `#D97706` | `#FFFBEB` | `#FDE68A` |
| slate (default) | `#475569` | `#F8FAFC` | `#E2E8F0` |

Project labels are coloured by severity: `high` → rose, `medium` → orange, `low` → yellow, no severity → purple.

### Deterministic avatar

`DetailedCaseReport`, `SingleCaseReport` and `AdsDetailedReport` always draw initials over a colour picked by hashing the name (`h = c + ((h << 5) - h)`, `Math.abs(h) % 14`) from:

`#FCA5A5 #FDBA74 #FCD34D #86EFAC #6EE7B7 #5EEAD4 #67E8F9 #93C5FD #A5B4FC #C4B5FD #D8B4FE #F0ABFC #F9A8D4 #FDA4AF`

The image path is deliberately skipped because social-CDN URLs fail server-side rendering.

---

## 3. Risk badges — the one system that is *nearly* shared

Every renderer computes a risk tier, but the **thresholds, comparison operators, and safe/unreviewed labels differ per file.**

| Renderer | Function | High | Medium | Low | Safe label | Unreviewed |
| --- | --- | --- | --- | --- | --- | --- |
| Posts Summary | `getRiskLabel(score)` | `> 95` | `> 75` | `> 40` | `Safe Content` | — |
| Posts Profile | `getRiskLabel(score)` | `> 95` | `> 75` | `> 40` | `Safe Content` | — |
| Ads Summary | `getRiskLabel(score, hasReview)` | `> 95` | `> 75` | `> 40` | `Safe Content` | ✅ when no review signal and score is `null`/`0` |
| Ads Detailed | `getRiskInfo(score, hasReview)` | `>= 96` | `>= 76` | `>= 41` | `Safe` | ✅ same condition |
| Posts Detailed | `getRiskInfo(score)` | `>= 96` | `>= 76` | `>= 41` | `Safe` | — |
| Posts Single | `getRiskInfo(score)` | `>= 96` | `>= 76` | `>= 41` | `Safe` | — |
| Domains Summary/Detailed | `domainRiskInfo(domain)` | `>= 96` | `>= 76` | `>= 41` (after `list.risk_rank`) | `Safe` | `Unreviewed` when rank is unknown |
| Ad profiles — ads table | `adRiskInfo(ad)` | `> 95` | `> 75` | `> 40` | `Safe` | ✅ when score `null`, no `threat_types`, no `reviewed_at` |
| Ad profiles — profile | `profileRiskInfo(profile)` | from `risk_rank \|\| risk` only | — | — | `Safe` | label is **`Reviewed`** when no rank present |

Score source everywhere: `review_details.threat_score ?? analysis_results.risk_score ?? 0` (ads also fall back to `list.review_threat_score`, `list.effective_threat_score`).

> **Off-by-one bug.** Generation A uses `>` and Generation B uses `>=` with the same nominal numbers, so a score of exactly **76** is "Medium Risk" in a Posts Summary and "Low Risk" in a Posts Detailed. Standards: this is the single highest-value fix in the theme layer.

### Label resolution for violations

Posts Summary/Profile and Ads Summary resolve violation chips in this order:

1. A project label from `project_details.labels` when `review_details.flags[label.name] === true` **or** `threat_types.includes(label.name)`.
2. A legacy flag mapping → fixed severity `medium`:
   `is_nsfw` → `NSFW`, `is_hate_speech` → `Hate Speech`, `is_fake_news` → `Misinformation`, `is_fraud` → `Fraud`, `is_asset_misuse` → `Asset Misuse`, `is_humor` → `Satire`, `is_terrorism` → `Terrorism`, `is_violence` → `Violence`.
3. Remaining `threat_types` entries (excluding falsy and `'safe'`), title-cased, forced to `medium`.

`DetailedCaseReport` uses the longer titles from the same map (`NSFW Content`, `Misinformation`, …). Chips are then sorted by severity order (`high: 1, medium: 2, low: 3`, default `4`).

**Posts Summary and Profile render every chip in grey.** Severity colouring is explicitly commented out in both files ("NO BADGE COLORING FOR NOW (DISTURPS WITH RISK SEVERITY)"), with `#64748B` borders, a `#64748B15` fill, and `#1E293B` text.

---

## 4. Typography scale (PDF)

There is no type scale constant — sizes are chosen per style. The ladder in practice:

| Size | Typical use |
| --- | --- |
| 18 | Document/brand title, Posts Summary metric value, Ads Summary metric value |
| 16 | Posts Detailed/Single case title, Domains Summary metric value |
| 15 | Ad-profile metric value |
| 14 | Posts Profile name, Domains Detailed case title |
| 13.5 | Ad-profile case summary (`reviewBodyLead`) |
| 13 | Ad-profile name, highlight value |
| 11.5 | Domains Detailed gallery title |
| 11 | Ad-profile connected-content title |
| 10.5 | Ad-profile detail value |
| 10 | Section title (`sectionTitle`), Posts Profile stat value |
| 9 | Ad-profile review label, Domains Detailed KV value, `minHeight` body lead |
| 8.5 | Ad-profile review body, legal code, Ads Detailed info value |
| 8 | Posts Detailed/Single info value, Ads Detailed case title |
| 7.5 | Most labels and meta text, `captionText` (Generation A) |
| 7 | Table header cells, threat chip text |
| 6.5 | Footer, metric label, media badge, legal code |
| 6 | Small captions, stat labels |
| 5.5 | Destination labels, date labels, Ads Detailed body text |
| 5 | Ads Detailed right-section / legal-section labels |
| 4.5 | Ads Detailed AI-label and risk-badge text — smallest in the codebase |

Weights: `'900'` for titles, section titles, metric values and badge text; `'700'`/`'bold'` for values and sub-labels; `'medium'`/`500` and `400` for stat text.

Radii: `6` (metric cards, banners, review sections) · `5` (section cards, hero frames) · `4` (badges, table headers, chips, thumb frames) · `3` (small chips, gallery slice badges, platform pills) · `18`–`30` (circular avatars).

Border widths: `1` (headers, risk badges) · `0.5` (the overwhelming default) · `0.3` (violation chips).

---

## 5. Posts reports

Renderer selection: [report-catalog.md §1](./report-catalog.md#1-the-matrix).

### 5.1 Posts Summary — `RiskReportDocument`

Props: `{ posts, project, compressedImages }`. Palette: **Generation A**. Single A4 page, padding `30/30/40`, `wrap` on no element except that each table row is `wrap={false}`.

| Section | Content |
| --- | --- |
| Fixed header | `OVERWATCH` / `Digital Risk Protection Report` / right: current timestamp |
| Executive Summary | 5 equal metric cards (gap 10): high / medium / low / safe counts by score, plus total |
| Case List Analysis | Fixed table header + one row per post |

Table columns: `#` 4% · `Visual & Caption` 30% · `Source Details` 17% · `Violations` 22% · `Risk Severity` 15% · `Analysis Dates` 12%.

Row: 45×45 `objectFit: 'cover'` thumbnail (or a `No Img` placeholder) with caption truncated to 85 chars / 4 lines; platform + `@username`; like/comment/view stat row (view only when `view_count > 0`); grey violation chips (max ~3); risk badge; `Publish Date:` / `Alert Date:`.

Risk badge: padding `6/4`, radius 4, **borderWidth 1**, text 7 / `'900'` / uppercase.

### 5.2 Posts Detailed — `DetailedCasesReportDocument`

Props: `{ posts, project, compressedImages }`. Palette: **Generation B**. **One A4 page per post** (`<Document>` maps over posts), padding `12/12/12`.

Per-page layout: inline `BrandHeader` → `Case #N` heading → info banner → two columns (left 54% / right 46%, gap 12) → footer.

| Region | Content |
| --- | --- |
| Info banner (`#F8FAFC`) | `Account`, `Platform`, `URL` (link), `Published`, `Alerted` |
| Left card | Media at 100% × **208** height, `objectFit: 'contain'`, on a `#0F172A` letterbox, with media badges (`AIGC`/`MIS`/`POI`) bottom-left and a `View Source` pill bottom-right → avatar strip (32×32 initials, name, `@handle · platform`) → `Post Caption` + hashtags → three 3-cell stat rows: `Platform`/`User Handle`/`Followers`, `Likes`/`Comments`/`Shares`, `Posted On`/`Processed On`/`Case ID` |
| Right card | `Legal Violations` (conditional) → `Content Reasoning` → `AI Labels Detected` (conditional) → `Current AI Generated Risk` → `Comments` (conditional) |

Media badge colours: `AIGC` `#7C3AED`, `MIS` `#EA580C`, `POI` `#059669`.

Footer is positioned absolutely but **not** `fixed`, so it appears once per case rather than repeating on overflow.

> **Known rendering quirk.** `rightSections` still registers `'logs'` when `updateHistory.length > 0`, but the Action Logs block is commented out. A case with update history emits a trailing divider after the risk section with nothing following it.

The brand SVG logo is commented out; the header is text only.

### 5.3 Posts Single — `SingleCaseReportDocument`

Props: `{ post, project, compressedImage }`. Palette: **Generation B**, byte-identical theme object to Posts Detailed. Same page setup, same two-column layout, same badges and helper functions.

Differences from Detailed:

- No `caseNumber` prop; only one case.
- Title derives as `Case #{post.post_id || last 5 chars of _id}`, falling back to `Case Detail`.
- No Action Logs section at all.
- Hashtag/caption/tag handling is identical.

### 5.4 Posts Profile — `ProfileReportDocument`

Props: `{ profile, cases, project, compressedImages, compressedProfilePic }`. Palette: **Generation A** on page 1.

This document mixes both page regimes:

| Page | Regime |
| --- | --- |
| Page 1 | Generation A — padding `30/30/40`, fixed header/footer |
| Pages 2+ | One `SingleCasePage` per case — **Generation B**, padding `12/12/12` |

The margin jump between page 1 and page 2 is visible. Page numbers span the whole document.

Page 1:

| Section | Content |
| --- | --- |
| Fixed header | `OVERWATCH` / `Profile Investigation Report` / timestamp and `ID: <profile id>` |
| Profile banner (`#F8FAFC`) | Left 65%: 60×60 circular picture (or `No Img`), name, `@username • PLATFORM`, biography (300 chars), and follower/following/post stats plus a `View Profile` link. Right 30%: a bordered column with conditional `Location`, `Category`, `Joined`, `Verified`, `Business` rows |
| Metrics | `Profile Cases Summary` — 5 cards |
| Case List Analysis | Fixed header + rows **without** a `#` column: `Visual & Caption` 34% · `Source Details` 17% · `Violations` 22% · `Risk Severity` 15% · `Analysis Dates` 12% |
| Then | One `SingleCasePage` per case |

An empty `cases` array yields a profile-summary-only PDF (metrics, table and case pages are all gated on `cases.length > 0`).

Profile's row-level threat resolution is **weaker** than Summary's: it omits the `threat_types` matching pass and the unmatched-`threat_types` fallback.

---

## 6. Ads reports

### 6.1 Ads Summary — `AdsSummaryReportDocument`

Props: `{ ads, project, compressedImages }`. Palette: Generation A **values**, redeclared inline (does not import `DomainTheme`). Single A4 page, padding `30/30/40`.

| Section | Content |
| --- | --- |
| Fixed header | `OVERWATCH` / `Meta Ads Integrity Report` / timestamp |
| Executive Summary | `Total Ads` (blue) · `Active` (green) · `Destination Mismatch` (red when > 0) · `Landing Domains` — distinct hostnames across `shown_hostname` + `card_hostnames` · a conditional fifth card labelled `Unreviewed` when every ad lacks a review signal, otherwise `High Risk` |
| Ad List Analysis | Fixed header + row per ad |

Columns: `#` 4% · `Creative` 26% · `Advertiser` 16% · `Destinations` 22% · `Violations` 12% · `Risk` 12% · `Dates` 8%.

Row highlights: 45×45 creative; `formatText` = display format plus `· N cards` when `card_count` is set; `adSourceLinkLabel` renders `View Post` / `Ad Library` / `View Source`; `Shown as` vs `Card destinations` (up to 3) plus a `Mismatch` badge when `destination_mismatch`; `Started` / `Sourced` dates.

Metric card value size is **18** here (vs 16 in Domains Summary).

### 6.2 Ads Detailed — `AdsDetailedReportDocument`

Props: `{ ads, project, compressedImages, compressedCardImages }`. **One A4 page per ad**, padding `12/12/12`.

> **Palette exception.** This file does **not** use `DomainTheme`. It uses the **Generation B / posts palette** (`LINK #2563EB`, `RISK_HIGH #E11D48`, `RISK_MEDIUM #EA580C`, `RISK_LOW #D97706`, `RISK_SAFE #059669`, plus `SUBTLE`, `LINE_SOFT`, `#0F172A` chrome). Visually it belongs with Posts Detailed/Single, not with Ads Summary.

| Region | Content |
| --- | --- |
| Inline brand header | `Overwatch` / `Meta Ads Integrity` |
| Heading | `Ad #N` (or `Ad Detail`) + `Active`/`Inactive` status badge |
| Info banner | `Advertiser` · `Platform` (`{platform} · {display_format}`) · source link · `Started` · `Sourced` |
| Left card | Card grid (**max 6** thumbnails at 32% width × 72 high on a `#0F172A` background, placeholders read `Card N`) → avatar strip (`Ad ID … · {platform}`) → `Creative Copy` (500 chars) → optional `CTA:` and `Displayed as` → stats `Format`/`Cards`/`Impressions` → `Platforms` pills → stats `Started`/`Processed` |
| Right card | **Destination Analysis** first (a `Destination mismatch` warning banner naming the shown host and the card hosts, then a `Shown destination` box, then one row per card with `Card N` and its resolved hostname) → `Legal Violations` → `Content Reasoning` → `AI Labels Detected` → `Current AI Generated Risk` |

The footer is the only one in the Domains/Ads family that is **not** `fixed`.

### 6.3 Domains

Both domain renderers import `DomainTheme` (see §7) and accept `domains` **or** the legacy `posts` prop alias.

**Domains Summary — `DomainsSummaryReportDocument`** — props `{ domains, project, compressedImages }`. Single A4 page, padding `30/30/40`.

| Section | Content |
| --- | --- |
| Fixed header | `OVERWATCH` / `Domain Integrity Report` / timestamp |
| Executive Summary | Six cards: `Total`, `High`, `Medium`, `Low`, `Safe`, `Cloaked` (the cloaked card turns `#C2410C` only when `cloaked > 0`) |
| Domain List Analysis | Fixed header + row per domain |

Columns: `#` 6% · `Domain` 46% · `Risk` 13% · `Cloaked` 13% · `Threat` 14% · `Ads` 8%.

Row: **232×144** cover thumbnail (or `No Img`); domain name (42 chars); visit-URL link (46 chars); risk badge; `Y`/`N` plus `N lander(s) · {caption}`; up to 3 violation chips (20 chars each); ads count from `list.occurrence_count`, falling back to `linked_ad_ids.length`.

**Domains Detailed — `DomainsDetailedReportDocument`** — props `{ domains, project, compressedImages, screenshotSlices }`. **One dossier page per domain, plus gallery pages.** Padding `12/14/28`.

Dossier structure: inline `BrandHeader` → `N. domain.com` heading + risk badge → info banner (`Lander`, `Visit URL`) → two columns (left 46% / right 54%, gap 8):

| Region | Content |
| --- | --- |
| Left | Hero lander screenshot in a 100% × **210** frame, `objectFit: 'contain'`, `objectPosition: 'top'` (or `No lander screenshot`) |
| Right | `Page content` card — captured title, description, excerpt and up to 3 headings; falls back to `No captured page title or description.` |

Then three stacked full-width cards:

1. `Legal / Reasoning` — up to 2 legal codes with reasoning (140 chars), reviewer reasoning (520 chars / 7 lines), up to 6 violation chips.
2. `Infrastructure` — an `Ads count` chip plus three columns: **registrar/whois** (registrar, created, expires, privacy, up to 3 nameservers), **hosting** (provider, country, IP · ASN, up to 3 A records, first 5 redirects joined with `→`), **SSL** (issuer, valid-to, valid yes/no).
3. `Other landers` (conditional) — up to two-per-row links for other client-visible lander URLs.

**Gallery pages** follow each dossier when slices exist:

- 12 cells per page (`SLICE_PAGE_SIZE = 12`), laid out **column-major** in 3 columns × 4 rows.
- Cell height 186; each cell is `objectFit: 'cover'`, `objectPosition: 'top'`, with a numbered badge top-left.
- Header `Website Capture — {domain}` with `label · N of M` meta only when there is more than one page.

### 6.4 Ad profiles

Both ad-profile documents are thin wrappers over `adsProfilesPdfShared.js`, which owns the entire design system. Layout is chosen by **reviewed profile count**, not `reportType`:

| Count | Document | Title |
| --- | --- | --- |
| 1 | `AdsProfileReportDocument` | `Ads_Profile_Report` |
| 2+ | `AdsProfilesSummaryReportDocument` | `Ads_Profiles_Summary_Report` |

Both then append `DomainCaptureGalleryPages` (from `DomainsDetailedReport`) after the catalog/dossier page — same 12-per-page 3×4 gallery.

**Page 1 structure** (shared, via `ProfileReportBlock`):

1. `pageOneHero` — a fixed **280 px** tall row (left 46%, right 52%; the fixed height keeps `Review Details` starting at the same vertical position on every dossier):
   - Left: `ProfileBanner` — 44×44 circular picture, page name, `PLATFORM · Verified · N followers · N ads` meta line, biography, `facebook profile` / `meta ads profile` links, then detail rows: `Risk` badge, `Category`, `Status`, `Reviewed`, `Ads`, `Domains`, `Recommended action`.
   - Right: `EvidencePreview` (`Sample Evidence` → up to 2 ad creatives at 108×100, plus one domain hero at 124×220 portrait) — only when evidence exists.
   - Plus `ProfileHighlightStrip` (vertical) showing POI detection when present.
2. `ProfileReviewMain` — `Review Details`: `Case Summary` at **13.5 pt** (deliberately the headline read), `Detected Violations` pills, `Legal Violations` cards with project-legal-code backfill, `Reviewer Comments`.
3. `ProfileReviewReasoning` — `Detailed Reasoning`, parsed into `Label: content` blocks; falls back to `No reviewer reasoning.`

**Connected content** is forced onto a new page (`break`), then: `Connected Content` divider → `Profile Metrics` (Ads, High Risk Ads, Domains, High Risk Domains, Cloaked) → `Linked Domains` table (**120×74** thumbs, columns `# | Domain | Risk | Cloaked | Violations | Ads`) → `Reviewed Ads` table (`# | Creative | Destinations | Violations | Risk | Dates`, **36×36** thumbs, up to 3 violation chips).

The ads table caps display at **20** rows and, when capped, prints `Showing N of M reviewed ads (highest threat, feed placement, then most recent).` The candidate ordering is threat score desc → feed-like platform (Facebook/Instagram) → most recent.

**Catalog variant** additionally renders `CatalogMetricsSection` — `Profiles`, `High Risk Profiles`, `Ads`, `High Risk Ads`, `Domains`, `High Risk Domains` — under an `Executive Summary` heading.

---

## 7. The `DomainTheme` token set

`src/components/domainPdfShared.js` is the closest thing to a shared theme in the repo. `DomainsSummaryReport` and `DomainsDetailedReport` import it directly; `adsProfilesPdfShared` builds its `Theme` by spreading it; `AdsSummaryReport` redeclares a value-identical subset inline.

| Token | Value | Role |
| --- | --- | --- |
| `PRIMARY_BLUE` | `#1E293B` | Headings, primary values |
| `SECONDARY_GRAY` | `#64748B` | Muted text, labels, unknown badge |
| `BORDER_LIGHT` | `#E2E8F0` | Borders |
| `BG_SECTION` | `#F8FAFC` | Card and section fills |
| `RISK_HIGH` | `#F43F5E` | High risk |
| `RISK_MEDIUM` | `#F97316` | Medium risk |
| `RISK_LOW` | `#F59E0B` | Low risk |
| `SAFE` | `#10B981` | Safe |
| `WARN` | `#C2410C` | Warning text |
| `WARN_BG` | `#FFF7ED` | Warning fill |
| `LINK` | `#3B82F6` | Links |
| `INK` | `#0F172A` | Detailed-family ink |
| `INK_SOFT` | `#334155` | Detailed-family body |
| `MUTED` | `#64748B` | Detailed-family muted |
| `LINE` | `#E2E8F0` | Detailed-family border |
| `SURFACE` | `#FFFFFF` | Surface |
| `SURFACE_ALT` | `#F8FAFC` | Alternate surface |
| `RISK_HIGH_BG` / `_BORDER` | `#FFF1F2` / `#FECDD3` | High badge |
| `RISK_MEDIUM_BG` / `_BORDER` | `#FFF7ED` / `#FED7AA` | Medium badge |
| `RISK_LOW_BG` / `_BORDER` | `#FFFBEB` / `#FDE68A` | Low badge |
| `RISK_SAFE_BG` / `_BORDER` | `#ECFDF5` / `#A7F3D0` | Safe badge |

Note there is **no `RISK_SAFE` foreground key** — safe text uses `SAFE`. `adsProfilesPdfShared.Theme` re-declares 11 of these keys and then spreads `...DomainTheme` last, so the spread wins and the effective palette is exactly `DomainTheme`.

### Lander screenshot ratios

Slicing is driven by `screenshotSlicePlan(width, height, { heroRatio, maxSlices })` in `src/domain-display.js`:

1. `heroHeight = min(h, max(1, round(w * ratio)))` — the top crop, in **source pixels**, never taller than the image.
2. Then equal-height slices of `heroHeight` are stacked until the image is consumed or `maxSlices` is hit.
3. A trailing remainder shorter than `MIN_SCREENSHOT_REMAINDER_PX = 32` is discarded — unless it is the only slice.

| Constant | Value | Used by |
| --- | --- | --- |
| `SCREENSHOT_HERO_RATIO` | `0.72` | Default hero crop |
| `SCREENSHOT_SUMMARY_RATIO` | `0.62` | Summary-table thumbs (≈16:10) |
| `SCREENSHOT_GALLERY_RATIO` | `1.2` | Gallery strips |
| `SCREENSHOT_EVIDENCE_RATIO` | `16 / 9` ≈ 1.778 | Ad-profile portrait evidence hero (≈9:16) |
| `MAX_SCREENSHOT_SLICES` | `24` | Hard slice cap per domain |

Working: `1440 × 5000` with `heroRatio 0.72` → hero 1037 px and 5 slices (the last partial). `1440 × 40000` → exactly 24 slices. Slices are extracted with `sharp().extract(...)` at 720 px wide; heroes at 800–900 px.

Which ratios each branch actually passes (`src/report-job.js`):

| Branch | Hero ratio | Slice ratio | Hero width | Suffix |
| --- | --- | --- | --- | --- |
| Domains Summary | `0.62` | — (no slices) | 800 | `lander_thumb` |
| Domains Detailed | default (`0.72`) | default (`0.72`) | 900 | `lander_hero` |
| Ad profiles | `SCREENSHOT_EVIDENCE_RATIO` (16/9) | `SCREENSHOT_GALLERY_RATIO` (1.2) | 900 | `lander_evidence_portrait` |

---

## 8. DOCX reports

All five generators return a `Promise<Buffer>` (`Packer.toBuffer`) and never write to disk — the caller persists. **No DOCX is watermarked.**

| Generator | `reportType` | Font | Branded header/footer |
| --- | --- | --- | --- |
| `generateSingleCaseDocxBuffer` | `Single` | Calibri | ✅ |
| `generateDetailedCasesDocxBuffer` | `Detailed` | Calibri | ✅ |
| `generateProfileDocxBuffer` | `Profile` | Calibri | ✅ |
| `generateSimpleProfileDocxBuffer` | `SimpleProfile` | Times New Roman | ❌ none |
| `generateSimpleCaseDocxBuffer` | `SimpleCase` | Times New Roman | ❌ none |

### 8.1 Branded family (Single / Detailed / Profile)

Drawn from `SingleCaseReportDocx.js`, which is also the shared module for the other four files.

**Page**: A4 portrait, margins `1080` twips (0.75″) all sides, `titlePage: true`.

**Header**: only the `first` header is defined, so **it appears on page 1 only**. A borderless 2-column table (`5544` / `4536` twips of `PAGE_WIDTH = 10080`) with a `#CBD5E1` bottom rule:

| Variant | Left | Right |
| --- | --- | --- |
| Single | `CASE ANALYSIS` (34 half-pt = 17 pt) | `Case ID: <ID>` + timestamp |
| Detailed | `DETAILED ANALYSIS` | `Detailed Cases Report` |
| Profile | `PROFILE ANALYSIS` | `Profile Report: @username` |

**Footer**: on every page, 3 equal columns with a `#CBD5E1` top rule — `REQUESTED BY <ORG>` (falls back to `REQUESTED BY CLIENT`) · `POWERED BY OVERWATCH` · `Page N of M`. All at 14 half-pt (7 pt), coloured `#94A3B8` with the page numbers `#64748B`.

**Palette**: labels `#1E293B`, body `#374151`, links `#2563EB` (underlined), header title `#1E293B`, header date `#475569`, subtitle `#64748B`, borders `#CBD5E1`.

**Case sections** (`generateCaseSections`, reused by all three, at 20 half-pt = 10 pt body):

1. Basic meta — `Account`, `Platform`, `URL`, `Publish Date`, `Alert Date`, `Review Date`
2. Visual Evidence
3. Engagement Stats — `Likes | Comments [| Shares] [| Views]`, joined with `   |   `
4. Caption / Content — 800 chars / 20 lines
5. Violations — bullets, or `No specific violations flagged by the system.`
6. Legal Framework — only when codes exist; a matching project code with a `referenceLink` becomes a hyperlink
7. Analysis & Complete Reasoning — one paragraph per line of reasoning

Section headings are uppercased, bold, `#1E293B`, 24 half-pt.

**Per-type differences**:

- `Detailed` inserts a `PageBreak` between cases and numbers them `CASE #1`, `CASE #2`, … Note this is a **paragraph-level page break**, not a section break, so the first-page-only header does not repeat.
- `Profile` renders `PROFILE OVERVIEW` (32 half-pt) with a right-aligned profile picture capped at **120 px**, then `ACCOUNT'S CASES REVIEWED` and all cases sequentially with **no page breaks** between them. Meta rows: `Username`, `Platform`, `Full Name`, `Bio` (300 chars), `Followers`, `Following`, `Total Posts`, `Verified`, and conditionally `Account Creation Date`, `Location`, `Profile URL`.
- `Single` renders one case.

**Images**: `readLocalImage(path, maxSize)` returns `null` when the file is missing, otherwise reads metadata via `sharp` and scales the *display* box so neither side exceeds `maxSize` (400 for cases, 120 for the profile picture) — **the embedded bytes are the original file**, not downscaled. The image is centred. When no image exists the branded generator prints a grey `No image available for this case.` placeholder.

### 8.2 Simple family (SimpleProfile / SimpleCase)

Drawn from `simpleReportShared.js`. Deliberately minimal and **completely unbranded** — no header, footer, page numbers, tables, or `project` usage. `project` is accepted and ignored by both generators.

**Page**: A4 portrait, margins `1080` twips, **no `titlePage`**.

**Theme** (`simpleReportShared.js`):

| Token | Value | Notes |
| --- | --- | --- |
| `FONT` | `Times New Roman` | Applied to every run and to the document default |
| `PAGE_MARGINS` | `{ top: 1080, right: 1080, bottom: 1080, left: 1080 }` | 0.75″ all sides |
| `CASE_CONTENT_INDENT` | `720` twips (0.5″) | Hanging indent for numbered cases |
| `textRun()` defaults | colour `#374151`, size `22` (11 pt), not bold | Overridden per use |

Accent colours: labels `#1E293B`, body `#374151`, links `#2563EB` (underlined `#2563EB`).

**SimpleCase** layout:

```
URL: <post.original_url>          ← "URL: " bold #1E293B, link #2563EB
Description: <description>        ← "Description: " bold #1E293B, body #374151
<image, centred, borderless>
```

**SimpleProfile** layout:

```
Name of the account:  <full_name, else @username>
Link to the account:  <profile_url>        ← only when present
Number of followers:  <count>              ← only when numeric
Note:                 This account operates from <location>   ← only when present

Evidence

I.     URL: <url>                          ← Roman numeral + tab
       Description: <description>
       <image, centred, borderless>
II.    …
```

Numbered cases use `{ left: 720, hanging: 720 }` with a left tab stop at 720, which is what puts `URL:` on the same line as the numeral and `Description:` one tab in. The first case gets `spacing.before = 200`. Each numbered case is followed by a `sectionDivider(400)`.

**Description source** (`getSimpleCaseDescription`): `review_details.simple_report_description` when non-empty → else `review_details.reasoning` → else `No description provided.`

> **Corrected doc drift.** The two simple-report UI guides previously documented the Note line as `This account's said location: {location}` (the code emits `This account operates from {location}`), and both simple generators' file-header comments claimed a "bordered image" (the code renders a borderless centred image). Both have been corrected in this pass.

Neither simple generator emits an image placeholder — a missing image silently produces nothing.

---

## 9. The watermark

Every **PDF** is stamped after rendering, before persistence, by `src/pdf-watermark.js`. DOCX is never stamped.

| Property | Value |
| --- | --- |
| Source asset | `public/logo_txt.svg` (tracked, 188×35 viewBox) |
| Recolour | `fill="white"` → `fill="#0000A0"` (2 occurrences, case-insensitive) |
| Raster | `sharp(...).resize({ width: 2400, fit: 'inside' }).png()` → 2400×447 PNG, memoized per process |
| Colour | `#0000A0` |
| Opacity | `0.07` |
| Rotation | `55°` |
| Size | `drawWidth = max(pageWidth, pageHeight) × 0.85`; height derived from the raster aspect (≈5.369) |
| Position | Centred on each page, with a bottom-left rotation origin offset so the image centre lands on the page centre |
| Tiling | **None** — a single centred stamp per page. The PDF's page sizes are never modified and no pages are added |

**Asset failure is fatal.** There is no existence check and no fallback: a missing or unreadable `logo_txt.svg` makes `getWatermarkPng()` reject, and `persistWatermarkedPdf` has no `try/catch`, so the entire job fails rather than emitting an unstamped PDF. Because rasterisation depends on `sharp`'s SVG support (librsvg in the prebuilt `libvips`), a future `sharp` build without SVG would break every PDF. See [roadmap.md](./roadmap.md).

`public/Watermark.pdf` exists and is gitignored but is referenced by **no code** — it is a leftover.

---

## 10. Consistency issues

Divergences recorded here are the concrete input to the theming work in [roadmap.md](./roadmap.md). None of them are intentional as far as the code comments show.

| # | Issue | Impact |
| --- | --- | --- |
| 1 | **No shared theme module.** Hex values are re-declared across 8+ files; `AdsSummaryReport` duplicates `DomainTheme` inline instead of importing it | Drift; a palette change needs many edits |
| 2 | **Two palettes.** Links are `#3B82F6` in the Domains/Ads-Summary/Ad-Profile family and `#2563EB` in Posts Detailed/Single **and Ads Detailed**. Every risk colour differs between generations | Same semantic level renders in different colours across reports |
| 3 | **Risk threshold off-by-one.** `> 95 / > 75 / > 40` (Generation A, Ads Summary, ad-profile ads) vs `>= 96 / >= 76 / >= 41` (Generation B, Domains) | A score of exactly 76 is Medium in one report and Low in another |
| 4 | **Safe label inconsistency.** `Safe Content` in Summary/Profile/Ads Summary; `Safe` everywhere else. Ad-profile profile risk falls back to **`Reviewed`**, not `Unreviewed` | Client-visible wording changes per report |
| 5 | **Page padding is inconsistent within one document.** Posts Profile page 1 is `30/30/40`; its case pages are `12/12/12` | Visible margin jump mid-PDF |
| 6 | **Numeric font weights are requested but not registered.** Generation B uses `400/500/600/700`; `FontRegister` declares only `'bold'` and `'medium'` | Small text may silently render at Regular |
| 7 | **Devanagari is stripped on Generation A.** Generation B's `sanitize` whitelists `\u0900-\u097F`; Generation A's `processText` does not | Hindi text disappears from Posts Summary and Profile reports |
| 8 | Footer/header casing differs (`PAGE X OF Y` vs `Page X of Y`, `CONFIDENTIAL DOCUMENT` vs `Confidential Document`) | Cosmetic drift |
| 9 | `AdsDetailedReport`'s footer is not `fixed` while every other footer in its nominal family is | Footer may not repeat as expected |
| 10 | `DomainCaptureGalleryPages` header colour uses `PRIMARY_BLUE #1E293B` while the rest of the detailed family uses `INK #0F172A` | Minor |
| 11 | **Dangling divider** in Posts Detailed/Single when `updateHistory` is non-empty but the Action Logs block is commented out | Stray rule line |
| 12 | **Dead styles and helpers** persist: `legalPill`, `timeline*`, `statusBadge`, `getStatusInfo`, `headerID` (Summary), `captionDate`, `statusText`, `sourcedDate`; `SLICE_PAD` in Domains Detailed; `getRiskLabel` and `bodyPara` in `SingleCaseReportDocx`; several unused imports | Noise when reading layout intent |
| 13 | ✅ **Fixed:** docs said "bordered image" for the simple DOCX reports (code renders borderless) and quoted the note as `This account's said location:` (code emits `This account operates from`). Both guides and the two generator comments were corrected | Docs contradicted output |
| 14 | DOCX page size is A4 but `PAGE_WIDTH = 10080` is Letter-derived | Header/footer tables overrun the A4 margin box by ~334 twips |

---

## 11. How to change a theme safely

1. Decide which family you are changing — see §2. Changing one does **not** change the other.
2. Prefer editing the source of truth: `DomainTheme` in `src/components/domainPdfShared.js` or the local `Theme` object in the relevant component. If you are touching `AdsSummaryReport`, note the palette is **inline**, not imported.
3. Never change the hash inputs while doing a visual-only change — `reportHash` does not depend on theme, so a layout change will **not** regenerate cached reports. Clear the `reports_generation` rows or delete the S3 objects to force regeneration.
4. Verify with the dev server against real data: [local-testing.md](./local-testing.md). The automated suite renders fixtures with `null` images and will not catch a colour or image regression.
5. If you change a risk threshold, change every occurrence listed in §3 in the same commit.
6. If you add a report type, document its theme here as well as its routing in [report-catalog.md](./report-catalog.md).
