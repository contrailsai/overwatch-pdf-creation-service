import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Link } from '@react-pdf/renderer';
import { registerFonts } from './utils/FontRegister';
import {
  DomainTheme as Theme,
  processText,
  formatCompleteDate,
  domainRiskInfo,
  domainRiskRank,
  domainLanderCaption,
  domainAdsCount,
  domainHasCloaking,
  domainVisitUrl,
  collectDomainViolations,
  clientVisibleCloakVariants,
  reportDomains,
} from './domainPdfShared';

registerFonts();

const THUMB_WIDTH = 232;
const THUMB_HEIGHT = 144;

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
    paddingBottom: 10,
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
  metricsSection: { marginBottom: 16 },
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
    fontSize: 6.5,
    color: Theme.SECONDARY_GRAY,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  metricValue: {
    fontSize: 16,
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
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: Theme.BORDER_LIGHT,
    alignItems: 'flex-start',
    overflow: 'hidden',
  },
  colIndex: { width: '6%', paddingRight: 4, alignItems: 'center' },
  colDomain: { width: '46%', paddingRight: 8 },
  colRisk: { width: '13%', paddingRight: 4 },
  colCloak: { width: '13%', paddingRight: 6 },
  colThreat: { width: '14%', paddingRight: 6 },
  colAds: { width: '8%' },
  indexText: { fontSize: 8, fontWeight: '700', color: Theme.PRIMARY_BLUE },
  thumbFrame: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: 4,
    marginBottom: 6,
    overflow: 'hidden',
    backgroundColor: Theme.BG_SECTION,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
  },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    objectFit: 'cover',
  },
  thumbPlaceholder: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: 4,
    marginBottom: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.BG_SECTION,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
  },
  domainName: { fontSize: 8, fontWeight: '900', color: Theme.PRIMARY_BLUE, marginBottom: 2 },
  visitUrl: { fontSize: 6.5, color: Theme.LINK, textDecoration: 'none' },
  cloakText: { fontSize: 7, color: Theme.PRIMARY_BLUE, fontWeight: '700' },
  cloakMeta: { fontSize: 6.5, color: Theme.SECONDARY_GRAY, marginTop: 2 },
  threatContainer: { flexDirection: 'column', gap: 3 },
  threatBadge: {
    backgroundColor: Theme.BG_SECTION,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.3,
    borderColor: Theme.BORDER_LIGHT,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  threatText: { fontSize: 6.5, color: Theme.PRIMARY_BLUE, textTransform: 'capitalize' },
  riskBadgeTable: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  riskBadgeTextTable: { fontSize: 6.5, fontWeight: '900', textTransform: 'uppercase' },
  adsCount: { fontSize: 8, fontWeight: '700', color: Theme.PRIMARY_BLUE },
});

const PageHeader = () => (
  <View style={styles.header} fixed>
    <View>
      <Text style={styles.title}>OVERWATCH</Text>
      <Text style={styles.subtitle}>Domain Integrity Report</Text>
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

const MetricsSection = ({ domains }) => {
  const total = domains.length;
  let high = 0;
  let medium = 0;
  let low = 0;
  let safe = 0;
  let cloaked = 0;

  domains.forEach((domain) => {
    const rank = domainRiskRank(domain);
    if (rank === 'high') high += 1;
    else if (rank === 'medium') medium += 1;
    else if (rank === 'low') low += 1;
    else if (rank === 'safe') safe += 1;
    if (domainHasCloaking(domain)) cloaked += 1;
  });

  const cards = [
    { label: 'Total', value: total, color: Theme.PRIMARY_BLUE },
    { label: 'High', value: high, color: Theme.RISK_HIGH },
    { label: 'Medium', value: medium, color: Theme.RISK_MEDIUM },
    { label: 'Low', value: low, color: Theme.RISK_LOW },
    { label: 'Safe', value: safe, color: Theme.SAFE },
    { label: 'Cloaked', value: cloaked, color: cloaked > 0 ? Theme.WARN : Theme.PRIMARY_BLUE },
  ];

  return (
    <View style={styles.metricsSection}>
      <Text style={styles.sectionTitle}>Executive Summary</Text>
      <View style={styles.metricsGrid}>
        {cards.map((card) => (
          <View key={card.label} style={styles.metricCard}>
            <Text style={styles.metricLabel}>{card.label}</Text>
            <Text style={[styles.metricValue, { color: card.color }]}>{card.value.toLocaleString()}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const TableHeader = () => (
  <View style={styles.tableHeader} fixed>
    <Text style={[styles.tableHeaderCell, styles.colIndex]}>#</Text>
    <Text style={[styles.tableHeaderCell, styles.colDomain]}>Domain</Text>
    <Text style={[styles.tableHeaderCell, styles.colRisk]}>Risk</Text>
    <Text style={[styles.tableHeaderCell, styles.colCloak]}>Cloaked</Text>
    <Text style={[styles.tableHeaderCell, styles.colThreat]}>Violations</Text>
    <Text style={[styles.tableHeaderCell, styles.colAds]}>Ads</Text>
  </View>
);

const TableRow = ({ domain, compressedImage, caseNumber }) => {
  const riskInfo = domainRiskInfo(domain);
  const visitUrl = domainVisitUrl(domain);
  const cloaked = domainHasCloaking(domain);
  const landerCount = clientVisibleCloakVariants(domain).length;
  const violations = collectDomainViolations(domain).slice(0, 3);
  const imageUrl = compressedImage || null;
  const cloakCaption = processText(domainLanderCaption(domain), 18);

  return (
    <View style={styles.tableRow} wrap={false}>
      <View style={styles.colIndex}>
        <Text style={styles.indexText}>{caseNumber}</Text>
      </View>

      <View style={styles.colDomain}>
        {imageUrl ? (
          <View style={styles.thumbFrame} wrap={false}>
            <Image style={styles.thumb} src={imageUrl} />
          </View>
        ) : (
          <View style={styles.thumbPlaceholder} wrap={false}>
            <Text style={{ fontSize: 6, color: Theme.SECONDARY_GRAY }}>No Img</Text>
          </View>
        )}
        <Text style={styles.domainName} wrap={false}>
          {processText(domain.domain_name || 'Unknown domain', 42)}
        </Text>
        {visitUrl ? (
          <Link src={visitUrl} style={styles.visitUrl} target="_blank" wrap={false}>
            {processText(visitUrl, 46)}
          </Link>
        ) : (
          <Text style={styles.cloakMeta} wrap={false}>
            No visit URL
          </Text>
        )}
      </View>

      <View style={styles.colRisk}>
        <View style={[styles.riskBadgeTable, { backgroundColor: riskInfo.bg, borderColor: riskInfo.color }]}>
          <Text style={[styles.riskBadgeTextTable, { color: riskInfo.color }]} wrap={false}>
            {riskInfo.label}
          </Text>
        </View>
      </View>

      <View style={styles.colCloak}>
        <Text style={styles.cloakText} wrap={false}>
          {cloaked ? 'Y' : 'N'}
        </Text>
        <Text style={styles.cloakMeta} wrap={false}>
          {landerCount} lander{landerCount === 1 ? '' : 's'} · {cloakCaption}
        </Text>
      </View>

      <View style={styles.colThreat}>
        <View style={styles.threatContainer}>
          {violations.length === 0 ? (
            <Text style={styles.cloakMeta}>—</Text>
          ) : (
            violations.map((threat, idx) => (
              <View key={idx} style={styles.threatBadge} wrap={false}>
                <Text style={styles.threatText} wrap={false}>
                  {processText(threat.replace(/[-_]/g, ' '), 20)}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      <View style={styles.colAds}>
        <Text style={styles.adsCount} wrap={false}>
          {domainAdsCount(domain).toLocaleString()}
        </Text>
      </View>
    </View>
  );
};

export const DomainsSummaryReportDocument = (props) => {
  const domains = reportDomains(props);
  const compressedImages = props.compressedImages;

  return (
    <Document title="Domains_Summary_Report">
      <Page size="A4" style={styles.page}>
        <PageHeader />
        <MetricsSection domains={domains} />
        <View>
          <Text style={styles.sectionTitle}>Domain List Analysis</Text>
          <TableHeader />
          {domains.map((domain, idx) => (
            <TableRow
              key={domain._id || idx}
              domain={domain}
              compressedImage={compressedImages?.[idx]}
              caseNumber={idx + 1}
            />
          ))}
        </View>
        <PageFooter />
      </Page>
    </Document>
  );
};

export const SummaryDomainsReportDocument = DomainsSummaryReportDocument;

export default DomainsSummaryReportDocument;
