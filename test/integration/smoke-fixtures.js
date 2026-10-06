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
    source: 'meta_ads_library',
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

function makeNormalizedApp(overrides = {}) {
  return {
    _id: '6ab65e0648deed136101ed92',
    developer_id: '6ab65dfaf2b0ece71b22380d',
    platform: 'google_play',
    package_id: 'com.bharatfunded.trade',
    original_url: 'https://play.google.com/store/apps/details?id=com.bharatfunded.trade&hl=en&gl=in',
    source_label: 'Play Store',
    created_at: '2026-09-25T11:41:46.577Z',
    sourced_at: '2026-09-29T12:02:54.118Z',
    updated_at: '2026-10-05T14:21:54.945Z',
    reviewed_at: null,
    update_history: [],
    client_status: 'open',
    processed: false,
    title: 'BharatFund Trader',
    summary: 'Prop trading challenges, live charts and funded account tracking in one app.',
    description: 'BharatFundedTrade is the official mobile app for traders taking evaluations.',
    icon_url: 'https://example.com/icon.png',
    header_url: 'https://example.com/header.jpg',
    screenshots: [{ url: 'https://example.com/shot-0.png' }, { url: 'https://example.com/shot-1.png' }],
    total_screenshots: 2,
    store: {
      installs: '100+',
      min_installs: 100,
      real_installs: 259,
      ratings: null,
      genre: 'Finance',
      content_rating: 'Rated for 3+',
      version: 'Varies with device',
      released: 'Jul 29, 2026',
      last_updated_on: '',
      price: 0,
      currency: 'INR',
      free: true,
      offers_iap: false,
      contains_ads: false,
      privacy_policy: 'https://bharathfundedtrader.com/privacy-policy',
      histogram: [0, 0, 0, 0, 0],
      categories: [],
      app_count: 2,
    },
    developer: {
      name: 'Setupfx',
      legal_name: 'SETUPFX24 LIMITED',
      email: 'setupfx24@gmail.com',
      legal_email: 'support24@setupfx24.com',
      website: '',
      phone: '+1 447-221-2745',
      address: '3 Area Glasgow City Centre, Fitzroy Place, GLASGOW, G3 7RH, United Kingdom',
      profile_url: 'https://play.google.com/store/apps/developer?id=Setupfx',
      platform_developer_id: 'Setupfx',
      platform_developer_internal_id: '5675535085972026117',
      app_count: 2,
      risk_rank: null,
    },
    review: {
      threat_score: null,
      risk_rank: null,
      threat_types: [],
      violation_flags: [],
      flags: {},
      legal_codes: [],
      reasoning: '',
      case_summary: '',
      verdict: null,
      recommended_action: null,
      reviewer_comments: '',
      reviewed_at: null,
    },
    permissions: [{ category: 'Camera', items: ['take pictures and videos'], totalItems: 1 }],
    data_safety: [
      { title: 'No data shared with third parties', detail: 'Learn more about how developers declare sharing' },
      { title: 'Data is encrypted in transit', detail: '' },
    ],
    evidence: {
      has_evidence: true,
      totalImages: 1,
      sections: [
        {
          title: 'Executive Summary',
          description: 'BharatFund Trader identified several potential red flags about the platform credibility.',
          images: [],
          totalImages: 0,
        },
        {
          title: 'Website Registration',
          description: 'The domain bharathfundedtrader.com was registered on 21 April 2026.',
          images: [{ slot: '1:0', url: 'https://example.com/evidence.png', filename: 'e.png', localPath: null }],
          totalImages: 1,
        },
      ],
    },
    analysis_results: {},
    client_notes: [],
    compressedImage: null,
    compressedScreenshots: [],
    ...overrides,
  };
}

function makeNormalizedAdProfile(overrides = {}) {
  return {
    _id: '6aa3b1a0f2b0ece71b211562',
    page_name: 'Sean Lins Tronto',
    display_name: 'Sean Lins Tronto',
    profile_url: 'https://www.facebook.com/61550428046545/',
    platform: 'meta',
    platform_page_id: '122093630048016766',
    is_verified: false,
    profile_pic: null,
    follower_count: 1,
    page_categories: ['Business'],
    biography: null,
    ad_count: 9,
    last_active_at: '2026-09-10T07:00:00.000Z',
    risk: 'high',
    risk_rank: 'high',
    violations: ['investment-scams', 'fraud'],
    threat_score: 95,
    case_summary:
      'The Facebook page "Sean Lins Tronto" ran 9 cloaked ads, disguised as "amazon.in", which redirected users to an investment scam promoting a "Quantum AI platform" with false government guarantees.',
    legal_codes: [
      {
        code: 'IT ACT 2000 - SECTION 66D',
        reasoning:
          "The advertiser's ads were disguised as \"amazon.in\" and used a cloaked landing page to deceive users.",
      },
      {
        code: 'Bharatiya Nyaya Sanhita 2023 - Section 318(4)',
        reasoning:
          'The advertiser promoted an investment scam promising unrealistic returns and a "100% government guarantee."',
      },
      {
        code: 'SEBI Act 1992 - Section 12(1B)',
        reasoning:
          'The "Quantum AI platform" appears to be an unregistered collective investment scheme.',
      },
    ],
    verdict: 'takedown',
    recommended_action: 'Page takedown',
    reasoning:
      'The Facebook page "Sean Lins Tronto" should be taken down due to its direct involvement in promoting a sophisticated investment scam. All 9 ads were deceptively disguised as "amazon.in" but cloaked to redirect users to quietmoonriver.com.',
    reviewer_comments: '',
    action: 'submit_to_client',
    reviewed_at: '2026-09-11T09:20:25.917Z',
    client_status: 'alerted',
    review_status: 'reviewed',
    review_details: {
      risk: 'high',
      violations: ['investment-scams', 'fraud'],
      threat_score: 95,
      case_summary:
        'The Facebook page "Sean Lins Tronto" ran 9 cloaked ads, disguised as "amazon.in", which redirected users to an investment scam promoting a "Quantum AI platform" with false government guarantees.',
      legal_codes: [
        {
          code: 'IT ACT 2000 - SECTION 66D',
          reasoning:
            "The advertiser's ads were disguised as \"amazon.in\" and used a cloaked landing page to deceive users.",
        },
        {
          code: 'Bharatiya Nyaya Sanhita 2023 - Section 318(4)',
          reasoning:
            'The advertiser promoted an investment scam promising unrealistic returns and a "100% government guarantee."',
        },
        {
          code: 'SEBI Act 1992 - Section 12(1B)',
          reasoning:
            'The "Quantum AI platform" appears to be an unregistered collective investment scheme.',
        },
      ],
      verdict: 'takedown',
      recommended_action: 'Page takedown',
      reasoning:
        'The Facebook page "Sean Lins Tronto" should be taken down due to its direct involvement in promoting a sophisticated investment scam.',
      reviewer_comments: '',
      reviewed_at: '2026-09-11T09:20:25.917Z',
    },
    list: { ad_count: 9, follower_count: 1, risk_rank: 'high', last_active_at: '2026-09-10T07:00:00.000Z' },
    enrichment: { page_categories: ['Business'], biography: null },
    workflow: { review_status: 'reviewed', client_status: 'alerted' },
    ...overrides,
  };
}

function makeAdProfileReportGroup(overrides = {}) {
  const { profile: profileOverrides, ads: adsOverride, domains: domainsOverride, ...rest } = overrides;
  const profile = makeNormalizedAdProfile(profileOverrides);
  const ads = adsOverride || [
    makeNormalizedAd({
      _id: 'ad-1',
      ad_profile_id: profile._id,
      linked_domain_ids: ['6a8be234abdd8b24b75f1761'],
      review_details: { threat_score: 99, threat_types: ['fraud'], reviewed_at: '2026-09-01T00:00:00.000Z' },
    }),
    makeNormalizedAd({
      _id: 'ad-2',
      ad_profile_id: profile._id,
      linked_domain_ids: ['6a8be234abdd8b24b75f1761'],
      review_details: { threat_score: 80, threat_types: ['investment-scams'], reviewed_at: '2026-09-01T00:00:00.000Z' },
    }),
  ];
  const domains = domainsOverride || [makeNormalizedDomain()];
  return {
    profile,
    ads,
    displayAds: ads.slice(0, 20),
    totalAdCount: ads.length,
    shownAdCount: Math.min(20, ads.length),
    adsCapped: ads.length > 20,
    domains,
    compressedProfilePic: null,
    compressedAdImages: ads.map(() => null),
    compressedDomainImages: domains.map(() => null),
    ...rest,
  };
}

module.exports = {
  makeProject,
  makeProfile,
  makeNormalizedPost,
  makeNormalizedAd,
  makeNormalizedDomain,
  makeNormalizedAdProfile,
  makeNormalizedApp,
  makeAdProfileReportGroup,
};
