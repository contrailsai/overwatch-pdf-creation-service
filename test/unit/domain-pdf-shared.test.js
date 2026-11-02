const test = require('node:test');
const assert = require('node:assert/strict');

require('@babel/register')({
  presets: ['@babel/preset-env', '@babel/preset-react'],
  extensions: ['.js', '.jsx'],
  cache: false,
});

const {
  domainAdsCount,
  collectDomainViolationChips,
  domainSeverityInfo,
  domainThreatScore,
  buildDomainReviewModel,
} = require('../../src/components/domainPdfShared');

const makeDomain = (overrides = {}) => ({
  _id: 'domain-1',
  domain_name: 'example.com',
  list: {
    occurrence_count: 2,
    risk_rank: 'high',
    effective_threat_score: 96,
    category: 'investment',
  },
  review_details: {
    threat_score: 96,
    threat_types: ['fraud'],
    flags: { fraud: true, 'unregistered broker': true, impersonation: false },
    legal_codes: [{ code: 'IT ACT 2000 - SECTION 66D', reasoning: '' }],
    reasoning: 'Domain age ~76 days.',
  },
  ...overrides,
});

test('domainAdsCount counts linked ads, never discovery occurrence_count', () => {
  assert.equal(domainAdsCount(makeDomain()), 0);
  assert.equal(domainAdsCount(makeDomain({ linked_ad_ids: [] })), 0);
  assert.equal(domainAdsCount(makeDomain({ linked_ad_ids: ['a', 'b'] })), 2);
  // occurrence_count: 2 must not leak through when no ads are linked.
  const noAds = makeDomain();
  assert.equal(noAds.list.occurrence_count, 2);
  assert.equal(domainAdsCount(noAds), 0);
});

test('collectDomainViolationChips titles cases, dedupes and carries project severity', () => {
  const domain = makeDomain({
    list: { occurrence_count: 0, threat_types: ['unregistered broker'] },
    review_details: {
      threat_types: ['unregistered broker', 'fraud'],
      flags: { fraud: true, hiring: true, safe: true },
      legal_codes: [{ code: 'BNS 318' }],
    },
  });
  const project = {
    project_details: { labels: [{ name: 'Fraud', severity: 'high' }] },
  };
  const chips = collectDomainViolationChips(domain, project);
  const names = chips.map((chip) => chip.name);

  assert.ok(names.includes('Fraud'));
  assert.ok(names.includes('Unregistered Broker'));
  assert.ok(names.includes('Hiring'));
  // true flags / threat types only, deduped, legal codes and `safe` excluded
  assert.equal(names.filter((name) => name.toLowerCase() === 'fraud').length, 1);
  assert.ok(!names.includes('safe'));
  assert.ok(!names.includes('Safe'));
  assert.ok(!names.some((name) => name.includes('BNS')));
  assert.equal(chips.find((chip) => chip.name === 'Fraud').severity, 'high');
  assert.equal(chips.find((chip) => chip.name === 'Unregistered Broker').severity, 'medium');
  // high severity sorts before medium
  assert.equal(chips[0].name, 'Fraud');
});

test('domainThreatScore prefers review score and falls back to list score', () => {
  assert.equal(domainThreatScore(makeDomain()), 96);
  assert.equal(
    domainThreatScore({ review_details: {}, list: { effective_threat_score: 41 } }),
    41,
  );
  assert.equal(domainThreatScore({ review_details: {}, list: {} }), null);
});

test('buildDomainReviewModel exposes a readable review model', () => {
  const review = buildDomainReviewModel(makeDomain(), {
    project_details: { labels: [{ name: 'Fraud', severity: 'high' }] },
  });
  assert.equal(review.risk.label, 'High Risk');
  assert.equal(review.threatScore, 96);
  assert.equal(review.category, 'investment');
  assert.equal(review.caseSummary, 'Domain age ~76 days.');
  assert.equal(review.legalCodes.length, 1);
  assert.ok(review.violations.some((chip) => chip.name === 'Fraud'));
  assert.equal(review.hasSignal, true);
});

test('domainSeverityInfo returns the shared theme tones', () => {
  assert.equal(domainSeverityInfo('high').color, '#F43F5E');
  assert.equal(domainSeverityInfo('low').color, '#F59E0B');
  assert.equal(domainSeverityInfo('medium').color, '#F97316');
  assert.equal(domainSeverityInfo('nonsense').color, '#64748B');
});
