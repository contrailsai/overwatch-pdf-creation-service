const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');
require('@babel/register')({ presets: ['@babel/preset-env', '@babel/preset-react'], extensions: ['.js', '.jsx'], cache: false });
const s3 = require('../../src/s3');
const supabaseModule = require('../../src/supabase');
const uploaded = [];
const updates = [];
s3.uploadBufferToS3 = async (buffer, key, type) => { uploaded.push({ buffer, key, type }); return `s3://bucket/${key}`; };
supabaseModule.supabaseEnabled = true;
supabaseModule.supabase = { from: (table) => ({ update: (fields) => ({ eq: async (column, hash) => { updates.push({ table, fields, column, hash }); return { error: null }; } }) }) };
const { runReportJob } = require('../../src/report-job');

test('Apps Summary updates its report status and uploads a watermarked PDF', async () => {
  const id = '6ab65e0648deed136101ed92';
  const cursor = (records) => ({ toArray: async () => records, sort() { return this; } });
  const client = { db: () => ({ collection: (name) => ({ find: () => cursor(name === 'Apps' ? [{ _id: { toString: () => id }, content: { title: 'Example' } }] : []) }) }) };
  const result = await runReportJob(client, { projectId: 'SEBI', entityType: 'apps', appIds: [id], reportType: 'Summary', reportFormat: 'pdf', database_name: 'test', project: { project_name: 'SEBI' } });
  assert.equal(uploaded.length, 1);
  assert.equal(uploaded[0].type, 'application/pdf');
  assert.equal(uploaded[0].key, `reports/${result.reportHash}.pdf`);
  assert.equal(result.format, 'pdf');
  assert.equal(result.storageUrl, `s3://bucket/reports/${result.reportHash}.pdf`);
  assert.ok((await PDFDocument.load(uploaded[0].buffer)).getPageCount() > 0);
  assert.ok(updates.every((u) => u.table === 'reports_generation' && u.column === 'report_hash' && u.hash === result.reportHash));
  assert.ok(updates.some((u) => u.fields.status.includes('Generating PDF')));
  assert.equal(updates.at(-1).fields.status, '[100%] Complete');
  assert.equal(updates.at(-1).fields.s3_path, result.storageUrl);
});
