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

export function domainAdsCount(domain) {
  const count = domain?.list?.occurrence_count;
  if (typeof count === 'number' && Number.isFinite(count)) return count;
  const linked = domain?.linked_ad_ids;
  if (Array.isArray(linked)) return linked.length;
  return 0;
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
