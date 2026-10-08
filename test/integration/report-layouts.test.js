const test = require('node:test');
const assert = require('node:assert/strict');
const { renderToStream } = require('@react-pdf/renderer');
const { PDFDocument } = require('pdf-lib');
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
const { AdsProfilesSummaryReportDocument } = require('../../src/components/AdsProfilesSummaryReport');
const { AdsProfileReportDocument } = require('../../src/components/AdsProfileReport');
const { AppsSummaryReportDocument } = require('../../src/components/AppsSummaryReport');
const { AppsDetailedReportDocument } = require('../../src/components/AppsDetailedReport');
const { TelegramGroupsSummaryReportDocument } = require('../../src/components/TelegramGroupsSummaryReport');
const { TelegramGroupsDetailedReportDocument } = require('../../src/components/TelegramGroupsDetailedReport');
const { generateDetailedCasesDocxBuffer } = require('../../src/components/docx/DetailedCasesReportDocx');
const { generateProfileDocxBuffer } = require('../../src/components/docx/ProfileReportDocx');
const { generateSimpleProfileDocxBuffer } = require('../../src/components/docx/SimpleProfileReportDocx');
const { generateSimpleCaseDocxBuffer } = require('../../src/components/docx/SimpleCaseReportDocx');
const {
  makeProject,
  makeProfile,
  makeNormalizedPost,
  makeNormalizedAd,
  makeNormalizedDomain,
  makeNormalizedApp,
  makeNormalizedTelegramGroup,
  makeAdProfileReportGroup,
} = require('./smoke-fixtures');

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

async function renderPdfPageCount(element) {
  const stream = await renderToStream(element);
  const pdfBuffer = await streamToBuffer(stream);
  const doc = await PDFDocument.load(pdfBuffer, { updateMetadata: false });
  return doc.getPageCount();
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

test('Ads Profiles Summary PDF renders with fixture profile groups', async () => {
  const project = makeProject();
  const profiles = [
    makeAdProfileReportGroup(),
    makeAdProfileReportGroup({
      profile: { _id: '6a7db28d7f82a0c5cc92af3e', page_name: 'Second Page', risk: 'high', risk_rank: 'high' },
    }),
  ];
  const element = React.createElement(AdsProfilesSummaryReportDocument, {
    profiles,
    project,
  });
  await assertPdfRenderable(element);
});

test('Ads Profile Report PDF renders with single fixture profile dossier', async () => {
  const project = makeProject();
  const profiles = [makeAdProfileReportGroup()];
  const element = React.createElement(AdsProfileReportDocument, {
    profiles,
    project,
  });
  await assertPdfRenderable(element);
});

test('Apps Summary PDF renders with fixture apps', async () => {
  const project = makeProject();
  const apps = [
    makeNormalizedApp(),
    makeNormalizedApp({
      _id: '6aba06a4e8c8fd9c21da915f',
      title: 'NischintLoan-Credit Assistant',
      package_id: 'com.hydroacres.nischint',
      screenshots: [],
      total_screenshots: 0,
      evidence: { has_evidence: false, totalImages: 0, sections: [] },
      permissions: [],
      data_safety: [],
      developer: { ...makeNormalizedApp().developer, name: 'Hydroacres', website: 'https://www.nischintloan.com' },
    }),
  ];
  const element = React.createElement(AppsSummaryReportDocument, { apps, project });
  await assertPdfRenderable(element);
});

test('Apps Detailed PDF renders with fixture apps', async () => {
  const project = makeProject();
  const apps = [
    makeNormalizedApp({
      compressedImage: null,
      compressedScreenshots: [null, null],
    }),
    makeNormalizedApp({
      _id: '6aba06a4e8c8fd9c21da915f',
      title: 'NischintLoan-Credit Assistant',
      review: {
        threat_score: 88,
        risk_rank: 'medium',
        threat_types: ['financial_scam'],
        violation_flags: [],
        flags: {},
        legal_codes: [{ code: 'IT-66D', reasoning: 'Cheating by personation.' }],
        reasoning: 'Description: unregistered lending app.',
        case_summary: 'Unregistered lending app.',
        verdict: null,
        recommended_action: null,
        reviewer_comments: '',
        reviewed_at: '2026-10-01T00:00:00.000Z',
      },
      evidence: { has_evidence: false, totalImages: 0, sections: [] },
    }),
  ];
  const element = React.createElement(AppsDetailedReportDocument, { apps, project });
  await assertPdfRenderable(element);
});

test('Telegram groups Summary PDF renders with fixture groups', async () => {
  const project = makeProject();
  const groups = [
    makeNormalizedTelegramGroup({ compressedImage: null }),
    makeNormalizedTelegramGroup({
      _id: '6ab005f9f2b0ece71b21fb7e',
      title: 'BOOKING VISA HYPE',
      username: 'VFSBOOKINGHYPE',
      participant_count: 298,
      message_count: 90,
      review: {
        threat_score: 96,
        risk_rank: 'high',
        threat_types: ['Fraud', 'Impersonation'],
        violation_flags: [],
        flags: {},
        legal_codes: [{ code: 'BNS - Sec 319', reasoning: 'Cheating by personation.' }],
        reasoning: 'Impersonates consular booking services.',
        case_summary: 'High-risk impersonation channel.',
        reviewed_at: '2026-09-22T00:00:00.000Z',
      },
    }),
  ];
  const element = React.createElement(TelegramGroupsSummaryReportDocument, { groups, project });
  await assertPdfRenderable(element);
});

test('Telegram groups Detailed PDF renders reviewed and unreviewed fixtures', async () => {
  const project = makeProject();
  const groups = [
    makeNormalizedTelegramGroup({ compressedImage: null }),
    makeNormalizedTelegramGroup({
      _id: '6aaf0000f2b0ece71b210000',
      title: 'Unreviewed Visa Alerts',
      username: 'visa_alerts',
      review: {
        threat_score: null,
        risk_rank: null,
        threat_types: [],
        violation_flags: [],
        flags: {},
        legal_codes: [],
        reasoning: '',
        case_summary: '',
        reviewer_comments: '',
        reviewed_at: null,
      },
      review_details: undefined,
      workflow: { review_status: 'pending', client_status: 'open' },
    }),
  ];
  const element = React.createElement(TelegramGroupsDetailedReportDocument, { groups, project });
  await assertPdfRenderable(element);
});

test('Telegram groups Detailed layers profile, gallery and analysis pages', async () => {
  const project = makeProject();

  const minimal = makeNormalizedTelegramGroup({
    ai: {
      present: false,
      operator_involvement: {},
      promoted_services: [],
      promoted_handles: [],
      flagged_actors: [],
      flagged_messages: [],
      media_evidence: [],
      batch_summaries: [],
    },
    telegram_backfill: {},
    review: {
      threat_score: null,
      risk_rank: null,
      threat_types: [],
      violation_flags: [],
      flags: {},
      legal_codes: [],
      reasoning: '',
      case_summary: '',
      reviewer_comments: '',
      reviewed_at: null,
    },
  });
  const minimalDoc = React.createElement(TelegramGroupsDetailedReportDocument, {
    groups: [minimal],
    project,
  });
  assert.equal(await renderPdfPageCount(minimalDoc), 1);

  // Default fixture: profile page + 1 gallery page + 1 analysis/coverage page.
  const rich = React.createElement(TelegramGroupsDetailedReportDocument, {
    groups: [makeNormalizedTelegramGroup({ compressedImage: null })],
    project,
  });
  assert.equal(await renderPdfPageCount(rich), 3);

  // 5 flagged messages paginate the gallery 4-per-page.
  const manyMessages = makeNormalizedTelegramGroup({
    compressedImage: null,
    ai: {
      ...makeNormalizedTelegramGroup().ai,
      flagged_messages: Array.from({ length: 5 }, (_, i) => ({
        ...makeNormalizedTelegramGroup().ai.flagged_messages[0],
        index: i,
        message_id: 300000 + i,
      })),
    },
  });
  const paginated = React.createElement(TelegramGroupsDetailedReportDocument, {
    groups: [manyMessages],
    project,
  });
  assert.equal(await renderPdfPageCount(paginated), 4);
});

test('SimpleCase DOCX renders with fixture post', async () => {
  const project = makeProject();
  const post = makeNormalizedPost();
  const docxBuffer = await generateSimpleCaseDocxBuffer(post, project, null);
  assert.ok(Buffer.isBuffer(docxBuffer));
  assert.ok(docxBuffer.length > 100);
  assert.equal(docxBuffer.slice(0, 2).toString('utf8'), 'PK');
});
