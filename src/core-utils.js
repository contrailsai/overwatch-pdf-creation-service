const crypto = require('crypto');
const { ObjectId } = require('mongodb');

const SUPPORTED_REPORT_TYPES = new Set(['Detailed', 'Single', 'Profile', 'SimpleProfile', 'SimpleCase', 'Summary']);
const DOCX_SUPPORTED_REPORT_TYPES = new Set(['Detailed', 'Single', 'Profile', 'SimpleProfile', 'SimpleCase']);
const DOCX_ONLY_REPORT_TYPES = new Set(['SimpleProfile', 'SimpleCase']);
const SUPPORTED_ENTITY_TYPES = new Set(['posts', 'ads']);
const ADS_SUPPORTED_REPORT_TYPES = new Set(['Summary', 'Detailed']);

function resolveEntityType(payload) {
  const explicit = payload?.entityType ? String(payload.entityType).toLowerCase() : '';
  if (explicit === 'ads' || explicit === 'ad') return 'ads';
  if (explicit === 'posts' || explicit === 'post') return 'posts';
  if (Array.isArray(payload?.adIds) && payload.adIds.length > 0) return 'ads';
  return 'posts';
}

function resolveEntityIds(payload) {
  if (resolveEntityType(payload) === 'ads') {
    if (Array.isArray(payload?.adIds) && payload.adIds.length > 0) return payload.adIds;
    return payload?.postIds;
  }
  return payload?.postIds;
}

function generateReportHash(projectId, postIds, reportType, profileId = '', reportFormat = 'pdf', entityType = 'posts') {
  const sortedIds = [...postIds].sort();
  const entitySuffix = entityType && entityType !== 'posts' ? `-${entityType}` : '';
  const rawString = `${projectId}-${sortedIds.join(',')}-${reportType}-${profileId}-${reportFormat}${entitySuffix}`;
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
    errors.push(entityType === 'ads' ? 'adIds or postIds must be a non-empty array' : 'postIds must be a non-empty array');
  }
  if (!reportType || typeof reportType !== 'string' || !SUPPORTED_REPORT_TYPES.has(reportType)) {
    errors.push(`reportType must be one of: ${Array.from(SUPPORTED_REPORT_TYPES).join(', ')}`);
  }
  if (entityType === 'ads' && reportType && !ADS_SUPPORTED_REPORT_TYPES.has(reportType)) {
    errors.push(`Ads reports only support: ${Array.from(ADS_SUPPORTED_REPORT_TYPES).join(', ')}`);
  }
  if (!['pdf', 'docx'].includes(normalizedReportFormat)) {
    errors.push('reportFormat must be either pdf or docx');
  }
  if (entityType === 'ads' && normalizedReportFormat === 'docx') {
    errors.push('Ads reports currently support PDF only');
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
      const fieldName = entityType === 'ads' ? 'adIds' : 'postIds';
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

  return {
    _id: post._id.toString(),
    created_at: toIsoOrNull(system.created_at ?? post.metadata?.created_at),
    sourcing_date: toIsoOrNull(list.sourced_at ?? post.metadata?.sourcing_date),
    posted_date: toIsoOrNull(
      list.posted_at ?? post.engagement?.posted_at ?? post.metadata?.posted_date,
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
      like_count: post.engagement?.likes || 0,
      comment_count: post.engagement?.comments || 0,
      share_count: post.engagement?.shares || 0,
      view_count: post.engagement?.views || 0,
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

/**
 * Resolve the first creative image for an ad (flattened content.media, then first card).
 */
function resolveAdMediaUrl(ad) {
  if (!ad) return null;

  const v3Media = ad.content?.media;
  if (Array.isArray(v3Media) && v3Media.length > 0) {
    const first = v3Media[0];
    if (first?.s3_url || first?.original_url) {
      return first.s3_url || first.original_url;
    }
  }

  const cards = ad.content?.cards;
  if (Array.isArray(cards) && cards.length > 0) {
    const firstCardMedia = cards[0]?.media?.[0];
    if (firstCardMedia?.s3_url || firstCardMedia?.original_url) {
      return firstCardMedia.s3_url || firstCardMedia.original_url;
    }
  }

  return null;
}

/**
 * Resolve one image URL per carousel card (DPA / multi-asset ads).
 */
function resolveAdCardMediaUrls(ad) {
  const cards = ad.content?.cards;
  if (Array.isArray(cards) && cards.length > 0) {
    return cards.map((card) => {
      const media = card?.media?.[0];
      return media?.s3_url || media?.original_url || null;
    });
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
    reviewed_at: review.reviewed_at ?? list.reviewed_at ?? null,
  };
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
        media_url: card.media?.[0]?.s3_url || card.media?.[0]?.original_url || null,
      }))
    : [];

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
    ad_id: ad.platform_ad_id || ad.source_payload?.ad_archive_id || '',
    is_active: list.is_active ?? delivery.is_active ?? false,
    impressions_text: list.impressions_text ?? delivery.impressions_text ?? null,
    publisher_platforms: list.publisher_platforms || delivery.publisher_platforms || [],
    card_count: list.card_count ?? cards.length,
    cards,
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

module.exports = {
  generateReportHash,
  validatePayload,
  resolveEntityType,
  resolveEntityIds,
  orderPostsByRequestedIds,
  normalizePost,
  normalizeProfile,
  normalizeAd,
  resolvePostMediaUrl,
  resolveAdMediaUrl,
  resolveAdCardMediaUrls,
  extractHostname,
  mapCaseEventToUpdateHistory,
  toIsoOrNull,
  SUPPORTED_REPORT_TYPES,
  DOCX_SUPPORTED_REPORT_TYPES,
  DOCX_ONLY_REPORT_TYPES,
  SUPPORTED_ENTITY_TYPES,
  ADS_SUPPORTED_REPORT_TYPES,
};
