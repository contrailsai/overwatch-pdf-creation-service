const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ObjectId } = require('mongodb');
const {
  validatePayload,
  generateReportHash,
  orderPostsByRequestedIds,
  normalizePost,
  normalizeProfile,
  normalizeAd,
  normalizeAdProfile,
  adSourceLinkLabel,
  resolvePostMediaUrl,
  resolveAdMediaUrl,
  resolveAdCardMediaUrls,
  pickMediaUrl,
  mapCaseEventToUpdateHistory,
  isAdReviewed,
  isAdProfileReviewed,
  sortAdsForProfileReport,
  sliceAdsForProfileReport,
  groupAdsAndDomainsByProfile,
} = require('../../src/core-utils');

const fixtureDir = path.join(__dirname, '../fixtures/v3');
const v3Post = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'post.json'), 'utf8'));
const v3CaseEvent = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'case_event.json'), 'utf8'));
const v3Profile = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'profile_tinytoontunes.json'), 'utf8'));
const v3Ad = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'ad.json'), 'utf8'));

test('validatePayload accepts a valid PDF payload', () => {
  const payload = {
    projectId: 'project-1',
    database_name: 'tenant_db',
    postIds: [new ObjectId().toString()],
    reportType: 'Detailed',
    reportFormat: 'pdf',
  };
  const result = validatePayload(payload);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validatePayload rejects invalid ObjectId values', () => {
  const payload = {
    projectId: 'project-1',
    database_name: 'tenant_db',
    postIds: ['not-an-object-id'],
    reportType: 'Detailed',
    reportFormat: 'pdf',
  };
  const result = validatePayload(payload);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /invalid ObjectId/i);
});

test('validatePayload rejects unsupported DOCX report type', () => {
  const payload = {
    projectId: 'project-1',
    database_name: 'tenant_db',
    postIds: [new ObjectId().toString()],
    reportType: 'Summary',
    reportFormat: 'docx',
  };
  const result = validatePayload(payload);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /DOCX is only supported/i);
});

test('validatePayload accepts SimpleProfile with docx', () => {
  const payload = {
    projectId: 'project-1',
    database_name: 'tenant_db',
    postIds: [new ObjectId().toString()],
    reportType: 'SimpleProfile',
    reportFormat: 'docx',
  };
  const result = validatePayload(payload);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validatePayload rejects SimpleProfile with pdf', () => {
  const payload = {
    projectId: 'project-1',
    database_name: 'tenant_db',
    postIds: [new ObjectId().toString()],
    reportType: 'SimpleProfile',
    reportFormat: 'pdf',
  };
  const result = validatePayload(payload);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /SimpleProfile is only supported with reportFormat docx/i);
});

test('validatePayload accepts SimpleCase with docx', () => {
  const payload = {
    projectId: 'project-1',
    database_name: 'tenant_db',
    postIds: [new ObjectId().toString()],
    reportType: 'SimpleCase',
    reportFormat: 'docx',
  };
  const result = validatePayload(payload);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validatePayload rejects SimpleCase with pdf', () => {
  const payload = {
    projectId: 'project-1',
    database_name: 'tenant_db',
    postIds: [new ObjectId().toString()],
    reportType: 'SimpleCase',
    reportFormat: 'pdf',
  };
  const result = validatePayload(payload);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /SimpleCase is only supported with reportFormat docx/i);
});

test('generateReportHash is deterministic regardless of post order', () => {
  const id1 = new ObjectId().toString();
  const id2 = new ObjectId().toString();
  const hashA = generateReportHash('project-1', [id1, id2], 'Detailed', '', 'pdf');
  const hashB = generateReportHash('project-1', [id2, id1], 'Detailed', '', 'pdf');
  assert.equal(hashA, hashB);
});

test('orderPostsByRequestedIds preserves request order', () => {
  const id1 = new ObjectId();
  const id2 = new ObjectId();
  const id3 = new ObjectId();
  const ordered = orderPostsByRequestedIds(
    [id3.toString(), id1.toString(), id2.toString()],
    [{ _id: id2 }, { _id: id1 }, { _id: id3 }],
  );
  assert.deepEqual(
    ordered.map((post) => post._id.toString()),
    [id3.toString(), id1.toString(), id2.toString()],
  );
});

test('resolvePostMediaUrl prefers content.media s3_url then original_url', () => {
  assert.equal(
    resolvePostMediaUrl(v3Post),
    'https://cxo-demo.s3.ap-south-1.amazonaws.com/facebook_data/122109709275055636/0.jpg',
  );
  assert.equal(
    resolvePostMediaUrl({
      content: { media: [{ original_url: 'https://example.com/orig.jpg' }] },
    }),
    'https://example.com/orig.jpg',
  );
  assert.equal(
    resolvePostMediaUrl({
      post_content: { media_urls: [{ s3_url: 'https://example.com/legacy.jpg' }] },
    }),
    'https://example.com/legacy.jpg',
  );
});

test('mapCaseEventToUpdateHistory maps actor/summary/occurred_at', () => {
  const mapped = mapCaseEventToUpdateHistory(v3CaseEvent);
  assert.equal(mapped.updated_by, null);
  assert.equal(mapped.updated_at, '2026-05-02T09:11:46.148Z');
  assert.match(mapped.changes_summary, /Takedown initiated/i);
});

test('normalizePost maps v3 fields into report shape', () => {
  const joinedProfile = {
    _id: '69dd135d0c0f759055410743',
    list: { follower_count: 1500 },
  };
  const history = [mapCaseEventToUpdateHistory(v3CaseEvent)];
  const normalized = normalizePost(v3Post, { joinedProfile, updateHistory: history });

  assert.equal(normalized._id, '69810f0b3c24564a2cb28467');
  assert.equal(normalized.post_id, '122109709275055636');
  assert.equal(normalized.platform, 'facebook');
  assert.equal(normalized.client_status, 'alerted');
  assert.equal(normalized.processed, true);
  assert.match(normalized.caption, /Lottery number/);
  assert.equal(normalized.user.username, 'Nita ambani   India ');
  assert.equal(normalized.user.follower_count, 1500);
  assert.equal(normalized.sourcing_date, '2026-02-02T20:54:34.920Z');
  assert.equal(normalized.created_at, '2026-02-02T20:54:34.920Z');
  assert.equal(normalized.takedown_info.status, 'under_review');
  assert.equal(normalized.stats.like_count, 6421);
  assert.equal(normalized.stats.comment_count, 312);
  assert.equal(normalized.stats.share_count, 88);
  assert.equal(normalized.stats.view_count, 1197);
  assert.equal(normalized.update_history.length, 1);
  assert.match(normalized.update_history[0].changes_summary, /Takedown initiated/i);
});

test('normalizePost maps top-level engagement when content.engagement is absent', () => {
  const normalized = normalizePost({
    _id: new ObjectId(),
    content: { caption: 'x' },
    engagement: {
      likes: 349,
      comments: 0,
      shares: 0,
      views: 12194,
      posted_at: '2026-08-24T08:30:25.000Z',
    },
  });
  assert.equal(normalized.stats.like_count, 349);
  assert.equal(normalized.stats.comment_count, 0);
  assert.equal(normalized.stats.share_count, 0);
  assert.equal(normalized.stats.view_count, 12194);
  assert.equal(normalized.posted_date, '2026-08-24T08:30:25.000Z');
});

test('normalizePost prefers content.engagement over top-level engagement', () => {
  const normalized = normalizePost({
    _id: new ObjectId(),
    content: {
      caption: 'x',
      engagement: { likes: 10, comments: 2, shares: 1, views: 100 },
    },
    engagement: { likes: 999, comments: 999, shares: 999, views: 999 },
  });
  assert.equal(normalized.stats.like_count, 10);
  assert.equal(normalized.stats.comment_count, 2);
  assert.equal(normalized.stats.share_count, 1);
  assert.equal(normalized.stats.view_count, 100);
});

test('normalizePost defaults client_status to open', () => {
  const normalized = normalizePost({
    _id: new ObjectId(),
    content: { caption: 'x' },
  });
  assert.equal(normalized.client_status, 'open');
  assert.equal(normalized.processed, false);
});

test('normalizeProfile maps enrichment/list into metadata', () => {
  const normalized = normalizeProfile(v3Profile);
  assert.equal(normalized.username, 'tinytoontunes');
  assert.equal(normalized.metadata.biography, 'Creating magic with 2D, 3D & AI videos!');
  assert.equal(normalized.metadata.follower_count, 8263);
  assert.equal(normalized.metadata.following_count, 8);
  assert.equal(normalized.metadata.media_count, 30);
  assert.equal(normalized.metadata.account_creation_date, '2024-01-11T00:00:00.000Z');
  assert.equal(
    normalized.metadata.profile_pic,
    'https://cxo-demo.s3.ap-south-1.amazonaws.com/profiles/instagram/tinytoontunes/0.jpg',
  );
});

test('normalizeProfile preserves existing metadata over enrichment', () => {
  const legacy = {
    _id: 'p1',
    username: 'legacy_user',
    metadata: {
      biography: 'Keep me',
      follower_count: 99,
      profile_pic: 'https://example.com/keep.jpg',
      account_creation_date: '2020-01-01T00:00:00.000Z',
    },
    enrichment: {
      biography: 'Ignore me',
      profile_pic_s3: 'https://example.com/ignore.jpg',
      account_created_at: '2021-01-01T00:00:00.000Z',
      following_count: 5,
    },
    list: { follower_count: 1 },
  };
  const normalized = normalizeProfile(legacy);
  assert.equal(normalized.metadata.biography, 'Keep me');
  assert.equal(normalized.metadata.follower_count, 99);
  assert.equal(normalized.metadata.profile_pic, 'https://example.com/keep.jpg');
  assert.equal(normalized.metadata.account_creation_date, '2020-01-01T00:00:00.000Z');
  assert.equal(normalized.metadata.following_count, 5);
});

test('validatePayload accepts entityType ads with adIds', () => {
  const payload = {
    projectId: 'SEBI',
    database_name: 'SEBI-Data-Search',
    entityType: 'ads',
    adIds: [v3Ad._id],
    reportType: 'Summary',
    reportFormat: 'pdf',
  };
  const result = validatePayload(payload);
  assert.equal(result.valid, true);
  assert.equal(result.entityType, 'ads');
  assert.deepEqual(result.entityIds, [v3Ad._id]);
});

test('validatePayload infers ads when adIds is present without entityType', () => {
  const result = validatePayload({
    projectId: 'SEBI',
    database_name: 'SEBI-Data-Search',
    adIds: [v3Ad._id],
    reportType: 'Detailed',
    reportFormat: 'pdf',
  });
  assert.equal(result.valid, true);
  assert.equal(result.entityType, 'ads');
});

test('validatePayload accepts ads IDs sent as postIds when entityType is ads', () => {
  const result = validatePayload({
    projectId: 'SEBI',
    database_name: 'SEBI-Data-Search',
    entityType: 'ads',
    postIds: [v3Ad._id],
    reportType: 'Summary',
    reportFormat: 'pdf',
  });
  assert.equal(result.valid, true);
  assert.equal(result.entityType, 'ads');
  assert.deepEqual(result.entityIds, [v3Ad._id]);
});

test('validatePayload rejects ads with DOCX', () => {
  const result = validatePayload({
    projectId: 'SEBI',
    database_name: 'SEBI-Data-Search',
    entityType: 'ads',
    adIds: [v3Ad._id],
    reportType: 'Summary',
    reportFormat: 'docx',
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /PDF only/i);
});

test('validatePayload rejects ads with Profile reportType', () => {
  const result = validatePayload({
    projectId: 'SEBI',
    database_name: 'SEBI-Data-Search',
    entityType: 'ads',
    adIds: [v3Ad._id],
    reportType: 'Profile',
    reportFormat: 'pdf',
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /Ads reports only support/i);
});

test('generateReportHash ads suffix differs from posts hash for the same IDs', () => {
  const ids = [v3Ad._id, '6a7d79869b3282bb5130f164'];
  const postsHash = generateReportHash('SEBI', ids, 'Summary', '', 'pdf');
  const postsHashExplicit = generateReportHash('SEBI', ids, 'Summary', '', 'pdf', 'posts');
  const adsHash = generateReportHash('SEBI', ids, 'Summary', '', 'pdf', 'ads');
  assert.equal(postsHash, postsHashExplicit);
  assert.notEqual(adsHash, postsHash);
});

test('validatePayload accepts entityType domains with domainIds', () => {
  const payload = {
    projectId: 'SEBI',
    database_name: 'SEBI-Data-Search',
    entityType: 'domains',
    domainIds: ['6a8be234abdd8b24b75f1761'],
    reportType: 'Summary',
    reportFormat: 'pdf',
    variantKeysByDomainId: { '6a8be234abdd8b24b75f1761': 'bare' },
  };
  const result = validatePayload(payload);
  assert.equal(result.valid, true);
  assert.equal(result.entityType, 'domains');
  assert.deepEqual(result.entityIds, ['6a8be234abdd8b24b75f1761']);
});

test('validatePayload infers domains when domainIds is present without entityType', () => {
  const result = validatePayload({
    projectId: 'SEBI',
    database_name: 'SEBI-Data-Search',
    domainIds: ['6a8be234abdd8b24b75f1761'],
    reportType: 'Detailed',
    reportFormat: 'pdf',
  });
  assert.equal(result.valid, true);
  assert.equal(result.entityType, 'domains');
});

test('validatePayload rejects domains with DOCX', () => {
  const result = validatePayload({
    projectId: 'SEBI',
    database_name: 'SEBI-Data-Search',
    entityType: 'domains',
    domainIds: ['6a8be234abdd8b24b75f1761'],
    reportType: 'Summary',
    reportFormat: 'docx',
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /PDF only/i);
});

test('validatePayload rejects domains with Single reportType', () => {
  const result = validatePayload({
    projectId: 'SEBI',
    database_name: 'SEBI-Data-Search',
    entityType: 'domains',
    domainIds: ['6a8be234abdd8b24b75f1761'],
    reportType: 'Single',
    reportFormat: 'pdf',
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /Domain reports only support/i);
});

test('generateReportHash domains extra differs by lander key and leaves posts/ads hashes unchanged', () => {
  const crypto = require('crypto');
  const ids = ['6a8be238abdd8b24b75f1779', '6a8be234abdd8b24b75f1761'];
  const postsHash = generateReportHash('SEBI', ids, 'Detailed', '', 'pdf');
  const adsHash = generateReportHash('SEBI', ids, 'Detailed', '', 'pdf', 'ads');
  const bareKeys = {
    '6a8be234abdd8b24b75f1761': 'bare',
    '6a8be238abdd8b24b75f1779': 'bare',
  };
  const scamKeys = {
    '6a8be234abdd8b24b75f1761': 'pEl8X=origtupcls',
    '6a8be238abdd8b24b75f1779': 'bare',
  };
  const bareHash = generateReportHash('SEBI', ids, 'Detailed', '', 'pdf', 'domains', bareKeys);
  const scamHash = generateReportHash('SEBI', ids, 'Detailed', '', 'pdf', 'domains', scamKeys);
  const extra = [...ids].map((id) => `${id}=${bareKeys[id] || ''}`).sort().join('|');
  const expectedRaw = `SEBI-${[...ids].sort().join(',')}-Detailed--pdf-domains-${extra}`;
  assert.equal(bareHash, crypto.createHash('sha256').update(expectedRaw).digest('hex'));
  assert.notEqual(bareHash, scamHash);
  assert.notEqual(bareHash, postsHash);
  assert.notEqual(bareHash, adsHash);
  assert.equal(postsHash, generateReportHash('SEBI', ids, 'Detailed', '', 'pdf', 'posts', scamKeys));
});

test('normalizeAd maps page name, cards, and destination mismatch', () => {
  const joinedProfile = {
    page_name: 'Brooks Hughes Quinn',
    display_name: 'Brooks Hughes Quinn',
    profile_url: 'https://www.facebook.com/61552965517384/',
    is_verified: false,
    list: { follower_count: 0 },
    enrichment: { page_like_count: 0, page_categories: ['Topic'] },
  };
  const normalized = normalizeAd(v3Ad, { joinedProfile, updateHistory: [] });

  assert.equal(normalized._id, '6a7d79609b3282bb5130f160');
  assert.equal(normalized.advertiser.page_name, 'Brooks Hughes Quinn');
  assert.equal(normalized.cta_text, 'Sign up');
  assert.equal(normalized.display_format, 'DPA');
  assert.equal(normalized.shown_hostname, 'amazon.in');
  assert.deepEqual(normalized.card_hostnames, ['ilnkarip.com']);
  assert.equal(normalized.destination_mismatch, true);
  assert.equal(normalized.cards.length, 2);
  assert.equal(normalized.cards[0].link_url, 'http://ilnkarip.com/?content_id=4');
  assert.equal(normalized.title, 'Explore New Ways Forward');
  assert.equal(normalized.raw_title, '{{product.description}}');
  assert.equal(
    normalized.media_url,
    'https://cxo-demo.s3.ap-south-1.amazonaws.com/meta_ads/1061241996416851/0/0.jpg',
  );
  assert.equal(
    normalized.cards[0].media_url,
    'https://cxo-demo.s3.ap-south-1.amazonaws.com/meta_ads/1061241996416851/0/0.jpg',
  );
});

test('pickMediaUrl prefers role thumbnail over earlier non-thumbnail media', () => {
  const url = pickMediaUrl([
    { type: 'image', role: 'card_image', s3_url: 'https://example.com/card.jpg' },
    { type: 'image', role: 'thumbnail', s3_url: 'https://example.com/thumb.jpg' },
  ]);
  assert.equal(url, 'https://example.com/thumb.jpg');
});

test('pickMediaUrl prefers label thumbnail and skips null-URL videos for image fallback', () => {
  const url = pickMediaUrl([
    { type: 'video', role: 'primary_video', s3_url: null },
    { type: 'image', label: 'thumbnail', original_url: 'https://example.com/from-label.jpg' },
  ]);
  assert.equal(url, 'https://example.com/from-label.jpg');
});

test('pickMediaUrl takes first image-like item when no thumbnail is present', () => {
  const url = pickMediaUrl([
    { type: 'video', role: 'primary_video', s3_url: 'https://example.com/video.mp4' },
    { type: 'image', role: 'card_image', s3_url: 'https://example.com/first-image.jpg' },
    { type: 'image', role: 'card_image', s3_url: 'https://example.com/second-image.jpg' },
  ]);
  assert.equal(url, 'https://example.com/first-image.jpg');
});

test('resolveAdMediaUrl prefers content.media thumbnail then falls back to first image', () => {
  const ad = {
    content: {
      media: [
        { type: 'video', role: 'primary_video', s3_url: null },
        { type: 'image', role: 'thumbnail', s3_url: 'https://example.com/thumb.jpg' },
        { type: 'image', role: 'card_image', s3_url: 'https://example.com/other.jpg' },
      ],
    },
  };
  assert.equal(resolveAdMediaUrl(ad), 'https://example.com/thumb.jpg');
});

test('resolveAdMediaUrl and resolveAdCardMediaUrls work on normalized ads without content', () => {
  const normalized = {
    media_url: 'https://example.com/top.jpg',
    cards: [
      { media_url: 'https://example.com/card-0.jpg' },
      { media_url: 'https://example.com/card-1.jpg' },
    ],
  };
  assert.equal(resolveAdMediaUrl(normalized), 'https://example.com/top.jpg');
  assert.deepEqual(resolveAdCardMediaUrls(normalized), [
    'https://example.com/card-0.jpg',
    'https://example.com/card-1.jpg',
  ]);
});

test('resolveAdMediaUrl falls back to normalized cards[].media_url when media_url missing', () => {
  const normalized = {
    cards: [{ media_url: 'https://example.com/only-card.jpg' }],
  };
  assert.equal(resolveAdMediaUrl(normalized), 'https://example.com/only-card.jpg');
});

test('resolveAdMediaUrl and normalizeAd skip null first carousel card', () => {
  const ad = {
    _id: 'carousel-null-first',
    content: {
      title: 'Carousel ad',
      media: [],
      cards: [
        { title: 'Card 1', media: [{ type: 'video', s3_url: null }], link_url: 'http://a.com/' },
        {
          title: 'Card 2',
          media: [{ type: 'image', s3_url: 'https://example.com/second-card.jpg' }],
          link_url: 'http://a.com/',
        },
      ],
    },
    list: {},
    review_details: {},
  };
  assert.equal(resolveAdMediaUrl(ad), 'https://example.com/second-card.jpg');
  assert.deepEqual(resolveAdCardMediaUrls(ad), [null, 'https://example.com/second-card.jpg']);

  const normalized = normalizeAd(ad);
  assert.equal(normalized.media_url, 'https://example.com/second-card.jpg');
  assert.equal(normalized.cards[0].media_url, null);
  assert.equal(normalized.cards[1].media_url, 'https://example.com/second-card.jpg');
  assert.equal(resolveAdMediaUrl(normalized), 'https://example.com/second-card.jpg');
});

test('normalizeAd exposes media_url from content.media thumbnail when present', () => {
  const normalized = normalizeAd({
    ...v3Ad,
    content: {
      ...v3Ad.content,
      media: [
        { type: 'image', role: 'card_image', s3_url: 'https://example.com/card.jpg' },
        { type: 'image', role: 'thumbnail', s3_url: 'https://example.com/thumb.jpg' },
      ],
    },
  });
  assert.equal(normalized.media_url, 'https://example.com/thumb.jpg');
});

test('normalizeAd falls back from template title to first real card title', () => {
  const normalized = normalizeAd({
    ...v3Ad,
    content: {
      ...v3Ad.content,
      title: '{{product.description}}',
      cards: [
        { title: '{{product.name}}', link_url: 'http://ilnkarip.com/' },
        { title: 'Explore New Ways Forward', link_url: 'http://ilnkarip.com/' },
      ],
    },
  });
  assert.equal(normalized.title, 'Explore New Ways Forward');
});

test('normalizeAd passes source and poi_names through', () => {
  const normalized = normalizeAd({
    ...v3Ad,
    source: 'meta_feed_link',
    original_url: 'https://www.facebook.com/123/posts/456/',
    list: { ...v3Ad.list, poi_detected: true },
    review_details: {
      poi_names: ['Mukesh Ambani', '', 'Nirmala Sitharaman'],
      threat_types: ['investment-scams'],
    },
  });
  assert.equal(normalized.source, 'meta_feed_link');
  assert.equal(normalized.poi_detected, true);
  assert.deepEqual(normalized.review_details.poi_names, ['Mukesh Ambani', 'Nirmala Sitharaman']);
});

test('adSourceLinkLabel distinguishes feed posts from ad library', () => {
  assert.equal(
    adSourceLinkLabel({
      source: 'meta_feed_link',
      original_url: 'https://www.facebook.com/100091616053265/posts/28316860154601634/',
    }),
    'View Post',
  );
  assert.equal(
    adSourceLinkLabel({
      source: 'meta_ads_library',
      original_url: 'https://www.facebook.com/ads/library/?id=1837313944110654',
    }),
    'Ad Library',
  );
  assert.equal(
    adSourceLinkLabel({
      original_url: 'https://www.facebook.com/ads/library/?id=1',
    }),
    'Ad Library',
  );
  assert.equal(
    adSourceLinkLabel({
      original_url: 'https://example.com/other',
    }),
    'View Source',
  );
});

test('validatePayload accepts entityType ad_profiles with adProfileIds', () => {
  const profileId = '6a9fb9abc911dc2962ccf3ef';
  const result = validatePayload({
    projectId: 'SEBI',
    database_name: 'SEBI-Data-Search',
    entityType: 'ad_profiles',
    adProfileIds: [profileId],
    reportType: 'Summary',
    reportFormat: 'pdf',
  });
  assert.equal(result.valid, true);
  assert.equal(result.entityType, 'ad_profiles');
  assert.deepEqual(result.entityIds, [profileId]);
});

test('validatePayload infers ad_profiles when adProfileIds is present without entityType', () => {
  const result = validatePayload({
    projectId: 'SEBI',
    database_name: 'SEBI-Data-Search',
    adProfileIds: ['6a9fb9abc911dc2962ccf3ef'],
    reportType: 'Summary',
    reportFormat: 'pdf',
  });
  assert.equal(result.valid, true);
  assert.equal(result.entityType, 'ad_profiles');
});

test('validatePayload rejects ad_profiles with DOCX', () => {
  const result = validatePayload({
    projectId: 'SEBI',
    database_name: 'SEBI-Data-Search',
    entityType: 'ad_profiles',
    adProfileIds: ['6a9fb9abc911dc2962ccf3ef'],
    reportType: 'Summary',
    reportFormat: 'docx',
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /PDF only/i);
});

test('validatePayload rejects ad_profiles with Detailed reportType', () => {
  const result = validatePayload({
    projectId: 'SEBI',
    database_name: 'SEBI-Data-Search',
    entityType: 'ad_profiles',
    adProfileIds: ['6a9fb9abc911dc2962ccf3ef'],
    reportType: 'Detailed',
    reportFormat: 'pdf',
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /Ad profile reports only support/i);
});

test('generateReportHash ad_profiles suffix differs from posts/ads hashes', () => {
  const crypto = require('crypto');
  const ids = ['6a9fb9abc911dc2962ccf3ef', '6a9fbb6cc911dc2962ccf400'];
  const postsHash = generateReportHash('SEBI', ids, 'Summary', '', 'pdf');
  const adsHash = generateReportHash('SEBI', ids, 'Summary', '', 'pdf', 'ads');
  const profilesHash = generateReportHash('SEBI', ids, 'Summary', '', 'pdf', 'ad_profiles');
  const expectedRaw = `SEBI-${[...ids].sort().join(',')}-Summary--pdf-ad_profiles`;
  assert.equal(profilesHash, crypto.createHash('sha256').update(expectedRaw).digest('hex'));
  assert.notEqual(profilesHash, postsHash);
  assert.notEqual(profilesHash, adsHash);
});

test('isAdReviewed and isAdProfileReviewed use review timestamps/status', () => {
  assert.equal(isAdReviewed({ list: { reviewed_at: '2026-09-01T00:00:00.000Z' } }), true);
  assert.equal(isAdReviewed({ list: { reviewed_at: null } }), false);
  assert.equal(isAdProfileReviewed({ workflow: { review_status: 'reviewed' } }), true);
  assert.equal(isAdProfileReviewed({ workflow: { review_status: 'pending' } }), false);
  assert.equal(
    isAdProfileReviewed({ workflow: { review_status: 'pending' }, review_details: { reviewed_at: '2026-09-01' } }),
    true,
  );
});

test('sortAdsForProfileReport prefers threat score then feed then recency', () => {
  const ads = [
    {
      _id: 'old-feed-low',
      review_details: { threat_score: 40 },
      publisher_platforms: ['FACEBOOK'],
      posted_date: '2026-01-01T00:00:00.000Z',
    },
    {
      _id: 'new-messenger-high',
      review_details: { threat_score: 99 },
      publisher_platforms: ['MESSENGER'],
      posted_date: '2026-09-01T00:00:00.000Z',
    },
    {
      _id: 'new-feed-high',
      review_details: { threat_score: 99 },
      publisher_platforms: ['INSTAGRAM'],
      posted_date: '2026-09-02T00:00:00.000Z',
    },
    {
      _id: 'older-feed-high',
      review_details: { threat_score: 99 },
      publisher_platforms: ['FACEBOOK'],
      posted_date: '2026-08-01T00:00:00.000Z',
    },
  ];
  const sorted = sortAdsForProfileReport(ads);
  assert.deepEqual(
    sorted.map((ad) => ad._id),
    ['new-feed-high', 'older-feed-high', 'new-messenger-high', 'old-feed-low'],
  );
});

test('sliceAdsForProfileReport caps at 20 and reports totals', () => {
  const ads = Array.from({ length: 25 }, (_, i) => ({
    _id: `ad-${i}`,
    review_details: { threat_score: i },
    publisher_platforms: ['FACEBOOK'],
    posted_date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
  }));
  const sliced = sliceAdsForProfileReport(ads);
  assert.equal(sliced.totalCount, 25);
  assert.equal(sliced.shownCount, 20);
  assert.equal(sliced.displayAds.length, 20);
  assert.equal(sliced.capped, true);
  assert.equal(sliced.displayAds[0]._id, 'ad-24');
});

test('normalizeAdProfile maps page identity and review fields', () => {
  const normalized = normalizeAdProfile({
    _id: '6a9fb9abc911dc2962ccf3ef',
    page_name: 'Scam Page',
    display_name: 'Scam Page',
    profile_url: 'https://www.facebook.com/123/',
    is_verified: false,
    enrichment: {
      profile_pic_s3: 'https://example.com/pic.jpg',
      page_like_count: 12,
      page_categories: ['Business'],
      biography: 'Sample bio',
    },
    list: { follower_count: 12, risk_rank: 'high', ad_count: 160, last_active_at: '2026-09-01T07:00:00.000Z' },
    review_details: {
      risk: 'high',
      violations: ['fraud'],
      threat_score: 95,
      case_summary: 'Page ran cloaked investment scam ads.',
      legal_codes: [
        { code: 'IT ACT 2000 - SECTION 66D', reasoning: 'Personation via computer resource.' },
      ],
      verdict: 'takedown',
      recommended_action: 'Page takedown',
      reasoning: 'Detailed reviewer reasoning.',
      reviewer_comments: 'Escalate',
      reviewed_at: '2026-09-02T12:00:20.850Z',
    },
    workflow: { review_status: 'reviewed', client_status: 'alerted' },
  });
  assert.equal(normalized._id, '6a9fb9abc911dc2962ccf3ef');
  assert.equal(normalized.page_name, 'Scam Page');
  assert.equal(normalized.profile_pic, 'https://example.com/pic.jpg');
  assert.equal(normalized.risk, 'high');
  assert.deepEqual(normalized.violations, ['fraud']);
  assert.equal(normalized.threat_score, 95);
  assert.equal(normalized.case_summary, 'Page ran cloaked investment scam ads.');
  assert.equal(normalized.recommended_action, 'Page takedown');
  assert.equal(normalized.verdict, 'takedown');
  assert.equal(normalized.biography, 'Sample bio');
  assert.deepEqual(normalized.page_categories, ['Business']);
  assert.equal(normalized.legal_codes.length, 1);
  assert.equal(normalized.legal_codes[0].code, 'IT ACT 2000 - SECTION 66D');
  assert.equal(normalized.reasoning, 'Detailed reviewer reasoning.');
  assert.equal(normalized.reviewer_comments, 'Escalate');
});

test('groupAdsAndDomainsByProfile attaches domains and caps display ads', () => {
  const profiles = [{ _id: 'prof-1' }];
  const ads = Array.from({ length: 22 }, (_, i) => ({
    _id: `ad-${i}`,
    ad_profile_id: 'prof-1',
    linked_domain_ids: i < 2 ? ['dom-1'] : ['dom-2'],
    review_details: { threat_score: i },
    publisher_platforms: ['FACEBOOK'],
    posted_date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
  }));
  const domainsById = new Map([
    ['dom-1', { _id: 'dom-1', domain_name: 'a.com' }],
    ['dom-2', { _id: 'dom-2', domain_name: 'b.com' }],
  ]);
  const grouped = groupAdsAndDomainsByProfile(profiles, ads, domainsById);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].totalAdCount, 22);
  assert.equal(grouped[0].shownAdCount, 20);
  assert.equal(grouped[0].displayAds.length, 20);
  assert.equal(grouped[0].domains.length, 2);
});
