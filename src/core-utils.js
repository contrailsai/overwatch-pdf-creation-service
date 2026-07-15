const crypto = require('crypto');
const { ObjectId } = require('mongodb');

const SUPPORTED_REPORT_TYPES = new Set(['Detailed', 'Single', 'Profile', 'SimpleProfile', 'SimpleCase', 'Summary']);
const DOCX_SUPPORTED_REPORT_TYPES = new Set(['Detailed', 'Single', 'Profile', 'SimpleProfile', 'SimpleCase']);
const DOCX_ONLY_REPORT_TYPES = new Set(['SimpleProfile', 'SimpleCase']);

function generateReportHash(projectId, postIds, reportType, profileId = '', reportFormat = 'pdf') {
  const sortedIds = [...postIds].sort();
  const rawString = `${projectId}-${sortedIds.join(',')}-${reportType}-${profileId}-${reportFormat}`;
  return crypto.createHash('sha256').update(rawString).digest('hex');
}

function validatePayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Payload must be a valid JSON object'] };
  }

  const { projectId, postIds, reportType, reportFormat, database_name } = payload;
  const normalizedReportFormat = (reportFormat || 'pdf').toLowerCase();

  if (!projectId || typeof projectId !== 'string') {
    errors.push('projectId is required and must be a string');
  }
  if (!database_name || typeof database_name !== 'string') {
    errors.push('database_name is required and must be a string');
  }
  if (!Array.isArray(postIds) || postIds.length === 0) {
    errors.push('postIds must be a non-empty array');
  }
  if (!reportType || typeof reportType !== 'string' || !SUPPORTED_REPORT_TYPES.has(reportType)) {
    errors.push(`reportType must be one of: ${Array.from(SUPPORTED_REPORT_TYPES).join(', ')}`);
  }
  if (!['pdf', 'docx'].includes(normalizedReportFormat)) {
    errors.push('reportFormat must be either pdf or docx');
  }
  if (normalizedReportFormat === 'docx' && !DOCX_SUPPORTED_REPORT_TYPES.has(reportType)) {
    errors.push(`DOCX is only supported for: ${Array.from(DOCX_SUPPORTED_REPORT_TYPES).join(', ')}`);
  }
  if (DOCX_ONLY_REPORT_TYPES.has(reportType) && normalizedReportFormat !== 'docx') {
    errors.push(`${reportType} is only supported with reportFormat docx`);
  }
  if (Array.isArray(postIds)) {
    const invalidIds = postIds.filter((id) => !ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      errors.push(`postIds contains invalid ObjectId values (${invalidIds.slice(0, 5).join(', ')})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    normalizedReportFormat,
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

module.exports = {
  generateReportHash,
  validatePayload,
  orderPostsByRequestedIds,
  normalizePost,
  normalizeProfile,
  resolvePostMediaUrl,
  mapCaseEventToUpdateHistory,
  toIsoOrNull,
  SUPPORTED_REPORT_TYPES,
  DOCX_SUPPORTED_REPORT_TYPES,
  DOCX_ONLY_REPORT_TYPES,
};
