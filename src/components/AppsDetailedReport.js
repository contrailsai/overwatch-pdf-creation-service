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
  buildAppEvidenceModel,
  buildEvidenceFieldRows,
  flattenKeyValues,
} from './appPdfShared';

registerFonts();

/** Page-1 hook caps keep the first page to a single sheet. */
const MAX_HOOK_SHOTS = 6;
const MAX_HOOK_LEGAL_CODES = 3;
const MAX_HOOK_VIOLATIONS = 8;
/** Section caps keep the whole dossier inside ~4 pages. */
const MAX_MEDIA_IMAGES_PER_SECTION = 6;
const MAX_OTHER_SECTIONS = 6;

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
  sectionHeadingMeta: { fontSize: 6.5, color: Theme.MUTED },
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
  leftCol: { width: '57%' },
  rightCol: { width: '43%' },
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
    fontSize: 8,
    fontWeight: 900,
    color: Theme.PRIMARY_BLUE,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  subLabel: {
    fontSize: 6.5,
    fontWeight: 900,
    color: Theme.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.55,
    marginTop: 5,
    marginBottom: 2,
  },
  /* ---- key/value ---- */
  kvGridRow: { flexDirection: 'row', gap: 12, marginBottom: 5 },
  kvHalf: { flex: 1 },
  kvFull: { width: '100%' },
  pairRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  pairCol: { width: '50%' },
  kvLabel: {
    fontSize: 6,
    color: Theme.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  kvValue: { fontSize: 8, color: Theme.INK, fontWeight: 700, lineHeight: 1.3 },
  kvValueSoft: { fontSize: 8, color: Theme.INK_SOFT, lineHeight: 1.3 },
  kvLink: { fontSize: 7.5, color: Theme.LINK, fontWeight: 700, textDecoration: 'none', lineHeight: 1.3 },
  divider: { height: 0.5, backgroundColor: Theme.LINE, marginVertical: 6 },
  /* ---- risk / violations ---- */
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 0.5,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  riskText: { fontSize: 7.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.7 },
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
  /* ---- prose ---- */
  leadText: { fontSize: 11, color: Theme.INK, lineHeight: 1.3 },
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
  mediaImage: { width: '100%', height: '100%', objectFit: 'contain' },
  evidenceTitle: { fontSize: 9.5, fontWeight: 700, color: Theme.INK, marginBottom: 3, lineHeight: 1.3 },
  evidenceText: { fontSize: 7.5, color: Theme.INK_SOFT, lineHeight: 1.38 },
});

const displayValue = (value, max = 60) => {
  const text = value == null ? '' : String(value).trim();
  if (!text) return '—';
  return processText(text, max) || text;
};

const hasLabelledReasoning = (review) =>
  review.reasoningSections.length > 1 ||
  Boolean(review.reasoningSections[0] && review.reasoningSections[0].label);

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

const RiskBadge = ({ risk }) => (
  <View style={[styles.riskBadge, { backgroundColor: risk.bg, borderColor: risk.border }]}>
    <Text style={[styles.riskText, { color: risk.color }]}>{risk.label}</Text>
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
              <Text style={styles.kvValue}>{displayValue(item.value, item.width === 'full' ? 130 : 60)}</Text>
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

const AppPublisherCard = ({ app }) => {
  const store = app.store || {};
  const developer = app.developer || {};
  const risk = appRiskInfo(app);
  const appRows = [
    ['Package', app.package_id],
    ['Platform', appPlatformLabel(app)],
    ['Genre', store.genre],
    ['Content rating', store.content_rating],
    ['Installs', appInstallCountLabel(app)],
    ['Ratings', store.ratings != null ? Number(store.ratings).toLocaleString('en-IN') : null],
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
          <Text style={[styles.subLabel, { marginTop: 0 }]}>Application</Text>
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
          <Text style={[styles.subLabel, { marginTop: 0 }]}>Publisher</Text>
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

/** Review Details — case summary, violations, legal codes, reviewer comments. */
const ReviewCard = ({ review }) => (
  <View style={styles.card}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={styles.cardLabel}>Review Details</Text>
      <RiskBadge risk={review.risk} />
    </View>

    {review.caseSummary ? (
      <View style={{ marginBottom: 5 }}>
        <Text style={[styles.subLabel, { marginTop: 0 }]}>Case Summary</Text>
        <Text style={styles.leadText}>{processText(review.caseSummary, 420, 5)}</Text>
      </View>
    ) : null}

    {review.violations.length > 0 ? (
      <View style={{ marginBottom: 4 }}>
        <Text style={styles.subLabel}>Detected Violations</Text>
        <View style={styles.pillRow}>
          {review.violations.slice(0, MAX_HOOK_VIOLATIONS).map((violation) => (
            <View key={violation.name} style={styles.pill}>
              <Text style={styles.pillText}>{processText(violation.name, 26)}</Text>
            </View>
          ))}
        </View>
      </View>
    ) : null}

    {review.legalCodes.length > 0 ? (
      <View style={{ marginBottom: 2 }}>
        <Text style={styles.subLabel}>Legal Violations</Text>
        {review.legalCodes.slice(0, MAX_HOOK_LEGAL_CODES).map((item, index) => (
          <View key={index} style={styles.legalShell}>
            <View style={styles.legalAccent} />
            <View style={styles.legalInner}>
              <Text style={styles.legalCode}>{processText(item.code, 80)}</Text>
              {item.reasoning ? (
                <Text style={styles.legalReason}>{processText(item.reasoning, 160, 3)}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    ) : null}

    {review.reviewerComments ? (
      <View>
        <Text style={styles.subLabel}>Reviewer Comments</Text>
        <Text style={styles.bodyText}>{processText(review.reviewerComments, 220, 3)}</Text>
      </View>
    ) : null}

    {!review.hasSignal ? (
      <Text style={styles.softText}>
        Not yet reviewed. No threat score, violations or legal findings are attached to this app yet.
      </Text>
    ) : null}

    {review.reasoning ? (
      <View style={{ marginTop: 2 }}>
        <Text style={styles.subLabel}>Detailed Reasoning</Text>
        {hasLabelledReasoning(review) ? (
          review.reasoningSections.map((section, index) => (
            <View key={index} style={{ marginBottom: 3 }}>
              {section.label ? <Text style={styles.kvValue}>{processText(section.label, 60)}</Text> : null}
              <Text style={styles.bodyText}>{processText(section.content, 520, 6)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.bodyText}>{processText(review.reasoning, 640, 8)}</Text>
        )}
      </View>
    ) : null}
  </View>
);

function appPackageLine(app) {
  const parts = [appPlatformLabel(app), app?.store?.genre].filter(Boolean);
  return parts.join(' · ') || app?.package_id || '';
}

const GalleryColumn = ({ app }) => {
  const shots = (app.compressedScreenshots || []).slice(0, MAX_HOOK_SHOTS);
  const totalShots = app.total_screenshots || shots.length;

  return (
    <View>
      <View style={styles.iconRow}>
        <View style={styles.iconWell}>
          {app.compressedImage ? (
            <Image style={styles.iconImage} src={app.compressedImage} />
          ) : (
            <Text style={styles.iconPlaceholder}>No{'\n'}icon</Text>
          )}
        </View>
        <View style={styles.iconMeta}>
          <Text style={styles.iconMetaTitle}>{processText(app.title || 'Unknown app', 40)}</Text>
          <Text style={styles.iconMetaSub}>{processText(appPackageLine(app), 44)}</Text>
        </View>
      </View>

      {shots.length > 0 ? (
        <View style={styles.galleryGrid}>
          {shots.map((src, index) => (
            <View key={index} style={styles.galleryCell}>
              {src ? (
                <Image style={styles.galleryImage} src={src} />
              ) : (
                <View style={styles.galleryPlaceholder}>
                  <Text style={styles.galleryPlaceholderText}>Shot {index + 1}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Screenshots</Text>
          <Text style={styles.softText}>No screenshots captured.</Text>
        </View>
      )}

      {totalShots > shots.length ? (
        <Text style={styles.noteText}>+ {totalShots - shots.length} more screenshot(s) captured</Text>
      ) : null}
    </View>
  );
};

/* ------------------------------------------------------------------ *
 * Page 1 — the hook                                                   *
 * ------------------------------------------------------------------ */

const HookPage = ({ app, caseNumber, project }) => {
  const review = buildAppReviewModel(app, project);
  return (
    <Page size="A4" style={styles.page}>
      <Header app={app} />

      <View style={styles.hookHeading} wrap={false}>
        <Text style={styles.hookTitle}>
          {caseNumber}. {processText(app.title || 'Unknown app', 60)}
        </Text>
      </View>

      <View style={styles.columns}>
        <View style={styles.leftCol}>
          <AppPublisherCard app={app} />
          <ReviewCard review={{ ...review, sourcedAt: app.sourced_at }} />
        </View>
        <View style={styles.rightCol}>
          <GalleryColumn app={app} />
        </View>
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

const AnalysisCard = ({ app }) => {
  const rows = flattenKeyValues(app?.analysis_results);
  if (rows.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Automated Analysis</Text>
      {rows.map((row) => (
        <MetaRow key={row.label} label={row.label}>
          <Text style={styles.kvValueSoft}>{displayValue(row.value, 180)}</Text>
        </MetaRow>
      ))}
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
        <Text style={styles.sectionHeadingText}>{caseNumber}. App &amp; Developer</Text>
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
      <AnalysisCard app={app} />

      <Footer />
    </Page>
  );
};

/* ------------------------------------------------------------------ *
 * Section 2 — evidence                                                *
 * ------------------------------------------------------------------ */

const EvidenceFieldGroup = ({ group }) => (
  <View style={{ marginBottom: 2 }}>
    <Text style={styles.subLabel}>{group.label}</Text>
    <FieldGrid items={group.items} />
  </View>
);

const MediaSubSection = ({ section }) => {
  const images = section.images.slice(0, MAX_MEDIA_IMAGES_PER_SECTION);
  const total = section.totalImages || section.images.length;
  const cellStyle =
    images.length === 1 ? styles.mediaCellOne : images.length === 2 ? styles.mediaCellTwo : styles.mediaCellMany;

  return (
    <View style={[styles.card, styles.cardTight]} wrap={false}>
      <Text style={styles.evidenceTitle}>{processText(section.title, 90)}</Text>
      {section.description ? (
        <Text style={styles.evidenceText}>{processText(section.description, 320, 4)}</Text>
      ) : null}
      <View style={styles.mediaGrid}>
        {images.map((image, index) => (
          <View key={image.slot || index} style={[styles.mediaCell, cellStyle]}>
            <Image style={styles.mediaImage} src={image.localPath || image.url} />
          </View>
        ))}
      </View>
      {total > images.length ? (
        <Text style={styles.noteText}>+ {total - images.length} more image(s) captured</Text>
      ) : null}
    </View>
  );
};

const OtherSubSection = ({ section }) => (
  <View style={styles.card} wrap={false}>
    {section.title ? <Text style={styles.evidenceTitle}>{processText(section.title, 90)}</Text> : null}
    <Text style={styles.evidenceText}>{processText(section.description, 700, 10)}</Text>
  </View>
);

const EvidencePage = ({ app, caseNumber }) => {
  const evidence = buildAppEvidenceModel(app);
  if (!evidence.hasEvidence) return null;

  return (
    <Page size="A4" style={styles.page}>
      <Header app={app} />

      <View style={styles.sectionHeading} wrap={false}>
        <Text style={styles.sectionHeadingText}>{caseNumber}. Evidence</Text>
        <Text style={styles.sectionHeadingMeta}>
          {evidence.totalImages > 0 ? `${evidence.totalImages} captured image(s)` : 'No captures'}
        </Text>
      </View>

      {evidence.lead.map((section, index) => (
        <View key={`lead-${index}`} style={styles.card}>
          <Text style={styles.cardLabel}>Executive Summary</Text>
          <Text style={styles.bodyText}>{processText(section.description, 620, 8)}</Text>
        </View>
      ))}

      {evidence.fieldsByGroup.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Captured Fields</Text>
          {evidence.fieldsByGroup.map((group) => (
            <EvidenceFieldGroup key={group.id} group={group} />
          ))}
        </View>
      ) : null}

      {evidence.media.map((section, index) => (
        <MediaSubSection key={`media-${index}`} section={section} />
      ))}

      {evidence.other.slice(0, MAX_OTHER_SECTIONS).map((section, index) => (
        <OtherSubSection key={`other-${index}`} section={section} />
      ))}

      <Footer />
    </Page>
  );
};

export const AppsDetailedReportDocument = ({ apps: appsProp, posts, project }) => {
  const apps = appsProp || posts || [];
  return (
    <Document>
      {apps.map((app, index) => (
        <React.Fragment key={app._id}>
          <HookPage app={app} caseNumber={index + 1} project={project} />
          <InfoPage app={app} caseNumber={index + 1} project={project} />
          <EvidencePage app={app} caseNumber={index + 1} />
        </React.Fragment>
      ))}
    </Document>
  );
};

export const AppsDetailed = AppsDetailedReportDocument;
export default AppsDetailedReportDocument;
