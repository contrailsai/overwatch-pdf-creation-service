import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Link } from '@react-pdf/renderer';
import { registerFonts } from './utils/FontRegister';
import {
  DomainTheme as Theme,
  processText,
  formatCompleteDate,
  appRiskInfo,
  collectAppViolations,
  appDeveloperName,
  appStoreFacts,
  appPlatformLabel,
  appIsAlerted,
} from './appPdfShared';

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
  colApp: { width: '27%', paddingRight: 8 },
  colDeveloper: { width: '16%', paddingRight: 6 },
  colStore: { width: '19%', paddingRight: 6 },
  colViolations: { width: '11%', paddingRight: 6 },
  colRisk: { width: '13%', paddingRight: 4 },
  colDates: { width: '9%', alignItems: 'flex-start' },
  indexText: { fontSize: 8, fontWeight: '700', color: Theme.PRIMARY_BLUE },
  appContainer: { flexDirection: 'row' },
  appInfo: { flex: 1, flexDirection: 'column' },
  appImage: {
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
  appTitle: {
    fontSize: 8,
    fontWeight: '900',
    color: Theme.PRIMARY_BLUE,
    marginBottom: 2,
    lineHeight: 1.3,
  },
  packageText: { fontSize: 6.5, color: Theme.SECONDARY_GRAY, marginBottom: 2 },
  platformText: {
    fontSize: 6,
    color: Theme.SECONDARY_GRAY,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  storeLink: { fontSize: 6.5, color: Theme.LINK, textDecoration: 'none', marginTop: 2 },
  developerName: {
    fontSize: 8,
    fontWeight: '900',
    color: Theme.PRIMARY_BLUE,
    marginBottom: 2,
    lineHeight: 1.3,
  },
  metaText: { fontSize: 6.5, color: Theme.SECONDARY_GRAY, marginBottom: 2, lineHeight: 1.35 },
  linkText: { fontSize: 6.5, color: Theme.LINK, textDecoration: 'none', marginTop: 2 },
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
      <Text style={styles.subtitle}>App Integrity Report</Text>
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

const MetricsSection = ({ apps }) => {
  const total = apps.length;
  const developers = new Set(apps.map((app) => appDeveloperName(app)));

  let high = 0;
  let medium = 0;
  let low = 0;
  let alerted = 0;
  apps.forEach((app) => {
    const rank = appRiskInfo(app).rank;
    if (rank === 'high') high += 1;
    else if (rank === 'medium') medium += 1;
    else if (rank === 'low') low += 1;
    if (appIsAlerted(app)) alerted += 1;
  });

  const cards = [
    { label: 'Total Apps', value: total, color: Theme.PRIMARY_BLUE },
    { label: 'High', value: high, color: high > 0 ? Theme.RISK_HIGH : Theme.PRIMARY_BLUE },
    { label: 'Medium', value: medium, color: medium > 0 ? Theme.RISK_MEDIUM : Theme.PRIMARY_BLUE },
    { label: 'Low', value: low, color: low > 0 ? Theme.RISK_LOW : Theme.PRIMARY_BLUE },
    { label: 'Developers', value: developers.size, color: Theme.PRIMARY_BLUE },
    { label: 'Alerted', value: alerted, color: alerted > 0 ? Theme.SAFE : Theme.PRIMARY_BLUE },
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

const AppRow = ({ app, index, project }) => {
  const risk = appRiskInfo(app);
  const violations = collectAppViolations(app, project);
  const facts = appStoreFacts(app);
  const developerName = appDeveloperName(app);

  return (
    <View style={styles.tableRow} wrap={false}>
      <View style={styles.colIndex}>
        <Text style={styles.indexText}>{index + 1}</Text>
      </View>

      <View style={styles.colApp}>
        <View style={styles.appContainer}>
          {app.compressedImage ? (
            <Image src={app.compressedImage} style={styles.appImage} />
          ) : (
            <View style={styles.noImage}>
              <Text style={styles.noImageText}>No{'\n'}Img</Text>
            </View>
          )}
          <View style={styles.appInfo}>
            <Text style={styles.appTitle}>{processText(app.title, 60, 2)}</Text>
            <Text style={styles.packageText}>{app.package_id || '—'}</Text>
            <Text style={styles.platformText}>{appPlatformLabel(app)}</Text>
            {app.original_url ? (
              <Link src={app.original_url} style={styles.storeLink}>
                {app.source_label || 'View app'}
              </Link>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.colDeveloper}>
        <Text style={styles.developerName}>{processText(developerName, 48, 2)}</Text>
        {app.developer.legal_name ? (
          <Text style={styles.metaText}>{processText(app.developer.legal_name, 48, 2)}</Text>
        ) : null}
        {app.developer.profile_url ? (
          <Link src={app.developer.profile_url} style={styles.linkText}>
            Developer page
          </Link>
        ) : null}
      </View>

      <View style={styles.colStore}>
        {facts.length > 0 ? (
          facts.map((fact, factIndex) => (
            <Text key={factIndex} style={styles.metaText}>
              {fact}
            </Text>
          ))
        ) : (
          <Text style={styles.metaText}>—</Text>
        )}
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
          <Text style={styles.dateValue}>{formatCompleteDate(app.sourced_at)}</Text>
        </View>
        <View style={styles.dateItem}>
          <Text style={styles.dateLabel}>Reviewed</Text>
          <Text style={styles.dateValue}>{formatCompleteDate(app.reviewed_at)}</Text>
        </View>
      </View>
    </View>
  );
};

export const AppsSummaryReportDocument = ({ apps: appsProp, posts, project }) => {
  const apps = appsProp || posts || [];

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <PageHeader />
        <MetricsSection apps={apps} />

        <Text style={styles.sectionTitle}>App List Analysis</Text>
        <View style={styles.tableHeader} fixed>
          <Text style={[styles.tableHeaderCell, styles.colIndex]}>#</Text>
          <Text style={[styles.tableHeaderCell, styles.colApp]}>App</Text>
          <Text style={[styles.tableHeaderCell, styles.colDeveloper]}>Developer</Text>
          <Text style={[styles.tableHeaderCell, styles.colStore]}>Store</Text>
          <Text style={[styles.tableHeaderCell, styles.colViolations]}>Violations</Text>
          <Text style={[styles.tableHeaderCell, styles.colRisk]}>Risk</Text>
          <Text style={[styles.tableHeaderCell, styles.colDates]}>Dates</Text>
        </View>

        {apps.map((app, index) => (
          <AppRow key={app._id} app={app} index={index} project={project} />
        ))}

        <PageFooter />
      </Page>
    </Document>
  );
};

export const AppsSummary = AppsSummaryReportDocument;
export default AppsSummaryReportDocument;
