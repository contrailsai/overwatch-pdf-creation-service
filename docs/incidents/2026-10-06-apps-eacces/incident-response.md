# Incident Response — `EACCES` on `/var/task` (unreadable build artifact)

Runbook for the failure class behind [INC-2026-10-06-01](./README.md): a file in the Lambda image is
not readable by the user the function runs as.

Applies to **any** `EACCES`/`Permission denied` on a `/var/task/...` path — not just this incident.

---

## 1. Recognise it

You are looking at this class of incident when the logs show:

```
ERROR Uncaught Exception
{"errorType":"Error","errorMessage":"EACCES: permission denied, open '/var/task/src/...'",
 "code":"EACCES","errno":-13,"syscall":"open","path":"/var/task/src/..."}
INIT_REPORT Init Duration: ... Phase: invoke Status: error Error Type: Runtime.Unknown
REPORT ... Status: error Error Type: Runtime.Unknown
```

Symptom signature — distinguish by these four tells:

| Tell | Meaning |
| --- | --- |
| `EACCES` (not `ENOENT`) | The file **exists**; the runtime just may not read it. `ENOENT` would be a missing file / bad `COPY` / `.dockerignore` mistake |
| Path starts with `/var/task/` | A **build artifact** problem, not application logic |
| `Phase: invoke Status: error Error Type: Runtime.Unknown` | The crash happened while loading modules, so Lambda never got to the handler |
| Works before the deploy, fails right after | The change is in what got copied into the image, not in the code's behaviour |

**Key discriminator:** if the stack contains `pirates/lib/index.js` and
`at Object.<anonymous> (/var/task/src/report-job.js:50:39)`, the failing read is the
`@babel/register` on-the-fly transpile of a source file. That is this incident's shape.

### Why it looks intermittent

Warm execution environments from the **previous** image keep working until Lambda drains them. Only
*new* cold-start sandboxes fail. So a total cold-start breakage presents as "some requests work,
some fail, since the deployment". Do not dismiss it as flakiness — check whether the failures are all
on new sandboxes (short `Init Duration`, `Phase: invoke`).

---

## 2. Triage (under 2 minutes)

Run these in order. Do not start reading application code.

```bash
# 2a. Which files in the build context are not group/other readable?
npm run check:permissions
```

- **Exit `1`** with a file list → you have found it. Go to §4.
- **Exit `0`** → the working tree is fine, so the bad mode is in the **image** or the image is stale.
  Continue.

The same scan runs automatically as `test/unit/file-permissions.test.js`, so a green `npm test` means
the working tree is clean. If `npm test` is failing on a permission assertion, you are already done
triaging.

```bash
# 2b. Inspect the exact file reported in the log, inside the image
docker run --rm --entrypoint /bin/sh <image-uri> -c \
  "ls -l /var/task/src/<path-from-the-error>"
```

- `-rw-------` (or anything without group/other read) → confirmed. Go to §4.
- `-rw-r--r--` → the mode is fine; go to §3 (different failure) and check `ENOENT`/stale image.

```bash
# 2c. Reproduce the production error locally as a non-root user
docker run --rm --user 993 --entrypoint /bin/sh <image-uri> -c \
  "cat /var/task/src/<path-from-the-error> >/dev/null && echo READ_OK || echo READ_FAILED"
```

`READ_FAILED` / `Permission denied` is a byte-for-byte reproduction of the production failure.

### Useful side checks

```bash
# Is the deployed image actually the one you think? (no chmod/COPY surprises)
docker inspect <image-uri> --format 'User={{.Config.User}} WorkingDir={{.Config.WorkingDir}} Cmd={{.Config.Cmd}}'

# Is the container root? If root can read the file but the function cannot,
# it is ownership/permission, not content or corruption.
docker run --rm --entrypoint /bin/sh <image-uri> -c "id"
```

### What it is NOT

Check these before assuming a permission problem:

| Observation | Actual cause |
| --- | --- |
| `ENOENT: no such file or directory` | Missing from the image — check `.dockerignore` and the `COPY` path |
| `Cannot find module 'x'` | Dependency not installed in the image, or `node_modules` accidentally excluded from the build context |
| `ERR_REQUIRE_ESM` / syntax errors | Real code/build problem |
| Timeout with no exception | Not this class — see the OpenTelemetry init-timeout note in the incident record |

---

## 3. If the mode is correct but it still fails

1. **Is the running image the image you built?** Confirm the function's `CodeSha256` / image URI and
   the `LastUpdateStatus`:
   ```bash
   aws lambda get-function --function-name "$LAMBDA_FUNCTION_NAME" \
     --query 'Configuration.[LastUpdateStatus,State,CodeSha256,RevisionId]' --output json
   aws lambda wait function-updated --function-name "$LAMBDA_FUNCTION_NAME"
   ```
2. **Is the file present in the image at all?**
   ```bash
   docker run --rm --entrypoint /bin/sh <image-uri> -c "ls -l /var/task/src/components/ | head -40"
   ```
   `/var/task` is the working directory in the Lambda base image. If the `COPY` landed somewhere else,
   nothing resolves.
3. **Did `.dockerignore` exclude it?** Current ignores are `./node_modules` and `.env`.
4. **Is it a symlink or a dangling path?** Modes are irrelevant if the target is missing.

---

## 4. Remediate

### 4a. Fix the working tree (the actual defect)

```bash
npm run check:permissions      # lists every unreadable file, exits 1
npm run fix:permissions        # chmod a+r the offenders, exits 0
npm run check:permissions      # verify: exits 0
```

Equivalent raw commands:

```bash
# list offenders (skips node_modules/.git and .env)
find . -path ./node_modules -prune -o -path ./.git -prune -o -name ".env" -prune -o \
  -type f ! -perm -044 -print

# repair — additive: adds group/other read, removes nothing
find . -path ./node_modules -prune -o -path ./.git -prune -o -name ".env" -prune -o \
  -type f ! -perm -044 -exec chmod a+r {} +
```

Use `chmod a+r` (**additive**) rather than `chmod 644`. Additive cannot drop the owner write bit or
clobber a deliberately-set mode; it just makes the file readable. Never widen `.env`.

### 4b. Confirm the Dockerfile guard is present

The guard makes the image safe regardless of the working tree, and is the reason this incident cannot
recur through the normal build path:

```dockerfile
COPY . .

RUN chmod -R a+rX /var/task

CMD ["src/index.handler"]
```

`a+rX` — read for everyone, and search/execute **only** on directories (`X`), so it never marks a
data file executable.

---

## 5. Deploy and verify

```bash
export AWS_ACCOUNT_ID="992382580458"
export AWS_REGION="ap-south-1"
export ECR_REPOSITORY="overwatch-pdf-creation"
export IMAGE_TAG="latest"
export LAMBDA_FUNCTION_NAME="overwatch-report-generation"
export IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG"

# 1. Preflight — cheap, and it is the whole point of this runbook
npm run check:permissions

# 2. Build for the Lambda architecture
docker build --platform linux/arm64 --provenance=false -t "$IMAGE_URI" .

# 3. Verify BEFORE pushing. Two checks:
#    (a) no file in the image is owner-only
docker run --rm --entrypoint /bin/sh "$IMAGE_URI" -c \
  "find /var/task -not -perm -044 -not -type d 2>/dev/null | grep -v node_modules; \
   ls -l /var/task/src/components/AppsSummaryReport.js"
#    (b) the exact failing operation — loading the module as a non-root user.
#        This mirrors what @babel/register does at cold start, so it reproduces
#        the production failure rather than approximating it.
SMOKE="require('@babel/register')({presets:['@babel/preset-env','@babel/preset-react'],extensions:['.js','.jsx'],cache:false});
       const m=require('/var/task/src/components/AppsSummaryReport');
       console.log('MODULE_LOADED export=' + typeof m.AppsSummaryReportDocument);"
docker run --rm --user 993 -w /var/task --entrypoint node "$IMAGE_URI" -e "$SMOKE"
# expect: MODULE_LOADED export=function
# broken image gives: Error: EACCES: permission denied, open
#   '/var/task/src/components/AppsSummaryReport.js'  at node:fs:448:20

# 4. Push
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
docker push "$IMAGE_URI"

# 5. Update the function
aws lambda update-function-code --function-name "$LAMBDA_FUNCTION_NAME" --image-uri "$IMAGE_URI"
aws lambda wait function-updated --function-name "$LAMBDA_FUNCTION_NAME"

# 6. Confirm a real cold start succeeds — do NOT accept "it works now" from a warm sandbox
```

> In step 3b, `--entrypoint node` and the trailing `-e` after the image name are Node's `--eval`,
> not Docker's `-e` env flag. It runs the module load in-process and needs no Mongo/S3 access.

Step 3 is the important addition: it catches this failure class **before** it reaches production, on
the exact artifact being shipped. Step 3b is the one that matters most — it exercises the
`@babel/register` source read that actually fails, so a green result is real evidence, not a proxy.

> **Always build with `--provenance=false`.** Buildx provenance attestations produce an OCI manifest
> list that Lambda's image validation rejects. This is unrelated to permissions but will also fail a
> deploy.

### Post-deploy smoke test

Send one real request (see [HOW_TO_TEST_PDFS.md](../../../HOW_TO_TEST_PDFS.md) for payloads) and
confirm:

- `REPORT ... Status: success`, and
- the `INIT_REPORT` line has `Phase: init Status: success` (not `timeout`), and
- a new artifact appears in S3 with the expected `[100%] Complete` status in Supabase.

Because warm sandboxes mask the failure, the smoke test is only meaningful on a **new** environment.
Force one by updating the function config (e.g. touch an env var) or by waiting out the warm pool, and
confirm the init phase itself is clean.

---

## 6. Rollback

If the new image cannot be made to work, point the function back at the last known-good image. There
is no data migration to reverse — the service is stateless and only reads Mongo/S3 and writes S3 +
Supabase status.

```bash
aws lambda update-function-code --function-name "$LAMBDA_FUNCTION_NAME" \
  --image-uri "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:<previous-tag>"
aws lambda wait function-updated --function-name "$LAMBDA_FUNCTION_NAME"
```

`latest` is mutable, so prefer immutable tags to keep rollback instant and unambiguous. Note that any
reports that failed **before** the rollback were dropped: failed SQS records are swallowed rather than
retried (see [roadmap.md](../../roadmap.md)), so those requests need to be re-sent by the client.

---

## 7. Prevention controls in place

| Control | Where | Catches |
| --- | --- | --- |
| `npm test` → `test/unit/file-permissions.test.js` | normal test suite, **automatic** | Bad modes in the working tree — no manual step required |
| `npm run check:permissions` | local, documented pre-deploy step | Same scan on demand, with the offender list and `--fix` |
| `RUN chmod -R a+rX /var/task` | [Dockerfile](../../../Dockerfile) | Bad modes that reach the build, whatever their origin |
| Pre-deploy image read test (§5 step 3) | runbook | Wrong modes in the final artifact |
| Cold-start smoke test (§5) | runbook | Anything that only fails on a new sandbox |

The test-suite control is the important one: it does not rely on anyone remembering a manual step.

### Why the existing feedback loops cannot catch this

- **Git cannot represent a non-executable mode difference.** Git stores only `100644` or `100755`;
  `0600` is recorded as `100644`. The mode therefore appears in **no diff**, survives every commit,
  and cannot be caught in code review. `git status` stays clean while the repo is broken.
- **Local runs cannot catch it.** The developer owns the file, so `0600` is readable locally. Only a
  **uid boundary** exposes it — which exists only inside the container. This is exactly why the
  regression test asserts on *permission bits* rather than on behaviour: behaviour is fine locally.
- **There is no CI/CD.** The image is built from a local working tree, so whatever modes that machine
  happens to have are what ships. Building from a clean checkout would have produced `0644` from git
  and hidden the bug — which is also why this needs an explicit check rather than relying on process.

### Known gap

There is still no CI, so the image is built from whatever local working tree exists. The controls above
are the substitute until the pipeline in [roadmap.md](../../roadmap.md) exists: `npm test` catches a bad
mode automatically, and `npm run check:permissions` remains the documented pre-build step.

---

## 8. Extending the script

`scripts/check-file-permissions.js` skips `node_modules`, `.git`, `.claude`, `local-reports` and
`.env`, and exits non-zero listing offenders. If a new directory is added to the build context, decide
whether it needs to be scanned (add to `SKIP_DIRS` if it should be ignored) — the walk visits
everything else in the repo by default.

---

## Related

- [INC-2026-10-06-01 incident record](./README.md) — full timeline, evidence and analysis
- [deployment.md](../../deployment.md) — build/push/update procedure
- [local-testing.md](../../local-testing.md) — local verification workflow
- [HOW_TO_TEST_PDFS.md](../../../HOW_TO_TEST_PDFS.md) — payloads for the post-deploy smoke test
