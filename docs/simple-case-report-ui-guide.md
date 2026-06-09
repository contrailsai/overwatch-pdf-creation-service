# Simple Case Report — UI Integration Guide

Minimal DOCX single-case reports for cleaner client-facing output. Same request flow as other reports; only `reportType` and document layout differ from the standard `Single` DOCX.

## When to use

| Report type | Format | Use case |
|-------------|--------|----------|
| `Single` | `docx` / `pdf` | Full analysis (meta, stats, violations, legal, reasoning) |
| `SimpleCase` | **`docx` only** | Plain summary: URL, description, and image only |

## Request payload

```json
{
  "projectId": "ICICI",
  "database_name": "ICICI-Data-Search",
  "postIds": ["6a21768dedbcf91f9a6b3e1f"],
  "reportType": "SimpleCase",
  "reportFormat": "docx",
  "project": {
    "project_name": "ICICI",
    "project_details": { "labels": [], "legal_codes": [] }
  }
}
```

### Rules

- `reportType` must be `"SimpleCase"`.
- `reportFormat` must be `"docx"` — PDF is rejected by validation.
- `postIds` must be a non-empty array of valid Mongo ObjectIds. Only `posts[0]` is used (same as `Single`).
- No `profile` object is required.
- No header/footer branding in the output document.

## Document layout

```
URL: <post.original_url>
Description: <case description>
<case image with tight black border>
```

- Description uses `review_details.simple_report_description` when present and non-empty; otherwise it falls back to `review_details.reasoning`. Only `review_details` is consulted — `analysis_results` is never used.
- The document uses Times New Roman throughout.
- A leading `Description:` prefix in the description text is stripped automatically.
- If no image is available, the URL and description lines are still rendered.

## Hash generation

Use the same hash formula as all other reports. **`SimpleCase` is part of the key**, so it will not collide with a `Single` report for the same post.

```
{projectId}-{sortedPostIdsCsv}-SimpleCase--docx
```

```ts
const reportHash = generateReportHash({
  projectId,
  postIds,
  reportType: "SimpleCase",
  reportFormat: "docx",
});
```

## End-to-end flow (unchanged)

1. Compute `reportHash` with `reportType: "SimpleCase"` and `reportFormat: "docx"`.
2. Upsert / find row in `reports_generation` by `report_hash`.
3. If not already complete, send the payload as the SQS message body.
4. Poll Supabase until `status` is `[100%] Complete` and `s3_path` is set.

Full details: [ui-report-request-flow.md](./ui-report-request-flow.md).

## UI checklist

- [ ] Add `SimpleCase` to the report type picker (DOCX only — hide or disable PDF for this type).
- [ ] Include `reportType: "SimpleCase"` in hash generation.
- [ ] Reuse the same SQS + Supabase polling flow as `Single` reports.

## Validation errors to handle

| Error | Cause |
|-------|-------|
| `SimpleCase is only supported with reportFormat docx` | `reportFormat` was `pdf` or omitted (defaults to `pdf`) |
| `reportType must be one of: ...` | Typo in `reportType` (must be exactly `SimpleCase`) |
