# Deployment — Docker → ECR → Lambda (arm64)

The service ships as a **container image Lambda**, not a zip. Deployment is: build a `linux/arm64` image, push it to ECR, point the function at the new image URI.

---

## 1. Why a container, and why arm64

`sharp` links native `libvips` binaries. A locally built image for the wrong CPU architecture installs fine and then crashes at runtime inside Lambda. The `Dockerfile` therefore forces the target platform at install time:

```dockerfile
FROM public.ecr.aws/lambda/nodejs:20

ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1
ENV npm_config_arch=arm64
ENV npm_config_platform=linux

COPY package*.json ./
RUN npm install

COPY . .

CMD ["src/index.handler"]
```

| Line | Why it matters |
| --- | --- |
| `public.ecr.aws/lambda/nodejs:20` | AWS base image; provides the Lambda Runtime Interface Client that `CMD` addresses |
| `SHARP_IGNORE_GLOBAL_LIBVIPS=1` | Prevents `sharp` from trying to link a system libvips that does not exist in the image |
| `npm_config_arch=arm64` / `npm_config_platform=linux` | Makes `npm install` fetch the `linux/arm64` prebuilt `sharp`. **These must match the target architecture** |
| `npm install` before `COPY . .` | Keeps the dependency layer cached across source-only changes |
| `CMD ["src/index.handler"]` | Lambda handler convention: `<file>.<export>` |

Because `@babel/register` transpiles JSX **at runtime**, `src/` must be in the image — there is no compile step that could strip it.

> **Build with `--provenance=false`.** Buildx provenance attestations produce an OCI manifest list that Lambda's image validation rejects. `running_steps.txt` and `CREATION STEPS.md` both include the flag for this reason.

---

## 2. Build and push

Parameterised version (preferred — `CREATION STEPS.md`):

```bash
export AWS_ACCOUNT_ID="<aws-account-id>"
export AWS_REGION="ap-south-1"
export ECR_REPOSITORY="overwatch-pdf-creation"
export IMAGE_TAG="latest"
export LAMBDA_FUNCTION_NAME="overwatch-report-generation"
export IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG"

# 1. Build for the Lambda architecture
docker build --platform linux/arm64 --provenance=false -t "$IMAGE_URI" .

# 2. Authenticate to ECR (re-run whenever the token expires)
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

# 3. Push
docker push "$IMAGE_URI"

# 4. Point the function at the new image
aws lambda update-function-code --function-name "$LAMBDA_FUNCTION_NAME" --image-uri "$IMAGE_URI"
```

Concrete values currently in `running_steps.txt` (account `992382580458`, region `ap-south-1`, repo `overwatch-pdf-creation`, function `overwatch-report-generation`). Prefer the parameterised form so the account id is not hardcoded in a tracked file.

Verify the roll-out:

```bash
aws lambda get-function --function-name "$LAMBDA_FUNCTION_NAME" \
  --query 'Configuration.[LastUpdateStatus,State,CodeSha256,RevisionId]' --output json
aws lambda wait function-updated --function-name "$LAMBDA_FUNCTION_NAME"
```

---

## 3. Function configuration

| Setting | Recommendation | Reason |
| --- | --- | --- |
| Architecture | **arm64** | Matches the image; ~20% cheaper than x86_64 |
| Memory | **4096–8192 MB** | `@react-pdf/renderer` holds a large in-memory document before flushing; low memory shows up as OOM kills, not clean errors. Memory also scales CPU, which matters for `sharp` |
| Timeout | **5–15 minutes** | A 1,200+ case report with image downloads is slow; see the SQS note below |
| Ephemeral storage | ≥ 512 MB, **1024–2048 MB** for large batches | Image cache lives in `/tmp/images`; every downloaded image is written before `sharp` reads it |
| Environment | Mongo / S3 / Supabase / OTEL vars | See below |
| Reserved concurrency | ≥ 1 | Image generation is memory-hungry; cap concurrency to protect the cluster |

Only `/tmp` is writable. `IMAGE_CACHE_DIR` defaults to `/tmp/images` for exactly this reason — do not point it at a repo-relative path in Lambda.

### Environment variables

Set on the function, not baked into the image (`.env` is in `.dockerignore`):

```
MONGO_URI
AWS_BUCKET_NAME   (or AWS_S3_BUCKET)
AWS_REGION
SUPABASE_URL
SUPABASE_KEY
OTEL_SERVICE_NAME=overwatch-pdf-service
OTEL_EXPORTER_OTLP_ENDPOINT
OTEL_EXPORTER_OTLP_HEADERS
OTEL_EXPORTER_OTLP_PROTOCOL
IMAGE_CACHE_DIR=/tmp/images
IMAGE_FETCH_TIMEOUT_MS=8000
IMAGE_FETCH_MAX_RETRIES=2
```

Do **not** set `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` on the function — use the execution role. Full reference: [connectivity.md §8](./connectivity.md#8-environment-matrix).

### IAM

The execution role needs:

- `s3:GetObject` on the media buckets the tenant data references (the SEBI/Ambani samples read from `cxo-demo`)
- `s3:PutObject` on `reports/*` of the output bucket
- `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:GetQueueAttributes` on the trigger queue
- ECR pull is handled by the Lambda service, not the role
- If the Mongo cluster uses IP allow-listing, Lambda's egress IPs must be allowed — a VPC-attached function needs a NAT gateway for public endpoints

---

## 4. SQS trigger

Attach the queue as an event source mapping. Tuning that matters:

| Setting | Value | Why |
| --- | --- | --- |
| Visibility timeout | **≥ 6× the function timeout** | The handler does **not** re-throw per-record failures, so a mid-flight redelivery of a long render is wasteful and can produce duplicate work |
| Batch size | Start at **1–5** | The handler loops `event.Records` sequentially. A big batch multiplies the wall-clock time and the memory pressure |
| `ReportBatchItemFailures` | Not implemented | Partial-batch failure responses are not returned. Successful records are not deleted early either, so a whole-batch retry re-runs completed work |
| DLQ | Recommended | Since failed records are swallowed and logged, without a DLQ the only record of a failure is in CloudWatch and the `[Error]` status row |

The `[Error]` status written to Supabase is the primary failure signal to the UI. See [architecture.md §3](./architecture.md#failure-isolation).

---

## 5. Observability in production

- `OTEL_SERVICE_NAME` must stay `overwatch-pdf-service` (or a deliberate rename) so Grafana service graphs and dashboards keep matching.
- The histogram to watch is **`generate_pdf_duration_seconds`**, split by `report.type` and `status`. A rising failure rate with flat duration usually means data/validation; a rising duration with stable failures means image fetch or memory pressure.
- `telemetry.forceFlush()` is awaited in the handler's `finally`, so metrics are not lost to container freeze. If metrics are missing entirely, check the OTLP endpoint and headers first.
- Useful CloudWatch searches: `Failed to fetch image`, `[Fallback Triggered]`, `[Irrecoverable]`, `No reviewed`, `is not supported`, `Invalid payload`.

---

## 6. Pre-deploy checklist

- [ ] `npm test` passes (77 tests)
- [ ] `.env` values are reflected in the Lambda function configuration
- [ ] `public/logo_txt.svg` is present in the build context — it is tracked in git and required for every PDF
- [ ] Sample payloads for each changed report type were generated locally via the dev server and inspected
- [ ] `docker build --platform linux/arm64 --provenance=false` succeeds locally
- [ ] `LastUpdateStatus` is `Successful` after `update-function-code`
- [ ] One real SQS message is sent and its `reports_generation` row reaches `[100%] Complete` with an `s3_path`
- [ ] The `s3_path` object downloads and opens

---

## 7. Rollback

Images are immutable per digest. To roll back:

```bash
# Find the previous image URI
aws lambda get-function --function-name "$LAMBDA_FUNCTION_NAME" --query 'Code.ImageUri'

# Point at a previously known-good tag or digest
aws lambda update-function-code --function-name "$LAMBDA_FUNCTION_NAME" \
  --image-uri "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/overwatch-pdf-creation:<previous-tag>"
```

Because `reportHash` is deterministic, a rollback changes how documents look but **not** their S3 keys — existing cached objects are served from Supabase until deleted. After a layout-only rollback, clear the affected `reports_generation` rows or delete the objects to force regeneration.

---

## 8. Deployment gaps worth closing

| Gap | Impact |
| --- | --- |
| No CI/CD — deploy is manual `docker build` + `push` + `update-function-code` | Easy to ship an unbuilt or wrong-architecture image |
| No `--provenance=false` in a scripted pipeline; it is only in prose docs | A plain `docker buildx build` produces a rejected manifest |
| Hardcoded account id in `running_steps.txt` | Not portable; prefer `CREATION STEPS.md` |
| No image tagging scheme (only `latest`) | Rollback depends on someone having noted a digest |
| No DLQ or partial-batch failure reporting | Failed documents are invisible outside CloudWatch |

See [roadmap.md](./roadmap.md) for the tracked backlog.
