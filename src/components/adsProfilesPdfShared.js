import React from 'react';
import { Text, View, StyleSheet, Image, Link } from '@react-pdf/renderer';
import { isValid, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import {
  DomainTheme,
  processText,
  domainRiskInfo,
  domainLanderCaption,
  domainAdsCount,
  domainHasCloaking,
  domainVisitUrl,
  collectDomainViolations,
  clientVisibleCloakVariants,
} from './domainPdfShared';

export const Theme = {
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
  ...DomainTheme,
};

export const DOMAIN_THUMB_W = 120;
export const DOMAIN_THUMB_H = 74;

export const sharedStyles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingHorizontal: 30,
    paddingBottom: 40,
    fontFamily: ['Outfit', 'Mukta'],
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Theme.BORDER_LIGHT,
    paddingBottom: 12,
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: Theme.PRIMARY_BLUE,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 7,
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  headerRight: { alignItems: 'flex-end' },
  headerDate: { fontSize: 8, fontWeight: 'bold', color: Theme.PRIMARY_BLUE },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 6.5,
    color: Theme.SECONDARY_GRAY,
    borderTopWidth: 0.5,
    borderTopColor: Theme.BORDER_LIGHT,
    paddingTop: 8,
  },
  footerLeft: { textTransform: 'uppercase', fontWeight: 'bold' },
  footerCenter: { textTransform: 'uppercase' },
  footerRight: { textTransform: 'uppercase', fontWeight: 'bold' },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  metricsSection: { marginBottom: 14 },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Theme.BG_SECTION,
    padding: 10,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 6,
    color: Theme.SECONDARY_GRAY,
    marginBottom: 3,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '900',
    color: Theme.PRIMARY_BLUE,
  },
  profileBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Theme.BG_SECTION,
    padding: 8,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    marginBottom: 0,
    flexGrow: 1,
  },
  profileBannerLeft: { flexDirection: 'row', gap: 8, width: '64%' },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Theme.BORDER_LIGHT,
    backgroundColor: '#FFFFFF',
    objectFit: 'cover',
  },
  profileImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Theme.BORDER_LIGHT,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: { flex: 1, flexDirection: 'column', gap: 2 },
  profileName: { fontSize: 11, fontWeight: '900', color: Theme.PRIMARY_BLUE },
  profileMeta: { fontSize: 7, color: Theme.SECONDARY_GRAY, fontWeight: 'bold' },
  profileLink: { fontSize: 6.5, color: Theme.LINK, textDecoration: 'none', marginTop: 1 },
  profileBannerRight: {
    width: '34%',
    flexDirection: 'column',
    gap: 4,
    borderLeftWidth: 0.5,
    borderLeftColor: Theme.BORDER_LIGHT,
    paddingLeft: 8,
    justifyContent: 'center',
  },
  profileHeroRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    alignItems: 'stretch',
  },
  profileHeroLeft: {
    width: '58%',
    flexDirection: 'column',
    gap: 6,
  },
  profileHeroLeftFull: {
    width: '100%',
    flexDirection: 'column',
    gap: 6,
  },
  profileHeroRight: {
    width: '40%',
    flexDirection: 'column',
    backgroundColor: Theme.BG_SECTION,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    borderRadius: 6,
    padding: 8,
    justifyContent: 'flex-start',
  },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start' },
  detailLabel: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: Theme.SECONDARY_GRAY,
    width: 58,
    textTransform: 'uppercase',
  },
  detailValue: { fontSize: 7.5, color: Theme.PRIMARY_BLUE, fontWeight: 'bold', flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  chipText: { fontSize: 6.5, color: Theme.PRIMARY_BLUE, textTransform: 'capitalize' },
  riskBadge: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  riskBadgeText: { fontSize: 6.5, fontWeight: '900', textTransform: 'uppercase' },
  noteText: {
    fontSize: 7,
    color: Theme.SECONDARY_GRAY,
    marginBottom: 6,
  },
  domainTableHeader: {
    flexDirection: 'row',
    backgroundColor: Theme.BG_SECTION,
    paddingVertical: 6,
    paddingHorizontal: 5,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    borderRadius: 4,
    marginBottom: 4,
  },
  domainTableHeaderCell: {
    fontSize: 6.5,
    fontWeight: '900',
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  domainRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: Theme.BORDER_LIGHT,
    alignItems: 'flex-start',
  },
  colDomIndex: { width: '5%', paddingRight: 3, alignItems: 'center' },
  colDomain: { width: '42%', paddingRight: 6 },
  colDomRisk: { width: '14%', paddingRight: 4 },
  colDomCloak: { width: '14%', paddingRight: 4 },
  colDomThreat: { width: '17%', paddingRight: 4 },
  colDomAds: { width: '8%' },
  domainThumb: {
    width: DOMAIN_THUMB_W,
    height: DOMAIN_THUMB_H,
    borderRadius: 3,
    marginBottom: 4,
    objectFit: 'cover',
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
  },
  domainThumbPlaceholder: {
    width: DOMAIN_THUMB_W,
    height: DOMAIN_THUMB_H,
    borderRadius: 3,
    marginBottom: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.BG_SECTION,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
  },
  domainName: { fontSize: 7.5, fontWeight: '900', color: Theme.PRIMARY_BLUE, marginBottom: 1 },
  visitUrl: { fontSize: 6, color: Theme.LINK, textDecoration: 'none' },
  cloakText: { fontSize: 7, color: Theme.PRIMARY_BLUE, fontWeight: '700' },
  cloakMeta: { fontSize: 6, color: Theme.SECONDARY_GRAY, marginTop: 1 },
  threatContainer: { flexDirection: 'column', gap: 2 },
  threatBadge: {
    backgroundColor: Theme.BG_SECTION,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 0.3,
    borderColor: Theme.BORDER_LIGHT,
    alignSelf: 'flex-start',
  },
  threatText: { fontSize: 6, color: Theme.PRIMARY_BLUE, textTransform: 'capitalize' },
  adsCount: { fontSize: 7.5, fontWeight: '700', color: Theme.PRIMARY_BLUE },
  adTableHeader: {
    flexDirection: 'row',
    backgroundColor: Theme.BG_SECTION,
    paddingVertical: 6,
    paddingHorizontal: 5,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    borderRadius: 4,
    marginBottom: 4,
  },
  adTableHeaderCell: {
    fontSize: 6.5,
    fontWeight: '900',
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  adRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: Theme.BORDER_LIGHT,
    alignItems: 'flex-start',
  },
  colAdIndex: { width: '4%', paddingRight: 3, alignItems: 'center' },
  colAdContent: { width: '30%', paddingRight: 6 },
  colAdDest: { width: '24%', paddingRight: 6 },
  colAdThreat: { width: '16%', paddingRight: 4 },
  colAdRisk: { width: '13%', paddingRight: 4 },
  colAdDates: { width: '13%' },
  adImage: {
    width: 36,
    height: 36,
    borderRadius: 3,
    marginRight: 6,
    objectFit: 'cover',
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
  },
  contentContainer: { flexDirection: 'row' },
  contentInfo: { flex: 1, flexDirection: 'column' },
  captionText: { fontSize: 7, color: Theme.PRIMARY_BLUE, lineHeight: 1.3, marginBottom: 1 },
  formatText: {
    fontSize: 5.5,
    color: Theme.SECONDARY_GRAY,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  linkText: { fontSize: 6.5, color: Theme.LINK, textDecoration: 'none' },
  destLabel: {
    fontSize: 5.5,
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 1,
  },
  destValue: { fontSize: 6.5, color: Theme.PRIMARY_BLUE, marginBottom: 2 },
  mismatchBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Theme.WARN_BG,
    borderWidth: 0.5,
    borderColor: Theme.WARN,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginTop: 1,
  },
  mismatchText: { fontSize: 5.5, fontWeight: '900', color: Theme.WARN, textTransform: 'uppercase' },
  dateLabel: {
    fontSize: 5.5,
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  dateValue: { fontSize: 6, color: Theme.PRIMARY_BLUE, marginBottom: 3 },
  indexText: { fontSize: 7.5, fontWeight: '700', color: Theme.PRIMARY_BLUE },
  profileBlock: { marginBottom: 16 },
  profileBio: {
    fontSize: 7,
    color: Theme.PRIMARY_BLUE,
    lineHeight: 1.35,
    marginTop: 2,
  },
  reviewSection: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    marginBottom: 12,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  reviewSectionLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: Theme.PRIMARY_BLUE,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  reviewSubLabel: {
    fontSize: 6.5,
    fontWeight: '900',
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
    marginTop: 8,
  },
  reviewBody: {
    fontSize: 7,
    color: Theme.PRIMARY_BLUE,
    lineHeight: 1.45,
  },
  reviewBodySoft: {
    fontSize: 7,
    color: Theme.SECONDARY_GRAY,
    lineHeight: 1.45,
  },
  reasoningLabel: {
    fontSize: 7,
    fontWeight: '700',
    color: Theme.PRIMARY_BLUE,
  },
  reasoningSection: { marginBottom: 4 },
  reasoningSectionLast: { marginBottom: 0 },
  verdictBadge: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: '#F8FAFC',
    borderColor: Theme.BORDER_LIGHT,
    alignSelf: 'flex-start',
  },
  verdictBadgeText: {
    fontSize: 6.5,
    fontWeight: '900',
    color: Theme.PRIMARY_BLUE,
    textTransform: 'uppercase',
  },
  violationPill: {
    backgroundColor: '#FFF1F2',
    borderWidth: 0.5,
    borderColor: Theme.RISK_HIGH,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  violationPillText: {
    fontSize: 6.5,
    fontWeight: '700',
    color: Theme.RISK_HIGH,
    textTransform: 'capitalize',
  },
  legalCardShell: {
    flexDirection: 'row',
    borderWidth: 0.5,
    borderColor: '#FECDD3',
    borderRadius: 4,
    backgroundColor: '#FFF1F2',
    overflow: 'hidden',
    marginBottom: 5,
  },
  legalCardShellLast: { marginBottom: 0 },
  legalCardAccent: {
    width: 3,
    backgroundColor: Theme.RISK_HIGH,
  },
  legalCardInner: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  legalCode: {
    fontSize: 7,
    fontWeight: '900',
    color: Theme.RISK_HIGH,
    letterSpacing: 0.15,
    marginBottom: 2,
  },
  legalReason: {
    fontSize: 6.5,
    color: Theme.SECONDARY_GRAY,
    lineHeight: 1.4,
    width: '100%',
  },
  highlightStrip: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 0,
  },
  highlightCard: {
    flex: 1,
    backgroundColor: Theme.BG_SECTION,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  highlightCardAccent: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  highlightLabel: {
    fontSize: 5.5,
    fontWeight: 'bold',
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  highlightValue: {
    fontSize: 12,
    fontWeight: '900',
    color: Theme.PRIMARY_BLUE,
  },
  highlightValueDanger: {
    fontSize: 9.5,
    fontWeight: '900',
    color: Theme.RISK_HIGH,
    textTransform: 'capitalize',
  },
  highlightMeta: {
    fontSize: 6,
    color: Theme.SECONDARY_GRAY,
    marginTop: 2,
  },
  evidenceSection: {
    flexDirection: 'column',
    gap: 8,
    flexGrow: 1,
  },
  evidenceTitle: {
    fontSize: 7.5,
    fontWeight: '900',
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  evidenceBlock: {
    flexDirection: 'column',
    gap: 4,
  },
  evidenceSubLabel: {
    fontSize: 6,
    fontWeight: 'bold',
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  evidenceThumbs: {
    flexDirection: 'row',
    gap: 5,
  },
  evidenceThumb: {
    flex: 1,
    height: 72,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    objectFit: 'cover',
    backgroundColor: '#FFFFFF',
  },
  evidenceThumbPlaceholder: {
    flex: 1,
    height: 72,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectedDivider: {
    marginTop: 8,
    marginBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Theme.BORDER_LIGHT,
  },
  connectedTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: Theme.PRIMARY_BLUE,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
});

function formatViolationLabel(value) {
  return String(value || '')
    .replace(/[-_]/g, ' ')
    .trim();
}

function collectProfilePois(ads) {
  const names = new Set();
  let detectedCount = 0;
  for (const ad of ads || []) {
    const review = ad?.review_details || {};
    const flagged =
      Boolean(ad?.poi_detected) ||
      Boolean(review.face_present) ||
      Boolean(review.flags?.poi_confirmed);
    if (flagged) detectedCount += 1;
    for (const name of review.poi_names || []) {
      const text = String(name || '').trim();
      if (text) names.add(text);
    }
  }
  return {
    detectedCount,
    names: [...names],
    hasSignal: detectedCount > 0 || names.size > 0,
  };
}

export function adSourceLinkLabel(ad) {
  const source = String(ad?.source || '').toLowerCase();
  const url = String(ad?.original_url || '');
  if (source === 'meta_feed_link' || /\/posts\//i.test(url)) return 'View Post';
  if (source === 'meta_ads_library' || /ads\/library/i.test(url)) return 'Ad Library';
  return url ? 'View Source' : '';
}

function parseReasoning(text) {
  if (!text) return [];
  const cleaned = String(text);
  const lines = cleaned.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  return lines.map((line) => {
    const match = line.match(/^([A-Z][A-Za-z0-9 &/()\-]{2,40}?):\s*(.+)$/);
    if (match) return { label: match[1].trim(), content: match[2].trim() };
    return { label: '', content: line };
  });
}

function formatVerdictLabel(value) {
  if (!value) return '';
  return String(value)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveProjectLegalCodes(project) {
  let projectDetails = project?.project_details;
  if (typeof projectDetails === 'string') {
    try {
      projectDetails = JSON.parse(projectDetails);
    } catch {
      projectDetails = {};
    }
  }
  return Array.isArray(projectDetails?.legal_codes) ? projectDetails.legal_codes : [];
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

export function profileRiskInfo(profile) {
  const rank = String(profile?.risk_rank || profile?.risk || '').toLowerCase();
  if (rank === 'high') {
    return { label: 'High Risk', color: Theme.RISK_HIGH, bg: '#FFF1F2' };
  }
  if (rank === 'medium') {
    return { label: 'Medium Risk', color: Theme.RISK_MEDIUM, bg: '#FFF7ED' };
  }
  if (rank === 'low') {
    return { label: 'Low Risk', color: Theme.RISK_LOW, bg: '#FFFBEB' };
  }
  if (rank === 'safe') {
    return { label: 'Safe', color: Theme.SAFE, bg: '#ECFDF5' };
  }
  return { label: 'Reviewed', color: Theme.SECONDARY_GRAY, bg: Theme.BG_SECTION };
}

export function adRiskInfo(ad) {
  const score = ad?.review_details?.threat_score ?? ad?.analysis_results?.risk_score ?? null;
  const hasReview =
    score != null ||
    (Array.isArray(ad?.review_details?.threat_types) && ad.review_details.threat_types.length > 0) ||
    Boolean(ad?.reviewed_at);
  if (!hasReview) {
    return { label: 'Unreviewed', color: Theme.SECONDARY_GRAY, bg: Theme.BG_SECTION };
  }
  if (score > 95) return { label: 'High Risk', color: Theme.RISK_HIGH, bg: '#FFF1F2' };
  if (score > 75) return { label: 'Medium Risk', color: Theme.RISK_MEDIUM, bg: '#FFF7ED' };
  if (score > 40) return { label: 'Low Risk', color: Theme.RISK_LOW, bg: '#FFFBEB' };
  return { label: 'Safe', color: Theme.SAFE, bg: '#ECFDF5' };
}

export function resolveAdThreats(ad, project) {
  const review = ad?.review_details || {};
  let projectDetails = project?.project_details;
  if (typeof projectDetails === 'string') {
    try {
      projectDetails = JSON.parse(projectDetails);
    } catch {
      projectDetails = {};
    }
  }
  const projectLabels = projectDetails?.labels || [];
  const resolved = [];
  const threatTypes = Array.isArray(review.threat_types) ? review.threat_types : [];

  projectLabels.forEach((label) => {
    const inFlags = review.flags?.[label.name] === true;
    const inThreatTypes = threatTypes.includes(label.name);
    if (inFlags || inThreatTypes) {
      resolved.push(label.name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
    }
  });

  threatTypes.forEach((type) => {
    if (!type || type === 'safe') return;
    const formatted = type.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    if (!resolved.some((t) => t.toLowerCase() === formatted.toLowerCase())) {
      resolved.push(formatted);
    }
  });

  return resolved;
}

export function isHighRiskAd(ad) {
  const rank = String(ad?.list?.risk_rank || '').toLowerCase();
  if (rank === 'high') return true;
  const score = ad?.review_details?.threat_score ?? ad?.analysis_results?.risk_score ?? null;
  return typeof score === 'number' && score > 95;
}

export function profileGroupMetrics(group) {
  const ads = group?.ads || [];
  const domains = group?.domains || [];
  let highAds = 0;
  let mismatch = 0;
  let active = 0;
  ads.forEach((ad) => {
    if (isHighRiskAd(ad)) highAds += 1;
    if (ad.destination_mismatch) mismatch += 1;
    if (ad.is_active) active += 1;
  });
  let highDomains = 0;
  let cloaked = 0;
  domains.forEach((domain) => {
    const rank = String(domain?.list?.risk_rank || '').toLowerCase();
    const score = domain?.review_details?.threat_score ?? domain?.list?.effective_threat_score;
    if (rank === 'high' || (typeof score === 'number' && score >= 96)) highDomains += 1;
    if (domainHasCloaking(domain)) cloaked += 1;
  });
  return {
    totalAds: ads.length,
    highAds,
    mismatch,
    active,
    totalDomains: domains.length,
    highDomains,
    cloaked,
  };
}

export function catalogMetrics(profiles) {
  let totalProfiles = profiles.length;
  let totalAds = 0;
  let highAds = 0;
  let totalDomains = 0;
  let highDomains = 0;
  let highProfiles = 0;
  profiles.forEach((group) => {
    const m = profileGroupMetrics(group);
    totalAds += m.totalAds;
    highAds += m.highAds;
    totalDomains += m.totalDomains;
    highDomains += m.highDomains;
    const risk = String(group.profile?.risk_rank || group.profile?.risk || '').toLowerCase();
    if (risk === 'high') highProfiles += 1;
  });
  return { totalProfiles, totalAds, highAds, totalDomains, highDomains, highProfiles };
}

export const PageHeader = ({ subtitle = 'Ad Profiles Integrity Report' }) => (
  <View style={sharedStyles.header} fixed>
    <View>
      <Text style={sharedStyles.title}>OVERWATCH</Text>
      <Text style={sharedStyles.subtitle}>{subtitle}</Text>
    </View>
    <View style={sharedStyles.headerRight}>
      <Text style={sharedStyles.headerDate}>{formatCompleteDate(new Date())}</Text>
    </View>
  </View>
);

export const PageFooter = () => (
  <View style={sharedStyles.footer} fixed>
    <Text style={sharedStyles.footerLeft}>CONFIDENTIAL DOCUMENT</Text>
    <Text style={sharedStyles.footerCenter}>POWERED BY CONTRAILS AI</Text>
    <Text
      style={sharedStyles.footerRight}
      render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} OF ${totalPages}`}
    />
  </View>
);

export const CatalogMetricsSection = ({ profiles }) => {
  const m = catalogMetrics(profiles || []);
  const cards = [
    { label: 'Profiles', value: m.totalProfiles, color: Theme.PRIMARY_BLUE },
    { label: 'High Risk Profiles', value: m.highProfiles, color: Theme.RISK_HIGH },
    { label: 'Reviewed Ads', value: m.totalAds, color: Theme.PRIMARY_BLUE },
    { label: 'High Risk Ads', value: m.highAds, color: Theme.RISK_HIGH },
    { label: 'Domains', value: m.totalDomains, color: Theme.PRIMARY_BLUE },
    { label: 'High Risk Domains', value: m.highDomains, color: Theme.RISK_HIGH },
  ];
  return (
    <View style={sharedStyles.metricsSection}>
      <Text style={sharedStyles.sectionTitle}>Executive Summary</Text>
      <View style={sharedStyles.metricsGrid}>
        {cards.map((card) => (
          <View key={card.label} style={sharedStyles.metricCard}>
            <Text style={sharedStyles.metricLabel}>{card.label}</Text>
            <Text style={[sharedStyles.metricValue, { color: card.color }]}>
              {card.value.toLocaleString()}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export const ProfileMetricsSection = ({ group }) => {
  const m = profileGroupMetrics(group);
  const cards = [
    { label: 'Reviewed Ads', value: m.totalAds, color: Theme.PRIMARY_BLUE },
    { label: 'High Risk Ads', value: m.highAds, color: Theme.RISK_HIGH },
    { label: 'Mismatch', value: m.mismatch, color: m.mismatch > 0 ? Theme.RISK_HIGH : Theme.PRIMARY_BLUE },
    { label: 'Domains', value: m.totalDomains, color: Theme.PRIMARY_BLUE },
    { label: 'High Domains', value: m.highDomains, color: Theme.RISK_HIGH },
    { label: 'Cloaked', value: m.cloaked, color: m.cloaked > 0 ? Theme.WARN : Theme.PRIMARY_BLUE },
  ];
  return (
    <View style={sharedStyles.metricsSection}>
      <Text style={sharedStyles.sectionTitle}>Profile Metrics</Text>
      <View style={sharedStyles.metricsGrid}>
        {cards.map((card) => (
          <View key={card.label} style={sharedStyles.metricCard}>
            <Text style={sharedStyles.metricLabel}>{card.label}</Text>
            <Text style={[sharedStyles.metricValue, { color: card.color }]}>
              {card.value.toLocaleString()}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export const ProfileBanner = ({ profile, profilePic }) => {
  const risk = profileRiskInfo(profile);
  const categories = Array.isArray(profile?.page_categories) ? profile.page_categories : [];
  const biography = profile?.biography || profile?.enrichment?.biography || null;

  return (
    <View style={sharedStyles.profileBanner} wrap={false}>
      <View style={sharedStyles.profileBannerLeft}>
        {profilePic ? (
          <Image style={sharedStyles.profileImage} src={profilePic} />
        ) : (
          <View style={sharedStyles.profileImagePlaceholder}>
            <Text style={{ fontSize: 6, color: Theme.SECONDARY_GRAY }}>No Pic</Text>
          </View>
        )}
        <View style={sharedStyles.profileInfo}>
          <Text style={sharedStyles.profileName}>{processText(profile?.page_name || 'Unknown', 48)}</Text>
          <Text style={sharedStyles.profileMeta}>
            {(profile?.platform || 'meta').toUpperCase()}
            {profile?.is_verified ? ' · Verified' : ''}
            {profile?.follower_count != null ? ` · ${Number(profile.follower_count).toLocaleString()} followers` : ''}
            {profile?.ad_count != null ? ` · ${Number(profile.ad_count).toLocaleString()} ads` : ''}
          </Text>
          {biography ? (
            <Text style={sharedStyles.profileBio}>{processText(String(biography), 120, 2)}</Text>
          ) : null}
          {profile?.profile_url ? (
            <Link src={profile.profile_url} style={sharedStyles.profileLink} target="_blank">
              {processText(profile.profile_url, 60)}
            </Link>
          ) : null}
        </View>
      </View>
      <View style={sharedStyles.profileBannerRight}>
        <View style={sharedStyles.detailRow}>
          <Text style={sharedStyles.detailLabel}>Risk</Text>
          <View style={[sharedStyles.riskBadge, { backgroundColor: risk.bg, borderColor: risk.color }]}>
            <Text style={[sharedStyles.riskBadgeText, { color: risk.color }]}>{risk.label}</Text>
          </View>
        </View>
        {categories.length > 0 ? (
          <View style={sharedStyles.detailRow}>
            <Text style={sharedStyles.detailLabel}>Category</Text>
            <Text style={sharedStyles.detailValue}>
              {processText(categories.slice(0, 3).join(', '), 28)}
            </Text>
          </View>
        ) : null}
        <View style={sharedStyles.detailRow}>
          <Text style={sharedStyles.detailLabel}>Status</Text>
          <Text style={sharedStyles.detailValue}>{processText(profile?.client_status || 'open', 20)}</Text>
        </View>
        <View style={sharedStyles.detailRow}>
          <Text style={sharedStyles.detailLabel}>Reviewed</Text>
          <Text style={sharedStyles.detailValue}>{formatCompleteDate(profile?.reviewed_at)}</Text>
        </View>
      </View>
    </View>
  );
};

export const ProfileHighlightStrip = ({ group }) => {
  const profile = group?.profile || {};
  const review = profile.review_details || {};
  const violations = Array.isArray(profile.violations)
    ? profile.violations
    : Array.isArray(review.violations)
      ? review.violations
      : Array.isArray(review.threat_types)
        ? review.threat_types
        : [];
  const adCount =
    profile.ad_count != null
      ? Number(profile.ad_count)
      : group?.totalAdCount != null
        ? Number(group.totalAdCount)
        : (group?.ads || []).length;
  const primaryViolation = violations[0] ? formatViolationLabel(violations[0]) : '';
  const extraViolations = violations.slice(1).map(formatViolationLabel).filter(Boolean);
  const pois = collectProfilePois(group?.ads || group?.displayAds || []);

  return (
    <View style={sharedStyles.highlightStrip} wrap={false}>
      <View style={sharedStyles.highlightCard}>
        <Text style={sharedStyles.highlightLabel}>Ads Ran</Text>
        <Text style={sharedStyles.highlightValue}>{Number.isFinite(adCount) ? adCount.toLocaleString() : '—'}</Text>
        {group?.shownAdCount != null && group?.totalAdCount != null && group.totalAdCount !== group.shownAdCount ? (
          <Text style={sharedStyles.highlightMeta}>
            {group.shownAdCount} shown in report
          </Text>
        ) : null}
      </View>
      <View style={[sharedStyles.highlightCard, primaryViolation ? sharedStyles.highlightCardAccent : null]}>
        <Text style={sharedStyles.highlightLabel}>Scam / Violations</Text>
        <Text style={primaryViolation ? sharedStyles.highlightValueDanger : sharedStyles.highlightValue}>
          {primaryViolation || 'None flagged'}
        </Text>
        {extraViolations.length > 0 ? (
          <Text style={sharedStyles.highlightMeta}>
            {processText(extraViolations.slice(0, 3).join(' · '), 48)}
          </Text>
        ) : null}
      </View>
      {pois.hasSignal ? (
        <View style={sharedStyles.highlightCard}>
          <Text style={sharedStyles.highlightLabel}>POIs</Text>
          <Text style={sharedStyles.highlightValue}>
            {pois.names.length > 0 ? processText(pois.names[0], 22) : `${pois.detectedCount} detected`}
          </Text>
          {pois.names.length > 1 ? (
            <Text style={sharedStyles.highlightMeta}>
              {processText(pois.names.slice(1, 3).join(' · '), 40)}
            </Text>
          ) : pois.names.length === 1 && pois.detectedCount > 1 ? (
            <Text style={sharedStyles.highlightMeta}>{pois.detectedCount} ads flagged</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

export const EvidencePreview = ({ group }) => {
  const adImages = (group?.compressedAdImages || []).filter(Boolean).slice(0, 2);
  const domainImages = (group?.compressedDomainImages || []).filter(Boolean).slice(0, 2);
  if (adImages.length === 0 && domainImages.length === 0) return null;

  const renderThumbs = (images, emptyLabel) => {
    if (images.length === 0) {
      return (
        <View style={sharedStyles.evidenceThumbs}>
          <View style={sharedStyles.evidenceThumbPlaceholder}>
            <Text style={{ fontSize: 6, color: Theme.SECONDARY_GRAY }}>{emptyLabel}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={sharedStyles.evidenceThumbs}>
        {images.map((src, idx) => (
          <Image key={idx} style={sharedStyles.evidenceThumb} src={src} />
        ))}
      </View>
    );
  };

  return (
    <View style={sharedStyles.evidenceSection}>
      <Text style={sharedStyles.evidenceTitle}>Evidence</Text>
      {adImages.length > 0 ? (
        <View style={sharedStyles.evidenceBlock}>
          <Text style={sharedStyles.evidenceSubLabel}>Ad Creatives</Text>
          {renderThumbs(adImages, 'No ad image')}
        </View>
      ) : null}
      {domainImages.length > 0 ? (
        <View style={sharedStyles.evidenceBlock}>
          <Text style={sharedStyles.evidenceSubLabel}>Domain Screenshots</Text>
          {renderThumbs(domainImages, 'No domain image')}
        </View>
      ) : null}
    </View>
  );
};

export const ProfileHeroSection = ({ group }) => {
  const hasEvidence =
    (group?.compressedAdImages || []).some(Boolean) ||
    (group?.compressedDomainImages || []).some(Boolean);

  return (
    <View style={sharedStyles.profileHeroRow} wrap={false}>
      <View style={hasEvidence ? sharedStyles.profileHeroLeft : sharedStyles.profileHeroLeftFull}>
        <ProfileBanner profile={group.profile} profilePic={group.compressedProfilePic} />
        <ProfileHighlightStrip group={group} />
      </View>
      {hasEvidence ? (
        <View style={sharedStyles.profileHeroRight}>
          <EvidencePreview group={group} />
        </View>
      ) : null}
    </View>
  );
};

export const ProfileReviewSection = ({ profile, project }) => {
  const review = profile?.review_details || {};
  const risk = profileRiskInfo(profile);
  const caseSummary = profile?.case_summary || review.case_summary || '';
  const reasoning = profile?.reasoning || review.reasoning || '';
  const reviewerComments = (profile?.reviewer_comments || review.reviewer_comments || '').trim();
  const violations = Array.isArray(profile?.violations)
    ? profile.violations
    : Array.isArray(review.violations)
      ? review.violations
      : [];
  const verdictRaw =
    profile?.recommended_action ||
    review.recommended_action ||
    profile?.verdict ||
    review.verdict ||
    null;
  const verdictLabel = formatVerdictLabel(verdictRaw);
  const projectLegalCodes = resolveProjectLegalCodes(project);
  const legalCodesRaw = Array.isArray(profile?.legal_codes)
    ? profile.legal_codes
    : Array.isArray(review.legal_codes)
      ? review.legal_codes
      : [];
  const legalCodes = legalCodesRaw
    .map((item) => {
      if (typeof item === 'string') return { code: item, reasoning: '' };
      return { code: item?.code || item?.name || '', reasoning: item?.reasoning || '' };
    })
    .filter((item) => item.code)
    .map((item) => {
      if (item.reasoning) return item;
      const projCode = projectLegalCodes.find(
        (pc) => pc.name === item.code || pc.codeName === item.code || pc.code === item.code,
      );
      return { ...item, reasoning: projCode?.description || '' };
    });

  const hasContent = Boolean(
    caseSummary || legalCodes.length || reasoning || reviewerComments || violations.length || verdictLabel,
  );
  if (!hasContent) return null;

  const reasoningSections = parseReasoning(reasoning);

  return (
    <View style={sharedStyles.reviewSection}>
      <Text style={sharedStyles.reviewSectionLabel}>Review Details</Text>
      <View style={sharedStyles.reviewHeaderRow} wrap={false}>
        <View style={[sharedStyles.riskBadge, { backgroundColor: risk.bg, borderColor: risk.color }]}>
          <Text style={[sharedStyles.riskBadgeText, { color: risk.color }]}>{risk.label}</Text>
        </View>
        {verdictLabel ? (
          <View style={sharedStyles.verdictBadge}>
            <Text style={sharedStyles.verdictBadgeText}>{processText(verdictLabel, 28)}</Text>
          </View>
        ) : null}
      </View>

      {caseSummary ? (
        <>
          <Text style={[sharedStyles.reviewSubLabel, { marginTop: 0 }]}>Case Summary</Text>
          <Text style={sharedStyles.reviewBody}>{processText(caseSummary, 420, 6)}</Text>
        </>
      ) : null}

      {violations.length > 0 ? (
        <>
          <Text style={sharedStyles.reviewSubLabel}>Detected Violations</Text>
          <View style={sharedStyles.chipRow}>
            {violations.slice(0, 8).map((v, idx) => (
              <View key={idx} style={sharedStyles.violationPill}>
                <Text style={sharedStyles.violationPillText}>
                  {processText(String(v).replace(/[-_]/g, ' '), 28)}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {legalCodes.length > 0 ? (
        <>
          <Text style={sharedStyles.reviewSubLabel}>Legal Violations</Text>
          {legalCodes.map((item, idx) => (
            <View
              key={idx}
              style={[
                sharedStyles.legalCardShell,
                idx === legalCodes.length - 1 && sharedStyles.legalCardShellLast,
              ]}
            >
              <View style={sharedStyles.legalCardAccent} />
              <View style={sharedStyles.legalCardInner}>
                <Text style={sharedStyles.legalCode}>{processText(item.code, 120)}</Text>
                {item.reasoning ? (
                  <Text style={sharedStyles.legalReason}>{processText(item.reasoning, 900, 12)}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </>
      ) : null}

      {reasoning ? (
        <>
          <Text style={sharedStyles.reviewSubLabel}>Reasoning</Text>
          {reasoningSections.length === 0 ? (
            <Text style={sharedStyles.reviewBodySoft}>No reviewer reasoning.</Text>
          ) : reasoningSections.length === 1 && !reasoningSections[0].label ? (
            <Text style={sharedStyles.reviewBodySoft}>
              {processText(reasoningSections[0].content, 1600, 20)}
            </Text>
          ) : (
            reasoningSections.map((sec, i) => (
              <View
                key={i}
                style={[
                  sharedStyles.reasoningSection,
                  i === reasoningSections.length - 1 && sharedStyles.reasoningSectionLast,
                ]}
              >
                <Text style={sharedStyles.reviewBodySoft}>
                  {sec.label ? <Text style={sharedStyles.reasoningLabel}>{sec.label}: </Text> : null}
                  {processText(sec.content, 900, 12)}
                </Text>
              </View>
            ))
          )}
        </>
      ) : !caseSummary && legalCodes.length === 0 ? (
        <Text style={sharedStyles.reviewBodySoft}>No reviewer reasoning.</Text>
      ) : null}

      {reviewerComments ? (
        <>
          <Text style={sharedStyles.reviewSubLabel}>Reviewer Comments</Text>
          <Text style={sharedStyles.reviewBody}>{processText(reviewerComments, 360, 5)}</Text>
        </>
      ) : null}
    </View>
  );
};

export const ConnectedContentDivider = () => (
  <View style={sharedStyles.connectedDivider} wrap={false}>
    <Text style={sharedStyles.connectedTitle}>Connected Content</Text>
  </View>
);

export const DomainsTable = ({ domains, compressedDomainImages }) => {
  if (!domains || domains.length === 0) {
    return (
      <View style={{ marginBottom: 10 }}>
        <Text style={sharedStyles.sectionTitle}>Linked Domains</Text>
        <Text style={sharedStyles.noteText}>No reviewed domains linked to this profile's ads.</Text>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={sharedStyles.sectionTitle}>Linked Domains ({domains.length})</Text>
      <View style={sharedStyles.domainTableHeader} fixed>
        <Text style={[sharedStyles.domainTableHeaderCell, sharedStyles.colDomIndex]}>#</Text>
        <Text style={[sharedStyles.domainTableHeaderCell, sharedStyles.colDomain]}>Domain</Text>
        <Text style={[sharedStyles.domainTableHeaderCell, sharedStyles.colDomRisk]}>Risk</Text>
        <Text style={[sharedStyles.domainTableHeaderCell, sharedStyles.colDomCloak]}>Cloaked</Text>
        <Text style={[sharedStyles.domainTableHeaderCell, sharedStyles.colDomThreat]}>Violations</Text>
        <Text style={[sharedStyles.domainTableHeaderCell, sharedStyles.colDomAds]}>Ads</Text>
      </View>
      {domains.map((domain, idx) => {
        const riskInfo = domainRiskInfo(domain);
        const visitUrl = domainVisitUrl(domain);
        const cloaked = domainHasCloaking(domain);
        const landerCount = clientVisibleCloakVariants(domain).length;
        const violations = collectDomainViolations(domain).slice(0, 3);
        const imageUrl = compressedDomainImages?.[idx] || null;
        return (
          <View key={domain._id || idx} style={sharedStyles.domainRow} wrap={false}>
            <View style={sharedStyles.colDomIndex}>
              <Text style={sharedStyles.indexText}>{idx + 1}</Text>
            </View>
            <View style={sharedStyles.colDomain}>
              {imageUrl ? (
                <Image style={sharedStyles.domainThumb} src={imageUrl} />
              ) : (
                <View style={sharedStyles.domainThumbPlaceholder}>
                  <Text style={{ fontSize: 5.5, color: Theme.SECONDARY_GRAY }}>No Img</Text>
                </View>
              )}
              <Text style={sharedStyles.domainName}>{processText(domain.domain_name || 'Unknown', 36)}</Text>
              {visitUrl ? (
                <Link src={visitUrl} style={sharedStyles.visitUrl} target="_blank">
                  {processText(visitUrl, 42)}
                </Link>
              ) : null}
            </View>
            <View style={sharedStyles.colDomRisk}>
              <View style={[sharedStyles.riskBadge, { backgroundColor: riskInfo.bg, borderColor: riskInfo.color }]}>
                <Text style={[sharedStyles.riskBadgeText, { color: riskInfo.color }]}>{riskInfo.label}</Text>
              </View>
            </View>
            <View style={sharedStyles.colDomCloak}>
              <Text style={sharedStyles.cloakText}>{cloaked ? 'Y' : 'N'}</Text>
              <Text style={sharedStyles.cloakMeta}>
                {landerCount} lander{landerCount === 1 ? '' : 's'} · {processText(domainLanderCaption(domain), 14)}
              </Text>
            </View>
            <View style={sharedStyles.colDomThreat}>
              <View style={sharedStyles.threatContainer}>
                {violations.length === 0 ? (
                  <Text style={sharedStyles.cloakMeta}>—</Text>
                ) : (
                  violations.map((threat, tIdx) => (
                    <View key={tIdx} style={sharedStyles.threatBadge}>
                      <Text style={sharedStyles.threatText}>
                        {processText(threat.replace(/[-_]/g, ' '), 18)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </View>
            <View style={sharedStyles.colDomAds}>
              <Text style={sharedStyles.adsCount}>{domainAdsCount(domain).toLocaleString()}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

export const AdsTable = ({
  displayAds,
  compressedAdImages,
  project,
  totalAdCount,
  shownAdCount,
}) => {
  const capped = (totalAdCount || 0) > (shownAdCount || 0);
  return (
    <View>
      <Text style={sharedStyles.sectionTitle}>Reviewed Ads</Text>
      <Text style={sharedStyles.noteText}>
        {capped
          ? `Showing ${shownAdCount} of ${totalAdCount} reviewed ads (highest threat, feed placement, then most recent).`
          : `${totalAdCount || 0} reviewed ad${(totalAdCount || 0) === 1 ? '' : 's'}.`}
      </Text>
      {(displayAds || []).length === 0 ? (
        <Text style={sharedStyles.noteText}>No reviewed ads for this profile.</Text>
      ) : (
        <>
          <View style={sharedStyles.adTableHeader} fixed>
            <Text style={[sharedStyles.adTableHeaderCell, sharedStyles.colAdIndex]}>#</Text>
            <Text style={[sharedStyles.adTableHeaderCell, sharedStyles.colAdContent]}>Creative</Text>
            <Text style={[sharedStyles.adTableHeaderCell, sharedStyles.colAdDest]}>Destinations</Text>
            <Text style={[sharedStyles.adTableHeaderCell, sharedStyles.colAdThreat]}>Violations</Text>
            <Text style={[sharedStyles.adTableHeaderCell, sharedStyles.colAdRisk]}>Risk</Text>
            <Text style={[sharedStyles.adTableHeaderCell, sharedStyles.colAdDates]}>Dates</Text>
          </View>
          {displayAds.map((ad, idx) => {
            const risk = adRiskInfo(ad);
            const threats = resolveAdThreats(ad, project).slice(0, 3);
            const imageUrl = compressedAdImages?.[idx] || null;
            const creative = ad.title || ad.caption || ad.cta_text || 'Untitled creative';
            return (
              <View key={ad._id || idx} style={sharedStyles.adRow} wrap={false}>
                <View style={sharedStyles.colAdIndex}>
                  <Text style={sharedStyles.indexText}>{idx + 1}</Text>
                </View>
                <View style={sharedStyles.colAdContent}>
                  <View style={sharedStyles.contentContainer}>
                    {imageUrl ? (
                      <Image style={sharedStyles.adImage} src={imageUrl} />
                    ) : (
                      <View
                        style={[
                          sharedStyles.adImage,
                          { justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.BG_SECTION },
                        ]}
                      >
                        <Text style={{ fontSize: 5, color: Theme.SECONDARY_GRAY }}>No</Text>
                      </View>
                    )}
                    <View style={sharedStyles.contentInfo}>
                      <Text style={sharedStyles.formatText}>
                        {processText(ad.display_format || 'Ad')}
                        {ad.card_count ? ` · ${ad.card_count} cards` : ''}
                      </Text>
                      <Text style={sharedStyles.captionText}>{processText(creative, 70, 2)}</Text>
                      {ad.original_url ? (
                        <Link src={ad.original_url} style={sharedStyles.linkText} target="_blank">
                          {adSourceLinkLabel(ad)}
                        </Link>
                      ) : null}
                    </View>
                  </View>
                </View>
                <View style={sharedStyles.colAdDest}>
                  <Text style={sharedStyles.destLabel}>Shown as</Text>
                  <Text style={sharedStyles.destValue}>
                    {processText(ad.shown_hostname || ad.caption || '—', 24)}
                  </Text>
                  <Text style={sharedStyles.destLabel}>Card destinations</Text>
                  <Text style={sharedStyles.destValue}>
                    {processText((ad.card_hostnames || []).slice(0, 3).join(', ') || '—', 32)}
                  </Text>
                  {ad.destination_mismatch ? (
                    <View style={sharedStyles.mismatchBadge}>
                      <Text style={sharedStyles.mismatchText}>Mismatch</Text>
                    </View>
                  ) : null}
                </View>
                <View style={sharedStyles.colAdThreat}>
                  <View style={sharedStyles.threatContainer}>
                    {threats.length === 0 ? (
                      <Text style={sharedStyles.cloakMeta}>—</Text>
                    ) : (
                      threats.map((threat, tIdx) => (
                        <View key={tIdx} style={sharedStyles.threatBadge}>
                          <Text style={sharedStyles.threatText}>{processText(threat, 18)}</Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
                <View style={sharedStyles.colAdRisk}>
                  <View style={[sharedStyles.riskBadge, { backgroundColor: risk.bg, borderColor: risk.color }]}>
                    <Text style={[sharedStyles.riskBadgeText, { color: risk.color }]}>{risk.label}</Text>
                  </View>
                </View>
                <View style={sharedStyles.colAdDates}>
                  <Text style={sharedStyles.dateLabel}>Started</Text>
                  <Text style={sharedStyles.dateValue}>
                    {formatCompleteDate(ad.posted_date || ad.start_date || ad.created_at)}
                  </Text>
                  <Text style={sharedStyles.dateLabel}>Sourced</Text>
                  <Text style={sharedStyles.dateValue}>
                    {formatCompleteDate(ad.sourcing_date || ad.created_at)}
                  </Text>
                </View>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
};

export const ProfileReportBlock = ({ group, project, breakBefore = false }) => (
  <View style={sharedStyles.profileBlock} break={breakBefore || undefined} wrap>
    <ProfileHeroSection group={group} />
    <ProfileReviewSection profile={group.profile} project={project} />
    <ConnectedContentDivider />
    <ProfileMetricsSection group={group} />
    <DomainsTable domains={group.domains} compressedDomainImages={group.compressedDomainImages} />
    <AdsTable
      displayAds={group.displayAds}
      compressedAdImages={group.compressedAdImages}
      project={project}
      totalAdCount={group.totalAdCount}
      shownAdCount={group.shownAdCount}
    />
  </View>
);

export { processText };
