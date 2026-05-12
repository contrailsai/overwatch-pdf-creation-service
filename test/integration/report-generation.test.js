const test = require('node:test');
const assert = require('node:assert/strict');
const { renderToStream } = require('@react-pdf/renderer');
const React = require('react');

require('@babel/register')({
  presets: ['@babel/preset-env', '@babel/preset-react'],
  extensions: ['.js', '.jsx'],
  cache: false,
});

const { RiskReportDocument } = require('../../src/components/SummaryReport');
const { generateSingleCaseDocxBuffer } = require('../../src/components/docx/SingleCaseReportDocx');
const { makeProject, makeNormalizedPost } = require('../fixtures/report-fixtures');

async function streamToBuffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

test('PDF smoke test renders a valid PDF stream', async () => {
  const posts = [makeNormalizedPost()];
  const project = makeProject();
  const element = React.createElement(RiskReportDocument, {
    posts,
    project,
    compressedImages: [null],
  });

  const pdfStream = await renderToStream(element);
  const pdfBuffer = await streamToBuffer(pdfStream);

  assert.ok(pdfBuffer.length > 100);
  assert.equal(pdfBuffer.slice(0, 4).toString('utf8'), '%PDF');
});

test('DOCX smoke test renders a valid docx buffer', async () => {
  const post = makeNormalizedPost();
  const project = makeProject();
  const clientDetails = { organization: 'Smoke Test Org' };

  const docxBuffer = await generateSingleCaseDocxBuffer(post, project, null, clientDetails);

  assert.ok(Buffer.isBuffer(docxBuffer));
  assert.ok(docxBuffer.length > 100);
  assert.equal(docxBuffer.slice(0, 2).toString('utf8'), 'PK');
});
