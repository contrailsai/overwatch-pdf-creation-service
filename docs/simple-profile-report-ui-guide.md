# Simple Profile Report — UI Integration Guide

Minimal DOCX profile reports for cleaner client-facing output. Same request flow as other reports; only `reportType` and payload shape differ from the standard `Profile` DOCX.

## When to use

| Report type | Format | Use case |
|-------------|--------|----------|
| `Profile` | `docx` / `pdf` | Full analysis (overview, stats, violations, legal, reasoning) |
| `SimpleProfile` | **`docx` only** | Plain summary: account info + numbered cases (I, II, …) with URL, description, and image |

## Request payload

```json
{
  "projectId": "ICICI",
  "database_name": "ICICI-Data-Search",
  "postIds": ["69971de6d954acef4dc30207", "69971de9d954acef4dc30208"],
  "reportType": "SimpleProfile",
  "reportFormat": "docx",
  "project": {
    "project_name": "ICICI",
    "project_details": { "labels": [], "legal_codes": [] }
  },
  "profile": {
    "_id": "profile-object-id",
    "username": "example_user",
    "profile_url": "https://instagram.com/example_user",
    "metadata": {
      "full_name": "Example User",
      "follower_count": 1234,
      "account_creation_date": "2024-01-11T00:00:00.000Z",
      "location": "Mumbai"
    }
  }
}
```

### Rules

- `reportType` must be `"SimpleProfile"`.
- `reportFormat` must be `"docx"` — PDF is rejected by validation.
- `profile._id` is **required** (used in report hash deduplication).
- `postIds` must be a non-empty array of valid Mongo ObjectIds (the cases to include).
- `postIds` order is preserved in the report (I = first ID, II = second, etc.).

## Profile fields used in the document

| Label in DOCX | Source |
|---------------|--------|
| Name of the account | `profile.metadata.full_name`, else `@profile.username` |
| Link to the account | `profile.profile_url` (hyperlink) |
| Number of followers | `profile.metadata.follower_count` (line omitted if missing) |
| Note | `This account's said location: {location}` (line omitted if location missing) |

Below the profile block, the heading **Evidence** introduces the numbered cases.

## Case fields used in the document

Each case is rendered as:

```
I.   URL: <post.original_url>
     Description: <case description>
     <case image with tight black border>
```

- Case markers use Roman numerals with a trailing period (I., II., III., …).
- URL starts on the same line as the case number; Description is on the next line, indented to align.
- Description uses `review_details.simple_report_description` when present and non-empty; otherwise it falls back to `review_details.reasoning`. Only `review_details` is consulted — `analysis_results` is never used for Simple Profile reports.
- The document uses Times New Roman throughout.
- A leading `Description:` prefix in the description text is stripped automatically.

## Hash generation

Use the same hash formula as all other reports. **`SimpleProfile` is part of the key**, so it will not collide with a `Profile` report for the same posts.

```
{projectId}-{sortedPostIdsCsv}-SimpleProfile-{profile._id}-docx
```

```ts
const reportHash = generateReportHash({
  projectId,
  postIds,
  reportType: "SimpleProfile",
  reportFormat: "docx",
  profile,
});
```

## End-to-end flow (unchanged)

1. Compute `reportHash` with `reportType: "SimpleProfile"` and `reportFormat: "docx"`.
2. Upsert / find row in `reports_generation` by `report_hash`.
3. If not already complete, send the payload as the SQS message body.
4. Poll Supabase until `status` is `[100%] Complete` and `s3_path` is set.

Full details: [ui-report-request-flow.md](./ui-report-request-flow.md).

## UI checklist

- [ ] Add `SimpleProfile` to the report type picker (DOCX only — hide or disable PDF for this type).
- [ ] Include `reportType: "SimpleProfile"` in hash generation.
- [ ] Send the full `profile` object (at minimum `_id`, `username`, `profile_url`, and relevant `metadata`).
- [ ] Reuse the same SQS + Supabase polling flow as `Profile` reports.

## Validation errors to handle

| Error | Cause |
|-------|-------|
| `SimpleProfile is only supported with reportFormat docx` | `reportFormat` was `pdf` or omitted (defaults to `pdf`) |
| `reportType must be one of: ...` | Typo in `reportType` (must be exactly `SimpleProfile`) |
