import { isValid, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import {
  clientVisibleCloakVariants,
  collectDomainViolations,
  domainHasCloaking,
  domainPageContent,
  domainVisitUrl,
  landerLabel,
  otherLanderVisitUrls,
  resolveReportLander,
} from '../domain-display';

export const DomainTheme = {
  PRIMARY_BLUE: '#1E293B',
  SECONDARY_GRAY: '#64748B',
  BORDER_LIGHT: '#E2E8F0',
  BG_SECTION: '#F8FAFC',
  RISK_HIGH: '#F43F5E',
  RISK_MEDIUM: '#F97316',
  RISK_LOW: '#F59E0B',
  SAFE: '#10B981',
  WARN: '#C2410C',
  WARN_BG: '#FFF7ED',
  LINK: '#3B82F6',
  INK: '#0F172A',
  INK_SOFT: '#334155',
  MUTED: '#64748B',
  LINE: '#E2E8F0',
  SURFACE: '#FFFFFF',
  SURFACE_ALT: '#F8FAFC',
  RISK_HIGH_BG: '#FFF1F2',
  RISK_HIGH_BORDER: '#FECDD3',
  RISK_MEDIUM_BG: '#FFF7ED',
  RISK_MEDIUM_BORDER: '#FED7AA',
  RISK_LOW_BG: '#FFFBEB',
  RISK_LOW_BORDER: '#FDE68A',
  RISK_SAFE_BG: '#ECFDF5',
  RISK_SAFE_BORDER: '#A7F3D0',
};

export function reportDomains(props) {
  return props?.domains || props?.posts || [];
}

export function processText(text, maxLength = 500, maxLines = null) {
  if (!text) return '';
  let sanitized = Array.from(String(text)).filter((char) => {
    const cp = char.codePointAt(0);
    return (
      (cp >= 32 && cp <= 126) ||
      cp === 10 ||
      cp === 13 ||
      cp === 9 ||
      /[\u{0900}-\u{097F}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}]/u.test(
        char,
      )
    );
  }).join('');

  let result = sanitized;
  let truncated = false;

  if (maxLines) {
    const lines = result.split(/\r\n|\r|\n/);
    if (lines.length > maxLines) {
      result = lines.slice(0, maxLines).join('\n');
      truncated = true;
    }
  }

  if (result.length > maxLength) {
    result = result.substring(0, maxLength);
    truncated = true;
  }

  return truncated ? `${result.trim()}...` : result;
}

export function formatCompleteDate(dateInput) {
  if (!dateInput) return 'N/A';
  try {
    const dateObj = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
    if (isValid(dateObj)) {
      return formatInTimeZone(dateObj, 'Asia/Kolkata', "dd MMM yyyy, hh:mm a 'IST'");
    }
  } catch {
    return 'N/A';
  }
  return 'N/A';
}

export function formatDateTime(dateInput) {
  if (!dateInput) return 'N/A';
  try {
    const dateObj = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
    if (isValid(dateObj)) {
      return formatInTimeZone(dateObj, 'Asia/Kolkata', 'dd MMM yyyy, hh:mm a');
    }
  } catch {
    return 'N/A';
  }
  return 'N/A';
}

export function domainRiskRank(domain) {
  const rank = String(domain?.list?.risk_rank || '').toLowerCase();
  if (['high', 'medium', 'low', 'safe'].includes(rank)) return rank;
  const score = domain?.review_details?.threat_score ?? domain?.list?.effective_threat_score ?? domain?.list?.review_threat_score;
  if (score == null) return 'unknown';
  if (score >= 96) return 'high';
  if (score >= 76) return 'medium';
  if (score >= 41) return 'low';
  return 'safe';
}

export function domainRiskInfo(domain) {
  const rank = domainRiskRank(domain);
  if (rank === 'high') {
    return { label: 'High Risk', rank, color: DomainTheme.RISK_HIGH, bg: DomainTheme.RISK_HIGH_BG, border: DomainTheme.RISK_HIGH_BORDER };
  }
  if (rank === 'medium') {
    return { label: 'Medium Risk', rank, color: DomainTheme.RISK_MEDIUM, bg: DomainTheme.RISK_MEDIUM_BG, border: DomainTheme.RISK_MEDIUM_BORDER };
  }
  if (rank === 'low') {
    return { label: 'Low Risk', rank, color: DomainTheme.RISK_LOW, bg: DomainTheme.RISK_LOW_BG, border: DomainTheme.RISK_LOW_BORDER };
  }
  if (rank === 'safe') {
    return { label: 'Safe', rank, color: DomainTheme.SAFE, bg: DomainTheme.RISK_SAFE_BG, border: DomainTheme.RISK_SAFE_BORDER };
  }
  return { label: 'Unreviewed', rank, color: DomainTheme.SECONDARY_GRAY, bg: DomainTheme.BG_SECTION, border: DomainTheme.BORDER_LIGHT };
}

export function domainLander(domain) {
  return domain?.reportLander || resolveReportLander(domain);
}

export function domainLanderCaption(domain) {
  return landerLabel(domainLander(domain));
}

/**
 * Ads genuinely attached to the domain: the `linked_ad_ids` array is the source
 * of truth. `list.occurrence_count` is the number of *discovery* sightings (it
 * tracks `discovery.occurrences`), not ads, so it must never drive this count.
 */
export function domainAdsCount(domain) {
  const linked = domain?.linked_ad_ids;
  return Array.isArray(linked) ? linked.length : 0;
}

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2, info: 3 };

/** Severity palette for a violation chip. */
export function domainSeverityInfo(severity) {
  const rank = String(severity || '').toLowerCase();
  if (rank === 'high') {
    return { color: DomainTheme.RISK_HIGH, bg: DomainTheme.RISK_HIGH_BG, border: DomainTheme.RISK_HIGH_BORDER };
  }
  if (rank === 'low') {
    return { color: DomainTheme.RISK_LOW, bg: DomainTheme.RISK_LOW_BG, border: DomainTheme.RISK_LOW_BORDER };
  }
  if (rank === 'medium') {
    return { color: DomainTheme.RISK_MEDIUM, bg: DomainTheme.RISK_MEDIUM_BG, border: DomainTheme.RISK_MEDIUM_BORDER };
  }
  return { color: DomainTheme.SECONDARY_GRAY, bg: DomainTheme.BG_SECTION, border: DomainTheme.BORDER_LIGHT };
}

function normalizeViolationKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+/g, ' ')
    .trim();
}

function titleCaseWords(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Violation chips for the dossier: project labels first (matched on true flags
 * and threat types), then remaining true flags, then threat types / declared
 * violation flags. Each chip carries the project severity when one is known.
 * Legal codes are intentionally excluded — they render as their own cards.
 */
export function collectDomainViolationChips(domain, project = null) {
  const review = domain?.review_details || {};
  const list = domain?.list || {};
  const flags = review.flags && typeof review.flags === 'object' ? review.flags : {};
  const projectLabels = Array.isArray(project?.project_details?.labels)
    ? project.project_details.labels
    : [];
  const threatTypes = [
    ...(Array.isArray(review.threat_types) ? review.threat_types : []),
    ...(Array.isArray(list.threat_types) ? list.threat_types : []),
    ...(Array.isArray(list.violation_flags) ? list.violation_flags : []),
  ];

  const chips = [];
  const seen = new Set();
  const push = (name, severity) => {
    const label = String(name || '').trim();
    const key = normalizeViolationKey(label);
    if (!key || seen.has(key)) return;
    seen.add(key);
    chips.push({ name: label, severity: SEVERITY_ORDER[severity] !== undefined ? severity : 'medium' });
  };

  const trueFlagKeys = Object.keys(flags).filter((key) => flags[key] === true);
  const declaredKeys = new Set(
    [...trueFlagKeys, ...threatTypes].map(normalizeViolationKey).filter(Boolean),
  );

  for (const label of projectLabels) {
    if (!label?.name) continue;
    if (declaredKeys.has(normalizeViolationKey(label.name))) push(label.name, label.severity);
  }

  for (const key of trueFlagKeys) {
    if (!key || String(key).toLowerCase() === 'safe') continue;
    push(titleCaseWords(String(key).replace(/[-_]+/g, ' ')), 'medium');
  }

  for (const type of threatTypes) {
    if (!type || String(type).toLowerCase() === 'safe') continue;
    push(titleCaseWords(String(type).replace(/[-_]+/g, ' ')), 'medium');
  }

  return chips.sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4),
  );
}

/** Numeric threat score, or null when no reviewer/AI score exists. */
export function domainThreatScore(domain) {
  const candidates = [
    domain?.review_details?.threat_score,
    domain?.list?.effective_threat_score,
    domain?.list?.review_threat_score,
    domain?.list?.ai_threat_score,
  ];
  for (const candidate of candidates) {
    const score = Number(candidate);
    if (candidate != null && Number.isFinite(score)) return score;
  }
  return null;
}

/** Everything the dossier's review + risk blocks need, in one place. */
export function buildDomainReviewModel(domain, project = null) {
  const review = domain?.review_details || {};
  const pageContent = domainPageContent(domain);
  const legalCodes = (Array.isArray(review.legal_codes) ? review.legal_codes : [])
    .map((item) => {
      if (typeof item === 'string') return { code: item, reasoning: '' };
      return { code: item?.code || item?.name || '', reasoning: item?.reasoning || '' };
    })
    .filter((item) => item.code);

  const caseSummary = String(
    review.reasoning || pageContent.excerpt || pageContent.description || '',
  ).trim();
  const violations = collectDomainViolationChips(domain, project);

  return {
    risk: domainRiskInfo(domain),
    threatScore: domainThreatScore(domain),
    category: domain?.list?.category || review.category || '',
    caseSummary,
    reviewerComments: String(review.reviewer_comments || '').trim(),
    violations,
    legalCodes,
    hasSignal: Boolean(caseSummary || legalCodes.length || violations.length),
  };
}

export function domainHostingCountry(domain) {
  return domain?.list?.hosting_country || domain?.analysis_results?.hosting?.country || '—';
}

export function domainClientStatus(domain) {
  return domain?.workflow?.client_status || domain?.client_status || 'open';
}

export function otherLandersCaption(domain) {
  const visible = clientVisibleCloakVariants(domain);
  if (visible.length <= 1) return null;
  return `This PDF covers one lander (${domainLanderCaption(domain)}). ${visible.length - 1} other client-visible lander${visible.length - 1 === 1 ? '' : 's'} exist.`;
}

export {
  clientVisibleCloakVariants,
  collectDomainViolations,
  domainHasCloaking,
  domainPageContent,
  domainVisitUrl,
  landerLabel,
  otherLanderVisitUrls,
  resolveReportLander,
};
