# UI Guide: Requesting Report Generation

This is the canonical client-side flow for creating reports with the PDF service.

## 1) Valid payload contract

The SQS `body` must be a JSON object with this structure:

```json
{
  "projectId": "ICICI",
  "postIds": ["69971de6d954acef4dc30207", "69971de9d954acef4dc30208"],
  "database_name": "ICICI-Data-Search",
  "reportType": "Detailed",
  "reportFormat": "pdf",
  "project": {
    "project_name": "ICICI",
    "project_details": { "labels": [], "legal_codes": [] }
  },
  "profile": null,
  "otelCarrier": {}
}
```

### Required fields

- `projectId`: string
- `database_name`: string
- `postIds`: non-empty array of valid Mongo ObjectId strings
- `reportType`: one of `Detailed | Single | Profile | Summary`
- `reportFormat`: `pdf` or `docx` (default should be `pdf` if omitted client-side)

### Important format rules

- `docx` supports only: `Detailed | Single | Profile` (not `Summary`).
- For `Profile` reports, send a proper `profile` object (including `_id`), because profile ID is part of hash generation.
- `project` should be an object (not array) if you want proper branding/org metadata in report generation.

## 2) Client-side hash generation (must match backend exactly)

Backend hash is deterministic SHA-256 over this exact raw string:

`{projectId}-{sortedPostIdsCsv}-{reportType}-{profileId}-{reportFormat}`

Where:

- `postIds` are sorted lexicographically before hashing.
- `profileId` is `profile?._id` or empty string.
- `reportFormat` is usually `pdf` or `docx`.

Use this exact implementation:

```ts
import { createHash } from "crypto";

export function generateReportHash(input: {
  projectId: string;
  postIds: string[];
  reportType: "Detailed" | "Single" | "Profile" | "Summary";
  reportFormat?: "pdf" | "docx";
  profile?: { _id?: string | null } | null;
}) {
  const reportFormat = input.reportFormat ?? "pdf";
  const profileId = input.profile?._id ?? "";
  const sortedIds = [...input.postIds].sort();
  const raw = `${input.projectId}-${sortedIds.join(",")}-${input.reportType}-${profileId}-${reportFormat}`;
  return createHash("sha256").update(raw).digest("hex");
}
```

## 3) Supabase tuple lifecycle (`reports_generation`)

The Lambda updates by `report_hash`, so UI must create/find that row first.

Minimum columns used by service:

- `report_hash` (lookup key)
- `status` (progress text)
- `last_update`
- `s3_path` (filled at completion)
- `finish_time` (filled at completion/failure)

### Suggested client flow

1. Compute `reportHash` (step 2).
2. Check Supabase for existing row by `report_hash`.
3. If row exists and is complete (`status` includes `[100%] Complete` and `s3_path` present), return cached URL.
4. If row missing, insert a new pending row.
5. Send SQS message with payload.
6. Poll or subscribe to Supabase row updates until complete/error.

Example insert (shape can include your additional columns):

```ts
await supabase.from("reports_generation").upsert(
  {
    report_hash: reportHash,
    status: "[0%] Queued",
    last_update: new Date().toISOString(),
    s3_path: null,
    finish_time: null
  },
  { onConflict: "report_hash" }
);
```

## 4) Send SQS message

Send the exact request payload as `MessageBody` (stringified JSON).

```ts
await sqs.send(
  new SendMessageCommand({
    QueueUrl: process.env.REPORT_QUEUE_URL!,
    MessageBody: JSON.stringify(payload),
  })
);
```

Optional: include trace headers in message attributes and/or `otelCarrier` if your stack supports distributed tracing.

## 5) Wait for result (UI behavior)

The service updates statuses roughly in this order:

- `[10%] Fetching Posts from DB`
- `[30%] Processing Images`
- `[60%] Generating PDF report` or `Generating DOCX report`
- `[80%] Uploading ...`
- `[100%] Complete`
- or `[Error] ...`

### Polling/subscription success criteria

Treat report as finished when:

- `status` starts with `[100%] Complete`
- `s3_path` is non-null

Treat as failed when:

- `status` starts with `[Error]`

## 6) Recommended client safeguards

- Validate `postIds` as 24-char hex strings before sending.
- Normalize `reportFormat` to lowercase (`pdf`/`docx`).
- Prevent duplicate SQS sends for same `report_hash` while a request is already in-progress.
- Use timeout/retry logic in UI polling and show latest `status` text directly in progress UI.
