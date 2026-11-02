const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const React = require('react');
const { renderToStream } = require('@react-pdf/renderer');
const { PDFDocument, PDFName } = require('pdf-lib');
require('@babel/register')({ presets: ['@babel/preset-env', '@babel/preset-react'], extensions: ['.js', '.jsx'], cache: false });
const { AppsSummaryReportDocument } = require('../../src/components/AppsSummaryReport');
const { makeNormalizedApp, makeProject } = require('./smoke-fixtures');
const { validatePayload, generateReportHash } = require('../../src/core-utils');
const { runReportJob } = require('../../src/report-job');
const ids = ['6ab65e0648deed136101ed92', '6aba02597a7005070a1e2955'];
const payload = { projectId: 'SEBI', entityType: 'apps', appIds: [ids[1], ids[0], ids[1]], reportType: 'Summary', reportFormat: 'pdf', database_name: 'test', project: { project_name: 'SEBI' } };
async function buffer(stream) { const chunks = []; for await (const item of stream) chunks.push(item); return Buffer.concat(chunks); }

test('landscape summary requests preserve first occurrence and use a versioned hash', () => {
  const result = validatePayload(payload);
  assert.equal(result.valid, true);
  assert.deepEqual(result.entityIds, [ids[1], ids[0]]);
  assert.deepEqual(validatePayload({ ...payload, appIds: undefined, postIds: payload.appIds }).entityIds, [ids[1], ids[0]]);
  assert.equal(validatePayload({ ...payload, reportFormat: 'pptx' }).valid, false);
  const hash = generateReportHash('SEBI', payload.appIds, 'Summary', '', 'pdf', 'apps');
  assert.equal(hash, generateReportHash('SEBI', [...ids].reverse(), 'Summary', '', 'pdf', 'apps'));
  assert.notEqual(hash, generateReportHash('SEBI', ids, 'Summary', '', 'pdf', 'apps'));
  assert.equal(hash, 'bf667ee9778e2b73a5e7d083b81c062b331abace165a049850cd24eb9d380090');
  const legacy = crypto.createHash('sha256').update(`SEBI-${[...ids].sort().join(',')}-Summary--pdf-apps`).digest('hex');
  assert.notEqual(hash, legacy);
});

test('landscape presentation paginates, labels sources, and retains store links', async () => {
  const apps = Array.from({ length: 7 }, (_, i) => makeNormalizedApp({ _id: `${i}`, title: `App ${i + 1}`, developer_id: `${i}`, developer: { name: `Publisher ${i + 1}` }, original_url: 'https://example.com/store', review: { threat_types: ['Fraud'], legal_codes: [], case_summary: 'Reviewer summary', field_sources: { summary: 'review', violations: 'review', legal_codes: 'review' } } }));
  const pdf = await buffer(await renderToStream(React.createElement(AppsSummaryReportDocument, { apps, project: makeProject() })));
  const doc = await PDFDocument.load(pdf);
  assert.equal(doc.getPageCount(), 13);
  doc.getPages().forEach((page) => { const { width, height } = page.getSize(); assert.equal(width / height, 16 / 9); });
  assert.ok(doc.getPages().some((p) => p.node.Annots()?.size() > 0));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apps-landscape-'));
  try { const file = path.join(dir, 'summary.pdf'); fs.writeFileSync(file, pdf); const text = execFileSync(process.execPath, [path.join(__dirname, '../../scripts/extract-pdf-text.js'), file], { encoding: 'utf8' }).toLowerCase(); for (const part of ['app risk overview', 'violation signals', 'app catalog', 'developer profles', 'reviewer summary', 'no supporting image recorded']) assert.ok(text.includes(part), part); assert.ok(text.indexOf('app risk overview') < text.indexOf('violation signals')); assert.ok(text.indexOf('app catalog') < text.indexOf('developer profles')); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('report job delivers a watermarked landscape PDF locally', async () => {
  const raw = ids.map((id, i) => ({ _id: { toString: () => id }, content: { title: `App ${i}` }, review_details: {}, evidence: { sections: [] } }));
  const cursor = (values) => ({ toArray: async () => values, sort() { return this; } });
  const client = { db: () => ({ collection: (name) => ({ find: () => cursor(name === 'Apps' ? raw : []) }) }) };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apps-job-'));
  try { const result = await runReportJob(client, payload, { persist: 'local', localOutputDir: dir }); assert.equal(result.format, 'pdf'); assert.match(result.localPath, /\.pdf$/); assert.match(result.storageUrl, /^local:\/\/.*\.pdf$/); const doc = await PDFDocument.load(fs.readFileSync(result.localPath)); assert.equal(doc.getPageCount(), 6); assert.equal(doc.getPage(0).getSize().width, 960); assert.ok(doc.getPage(0).node.Resources().lookup(PDFName.of('XObject'))); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('landscape app page embeds evidence without filename captions', async () => {
  const sharp = require('sharp');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apps-image-'));
  try {
    const img = path.join(dir, 'tall.png');
    await sharp({ create: { width: 60, height: 180, channels: 3, background: '#6699cc' } }).png().toFile(img);
    const app = makeNormalizedApp({ _id: 'with-image', evidence: { sections: [{ title: 'Payment request', images: [{ slot: '0:0', localPath: img, filename: 'payment-proof.png' }], totalImages: 1 }] } });
    const pdf = await buffer(await renderToStream(React.createElement(AppsSummaryReportDocument, { apps: [app], project: makeProject() })));
    const doc = await PDFDocument.load(pdf);
    const appPage = doc.getPages().at(-1);
    assert.ok(appPage.node.Resources().lookup(PDFName.of('XObject')));
    const file = path.join(dir, 'image-report.pdf');
    fs.writeFileSync(file, pdf);
    const text = execFileSync(process.execPath, [path.join(__dirname, '../../scripts/extract-pdf-text.js'), file], { encoding: 'utf8' });
    assert.doesNotMatch(text, /payment-proof\.png/);
    assert.match(text, /PAYMENT PORTAL \/ GATEWAY/);
    assert.match(text, /TRADE INDIAN SECURITIES/);
    assert.match(text, /No supporting image recorded/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('summary uses alert status, lists all signals and developer details, and omits empty unclassified risk', async () => {
  const app = makeNormalizedApp({ _id: 'alerted', title: 'Alerted App', client_status: 'alerted', alerted_at: '2026-10-14T00:00:00.000Z', developer_id: 'dev', developer: { name: 'Publisher', legal_name: 'Publisher Limited', email: 'test@example.com', website: 'https://example.com', phone: '12345' }, review: { risk_rank: 'high', threat_types: ['Reviewer threat'], legal_codes: [{ code: 'Reviewer law' }], case_summary: 'Case narrative', field_sources: { violations: 'review', legal_codes: 'review', summary: 'review' } }, analysis_results: { threat_types: ['AI threat'], legal_codes: [{ code: 'AI law' }] } });
  const pdf = await buffer(await renderToStream(React.createElement(AppsSummaryReportDocument, { apps: [app], project: makeProject() })));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apps-alert-'));
  try {
    const file = path.join(dir, 'alert.pdf'); fs.writeFileSync(file, pdf);
    const text = execFileSync(process.execPath, [path.join(__dirname, '../../scripts/extract-pdf-text.js'), file], { encoding: 'utf8' }).toLowerCase().replace(/\s+/g, ' ');
    for (const expected of ['alerted', 'alert date: 2026-10-14', 'reviewer threat', 'ai threat', 'reviewer law', 'ai law', 'publisher limited', 'test@example.com', 'open play store listing']) assert.ok(text.includes(expected), expected);
    assert.ok(!/\bunreviewed\b|\breviewed\b/.test(text));
    assert.doesNotMatch(text.split('===== page 2 =====')[0], /alerted/);
    assert.ok(!text.includes('not classifed'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
