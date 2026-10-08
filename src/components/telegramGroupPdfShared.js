import { DomainTheme } from './domainPdfShared';
import {
  compactNumber,
  parseReasoning,
  formatVerdictLabel,
  resolveProjectLegalCodes,
  flattenKeyValues,
} from './appPdfShared';

export { DomainTheme, compactNumber, parseReasoning, formatVerdictLabel, resolveProjectLegalCodes, flattenKeyValues };
export { processText, formatCompleteDate, formatDateTime } from './domainPdfShared';

/** Telegram group reports share the Domains/Apps palette. */
export const GroupTheme = DomainTheme;

/**
 * Risk rank for a Telegram group.
 *
 * Groups have no accepted threshold standard of their own. This follows the
 * Apps/Domains renderers (>= 96 / >= 76 / >= 41) — see docs/report-themes.md §3.
 * A `risk_rank` set by a reviewer always wins over the score.
 */
export function groupRiskRank(group) {
  const rank = String(group?.review?.risk_rank || '').toLowerCase();
  if (['high', 'medium', 'low', 'safe'].includes(rank)) return rank;
  const score = group?.review?.threat_score;
  if (score == null) return 'unknown';
  if (score >= 96) return 'high';
  if (score >= 76) return 'medium';
  if (score >= 41) return 'low';
  return 'safe';
}

export function groupRiskInfo(group) {
  const rank = groupRiskRank(group);
  if (rank === 'high') {
    return {
      label: 'High Risk',
      rank,
      color: GroupTheme.RISK_HIGH,
      bg: GroupTheme.RISK_HIGH_BG,
      border: GroupTheme.RISK_HIGH_BORDER,
    };
  }
  if (rank === 'medium') {
    return {
      label: 'Medium Risk',
      rank,
      color: GroupTheme.RISK_MEDIUM,
      bg: GroupTheme.RISK_MEDIUM_BG,
      border: GroupTheme.RISK_MEDIUM_BORDER,
    };
  }
  if (rank === 'low') {
    return {
      label: 'Low Risk',
      rank,
      color: GroupTheme.RISK_LOW,
      bg: GroupTheme.RISK_LOW_BG,
      border: GroupTheme.RISK_LOW_BORDER,
    };
  }
  if (rank === 'safe') {
    return {
      label: 'Safe',
      rank,
      color: GroupTheme.SAFE,
      bg: GroupTheme.RISK_SAFE_BG,
      border: GroupTheme.RISK_SAFE_BORDER,
    };
  }
  return {
    label: 'Unreviewed',
    rank,
    color: GroupTheme.SECONDARY_GRAY,
    bg: GroupTheme.BG_SECTION,
    border: GroupTheme.BORDER_LIGHT,
  };
}

/** True when a reviewer has left any signal on the group. */
export function hasGroupReviewSignal(group) {
  const review = group?.review || {};
  return (
    review.threat_score != null ||
    review.risk_rank != null ||
    Boolean(review.reviewed_at) ||
    (Array.isArray(review.threat_types) && review.threat_types.length > 0) ||
    (Array.isArray(review.violation_flags) && review.violation_flags.length > 0) ||
    Boolean(review.reasoning) ||
    Boolean(review.case_summary) ||
    (Array.isArray(review.legal_codes) && review.legal_codes.length > 0)
  );
}

const LEGACY_FLAG_LABELS = {
  is_nsfw: 'NSFW',
  is_hate_speech: 'Hate Speech',
  is_fake_news: 'Misinformation',
  is_fraud: 'Fraud',
  is_asset_misuse: 'Asset Misuse',
  is_humor: 'Satire',
  is_terrorism: 'Terrorism',
  is_violence: 'Violence',
};

const SEVERITY_ORDER = { high: 1, medium: 2, low: 3 };

/** `appointment-scalping`, `Appointment_Scalping` and `Appointment Scalping` are one signal. */
function normalizeViolationKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Violation chips: project labels first (matched on true flags / threat types),
 * then every other `flags[key] === true` (Telegram groups use PascalCase and
 * hyphenated keys such as `Appointment-Scalping`), then threat types and declared
 * violation flags.
 */
export function collectGroupViolations(group, project) {
  const review = group?.review || {};
  const flags = review.flags && typeof review.flags === 'object' ? review.flags : {};
  const threatTypes = Array.isArray(review.threat_types) ? review.threat_types : [];
  const declared = Array.isArray(review.violation_flags) ? review.violation_flags : [];
  const projectLabels = Array.isArray(project?.project_details?.labels)
    ? project.project_details.labels
    : [];

  const chips = [];
  const seen = new Set();
  const push = (name, severity) => {
    const label = String(name || '').trim();
    const key = normalizeViolationKey(label);
    if (!key || seen.has(key)) return;
    seen.add(key);
    chips.push({ name: label, severity: SEVERITY_ORDER[severity] ? severity : 'medium' });
  };

  const trueFlagKeys = Object.keys(flags).filter((key) => flags[key] === true);
  const declaredKeys = new Set(
    [...trueFlagKeys, ...threatTypes, ...declared].map(normalizeViolationKey).filter(Boolean),
  );

  for (const label of projectLabels) {
    if (!label?.name) continue;
    if (declaredKeys.has(normalizeViolationKey(label.name))) push(label.name, label.severity);
  }

  for (const [flag, name] of Object.entries(LEGACY_FLAG_LABELS)) {
    if (flags[flag] === true) push(name, 'medium');
  }

  for (const key of trueFlagKeys) {
    if (!key || String(key).toLowerCase() === 'safe') continue;
    push(titleCase(String(key).replace(/[-_]+/g, ' ')), 'medium');
  }

  for (const type of [...threatTypes, ...declared]) {
    if (!type || String(type).toLowerCase() === 'safe') continue;
    push(titleCase(String(type).replace(/[-_]+/g, ' ')), 'medium');
  }

  return chips.sort(
    (a, b) => (SEVERITY_ORDER[a.severity] || 4) - (SEVERITY_ORDER[b.severity] || 4),
  );
}

/** `channel` / `broadcast` → Channel; `group` / `supergroup` / `megagroup` → Group. */
export function groupTypeLabel(group) {
  const type = String(group?.type || '').toLowerCase();
  if (type === 'channel' || group?.broadcast) return 'Channel';
  if (group?.megagroup || type === 'group' || type === 'supergroup') return 'Group';
  return type ? titleCase(type.replace(/[_-]+/g, ' ')) : 'Channel';
}

/** 81483 → "81.5K"; null → "—". */
export function groupAudienceLabel(group) {
  const count = group?.participant_count;
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return '—';
  return compactNumber(count);
}

/** 808 → "808"; null → "—". */
export function groupMessageCountLabel(group) {
  const count = group?.message_count;
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) return '—';
  return compactNumber(count);
}

export function groupUsernameLabel(group) {
  return group?.username ? `@${group.username}` : '—';
}

export function groupSourceLabel(group) {
  if (!group?.original_url) return '';
  return groupTypeLabel(group) === 'Channel' ? 'View Channel' : 'Open in Telegram';
}

/** Client-facing "alerted" signal: explicitly alerted, or the legacy processed flag. */
export function groupIsAlerted(group) {
  return String(group?.client_status || '').toLowerCase() === 'alerted' || Boolean(group?.processed);
}

/** Yes / No / — for the boolean group flags. */
export function groupFlagLabel(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '—';
}

/** Severity palette for a flagged-message card. */
export function groupSeverityInfo(severity) {
  const rank = String(severity || '').toLowerCase();
  if (rank === 'high') {
    return { label: 'High', color: GroupTheme.RISK_HIGH, bg: GroupTheme.RISK_HIGH_BG, border: GroupTheme.RISK_HIGH_BORDER };
  }
  if (rank === 'low') {
    return { label: 'Low', color: GroupTheme.RISK_LOW, bg: GroupTheme.RISK_LOW_BG, border: GroupTheme.RISK_LOW_BORDER };
  }
  if (rank === 'medium') {
    return { label: 'Medium', color: GroupTheme.RISK_MEDIUM, bg: GroupTheme.RISK_MEDIUM_BG, border: GroupTheme.RISK_MEDIUM_BORDER };
  }
  return { label: 'Info', color: GroupTheme.SECONDARY_GRAY, bg: GroupTheme.BG_SECTION, border: GroupTheme.BORDER_LIGHT };
}

/** 1 → "100%", 0.86 → "86%", null → "—". */
export function groupConfidenceLabel(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

export function groupHasAiAnalysis(group) {
  return Boolean(group?.ai?.present);
}

export function groupFlaggedMessages(group, limit = null) {
  const list = Array.isArray(group?.ai?.flagged_messages) ? group.ai.flagged_messages : [];
  return limit == null ? list : list.slice(0, limit);
}

export function groupTotalFlaggedMessages(group) {
  const total = group?.ai?.total_flagged_messages;
  if (typeof total === 'number' && Number.isFinite(total)) return total;
  return Array.isArray(group?.ai?.flagged_messages) ? group.ai.flagged_messages.length : 0;
}

export function groupMediaEvidence(group, limit = null) {
  const list = Array.isArray(group?.ai?.media_evidence) ? group.ai.media_evidence : [];
  return limit == null ? list : list.slice(0, limit);
}

/** Operator + monetisation links gathered from the AI dossier, de-duplicated. */
export function groupPromotedLinks(group) {
  const ai = group?.ai || {};
  const links = [...(ai.promoted_services || []), ...(ai.promoted_handles || [])];
  const seen = new Set();
  return links.filter((link) => {
    const key = `${link.kind}:${link.name}`;
    if (!link.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Everything the Review Details block needs, in one place. Legal codes get
 * project-code descriptions backfilled when the reviewer left only the code.
 */
export function buildGroupReviewModel(group, project) {
  const review = group?.review || {};
  const risk = groupRiskInfo(group);
  const caseSummary = review.case_summary || '';
  const reasoning = review.reasoning || '';
  const reviewerComments = String(review.reviewer_comments || '').trim();
  const verdictLabel = formatVerdictLabel(review.recommended_action || review.verdict);
  const violations = collectGroupViolations(group, project);
  const projectCodes = resolveProjectLegalCodes(project);

  const legalCodes = (Array.isArray(review.legal_codes) ? review.legal_codes : [])
    .map((item) => {
      if (typeof item === 'string') return { code: item, reasoning: '' };
      return { code: item?.code || item?.name || '', reasoning: item?.reasoning || '' };
    })
    .filter((item) => item.code)
    .map((item) => {
      if (item.reasoning) return item;
      const match = projectCodes.find(
        (projectCode) =>
          projectCode.name === item.code ||
          projectCode.codeName === item.code ||
          projectCode.name === String(item.code).toUpperCase(),
      );
      return { ...item, reasoning: match?.description || '' };
    });

  return {
    risk,
    hasSignal: hasGroupReviewSignal(group),
    hasAiAnalysis: groupHasAiAnalysis(group),
    status: group?.client_status || 'open',
    reviewedAt: group?.reviewed_at || review.reviewed_at || null,
    caseSummary,
    reasoning,
    reasoningSections: parseReasoning(reasoning),
    reviewerComments,
    verdictLabel,
    verdict: review.verdict || null,
    recommendedAction: review.recommended_action || null,
    confidence: review.confidence ?? group?.ai?.confidence ?? null,
    mediaBasis: review.media_basis || group?.ai?.media_basis || '',
    violations,
    legalCodes,
  };
}
