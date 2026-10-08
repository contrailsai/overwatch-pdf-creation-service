# UI Guide: Requesting Report Generation

This is the canonical client-side flow for creating reports with the PDF service.

## 1) Valid payload contract

The SQS `body` must be a JSON object with this structure:

```json
{
  "projectId": "ICICI",
  "entityType": "posts",
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

Ads example:

```json
{
  "projectId": "SEBI",
  "entityType": "ads",
  "adIds": ["6a7d79609b3282bb5130f160", "6a7d79869b3282bb5130f164"],
  "database_name": "SEBI-Data-Search",
  "reportType": "Summary",
  "reportFormat": "pdf",
  "project": {
    "project_name": "SEBI",
    "project_details": { "labels": [], "legal_codes": [] }
  },
  "profile": null
}
```

Domains example:

```json
{
  "projectId": "SEBI",
  "entityType": "domains",
  "domainIds": ["6a8be234abdd8b24b75f1761"],
  "variantKeysByDomainId": { "6a8be234abdd8b24b75f1761": "bare" },
  "database_name": "SEBI-Data-Search",
  "reportType": "Detailed",
  "reportFormat": "pdf",
  "project": {
    "project_name": "SEBI",
    "project_details": { "labels": [], "legal_codes": [] }
  },
  "profile": null
}
```

Ad profiles example (layout is automatic: 1 id → single dossier, 2+ ids → combined catalog):

```json
{
  "projectId": "SEBI",
  "entityType": "ad_profiles",
  "adProfileIds": ["6a9fb9abc911dc2962ccf3ef", "6a7db28d7f82a0c5cc92af3e"],
  "database_name": "SEBI-Data-Search",
  "reportType": "Summary",
  "reportFormat": "pdf",
  "project": {
    "project_name": "SEBI",
    "project_details": { "labels": [], "legal_codes": [] }
  },
  "profile": null
}
```

Apps example (Google Play / App Store listings; unreviewed apps still render):

```json
{
  "projectId": "SEBI",
  "entityType": "apps",
  "appIds": ["6ab65e0648deed136101ed92", "6aba06a4e8c8fd9c21da915f"],
  "database_name": "SEBI-Data-Search",
  "reportType": "Detailed",
  "reportFormat": "pdf",
  "project": {
    "project_name": "SEBI",
    "project_details": { "labels": [], "legal_codes": [] }
  },
  "profile": null
}
```

Telegram groups example (unreviewed groups still render; messages/people are never included):

```json
{
  "projectId": "VFS",
  "entityType": "telegram_groups",
  "telegramGroupIds": ["6aaffc52f2b0ece71b21f83f", "6ab005f9f2b0ece71b21fb7e"],
  "database_name": "VFS-Data-Search",
  "reportType": "Detailed",
  "reportFormat": "pdf",
  "project": {
    "project_name": "VFS",
    "project_details": { "labels": [], "legal_codes": [] }
  },
  "profile": null
}
```

### Required fields

- `projectId`: string
- `database_name`: string
- `entityType`: `posts` (default), `ads`, `domains`, `ad_profiles`, `apps`, or `telegram_groups`. If omitted and `adProfileIds` is present, treat as `ad_profiles`. If omitted and `adIds` is present, treat as `ads`. If omitted and `domainIds` is present, treat as `domains`. If omitted and `appIds` is present, treat as `apps`. If omitted and `telegramGroupIds` is present, treat as `telegram_groups`.
- IDs: posts use `postIds`. Ads use `adIds` (or `postIds` when `entityType` is `ads`). Domains use `domainIds` (or `postIds` when `entityType` is `domains`). Ad profiles use `adProfileIds` (or `postIds` when `entityType` is `ad_profiles`). Apps use `appIds` (or `postIds` when `entityType` is `apps`). Telegram groups use `telegramGroupIds` (or `postIds` when `entityType` is `telegram_groups`). Non-empty array of valid Mongo ObjectId strings.
- `variantKeysByDomainId`: required for domains. Map of domain id → cloak variant `label` (`bare` or a param like `pEl8X=MI1_HT2`). Included in the cache hash so Bare vs a param does not reuse the wrong file. **Not** used for ad profile or apps reports.
- `reportType`: one of `Detailed | Single | Profile | SimpleProfile | SimpleCase | Summary`
- `reportFormat`: `pdf` or `docx` (default should be `pdf` if omitted client-side)

### Important format rules

- `docx` supports only: `Detailed | Single | Profile | SimpleProfile | SimpleCase` (not `Summary`).
- `SimpleProfile` and `SimpleCase` are DOCX-only — `reportFormat` must be `docx`.
- Ads reports support `Summary` and `Detailed` only, and **PDF only** (no DOCX, Profile, Single, or SimpleCase in v1).
- Domain reports support `Summary` and `Detailed` only, and **PDF only**. One-domain export is `Detailed` with a single id. Unreviewed domains are skipped; if none remain, the job fails.
- Ad profile reports support **`Summary` only** (PDF only). Collection is `Ad_profiles` (capital A). Unreviewed profiles are skipped; nested ads/domains must be reviewed (`list.reviewed_at`). Ads table is capped at 20 (metrics still use all reviewed ads). **Layout is chosen by ID count after review filter:** exactly **1** reviewed profile → single dossier (`AdsProfileReport`); **2+** → combined catalog (`AdsProfilesSummaryReport`). Do not send `Detailed` for ad profiles.
- App reports support `Summary` and `Detailed` only, and **PDF only**. Collection is `Apps` (capital A); `App_developers` is joined automatically. **Unreviewed apps are not skipped** — they render with an `Unreviewed` badge, so no review step is required before exporting. Screenshots are capped at 6 and evidence images at 16 (6 per section).
- Telegram group reports support `Summary` and `Detailed` only, and **PDF only**. Collection is `Telegram_groups` (capital `T`, lowercase `g`); `case_events` with `entity_type: 'telegram_group'` feed the update history. **Unreviewed groups are not skipped** — they render with an `Unreviewed` badge. Only aggregate counts (participants, messages) are shown; messages and member profiles are never read or rendered. There is no Evidence section and no developer section.
- For posts `Profile` and `SimpleProfile` reports, send a proper `profile` object (including `_id`), because profile ID is part of hash generation.- `project` should be an object (not array) if you want proper branding/org metadata in report generation.

## 2) Client-side hash generation (must match backend exactly)

Backend hash is deterministic SHA-256 over this exact raw string:

- Posts: `{projectId}-{sortedIdsCsv}-{reportType}-{profileId}-{reportFormat}`
- Ads: `{projectId}-{sortedIdsCsv}-{reportType}-{profileId}-{reportFormat}-ads`
- Domains: `{projectId}-{sortedIdsCsv}-{reportType}-{profileId}-{reportFormat}-domains-{extra}`
- Ad profiles: `{projectId}-{sortedIdsCsv}-{reportType}-{profileId}-{reportFormat}-ad_profiles`
- Apps: `{projectId}-{sortedIdsCsv}-{reportType}-{profileId}-{reportFormat}-apps`
- Telegram groups: `{projectId}-{sortedIdsCsv}-{reportType}-{profileId}-{reportFormat}-telegram_groups`

Where `extra` is the sorted `id=variantKey` pairs joined with `|`.

The `-ads` / `-domains` / `-ad_profiles` / `-apps` / `-telegram_groups` suffix is required so the client cache key matches Lambda. Posts hashes must **not** gain a suffix. Domain lander keys are required so Bare vs a param does not reuse the wrong file.

Where:

- Entity IDs (`postIds`, `adIds`, `domainIds`, `adProfileIds`, `appIds`, or `telegramGroupIds`) are sorted lexicographically before hashing.
- `profileId` is `profile?._id` or empty string (domains, ad profiles, apps, and Telegram groups always send `null` profile, so the raw string contains `--`).
- `reportFormat` is usually `pdf` or `docx`.
- `entityType` defaults to `posts`. Only non-`posts` types append `-{entityType}`.

Use this exact implementation:

```ts
import { createHash } from "crypto";

export function generateReportHash(input: {
  projectId: string;
  postIds?: string[];
  adIds?: string[];
  domainIds?: string[];
  adProfileIds?: string[];
  appIds?: string[];
  telegramGroupIds?: string[];
  variantKeysByDomainId?: Record<string, string>;
  entityType?: "posts" | "ads" | "domains" | "ad_profiles" | "apps" | "telegram_groups";
  reportType: "Detailed" | "Single" | "Profile" | "SimpleProfile" | "SimpleCase" | "Summary";
  reportFormat?: "pdf" | "docx";
  profile?: { _id?: string | null } | null;
}) {
  const reportFormat = input.reportFormat ?? "pdf";
  const profileId = input.profile?._id ?? "";
  const entityType =
    input.entityType ??
    (input.adProfileIds?.length
      ? "ad_profiles"
      : input.domainIds?.length
        ? "domains"
        : input.adIds?.length
          ? "ads"
          : input.appIds?.length
            ? "apps"
            : input.telegramGroupIds?.length
              ? "telegram_groups"
              : "posts");
  const ids =
    entityType === "ads"
      ? (input.adIds?.length ? input.adIds : input.postIds)
      : entityType === "domains"
        ? (input.domainIds?.length ? input.domainIds : input.postIds)
        : entityType === "ad_profiles"
          ? (input.adProfileIds?.length ? input.adProfileIds : input.postIds)
          : entityType === "apps"
            ? (input.appIds?.length ? input.appIds : input.postIds)
            : entityType === "telegram_groups"
              ? (input.telegramGroupIds?.length ? input.telegramGroupIds : input.postIds)
              : input.postIds;
  const sortedIds = [...(ids ?? [])].sort();
  const entitySuffix = entityType !== "posts" ? `-${entityType}` : "";
  let raw = `${input.projectId}-${sortedIds.join(",")}-${input.reportType}-${profileId}-${reportFormat}${entitySuffix}`;
  if (entityType === "domains") {
    const extra = [...(ids ?? [])]
      .map((id) => `${id}=${input.variantKeysByDomainId?.[id] || ""}`)
      .sort()
      .join("|");
    raw = `${raw}-${extra}`;
  }
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

- `[10%] Fetching posts from DB` (ads: `Fetching ads from DB`; domains: `Fetching domains from DB`; ad profiles: `Fetching ad profiles from DB`; apps: `Fetching apps from DB`; Telegram groups: `Fetching Telegram groups from DB`)
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

- Validate `postIds` / `adIds` / `domainIds` / `appIds` as 24-char hex strings before sending.
- For ads, send `entityType: "ads"` and compute the hash with the `-ads` suffix.
- For domains, send `entityType: "domains"`, `variantKeysByDomainId`, and compute the hash with the `-domains-{extra}` suffix.
- For ad profiles, send `entityType: "ad_profiles"`, `adProfileIds`, `reportType: "Summary"`, and compute the hash with the `-ad_profiles` suffix. Layout is automatic from ID count (1 vs 2+).
- For apps, send `entityType: "apps"`, `appIds`, `reportType: "Summary"` or `"Detailed"`, and compute the hash with the `-apps` suffix. No review step is needed — unreviewed apps render with an `Unreviewed` badge.
- For Telegram groups, send `entityType: "telegram_groups"`, `telegramGroupIds`, `reportType: "Summary"` or `"Detailed"`, and compute the hash with the `-telegram_groups` suffix. No review step is needed — unreviewed groups render with an `Unreviewed` badge.
- Normalize `reportFormat` to lowercase (`pdf`/`docx`).
- Prevent duplicate SQS sends for same `report_hash` while a request is already in-progress.
- Use timeout/retry logic in UI polling and show latest `status` text directly in progress UI.
