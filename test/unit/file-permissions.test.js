/**
 * Regression guard for INC-2026-10-06-01.
 *
 * Lambda runs the function as a user that does NOT own the image files, and
 * `@babel/register` reads the raw `src/**\/*.js` sources at runtime. A source
 * file with mode 0600 is therefore readable on the developer's machine (they
 * own it) but fatal in the image:
 *
 *   EACCES: permission denied, open '/var/task/src/components/AppsSummaryReport.js'
 *
 * Git only tracks the executable bit, so a 0600 mode appears in no diff, passes
 * review, and survives commits. This test makes `npm test` fail instead.
 *
 * Fix: `npm run fix:permissions`
 * See: docs/incidents/2026-10-06-apps-eacces/README.md
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { findUnreadableFiles } = require('../../scripts/check-file-permissions');

test('every file in the Lambda build context is group/other readable', () => {
  const offenders = findUnreadableFiles();

  assert.deepEqual(
    offenders.map(({ rel, mode }) => `${mode.toString(8).padStart(4, '0')} ${rel}`),
    [],
    'Files with owner-only permissions break the Lambda cold start with EACCES. ' +
      'Run `npm run fix:permissions` and rebuild the image.'
  );
});
