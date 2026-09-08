/** Minimal in-memory shapes for PDF/DOCX smoke tests (not real DB data). */

function makeProject() {
  return {
    project_name: 'Overwatch Test Project',
    project_details: {
      labels: [
        { name: 'is_hate_speech', severity: 'high' },
        { name: 'is_fake_news', severity: 'medium' },
      ],
      legal_codes: [{ name: 'IT-66A', description: 'Sample IT Act description' }],
    },
  };
}

function makeProfile() {
  return {
    _id: 'profile-1',
    username: 'fixture_user',
    display_name: 'Fixture User',
    platform: 'instagram',
    profile_url: 'https://example.com/fixture_user',
    is_verified: true,
    metadata: {
      biography: 'Fixture profile biography',
      follower_count: 1234,
      following_count: 111,
      media_count: 55,
      account_creation_date: '2024-01-11T00:00:00.000Z',
      profile_pic: null,
      is_business: true,
      location: 'Mumbai',
    },
  };
}

function makeNormalizedPost(overrides = {}) {
  return {
    _id: 'post-1',
    created_at: '2025-01-01T10:00:00.000Z',
    posted_date: '2025-01-01T09:30:00.000Z',
    updated_at: '2025-01-01T11:00:00.000Z',
    platform: 'instagram',
    client_status: 'To Be Reviewed',
    caption: 'Fixture caption #fixture',
    signedImageUrl: null,
    original_url: 'https://example.com/post/1',
    post_id: 'P001',
    user: {
      username: 'fixture_user',
      full_name: 'Fixture User',
      follower_count: 1234,
    },
    review_details: {
      threat_score: 80,
      flags: { is_hate_speech: true },
      reasoning: 'Description: Sample reasoning line',
      legal_codes: [{ code: 'IT-66A', reasoning: 'Sample legal reason' }],
      reviewed_at: '2025-01-01T11:00:00.000Z',
      threat_types: ['is_hate_speech'],
    },
    analysis_results: {
      risk_score: 80,
      categorization_reason: 'Fallback categorization',
    },
    update_history: [
      {
        updated_by: 'ops@example.com',
        updated_at: '2025-01-01T11:30:00.000Z',
        changes_summary: 'Reviewed by analyst',
      },
    ],
    client_notes: [
      {
        email: 'ops@example.com',
        created_at: '2025-01-01T11:35:00.000Z',
        text: 'Escalated for review.',
      },
    ],
    stats: {
      like_count: 100,
      comment_count: 10,
      share_count: 5,
      view_count: 1000,
    },
    ...overrides,
  };
}

function makeNormalizedAd(overrides = {}) {
  return {
    _id: 'ad-1',
    created_at: '2026-08-13T07:59:18.590Z',
    sourcing_date: '2026-08-13T07:59:18.590Z',
    posted_date: '2026-08-10T07:00:00.000Z',
    start_date: '2026-08-10T07:00:00.000Z',
    end_date: '2026-08-10T07:00:00.000Z',
    platform: 'meta',
    client_status: 'open',
    caption: 'amazon.in',
    title: 'Explore New Ways Forward',
    raw_title: '{{product.description}}',
    body: '',
    cta_text: 'Sign up',
    cta_type: 'SIGN_UP',
    display_format: 'DPA',
    link_url: 'https://www.amazon.in/',
    original_url: 'https://www.facebook.com/ads/library/?id=1061241996416851',
    ad_id: '1061241996416851',
    is_active: true,
    impressions_text: '<100',
    publisher_platforms: ['FACEBOOK', 'INSTAGRAM'],
    card_count: 2,
    cards: [
      {
        title: 'Explore New Ways Forward',
        body: '',
        caption: 'amazon.in',
        cta_text: 'Sign Up',
        link_url: 'http://ilnkarip.com/?content_id=4',
      },
      {
        title: 'Explore New Ways Forward',
        body: '',
        caption: 'amazon.in',
        cta_text: 'Sign Up',
        link_url: 'http://ilnkarip.com/?content_id=3',
      },
    ],
    shown_hostname: 'amazon.in',
    card_hostnames: ['ilnkarip.com'],
    destination_mismatch: true,
    advertiser: {
      page_name: 'Brooks Hughes Quinn',
      profile_url: 'https://www.facebook.com/61552965517384/',
      page_like_count: 0,
      page_categories: ['Topic'],
      is_verified: false,
    },
    review_details: {
      threat_score: null,
      threat_types: [],
      flags: {},
      reviewed_at: null,
    },
    analysis_results: {},
    client_notes: [],
    poi_detected: false,
    contains_digital_created_media: false,
    contains_sensitive_content: false,
    ...overrides,
  };
}

function makeNormalizedDomain(overrides = {}) {
  const domain = {
    _id: '6a8be234abdd8b24b75f1761',
    domain_name: 'dlescheit.com',
    discovery: { cloak_unlocked: true, first_seen_url: 'https://dlescheit.com/' },
    workflow: { client_status: 'open', review_status: 'reviewed' },
    list: {
      reviewed_at: '2026-09-01T09:36:50.856Z',
      risk_rank: 'high',
      occurrence_count: 3216,
      hosting_country: 'CA',
      hosting_provider: 'Cloudflare',
      registrar: 'Namecheap',
      effective_threat_score: 96,
    },
    review_details: {
      threat_score: 96,
      threat_types: ['fraud'],
      reasoning: 'Cloaked investment scam lander impersonating public officials.',
      legal_codes: [{ code: 'IT-66D', reasoning: 'Cheating by personation' }],
    },
    analysis_results: {
      whois: { registrar: 'Namecheap', created_at: '2025-01-01T00:00:00.000Z', expires_at: '2027-01-01T00:00:00.000Z', privacy_protected: true },
      hosting: { provider: 'Cloudflare', country: 'CA', ip: '1.2.3.4', asn: 'AS13335' },
      ssl: { issuer: 'Google Trust Services', valid_to: '2026-12-01T00:00:00.000Z', is_valid: true },
      dns: { a: ['1.2.3.4'], nameservers: ['ns1.cloudflare.com'] },
      page_text: { title: 'Quantum AI', meta_description: 'Exclusive financial program' },
      redirect_chain: [{ url: 'https://dlescheit.com/', status_code: 200 }],
      screenshot: { s3_url: 'https://example.com/primary.png', label: 'pEl8X=origtupcls' },
      cloak_probe: {
        unlocked: true,
        variants: [
          {
            label: 'bare',
            url: 'https://dlescheit.com/',
            kind: 'unknown',
            differs_from_bare: false,
            screenshot: { s3_url: 'https://example.com/bare.png' },
            media: { images: [] },
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
              paragraphs: ['Payouts already received.', 'Minimum deposit 22000 INR.'],
            },
            screenshot: { s3_url: 'https://example.com/scam.png' },
            media: { images: [{ s3_url: 'https://example.com/og.png', alt: 'og' }] },
          },
        ],
      },
    },
    reportVariantKey: 'pEl8X=origtupcls',
    ...overrides,
  };
  const variants = domain.analysis_results?.cloak_probe?.variants || [];
  domain.reportLander = variants.find((v) => v.label === domain.reportVariantKey) || variants[0] || null;
  return domain;
}

module.exports = {
  makeProject,
  makeProfile,
  makeNormalizedPost,
  makeNormalizedAd,
  makeNormalizedDomain,
};
