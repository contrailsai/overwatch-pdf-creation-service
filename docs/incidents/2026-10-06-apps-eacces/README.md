# INC-2026-10-06-01 — Apps report cold start fails with `EACCES`

| Field | Value |
| --- | --- |
| **ID** | INC-2026-10-06-01 |
| **Date** | 2026-10-06 |
| **Severity** | SEV-1 — total loss of report generation on new Lambda sandboxes |
| **Status** | Resolved |
| **Detected by** | User report ("getting this error since the last deployment") + CloudWatch `EACCES` exception |
| **Affected component** | `overwatch-report-generation` Lambda (container image, arm64, ap-south-1) |
| **Affected release** | Image `992382580458.dkr.ecr.ap-south-1.amazonaws.com/overwatch-pdf-creation:latest` built from commit `6ad78d4` |
| **Introduced by** | Commit `6ad78d4` "Add Apps Summary and Detailed PDF reports" |
| **Fixed in** | This commit (permission normalisation + Dockerfile guard + preflight check) |
| **Root cause class** | Build-artifact defect — file mode `0600` leaked into the image via `COPY`, unreadable at runtime |
| **Response runbook** | [incident-response.md](./incident-response.md) |

---

## Summary

Every new Lambda execution environment in the release built from commit `6ad78d4` died during
module load, before the handler ran:

```
ERROR Uncaught Exception
{"errorType":"Error",
 "errorMessage":"EACCES: permission denied, open '/var/task/src/components/AppsSummaryReport.js'",
 "code":"EACCES","errno":-13,"syscall":"open",
 "path":"/var/task/src/components/AppsSummaryReport.js"}
```

The three JavaScript files added by that commit were written to disk with Unix mode `0600`
(owner read/write only). Docker's `COPY . .` preserves mode bits, so they landed in the image as
`-rw------- root:root`. Lambda runs the function as a user that does **not** own those files, so
`fs.readFileSync` — called by the `@babel/register`/`pirates` require hook, which reads the raw
`src/**/*.js` source at runtime because this service has no compile step — failed with `EACCES`.

No code logic was wrong. The bug was a file permission that Git cannot represent, which is why it
cleared review, passed all 104 tests, and only surfaced in the deployed image.

---

## Impact

- **Total on cold start.** The `require` that failed is at module scope in `src/report-job.js`, which
  is itself required at module scope by `src/index.js`. The failure aborts the whole module graph, so
  **all entity types and all report types failed, not just `apps`.** A container that cannot load
  `index.js` cannot serve `posts`, `ads`, `domains` or `ad_profiles` either.
- **Appeared gradual, not instant.** Lambda keeps already-warm execution environments from the
  previous image alive until they are drained. Those kept generating reports successfully while every
  *new* sandbox failed, so the outage looked intermittent/"since the last deployment" rather than a
  hard cutover.
- **Every failed invocation burned full billed duration.** The two observed invocations billed
  `17,511 ms` and `3,589 ms` at 4,096 MB while producing nothing.
- **No data loss or corruption.** Failures occurred before any S3 write or Supabase status update, so
  no partial artifacts were produced. Affected requests stayed in their prior `reports_generation`
  state and need to be re-sent or replayed by the client.

---

## Timeline (UTC)

| Time | Event |
| --- | --- |
| ~13:0x | Image built from commit `6ad78d4` and pushed; Lambda switched to it. Source file mtimes inside the image record `13:05`–`13:07` |
| 13:26:22.939 | First observed cold start. `OpenTelemetry initialized` |
| 13:26:25.295 | `INIT_REPORT Init Duration: 10000.44 ms Phase: init Status: timeout` |
| 13:26:42.770 | `Uncaught Exception … EACCES … '/var/task/src/components/AppsSummaryReport.js'` |
| 13:26:42.814 | `INIT_REPORT … Phase: invoke Status: error Error Type: Runtime.Unknown`; billed `17,511 ms` |
| 13:28:14.008 | Second cold start, fresh sandbox — identical failure at `13:28:17.258`, billed `3,589 ms` |
| — | Reported to the team; reproduced and diagnosed locally |
| — | Fixed: modes corrected, Dockerfile guard added, preflight check added, image rebuilt and verified |

---

## Root cause

Five independent conditions had to line up. Each is verified below.

### 1. Three new files were created with mode `0600`

`git show --diff-filter=A 6ad78d4` lists eight files added by the commit. All eight were created with
`-rw-------`; three of them are required at runtime:

| File | Mode on disk | Required at runtime |
| --- | --- | --- |
| `src/components/AppsSummaryReport.js` | `0600` | **Yes** — `src/report-job.js:50` |
| `src/components/AppsDetailedReport.js` | `0600` | **Yes** — `src/report-job.js:51` |
| `src/components/appPdfShared.js` | `0600` | **Yes** — via both of the above |
| `test/unit/app-pdf-shared.test.js` | `0600` | No |
| `test/fixtures/v3/app.json`, `app_developer.json` | `0600` | No (test only) |
| `samples/messages/sample_sqs_message_sebi_apps_*.json` | `0600` | No |

Every pre-existing file in the repo is `0644`. The split is exactly *created* vs *edited*: files the
tooling **edited** (`src/index.js`, `src/report-job.js`, `src/core-utils.js`) kept their original
`0644`, while files the tooling **created** came out `0600`. That distinction is what makes the
failure look arbitrary.

### 2. `COPY . .` preserves the mode into the image

`Dockerfile` has no `chmod` and no `USER`. Docker copies the mode bits verbatim, so the image
contained `-rw------- 1 root root` for exactly those three files. Verified against the deployed image:

```
$ docker run --rm --entrypoint /bin/sh <image> -c \
    "ls -l /var/task/src/components/AppsSummaryReport.js /var/task/src/components/AdsSummaryReport.js"
-rw-r--r-- 1 root root 17504 /var/task/src/components/AdsSummaryReport.js
-rw------- 1 root root 12393 /var/task/src/components/AppsSummaryReport.js
```

This is the decisive evidence: the broken file differs from the working file **only by permission bits**.

### 3. The file is `require`d at module scope

```js
// src/report-job.js:50
const { AppsSummaryReportDocument } = require('./components/AppsSummaryReport');
```

```js
// src/index.js:19
const { runReportJob } = require('./report-job');
```

Both are top-level `require`s, so the failure happens while the module graph is being built — before
`exports.handler` exists. Lambda reports this as `Runtime.Unknown` on the **invoke** phase, which
points away from the handler and toward the runtime itself.

### 4. There is no compile step, so source is read at runtime

`src/index.js` registers Babel at runtime:

```js
require('@babel/register')({
  presets: ['@babel/preset-env', '@babel/preset-react'],
  extensions: ['.js', '.jsx'],
  cache: false, // Disable cache to prevent permission warnings in Lambda
});
```

`@babel/register` installs its hook through `pirates`, which calls `fs.readFileSync` on the file being
required to transpile the JSX on the fly. The stack trace proves the path:

```
at Object.readFileSync (node:fs:448:20)
at loadSource (node:internal/modules/cjs/loader:1548:17)
at Object.newLoader [as .js] (/var/task/node_modules/pirates/lib/index.js:134:7)
```

Because the sources themselves are the shipped artifact, a source file the runtime cannot read is
equivalent to a missing file. (Note `cache: false` is deliberate — it avoids a *different* Lambda
permission problem with the Babel cache file, which is why the raw-source read is on the critical path.)

### 5. Lambda does not run the function as the file owner

The files are `root:root`; the function executes as a non-root user. Owner-only read is therefore
fatal. Reproduced locally by dropping the image to an arbitrary non-root uid:

```
$ docker run --rm --user 993 --entrypoint /bin/sh <image> -c \
    "cat /var/task/src/components/AppsSummaryReport.js >/dev/null; \
     cat /var/task/src/components/AdsSummaryReport.js >/dev/null"
cat: /var/task/src/components/AppsSummaryReport.js: Permission denied   # <- the production error
```

`EACCES` as root is a useful check here: if you can read the file as root inside the image, the
problem is ownership/permission, not content.

---

## Why this was invisible before deploy

| Layer | Why it caught nothing |
| --- | --- |
| `git status` / diff / review | **Git only tracks `100644` and `100755`.** A `0600` file is stored as `100644`, so the mode appears in no diff and survives every commit. `git ls-files -s` shows `100644` for all three broken files |
| Local runs and `npm test` | The developer **owns** the file, so `0600` is readable. All 104 tests pass, `npm run dev:reports` works |
| `npm install` / Docker dependency layer | Nothing installs or inspects these files |
| Lambda warm environments | Old sandboxes keep serving the previous image, masking a total cold-start failure as flakiness |
| Deployment | Manual `docker build` → `docker push` → `update-function-code`; no CI/CD, no pre-push check, no post-deploy smoke test |

The failure requires precisely the condition the developer's machine never reproduces: **a uid
boundary between file owner and reader.**

---

## Resolution

Shipped in this commit:

1. **Corrected the modes** — `chmod a+r` applied to all 17 files that were not group/other readable
   (additive; no owner bits were removed). All repo files are now `0644`.
2. **Dockerfile guard** — `RUN chmod -R a+rX /var/task` after `COPY . .`, so a bad mode on any future
   file cannot break the deploy even if step 1 is missed. `a+rX` adds read for everyone and
   search only for directories.
3. **Preflight check** — `scripts/check-file-permissions.js`, exposed as
   `npm run check:permissions` (fails the shell with a non-zero exit) and
   `npm run fix:permissions` (repairs). Scans the build context, skips `node_modules`, `.git`,
   `.claude`, `local-reports` and `.env`.
4. **Automated regression test** — `test/unit/file-permissions.test.js` runs the same scan as part of
   the normal suite, so `npm test` fails on a bad mode without anyone needing to remember the manual
   preflight step.
5. **This incident record and the [response runbook](./incident-response.md)**, linked from
   [docs/README.md](../../README.md) and [deployment.md](../../deployment.md).

---

## Verification

Performed locally; see the runbook for the full command list.

| Check | Result |
| --- | --- |
| `find . -type f ! -perm -044` after the fix | No matches — no unreadable files remain in the repo |
| `npm run check:permissions` before the fix | Exit `1`, listing offenders (e.g. `0600 scripts/check-file-permissions.js`) |
| `npm run fix:permissions` | Exit `0`, `Fixed N file(s) with chmod a+r` |
| `npm run check:permissions` after the fix | Exit `0`, `OK: every file in the build context is group/other readable.` |
| **Old image** — `require('…/AppsSummaryReport')` as uid 993 | **`EACCES: permission denied, open '/var/task/src/components/AppsSummaryReport.js'` at `node:fs:448:20` / `loader:1548:17` / `loader:1617:44` — the production stack trace reproduced exactly** |
| **New image** — same command, same uid | `MODULE_LOADED export=function`, exit `0` |
| Image rebuilt with the guard — `ls -l` inside image | All `src/components/*.js` `-rw-r--r--`; `find /var/task -not -perm -044` returns nothing |
| `npm test` with a bad mode present | Fails, naming the file: `0600 test/unit/file-permissions.test.js` |
| `npm test` after `fix:permissions` | **105 tests pass, 0 fail** |

The before/after module-load test is the strongest evidence: it reproduces the failing operation
itself (the `@babel/register` read of the source), not a proxy for it, and the old image's line
numbers match the production stack trace one-for-one.

> **Not yet done:** pushing the corrected image to ECR and updating the function
> (`aws lambda update-function-code`). That is the remaining production step and belongs to the
> deploy owner — see [incident-response.md §5](./incident-response.md#5-deploy-and-verify).

---

## Actions

| # | Action | Owner | Status |
| --- | --- | --- | --- |
| 1 | `chmod a+r` all unreadable repo files | — | **Done** |
| 2 | `RUN chmod -R a+rX /var/task` in the Dockerfile | — | **Done** |
| 3 | `npm run check:permissions` preflight script | — | **Done** |
| 4 | Automated regression test wired into `npm test` | — | **Done** |
| 5 | Incident record + response runbook | — | **Done** |
| 6 | Run `npm run check:permissions` as a documented pre-deploy step | — | **Done** ([deployment.md](../../deployment.md)) |
| 7 | Rebuild, push, update the Lambda, confirm a real cold start | deploy owner | **Pending** |
| 8 | Add a post-deploy smoke test (invoke once on a forced cold start) | — | Open |
| 9 | Introduce CI so the image is built from a clean checkout, not a working tree | — | Open (already in [roadmap.md](../../roadmap.md)) |
| 10 | Investigate the 10 s `Phase: init` timeout (OpenTelemetry bootstrap cost) | — | Open |

---

## Side observations (not the cause)

- **Slow init.** The first cold start reported
  `INIT_REPORT Init Duration: 10000.44 ms Phase: init Status: timeout`. OpenTelemetry bootstrap is
  expensive enough to hit the 10-second init limit. This did **not** cause the outage — the fatal
  `EACCES` came later, in the invoke phase — but a 10 s init timeout on its own degrades every cold
  start and deserves its own investigation (see action 9).
- **`Runtime.Unknown` is a misleading signal.** Because the crash happened during module load, Lambda
  reported `Runtime.Unknown` rather than a handler error. Any `EACCES`/`MODULE_NOT_FOUND` on a
  `/var/task/...` path during init should be triaged as a **deployment artifact** problem, not a
  runtime or code problem. The runbook encodes this.
- **`.env` is `0644`.** It is gitignored and `.dockerignore`d, so it is not shipped, but on the
  developer machine it is world-readable while holding secrets. Out of scope here; flagging for a
  separate tightening.

---

## Evidence appendix

Production log, `overwatch-report-generation`, request `19c59e72-fffe-54ac-8662-fd4c06d3c51d`:

```
2026-10-06T13:26:42.770Z ERROR Uncaught Exception
{"errorType":"Error","errorMessage":"EACCES: permission denied, open '/var/task/src/components/AppsSummaryReport.js'","code":"EACCES","errno":-13,"syscall":"open","path":"/var/task/src/components/AppsSummaryReport.js","stack":["Error: EACCES: permission denied, open '/var/task/src/components/AppsSummaryReport.js'","    at Object.readFileSync (node:fs:448:20)","    at loadSource (node:internal/modules/cjs/loader:1548:17)","    at Module._extensions..js (node:internal/modules/cjs/loader:1617:44)","    at Object.newLoader [as .js] (/var/task/node_modules/pirates/lib/index.js:134:7)", ...,"    at Object.<anonymous> (/var/task/src/report-job.js:50:39)","    at Object.<anonymous> (/var/task/src/index.js:19:26)", ...]}

2026-10-06T13:26:42.814Z INIT_REPORT Init Duration: 17498.20 ms Phase: invoke Status: error Error Type: Runtime.Unknown
2026-10-06T13:26:42.823Z REPORT RequestId: 19c59e72-... Duration: 17510.42 ms Billed Duration: 17511 ms Memory Size: 4096 MB Max Memory Used: 519 MB Status: error Error Type: Runtime.Unknown
```

Reading the stack from the bottom up gives the whole story: `index.js:19` → `report-job.js:50` →
`pirates` hook → `readFileSync` → `EACCES`.

Diagnostic commands used:

```bash
# 1. Which files in the repo are not readable by anyone but their owner?
find . -path ./node_modules -prune -o -path ./.git -prune -o -type f ! -perm -044 -print

# 2. Confirm the mode is NOT in git (it never is) — these all report 100644
git ls-files -s src/components/AppsSummaryReport.js src/components/AppsDetailedReport.js \
                 src/components/appPdfShared.js

# 3. Confirm the mode DID reach the image
docker run --rm --entrypoint /bin/sh <image> -c \
  "ls -l /var/task/src/components/AppsSummaryReport.js"

# 4. Reproduce the production error as a non-root user
docker run --rm --user 993 --entrypoint /bin/sh <image> -c \
  "cat /var/task/src/components/AppsSummaryReport.js >/dev/null"
# -> cat: /var/task/src/components/AppsSummaryReport.js: Permission denied
```

---

## Related

- [incident-response.md](./incident-response.md) — how to detect, triage and fix this class of failure
- [deployment.md](../../deployment.md) — build/push/update procedure and pre-deploy checks
- [local-testing.md](../../local-testing.md) — local verification workflow
- [roadmap.md](../../roadmap.md) — the missing CI/CD pipeline
