# Apps case-first report contract

This contract describes the case-first presentation for app reports. The SQS request,
tenant collection, project scope, and permissions pipeline remain the existing app
report contract in [the client PRD](../../overwatch_client/docs/prd/app-pdf-reports.md).

## Reading order

Detailed follows this order: **Case Overview → Evidence → Assessment & Supporting
Evidence → App & Developer information**. The
overview puts the case in context; the operational evidence presents the primary
captured material before the assessment interprets it.

1. **Case brief:** app identity, store listing link, reviewed status/date, reviewer
   risk/verdict, concise reviewed summary, violations, legal findings, and the
   recommended action when present.
2. **Operational evidence:** `Payment request` and `Indian securities activity`
   are selected by the existing title-alias classification of evidence sections.
   Always render both categories, including their explicit missing-media state.
   The overview samples up to two prepared images per category when available,
   and captions identify the sample count and source filenames. The source
   manifest resolves finding references; it does not select these overview
   cards. A category label describes where evidence was filed and does not
   establish that a transaction or activity occurred.
3. **Assessment & reviewed basis:** show recorded legal findings, detailed review,
   reviewer comments, AI findings and their source-reference statuses. Preserve
   reviewer provenance from `field_sources` and `assessment_reviewed`; distinguish
   it from automated analysis and identify empty reviewer fields.
4. **Supporting evidence:** show captured fields, category sections, other
   available source media, and media limitations.
5. **App and developer information:** show the full store and publisher record.
   Summary is the landscape executive presentation described below.

This uses the established executive-summary → evidence → basis → appendix reading
pattern for Detailed reports. Summary is a landscape executive presentation;
this contract applies only to Detailed PDFs and does not require a paired deployment,
request/hash change, or client UI change. For plain-language and audience-first guidance, see the [CDC Clear
Communication Index user guide](https://www.cdc.gov/ccindex/pdf/clear-communication-user-guide.pdf)
and the [European Court of Auditors guidance on executive summaries](https://methodology.eca.europa.eu/aware/PA/Pages/Reporting/Executive-summary.aspx).

## Evidence and wording rules

- A source match or listing match establishes where an item came from; it does not
  verify the claim described by that item. Label a proof card as supporting
  material, not as proof that a violation occurred.
- Preserve source identifiers and manifest references when available. Do not infer
  a finding-to-image relationship from array position; use explicit media IDs or
  manifest references. The PDF presents resolved/unresolved reference status and
  label, not a rendered copy of the complete manifest.
- Keep reviewer conclusions visibly separate from automated analysis. Use the
  reviewed value when present, and show an explicit empty state when it is absent;
  do not replace an empty reviewer field with an AI value while presenting it as
  reviewed.
- Missing images, unsupported video, failed fetches, and unresolved source
  references must be disclosed in place. Never silently drop them or shift source
  labels onto a neighboring image.
- Keep the original store listing and developer URLs clickable when available.
  Missing URLs are shown as unavailable, without a fabricated link.

## Data and worker behavior

The worker reads the tenant `Apps` record, joins `App_developers`, and loads app
`case_events` for update history. `normalizeApp` exposes store/publisher values,
`review_details`, `analysis_results`, evidence sections, reviewed state/provenance,
and stable per-image slots. Detailed reports fetch screenshots and evidence
images. Summary uses the same normalized records and renders a landscape presentation. Image paths are mapped back by the
original slot, while the cache token
includes source identity, URL, and any source revision/checksum metadata. This
avoids reusing a warm `/tmp/images` entry merely because a different source later
occupies the same section position.

For app media, `s3://` locators and AWS virtual-hosted/path-style HTTPS URLs are
read through the S3 SDK. A supplied `version_id` and URL `versionId` must agree;
the exact version is requested. When SHA-256 metadata is supplied, the downloaded
bytes are checked before resize. An unavailable object, version conflict, checksum
mismatch, unsupported image, or failed decode yields no embedded image path; the
report must show an unavailable-media state rather than using the original URL or
attaching it to another source label.

The evidence model may contain non-image media, including video. This PDF renderer
only embeds supported images; disclose unsupported media and failed retrievals in
the dossier. Do not imply that the PDF includes every original asset when it does
not.

## Cache and rollout

The request schema is unchanged. Detailed PDFs retain their existing cache identity; regenerate an existing Detailed artifact when it needs the revised presentation. Apps Summary uses a versioned cache identity, coordinated between the client and worker.

The Lambda image is built for `linux/arm64` and manually published to ECR before
updating `overwatch-report-generation`; see [deployment.md](./deployment.md). The
worker's local `/tmp/images` cache is source-keyed for app screenshot/evidence
media. This cache is per Lambda environment and does not affect non-app media
pipelines.


## Apps Summary presentation

Apps Summary PDF requests produce a branded 16:9 landscape presentation: risk overview, violation signals, app catalog, developer profiles, and one analysis page per app. Duplicate IDs are removed in request order. Evidence coverage counts recorded images; unavailable previews are disclosed. The report uses a versioned cache identity so older portrait summary PDFs are not reused.
