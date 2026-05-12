const test = require('node:test');
const assert = require('node:assert/strict');
const { renderToStream } = require('@react-pdf/renderer');
const React = require('react');

require('@babel/register')({
  presets: ['@babel/preset-env', '@babel/preset-react'],
  extensions: ['.js', '.jsx'],
  cache: false,
});

const { DetailedCasesReportDocument } = require('../../src/components/DetailedCaseReport');
const { SingleCaseReportDocument } = require('../../src/components/SingleCaseReport');
const { ProfileReportDocument } = require('../../src/components/ProfileReport');
const { RiskReportDocument } = require('../../src/components/SummaryReport');
const { generateDetailedCasesDocxBuffer } = require('../../src/components/docx/DetailedCasesReportDocx');
const { generateProfileDocxBuffer } = require('../../src/components/docx/ProfileReportDocx');
const { makeProject, makeProfile, makeNormalizedPost } = require('../fixtures/report-fixtures');

async function streamToBuffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function assertPdfRenderable(element) {
  const stream = await renderToStream(element);
  const pdfBuffer = await streamToBuffer(stream);
  assert.ok(pdfBuffer.length > 100);
  assert.equal(pdfBuffer.slice(0, 4).toString('utf8'), '%PDF');
}

test('Detailed report PDF renders with fixture posts', async () => {
  const project = makeProject();
  const posts = [makeNormalizedPost(), makeNormalizedPost({ _id: 'post-2', post_id: 'P002' })];
  const element = React.createElement(DetailedCasesReportDocument, {
    posts,
    project,
    compressedImages: [null, null],
  });
  await assertPdfRenderable(element);
});

test('Single case PDF renders with fixture post', async () => {
  const project = makeProject();
  const post = makeNormalizedPost();
  const element = React.createElement(SingleCaseReportDocument, {
    post,
    project,
    compressedImage: null,
  });
  await assertPdfRenderable(element);
});

test('Profile report PDF renders with fixture profile and cases', async () => {
  const project = makeProject();
  const profile = makeProfile();
  const cases = [makeNormalizedPost(), makeNormalizedPost({ _id: 'post-2', post_id: 'P002' })];
  const element = React.createElement(ProfileReportDocument, {
    profile,
    cases,
    project,
    compressedImages: [null, null],
    compressedProfilePic: null,
  });
  await assertPdfRenderable(element);
});

test('Summary report PDF renders with fixture posts', async () => {
  const project = makeProject();
  const posts = [makeNormalizedPost(), makeNormalizedPost({ _id: 'post-2', post_id: 'P002' })];
  const element = React.createElement(RiskReportDocument, {
    posts,
    project,
    compressedImages: [null, null],
  });
  await assertPdfRenderable(element);
});

test('Detailed cases DOCX renders with fixture posts', async () => {
  const project = makeProject();
  const posts = [makeNormalizedPost(), makeNormalizedPost({ _id: 'post-2', post_id: 'P002' })];
  const docxBuffer = await generateDetailedCasesDocxBuffer(posts, project, [null, null], { organization: 'Fixture Org' });
  assert.ok(Buffer.isBuffer(docxBuffer));
  assert.ok(docxBuffer.length > 100);
  assert.equal(docxBuffer.slice(0, 2).toString('utf8'), 'PK');
});

test('Profile DOCX renders with fixture profile and posts', async () => {
  const project = makeProject();
  const profile = makeProfile();
  const posts = [makeNormalizedPost(), makeNormalizedPost({ _id: 'post-2', post_id: 'P002' })];
  const docxBuffer = await generateProfileDocxBuffer(profile, posts, project, [null, null], null, { organization: 'Fixture Org' });
  assert.ok(Buffer.isBuffer(docxBuffer));
  assert.ok(docxBuffer.length > 100);
  assert.equal(docxBuffer.slice(0, 2).toString('utf8'), 'PK');
});
