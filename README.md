# Overwatch PDF Creation Service

Standalone, event-driven backend service that renders **PDF and DOCX reports** for the Overwatch platform. It runs as a Dockerised AWS Lambda triggered by SQS, reads source data from MongoDB, pulls media from S3, reports progress to Supabase, and writes the finished document back to S3.

---

## How it works

```
UI ──SQS──▶ Lambda (Docker, arm64) ──▶ MongoDB   (posts / ads / domains / ad profiles)
                    │                 ──▶ S3      (media images, resized via sharp)
                    │                 ──▶ Supabase (reports_generation progress)
                    └──▶ S3 reports/<reportHash>.pdf|docx
                          + OpenTelemetry → Grafana
```

1. An SQS message body is parsed and validated.
2. The `entityType` decides which collections are read, joined, and review-filtered.
3. Images are downloaded from S3, resized to 800 px via `sharp`, and cached in `/tmp/images`.
4. The matching renderer produces a PDF stream (`@react-pdf/renderer`) or a DOCX buffer (`docx`).
5. **PDFs get a Contrails watermark**; DOCX does not.
6. The document is uploaded to `reports/<reportHash>.pdf|docx` and the Supabase row is set to `[100%] Complete`.

Full detail: [docs/architecture.md](docs/architecture.md) · [docs/connectivity.md](docs/connectivity.md)

---

## Report types

`reportType` selects the document; `entityType` selects the data family. Not every combination is valid.

| `entityType` | Supported `reportType` | Formats |
| --- | --- | --- |
| `posts` (default) | `Detailed`, `Single`, `Profile`, `SimpleProfile`\*, `SimpleCase`\*, `Summary` | PDF + DOCX\* |
| `ads` | `Summary`, `Detailed` | PDF only |
| `domains` | `Summary`, `Detailed` | PDF only |
| `ad_profiles` | `Summary` (layout chosen by reviewed-profile count: 1 → dossier, 2+ → catalog) | PDF only |

\* `SimpleProfile` and `SimpleCase` are **DOCX-only**. Posts `Summary` is **PDF-only**.

The complete matrix, validation rules, data sources, filters, and image-pipeline behaviour per branch: **[docs/report-catalog.md](docs/report-catalog.md)**.
What each document actually looks like — palettes, badges, sections: **[docs/report-themes.md](docs/report-themes.md)**.

---

## Quick start

```bash
npm install
```

Create a `.env` at the repo root:

```bash
MONGO_URI=mongodb+srv://…
AWS_ACCESS_KEY_ID=…
AWS_SECRET_ACCESS_KEY=…
AWS_REGION=ap-south-1
AWS_S3_BUCKET=…
# Optional — without these, progress updates are skipped silently
SUPABASE_URL=…
SUPABASE_KEY=…
```

Run the local test server (same pipeline as Lambda, HTTP in, file out):

```bash
npm run dev:reports     # http://127.0.0.1:3847

curl -X POST http://localhost:3847/ -H "Content-Type: application/json" \
  -d @samples/messages/sample_sqs_message_ambani_v2.json
```

Generated files land in `./local-reports/output/`. [`samples/messages/`](samples/messages) holds a ready-to-post payload for every report family — `HOW_TO_TEST_PDFS.md` lists a curl for each; [docs/local-testing.md](docs/local-testing.md) covers endpoints, env vars and troubleshooting.

### Tests

```bash
npm test                # 77 tests: unit + renderer integration
npm run test:unit
npm run test:integration
```

The suite uses in-memory fixtures and needs no Mongo, S3, or network access.

---

## Deploy

Container image Lambda on **arm64**. `sharp` binaries are architecture-specific, so the image must be built for the target platform.

```bash
export AWS_ACCOUNT_ID="…" AWS_REGION="ap-south-1"
export IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/overwatch-pdf-creation:latest"

docker build --platform linux/arm64 --provenance=false -t "$IMAGE_URI" .
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
docker push "$IMAGE_URI"
aws lambda update-function-code --function-name overwatch-report-generation --image-uri "$IMAGE_URI"
```

Function requirements, IAM, SQS tuning, rollback and a pre-deploy checklist: **[docs/deployment.md](docs/deployment.md)**.

---

## Repository layout

```
src/
  index.js                 Lambda handler — parse, validate, trace, run
  report-job.js            the pipeline: DB → images → render → persist
  core-utils.js            validation, hash, normalizers, media resolution
  domain-display.js        domain/lander logic, screenshot slicing
  s3.js  mongo.js  supabase.js  instrumentation.js  pdf-watermark.js
  dev-report-server.js     local HTTP harness
  components/              PDF documents (@react-pdf/renderer)
  components/docx/         DOCX generators (docx)
docs/                      documentation set — start at docs/README.md
test/                      unit + integration tests and fixtures
samples/
  messages/                ready-to-post SQS payloads + sample curl script
  schemas/                 example MongoDB documents per collection (posts, profiles, …)
public/fonts/              Outfit, Mukta, and emoji assets
```

---

## Documentation

Start at **[docs/README.md](docs/README.md)** for the full index.

| | |
| --- | --- |
| [Architecture](docs/architecture.md) | Pipeline, modules, caching, telemetry |
| [Connectivity](docs/connectivity.md) | Mongo, S3, Supabase, SQS, OpenTelemetry |
| [Report catalog](docs/report-catalog.md) | Routing matrix and validation rules |
| [Report themes](docs/report-themes.md) | Visual design per report type |
| [Local testing](docs/local-testing.md) | Dev server and test suite |
| [Samples](samples/README.md) | Sample payloads and collection documents |
| [Deployment](docs/deployment.md) | Docker → ECR → Lambda |
| [Roadmap](docs/roadmap.md) | Pending tasks and future improvements |
| [UI request flow](docs/ui-report-request-flow.md) | Payload + hash contract for clients |

---

## Known gaps

- Failed SQS records are logged and skipped, so the queue does not retry them — the `[Error]` row in Supabase is the only signal.
- There is no CI/CD; deploy is a manual image build and push.
- There is no shared theme module — two incompatible palettes have grown side by side across the renderers.
- Ads, domains and ad profiles are PDF-only; posts carousels render only their first image.

See [docs/roadmap.md](docs/roadmap.md) for the full backlog with severity and effort.
