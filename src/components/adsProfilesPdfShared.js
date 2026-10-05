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
    flexDirection: 'column',
    gap: 8,
    flexGrow: 1,
    backgroundColor: Theme.BG_SECTION,
    paddingVertical: 10,
    paddingHorizontal: 9,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    marginBottom: 0,
  },
  profileBannerIdentity: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  profileImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Theme.BORDER_LIGHT,
    backgroundColor: '#FFFFFF',
    objectFit: 'cover',
  },
  profileImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Theme.BORDER_LIGHT,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: { flex: 1, flexDirection: 'column', gap: 4 },
  profileName: { fontSize: 13, fontWeight: '900', color: Theme.PRIMARY_BLUE },
  profileMeta: { fontSize: 8.5, color: Theme.SECONDARY_GRAY, fontWeight: 'bold' },
  profileLink: {
    fontSize: 7.5,
    color: Theme.LINK,
    textDecoration: 'underline',
    marginTop: 1,
  },
  profileLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  profileLinkSep: { fontSize: 7.5, color: Theme.SECONDARY_GRAY },
  profileBannerDetails: {
    flexDirection: 'column',
    gap: 7,
    borderTopWidth: 0.5,
    borderTopColor: Theme.BORDER_LIGHT,
    paddingTop: 10,
    marginTop: 3,
  },
  // Page-1 hero: left = profile + meta + stats; right = vertical evidence.
  // Fixed height keeps Review Details starting at the same place.
  pageOneHero: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
    height: 280,
    marginBottom: 6,
  },
  pageOneHeroLeft: {
    width: '46%',
    flexDirection: 'column',
    gap: 6,
  },
  pageOneHeroRight: {
    width: '52%',
    flexDirection: 'column',
    backgroundColor: Theme.BG_SECTION,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  pageOneIdentity: {
    flexDirection: 'column',
    gap: 5,
    marginBottom: 6,
  },
  pageOneSnapshot: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
    marginBottom: 6,
  },
  pageOneSnapshotStats: {
    width: 100,
    flexDirection: 'column',
    gap: 5,
  },
  pageOneSnapshotEvidence: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: Theme.BG_SECTION,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  pageOneEvidence: {
    flexDirection: 'column',
    backgroundColor: Theme.BG_SECTION,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  // Kept for ProfileHeroSection / older callers
  pageOneColumns: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  pageOneLeft: {
    width: '48%',
    flexDirection: 'column',
    gap: 6,
  },
  pageOneLeftFull: {
    width: '100%',
    flexDirection: 'column',
    gap: 6,
  },
  pageOneRight: {
    width: '50%',
    flexDirection: 'column',
    backgroundColor: Theme.BG_SECTION,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    borderRadius: 6,
    padding: 8,
  },
  highlightStrip: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 0,
  },
  highlightStripVertical: {
    flexDirection: 'column',
    gap: 4,
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 0,
  },
  highlightCard: {
    flex: 1,
    backgroundColor: Theme.BG_SECTION,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    borderRadius: 5,
    paddingVertical: 6,
    paddingHorizontal: 7,
  },
  highlightCardVertical: {
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  detailLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: Theme.SECONDARY_GRAY,
    width: 78,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  detailValue: { fontSize: 10.5, color: Theme.PRIMARY_BLUE, fontWeight: 'bold', flex: 1 },
  detailValueMuted: { color: Theme.SECONDARY_GRAY, fontWeight: 'normal' },
  // Banner-scoped badges sized to match the enlarged detail rows (page-2 tables keep the compact base).
  detailBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  detailBadgeText: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.3, textTransform: 'uppercase' },
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
    fontSize: 7.5,
    color: Theme.PRIMARY_BLUE,
    lineHeight: 1.4,
    marginTop: 2,
  },
  reviewSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    marginBottom: 6,
  },
  reviewSectionFull: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    marginBottom: 6,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 4,
  },
  reviewSectionLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: Theme.PRIMARY_BLUE,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  reviewSubLabel: {
    fontSize: 7,
    fontWeight: '900',
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.55,
    marginBottom: 2,
    marginTop: 5,
  },
  reviewBody: {
    fontSize: 8.5,
    color: Theme.PRIMARY_BLUE,
    lineHeight: 1.38,
  },
  // Case summary is the headline read of the dossier — deliberately large.
  reviewSubLabelLead: {
    fontSize: 9,
    fontWeight: '900',
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 3,
    marginTop: 6,
  },
  reviewBodyLead: {
    fontSize: 13.5,
    color: Theme.PRIMARY_BLUE,
    lineHeight: 1.3,
  },
  reviewBodySoft: {
    fontSize: 8.5,
    color: Theme.SECONDARY_GRAY,
    lineHeight: 1.4,
  },
  reasoningLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    color: Theme.PRIMARY_BLUE,
  },
  reasoningSection: { marginBottom: 2 },
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
    fontSize: 7,
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
    fontSize: 7,
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
    marginBottom: 3,
  },
  legalCardShellLast: { marginBottom: 0 },
  legalCardAccent: {
    width: 3,
    backgroundColor: Theme.RISK_HIGH,
  },
  legalCardInner: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 7,
  },
  legalCode: {
    fontSize: 7.5,
    fontWeight: '900',
    color: Theme.RISK_HIGH,
    letterSpacing: 0.12,
    marginBottom: 1,
  },
  legalReason: {
    fontSize: 7.5,
    color: Theme.SECONDARY_GRAY,
    lineHeight: 1.35,
    width: '100%',
  },
  highlightCardAccent: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  highlightLabel: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  highlightLabelCompact: {
    fontSize: 5.5,
    fontWeight: 'bold',
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  highlightValue: {
    fontSize: 13,
    fontWeight: '900',
    color: Theme.PRIMARY_BLUE,
  },
  highlightValueCompact: {
    fontSize: 11,
    fontWeight: '900',
    color: Theme.PRIMARY_BLUE,
  },
  highlightValueDanger: {
    fontSize: 9,
    fontWeight: '900',
    color: Theme.RISK_HIGH,
    textTransform: 'capitalize',
  },
  highlightMeta: {
    fontSize: 6.5,
    color: Theme.SECONDARY_GRAY,
    marginTop: 1,
  },
  highlightMetaCompact: {
    fontSize: 5.5,
    color: Theme.SECONDARY_GRAY,
    marginTop: 0,
  },
  evidenceSection: {
    flexDirection: 'column',
    gap: 4,
    flexGrow: 1,
  },
  evidenceTitle: {
    fontSize: 8,
    fontWeight: '900',
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 1,
  },
  // 2-col inside evidence: creatives | domain (domain gets more height)
  evidenceRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    flexGrow: 1,
  },
  evidenceBlock: {
    width: 108,
    flexDirection: 'column',
    gap: 3,
  },
  evidenceBlockDomain: {
    flex: 1,
    flexDirection: 'column',
    gap: 3,
    alignItems: 'flex-start',
  },
  evidenceBlockDomainSolo: {
    flex: 1,
    flexDirection: 'column',
    gap: 3,
    alignItems: 'flex-start',
  },
  evidenceSubLabel: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  evidenceThumbs: {
    flexDirection: 'column',
    gap: 5,
    alignItems: 'flex-start',
  },
  evidenceThumbFrame: {
    width: 108,
    height: 100,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  evidenceThumb: {
    width: 108,
    height: 100,
    objectFit: 'cover',
  },
  evidenceThumbPlaceholder: {
    width: 108,
    height: 100,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Portrait 9:16 — taller now that domain owns the full evidence column height
  evidenceDomainHero: {
    width: 124,
    height: 220,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    objectFit: 'cover',
    objectPosition: 'top',
    backgroundColor: '#FFFFFF',
  },
  evidenceDomainHeroPlaceholder: {
    width: 124,
    height: 220,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectedSection: {
    paddingTop: 0,
  },
  connectedDivider: {
    marginTop: 0,
    marginBottom: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Theme.BORDER_LIGHT,
  },
  connectedTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: Theme.PRIMARY_BLUE,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
});

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

/** Return a clean absolute http(s) URL, or null if missing/malformed. */
export function normalizeExternalUrl(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** Ads count for a profile group: explicit count, else report total, else raw list length. */
export function resolveProfileAdCount(group) {
  const profile = group?.profile || {};
  const raw =
    profile.ad_count != null
      ? Number(profile.ad_count)
      : group?.totalAdCount != null
        ? Number(group.totalAdCount)
        : (group?.ads || []).length;
  return Number.isFinite(raw) ? raw : null;
}

/** Recommended action / verdict label, matching buildProfileReviewModel's resolution order. */
export function resolveProfileVerdictLabel(profile) {
  const review = profile?.review_details || {};
  return formatVerdictLabel(
    profile?.recommended_action || review.recommended_action || profile?.verdict || review.verdict || null,
  );
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
    { label: 'Ads', value: m.totalAds, color: Theme.PRIMARY_BLUE },
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
    { label: 'Ads', value: m.totalAds, color: Theme.PRIMARY_BLUE },
    { label: 'High Risk Ads', value: m.highAds, color: Theme.RISK_HIGH },
    { label: 'Domains', value: m.totalDomains, color: Theme.PRIMARY_BLUE },
    { label: 'High Risk Domains', value: m.highDomains, color: Theme.RISK_HIGH },
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

export const ProfileBanner = ({ profile, profilePic, group }) => {
  const risk = profileRiskInfo(profile);
  const categories = Array.isArray(profile?.page_categories) ? profile.page_categories : [];
  const biography = profile?.biography || profile?.enrichment?.biography || null;
  const adCount = resolveProfileAdCount(group || { profile });
  const domains = Array.isArray(group?.domains) ? group.domains : [];
  const verdictLabel = resolveProfileVerdictLabel(profile);
  const profileUrl = normalizeExternalUrl(profile?.profile_url);
  // New field: may sit at the top level or inside list/enrichment/review_details depending on ingest.
  const metaAdsLibraryUrl = normalizeExternalUrl(
    profile?.meta_ads_library_url ??
      profile?.list?.meta_ads_library_url ??
      profile?.enrichment?.meta_ads_library_url ??
      profile?.review_details?.meta_ads_library_url,
  );

  return (
    <View style={sharedStyles.profileBanner} wrap={false}>
      <View style={sharedStyles.profileBannerIdentity}>
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
          {(profileUrl || metaAdsLibraryUrl) ? (
            <View style={sharedStyles.profileLinkRow}>
              {profileUrl ? (
                <Link src={profileUrl} style={sharedStyles.profileLink} target="_blank">
                  facebook profile
                </Link>
              ) : null}
              {profileUrl && metaAdsLibraryUrl ? (
                <Text style={sharedStyles.profileLinkSep}>·</Text>
              ) : null}
              {metaAdsLibraryUrl ? (
                <Link src={metaAdsLibraryUrl} style={sharedStyles.profileLink} target="_blank">
                  meta ads profile
                </Link>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
      <View style={sharedStyles.profileBannerDetails}>
        <View style={sharedStyles.detailRow}>
          <Text style={sharedStyles.detailLabel}>Risk</Text>
          <View style={[sharedStyles.detailBadge, { backgroundColor: risk.bg, borderColor: risk.color }]}>
            <Text style={[sharedStyles.detailBadgeText, { color: risk.color }]}>{risk.label}</Text>
          </View>
        </View>
        {categories.length > 0 ? (
          <View style={sharedStyles.detailRow}>
            <Text style={sharedStyles.detailLabel}>Category</Text>
            <Text style={sharedStyles.detailValue}>
              {processText(categories.slice(0, 3).join(', '), 40)}
            </Text>
          </View>
        ) : null}
        <View style={sharedStyles.detailRow}>
          <Text style={sharedStyles.detailLabel}>Status</Text>
          <Text style={sharedStyles.detailValue}>{processText(profile?.client_status || 'open', 28)}</Text>
        </View>
        <View style={sharedStyles.detailRow}>
          <Text style={sharedStyles.detailLabel}>Reviewed</Text>
          <Text style={sharedStyles.detailValue}>{formatCompleteDate(profile?.reviewed_at)}</Text>
        </View>
        {adCount != null ? (
          <View style={sharedStyles.detailRow}>
            <Text style={sharedStyles.detailLabel}>Ads</Text>
            <Text style={sharedStyles.detailValue}>{adCount.toLocaleString()}</Text>
          </View>
        ) : null}
        {domains.length > 0 ? (
          <View style={sharedStyles.detailRow}>
            <Text style={sharedStyles.detailLabel}>Domains</Text>
            <Text style={sharedStyles.detailValue}>{domains.length.toLocaleString()}</Text>
          </View>
        ) : null}
        {verdictLabel ? (
          <View style={sharedStyles.detailRow}>
            <Text style={sharedStyles.detailLabel}>Recommended action</Text>
            <View style={sharedStyles.detailBadge}>
              <Text style={sharedStyles.detailBadgeText}>{processText(verdictLabel, 28)}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
};

/** POI signal card. Ads/Domains counts now live as key-value rows in ProfileBanner. */
export const ProfileHighlightStrip = ({ group, vertical = false }) => {
  const pois = collectProfilePois(group?.ads || group?.displayAds || []);
  const cardStyle = vertical ? sharedStyles.highlightCardVertical : sharedStyles.highlightCard;
  const labelStyle = vertical ? sharedStyles.highlightLabelCompact : sharedStyles.highlightLabel;
  const valueStyle = vertical ? sharedStyles.highlightValueCompact : sharedStyles.highlightValue;
  const metaStyle = vertical ? sharedStyles.highlightMetaCompact : sharedStyles.highlightMeta;

  if (!pois.hasSignal) return null;

  return (
    <View style={vertical ? sharedStyles.highlightStripVertical : sharedStyles.highlightStrip} wrap={false}>
      <View style={cardStyle}>
        <Text style={labelStyle}>POIs</Text>
        <Text style={valueStyle}>
          {pois.names.length > 0 ? processText(pois.names[0], 18) : `${pois.detectedCount} detected`}
        </Text>
        {pois.names.length > 1 ? (
          <Text style={metaStyle}>
            {processText(pois.names.slice(1, 3).join(' · '), 32)}
          </Text>
        ) : pois.names.length === 1 && pois.detectedCount > 1 ? (
          <Text style={metaStyle}>{pois.detectedCount} ads flagged</Text>
        ) : null}
      </View>
    </View>
  );
};

export const EvidencePreview = ({ group }) => {
  const adImages = (group?.compressedAdImages || []).filter(Boolean).slice(0, 2);
  // Prefer the dedicated portrait evidence hero; fall back to first gallery slice.
  const domainHero =
    (group?.compressedDomainImages || []).find(Boolean) ||
    (group?.domainScreenshotSlices || [])
      .map((slices) => (Array.isArray(slices) ? slices.find(Boolean) : null))
      .find(Boolean) ||
    null;

  if (adImages.length === 0 && !domainHero) return null;

  const hasAds = adImages.length > 0;
  const hasDomain = Boolean(domainHero);

  return (
    <View style={sharedStyles.evidenceSection}>
      <Text style={sharedStyles.evidenceTitle}>Sample Evidence</Text>
      <View style={sharedStyles.evidenceRow}>
        {hasAds ? (
          <View style={sharedStyles.evidenceBlock}>
            <Text style={sharedStyles.evidenceSubLabel}>Ad Creatives</Text>
            <View style={sharedStyles.evidenceThumbs}>
              {adImages.map((src, idx) => (
                <View key={idx} style={sharedStyles.evidenceThumbFrame}>
                  <Image style={sharedStyles.evidenceThumb} src={src} />
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {hasDomain ? (
          <View style={hasAds ? sharedStyles.evidenceBlockDomain : sharedStyles.evidenceBlockDomainSolo}>
            <Text style={sharedStyles.evidenceSubLabel}>Domain Screenshot</Text>
            <Image style={sharedStyles.evidenceDomainHero} src={domainHero} />
          </View>
        ) : null}
      </View>
    </View>
  );
};

function buildProfileReviewModel(profile, project) {
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

  return {
    risk,
    caseSummary,
    reasoning,
    reviewerComments,
    violations,
    verdictLabel,
    legalCodes,
    hasContent,
    reasoningSections: parseReasoning(reasoning),
  };
}

/** Compact review block for the left column (no reasoning — that is full-width below). */
export const ProfileReviewMain = ({ profile, project }) => {
  const {
    caseSummary,
    reviewerComments,
    violations,
    verdictLabel,
    legalCodes,
    hasContent,
  } = buildProfileReviewModel(profile, project);

  const showMain = Boolean(
    caseSummary || violations.length || legalCodes.length || verdictLabel || reviewerComments,
  );
  if (!hasContent || !showMain) return null;

  return (
    <View style={sharedStyles.reviewSection} wrap={false}>
      <Text style={sharedStyles.reviewSectionLabel}>Review Details</Text>

      {caseSummary ? (
        <>
          <Text style={[sharedStyles.reviewSubLabelLead, { marginTop: 0 }]}>Case Summary</Text>
          <Text style={sharedStyles.reviewBodyLead}>{processText(caseSummary, 700, 4)}</Text>
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
                <Text style={sharedStyles.legalCode}>{processText(item.code, 80)}</Text>
                {item.reasoning ? (
                  <Text style={sharedStyles.legalReason}>{processText(item.reasoning, 400, 3)}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </>
      ) : null}

      {reviewerComments ? (
        <>
          <Text style={sharedStyles.reviewSubLabel}>Reviewer Comments</Text>
          <Text style={sharedStyles.reviewBody}>{processText(reviewerComments, 260, 3)}</Text>
        </>
      ) : null}
    </View>
  );
};

/** Full-width reasoning band under the page-1 columns. */
export const ProfileReviewReasoning = ({ profile, project }) => {
  const { reasoning, reasoningSections, caseSummary, legalCodes } = buildProfileReviewModel(profile, project);
  if (!reasoning) {
    if (!caseSummary && legalCodes.length === 0) {
      return (
        <View style={sharedStyles.reviewSectionFull}>
          <Text style={sharedStyles.reviewSubLabel}>Detailed Reasoning</Text>
          <Text style={sharedStyles.reviewBodySoft}>No reviewer reasoning.</Text>
        </View>
      );
    }
    return null;
  }

  return (
    <View style={sharedStyles.reviewSectionFull} wrap={false}>
      <Text style={[sharedStyles.reviewSubLabel, { marginTop: 0 }]}>Detailed Reasoning</Text>
      {reasoningSections.length === 0 ? (
        <Text style={sharedStyles.reviewBodySoft}>No reviewer reasoning.</Text>
      ) : reasoningSections.length === 1 && !reasoningSections[0].label ? (
        <Text style={sharedStyles.reviewBodySoft}>
          {processText(reasoningSections[0].content, 1400, 10)}
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
              {processText(sec.content, 900, 7)}
            </Text>
          </View>
        ))
      )}
    </View>
  );
};

/** @deprecated Prefer ProfileReviewMain + ProfileReviewReasoning */
export const ProfileReviewSection = ({ profile, project }) => (
  <>
    <ProfileReviewMain profile={profile} project={project} />
    <ProfileReviewReasoning profile={profile} project={project} />
  </>
);

export const ProfilePageOne = ({ group, project }) => {
  const hasEvidence =
    (group?.compressedAdImages || []).some(Boolean) ||
    (group?.compressedDomainImages || []).some(Boolean) ||
    (group?.domainScreenshotSlices || []).some((slices) => Array.isArray(slices) && slices.some(Boolean));

  return (
    <View>
      {/* Hero: left = profile → meta → ads/domains; right = vertical evidence.
          Fixed height preserves Review Details start position. */}
      <View style={sharedStyles.pageOneHero} wrap={false}>
        <View style={sharedStyles.pageOneHeroLeft}>
          <ProfileBanner profile={group.profile} profilePic={group.compressedProfilePic} group={group} />
          <ProfileHighlightStrip group={group} vertical />
        </View>
        {hasEvidence ? (
          <View style={sharedStyles.pageOneHeroRight}>
            <EvidencePreview group={group} />
          </View>
        ) : null}
      </View>

      {/* Review + Reasoning — unchanged full-width blocks */}
      <ProfileReviewMain profile={group.profile} project={project} />
      <ProfileReviewReasoning profile={group.profile} project={project} />
    </View>
  );
};

export const ProfileHeroSection = ({ group }) => {
  const hasEvidence =
    (group?.compressedAdImages || []).some(Boolean) ||
    (group?.compressedDomainImages || []).some(Boolean) ||
    (group?.domainScreenshotSlices || []).some((slices) => Array.isArray(slices) && slices.some(Boolean));

  return (
    <View style={sharedStyles.pageOneHero} wrap={false}>
      <View style={sharedStyles.pageOneHeroLeft}>
        <ProfileBanner profile={group.profile} profilePic={group.compressedProfilePic} group={group} />
        <ProfileHighlightStrip group={group} vertical />
      </View>
      {hasEvidence ? (
        <View style={sharedStyles.pageOneHeroRight}>
          <EvidencePreview group={group} />
        </View>
      ) : null}
    </View>
  );
};

export const ProfileReportBlock = ({ group, project, breakBefore = false }) => (
  <View style={sharedStyles.profileBlock} break={breakBefore || undefined} wrap>
    <ProfilePageOne group={group} project={project} />
    <View style={sharedStyles.connectedSection} break>
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
  </View>
);

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

export { processText };
