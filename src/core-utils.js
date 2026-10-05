const crypto = require('crypto');
const { ObjectId } = require('mongodb');

const SUPPORTED_REPORT_TYPES = new Set(['Detailed', 'Single', 'Profile', 'SimpleProfile', 'SimpleCase', 'Summary']);
const DOCX_SUPPORTED_REPORT_TYPES = new Set(['Detailed', 'Single', 'Profile', 'SimpleProfile', 'SimpleCase']);
const DOCX_ONLY_REPORT_TYPES = new Set(['SimpleProfile', 'SimpleCase']);
const SUPPORTED_ENTITY_TYPES = new Set(['posts', 'ads', 'domains', 'ad_profiles']);
const ADS_SUPPORTED_REPORT_TYPES = new Set(['Summary', 'Detailed']);
const DOMAINS_SUPPORTED_REPORT_TYPES = new Set(['Summary', 'Detailed']);
const AD_PROFILES_SUPPORTED_REPORT_TYPES = new Set(['Summary']);
const MAX_PROFILE_REPORT_ADS = 20;

function entityIdFieldName(entityType) {
  if (entityType === 'ads') return 'adIds';
  if (entityType === 'domains') return 'domainIds';
  if (entityType === 'ad_profiles') return 'adProfileIds';
  return 'postIds';
}

function resolveEntityType(payload) {
  const explicit = payload?.entityType ? String(payload.entityType).toLowerCase() : '';
  if (explicit === 'ads' || explicit === 'ad') return 'ads';
  if (explicit === 'domains' || explicit === 'domain') return 'domains';
  if (explicit === 'ad_profiles' || explicit === 'ad_profile' || explicit === 'adprofiles') return 'ad_profiles';
  if (explicit === 'posts' || explicit === 'post') return 'posts';
  if (Array.isArray(payload?.adProfileIds) && payload.adProfileIds.length > 0) return 'ad_profiles';
  if (Array.isArray(payload?.domainIds) && payload.domainIds.length > 0) return 'domains';
  if (Array.isArray(payload?.adIds) && payload.adIds.length > 0) return 'ads';
  return 'posts';
}

function resolveEntityIds(payload) {
  const entityType = resolveEntityType(payload);
  if (entityType === 'ads') {
    if (Array.isArray(payload?.adIds) && payload.adIds.length > 0) return payload.adIds;
    return payload?.postIds;
  }
  if (entityType === 'domains') {
    if (Array.isArray(payload?.domainIds) && payload.domainIds.length > 0) return payload.domainIds;
    return payload?.postIds;
  }
  if (entityType === 'ad_profiles') {
    if (Array.isArray(payload?.adProfileIds) && payload.adProfileIds.length > 0) return payload.adProfileIds;
    return payload?.postIds;
  }
  return payload?.postIds;
}

function buildDomainHashExtra(domainIds, variantKeysByDomainId) {
  const map = variantKeysByDomainId && typeof variantKeysByDomainId === 'object' ? variantKeysByDomainId : {};
  return [...(domainIds || [])]
    .map((id) => `${id}=${map[id] || ''}`)
    .sort()
    .join('|');
}

function generateReportHash(
  projectId,
  postIds,
  reportType,
  profileId = '',
  reportFormat = 'pdf',
  entityType = 'posts',
  variantKeysByDomainId = null,
) {
  const sortedIds = [...postIds].sort();
  const entitySuffix = entityType && entityType !== 'posts' ? `-${entityType}` : '';
  const rawString = `${projectId}-${sortedIds.join(',')}-${reportType}-${profileId}-${reportFormat}${entitySuffix}`;
  if (entityType === 'domains') {
    const extra = buildDomainHashExtra(postIds, variantKeysByDomainId);
    return crypto.createHash('sha256').update(`${rawString}-${extra}`).digest('hex');
  }
  return crypto.createHash('sha256').update(rawString).digest('hex');
}

function validatePayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Payload must be a valid JSON object'] };
  }

  const { projectId, reportType, reportFormat, database_name } = payload;
  const normalizedReportFormat = (reportFormat || 'pdf').toLowerCase();
  const entityType = resolveEntityType(payload);
  const entityIds = resolveEntityIds(payload);

  if (!projectId || typeof projectId !== 'string') {
    errors.push('projectId is required and must be a string');
  }
  if (!database_name || typeof database_name !== 'string') {
    errors.push('database_name is required and must be a string');
  }
  if (!SUPPORTED_ENTITY_TYPES.has(entityType)) {
    errors.push(`entityType must be one of: ${Array.from(SUPPORTED_ENTITY_TYPES).join(', ')}`);
  }
  if (!Array.isArray(entityIds) || entityIds.length === 0) {
    if (entityType === 'ads') errors.push('adIds or postIds must be a non-empty array');
    else if (entityType === 'domains') errors.push('domainIds or postIds must be a non-empty array');
    else if (entityType === 'ad_profiles') errors.push('adProfileIds or postIds must be a non-empty array');
    else errors.push('postIds must be a non-empty array');
  }
  if (!reportType || typeof reportType !== 'string' || !SUPPORTED_REPORT_TYPES.has(reportType)) {
    errors.push(`reportType must be one of: ${Array.from(SUPPORTED_REPORT_TYPES).join(', ')}`);
  }
  if (entityType === 'ads' && reportType && !ADS_SUPPORTED_REPORT_TYPES.has(reportType)) {
    errors.push(`Ads reports only support: ${Array.from(ADS_SUPPORTED_REPORT_TYPES).join(', ')}`);
  }
  if (entityType === 'domains' && reportType && !DOMAINS_SUPPORTED_REPORT_TYPES.has(reportType)) {
    errors.push(`Domain reports only support: ${Array.from(DOMAINS_SUPPORTED_REPORT_TYPES).join(', ')}`);
  }
  if (entityType === 'ad_profiles' && reportType && !AD_PROFILES_SUPPORTED_REPORT_TYPES.has(reportType)) {
    errors.push(`Ad profile reports only support: ${Array.from(AD_PROFILES_SUPPORTED_REPORT_TYPES).join(', ')}`);
  }
  if (!['pdf', 'docx'].includes(normalizedReportFormat)) {
    errors.push('reportFormat must be either pdf or docx');
  }
  if (entityType === 'ads' && normalizedReportFormat === 'docx') {
    errors.push('Ads reports currently support PDF only');
  }
  if (entityType === 'domains' && normalizedReportFormat === 'docx') {
    errors.push('Domain reports currently support PDF only');
  }
  if (entityType === 'ad_profiles' && normalizedReportFormat === 'docx') {
    errors.push('Ad profile reports currently support PDF only');
  }
  if (normalizedReportFormat === 'docx' && !DOCX_SUPPORTED_REPORT_TYPES.has(reportType)) {
    errors.push(`DOCX is only supported for: ${Array.from(DOCX_SUPPORTED_REPORT_TYPES).join(', ')}`);
  }
  if (DOCX_ONLY_REPORT_TYPES.has(reportType) && normalizedReportFormat !== 'docx') {
    errors.push(`${reportType} is only supported with reportFormat docx`);
  }
  if (Array.isArray(entityIds)) {
    const invalidIds = entityIds.filter((id) => !ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      const fieldName = entityIdFieldName(entityType);
      errors.push(`${fieldName} contains invalid ObjectId values (${invalidIds.slice(0, 5).join(', ')})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    normalizedReportFormat,
    entityType,
    entityIds: Array.isArray(entityIds) ? entityIds : [],
  };
}

function orderPostsByRequestedIds(postIds, postsFromDb) {
  const postsById = new Map(postsFromDb.map((post) => [post._id.toString(), post]));
  return postIds.map((id) => postsById.get(id.toString())).filter(Boolean);
}

function toIsoOrNull(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Resolve the first media URL for a post (v3 content.media, then legacy paths).
 * V3 samples have s3_url / original_url only — no `url` field.
 */
function resolvePostMediaUrl(post) {
  if (!post) return null;

  const v3Media = post.content?.media;
  if (Array.isArray(v3Media) && v3Media.length > 0) {
    const first = v3Media[0];
    if (first?.s3_url || first?.original_url) {
      return first.s3_url || first.original_url;
    }
  }

  const legacyMedia = post.post_content?.media_urls;
  if (Array.isArray(legacyMedia) && legacyMedia.length > 0) {
    const first = legacyMedia[0];
    if (first?.s3_url || first?.url) {
      return first.s3_url || first.url;
    }
  }

  return post.s3_url || post.image_url || null;
}

/**
 * Map a case_events row to the legacy update_history entry shape used by report UIs.
 */
function mapCaseEventToUpdateHistory(event) {
  if (!event) return null;
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
  return {
    updated_by: event.actor || payload.updated_by || payload.created_by || null,
    updated_at: toIsoOrNull(event.occurred_at || payload.updated_at || payload.date || payload.created_at),
    changes_summary:
      event.summary || payload.changes_summary || payload.details || payload.event || event.event_type || '',
  };
}

/**
 * Normalize a profile for report renderers.
 * Prefer existing metadata.* (legacy UI payload); fill gaps from v3 list.* / enrichment.*.
 */
function normalizeProfile(profile) {
  if (!profile) return null;

  const existingMeta = profile.metadata && typeof profile.metadata === 'object' ? profile.metadata : {};
  const enrichment = profile.enrichment && typeof profile.enrichment === 'object' ? profile.enrichment : {};
  const list = profile.list && typeof profile.list === 'object' ? profile.list : {};

  const metadata = {
    ...existingMeta,
    biography: existingMeta.biography ?? enrichment.biography ?? null,
    follower_count: existingMeta.follower_count ?? list.follower_count ?? null,
    following_count: existingMeta.following_count ?? enrichment.following_count ?? null,
    media_count: existingMeta.media_count ?? enrichment.media_count ?? null,
    account_creation_date: existingMeta.account_creation_date ?? enrichment.account_created_at ?? null,
    profile_pic:
      existingMeta.profile_pic || enrichment.profile_pic_s3 || enrichment.profile_pic || null,
    location: existingMeta.location ?? list.location ?? null,
    is_business: existingMeta.is_business ?? enrichment.is_business ?? null,
    category: existingMeta.category ?? enrichment.category ?? null,
  };

  return {
    ...profile,
    metadata,
  };
}

/**
 * Normalize a post into the stable shape report layouts expect.
 * @param {object} post Raw Mongo post (v3 or legacy)
 * @param {object} [opts]
 * @param {object} [opts.joinedProfile] Profile doc joined via profile_id
 * @param {Array} [opts.updateHistory] Prefetched case_events mapped to update_history
 */
function normalizePost(post, opts = {}) {
  const { joinedProfile = null, updateHistory = null } = opts;
  const list = post.list || {};
  const system = post.system || {};
  const workflow = post.workflow || {};
  const author = post.author_snapshot || {};
  const embeddedProfile = post.profile || {};
  const content = post.content || {};

  const clientStatus = workflow.client_status || post.client_status || 'open';
  const processed =
    Boolean(post.processed) ||
    Boolean(workflow.alerted_at) ||
    clientStatus === 'alerted';

  let history;
  if (Array.isArray(updateHistory)) {
    history = updateHistory.map((update) => ({
      ...update,
      updated_at: toIsoOrNull(update.updated_at),
    }));
  } else if (Array.isArray(post.metadata?.update_history)) {
    history = post.metadata.update_history.map((update) => ({
      ...update,
      updated_at: toIsoOrNull(update.updated_at),
    }));
  } else {
    history = [];
  }

  const followerFromJoined =
    joinedProfile?.list?.follower_count ??
    joinedProfile?.metadata?.follower_count ??
    joinedProfile?.follower_count ??
    null;

  // V3: per-metric counts live under content.engagement (e.g. Rajasthan);
  // Ambani/legacy still use top-level engagement.
  const engagement = content.engagement || post.engagement || {};

  return {
    _id: post._id.toString(),
    created_at: toIsoOrNull(system.created_at ?? post.metadata?.created_at),
    sourcing_date: toIsoOrNull(list.sourced_at ?? post.metadata?.sourcing_date),
    posted_date: toIsoOrNull(
      list.posted_at ??
        engagement.posted_at ??
        post.engagement?.posted_at ??
        post.metadata?.posted_date,
    ),
    taken_at: content.taken_at || post.post_content?.taken_at || post.taken_at || null,
    updated_at: toIsoOrNull(system.updated_at ?? post.metadata?.updated_at),
    reviewed_at: toIsoOrNull(
      list.reviewed_at ?? post.review_details?.reviewed_at,
    ),
    update_history: history,
    platform: post.platform ? post.platform.toLowerCase() : 'instagram',
    processed,
    client_status: clientStatus,
    caption: content.caption || post.post_content?.caption || post.caption || '',
    signedImageUrl: null,
    original_url: post.original_url,
    post_id: post.platform_post_id || post.post_id || post.code,
    user: {
      username:
        author.username ||
        embeddedProfile.username ||
        post.user?.username ||
        'Unknown',
      full_name: author.display_name || embeddedProfile.display_name || '',
      profile_pic_url:
        author.profile_url ||
        embeddedProfile.profile_pic_url ||
        embeddedProfile.profile_url ||
        '',
      is_verified: Boolean(author.is_verified ?? embeddedProfile.is_verified ?? false),
      follower_count:
        followerFromJoined ??
        embeddedProfile.metadata?.follower_count ??
        embeddedProfile.follower_count ??
        null,
    },
    assigned_to: post?.assigned_to || null,
    content_reviewed_by: post?.content_reviewed_by || null,
    review_details: post.review_details || null,
    takedown_info: post.takedown || post.takedown_info || null,
    analysis_results: post.analysis_results || null,
    client_notes: post.client_notes || [],
    stats: {
      like_count: engagement.likes || 0,
      comment_count: engagement.comments || 0,
      share_count: engagement.shares || 0,
      view_count: engagement.views || 0,
    },
  };
}

function extractHostname(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    const hostname = new URL(withProto).hostname.replace(/^www\./i, '').toLowerCase();
    return hostname || null;
  } catch {
    return null;
  }
}

function isTemplatePlaceholder(text) {
  return typeof text === 'string' && /\{\{[^}]+\}\}/.test(text);
}

function mediaItemUrl(item) {
  if (!item || typeof item !== 'object') return null;
  return item.s3_url || item.original_url || null;
}

function isThumbnailMedia(item) {
  if (!item || typeof item !== 'object') return false;
  const role = typeof item.role === 'string' ? item.role.toLowerCase() : '';
  const label = typeof item.label === 'string' ? item.label.toLowerCase() : '';
  return role === 'thumbnail' || label === 'thumbnail';
}

function isImageLikeMedia(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.type == null || item.type === '') return true;
  return String(item.type).toLowerCase() === 'image';
}

/**
 * Prefer thumbnail-labeled media, else first image-like item, else first URL.
 * @param {Array} mediaItems
 * @returns {string|null}
 */
function pickMediaUrl(mediaItems) {
  if (!Array.isArray(mediaItems) || mediaItems.length === 0) return null;

  for (const item of mediaItems) {
    if (!isThumbnailMedia(item)) continue;
    const url = mediaItemUrl(item);
    if (url) return url;
  }

  for (const item of mediaItems) {
    if (!isImageLikeMedia(item)) continue;
    const url = mediaItemUrl(item);
    if (url) return url;
  }

  for (const item of mediaItems) {
    const url = mediaItemUrl(item);
    if (url) return url;
  }

  return null;
}

/**
 * Resolve the first creative image for an ad (flattened content.media, then first card).
 * Also supports normalized ads that expose media_url / cards[].media_url.
 */
function resolveAdMediaUrl(ad) {
  if (!ad) return null;

  const fromContentMedia = pickMediaUrl(ad.content?.media);
  if (fromContentMedia) return fromContentMedia;

  const rawCards = ad.content?.cards;
  if (Array.isArray(rawCards) && rawCards.length > 0) {
    for (const card of rawCards) {
      const fromCardMedia = pickMediaUrl(card?.media);
      if (fromCardMedia) return fromCardMedia;
    }
  }

  if (typeof ad.media_url === 'string' && ad.media_url) return ad.media_url;

  const normalizedCards = Array.isArray(ad.cards) ? ad.cards : [];
  for (const card of normalizedCards) {
    if (typeof card?.media_url === 'string' && card.media_url) return card.media_url;
  }

  return null;
}

/**
 * Resolve one image URL per carousel card (DPA / multi-asset ads).
 */
function resolveAdCardMediaUrls(ad) {
  const rawCards = ad?.content?.cards;
  if (Array.isArray(rawCards) && rawCards.length > 0) {
    return rawCards.map((card) => pickMediaUrl(card?.media));
  }

  const normalizedCards = Array.isArray(ad?.cards) ? ad.cards : [];
  if (normalizedCards.length > 0) {
    return normalizedCards.map((card) =>
      typeof card?.media_url === 'string' && card.media_url ? card.media_url : null,
    );
  }

  const fallback = resolveAdMediaUrl(ad);
  return fallback ? [fallback] : [];
}

function normalizeAdReviewDetails(ad) {
  const list = ad.list || {};
  const review = ad.review_details && typeof ad.review_details === 'object' ? ad.review_details : {};
  const analysis = ad.analysis_results && typeof ad.analysis_results === 'object' ? ad.analysis_results : {};
  const reviewThreatTypes = Array.isArray(review.threat_types) ? review.threat_types : [];
  const listThreatTypes = Array.isArray(list.threat_types) ? list.threat_types : [];

  return {
    ...review,
    threat_score:
      review.threat_score ??
      list.review_threat_score ??
      list.effective_threat_score ??
      analysis.risk_score ??
      null,
    threat_types: reviewThreatTypes.length > 0 ? reviewThreatTypes : listThreatTypes,
    flags: review.flags && typeof review.flags === 'object' ? review.flags : {},
    poi_names: Array.isArray(review.poi_names)
      ? review.poi_names.map((name) => String(name || '').trim()).filter(Boolean)
      : [],
    reviewed_at: review.reviewed_at ?? list.reviewed_at ?? null,
  };
}

/**
 * Human label for an ad's original_url link (Ad Library vs feed post vs generic).
 */
function adSourceLinkLabel(ad) {
  const source = String(ad?.source || '').toLowerCase();
  const url = String(ad?.original_url || '');
  if (source === 'meta_feed_link' || /\/posts\//i.test(url)) return 'View Post';
  if (source === 'meta_ads_library' || /ads\/library/i.test(url)) return 'Ad Library';
  return url ? 'View Source' : '';
}

/**
 * Normalize an Ads document into the stable shape Ads report layouts expect.
 * @param {object} ad Raw Mongo ad
 * @param {object} [opts]
 * @param {object} [opts.joinedProfile] ad_profiles doc joined via ad_profile_id
 * @param {Array} [opts.updateHistory] Prefetched case_events mapped to update_history
 */
function normalizeAd(ad, opts = {}) {
  const { joinedProfile = null, updateHistory = null } = opts;
  const list = ad.list || {};
  const system = ad.system || {};
  const workflow = ad.workflow || {};
  const advertiser = ad.advertiser_snapshot || {};
  const content = ad.content || {};
  const delivery = ad.ad_delivery || {};
  const analysis = ad.analysis_results && typeof ad.analysis_results === 'object' ? ad.analysis_results : {};

  const clientStatus = workflow.client_status || ad.client_status || 'open';
  const processed =
    Boolean(ad.processed) ||
    Boolean(workflow.alerted_at) ||
    clientStatus === 'alerted';

  let history;
  if (Array.isArray(updateHistory)) {
    history = updateHistory.map((update) => ({
      ...update,
      updated_at: toIsoOrNull(update.updated_at),
    }));
  } else {
    history = [];
  }

  const cards = Array.isArray(content.cards)
    ? content.cards.map((card) => ({
        title: card.title || '',
        body: card.body || '',
        caption: card.caption || '',
        cta_text: card.cta_text || content.cta_text || '',
        cta_type: card.cta_type || content.cta_type || '',
        link_url: card.link_url || '',
        link_description: card.link_description || '',
        media_url: pickMediaUrl(card.media),
      }))
    : [];

  const mediaUrl =
    pickMediaUrl(content.media) ||
    cards.find((card) => typeof card.media_url === 'string' && card.media_url)?.media_url ||
    null;

  const cardHostnames = [...new Set(cards.map((card) => extractHostname(card.link_url)).filter(Boolean))];
  const shownHostname = extractHostname(content.link_url) || extractHostname(content.caption);
  const destinationMismatch = Boolean(
    shownHostname && cardHostnames.length > 0 && cardHostnames.some((host) => host !== shownHostname),
  );

  let displayTitle = content.title || '';
  if (!displayTitle || isTemplatePlaceholder(displayTitle)) {
    const cardTitle = cards.find((card) => card.title && !isTemplatePlaceholder(card.title))?.title;
    displayTitle = cardTitle || content.caption || '';
  }

  const pageLikeCount =
    joinedProfile?.list?.follower_count ??
    joinedProfile?.enrichment?.page_like_count ??
    advertiser.page_like_count ??
    null;

  return {
    _id: ad._id.toString(),
    ad_profile_id: ad.ad_profile_id?.toString?.() || (ad.ad_profile_id ? String(ad.ad_profile_id) : null),
    linked_domain_ids: Array.isArray(ad.linked_domain_ids)
      ? ad.linked_domain_ids.map((id) => id?.toString?.() || String(id))
      : [],
    created_at: toIsoOrNull(system.created_at ?? ad.ingestion?.ingested_at),
    sourcing_date: toIsoOrNull(list.sourced_at ?? ad.ingestion?.ingested_at),
    posted_date: toIsoOrNull(list.posted_at ?? list.start_date ?? delivery.start_date),
    start_date: toIsoOrNull(list.start_date ?? delivery.start_date),
    end_date: toIsoOrNull(list.end_date ?? delivery.end_date),
    updated_at: toIsoOrNull(system.updated_at),
    reviewed_at: toIsoOrNull(list.reviewed_at),
    update_history: history,
    platform: ad.platform ? ad.platform.toLowerCase() : 'meta',
    processed,
    client_status: clientStatus,
    caption: content.caption || '',
    title: displayTitle,
    raw_title: content.title || '',
    body: content.body || '',
    cta_text: content.cta_text || cards[0]?.cta_text || '',
    cta_type: content.cta_type || cards[0]?.cta_type || '',
    display_format: list.display_format || content.display_format || '',
    link_url: content.link_url || '',
    original_url: ad.original_url,
    source: ad.source || '',
    ad_id: ad.platform_ad_id || ad.source_payload?.ad_archive_id || '',
    is_active: list.is_active ?? delivery.is_active ?? false,
    impressions_text: list.impressions_text ?? delivery.impressions_text ?? null,
    publisher_platforms: list.publisher_platforms || delivery.publisher_platforms || [],
    card_count: list.card_count ?? cards.length,
    cards,
    media_url: mediaUrl,
    shown_hostname: shownHostname,
    card_hostnames: cardHostnames,
    destination_mismatch: destinationMismatch,
    advertiser: {
      page_name:
        advertiser.page_name ||
        joinedProfile?.page_name ||
        joinedProfile?.display_name ||
        'Unknown',
      profile_url: advertiser.profile_url || joinedProfile?.profile_url || '',
      page_like_count: pageLikeCount,
      page_categories: advertiser.page_categories || joinedProfile?.enrichment?.page_categories || [],
      is_verified: Boolean(joinedProfile?.is_verified),
    },
    assigned_to: ad?.assigned_to || null,
    content_reviewed_by: ad?.content_reviewed_by || null,
    review_details: normalizeAdReviewDetails(ad),
    analysis_results: analysis,
    client_notes: ad.client_notes || [],
    contains_digital_created_media: Boolean(delivery.contains_digital_created_media),
    contains_sensitive_content: Boolean(delivery.contains_sensitive_content),
    poi_detected: Boolean(list.poi_detected),
    spend: delivery.spend ?? null,
    currency: delivery.currency || '',
  };
}

function isAdReviewed(ad) {
  return Boolean(ad?.list?.reviewed_at || ad?.review_details?.reviewed_at || ad?.reviewed_at);
}

function isAdProfileReviewed(profile) {
  if (!profile) return false;
  if (String(profile?.workflow?.review_status || '').toLowerCase() === 'reviewed') return true;
  return Boolean(
    profile?.workflow?.reviewed_at ||
      profile?.review_details?.reviewed_at ||
      profile?.list?.reviewed_at,
  );
}

function adThreatScore(ad) {
  const review = ad?.review_details || {};
  const list = ad?.list || {};
  const analysis = ad?.analysis_results || {};
  const score =
    review.threat_score ??
    list.review_threat_score ??
    list.effective_threat_score ??
    analysis.risk_score ??
    null;
  return typeof score === 'number' && Number.isFinite(score) ? score : -1;
}

function adIsFeedLike(ad) {
  const platforms = [
    ...(Array.isArray(ad?.publisher_platforms) ? ad.publisher_platforms : []),
    ...(Array.isArray(ad?.list?.publisher_platforms) ? ad.list.publisher_platforms : []),
    ...(Array.isArray(ad?.ad_delivery?.publisher_platforms) ? ad.ad_delivery.publisher_platforms : []),
  ]
    .map((p) => String(p || '').toUpperCase())
    .filter(Boolean);
  return platforms.includes('FACEBOOK') || platforms.includes('INSTAGRAM');
}

function adRecencyTs(ad) {
  const raw =
    ad?.posted_date ||
    ad?.start_date ||
    ad?.list?.posted_at ||
    ad?.list?.start_date ||
    ad?.ad_delivery?.start_date ||
    ad?.created_at ||
    null;
  if (!raw) return 0;
  const date = raw instanceof Date ? raw : new Date(raw);
  const ts = date.getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

/**
 * Sort ads for profile reports: threat score desc → feed-like → most recent.
 * Mutates a copy; does not mutate input.
 */
function sortAdsForProfileReport(ads) {
  return [...(ads || [])].sort((a, b) => {
    const scoreDiff = adThreatScore(b) - adThreatScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    const feedDiff = Number(adIsFeedLike(b)) - Number(adIsFeedLike(a));
    if (feedDiff !== 0) return feedDiff;
    return adRecencyTs(b) - adRecencyTs(a);
  });
}

function sliceAdsForProfileReport(ads, maxAds = MAX_PROFILE_REPORT_ADS) {
  const sorted = sortAdsForProfileReport(ads);
  const limit = Math.max(0, Number(maxAds) || MAX_PROFILE_REPORT_ADS);
  return {
    allAds: sorted,
    displayAds: sorted.slice(0, limit),
    totalCount: sorted.length,
    shownCount: Math.min(limit, sorted.length),
    capped: sorted.length > limit,
  };
}

function normalizeAdProfile(profile) {
  if (!profile) return null;
  const enrichment = profile.enrichment && typeof profile.enrichment === 'object' ? profile.enrichment : {};
  const list = profile.list && typeof profile.list === 'object' ? profile.list : {};
  const review = profile.review_details && typeof profile.review_details === 'object' ? profile.review_details : {};
  const workflow = profile.workflow && typeof profile.workflow === 'object' ? profile.workflow : {};

  const legalCodes = Array.isArray(review.legal_codes)
    ? review.legal_codes.map((item) => {
        if (typeof item === 'string') return { code: item, reasoning: '' };
        return {
          code: item?.code || item?.name || '',
          reasoning: item?.reasoning || '',
        };
      }).filter((item) => item.code)
    : [];

  return {
    _id: profile._id?.toString?.() || String(profile._id),
    page_name: profile.page_name || profile.display_name || 'Unknown',
    display_name: profile.display_name || profile.page_name || 'Unknown',
    profile_url: profile.profile_url || '',
    meta_ads_library_url: profile.meta_ads_library_url || '',
    platform: profile.platform ? String(profile.platform).toLowerCase() : 'meta',
    platform_page_id: profile.platform_page_id || '',
    is_verified: Boolean(profile.is_verified),
    profile_pic: enrichment.profile_pic_s3 || enrichment.profile_pic || null,
    follower_count: list.follower_count ?? enrichment.page_like_count ?? null,
    page_categories: enrichment.page_categories || [],
    biography: enrichment.biography || null,
    ad_count: list.ad_count ?? null,
    last_active_at: toIsoOrNull(list.last_active_at),
    risk: review.risk || list.risk || list.risk_rank || null,
    risk_rank: list.risk_rank || review.risk || null,
    violations: Array.isArray(review.violations) ? review.violations : [],
    threat_score: review.threat_score ?? list.max_threat_score ?? null,
    case_summary: review.case_summary || '',
    legal_codes: legalCodes,
    verdict: review.verdict || null,
    recommended_action: review.recommended_action || null,
    reasoning: review.reasoning || '',
    reviewer_comments: review.reviewer_comments || '',
    action: review.action || null,
    reviewed_at: toIsoOrNull(review.reviewed_at ?? workflow.reviewed_at),
    client_status: workflow.client_status || 'open',
    review_status: workflow.review_status || null,
    review_details: review,
    list,
    enrichment,
    workflow,
  };
}

/**
 * Group reviewed ads and domains under each profile (by profile id string).
 * @param {Array} profiles Normalized or raw profiles with _id
 * @param {Array} ads Normalized ads (must include ad_profile_id or advertiser linkage via joined profile)
 * @param {Map<string, object>} domainsById domain id → domain doc
 * @param {Map<string, string[]>} adDomainIdsByAdId optional map of adId → linked domain id strings
 */
function groupAdsAndDomainsByProfile(profiles, ads, domainsById, adDomainIdsByAdId = null) {
  const adsByProfile = new Map();
  for (const ad of ads || []) {
    const profileKey =
      ad.ad_profile_id?.toString?.() ||
      (ad.ad_profile_id ? String(ad.ad_profile_id) : null) ||
      ad._profileId ||
      null;
    if (!profileKey) continue;
    if (!adsByProfile.has(profileKey)) adsByProfile.set(profileKey, []);
    adsByProfile.get(profileKey).push(ad);
  }

  return (profiles || []).map((profile) => {
    const profileId = profile._id?.toString?.() || String(profile._id);
    const profileAds = adsByProfile.get(profileId) || [];
    const domainIdSet = new Set();
    for (const ad of profileAds) {
      const linked =
        adDomainIdsByAdId?.get(ad._id?.toString?.() || String(ad._id)) ||
        ad.linked_domain_ids ||
        [];
      for (const domainId of linked) {
        const key = domainId?.toString?.() || String(domainId);
        if (key) domainIdSet.add(key);
      }
    }
    const domains = [...domainIdSet]
      .map((id) => domainsById?.get?.(id) || null)
      .filter(Boolean);

    const sliced = sliceAdsForProfileReport(profileAds);
    return {
      profile,
      ads: sliced.allAds,
      displayAds: sliced.displayAds,
      totalAdCount: sliced.totalCount,
      shownAdCount: sliced.shownCount,
      adsCapped: sliced.capped,
      domains,
    };
  });
}

module.exports = {
  generateReportHash,
  validatePayload,
  resolveEntityType,
  resolveEntityIds,
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
  extractHostname,
  mapCaseEventToUpdateHistory,
  toIsoOrNull,
  isAdReviewed,
  isAdProfileReviewed,
  sortAdsForProfileReport,
  sliceAdsForProfileReport,
  groupAdsAndDomainsByProfile,
  adThreatScore,
  adIsFeedLike,
  SUPPORTED_REPORT_TYPES,
  DOCX_SUPPORTED_REPORT_TYPES,
  DOCX_ONLY_REPORT_TYPES,
  SUPPORTED_ENTITY_TYPES,
  ADS_SUPPORTED_REPORT_TYPES,
  DOMAINS_SUPPORTED_REPORT_TYPES,
  AD_PROFILES_SUPPORTED_REPORT_TYPES,
  MAX_PROFILE_REPORT_ADS,
  buildDomainHashExtra,
  entityIdFieldName,
};
