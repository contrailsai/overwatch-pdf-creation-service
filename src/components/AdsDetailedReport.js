import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Link } from '@react-pdf/renderer';
import { isValid, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { registerFonts } from './utils/FontRegister';

registerFonts();

const Theme = {
  INK: '#0F172A',
  INK_SOFT: '#334155',
  MUTED: '#64748B',
  SUBTLE: '#94A3B8',
  LINE: '#E2E8F0',
  LINE_SOFT: '#F1F5F9',
  SURFACE: '#FFFFFF',
  SURFACE_ALT: '#F8FAFC',
  LINK: '#2563EB',
  RISK_HIGH: '#E11D48',
  RISK_HIGH_BG: '#FFF1F2',
  RISK_HIGH_BORDER: '#FECDD3',
  RISK_MEDIUM: '#EA580C',
  RISK_MEDIUM_BG: '#FFF7ED',
  RISK_MEDIUM_BORDER: '#FED7AA',
  RISK_LOW: '#D97706',
  RISK_LOW_BG: '#FFFBEB',
  RISK_LOW_BORDER: '#FDE68A',
  RISK_SAFE: '#059669',
  RISK_SAFE_BG: '#ECFDF5',
  RISK_SAFE_BORDER: '#A7F3D0',
  WARN: '#C2410C',
  WARN_BG: '#FFF7ED',
  WARN_BORDER: '#FED7AA',
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 12,
    fontFamily: ['Outfit', 'Mukta'],
    backgroundColor: Theme.SURFACE,
    color: Theme.INK,
  },
  brandHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 3 },
  brandTitle: { fontSize: 18, fontWeight: 700, color: Theme.INK, letterSpacing: 0.2 },
  brandSubtitle: {
    fontSize: 8,
    color: Theme.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 9,
    paddingBottom: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: Theme.LINE,
  },
  caseHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  caseTitle: { fontSize: 16, fontWeight: 700, color: Theme.INK },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  infoBanner: {
    backgroundColor: Theme.SURFACE_ALT,
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 },
  infoRowLast: { marginBottom: 0 },
  infoLabel: { fontSize: 7.2, color: Theme.MUTED, width: 70 },
  infoValue: { fontSize: 8, fontWeight: 'bold', color: Theme.INK, flex: 1 },
  infoLink: { fontSize: 8, color: Theme.LINK, textDecoration: 'none', flex: 1, fontWeight: 700 },
  columns: { flexDirection: 'row', gap: 12 },
  leftCol: { width: '54%' },
  rightCol: { width: '46%' },
  leftCard: {
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: Theme.SURFACE,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#0F172A',
    padding: 4,
    gap: 4,
  },
  cardThumbWrap: { width: '32%', },
  cardThumb: { width: '100%', height: 72, objectFit: 'cover' },
  cardThumbPlaceholder: {
    width: '100%',
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  mediaPlaceholderText: { fontSize: 7, color: '#94A3B8' },
  userStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: { fontSize: 10, fontWeight: 'bold', color: '#FFFFFF' },
  userName: { fontSize: 8, fontWeight: 'bold', color: Theme.INK },
  userMeta: { fontSize: 6, color: Theme.MUTED, marginTop: 2 },
  leftSection: { paddingHorizontal: 12, paddingVertical: 8 },
  leftSectionLabel: {
    fontSize: 6,
    color: Theme.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: 'medium',
    marginBottom: 4,
  },
  bodyText: { fontSize: 5.5, lineHeight: 1.55, color: Theme.INK_SOFT },
  bodyTextMuted: { fontSize: 5.5, lineHeight: 1.55, color: Theme.MUTED },
  softDivider: {
    borderTopWidth: 0.5,
    borderTopColor: Theme.LINE_SOFT,
    marginHorizontal: 14,
  },
  statsRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10 },
  statCell: { flex: 1 },
  statLabel: {
    fontSize: 6,
    fontWeight: 400,
    color: Theme.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  statValue: { fontSize: 6, fontWeight: 400, color: Theme.INK },
  platformRow: { paddingHorizontal: 14, paddingVertical: 10 },
  platformPills: { flexDirection: 'row', flexWrap: 'wrap' },
  platformPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    backgroundColor: Theme.SURFACE_ALT,
    marginRight: 4,
    marginBottom: 4,
  },
  platformPillText: { fontSize: 6, fontWeight: 600, color: Theme.INK },
  rightCard: {
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: Theme.SURFACE,
  },
  rightSection: { paddingHorizontal: 12, paddingVertical: 8 },
  rightSectionLabel: {
    fontSize: 5,
    color: Theme.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: 500,
    marginBottom: 6,
  },
  rightDivider: {
    borderTopWidth: 0.5,
    borderTopColor: Theme.LINE_SOFT,
    marginHorizontal: 14,
  },
  warningBanner: {
    backgroundColor: Theme.WARN_BG,
    borderWidth: 0.5,
    borderColor: Theme.WARN_BORDER,
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 7,
    fontWeight: 700,
    color: Theme.WARN,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  warningBody: { fontSize: 6, color: Theme.INK_SOFT, lineHeight: 1.45 },
  destRow: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'flex-start',
  },
  destIndex: {
    fontSize: 6,
    color: Theme.SUBTLE,
    width: 32,
    marginRight: 6,
    paddingTop: 1,
  },
  destBody: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'column',
  },
  destLink: { fontSize: 6.5, color: Theme.LINK, textDecoration: 'none', marginTop: 2 },
  destHost: { fontSize: 7, color: Theme.INK, fontWeight: 700, marginBottom: 2 },
  destCardLinkText: { fontSize: 6.5, color: Theme.LINK, textDecoration: 'none' },
  shownBox: {
    backgroundColor: Theme.SURFACE_ALT,
    borderRadius: 3,
    padding: 6,
    marginBottom: 8,
  },
  shownLabel: {
    fontSize: 5.5,
    color: Theme.MUTED,
    textTransform: 'uppercase',
    fontWeight: 700,
    marginBottom: 2,
  },
  shownValue: { fontSize: 7, color: Theme.INK, fontWeight: 700 },
  reasoningLabel: { fontSize: 5.5, fontWeight: 500, color: Theme.INK },
  reasoningContent: { fontSize: 5.5, lineHeight: 1.5, color: Theme.INK_SOFT },
  reasoningSection: { marginBottom: 4 },
  reasoningSectionLast: { marginBottom: 0 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  aiLabelBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 3, borderWidth: 0.5 },
  aiLabelBadgeText: { fontSize: 4.5, fontWeight: 600 },
  riskBadgeSmall: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  riskBadgeSmallText: { fontSize: 4.5, fontWeight: 600 },
  legalCardShell: {
    flexDirection: 'row',
    borderWidth: 0.5,
    borderColor: Theme.LINK,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    backgroundColor: Theme.SURFACE,
    overflow: 'hidden',
  },
  legalCardAccent: { width: 3, backgroundColor: Theme.LINK },
  legalCardInner: { flex: 1, paddingVertical: 4, paddingHorizontal: 4 },
  legalCode: { fontSize: 6.5, fontWeight: 700, color: Theme.INK, letterSpacing: 0.15 },
  legalReason: { fontSize: 5.5, lineHeight: 1.52, color: Theme.INK_SOFT },
  legalSectionLabel: {
    fontSize: 5,
    color: Theme.INK,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: 700,
    marginBottom: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 28,
    right: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 6.5,
    color: Theme.MUTED,
    borderTopWidth: 0.5,
    borderTopColor: Theme.LINE,
    paddingTop: 8,
  },
  footerText: { textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 'bold' },
});

const sanitize = (text) => {
  if (!text) return '';
  return Array.from(String(text)).filter((char) => {
    const cp = char.codePointAt(0);
    return (cp >= 32 && cp <= 126) || cp === 10 || cp === 13 || cp === 9 ||
      /[\u{0900}-\u{097F}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}]/u.test(char);
  }).join('');
};

const truncate = (text, max = 600) => {
  const s = sanitize(text);
  if (s.length <= max) return s;
  return s.slice(0, max).trim() + '...';
};

const formatDateTime = (dateInput) => {
  if (!dateInput) return 'N/A';
  try {
    const d = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
    if (isValid(d)) return formatInTimeZone(d, 'Asia/Kolkata', 'dd MMM yyyy, hh:mm a');
  } catch (e) { /* ignore */ }
  return 'N/A';
};

const formatShortDateTime = (dateInput) => {
  if (!dateInput) return 'N/A';
  try {
    const d = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
    if (isValid(d)) return formatInTimeZone(d, 'Asia/Kolkata', 'dd/MM/yyyy hh:mm a');
  } catch (e) { /* ignore */ }
  return 'N/A';
};

const getRiskInfo = (score, hasReview) => {
  if (!hasReview && (score == null || score === 0)) {
    return { label: 'Unreviewed', color: Theme.MUTED, bg: Theme.SURFACE_ALT, border: Theme.LINE };
  }
  if (score >= 96) return { label: 'High Risk', color: Theme.RISK_HIGH, bg: Theme.RISK_HIGH_BG, border: Theme.RISK_HIGH_BORDER };
  if (score >= 76) return { label: 'Medium Risk', color: Theme.RISK_MEDIUM, bg: Theme.RISK_MEDIUM_BG, border: Theme.RISK_MEDIUM_BORDER };
  if (score >= 41) return { label: 'Low Risk', color: Theme.RISK_LOW, bg: Theme.RISK_LOW_BG, border: Theme.RISK_LOW_BORDER };
  return { label: 'Safe', color: Theme.RISK_SAFE, bg: Theme.RISK_SAFE_BG, border: Theme.RISK_SAFE_BORDER };
};

const profilePicPalette = [
  '#FCA5A5', '#FDBA74', '#FCD34D', '#86EFAC', '#6EE7B7', '#5EEAD4',
  '#67E8F9', '#93C5FD', '#A5B4FC', '#C4B5FD', '#D8B4FE', '#F0ABFC',
  '#F9A8D4', '#FDA4AF',
];

const profilePicInitials = (name) => {
  if (!name) return '?';
  return String(name)
    .split(/[\s._]+/)
    .map((n) => n && n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
};

const profilePicColor = (name) => {
  if (!name) return '#9CA3AF';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return profilePicPalette[Math.abs(hash) % profilePicPalette.length];
};

const parseReasoning = (text) => {
  if (!text) return [];
  const cleaned = sanitize(String(text));
  const lines = cleaned.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  return lines.map((line) => {
    const match = line.match(/^([A-Z][A-Za-z0-9 &/()\-]{2,40}?):\s*(.+)$/);
    if (match) return { label: match[1].trim(), content: match[2].trim() };
    return { label: '', content: line };
  });
};

const labelColorMap = {
  purple: { color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  rose: { color: '#E11D48', bg: '#FFF1F2', border: '#FECDD3' },
  orange: { color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
  yellow: { color: '#CA8A04', bg: '#FEFCE8', border: '#FEF08A' },
  blue: { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  emerald: { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  slate: { color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' },
};
const getLabelColor = (key) => labelColorMap[key] || labelColorMap.slate;

const formatPlatformName = (name) => {
  if (!name) return '';
  const s = String(name).trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

const hostnameOf = (url) => {
  if (!url) return '';
  try {
    const withProto = /^https?:\/\//i.test(url) ? url : `http://${url}`;
    return new URL(withProto).hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
};

const BrandHeader = () => (
  <View>
    <View style={styles.brandHeader}>
      <Text style={styles.brandTitle}>Overwatch</Text>
    </View>
    <Text style={styles.brandSubtitle}>Meta Ads Integrity</Text>
  </View>
);

const PageFooter = () => (
  <View style={styles.footer}>
    <Text style={styles.footerText}>Confidential Document</Text>
    <Text style={styles.footerText}>Powered by Contrails AI</Text>
    <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
  </View>
);

export const AdsDetailedCasePage = ({ ad, project, compressedImage, compressedCardImages, caseNumber }) => {
  const review = ad.review_details || {};
  const analysis = ad.analysis_results || {};
  const hasReview = review.threat_score != null ||
    (Array.isArray(review.threat_types) && review.threat_types.length > 0) ||
    Boolean(review.reasoning);
  const riskScore = review.threat_score ?? analysis.risk_score ?? 0;
  const riskInfo = getRiskInfo(riskScore, hasReview);

  let projectDetails = project?.project_details;
  if (typeof projectDetails === 'string') {
    try { projectDetails = JSON.parse(projectDetails); } catch (e) { projectDetails = {}; }
  }

  let reasoningRaw = review.reasoning || analysis.categorization_reason || '';
  const reasoning = typeof reasoningRaw === 'object' && reasoningRaw !== null
    ? (reasoningRaw.reasoning || reasoningRaw.text || JSON.stringify(reasoningRaw))
    : reasoningRaw;

  const legalCodesRaw = Array.isArray(review.legal_codes) ? review.legal_codes : [];
  const legalCodes = legalCodesRaw.map((item) => {
    if (typeof item === 'string') return { code: item, reasoning: '' };
    return { code: item.code || item.name || '', reasoning: item.reasoning || '' };
  }).filter((e) => e.code);

  const isPoiPresent = review.face_present ?? review.flags?.poi_confirmed ?? ad.poi_detected ?? false;
  const isAigc = review.is_aigc ?? review.flags?.is_aigc ?? analysis.aigc_check?.is_aigc ?? ad.contains_digital_created_media ?? false;

  const projectLabels = projectDetails?.labels || [];
  const aiLabels = [];
  projectLabels.forEach((label) => {
    if (review.flags?.[label.name] === true || (review.threat_types || []).includes(label.name)) {
      const title = String(label.name).replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const colorKey = label.severity === 'high' ? 'rose' : label.severity === 'medium' ? 'orange' : label.severity === 'low' ? 'yellow' : 'purple';
      aiLabels.push({ title, color: colorKey });
    }
  });
  (review.threat_types || []).forEach((type) => {
    if (!type || type === 'safe') return;
    const title = String(type).replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    if (!aiLabels.some((l) => l.title.toLowerCase() === title.toLowerCase())) {
      aiLabels.push({ title, color: 'orange' });
    }
  });

  const cards = Array.isArray(ad.cards) ? ad.cards : [];
  const cardImages = Array.isArray(compressedCardImages) && compressedCardImages.length > 0
    ? compressedCardImages
    : [compressedImage].filter(Boolean);
  const displayImages = cardImages.length > 0 ? cardImages.slice(0, 6) : [null];

  const platformLabel = ad.platform ? ad.platform.charAt(0).toUpperCase() + ad.platform.slice(1) : 'Meta';
  const sourceUrl = ad.original_url || '';
  const publishedAt = formatDateTime(ad.posted_date || ad.start_date || ad.sourcing_date);
  const sourcedAt = formatDateTime(ad.created_at || ad.sourcing_date);
  const startedShort = formatShortDateTime(ad.start_date || ad.posted_date);
  const processedShort = formatShortDateTime(ad.created_at);
  const advertiserName = ad.advertiser?.page_name || 'Unknown advertiser';
  const platformList = (ad.publisher_platforms || []).filter(Boolean);
  const creativeBody = ad.title || ad.body || ad.caption || '';

  const rightSections = [];
  rightSections.push('destinations');
  if (legalCodes.length > 0) rightSections.push('legal');
  if (reasoning) rightSections.push('reasoning');
  if (isPoiPresent || isAigc || aiLabels.length > 0) rightSections.push('labels');
  rightSections.push('risk');

  return (
    <Page size="A4" style={styles.page}>
      <BrandHeader />

      <View style={styles.caseHeadingRow}>
        <Text style={styles.caseTitle}>{caseNumber != null ? `Ad #${caseNumber}` : 'Ad Detail'}</Text>
        <View style={[styles.statusBadge, {
          backgroundColor: ad.is_active ? Theme.RISK_SAFE_BG : Theme.SURFACE_ALT,
          borderColor: ad.is_active ? Theme.RISK_SAFE_BORDER : Theme.LINE,
        }]}>
          <Text style={[styles.statusBadgeText, { color: ad.is_active ? Theme.RISK_SAFE : Theme.MUTED }]}>
            {ad.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      <View style={styles.infoBanner}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Advertiser</Text>
          <Text style={styles.infoValue}>{advertiserName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Platform</Text>
          <Text style={styles.infoValue}>{platformLabel} · {ad.display_format || 'Ad'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Ad Library</Text>
          {sourceUrl ? (
            <Link src={sourceUrl} style={styles.infoLink}>{truncate(sourceUrl, 80)}</Link>
          ) : (
            <Text style={styles.infoValue}>N/A</Text>
          )}
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Started</Text>
          <Text style={styles.infoValue}>{publishedAt}</Text>
        </View>
        <View style={[styles.infoRow, styles.infoRowLast]}>
          <Text style={styles.infoLabel}>Sourced</Text>
          <Text style={styles.infoValue}>{sourcedAt}</Text>
        </View>
      </View>

      <View style={styles.columns}>
        <View style={styles.leftCol}>
          <View style={styles.leftCard}>
            <View style={styles.cardGrid}>
              {displayImages.map((src, i) => (
                <View key={i} style={styles.cardThumbWrap}>
                  {src ? (
                    <Image src={src} style={styles.cardThumb} />
                  ) : (
                    <View style={styles.cardThumbPlaceholder}>
                      <Text style={styles.mediaPlaceholderText}>Card {i + 1}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>

            <View style={styles.userStrip}>
              <View style={[styles.userAvatar, { backgroundColor: profilePicColor(advertiserName) }]}>
                <Text style={styles.userAvatarText}>{profilePicInitials(advertiserName)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{advertiserName}</Text>
                <Text style={styles.userMeta}>
                  {ad.ad_id ? `Ad ID ${ad.ad_id}` : ''}
                  {ad.ad_id && platformLabel ? ' · ' : ''}
                  {platformLabel}
                </Text>
              </View>
            </View>

            <View style={styles.leftSection}>
              <Text style={styles.leftSectionLabel}>Creative Copy</Text>
              {creativeBody ? (
                <Text style={styles.bodyText}>{truncate(creativeBody, 500)}</Text>
              ) : (
                <Text style={styles.bodyTextMuted}>No creative copy available.</Text>
              )}
              {ad.cta_text ? (
                <Text style={[styles.bodyText, { marginTop: 6, fontWeight: 700 }]}>CTA: {ad.cta_text}</Text>
              ) : null}
              {ad.caption ? (
                <Text style={[styles.bodyTextMuted, { marginTop: 4 }]}>Displayed as {ad.caption}</Text>
              ) : null}
            </View>

            <View style={styles.softDivider} />
            <View style={styles.statsRow}>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>Format</Text>
                <Text style={styles.statValue}>{ad.display_format || '—'}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>Cards</Text>
                <Text style={styles.statValue}>{ad.card_count || cards.length || 0}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>Impressions</Text>
                <Text style={styles.statValue}>{ad.impressions_text || '—'}</Text>
              </View>
            </View>

            <View style={styles.softDivider} />
            <View style={styles.platformRow}>
              <Text style={styles.statLabel}>Platforms</Text>
              <View style={styles.platformPills}>
                {platformList.length > 0 ? platformList.map((name, i) => (
                  <View key={`${name}-${i}`} style={styles.platformPill}>
                    <Text style={styles.platformPillText}>{formatPlatformName(name)}</Text>
                  </View>
                )) : (
                  <Text style={styles.statValue}>—</Text>
                )}
              </View>
            </View>

            <View style={styles.softDivider} />
            <View style={styles.statsRow}>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>Started</Text>
                <Text style={styles.statValue}>{startedShort}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>Processed</Text>
                <Text style={styles.statValue}>{processedShort}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.rightCol}>
          <View style={styles.rightCard}>
            <View style={styles.rightSection}>
              <Text style={styles.rightSectionLabel}>Destination Analysis</Text>
              {ad.destination_mismatch ? (
                <View style={styles.warningBanner}>
                  <Text style={styles.warningTitle}>Destination mismatch</Text>
                  <Text style={styles.warningBody}>
                    The ad presents {ad.shown_hostname || 'a trusted brand'} while carousel cards resolve to {(ad.card_hostnames || []).join(', ') || 'unrelated domains'}.
                  </Text>
                </View>
              ) : null}
              <View style={styles.shownBox}>
                <Text style={styles.shownLabel}>Shown destination</Text>
                <Text style={styles.shownValue}>{ad.shown_hostname || hostnameOf(ad.link_url) || ad.caption || '—'}</Text>
                {ad.link_url ? (
                  <Text style={styles.destCardLinkText}>
                    <Link src={ad.link_url}>{truncate(ad.link_url, 70)}</Link>
                  </Text>
                ) : null}
              </View>
              {cards.length > 0 ? cards.map((card, i) => (
                <View key={i} style={styles.destRow} wrap={false}>
                  <Text style={styles.destIndex}>Card {i + 1}</Text>
                  <View style={styles.destBody}>
                    <Text style={styles.destHost}>{hostnameOf(card.link_url) || '—'}</Text>
                    {card.link_url ? (
                      <Text style={styles.destCardLinkText}>
                        <Link src={card.link_url}>{truncate(card.link_url, 70)}</Link>
                      </Text>
                    ) : (
                      <Text style={styles.reasoningContent}>No landing URL</Text>
                    )}
                  </View>
                </View>
              )) : (
                <Text style={styles.reasoningContent}>No card destinations recorded.</Text>
              )}
            </View>
            {rightSections.indexOf('destinations') < rightSections.length - 1 && <View style={styles.rightDivider} />}

            {legalCodes.length > 0 && (
              <>
                <View style={styles.rightSection}>
                  <Text style={styles.legalSectionLabel}>Legal Violations</Text>
                  {legalCodes.map((lc, i) => {
                    const projCode = projectDetails?.legal_codes?.find((pc) => pc.name === lc.code);
                    const description = lc.reasoning || projCode?.description || '';
                    return (
                      <View key={i} style={styles.legalCardShell}>
                        <View style={styles.legalCardAccent} />
                        <View style={styles.legalCardInner}>
                          <Text style={styles.legalCode}>{lc.code}</Text>
                          {description ? <Text style={styles.legalReason}>{truncate(description, 220)}</Text> : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
                {rightSections.indexOf('legal') < rightSections.length - 1 && <View style={styles.rightDivider} />}
              </>
            )}

            {reasoning ? (
              <>
                <View style={styles.rightSection}>
                  <Text style={styles.rightSectionLabel}>Content Reasoning</Text>
                  {(() => {
                    const sections = parseReasoning(reasoning);
                    if (sections.length === 0) {
                      return <Text style={styles.reasoningContent}>No detailed reasoning provided.</Text>;
                    }
                    return sections.map((sec, i) => (
                      <View key={i} style={[styles.reasoningSection, i === sections.length - 1 && styles.reasoningSectionLast]}>
                        <Text style={styles.reasoningContent}>
                          {sec.label ? <Text style={styles.reasoningLabel}>{sec.label}: </Text> : null}
                          {sec.content}
                        </Text>
                      </View>
                    ));
                  })()}
                </View>
                {rightSections.indexOf('reasoning') < rightSections.length - 1 && <View style={styles.rightDivider} />}
              </>
            ) : null}

            {(isPoiPresent || isAigc || aiLabels.length > 0) && (
              <>
                <View style={styles.rightSection}>
                  <Text style={styles.rightSectionLabel}>AI Labels Detected</Text>
                  <View style={styles.badgeRow}>
                    {aiLabels.map((l, i) => {
                      const c = getLabelColor(l.color);
                      return (
                        <View key={`l-${i}`} style={[styles.aiLabelBadge, { backgroundColor: c.bg, borderColor: c.border }]}>
                          <Text style={[styles.aiLabelBadgeText, { color: c.color }]}>{l.title}</Text>
                        </View>
                      );
                    })}
                    {isAigc && (
                      <View style={[styles.aiLabelBadge, { backgroundColor: labelColorMap.blue.bg, borderColor: labelColorMap.blue.border }]}>
                        <Text style={[styles.aiLabelBadgeText, { color: labelColorMap.blue.color }]}>AI Generated</Text>
                      </View>
                    )}
                    {isPoiPresent && (
                      <View style={[styles.aiLabelBadge, { backgroundColor: labelColorMap.emerald.bg, borderColor: labelColorMap.emerald.border }]}>
                        <Text style={[styles.aiLabelBadgeText, { color: labelColorMap.emerald.color }]}>POI Detected</Text>
                      </View>
                    )}
                  </View>
                </View>
                {rightSections.indexOf('labels') < rightSections.length - 1 && <View style={styles.rightDivider} />}
              </>
            )}

            <View style={styles.rightSection}>
              <Text style={styles.rightSectionLabel}>Current AI Generated Risk</Text>
              <View style={[styles.riskBadgeSmall, { backgroundColor: riskInfo.bg, borderColor: riskInfo.border }]}>
                <Text style={[styles.riskBadgeSmallText, { color: riskInfo.color }]}>{riskInfo.label}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <PageFooter />
    </Page>
  );
};

export const AdsDetailedReportDocument = ({ ads, project, compressedImages, compressedCardImages }) => (
  <Document title="Ads_Detailed_Report">
    {ads.map((ad, index) => (
      <AdsDetailedCasePage
        key={ad._id || index}
        ad={ad}
        project={project}
        compressedImage={compressedImages?.[index]}
        compressedCardImages={compressedCardImages?.[index] || []}
        caseNumber={index + 1}
      />
    ))}
  </Document>
);

export default AdsDetailedReportDocument;
