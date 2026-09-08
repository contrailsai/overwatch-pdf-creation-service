import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Link } from '@react-pdf/renderer';
import { isValid, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { registerFonts } from './utils/FontRegister';

registerFonts();

const Theme = {
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
};

const styles = StyleSheet.create({
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
    marginBottom: 16,
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
  headerRight: {
    alignItems: 'flex-end',
  },
  headerDate: {
    fontSize: 8,
    fontWeight: 'bold',
    color: Theme.PRIMARY_BLUE,
  },
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
    paddingTop: 10,
  },
  footerLeft: { textTransform: 'uppercase', fontWeight: 'bold' },
  footerCenter: { textTransform: 'uppercase' },
  footerRight: { textTransform: 'uppercase', fontWeight: 'bold' },
  metricsSection: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Theme.BG_SECTION,
    padding: 12,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 6.5,
    color: Theme.SECONDARY_GRAY,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '900',
    color: Theme.PRIMARY_BLUE,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: Theme.BG_SECTION,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    borderRadius: 4,
    marginBottom: 6,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontWeight: '900',
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: Theme.BORDER_LIGHT,
    alignItems: 'flex-start',
  },
  colIndex: { width: '4%', paddingRight: 4, alignItems: 'center' },
  colContent: { width: '26%', paddingRight: 8 },
  colAdvertiser: { width: '16%', paddingRight: 4 },
  colDest: { width: '22%', paddingRight: 8 },
  colThreat: { width: '12%', paddingRight: 4 },
  colRisk: { width: '12%', paddingRight: 4 },
  colStatus: { width: '8%', alignItems: 'flex-start' },
  indexText: { fontSize: 8, fontWeight: '700', color: Theme.PRIMARY_BLUE },
  contentContainer: { flexDirection: 'row' },
  contentInfo: { flex: 1, flexDirection: 'column' },
  adImage: {
    width: 45,
    height: 45,
    borderRadius: 4,
    marginRight: 8,
    objectFit: 'cover',
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
  },
  captionText: {
    fontSize: 7.5,
    color: Theme.PRIMARY_BLUE,
    lineHeight: 1.4,
    marginBottom: 2,
  },
  formatText: {
    fontSize: 6,
    color: Theme.SECONDARY_GRAY,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  linkText: { fontSize: 7, color: Theme.LINK, textDecoration: 'none' },
  advertiserName: {
    fontSize: 8,
    fontWeight: '900',
    color: Theme.PRIMARY_BLUE,
    marginBottom: 2,
  },
  platformText: {
    fontSize: 7,
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metaText: { fontSize: 6.5, color: Theme.SECONDARY_GRAY, marginBottom: 2 },
  destLabel: {
    fontSize: 5.5,
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 1,
  },
  destValue: { fontSize: 7, color: Theme.PRIMARY_BLUE, marginBottom: 3 },
  mismatchBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Theme.WARN_BG,
    borderWidth: 0.5,
    borderColor: Theme.WARN,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginTop: 2,
  },
  mismatchText: {
    fontSize: 6,
    fontWeight: 'bold',
    color: Theme.WARN,
    textTransform: 'uppercase',
  },
  threatContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  threatBadge: {
    backgroundColor: Theme.BG_SECTION,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.3,
    borderColor: Theme.BORDER_LIGHT,
  },
  threatText: { fontSize: 7, color: Theme.PRIMARY_BLUE, textTransform: 'capitalize' },
  riskBadgeTable: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  riskBadgeTextTable: { fontSize: 6.5, fontWeight: '900', textTransform: 'uppercase' },
  dateItem: { flexDirection: 'column', alignItems: 'flex-start', gap: 1, marginBottom: 6 },
  dateLabel: {
    fontSize: 5.5,
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  dateValue: { fontSize: 6 },
});

const processText = (text, maxLength = 500, maxLines = null) => {
  if (!text) return '';
  let sanitized = Array.from(String(text)).filter((char) => {
    const cp = char.codePointAt(0);
    return (cp >= 32 && cp <= 126) || cp === 10 || cp === 13 || cp === 9 ||
      /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}]/u.test(char);
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

  return truncated ? result.trim() + '...' : result;
};

const formatCompleteDate = (dateInput) => {
  if (!dateInput) return 'N/A';
  try {
    const dateObj = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
    if (isValid(dateObj)) {
      return formatInTimeZone(dateObj, 'Asia/Kolkata', "dd MMM yyyy, hh:mm a 'IST'");
    }
  } catch (error) {
    return 'N/A';
  }
  return 'N/A';
};

const getRiskLabel = (score, hasReview) => {
  if (!hasReview && (score == null || score === 0)) {
    return { label: 'Unreviewed', color: Theme.SECONDARY_GRAY, bg: Theme.BG_SECTION };
  }
  if (score > 95) return { label: 'High Risk', color: Theme.RISK_HIGH, bg: '#FFF1F2' };
  if (score > 75) return { label: 'Medium Risk', color: Theme.RISK_MEDIUM, bg: '#FFF7ED' };
  if (score > 40) return { label: 'Low Risk', color: Theme.RISK_LOW, bg: '#FFFBEB' };
  return { label: 'Safe Content', color: Theme.SAFE, bg: '#ECFDF5' };
};

const hasReviewSignal = (ad) => {
  const review = ad.review_details || {};
  const types = Array.isArray(review.threat_types) ? review.threat_types : [];
  return review.threat_score != null || types.length > 0 || Boolean(review.reasoning);
};

const PageHeader = () => (
  <View style={styles.header} fixed>
    <View>
      <Text style={styles.title}>OVERWATCH</Text>
      <Text style={styles.subtitle}>Meta Ads Integrity Report</Text>
    </View>
    <View style={styles.headerRight}>
      <Text style={styles.headerDate}>{formatCompleteDate(new Date())}</Text>
    </View>
  </View>
);

const PageFooter = () => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerLeft}>CONFIDENTIAL DOCUMENT</Text>
    <Text style={styles.footerCenter}>POWERED BY CONTRAILS AI</Text>
    <Text
      style={styles.footerRight}
      render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} OF ${totalPages}`}
    />
  </View>
);

const MetricsSection = ({ ads }) => {
  const total = ads.length;
  let active = 0;
  let mismatch = 0;
  const landingHosts = new Set();
  let high = 0;
  let unreviewed = 0;

  ads.forEach((ad) => {
    if (ad.is_active) active += 1;
    if (ad.destination_mismatch) mismatch += 1;
    (ad.card_hostnames || []).forEach((host) => landingHosts.add(host));
    if (ad.shown_hostname) landingHosts.add(ad.shown_hostname);
    const reviewed = hasReviewSignal(ad);
    const score = ad.review_details?.threat_score ?? ad.analysis_results?.risk_score ?? 0;
    if (!reviewed) unreviewed += 1;
    else if (score > 95) high += 1;
  });

  return (
    <View style={styles.metricsSection}>
      <Text style={styles.sectionTitle}>Executive Summary</Text>
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total Ads</Text>
          <Text style={styles.metricValue}>{total.toLocaleString()}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Active</Text>
          <Text style={[styles.metricValue, { color: Theme.SAFE }]}>{active.toLocaleString()}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricLabel, { textAlign: 'center' }]}>Destination{'\n'}Mismatch</Text>
          <Text style={[styles.metricValue, { color: mismatch > 0 ? Theme.RISK_HIGH : Theme.PRIMARY_BLUE }]}>
            {mismatch.toLocaleString()}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Landing Domains</Text>
          <Text style={styles.metricValue}>{landingHosts.size.toLocaleString()}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>{unreviewed === total ? 'Unreviewed' : 'High Risk'}</Text>
          <Text style={[styles.metricValue, { color: unreviewed === total ? Theme.SECONDARY_GRAY : Theme.RISK_HIGH }]}>
            {(unreviewed === total ? unreviewed : high).toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );
};

const TableHeader = () => (
  <View style={styles.tableHeader} fixed>
    <Text style={[styles.tableHeaderCell, styles.colIndex]}>#</Text>
    <Text style={[styles.tableHeaderCell, styles.colContent]}>Creative</Text>
    <Text style={[styles.tableHeaderCell, styles.colAdvertiser]}>Advertiser</Text>
    <Text style={[styles.tableHeaderCell, styles.colDest]}>Destinations</Text>
    <Text style={[styles.tableHeaderCell, styles.colThreat]}>Violations</Text>
    <Text style={[styles.tableHeaderCell, styles.colRisk]}>Risk</Text>
    <Text style={[styles.tableHeaderCell, styles.colStatus]}>Dates</Text>
  </View>
);

const resolveThreats = (ad, project) => {
  const review = ad.review_details || {};
  let projectDetails = project?.project_details;
  if (typeof projectDetails === 'string') {
    try {
      projectDetails = JSON.parse(projectDetails);
    } catch (e) {
      projectDetails = {};
    }
  }
  const projectLabels = projectDetails?.labels || [];
  const resolvedThreats = [];
  const threatTypes = Array.isArray(review.threat_types) ? review.threat_types : [];

  projectLabels.forEach((label) => {
    const inFlags = review.flags?.[label.name] === true;
    const inThreatTypes = threatTypes.includes(label.name);
    if (inFlags || inThreatTypes) {
      resolvedThreats.push(label.name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
    }
  });

  threatTypes.forEach((type) => {
    if (!type || type === 'safe') return;
    const formatted = type.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    if (!resolvedThreats.some((t) => t.toLowerCase() === formatted.toLowerCase())) {
      resolvedThreats.push(formatted);
    }
  });

  return resolvedThreats;
};

const TableRow = ({ ad, project, compressedImage, caseNumber }) => {
  const review = ad.review_details || {};
  const riskScore = review.threat_score ?? ad.analysis_results?.risk_score ?? 0;
  const riskInfo = getRiskLabel(riskScore, hasReviewSignal(ad));
  const resolvedThreats = resolveThreats(ad, project);
  const imageUrl = compressedImage || ad.signedImageUrl || null;
  const postedDate = formatCompleteDate(ad.posted_date || ad.start_date || ad.created_at);
  const sourcedDate = formatCompleteDate(ad.sourcing_date || ad.created_at);
  const platforms = (ad.publisher_platforms || []).slice(0, 2).join(' · ') || 'META';
  const creativeText = ad.title || ad.caption || ad.cta_text || 'Untitled creative';

  return (
    <View style={styles.tableRow} wrap={false}>
      <View style={styles.colIndex}>
        <Text style={styles.indexText}>{caseNumber}</Text>
      </View>

      <View style={styles.colContent}>
        <View style={styles.contentContainer}>
          {imageUrl ? (
            <Image style={styles.adImage} src={imageUrl} />
          ) : (
            <View style={[styles.adImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.BG_SECTION }]}>
              <Text style={{ fontSize: 6, color: Theme.SECONDARY_GRAY }}>No Img</Text>
            </View>
          )}
          <View style={styles.contentInfo}>
            <Text style={styles.formatText}>
              {processText(ad.display_format || 'Ad')}
              {ad.card_count ? ` · ${ad.card_count} cards` : ''}
            </Text>
            <Text style={styles.captionText}>{processText(creativeText, 80, 3)}</Text>
            {ad.original_url ? (
              <Link src={ad.original_url} style={styles.linkText} target="_blank">
                Ad Library
              </Link>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.colAdvertiser}>
        <Text style={styles.advertiserName}>{processText(ad.advertiser?.page_name || 'Unknown', 40)}</Text>
        <Text style={styles.platformText}>{processText(ad.platform || 'meta')}</Text>
        <Text style={styles.metaText}>{processText(platforms, 40)}</Text>
        {ad.cta_text ? <Text style={styles.metaText}>CTA: {processText(ad.cta_text, 20)}</Text> : null}
      </View>

      <View style={styles.colDest}>
        <Text style={styles.destLabel}>Shown as</Text>
        <Text style={styles.destValue}>{processText(ad.shown_hostname || ad.caption || '—', 28)}</Text>
        <Text style={styles.destLabel}>Card destinations</Text>
        <Text style={styles.destValue}>
          {processText((ad.card_hostnames || []).slice(0, 3).join(', ') || '—', 40)}
        </Text>
        {ad.destination_mismatch ? (
          <View style={styles.mismatchBadge}>
            <Text style={styles.mismatchText}>Mismatch</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.colThreat}>
        <View style={styles.threatContainer}>
          {resolvedThreats.map((threat, idx) => (
            <View key={idx} style={styles.threatBadge}>
              <Text style={styles.threatText}>{processText(threat, 25)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.colRisk}>
        <View style={[styles.riskBadgeTable, { backgroundColor: riskInfo.bg, borderColor: riskInfo.color }]}>
          <Text style={[styles.riskBadgeTextTable, { color: riskInfo.color }]} wrap={false}>{riskInfo.label}</Text>
        </View>
      </View>

      <View style={styles.colStatus}>
        <View style={styles.dateItem}>
          <Text style={styles.dateLabel}>Started</Text>
          <Text style={styles.dateValue}>{postedDate}</Text>
        </View>
        <View style={styles.dateItem}>
          <Text style={styles.dateLabel}>Sourced</Text>
          <Text style={styles.dateValue}>{sourcedDate}</Text>
        </View>
      </View>
    </View>
  );
};

export const AdsSummaryReportDocument = ({ ads, project, compressedImages }) => (
  <Document title="Ads_Summary_Report">
    <Page size="A4" style={styles.page}>
      <PageHeader />
      <MetricsSection ads={ads} />
      <View style={{ marginTop: 10 }}>
        <Text style={styles.sectionTitle}>Ad List Analysis</Text>
        <TableHeader />
        {ads.map((ad, idx) => (
          <TableRow
            key={ad._id || idx}
            ad={ad}
            project={project}
            compressedImage={compressedImages?.[idx]}
            caseNumber={idx + 1}
          />
        ))}
      </View>
      <PageFooter />
    </Page>
  </Document>
);

export default AdsSummaryReportDocument;
