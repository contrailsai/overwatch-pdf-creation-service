#!/usr/bin/env node
/**
 * Pre-deploy check: every file that gets COPY'd into the Lambda image must be
 * readable by a user other than its owner.
 *
 * Why this exists
 * ---------------
 * Lambda runs the function as a user that does not own the image files, and
 * `@babel/register` reads the raw `src/**\/*.js` sources at runtime. If a source
 * file has mode 0600 the runtime cannot read it and cold start dies with:
 *
 *   EACCES: permission denied, open '/var/task/src/components/<File>.js'
 *
 * Git only tracks the executable bit (100644 / 100755), so a 0600 mode is
 * invisible to `git status`, survives every commit, and cannot be caught in
 * review. This module catches it before the image is built.
 *
 * Usage
 * -----
 *   node scripts/check-file-permissions.js         # report, exit 1 if any bad
 *   node scripts/check-file-permissions.js --fix   # chmod a+r the offenders
 *
 * Wired into package.json as `npm run check:permissions` / `npm run fix:permissions`,
 * and enforced automatically by `test/unit/file-permissions.test.js` (so `npm test`
 * fails on a bad mode).
 *
 * See docs/incidents/2026-10-06-apps-eacces/README.md.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Directories that are NOT part of the Lambda build context, or that should
// never be widened (secrets). `.dockerignore` also excludes them.
const SKIP_DIRS = new Set(['.git', 'node_modules', '.claude', 'local-reports']);
const SKIP_FILES = new Set(['.env']);

const GROUP_READ = 0o040;
const OTHER_READ = 0o004;

/**
 * Every file under `root` that is not readable by group or other.
 * @returns {{rel: string, mode: number}[]}
 */
function findUnreadableFiles(root = ROOT) {
  const offenders = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full);

      if (entry.isSymbolicLink()) continue;

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(full);
        continue;
      }

      if (!entry.isFile()) continue;
      if (SKIP_FILES.has(entry.name) && dir === root) continue;

      const mode = fs.statSync(full).mode & 0o777;
      const readableByOthers = (mode & GROUP_READ) !== 0 || (mode & OTHER_READ) !== 0;
      if (!readableByOthers) offenders.push({ rel, mode });
    }
  }

  walk(root);
  return offenders;
}

/** chmod a+r — additive, so owner bits and deliberate modes are never clobbered. */
function fixUnreadableFiles(offenders, root = ROOT) {
  for (const { rel } of offenders) {
    const full = path.join(root, rel);
    fs.chmodSync(full, fs.statSync(full).mode | GROUP_READ | OTHER_READ);
  }
  return offenders.length;
}

function main() {
  const fix = process.argv.includes('--fix');
  const offenders = findUnreadableFiles();

  if (offenders.length === 0) {
    console.log('OK: every file in the build context is group/other readable.');
    process.exit(0);
  }

  console.error(
    `FAIL: ${offenders.length} file(s) are not readable by other users. ` +
      'These break the Lambda cold start with EACCES.\n'
  );
  for (const { rel, mode } of offenders) {
    console.error(`  0${mode.toString(8)}  ${rel}`);
  }

  if (fix) {
    const fixed = fixUnreadableFiles(offenders);
    console.error(`\nFixed ${fixed} file(s) with chmod a+r.`);
    process.exit(0);
  }

  console.error('\nRun `npm run fix:permissions` to repair, then rebuild the image.');
  process.exit(1);
}

if (require.main === module) main();

module.exports = { findUnreadableFiles, fixUnreadableFiles, SKIP_DIRS, SKIP_FILES, ROOT };
