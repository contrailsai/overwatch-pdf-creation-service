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
const { AdsSummaryReportDocument } = require('../../src/components/AdsSummaryReport');
const { AdsDetailedReportDocument } = require('../../src/components/AdsDetailedReport');
const { DomainsSummaryReportDocument } = require('../../src/components/DomainsSummaryReport');
const { DomainsDetailedReportDocument } = require('../../src/components/DomainsDetailedReport');
const { generateDetailedCasesDocxBuffer } = require('../../src/components/docx/DetailedCasesReportDocx');
const { generateProfileDocxBuffer } = require('../../src/components/docx/ProfileReportDocx');
const { generateSimpleProfileDocxBuffer } = require('../../src/components/docx/SimpleProfileReportDocx');
const { generateSimpleCaseDocxBuffer } = require('../../src/components/docx/SimpleCaseReportDocx');
const { makeProject, makeProfile, makeNormalizedPost, makeNormalizedAd, makeNormalizedDomain } = require('./smoke-fixtures');

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

test('SimpleProfile DOCX renders with fixture profile and posts', async () => {
  const project = makeProject();
  const profile = makeProfile();
  const posts = [makeNormalizedPost(), makeNormalizedPost({ _id: 'post-2', post_id: 'P002' })];
  const docxBuffer = await generateSimpleProfileDocxBuffer(profile, posts, project, [null, null]);
  assert.ok(Buffer.isBuffer(docxBuffer));
  assert.ok(docxBuffer.length > 100);
  assert.equal(docxBuffer.slice(0, 2).toString('utf8'), 'PK');
});

test('Ads Summary PDF renders with fixture ads', async () => {
  const project = makeProject();
  const ads = [
    makeNormalizedAd(),
    makeNormalizedAd({
      _id: 'ad-2',
      ad_id: 'P002',
      destination_mismatch: false,
      shown_hostname: 'ilnkarip.com',
      card_hostnames: ['ilnkarip.com'],
      advertiser: { page_name: 'Anthony K Thomas', profile_url: '', page_like_count: 0, page_categories: [], is_verified: false },
    }),
  ];
  const element = React.createElement(AdsSummaryReportDocument, {
    ads,
    project,
    compressedImages: [null, null],
  });
  await assertPdfRenderable(element);
});

test('Ads Detailed PDF renders with fixture ads', async () => {
  const project = makeProject();
  const ads = [makeNormalizedAd(), makeNormalizedAd({ _id: 'ad-2', ad_id: 'P002' })];
  const element = React.createElement(AdsDetailedReportDocument, {
    ads,
    project,
    compressedImages: [null, null],
    compressedCardImages: [[], []],
  });
  await assertPdfRenderable(element);
});

test('Domains Summary PDF renders with fixture domains', async () => {
  const project = makeProject();
  const domains = [
    makeNormalizedDomain(),
    makeNormalizedDomain({
      _id: '6a8be238abdd8b24b75f1779',
      domain_name: 'ilnkarip.com',
      reportVariantKey: 'bare',
      list: {
        reviewed_at: '2026-09-03T11:20:17.875Z',
        risk_rank: 'medium',
        occurrence_count: 10,
        hosting_country: 'US',
      },
    }),
  ];
  const element = React.createElement(DomainsSummaryReportDocument, {
    domains,
    project,
    compressedImages: [null, null],
  });
  await assertPdfRenderable(element);
});

test('Domains Detailed PDF renders with fixture domain and posts alias', async () => {
  const project = makeProject();
  const domain = makeNormalizedDomain();
  const detailed = React.createElement(DomainsDetailedReportDocument, {
    domains: [domain],
    project,
    compressedImages: [null],
    screenshotSlices: [[]],
  });
  await assertPdfRenderable(detailed);

  const aliased = React.createElement(DomainsDetailedReportDocument, {
    posts: [domain],
    project,
    compressedImages: [null],
    screenshotSlices: [[]],
  });
  await assertPdfRenderable(aliased);
});

test('SimpleCase DOCX renders with fixture post', async () => {
  const project = makeProject();
  const post = makeNormalizedPost();
  const docxBuffer = await generateSimpleCaseDocxBuffer(post, project, null);
  assert.ok(Buffer.isBuffer(docxBuffer));
  assert.ok(docxBuffer.length > 100);
  assert.equal(docxBuffer.slice(0, 2).toString('utf8'), 'PK');
});
