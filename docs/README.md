# Overwatch PDF Service — Documentation

Index of the documentation set. Start here.

---

## Orientation

| Doc | What it answers |
| --- | --- |
| [architecture.md](./architecture.md) | How the service is put together: the SQS → Lambda pipeline, module map, request lifecycle, normalisation boundary, caching, telemetry |
| [connectivity.md](./connectivity.md) | Every external system: **MongoDB**, **S3**, **Supabase**, **SQS**, **OpenTelemetry** — config, queries, failure behaviour, env matrix |
| [deployment.md](./deployment.md) | How it ships: Docker → ECR → **AWS Lambda (arm64)**, function/memory/queue tuning, IAM, rollback |

## Reports

| Doc | What it answers |
| --- | --- |
| [report-catalog.md](./report-catalog.md) | The **routing matrix** — which renderer runs for a given `entityType` × `reportType` × `reportFormat`. Validation rules, data sources and filters, image pipeline, failure modes, how to add a report type |
| [report-themes.md](./report-themes.md) | How each report **looks and works**: the two palettes, risk badge system, typography, section-by-section structure for every renderer, DOCX themes, the watermark, and the recorded inconsistencies |

## Working on it

| Doc | What it answers |
| --- | --- |
| [local-testing.md](./local-testing.md) | The dev report server, the automated test suite, fixtures, direct renderer invocation, troubleshooting |
| [roadmap.md](./roadmap.md) | Pending tasks and future improvements, grouped by area with effort and severity |
| [../samples/README.md](../samples/README.md) | The `samples/` folder: ready-to-post SQS payloads and example collection documents |
| [../HOW_TO_TEST_PDFS.md](../HOW_TO_TEST_PDFS.md) | Copy-paste cheatsheet: every sample payload and its curl command |

## Incidents

Post-incident records and the runbooks that come out of them.

| Doc | What it answers |
| --- | --- |
| [incidents/2026-10-06-apps-eacces/README.md](./incidents/2026-10-06-apps-eacces/README.md) | **INC-2026-10-06-01** — the apps-report release broke every cold start with `EACCES: permission denied` on a `/var/task` source file. Full timeline, the five-condition root cause, evidence, and why Git could not catch it |
| [incidents/2026-10-06-apps-eacces/incident-response.md](./incidents/2026-10-06-apps-eacces/incident-response.md) | **Runbook** for any `EACCES`/`Permission denied` on a `/var/task` path: symptoms, 2-minute triage, remediation, pre-deploy image verification, rollback |

**If a deploy breaks every cold start with `EACCES` or `MODULE_NOT_FOUND` on `/var/task/...`, go straight to the runbook** — it is a build-artifact problem, not an application bug. Start with `npm run check:permissions`.

## Client integration

These are aimed at the UI team and are the **contract** the service depends on.

| Doc | What it answers |
| --- | --- |
| [ui-report-request-flow.md](./ui-report-request-flow.md) | Canonical payload contract, the client-side hash implementation that must match the backend byte for byte, the `reports_generation` lifecycle, SQS send, polling rules |
| [simple-case-report-ui-guide.md](./simple-case-report-ui-guide.md) | `SimpleCase` DOCX specifics (DOCX-only, minimal layout) |
| [simple-profile-report-ui-guide.md](./simple-profile-report-ui-guide.md) | `SimpleProfile` DOCX specifics (DOCX-only, numbered cases) |

## Historical

| Doc | Status |
| --- | --- |
| [../implementation_plan.md](../implementation_plan.md) | Historical. Describes the migration from Express/Redis/BullMQ to SQS + Lambda. The architecture it describes is what shipped, but the migration steps are done |
| [../plan.md](../plan.md) | Historical. The Meta Ads report plan. Its "not done" columns are now done |

Both are kept for context. Do not treat their status tables as current — see [report-catalog.md](./report-catalog.md) for what actually exists.

---

## The 60-second version

**What it is.** A standalone, event-driven report renderer. It owns no database and serves no HTTP in production. An SQS message arrives; a Dockerised arm64 Lambda renders a PDF or DOCX and writes it to S3, reporting progress to Supabase along the way.

**How a request flows.** SQS record → `validatePayload` → per-`entityType` Mongo reads + joins → S3 image download and `sharp` resize into `/tmp/images` → `@react-pdf/renderer` (or the `docx` package) → **watermark** (PDF only) → S3 → `[100%] Complete` in Supabase.

**The five entity types.** `posts` (the original, only one with DOCX), `ads`, `domains`, `ad_profiles`, `apps` (Google Play / App Store listings).

**The six report types.** `Detailed`, `Single`, `Profile`, `SimpleProfile` (DOCX-only), `SimpleCase` (DOCX-only), `Summary`. Not every entity type supports every type — the full matrix is in [report-catalog.md](./report-catalog.md).

**Two things that bite people:**

1. **The client must upsert the Supabase row before sending the SQS message.** The service only ever `update`s by `report_hash`; it never inserts. A missing row means generation succeeds invisibly.
2. **`reportHash` is a deterministic cache key and a client/server contract.** If the client's hash formula drifts from the backend's, the wrong cached document is served. The formula is in [ui-report-request-flow.md §2](./ui-report-request-flow.md#2-client-side-hash-generation-must-match-backend-exactly).

**Known rough edges.** Failed SQS records are swallowed rather than retried, there is no CI/CD, and there is no shared theme module — two incompatible palettes have grown side by side. All tracked in [roadmap.md](./roadmap.md).

---

## Conventions used in these docs

- **Exact strings are quoted.** Validation messages, status text, and section labels appear verbatim so you can grep for them in logs.
- **`reportType` values are capitalised** exactly as the code expects (`SimpleProfile`, not `simpleprofile`).
- **Collection names show exact casing** (`Posts`, `Ads`, `Ad_profiles`, `Domains`, `Apps`, `App_developers`) because casing is load-bearing.
- **File references** are relative to the repository root.
- Status text uses the literal bracketed form the service writes, e.g. `` `[30%] Processing Images` ``.
