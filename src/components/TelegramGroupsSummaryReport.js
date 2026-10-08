import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Link } from '@react-pdf/renderer';
import { registerFonts } from './utils/FontRegister';
import {
  DomainTheme as Theme,
  processText,
  formatCompleteDate,
  groupRiskInfo,
  collectGroupViolations,
  groupTypeLabel,
  groupAudienceLabel,
  groupMessageCountLabel,
  groupUsernameLabel,
  groupSourceLabel,
  groupHasAiAnalysis,
  groupTotalFlaggedMessages,
} from './telegramGroupPdfShared';

registerFonts();

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
  metricsGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
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
    textAlign: 'center',
  },
  metricValue: { fontSize: 18, fontWeight: '900', color: Theme.PRIMARY_BLUE },
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
  colIndex: { width: '5%', paddingRight: 4, alignItems: 'center' },
  colGroup: { width: '24%', paddingRight: 8 },
  colAudience: { width: '12%', paddingRight: 6 },
  colMessages: { width: '8%', paddingRight: 6 },
  colFlagged: { width: '8%', paddingRight: 6 },
  colViolations: { width: '14%', paddingRight: 6 },
  colRisk: { width: '13%', paddingRight: 4 },
  colDates: { width: '16%', alignItems: 'flex-start' },
  indexText: { fontSize: 8, fontWeight: '700', color: Theme.PRIMARY_BLUE },
  groupContainer: { flexDirection: 'row' },
  groupInfo: { flex: 1, flexDirection: 'column' },
  groupImage: {
    width: 45,
    height: 45,
    borderRadius: 8,
    marginRight: 8,
    objectFit: 'contain',
    backgroundColor: Theme.BG_SECTION,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
  },
  noImage: {
    width: 45,
    height: 45,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: Theme.BG_SECTION,
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageText: { fontSize: 6, color: Theme.SECONDARY_GRAY, textAlign: 'center' },
  groupTitle: {
    fontSize: 8,
    fontWeight: '900',
    color: Theme.PRIMARY_BLUE,
    marginBottom: 2,
    lineHeight: 1.3,
  },
  usernameText: { fontSize: 6.5, color: Theme.SECONDARY_GRAY, marginBottom: 2 },
  typeText: {
    fontSize: 6,
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  sourceLink: { fontSize: 6.5, color: Theme.LINK, textDecoration: 'none', marginTop: 2 },
  audienceValue: { fontSize: 10, fontWeight: '900', color: Theme.PRIMARY_BLUE, marginBottom: 1 },
  audienceLabel: {
    fontSize: 5.5,
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 3,
  },
  metaText: { fontSize: 6.5, color: Theme.SECONDARY_GRAY, marginBottom: 2, lineHeight: 1.35 },
  threatContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  threatBadge: {
    backgroundColor: Theme.BG_SECTION,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.3,
    borderColor: Theme.BORDER_LIGHT,
  },
  threatText: { fontSize: 6.5, color: Theme.PRIMARY_BLUE, textTransform: 'capitalize' },
  emptyText: { fontSize: 7, color: Theme.SECONDARY_GRAY },
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

const PageHeader = () => (
  <View style={styles.header} fixed>
    <View>
      <Text style={styles.title}>OVERWATCH</Text>
      <Text style={styles.subtitle}>Telegram Group Integrity Report</Text>
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

const MetricsSection = ({ groups }) => {
  let high = 0;
  let medium = 0;
  let low = 0;
  let aiAnalysed = 0;
  let flagged = 0;
  groups.forEach((group) => {
    const rank = groupRiskInfo(group).rank;
    if (rank === 'high') high += 1;
    else if (rank === 'medium') medium += 1;
    else if (rank === 'low') low += 1;
    if (groupHasAiAnalysis(group)) aiAnalysed += 1;
    flagged += groupTotalFlaggedMessages(group);
  });

  const cards = [
    { label: 'Total Groups', value: groups.length, color: Theme.PRIMARY_BLUE },
    { label: 'High', value: high, color: high > 0 ? Theme.RISK_HIGH : Theme.PRIMARY_BLUE },
    { label: 'Medium', value: medium, color: medium > 0 ? Theme.RISK_MEDIUM : Theme.PRIMARY_BLUE },
    { label: 'Low', value: low, color: low > 0 ? Theme.RISK_LOW : Theme.PRIMARY_BLUE },
    { label: 'Flagged Msgs', value: flagged, color: flagged > 0 ? Theme.WARN : Theme.PRIMARY_BLUE },
    { label: 'AI Analysed', value: aiAnalysed, color: Theme.PRIMARY_BLUE },
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

const GroupRow = ({ group, index, project }) => {
  const risk = groupRiskInfo(group);
  const violations = collectGroupViolations(group, project);

  return (
    <View style={styles.tableRow} wrap={false}>
      <View style={styles.colIndex}>
        <Text style={styles.indexText}>{index + 1}</Text>
      </View>

      <View style={styles.colGroup}>
        <View style={styles.groupContainer}>
          {group.compressedImage ? (
            <Image src={group.compressedImage} style={styles.groupImage} />
          ) : (
            <View style={styles.noImage}>
              <Text style={styles.noImageText}>No{'\n'}Img</Text>
            </View>
          )}
          <View style={styles.groupInfo}>
            <Text style={styles.groupTitle}>{processText(group.title, 56, 2)}</Text>
            <Text style={styles.usernameText}>{groupUsernameLabel(group)}</Text>
            <Text style={styles.typeText}>{groupTypeLabel(group)}</Text>
            {group.original_url ? (
              <Link src={group.original_url} style={styles.sourceLink}>
                {groupSourceLabel(group) || 'Open in Telegram'}
              </Link>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.colAudience}>
        <Text style={styles.audienceValue}>{groupAudienceLabel(group)}</Text>
        <Text style={styles.audienceLabel}>Participants</Text>
        {group.verified || group.scam || group.fake || group.restricted ? (
          <View>
            {group.verified ? <Text style={styles.metaText}>Verified</Text> : null}
            {group.scam ? <Text style={styles.metaText}>Scam</Text> : null}
            {group.fake ? <Text style={styles.metaText}>Fake</Text> : null}
            {group.restricted ? <Text style={styles.metaText}>Restricted</Text> : null}
          </View>
        ) : null}
      </View>

      <View style={styles.colMessages}>
        <Text style={styles.audienceValue}>{groupMessageCountLabel(group)}</Text>
        <Text style={styles.audienceLabel}>Messages</Text>
      </View>

      <View style={styles.colFlagged}>
        <Text style={styles.audienceValue}>{groupTotalFlaggedMessages(group)}</Text>
        <Text style={styles.audienceLabel}>Flagged</Text>
      </View>

      <View style={styles.colViolations}>
        {violations.length > 0 ? (
          <View style={styles.threatContainer}>
            {violations.slice(0, 3).map((violation) => (
              <View key={violation.name} style={styles.threatBadge}>
                <Text style={styles.threatText}>{processText(violation.name, 20)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>—</Text>
        )}
      </View>

      <View style={styles.colRisk}>
        <View
          style={[styles.riskBadgeTable, { backgroundColor: risk.bg, borderColor: risk.border }]}
        >
          <Text style={[styles.riskBadgeTextTable, { color: risk.color }]}>{risk.label}</Text>
        </View>
      </View>

      <View style={styles.colDates}>
        <View style={styles.dateItem}>
          <Text style={styles.dateLabel}>Sourced</Text>
          <Text style={styles.dateValue}>{formatCompleteDate(group.sourced_at)}</Text>
        </View>
        <View style={styles.dateItem}>
          <Text style={styles.dateLabel}>Reviewed</Text>
          <Text style={styles.dateValue}>{formatCompleteDate(group.reviewed_at)}</Text>
        </View>
      </View>
    </View>
  );
};

export const TelegramGroupsSummaryReportDocument = ({ groups: groupsProp, posts, project }) => {
  const groups = groupsProp || posts || [];

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <PageHeader />
        <MetricsSection groups={groups} />

        <Text style={styles.sectionTitle}>Telegram Group List Analysis</Text>
        <View style={styles.tableHeader} fixed>
          <Text style={[styles.tableHeaderCell, styles.colIndex]}>#</Text>
          <Text style={[styles.tableHeaderCell, styles.colGroup]}>Group</Text>
          <Text style={[styles.tableHeaderCell, styles.colAudience]}>Audience</Text>
          <Text style={[styles.tableHeaderCell, styles.colMessages]}>Messages</Text>
          <Text style={[styles.tableHeaderCell, styles.colFlagged]}>Flagged</Text>
          <Text style={[styles.tableHeaderCell, styles.colViolations]}>Violations</Text>
          <Text style={[styles.tableHeaderCell, styles.colRisk]}>Risk</Text>
          <Text style={[styles.tableHeaderCell, styles.colDates]}>Dates</Text>
        </View>

        {groups.map((group, index) => (
          <GroupRow key={group._id} group={group} index={index} project={project} />
        ))}

        <PageFooter />
      </Page>
    </Document>
  );
};

export const TelegramGroupsSummary = TelegramGroupsSummaryReportDocument;
export default TelegramGroupsSummaryReportDocument;
