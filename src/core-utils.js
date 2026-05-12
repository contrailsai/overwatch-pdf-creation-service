const crypto = require('crypto');
const { ObjectId } = require('mongodb');

const SUPPORTED_REPORT_TYPES = new Set(['Detailed', 'Single', 'Profile', 'Summary']);
const DOCX_SUPPORTED_REPORT_TYPES = new Set(['Detailed', 'Single', 'Profile']);

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

function normalizePost(post, signedImageUrl = null) {
  return {
    _id: post._id.toString(),
    created_at: post.metadata?.created_at ? new Date(post.metadata.created_at).toISOString() : null,
    sourcing_date: post.metadata?.sourcing_date ? new Date(post.metadata.sourcing_date).toISOString() : null,
    posted_date: post.engagement?.posted_at ? new Date(post.engagement.posted_at).toISOString() : post.metadata?.posted_date ? new Date(post.metadata.posted_date).toISOString() : null,
    taken_at: post.post_content?.taken_at || post.taken_at || null,
    updated_at: post.metadata?.updated_at ? new Date(post.metadata.updated_at).toISOString() : null,
    reviewed_at: post.review_details?.reviewed_at ? new Date(post.review_details.reviewed_at).toISOString() : null,
    update_history: post.metadata?.update_history ? post.metadata.update_history.map((update) => ({
      ...update,
      updated_at: update.updated_at ? new Date(update.updated_at).toISOString() : null,
    })) : [],
    platform: post.platform ? post.platform.toLowerCase() : 'instagram',
    processed: post.processed || false,
    client_status: post.client_status || 'To Be Reviewed',
    caption: post.post_content?.caption || post.caption || '',
    signedImageUrl,
    original_url: post.original_url,
    post_id: post.post_id || post.code,
    user: {
      username: post.profile?.username || post.user?.username || 'Unknown',
      full_name: post.profile?.display_name || '',
      profile_pic_url: post.profile?.profile_pic_url || post.profile?.profile_url || '',
      is_verified: post.profile?.is_verified || false,
      follower_count: post.profile?.metadata?.follower_count ?? post.profile?.follower_count ?? null,
    },
    assigned_to: post?.assigned_to || null,
    content_reviewed_by: post?.content_reviewed_by || null,
    review_details: post.review_details || null,
    takedown_info: post.takedown_info || null,
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
  SUPPORTED_REPORT_TYPES,
  DOCX_SUPPORTED_REPORT_TYPES,
};
