const test = require('node:test');
const assert = require('node:assert/strict');
const {
  attachReportLander,
  clientVisibleCloakVariants,
  collectDomainViolations,
  domainHasCloaking,
  domainPageContent,
  domainVisitUrl,
  isDomainReviewed,
  landerImageSrc,
  landerLabel,
  MAX_SCREENSHOT_SLICES,
  SCREENSHOT_SUMMARY_RATIO,
  otherLanderVisitUrls,
  resolveReportLander,
  screenshotSlicePlan,
} = require('../../src/domain-display');

function makeDomain(overrides = {}) {
  return {
    _id: '6a8be234abdd8b24b75f1761',
    domain_name: 'dlescheit.com',
    discovery: { cloak_unlocked: true, first_seen_url: 'https://dlescheit.com/' },
    workflow: { client_status: 'open' },
    list: {
      reviewed_at: '2026-09-01T09:36:50.856Z',
      risk_rank: 'high',
      occurrence_count: 12,
      hosting_country: 'CA',
    },
    review_details: { threat_types: ['fraud'], threat_score: 96 },
    analysis_results: {
      screenshot: {
        s3_url: 'https://example.com/primary.png',
        label: 'pEl8X=origtupcls',
      },
      cloak_probe: {
        unlocked: true,
        variants: [
          {
            label: 'bare',
            url: 'https://dlescheit.com/',
            kind: 'unknown',
            differs_from_bare: false,
            screenshot: { s3_url: 'https://example.com/bare.png' },
          },
          {
            label: 'ad_name=ind37',
            url: 'https://dlescheit.com/?ad_name=ind37',
            kind: 'unknown',
            differs_from_bare: true,
            screenshot: { s3_url: 'https://example.com/ad.png' },
          },
          {
            label: 'pEl8X=origtupcls',
            url: 'https://dlescheit.com/?pEl8X=origtupcls',
            kind: 'scam',
            differs_from_bare: true,
            screenshot: { s3_url: 'https://example.com/scam.png' },
          },
        ],
      },
    },
    ...overrides,
  };
}

test('unique landers are bare or differs_from_bare', () => {
  const domain = makeDomain();
  const visible = clientVisibleCloakVariants(domain);
  assert.deepEqual(visible.map((v) => v.label), ['bare', 'ad_name=ind37', 'pEl8X=origtupcls']);
});

test('resolveReportLander prefers requested key when still visible', () => {
  const domain = attachReportLander(makeDomain(), 'bare');
  assert.equal(resolveReportLander(domain).label, 'bare');
  assert.equal(landerImageSrc(domain), 'https://example.com/bare.png');
  assert.equal(domainVisitUrl(domain), 'https://dlescheit.com/');
});

test('resolveReportLander falls back to first scam that differs from bare', () => {
  const domain = attachReportLander(makeDomain(), 'stale-key');
  assert.equal(domain.reportLander.label, 'pEl8X=origtupcls');
  assert.equal(landerImageSrc(domain), 'https://example.com/scam.png');
  assert.notEqual(landerImageSrc(domain), domain.analysis_results.screenshot.s3_url);
});

test('client_visible_variant_keys filters unique landers', () => {
  const domain = makeDomain({
    review_details: { client_visible_variant_keys: ['bare', 'pEl8X=origtupcls'], threat_types: ['fraud'] },
  });
  assert.deepEqual(clientVisibleCloakVariants(domain).map((v) => v.label), ['bare', 'pEl8X=origtupcls']);
});

test('domain with no cloak variants still resolves a primary screenshot', () => {
  const domain = attachReportLander(
    makeDomain({
      analysis_results: { screenshot: { s3_url: 'https://example.com/primary.png' } },
    }),
    'bare',
  );
  assert.equal(domain.reportLander, null);
  assert.equal(landerImageSrc(domain), 'https://example.com/primary.png');
  assert.equal(landerLabel(domain.reportLander), 'Bare');
});

test('domainHasCloaking and violations helpers', () => {
  const domain = makeDomain();
  assert.equal(domainHasCloaking(domain), true);
  assert.deepEqual(collectDomainViolations(domain), ['fraud']);
  assert.equal(isDomainReviewed(domain), true);
  assert.equal(isDomainReviewed({ list: {} }), false);
});

test('landerMediaImageUrls skips video files and keeps image rasters', () => {
  const { landerMediaImageUrls } = require('../../src/domain-display');
  const urls = landerMediaImageUrls({
    screenshot: { s3_url: 'https://example.com/hero.png' },
    media: {
      images: [
        { s3_url: 'https://example.com/og.png', content_type: 'image/png' },
        { s3_url: 'https://example.com/clip.mp4', content_type: 'video/mp4' },
      ],
      videos: [
        { s3_url: 'https://example.com/full.mp4', content_type: 'video/mp4' },
        { thumbnail: 'https://example.com/poster.jpg' },
      ],
    },
  });
  assert.deepEqual(urls, ['https://example.com/og.png', 'https://example.com/poster.jpg']);
});

test('screenshot extract boxes stay inside a tall screenshot', async () => {
  const sharp = require('sharp');
  const width = 200;
  const height = 900;
  const buffer = await sharp({
    create: { width, height, channels: 3, background: { r: 20, g: 40, b: 60 } },
  }).png().toBuffer();
  const plan = screenshotSlicePlan(width, height);
  const hero = await sharp(buffer)
    .extract({ left: 0, top: 0, width, height: plan.heroHeight })
    .toBuffer({ resolveWithObject: true });
  assert.equal(hero.info.height, plan.heroHeight);
  const last = plan.slices[plan.slices.length - 1];
  const tail = await sharp(buffer)
    .extract({ left: 0, top: last.top, width, height: last.height })
    .toBuffer({ resolveWithObject: true });
  assert.equal(tail.info.height, last.height);
  assert.ok(last.top + last.height <= height);
});

test('screenshotSlicePlan crops the first viewport and tiles the rest', () => {
  const short = screenshotSlicePlan(1440, 900);
  assert.equal(short.heroHeight, 900);
  assert.equal(short.slices.length, 1);

  const tall = screenshotSlicePlan(1440, 5000);
  assert.equal(tall.heroHeight, Math.round(1440 * 0.72));
  assert.equal(tall.slices[0].top, 0);
  assert.equal(tall.slices[0].height, tall.heroHeight);
  assert.ok(tall.slices.length >= 4);
  assert.ok(tall.slices.length <= 12);

  const veryTall = screenshotSlicePlan(1440, 40000);
  assert.equal(veryTall.slices.length, MAX_SCREENSHOT_SLICES);

  const summary = screenshotSlicePlan(1440, 5000, { heroRatio: SCREENSHOT_SUMMARY_RATIO });
  assert.equal(summary.heroHeight, Math.round(1440 * SCREENSHOT_SUMMARY_RATIO));
  assert.ok(summary.heroHeight < tall.heroHeight);
});

test('otherLanderVisitUrls lists the other unique lander URLs', () => {
  const domain = attachReportLander(makeDomain(), 'pEl8X=origtupcls');
  const urls = otherLanderVisitUrls(domain);
  assert.ok(urls.some((item) => item.url === 'https://dlescheit.com/'));
  assert.ok(urls.some((item) => item.url.includes('ad_name=ind37')));
  assert.equal(urls.some((item) => item.url.includes('pEl8X=origtupcls')), false);
});

test('domainPageContent prefers the selected lander title and description', () => {
  const domain = attachReportLander(
    makeDomain({
      analysis_results: {
        page_text: { title: 'Primary title', meta_description: 'Primary meta' },
        cloak_probe: {
          variants: [
            {
              label: 'bare',
              url: 'https://dlescheit.com/',
              differs_from_bare: false,
              screenshot: { s3_url: 'https://example.com/bare.png' },
            },
            {
              label: 'pEl8X=origtupcls',
              url: 'https://dlescheit.com/?pEl8X=origtupcls',
              kind: 'scam',
              differs_from_bare: true,
              title: 'Quantum AI',
              excerpt: 'Payouts already received.',
              page_text: {
                title: 'Quantum AI',
                meta_description: 'Exclusive financial program',
                headings: [{ tag: 'h1', text: 'Registration closes soon' }],
              },
              screenshot: { s3_url: 'https://example.com/scam.png' },
            },
          ],
        },
      },
    }),
    'pEl8X=origtupcls',
  );
  const content = domainPageContent(domain);
  assert.equal(content.title, 'Quantum AI');
  assert.equal(content.description, 'Exclusive financial program');
  assert.equal(content.excerpt, 'Payouts already received.');
  assert.deepEqual(content.headings, ['Registration closes soon']);
});
