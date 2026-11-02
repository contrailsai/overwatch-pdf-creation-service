import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Link } from '@react-pdf/renderer';
import { registerFonts } from './utils/FontRegister';
import {
  DomainTheme as Theme,
  processText,
  formatDateTime,
  appRiskInfo,
  hasAppReviewSignal,
  appDeveloperName,
  appInstallCountLabel,
  appPlatformLabel,
  buildAppReviewModel,
  buildAppAnalysisModel,
  buildAppEvidenceModel,
  buildAppProofCards,
  buildEvidenceFieldRows,
} from './appPdfShared';

registerFonts();

/** Page-1 hook caps keep the first page to a single sheet. */
const MAX_HOOK_VIOLATIONS = 8;
const MAX_HOOK_LEGAL_CODES = 4;
/** Section caps keep the whole dossier inside ~4 pages. */

const styles = StyleSheet.create({
  page: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 26,
    fontFamily: ['Outfit', 'Mukta'],
    backgroundColor: Theme.SURFACE,
    color: Theme.INK,
  },
  /* ---- fixed chrome ---- */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 0.5,
    borderBottomColor: Theme.LINE,
    paddingBottom: 5,
    marginBottom: 8,
  },
  brandTitle: { fontSize: 15, fontWeight: 900, color: Theme.INK, letterSpacing: 0.3 },
  brandSubtitle: { fontSize: 6.5, color: Theme.MUTED, textTransform: 'uppercase', letterSpacing: 1.3 },
  headerRight: { alignItems: 'flex-end', maxWidth: '55%' },
  headerTitle: { fontSize: 8, fontWeight: 700, color: Theme.INK },
  headerMeta: { fontSize: 6.5, color: Theme.MUTED, marginTop: 1 },
  footer: {
    position: 'absolute',
    bottom: 10,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 6.5,
    color: Theme.MUTED,
    borderTopWidth: 0.5,
    borderTopColor: Theme.LINE,
    paddingTop: 5,
  },
  /* ---- section headings ---- */
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionHeadingText: {
    fontSize: 11,
    fontWeight: 900,
    color: Theme.PRIMARY_BLUE,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  sectionHeadingMeta: { fontSize: 8, color: Theme.MUTED },
  /* ---- hook ---- */
  hookHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 5,
  },
  hookTitle: { fontSize: 16, fontWeight: 700, color: Theme.INK, flex: 1, lineHeight: 1.2 },
  columns: { flexDirection: 'row', gap: 10 },
  leftCol: { flexGrow: 57, flexBasis: 0, minWidth: 0 },
  rightCol: { flexGrow: 43, flexBasis: 0, minWidth: 0 },
  /* ---- cards ---- */
  card: {
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    borderRadius: 6,
    padding: 9,
    marginBottom: 6,
    backgroundColor: Theme.SURFACE,
  },
  cardLabel: {
    fontSize: 9,
    fontWeight: 900,
    color: Theme.PRIMARY_BLUE,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 8,
    fontWeight: 900,
    color: Theme.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.55,
    marginTop: 5,
    marginBottom: 2,
  },
  /* ---- key/value ---- */
  kvGridRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  kvHalf: { flex: 1 },
  kvFull: { width: '100%' },
  pairRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  pairCol: { flex: 1, minWidth: 0 },
  kvLabel: {
    fontSize: 7.5,
    color: Theme.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  kvValue: { fontSize: 9.5, color: Theme.INK, fontWeight: 700, lineHeight: 1.42 },
  kvValueSoft: { fontSize: 9.5, color: Theme.INK_SOFT, lineHeight: 1.42 },
  kvLink: { fontSize: 8.5, color: Theme.LINK, fontWeight: 700, textDecoration: 'none', lineHeight: 1.4 },
  divider: { height: 0.5, backgroundColor: Theme.LINE, marginVertical: 6 },
  /* ---- risk / violations ---- */
  riskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  riskPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  riskPillText: { fontSize: 7, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.6 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 2 },
  pill: {
    backgroundColor: Theme.RISK_HIGH_BG,
    borderWidth: 0.5,
    borderColor: Theme.RISK_HIGH,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pillText: { fontSize: 7, fontWeight: 700, color: Theme.RISK_HIGH, textTransform: 'capitalize' },
  legalShell: {
    flexDirection: 'row',
    borderWidth: 0.5,
    borderColor: Theme.RISK_HIGH_BORDER,
    borderRadius: 4,
    backgroundColor: Theme.RISK_HIGH_BG,
    overflow: 'hidden',
    marginBottom: 3,
  },
  legalAccent: { width: 3, backgroundColor: Theme.RISK_HIGH },
  legalInner: { flex: 1, paddingVertical: 4, paddingHorizontal: 7 },
  legalCode: { fontSize: 7.5, fontWeight: 900, color: Theme.RISK_HIGH, marginBottom: 1 },
  legalReason: { fontSize: 7.5, color: Theme.INK_SOFT, lineHeight: 1.35 },
  /* ---- analysis ---- */
  caseSummaryText: { fontSize: 12.5, fontWeight: 500, color: Theme.INK, lineHeight: 1.38 },
  findingRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  findingIndex: {
    width: 18,
    fontSize: 9,
    fontWeight: 900,
    color: Theme.PRIMARY_BLUE,
    paddingTop: 1,
  },
  findingBody: { flex: 1 },
  findingTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 1 },
  findingTag: {
    fontSize: 7,
    fontWeight: 900,
    color: Theme.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  findingSource: {
    fontSize: 7,
    fontWeight: 900,
    color: Theme.LINK,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  findingText: { fontSize: 9.5, color: Theme.INK_SOFT, lineHeight: 1.5 },
  operatorRow: { flexDirection: 'row', gap: 9, marginBottom: 8 },
  operatorLabel: {
    width: 62,
    fontSize: 7.5,
    color: Theme.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  operatorValue: { flex: 1, fontSize: 9, color: Theme.INK_SOFT, lineHeight: 1.48 },
  actionText: { fontSize: 8.5, fontWeight: 700, color: Theme.INK, lineHeight: 1.35 },
  targetRow: { marginBottom: 10 },
  targetLabel: {
    fontSize: 7.5,
    fontWeight: 900,
    color: Theme.PRIMARY_BLUE,
    textTransform: 'uppercase',
    letterSpacing: 0.55,
    marginBottom: 1,
  },
  targetItem: { fontSize: 9, color: Theme.INK_SOFT, lineHeight: 1.5 },
  /* ---- prose ---- */
  bodyText: { fontSize: 8, color: Theme.INK_SOFT, lineHeight: 1.4 },
  softText: { fontSize: 8, color: Theme.MUTED, lineHeight: 1.4 },
  /* ---- gallery ---- */
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  iconWell: {
    width: 58,
    height: 58,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    backgroundColor: Theme.SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImage: { width: 58, height: 58, objectFit: 'contain' },
  iconPlaceholder: { fontSize: 6.5, color: Theme.MUTED, textAlign: 'center' },
  iconMeta: { flex: 1 },
  iconMetaTitle: { fontSize: 8.5, fontWeight: 700, color: Theme.INK, lineHeight: 1.25 },
  iconMetaSub: { fontSize: 6.5, color: Theme.MUTED, marginTop: 2 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  galleryCell: {
    width: '48%',
    height: 148,
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    backgroundColor: Theme.SURFACE,
    overflow: 'hidden',
  },
  galleryImage: { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' },
  galleryPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  galleryPlaceholderText: { fontSize: 6.5, color: Theme.MUTED },
  noteText: { fontSize: 6.5, color: Theme.MUTED, marginTop: 4 },
  /* ---- evidence media ---- */
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  mediaCell: {
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    backgroundColor: Theme.SURFACE_ALT,
    overflow: 'hidden',
  },
  mediaCellOne: { width: '62%', height: 118 },
  mediaCellTwo: { width: '48%', height: 96 },
  mediaCellMany: { width: '32%', height: 80 },
  proofRow: { flexDirection: 'row', gap: 8, marginTop: 5 },
  proofCard: { flex: 1, borderWidth: 0.5, borderColor: Theme.LINE, borderRadius: 5, padding: 7, backgroundColor: Theme.BG_SECTION },
  proofImage: { width: '100%', height: 150, objectFit: 'contain', backgroundColor: Theme.SURFACE },
  proofCaption: { fontSize: 7, color: Theme.INK_SOFT, lineHeight: 1.3, marginTop: 4 },
  mediaImage: { width: '100%', height: '100%', objectFit: 'contain' },
  evidenceTitle: { fontSize: 9.5, fontWeight: 700, color: Theme.INK, marginBottom: 3, lineHeight: 1.3 },
  evidenceText: { fontSize: 9, color: Theme.INK_SOFT, lineHeight: 1.48 },
});

const displayValue = (value, max = 60) => {
  const text = value == null ? '' : String(value).trim();
  if (!text) return '—';
  return processText(text, max) || text;
};

const Header = ({ app }) => (
  <View style={styles.header} fixed>
    <View>
      <Text style={styles.brandTitle}>Overwatch</Text>
      <Text style={styles.brandSubtitle}>App Integrity</Text>
    </View>
    <View style={styles.headerRight}>
      <Text style={styles.headerTitle}>{processText(app.title || 'Unknown app', 46)}</Text>
      <Text style={styles.headerMeta}>{processText(app.package_id || '—', 44)}</Text>
    </View>
  </View>
);

const Footer = () => (
  <View style={styles.footer} fixed>
    <Text>Confidential Document</Text>
    <Text>Powered by Contrails AI</Text>
    <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
  </View>
);

const FieldGrid = ({ items }) => {
  const rows = buildEvidenceFieldRows(items);
  return (
    <View>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.kvGridRow} wrap={false}>
          {row.map((item, cellIndex) => (
            <View key={`${item.label}-${cellIndex}`} style={row.length === 1 ? styles.kvFull : styles.kvHalf}>
              <Text style={styles.kvLabel}>{item.label}</Text>
              <Text style={styles.kvValue}>{String(item.value || '—')}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

const MetaRow = ({ label, children }) => (
  <View style={styles.kvGridRow}>
    <Text style={[styles.kvLabel, { width: 62, marginBottom: 0 }]}>{label}</Text>
    <View style={{ flex: 1 }}>{children}</View>
  </View>
);

const AppPublisherCard = ({ app, review }) => {
  const store = app.store || {};
  const developer = app.developer || {};
  const risk = appRiskInfo(app);
  const appRows = [
    ['Package', app.package_id],
    ['Platform', appPlatformLabel(app)],
    ['Genre', store.genre],
    ['Content rating', store.content_rating],
    ['Installs', appInstallCountLabel(app)],
    ['Store rating', [store.rating_score != null ? `${Number(store.rating_score).toFixed(1)}/5` : null, store.ratings != null ? `${Number(store.ratings).toLocaleString('en-IN')} ratings` : null].filter(Boolean).join(' · ')],
    ['Store listing', app.original_url],
  ];
  const publisherRows = [
    ['Developer', appDeveloperName(app)],
    ['Legal name', developer.legal_name],
    ['Email', developer.email],
    ['Website', developer.website],
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>App &amp; Publisher</Text>
      {hasAppReviewSignal(app) ? (
        <View style={styles.riskRow}>
          <Text style={[styles.kvLabel, { marginBottom: 0 }]}>Risk</Text>
          <View style={[styles.riskPill, { backgroundColor: risk.bg, borderColor: risk.border }]}>
            <Text style={[styles.riskPillText, { color: risk.color }]}>{risk.label}</Text>
          </View>
        </View>
      ) : null}
      <View style={styles.kvGridRow}>
        <View style={styles.kvHalf}>
          <Text style={[styles.cardLabel, { fontSize: 10, marginTop: 3, marginBottom: 8, color: Theme.INK }]}>Application</Text>
          {appRows.map(([label, value]) => (
            <View key={label} style={{ marginBottom: 4 }}>
              <Text style={styles.kvLabel}>{label}</Text>
              {label === 'Store listing' && value ? (
                <Link src={value} style={styles.kvLink}>
                  {processText(value, 40)}
                </Link>
              ) : (
                <Text style={styles.kvValue}>{displayValue(value, 40)}</Text>
              )}
            </View>
          ))}
        </View>
        <View style={styles.kvHalf}>
          <Text style={[styles.cardLabel, { fontSize: 10, marginTop: 3, marginBottom: 8, color: Theme.INK }]}>Publisher</Text>
          {publisherRows.map(([label, value]) => (
            <View key={label} style={{ marginBottom: 4 }}>
              <Text style={styles.kvLabel}>{label}</Text>
              {label === 'Website' && value ? (
                <Link src={value} style={styles.kvLink}>
                  {processText(value, 40)}
                </Link>
              ) : (
                <Text style={styles.kvValue}>{displayValue(value, 40)}</Text>
              )}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

/**
 * Page-1 hook card. Shows the short "simple reasoning" as the Case Summary in a
 * larger face, then the detected violations. The long-form review details
 * (legal findings, reviewer comments, detailed reasoning) live in the
 * "AI Analysis & Evidence" section instead of bloating the first page.
 */
const provenanceLabel = (source) => ({ review: 'Reviewer', analysis: 'AI analysis', record: 'Recorded', unknown: 'Source unavailable' })[source] || 'Source unavailable';

const CaseSummaryCard = ({ review, summary }) => (
  <View style={styles.card}>
    <Text style={styles.cardLabel}>Case Summary · {provenanceLabel(review.sources.summary)}</Text>

    {review.caseSummary ? (
      <Text style={styles.caseSummaryText}>{processText(review.caseSummary, 520, 6)}</Text>
    ) : (
      <Text style={styles.softText}>
        No case summary recorded yet. See assessment and reviewed basis for recorded details.
      </Text>
    )}

    {review.threatTypes.length > 0 ? (
      <View style={{ marginTop: 9 }}>
        <Text style={styles.subLabel}>Violations · {provenanceLabel(review.sources.violations)}</Text>
        <View style={styles.pillRow}>
          {review.threatTypes.slice(0, MAX_HOOK_VIOLATIONS).map((violation) => (
            <View key={violation.name} style={styles.pill}>
              <Text style={styles.pillText}>{processText(violation.name, 26)}</Text>
            </View>
          ))}
        </View>
        {review.threatTypes.length > MAX_HOOK_VIOLATIONS ? <Text style={styles.noteText}>Additional recorded violations appear in the detailed assessment.</Text> : null}
      </View>
    ) : null}

    {review.legalFindings.length > 0 ? (
      <View style={{ marginTop: 9 }}>
        <Text style={styles.subLabel}>Legal Violations · {provenanceLabel(review.sources.legal_codes)}</Text>
        {review.legalFindings.slice(0, MAX_HOOK_LEGAL_CODES).map((item, index) => (
          <View key={index} style={styles.legalShell}>
            <View style={styles.legalAccent} />
            <View style={styles.legalInner}>
              <Text style={styles.legalCode}>{processText(item.code, 90)}</Text>
              {item.reasoning ? (
                <Text style={styles.legalReason}>{processText(item.reasoning, 85, 1)}</Text>
              ) : null}
            </View>
          </View>
        ))}
        {review.legalFindings.length > MAX_HOOK_LEGAL_CODES ? (
          <Text style={styles.noteText}>
            + {review.legalFindings.length - MAX_HOOK_LEGAL_CODES} more legal finding(s)
          </Text>
        ) : null}
      </View>
    ) : null}

    {review.verdictLabel ? <View style={{ marginTop: 6 }}><Text style={styles.subLabel}>Recommended Action · {provenanceLabel(review.sources.recommended_action)}</Text><Text style={styles.bodyText}>{review.verdictLabel}</Text></View> : review.sources.recommended_action === 'review' ? <Text style={styles.noteText}>Reviewer recommended action: not recorded.</Text> : null}
    <Text style={styles.noteText}>{summary ? 'Detailed export contains the full recorded review.' : 'Full case summary and legal basis: assessment and reviewed basis.'}</Text>
    {!review.hasSignal && !review.caseSummary && !review.threatTypes.length && !review.legalFindings.length ? (
      <Text style={[styles.softText, { marginTop: 6 }]}>
        Not yet reviewed. No threat score, violations or legal findings are attached to this app yet.
      </Text>
    ) : null}
  </View>
);

const ProofCard = ({ card, summary, caseNumber }) => {
  const securities = card.key === 'securities';
  const source = card.sources.find((item) => (item.images || []).some((image) => image.localPath)) || card.sources[0];
  const available = (source?.images || []).filter((item) => item.localPath);
  const selected = summary ? available.slice(0, 1) : card.key === 'payment' && available.length > 1 ? [available[0], available[available.length - 1]] : available.slice(0, 2);
  const missingMedia = source?.media?.[0];
  return (
    <View style={styles.proofCard}>
      <Text style={styles.cardLabel}>{securities ? 'Indian securities activity' : 'Payment request'}</Text>
      {selected.length ? <View style={{ flexDirection: 'row', gap: 4 }}>
        {selected.map((image, index) => <Image key={image.slot || index} style={[styles.proofImage, { width: selected.length > 1 ? '49%' : '100%', height: 165 }]} src={image.localPath} />)}
      </View> : (
        <View style={[styles.proofImage, { justifyContent: 'center', padding: 10 }]}>
          <Text style={styles.softText}>No prepared operational screenshot available{missingMedia?.filename ? `: ${missingMedia.filename}` : '.'}</Text>
        </View>
      )}
      <Text style={[styles.proofCaption, { fontWeight: 700, fontSize: 8.5 }]}>{source?.description || 'No description recorded for this evidence category.'}</Text>
      <Text style={styles.noteText}>{source?.title || 'No matching evidence section recorded.'}</Text>
      {selected.length ? <Text style={styles.noteText}>{selected.length} of {available.length} prepared images: {selected.map((image) => image.filename || image.label || 'image').join(', ')}</Text> : null}
      <Text style={styles.noteText}>Category based on source label; capture alone does not establish execution.</Text>
      {summary ? <Text style={styles.noteText}>Detailed export contains the evidence dossier.</Text> : <Link src={`#case-${caseNumber}-evidence-${card.key}`} style={styles.kvLink}>See this evidence category</Link>}
    </View>
  );
};

export const AppCaseOverviewPage = ({ app, caseNumber, project, summary = false }) => {
  const review = buildAppReviewModel(app, project);
  const analysis = buildAppAnalysisModel(app, project);
  const proofCards = buildAppProofCards(app).sort((a, b) => (a.key === 'securities' ? -1 : b.key === 'securities' ? 1 : 0));
  return (
    <Page size="A4" style={styles.page}>
      <Header app={app} />
      <View style={styles.hookHeading} wrap={false}>
        <Text style={styles.hookTitle}>{caseNumber}. {processText(app.title || 'Unknown app', 80)}</Text>
        <Text style={styles.sectionHeadingMeta}>{review.reviewedAt ? `Reviewed · ${formatDateTime(review.reviewedAt)}` : 'Assessment pending'}</Text>
      </View>
      <View style={styles.columns}>
        <View style={styles.leftCol}><CaseSummaryCard review={review} summary={summary} />
          {!summary && (analysis.hasAnalysis || review.hasSignal || review.caseSummary || review.legalFindings.length || Object.values(review.sources).includes('review')) ? <Link src={`#case-${caseNumber}-assessment`} style={styles.kvLink}>Assessment and reviewed basis</Link> : null}
        </View>
        <View style={styles.rightCol}><AppPublisherCard app={app} review={review} /></View>
      </View>
      <View style={styles.proofRow}>
        {proofCards.map((card) => <ProofCard key={card.key} card={card} summary={summary} caseNumber={caseNumber} />)}
      </View>
      <Footer />
    </Page>
  );
};

/* ------------------------------------------------------------------ *
 * Section 1 — app + developer record                                  *
 * ------------------------------------------------------------------ */

const InfoCard = ({ label, rows, linkLabels = [] }) => (
  <View style={styles.card}>
    <Text style={styles.cardLabel}>{label}</Text>
    {rows.map(([rowLabel, value]) => (
      <MetaRow key={rowLabel} label={rowLabel}>
        {linkLabels.includes(rowLabel) && value ? (
          <Link src={value} style={styles.kvLink}>
            {processText(value, 96)}
          </Link>
        ) : (
          <Text style={styles.kvValueSoft}>{displayValue(value, 150)}</Text>
        )}
      </MetaRow>
    ))}
  </View>
);

const PermissionsCard = ({ app }) => {
  const dataSafety = (app?.data_safety || []).filter((item) => item.title || item.detail);
  const permissions = app?.permissions || [];
  if (dataSafety.length === 0 && permissions.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Permissions &amp; Data Safety</Text>
      <View style={styles.pairRow}>
        {dataSafety.length > 0 ? (
          <View style={styles.pairCol}>
            <Text style={[styles.subLabel, { marginTop: 0 }]}>Data Safety</Text>
            {dataSafety.map((item, index) => (
              <View key={index} style={{ marginBottom: 3 }}>
                {item.title ? <Text style={styles.kvValue}>{processText(item.title, 90)}</Text> : null}
                {item.detail ? <Text style={styles.softText}>{processText(item.detail, 140)}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}
        {permissions.length > 0 ? (
          <View style={styles.pairCol}>
            <Text style={[styles.subLabel, { marginTop: 0 }]}>Permissions</Text>
            {permissions.map((group, index) => (
              <View key={index} style={{ marginBottom: 3 }}>
                <Text style={styles.kvLabel}>{processText(group.category, 44)}</Text>
                <Text style={styles.kvValueSoft}>
                  {group.items.map((item) => processText(item, 70)).join(' · ')}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
};

const InfoPage = ({ app, caseNumber, project }) => {
  const store = app.store || {};
  const developer = app.developer || {};

  const storeRows = [
    ['Real installs', store.real_installs != null ? Number(store.real_installs).toLocaleString('en-IN') : null],
    ['Minimum installs', store.min_installs != null ? Number(store.min_installs).toLocaleString('en-IN') : null],
    ['Version', store.version],
    ['Released', store.released],
    ['Last updated', store.last_updated_on],
    ['In-app purchases', store.offers_iap ? 'Yes' : 'No'],
    ['Contains ads', store.contains_ads ? 'Yes' : 'No'],
    ['Price', store.free ? 'Free' : [store.currency, store.price].filter((v) => v != null && v !== '').join(' ')],
    ['Categories', (store.categories || []).join(', ')],
    ['Store listing', app.original_url],
    ['Privacy policy', store.privacy_policy],
  ];

  const publisherRows = [
    ['Legal email', developer.legal_email],
    ['Phone', developer.phone],
    ['Address', developer.address ? developer.address.replace(/\s*\n\s*/g, ', ') : ''],
    ['Developer ID', developer.platform_developer_id],
    ['Internal ID', developer.platform_developer_internal_id],
    ['Apps by developer', developer.app_count != null ? String(developer.app_count) : ''],
    ['Developer risk', developer.risk_rank],
    ['Developer page', developer.profile_url],
  ];

  return (
    <Page size="A4" style={styles.page}>
      <Header app={app} />

      <View style={styles.sectionHeading} wrap={false}>
        <Text style={styles.sectionHeadingText}>4. App &amp; Developer</Text>
        <Text style={styles.sectionHeadingMeta}>{processText(app.title || '', 46)}</Text>
      </View>

      <View style={styles.pairRow}>
        <View style={styles.pairCol}>
          <InfoCard
            label="Store Details"
            rows={storeRows}
            linkLabels={['Store listing', 'Privacy policy']}
          />
        </View>
        <View style={styles.pairCol}>
          <InfoCard label="Publisher Details" rows={publisherRows} linkLabels={['Developer page']} />
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Description</Text>
        {app.summary ? <Text style={styles.kvValue}>{processText(app.summary, 220)}</Text> : null}
        {app.description ? (
          <Text style={styles.bodyText}>{processText(app.description, 950, 10)}</Text>
        ) : (
          <Text style={styles.softText}>No description captured.</Text>
        )}
      </View>

      <PermissionsCard app={app} />

      <Footer />
    </Page>
  );
};

/* ------------------------------------------------------------------ *
 * Section 2 — AI analysis & evidence                                  *
 * ------------------------------------------------------------------ */

const ThreatTypesCard = ({ threatTypes }) => (
  <View style={styles.card}>
    <Text style={styles.cardLabel}>Detected Threat Types</Text>
    {threatTypes.length > 0 ? (
      <View style={styles.pillRow}>
        {threatTypes.map((threat) => (
          <View key={threat.name} style={styles.pill}>
            <Text style={styles.pillText}>{processText(threat.name, 34)}</Text>
          </View>
        ))}
      </View>
    ) : (
      <Text style={styles.softText}>No threat types recorded.</Text>
    )}
  </View>
);

const OperatorCard = ({ operator }) => {
  if (!operator) return null;
  const rows = [
    ['Developer account', operator.developerAccount],
    ['Legal entities', operator.legalEntities.join(', ')],
    ['Countries', operator.countries.join(', ')],
    ['Concealment', operator.concealment],
  ].filter(([, value]) => value);

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Operator Profile</Text>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.operatorRow}>
          <Text style={styles.operatorLabel}>{label}</Text>
          <Text style={styles.operatorValue}>{processText(value, 220, 4)}</Text>
        </View>
      ))}
    </View>
  );
};

const FindingsCard = ({ findingsByCategory }) => {
  if (findingsByCategory.length === 0) return null;
  let index = 0;
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Analysis findings</Text>
      {findingsByCategory.map((group) => (
        <View key={group.category} style={{ marginBottom: 4 }}>
          {group.items.map((item, itemIndex) => {
            index += 1;
            return (
              <View key={itemIndex} wrap={false}>
                {itemIndex === 0 ? <Text style={styles.subLabel}>{processText(group.category, 60)}</Text> : null}
                <View style={styles.findingRow}>
                <Text style={styles.findingIndex}>{index}</Text>
                <View style={styles.findingBody}>
                  {item.source ? (
                    <View style={styles.findingTagRow}>
                      <Text style={styles.findingSource}>{processText(item.source, 40)}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.findingText}>{item.finding}</Text>
                  {(item.references || []).some((reference) => reference.status === 'missing_manifest') ? <Text style={styles.noteText}>Unresolved analysis references: {(item.references || []).filter((reference) => reference.status === 'missing_manifest').map((reference) => reference.id).join(', ')} (original source map unavailable)</Text> : null}
                  {(item.references || []).filter((reference) => reference.status !== 'missing_manifest').map((reference, referenceIndex) => (
                    <Text key={referenceIndex} style={styles.noteText}>
                      {reference.label || 'Source reference'} · {({ matched: 'source identified', source_removed: 'source no longer available', ambiguous: 'source identity ambiguous', unknown_reference: 'source reference unknown', missing_manifest: 'run manifest unavailable' })[reference.status] || 'source status unavailable'}{reference.observed === true ? ' · recorded as observed in run' : reference.observed === false ? ' · not observed in run' : ''}
                    </Text>
                  ))}
                </View>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const TakedownTargetsCard = ({ targets }) => {
  if (targets.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Analysis targets · verify before action</Text>
      {targets.map((target) => (
        <View key={target.label} style={styles.targetRow}>
          <Text style={styles.targetLabel}>{target.label}</Text>
          {target.items.map((item, index) => (
            <Text key={index} style={styles.targetItem}>
              • {processText(item, 120)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
};

const AnalysisPage = ({ app, caseNumber, project }) => {
  const analysis = buildAppAnalysisModel(app, project);
  const review = buildAppReviewModel(app, project);
  if (!analysis.hasAnalysis && !review.hasSignal && !review.caseSummary && !review.legalFindings.length && !Object.values(review.sources).includes('review')) return null;

  const reviewedAt = app.reviewed_at ? formatDateTime(app.reviewed_at) : '';

  return (
    <Page size="A4" style={styles.page}>
      <Header app={app} />

      <View style={styles.sectionHeading} wrap={false}>
        <Text id={`case-${caseNumber}-assessment`} style={styles.sectionHeadingText}>
          3. Assessment &amp; Supporting Evidence
        </Text>
        <Text style={styles.sectionHeadingMeta}>
          {analysis.findings.length > 0 ? `${analysis.findings.length} finding(s)` : ''}
          {reviewedAt ? `${analysis.findings.length > 0 ? ' · ' : ''}Reviewed ${reviewedAt}` : ''}
        </Text>
      </View>

      {review.caseSummary ? <View style={styles.card}>
        <Text style={styles.cardLabel}>Case Summary · {provenanceLabel(review.sources.summary)}</Text>
        <Text style={styles.bodyText}>{review.caseSummary}</Text>
      </View> : null}
      {analysis.threatTypes.length ? <View style={styles.card}>
        <Text style={styles.cardLabel}>Violations · {provenanceLabel(review.sources.violations)}</Text>
        <View style={styles.pillRow}>
          {analysis.threatTypes.map((violation) => <View key={violation.name} style={styles.pill}>
            <Text style={styles.pillText}>{violation.name}</Text>
          </View>)}
        </View>
      </View> : null}
      {review.legalFindings.length ? <View style={styles.card}>
        <Text style={styles.cardLabel}>Legal Violations · {provenanceLabel(review.sources.legal_codes)}</Text>
        {review.legalFindings.map((item, index) => <View key={index} style={styles.legalShell} wrap={false}>
          <View style={styles.legalAccent} />
          <View style={styles.legalInner}>
            <Text style={styles.legalCode}>{item.code}</Text>
            {item.reasoning ? <Text style={styles.legalReason}>{item.reasoning}</Text> : null}
          </View>
        </View>)}
      </View> : null}
      {analysis.detailedReasoning || analysis.reviewerComments ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Detailed Reasoning · {provenanceLabel(review.sources.reasoning)}</Text>
          {analysis.detailedReasoning ? <Text style={styles.bodyText}>{analysis.detailedReasoning}</Text> : null}
          {analysis.reviewerComments ? (
            <View style={{ marginTop: 6 }}>
              <Text style={styles.subLabel}>Reviewer Comments</Text>
              <Text style={styles.bodyText}>{analysis.reviewerComments}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {review.sources.reasoning === 'review' && !analysis.detailedReasoning ? <Text style={styles.noteText}>Reviewer reasoning: not recorded.</Text> : null}
      {review.sources.violations === 'review' && !analysis.threatTypes.length ? <Text style={styles.noteText}>Reviewer violations: none recorded.</Text> : null}
      {review.sources.legal_codes === 'review' && !review.legalFindings.length ? <Text style={styles.noteText}>Reviewer legal findings: none recorded.</Text> : null}
      {(review.sources.summary === 'review' && analysis.aiSummary || review.sources.reasoning === 'review' && analysis.aiReasoning || review.sources.violations === 'review' && analysis.aiThreatTypes.length || review.sources.legal_codes === 'review' && analysis.aiLegalCodes.length || review.sources.recommended_action === 'review' && analysis.aiRecommendedAction) ? <View style={styles.card}>
        <Text style={styles.cardLabel}>Separate AI Analysis</Text>
        {review.sources.summary === 'review' && analysis.aiSummary ? <Text style={styles.bodyText}>AI case summary: {analysis.aiSummary}</Text> : null}
        {review.sources.reasoning === 'review' && analysis.aiReasoning ? <Text style={styles.bodyText}>AI reasoning: {analysis.aiReasoning}</Text> : null}
        {review.sources.violations === 'review' && analysis.aiThreatTypes.length ? <Text style={styles.bodyText}>AI violations: {analysis.aiThreatTypes.join(', ')}</Text> : null}
        {review.sources.legal_codes === 'review' && analysis.aiLegalCodes.length ? <Text style={styles.bodyText}>AI legal findings: {analysis.aiLegalCodes.map((item) => typeof item === 'string' ? item : item.code || item.name || '').filter(Boolean).join(', ')}</Text> : null}
        {review.sources.recommended_action === 'review' && analysis.aiRecommendedAction ? <Text style={styles.bodyText}>AI recommended action: {analysis.aiRecommendedAction}</Text> : null}
      </View> : null}
      <FindingsCard findingsByCategory={analysis.findingsByCategory} />
      <View style={styles.pairRow}>
        <View style={styles.pairCol}>
          <TakedownTargetsCard targets={analysis.takedownTargets} />
        </View>
        <View style={styles.pairCol}>
          {analysis.operator ? <OperatorCard operator={analysis.operator} /> : null}
        </View>
      </View>

      <SupportingEvidenceContent app={app} />
      <Footer />
    </Page>
  );
};

/* ------------------------------------------------------------------ *
 * Section 3 — evidence                                                *
 * ------------------------------------------------------------------ */

const EvidenceFieldGroup = ({ group }) => (
  <View style={{ marginBottom: 2 }}>
    <Text style={styles.subLabel}>{group.label}</Text>
    <FieldGrid items={group.items} />
  </View>
);

const MediaSubSection = ({ section, category, anchor }) => {
  const images = section.images || [];
  const rows = [];
  for (let i = 0; i < images.length; i += 2) rows.push(images.slice(i, i + 2));
  return (
    <View style={styles.card}>
      {category ? <Text id={anchor} style={styles.cardLabel} minPresenceAhead={290}>{category} · Evidence category</Text> : null}
      <Text style={styles.evidenceTitle} minPresenceAhead={270}>{section.title || 'Evidence'}</Text>
      {section.description ? <Text style={styles.evidenceText}>{section.description}</Text> : null}
      {rows.map((row, rowIndex) => <View key={rowIndex} style={{ flexDirection: 'row', gap: 8, marginTop: 7 }} wrap={false}>
        {row.map((image, index) => <View key={image.slot || index} style={{ width: '49%' }}>
          {image.localPath ? <Image style={{ width: '100%', height: 240, objectFit: 'contain', backgroundColor: Theme.SURFACE_ALT }} src={image.localPath} /> :
            <Text style={styles.softText}>Image unavailable in this export.</Text>}
          <Text style={styles.noteText}>{image.filename || image.label || `Image ${rowIndex * 2 + index + 1}`}</Text>
        </View>)}
      </View>)}
      {section.totalImages > images.length ? <Text style={styles.noteText}>Additional recorded images are unavailable in this export.</Text> : null}
    </View>
  );
};

const OtherSubSection = ({ section }) => (
  <View style={styles.card} wrap={false}>
    {section.title ? <Text style={styles.evidenceTitle}>{processText(section.title, 90)}</Text> : null}
    <Text style={styles.evidenceText}>{section.description}</Text>
  </View>
);

const EvidencePage = ({ app, caseNumber }) => {
  const evidence = buildAppEvidenceModel(app);
  const proofGroups = buildAppProofCards(app);
  const proofKeys = new Set(proofGroups.flatMap((card) => card.sources.map((source) => source.key)));
  const otherSections = evidence.media.filter((section) => !proofKeys.has(section.key));

  return (
    <Page size="A4" style={styles.page}>
      <Header app={app} />

      <View style={styles.sectionHeading} wrap={false}>
        <Text style={styles.sectionHeadingText}>2. Evidence</Text>
        <Text style={styles.sectionHeadingMeta}>
          {evidence.totalImages > 0 ? `${evidence.totalImages} captured image(s)` : 'No captures'}
        </Text>
      </View>

      {proofGroups.map((card, groupIndex) => {
        const keys = new Set(card.sources.map((source) => source.key));
        const sections = evidence.media.filter((section) => keys.has(section.key));
        return <View key={card.key} break={groupIndex > 0}>
          {sections.length ? sections.map((section, index) => <MediaSubSection key={index} section={section} category={index === 0 ? card.title : null} anchor={index === 0 ? `case-${caseNumber}-evidence-${card.key}` : undefined} />) :
            <Text style={styles.softText}>No prepared images in this category.</Text>}
        </View>;
      })}
      <Footer />
    </Page>
  );
};

const SupportingEvidenceContent = ({ app }) => {
  const evidence = buildAppEvidenceModel(app);
  const proofKeys = new Set(buildAppProofCards(app).flatMap((card) => card.sources.map((source) => source.key)));
  const otherSections = evidence.media.filter((section) => !proofKeys.has(section.key));
  return (<View break>
    <View style={[styles.sectionHeading, { marginTop: 13 }]} wrap={false}><Text style={[styles.sectionHeadingText, { fontSize: 10 }]}>Source record &amp; captured fields</Text></View>
      {evidence.lead.map((section, index) => (
        <View key={`lead-${index}`} style={styles.card}>
          <Text style={styles.cardLabel} minPresenceAhead={100}>Captured investigation summary</Text>
          <Text style={styles.bodyText}>{section.description}</Text>
        </View>
      ))}

      {evidence.fieldsByGroup.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Captured fields · evidence record</Text>
          {evidence.fieldsByGroup.map((group) => (
            <EvidenceFieldGroup key={group.id} group={group} />
          ))}
        </View>
      ) : null}

      {otherSections.map((section, index) => <MediaSubSection key={`media-${index}`} section={section} />)}

      {(app.evidence?.sections || []).map((section, index) => {
        const otherMedia = (section.media || []).filter((item, mediaIndex) => item && !(section.images || []).some((image) => image.slot === `${index}:${mediaIndex}` && image.localPath));
        if (!otherMedia.length && ((section.images || []).length || section.description)) return null;
        return <View key={`media-record-${index}`} style={styles.card}>
          <Text style={styles.evidenceTitle}>{section.title || 'Evidence media'} · Media record</Text>
          {!otherMedia.length ? <Text style={styles.softText}>No description or media available in this section.</Text> : null}
          {otherMedia.map((item, mediaIndex) => <Text key={mediaIndex} style={styles.bodyText}>
            {item.filename || item.label || item.type || `Media ${mediaIndex + 1}`} · {item.localPath ? 'Prepared attachment' : 'Recorded attachment; preview unavailable'}
          </Text>)}
        </View>;
      })}
      {evidence.other.map((section, index) => (
        <OtherSubSection key={`other-${index}`} section={section} />
      ))}

      {(app.compressedScreenshots || []).length ? <View style={styles.card}>
        <Text style={styles.cardLabel} minPresenceAhead={220}>Store listing screenshots</Text>
        <Text style={styles.softText}>Store listing media; not labelled as operational proof.</Text>
        {Array.from({ length: Math.ceil(app.compressedScreenshots.length / 2) }, (_, rowIndex) => <View key={rowIndex} style={{ flexDirection: 'row', gap: 8, marginTop: 6 }} wrap={false}>
          {app.compressedScreenshots.slice(rowIndex * 2, rowIndex * 2 + 2).map((src, index) => src ? <View key={index} style={{ width: '49%' }}>
            <Image style={{ width: '100%', height: 200, objectFit: 'contain', backgroundColor: Theme.SURFACE_ALT }} src={src} />
            <Text style={styles.noteText}>Store screenshot {rowIndex * 2 + index + 1}</Text>
          </View> : null)}
        </View>)}
        {app.total_screenshots > app.compressedScreenshots.length ? <Text style={styles.noteText}>Additional store screenshots were recorded but are unavailable in this export.</Text> : null}
      </View> : null}
    </View>
  );
};

export const AppsDetailedReportDocument = ({ apps: appsProp, posts, project }) => {
  const apps = appsProp || posts || [];
  return (
    <Document>
      {apps.map((app, index) => (
        <React.Fragment key={app._id}>
          <AppCaseOverviewPage app={app} caseNumber={index + 1} project={project} />
          <EvidencePage app={app} caseNumber={index + 1} />
          <AnalysisPage app={app} caseNumber={index + 1} project={project} />
          <InfoPage app={app} caseNumber={index + 1} project={project} />
        </React.Fragment>
      ))}
    </Document>
  );
};

export const AppsDetailed = AppsDetailedReportDocument;
export default AppsDetailedReportDocument;
