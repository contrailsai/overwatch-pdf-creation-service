const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const {
  validatePayload,
  generateReportHash,
  orderPostsByRequestedIds,
} = require('../../src/core-utils');

test('validatePayload accepts a valid PDF payload', () => {
  const payload = {
    projectId: 'project-1',
    database_name: 'tenant_db',
    postIds: [new ObjectId().toString()],
    reportType: 'Detailed',
    reportFormat: 'pdf',
  };
  const result = validatePayload(payload);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validatePayload rejects invalid ObjectId values', () => {
  const payload = {
    projectId: 'project-1',
    database_name: 'tenant_db',
    postIds: ['not-an-object-id'],
    reportType: 'Detailed',
    reportFormat: 'pdf',
  };
  const result = validatePayload(payload);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /invalid ObjectId/i);
});

test('validatePayload rejects unsupported DOCX report type', () => {
  const payload = {
    projectId: 'project-1',
    database_name: 'tenant_db',
    postIds: [new ObjectId().toString()],
    reportType: 'Summary',
    reportFormat: 'docx',
  };
  const result = validatePayload(payload);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /DOCX is only supported/i);
});

test('generateReportHash is deterministic regardless of post order', () => {
  const id1 = new ObjectId().toString();
  const id2 = new ObjectId().toString();
  const hashA = generateReportHash('project-1', [id1, id2], 'Detailed', '', 'pdf');
  const hashB = generateReportHash('project-1', [id2, id1], 'Detailed', '', 'pdf');
  assert.equal(hashA, hashB);
});

test('orderPostsByRequestedIds preserves request order', () => {
  const id1 = new ObjectId();
  const id2 = new ObjectId();
  const id3 = new ObjectId();
  const ordered = orderPostsByRequestedIds(
    [id3.toString(), id1.toString(), id2.toString()],
    [{ _id: id2 }, { _id: id1 }, { _id: id3 }],
  );
  assert.deepEqual(
    ordered.map((post) => post._id.toString()),
    [id3.toString(), id1.toString(), id2.toString()],
  );
});
