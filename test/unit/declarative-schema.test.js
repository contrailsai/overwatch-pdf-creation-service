const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { validateTemplate, validateTemplateFile } = require('../../src/declarative');

test('rejects empty object', () => {
  const result = validateTemplate({});
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test('default-posts-summary/v1.json validates', () => {
  const file = path.join(__dirname, '../../templates/default-posts-summary/v1.json');
  const result = validateTemplateFile(file);
  assert.equal(result.ok, true, result.errors && result.errors.join('; '));
  assert.equal(result.template.id, 'default-posts-summary');
  assert.equal(result.template.reportType, 'Summary');
});

test('default-posts-detailed/v1.json validates', () => {
  const file = path.join(__dirname, '../../templates/default-posts-detailed/v1.json');
  const result = validateTemplateFile(file);
  assert.equal(result.ok, true, result.errors && result.errors.join('; '));
  assert.equal(result.template.id, 'default-posts-detailed');
  assert.equal(result.template.repeat, 'perItem');
});
