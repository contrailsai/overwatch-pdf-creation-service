const test = require('node:test');
const assert = require('node:assert/strict');

require('@babel/register')({
  presets: ['@babel/preset-env', '@babel/preset-react'],
  extensions: ['.js', '.jsx'],
  cache: false,
});

const { normalizeApp } = require('../../src/core-utils');

const {
  appRiskInfo,
  appRiskRank,
  hasAppReviewSignal,
  collectAppViolations,
  collectAppThreatTypes,
  compactNumber,
  appInstallCountLabel,
  appPlatformLabel,
  appStoreFacts,
  appIsAlerted,
  parseReasoning,
  formatVerdictLabel,
  resolveProjectLegalCodes,
  buildAppReviewModel,
  buildAppAnalysisModel,
  buildAppEvidenceModel,
  buildEvidenceFieldRows,
  flattenKeyValues,
} = require('../../src/components/appPdfShared');

function makeApp(overrides = {}) {
  return {
    _id: 'app-1',
    platform: 'google_play',
    store: { installs: '100+', min_installs: 100, genre: 'Finance', free: true, ratings: null },
    review: {
      threat_score: null,
      risk_rank: null,
      threat_types: [],
      violation_flags: [],
      flags: {},
      reasoning: '',
      reviewed_at: null,
    },
    ...overrides,
  };
}

test('appRiskInfo returns Unreviewed without a review signal', () => {
  const info = appRiskInfo(makeApp());
  assert.equal(info.label, 'Unreviewed');
  assert.equal(info.rank, 'unknown');
  assert.equal(hasAppReviewSignal(makeApp()), false);
});

test('appRiskInfo follows the Domains thresholds and prefers a reviewer rank', () => {
  assert.equal(appRiskRank(makeApp({ review: { threat_score: 96 } })), 'high');
  assert.equal(appRiskRank(makeApp({ review: { threat_score: 76 } })), 'medium');
  assert.equal(appRiskRank(makeApp({ review: { threat_score: 41 } })), 'low');
  assert.equal(appRiskRank(makeApp({ review: { threat_score: 40 } })), 'safe');
  assert.equal(appRiskInfo(makeApp({ review: { threat_score: 96 } })).label, 'High Risk');
  assert.equal(appRiskInfo(makeApp({ review: { threat_score: 96, risk_rank: 'low' } })).label, 'Low Risk');
  assert.equal(hasAppReviewSignal(makeApp({ review: { threat_score: 12 } })), true);
  assert.equal(hasAppReviewSignal(makeApp({ review: { reviewed_at: '2026-10-01T00:00:00.000Z' } })), true);
});

test('collectAppViolations resolves project labels, legacy flags and threat types', () => {
  const project = { project_details: { labels: [{ name: 'Fraud', severity: 'high' }, { name: 'Impersonation', severity: 'high' }] } };
  const app = makeApp({
    review: {
      threat_score: 90,
      threat_types: ['Impersonation', 'financial_scam'],
      violation_flags: [],
      flags: { is_hate_speech: true, Fraud: true },
      reviewed_at: '2026-10-01T00:00:00.000Z',
    },
  });
  const chips = collectAppViolations(app, project);
  const names = chips.map((chip) => chip.name);
  assert.ok(names.includes('Fraud'));
  assert.ok(names.includes('Impersonation'));
  assert.ok(names.includes('Hate Speech'));
  assert.ok(names.includes('Financial Scam'));
  // High severity sorts first.
  assert.equal(chips[0].severity, 'high');
  // Deduplicates case-insensitively.
  assert.equal(names.filter((name) => name.toLowerCase() === 'impersonation').length, 1);
});

test('collectAppViolations matches project labels against hyphenated flags', () => {
  const project = { project_details: { labels: [{ name: 'Fraud', severity: 'high' }] } };
  const app = makeApp({
    review: {
      threat_score: 96,
      threat_types: ['investment-scams', 'fraud'],
      flags: { fraud: true, 'investment-scams': true, misinformation: false },
      reviewed_at: '2026-10-01T00:00:00.000Z',
    },
  });
  const chips = collectAppViolations(app, project);
  // 'Fraud' is attributed to the project label (high) and not duplicated by 'fraud'.
  assert.equal(chips[0].name, 'Fraud');
  assert.equal(chips[0].severity, 'high');
  assert.deepEqual(
    chips.map((c) => c.name.toLowerCase()).sort(),
    ['fraud', 'investment scams'],
  );
});

test('normalized reviewer threats remain separate from AI threats', () => {
  const app = normalizeApp({ _id: 'app', review_details: { threat_types: ['Illegal Forex'] }, analysis_results: { threat_types: ['CONCEALED OPERATOR'] } });
  assert.deepEqual(collectAppThreatTypes(app, {}).map((chip) => chip.name), ['Illegal Forex']);
  assert.deepEqual(buildAppAnalysisModel(app, {}).aiThreatTypes, ['CONCEALED OPERATOR']);
  assert.equal(app.review.field_sources.violations, 'review');
});

test('AI threats fall back with their provenance and project severity', () => {
  const app = normalizeApp({ _id: 'app', analysis_results: { threat_types: ['fraud'] } });
  assert.deepEqual(collectAppThreatTypes(app, { project_details: { labels: [{ name: 'Fraud', severity: 'high' }] } }), [{ name: 'Fraud', severity: 'high' }]);
  assert.equal(app.review.field_sources.violations, 'analysis');
});

test('buildAppAnalysisModel merges findings, operator and targets', () => {
  const app = makeApp({
    analysis_results: {
      analysis: 'Long AI narrative.',
      findings: [
        { category: 'listing_claims', finding: 'Promises guaranteed returns.', source: 'store_listing' },
        { category: 'listing_claims', finding: 'Uses fake regulator logos.', source: 'store_media' },
      ],
      operator: {
        developer_account: 'Forex Markets',
        legal_entities: ['Narwhal Global Trade Limited'],
        countries: ['Hong Kong'],
        concealment: 'Offshore entity.',
      },
      recommended_action: 'Play Store takedown.',
      takedown_targets: {
        play_store: ['https://play.google.com/store/apps/details?id=x'],
        domains: ['https://x.com'],
        emails: [],
      },
      threat_score: 85,
      confidence: 0.9,
      media_basis: 'text_only',
    },
  });

  const model = buildAppAnalysisModel(app, {});

  assert.equal(model.hasAnalysis, true);
  assert.equal(model.aiReasoning, 'Long AI narrative.');
  assert.deepEqual(model.findingsByCategory.map((group) => group.category), ['Listing Claims']);
  assert.equal(model.findingsByCategory[0].items.length, 2);
  assert.equal(model.operator.developerAccount, 'Forex Markets');
  assert.equal(model.aiRecommendedAction, 'Play Store takedown.');
  assert.deepEqual(
    model.takedownTargets.map((target) => [target.label, target.items.length]),
    [
      ['Play Store', 1],
      ['Domains', 1],
    ],
  );
  // Legal findings live on the page-1 review model, not here.
  assert.equal(model.legalFindings, undefined);
  // Scoring metadata is deliberately not surfaced.
  assert.equal(model.threatScore, undefined);
  assert.equal(model.confidence, undefined);
  assert.equal(model.mediaBasis, undefined);
});

test('buildAppAnalysisModel is empty without AI analysis or review detail', () => {
  const model = buildAppAnalysisModel(makeApp(), undefined);
  assert.equal(model.hasAnalysis, false);
  assert.deepEqual(model.takedownTargets, []);
  assert.equal(model.operator, null);
});

test('buildAppReviewModel prefers the simple reasoning for the case summary', () => {
  const model = buildAppReviewModel(
    normalizeApp({ _id: 'app', review_details: { simple_report_description: 'Short version.', case_summary: 'Longer version.' } }),
    {},
  );
  assert.equal(model.caseSummary, 'Short version.');
});

test('reviewer legal findings stay separate from AI legal findings', () => {
  const app = normalizeApp({ _id: 'app', review_details: { legal_codes: [{ code: 'IT Rules', reasoning: '' }] }, analysis_results: { legal_codes: [{ code: 'SEBI Act', description: 'AI finding' }] } });
  const review = buildAppReviewModel(app, {});
  assert.deepEqual(review.legalFindings, [{ code: 'IT Rules', reasoning: '' }]);
  assert.equal(review.sources.legal_codes, 'review');
  assert.equal(buildAppAnalysisModel(app, {}).aiLegalCodes[0].code, 'SEBI Act');
});

test('appIsAlerted follows client status and the processed flag', () => {
  assert.equal(appIsAlerted(makeApp({ client_status: 'open', processed: false })), false);
  assert.equal(appIsAlerted(makeApp({ client_status: 'alerted' })), true);
  assert.equal(appIsAlerted(makeApp({ client_status: 'open', processed: true })), true);
  assert.equal(appIsAlerted(makeApp({})), false);
});

test('install and platform labels degrade safely', () => {
  assert.equal(compactNumber(1_250_000), '1.3M');
  assert.equal(compactNumber(50_000), '50K');
  assert.equal(compactNumber(259), '259');
  assert.equal(compactNumber(0), '0');
  assert.equal(appInstallCountLabel(makeApp()), '100+');
  assert.equal(appInstallCountLabel(makeApp({ store: { installs: '1,000,000+' } })), '1,000,000+');
  assert.equal(appInstallCountLabel(makeApp({ store: { installs: null, min_installs: 5000 } })), '5K+');
  assert.equal(appInstallCountLabel(makeApp({ store: {} })), '—');
  assert.equal(appPlatformLabel(makeApp()), 'Google Play');
  assert.equal(appPlatformLabel(makeApp({ platform: 'apple_app_store' })), 'App Store');
  assert.deepEqual(appStoreFacts(makeApp()), ['100+', 'Finance', 'Free']);
});

function makeEvidenceSection(title, description, imageCount = 0) {
  return {
    title,
    description,
    totalImages: imageCount,
    images: Array.from({ length: imageCount }, (_, i) => ({
      slot: `0:${i}`,
      url: `https://example.com/${title}-${i}.png`,
      localPath: null,
    })),
  };
}

test('buildAppReviewModel normalises verdicts, violations and legal codes', () => {
  const project = {
    project_details: {
      labels: [{ name: 'Fraud', severity: 'high' }],
      legal_codes: [{ name: 'IT-66D', description: 'Cheating by personation' }],
    },
  };
  const review = buildAppReviewModel(
    makeApp({
      client_status: 'alerted',
      review: {
        threat_score: 97,
        risk_rank: 'high',
        threat_types: ['Fraud'],
        flags: {},
        legal_codes: [{ code: 'IT-66D' }, 'XYZ-1'],
        case_summary: 'A scam app.',
        reasoning: 'Overview: flagged.\nEvidence: reviews.',
        reviewer_comments: 'Escalate.',
        recommended_action: 'page_takedown',
        reviewed_at: '2026-10-01T00:00:00.000Z',
      },
    }),
    project,
  );

  assert.equal(review.risk.label, 'High Risk');
  assert.equal(review.hasSignal, true);
  assert.equal(review.verdictLabel, 'Page Takedown');
  assert.deepEqual(review.violations.map((v) => v.name), ['Fraud']);
  assert.equal(review.legalCodes.length, 2);
  // An empty recorded explanation remains empty.
  assert.equal(review.legalCodes[0].reasoning, '');
  assert.equal(review.legalCodes[1].reasoning, '');
  assert.equal(review.reasoningSections.length, 2);
  assert.equal(review.reasoningSections[0].label, 'Overview');
  assert.equal(review.status, 'alerted');
});

test('parseReasoning and formatVerdictLabel handle plain text', () => {
  assert.deepEqual(parseReasoning(''), []);
  assert.deepEqual(parseReasoning('Just one paragraph.'), [{ label: '', content: 'Just one paragraph.' }]);
  assert.equal(formatVerdictLabel(''), '');
  assert.equal(formatVerdictLabel('submit_to_client'), 'Submit To Client');
  assert.deepEqual(resolveProjectLegalCodes({}), []);
  assert.deepEqual(resolveProjectLegalCodes({ project_details: { legal_codes: ['A-1'] } }), [
    { name: 'A-1', description: '' },
  ]);
});

test('buildAppEvidenceModel buckets fixed fields, prose, media and drops videos', () => {
  const app = makeApp({
    evidence: {
      has_evidence: true,
      sections: [
        makeEvidenceSection('App Name', 'BharatFund Trader'),
        makeEvidenceSection('Executive Summary', 'Long narrative about the app and its red flags.'),
        makeEvidenceSection('Email  (Developer Details)', 'setupfx24@gmail.com'),
        makeEvidenceSection('Associated Address', '302, floor-3, oval house, british lane, mumbai, 400001 and more'),
        makeEvidenceSection('Website Registration', 'Registered 21 April 2026.', 1),
        makeEvidenceSection('AI generated Platform', 'Synthetic profile images.', 5),
        makeEvidenceSection('Application workflow', '', 0),
        makeEvidenceSection('Similarity with Kwick Trade', 'Overlapping branding and copy.', 2),
        makeEvidenceSection('Redirection notice', 'App redirects to an external site after install.'),
      ],
    },
  });
  const model = buildAppEvidenceModel(app);

  assert.equal(model.hasEvidence, true);
  assert.equal(model.lead.length, 1);
  assert.match(model.lead[0].description, /Long narrative/);

  const listing = model.fieldsByGroup.find((g) => g.id === 'listing');
  const developer = model.fieldsByGroup.find((g) => g.id === 'developer');
  assert.deepEqual(listing.items.map((i) => i.label), ['App Name', 'Associated Address']);
  assert.equal(listing.items[1].width, 'full');
  assert.deepEqual(developer.items.map((i) => i.label), ['Email']);

  // Media sections keep images; the video-only section is dropped.
  assert.deepEqual(model.media.map((s) => s.title), ['Website Registration', 'AI generated Platform', 'Similarity with Kwick Trade']);
  assert.equal(model.totalImages, 8);
  // Prose that is neither a lead nor media lands in `other`.
  assert.deepEqual(model.other.map((s) => s.title), ['Redirection notice']);
});

test('buildAppEvidenceModel reports an empty model for apps without evidence', () => {
  const model = buildAppEvidenceModel(makeApp({ evidence: { has_evidence: false, sections: [] } }));
  assert.equal(model.hasEvidence, false);
  assert.deepEqual(model.fieldsByGroup, []);
  assert.deepEqual(model.media, []);
});

test('buildEvidenceFieldRows packs halves and gives full-width items their own row', () => {
  const rows = buildEvidenceFieldRows([
    { label: 'A', width: 'half' },
    { label: 'B', width: 'full' },
    { label: 'C', width: 'half' },
    { label: 'D', width: 'half' },
    { label: 'E', width: 'half' },
  ]);
  assert.deepEqual(rows.map((row) => row.map((i) => i.label)), [
    ['A'],
    ['B'],
    ['C', 'D'],
    ['E'],
  ]);
});

test('flattenKeyValues renders unknown analysis shapes', () => {
  assert.deepEqual(flattenKeyValues({}), []);
  assert.deepEqual(flattenKeyValues({ risk_score: 91, nested: { flag: true } }), [
    { label: 'Risk Score', value: '91' },
    { label: 'Nested · Flag', value: 'true' },
  ]);
  assert.equal(flattenKeyValues({ tags: ['a', 'b'] })[0].value, 'a, b');
  assert.equal(flattenKeyValues({ a: 1, b: 2, c: 3 }, { limit: 2 }).length, 2);
});

test('explicitly empty reviewer fields do not inherit AI values', () => {
  const app = normalizeApp({ _id: 'app', review_details: { simple_report_description: '', reasoning: '', threat_types: [], legal_codes: [], recommended_action: '' }, analysis_results: { case_summary: 'AI summary', analysis: 'AI reasoning', threat_types: ['AI threat'], legal_codes: [{ code: 'AI law' }], recommended_action: 'AI action' } });
  const review = buildAppReviewModel(app, {});
  const analysis = buildAppAnalysisModel(app, {});
  assert.equal(review.caseSummary, '');
  assert.equal(review.reasoning, '');
  assert.deepEqual(review.threatTypes, []);
  assert.deepEqual(review.legalFindings, []);
  assert.equal(review.verdictLabel, '');
  assert.deepEqual(['summary', 'reasoning', 'violations', 'legal_codes', 'recommended_action'].map((key) => review.sources[key]), Array(5).fill('review'));
  assert.equal(analysis.aiSummary, 'AI summary');
  assert.equal(analysis.aiReasoning, 'AI reasoning');
  assert.equal(analysis.aiRecommendedAction, 'AI action');
});

test('AI-only app fields retain analysis provenance through the report models', () => {
  const app = normalizeApp({ _id: 'ai-app', analysis_results: { case_summary: 'AI summary', analysis: 'AI reasoning', threat_types: ['AI threat'], legal_codes: [{ code: 'AI law', description: 'AI explanation' }], recommended_action: 'review_listing' } });
  const review = buildAppReviewModel(app, {});
  assert.equal(review.caseSummary, 'AI summary');
  assert.equal(review.reasoning, 'AI reasoning');
  assert.deepEqual(review.threatTypes.map((item) => item.name), ['AI Threat']);
  assert.equal(review.legalFindings[0].code, 'AI law');
  assert.equal(review.verdictLabel, 'Review Listing');
  assert.deepEqual(['summary', 'reasoning', 'violations', 'legal_codes', 'recommended_action'].map((key) => review.sources[key]), Array(5).fill('analysis'));
});
