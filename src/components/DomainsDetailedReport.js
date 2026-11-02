import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Link } from '@react-pdf/renderer';
import { registerFonts } from './utils/FontRegister';
import {
  DomainTheme as Theme,
  processText,
  formatDateTime,
  domainLanderCaption,
  domainAdsCount,
  domainHostingCountry,
  domainVisitUrl,
  otherLanderVisitUrls,
  domainPageContent,
  reportDomains,
  buildDomainReviewModel,
  domainSeverityInfo,
} from './domainPdfShared';

registerFonts();

const SLICE_PAGE_SIZE = 12;
const SLICE_COLS = 3;
const SLICE_ROWS = 4; // fill column top→bottom, then next column (still 12/page)
const HERO_FRAME_HEIGHT = 150;
const HERO_PAD = 8;
// Fits 4 rows on A4 with caption/footer; cover-fit removes letterboxing inside cells
const SLICE_CELL_HEIGHT = 186;
const SLICE_PAD = 2;

const MAX_REVIEW_VIOLATIONS = 10;
const MAX_REVIEW_LEGAL_CODES = 4;

const styles = StyleSheet.create({
  page: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 26,
    fontFamily: ['Outfit', 'Mukta'],
    backgroundColor: Theme.SURFACE,
    color: Theme.INK,
  },
  galleryPage: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 28,
    fontFamily: ['Outfit', 'Mukta'],
    backgroundColor: Theme.SURFACE,
  },

  /* ---- fixed chrome ---- */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 0.5,
    borderBottomColor: Theme.LINE,
    paddingBottom: 5,
    marginBottom: 6,
  },
  brandTitle: { fontSize: 15, fontWeight: 900, color: Theme.INK, letterSpacing: 0.3 },
  brandSubtitle: { fontSize: 6.5, color: Theme.MUTED, textTransform: 'uppercase', letterSpacing: 1.3 },
  headerRight: { alignItems: 'flex-end', maxWidth: '55%' },
  headerTitle: { fontSize: 8, fontWeight: 700, color: Theme.INK },
  headerMeta: { fontSize: 6.5, color: Theme.MUTED, marginTop: 1 },

  /* ---- headings ---- */
  hookHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 5,
  },
  hookTitle: { fontSize: 16, fontWeight: 700, color: Theme.INK, flex: 1, lineHeight: 1.2 },
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

  /* ---- columns ---- */
  columns: { flexDirection: 'row', gap: 10 },
  leftCol: { width: '57%' },
  rightCol: { width: '43%' },

  /* ---- cards ---- */
  card: {
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    borderRadius: 6,
    padding: 7,
    marginBottom: 4,
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
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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

  /* ---- risk badge ---- */
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 0.5,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  riskText: { fontSize: 7.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.7 },

  /* ---- key/value grid ---- */
  kvGrid: { flexDirection: 'row', gap: 12 },
  kvCol: { flex: 1 },
  kvItem: { marginBottom: 4 },
  kvLabel: {
    fontSize: 6,
    color: Theme.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  kvValue: { fontSize: 8, color: Theme.INK, fontWeight: 700, lineHeight: 1.3 },
  kvLink: { fontSize: 7.5, color: Theme.LINK, fontWeight: 700, textDecoration: 'none', lineHeight: 1.3 },

  /* ---- risk hero ---- */
  riskHero: {
    borderWidth: 0.5,
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  riskHeroValue: {
    fontSize: 19,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    lineHeight: 1.1,
  },

  /* ---- pills ---- */
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 2 },
  pill: { borderWidth: 0.5, borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2 },
  pillText: { fontSize: 7, fontWeight: 700, textTransform: 'capitalize' },

  /* ---- legal cards ---- */
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
  legalInner: { flex: 1, paddingVertical: 2, paddingHorizontal: 7 },
  legalCode: { fontSize: 7, fontWeight: 900, color: Theme.RISK_HIGH, marginBottom: 1 },
  legalReason: { fontSize: 6.5, color: Theme.INK_SOFT, lineHeight: 1.3 },

  /* ---- review columns ---- */
  reviewColumns: { flexDirection: 'row', alignItems: 'flex-start' },
  reviewMain: { flex: 1, paddingRight: 12 },
  reviewLegal: { width: '44%', borderLeftWidth: 0.5, borderLeftColor: Theme.LINE, paddingLeft: 12 },

  /* ---- prose ---- */
  caseSummaryText: { fontSize: 9.5, color: Theme.INK, lineHeight: 1.4 },
  bodyText: { fontSize: 8, color: Theme.INK_SOFT, lineHeight: 1.4 },
  softText: { fontSize: 8, color: Theme.MUTED, lineHeight: 1.4 },
  contentTitle: { fontSize: 9, fontWeight: 700, color: Theme.INK, marginBottom: 4, lineHeight: 1.3 },
  contentMeta: { fontSize: 7.5, color: Theme.INK_SOFT, lineHeight: 1.35, marginBottom: 3 },
  headingItem: { fontSize: 7, color: Theme.MUTED, lineHeight: 1.3, marginBottom: 1 },

  /* ---- lander evidence ---- */
  evidenceRow: { flexDirection: 'row', gap: 8 },
  evidenceLeft: { width: '46%' },
  evidenceRight: { width: '54%', minHeight: HERO_FRAME_HEIGHT },
  heroFrame: {
    width: '100%',
    height: HERO_FRAME_HEIGHT,
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    overflow: 'hidden',
    backgroundColor: Theme.SURFACE_ALT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: HERO_FRAME_HEIGHT - HERO_PAD * 2,
  },
  heroGutter: { width: HERO_PAD, height: HERO_PAD },
  heroWell: {
    flexGrow: 1,
    flexShrink: 1,
    height: HERO_FRAME_HEIGHT - HERO_PAD * 2,
  },
  hero: {
    width: '100%',
    height: HERO_FRAME_HEIGHT - HERO_PAD * 2,
    objectFit: 'contain',
    objectPosition: 'top',
  },
  heroPlaceholder: {
    width: '100%',
    height: HERO_FRAME_HEIGHT,
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    backgroundColor: Theme.SURFACE_ALT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ---- ads chip ---- */
  adsChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    backgroundColor: Theme.SURFACE_ALT,
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  adsChipLabel: {
    fontSize: 7,
    fontWeight: 900,
    color: Theme.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  adsChipValue: { fontSize: 11, fontWeight: 700, color: Theme.INK },

  /* ---- other landers ---- */
  otherList: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  otherChip: { width: '48%' },
  otherLink: { fontSize: 7, color: Theme.LINK, textDecoration: 'none', fontWeight: 600 },

  /* ---- gallery ---- */
  sliceGrid: { flexDirection: 'row', gap: 5, alignItems: 'flex-start' },
  sliceCol: { width: '32.5%', flexDirection: 'column', gap: 3 },
  sliceCell: {
    width: '100%',
    height: SLICE_CELL_HEIGHT,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    backgroundColor: Theme.SURFACE_ALT,
    overflow: 'hidden',
    position: 'relative',
  },
  sliceWellRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sliceWell: {
    width: '100%',
    height: '100%',
  },
  sliceImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'top',
  },
  sliceBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    minWidth: 16,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: Theme.SURFACE_ALT,
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    alignItems: 'center',
  },
  sliceBadgeText: { fontSize: 8, fontWeight: 400, color: Theme.INK },
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
  footerText: { textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 'bold' },
});

const Header = ({ domain }) => (
  <View style={styles.header} fixed>
    <View>
      <Text style={styles.brandTitle}>Overwatch</Text>
      <Text style={styles.brandSubtitle}>Domain Integrity</Text>
    </View>
    <View style={styles.headerRight}>
      <Text style={styles.headerTitle}>{processText(domain?.domain_name || 'Unknown domain', 46)}</Text>
      <Text style={styles.headerMeta}>{domainLanderCaption(domain)}</Text>
    </View>
  </View>
);

const PageFooter = () => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerText}>Confidential Document</Text>
    <Text style={styles.footerText}>Powered by Contrails AI</Text>
    <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
  </View>
);

const RiskBadge = ({ risk }) => (
  <View style={[styles.riskBadge, { backgroundColor: risk.bg, borderColor: risk.border }]}>
    <Text style={[styles.riskText, { color: risk.color }]}>{risk.label}</Text>
  </View>
);

const Kv = ({ label, children }) => (
  <View style={styles.kvItem}>
    <Text style={styles.kvLabel}>{label}</Text>
    {children}
  </View>
);

const kvText = (value, max = 42) => (value == null || value === '' ? '—' : processText(String(value), max));

const categoryLabel = (category) => {
  const text = String(category || '').trim();
  if (!text || text.toLowerCase() === 'unknown') return '—';
  return text.replace(/[-_]/g, ' ');
};

const ViolationPill = ({ name, severity }) => {
  const tone = domainSeverityInfo(severity);
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.pillText, { color: tone.color }]}>{processText(name, 30)}</Text>
    </View>
  );
};

const DetailColumn = ({ rows }) => (
  <View style={styles.kvCol}>
    {rows.map(([label, value, max]) => (
      <Kv key={label} label={label}>
        {label === 'Visit URL' && value ? (
          <Link src={value} style={styles.kvLink} target="_blank">
            {processText(value, 52)}
          </Link>
        ) : (
          <Text style={styles.kvValue}>{kvText(value, max ?? 44)}</Text>
        )}
      </Kv>
    ))}
  </View>
);

const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/* ------------------------------------------------------------------ *
 * Page 1 — domain details + risk + review, on one sheet
 * ------------------------------------------------------------------ */

const DomainDetailsCard = ({ domain, whois, nameservers, review }) => {
  const rows = [
    ['Lander', domainLanderCaption(domain)],
    ['Visit URL', domainVisitUrl(domain)],
    ['Registrar', whois.registrar || domain.list?.registrar, 64],
    ['Created', formatDateTime(whois.created_at)],
    ['Expires', formatDateTime(whois.expires_at)],
    ['Privacy', whois.privacy_protected ? 'Protected' : 'No'],
    ['Nameservers', nameservers.join(', '), 64],
  ];
  // Only show Category when there is a real value behind it.
  const category = categoryLabel(review.category);
  if (category !== '—') rows.push(['Category', category]);
  const half = Math.ceil(rows.length / 2);

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Domain Details</Text>
      <View style={styles.kvGrid}>
        <DetailColumn rows={rows.slice(0, half)} />
        <DetailColumn rows={rows.slice(half)} />
      </View>
    </View>
  );
};

const RiskAssessmentCard = ({ review }) => (
  <View style={styles.card}>
    <View style={styles.cardHead}>
      <Text style={[styles.cardLabel, { marginBottom: 0 }]}>Risk Assessment</Text>
      <RiskBadge risk={review.risk} />
    </View>
    <View
      style={[
        styles.riskHero,
        { backgroundColor: review.risk.bg, borderColor: review.risk.border, borderLeftColor: review.risk.color },
      ]}
      wrap={false}
    >
      <Text style={[styles.riskHeroValue, { color: review.risk.color }]}>{review.risk.label}</Text>
    </View>
  </View>
);

const LanderEvidenceCard = ({ compressedImage, pageContent, hasPageContent }) => (
  <View style={styles.card}>
    <Text style={styles.cardLabel}>Lander Evidence</Text>
    <View style={styles.evidenceRow}>
      <View style={styles.evidenceLeft}>
        {compressedImage ? (
          <View style={styles.heroFrame}>
            <View style={styles.heroWellRow}>
              <View style={styles.heroGutter} />
              <View style={styles.heroWell}>
                <Image style={styles.hero} src={compressedImage} />
              </View>
              <View style={styles.heroGutter} />
            </View>
          </View>
        ) : (
          <View style={styles.heroPlaceholder}>
            <Text style={{ fontSize: 8, color: Theme.MUTED }}>No lander screenshot</Text>
          </View>
        )}
      </View>

      <View style={styles.evidenceRight}>
        <Text style={[styles.subLabel, { marginTop: 0 }]}>Page Content</Text>
        {hasPageContent ? (
          <>
            {pageContent.title ? (
              <Text style={styles.contentTitle}>{processText(pageContent.title, 160)}</Text>
            ) : null}
            {pageContent.description ? (
              <Text style={styles.contentMeta}>{processText(pageContent.description, 220)}</Text>
            ) : null}
            {pageContent.excerpt ? (
              <Text style={styles.bodyText}>{processText(pageContent.excerpt, 220)}</Text>
            ) : null}
            {pageContent.headings.slice(0, 3).map((heading, idx) => (
              <Text key={idx} style={styles.headingItem}>
                · {processText(heading, 70)}
              </Text>
            ))}
          </>
        ) : (
          <Text style={styles.softText}>No captured page title or description.</Text>
        )}
      </View>
    </View>
  </View>
);

const ReviewDetailsCard = ({ review }) => (
  <View style={styles.card}>
    <View style={styles.cardHead}>
      <Text style={[styles.cardLabel, { marginBottom: 0 }]}>Review Details</Text>
      <RiskBadge risk={review.risk} />
    </View>

    <View style={styles.reviewColumns}>
      <View style={styles.reviewMain}>
        <Text style={[styles.subLabel, { marginTop: 0 }]}>Case Summary</Text>
        {review.caseSummary ? (
          <Text style={styles.caseSummaryText}>{processText(review.caseSummary, 320, 4)}</Text>
        ) : (
          <Text style={styles.softText}>No reviewer summary recorded for this domain.</Text>
        )}

        {review.violations.length > 0 ? (
          <View style={{ marginTop: 7 }}>
            <Text style={styles.subLabel}>Detected Violations</Text>
            <View style={styles.pillRow}>
              {review.violations.slice(0, MAX_REVIEW_VIOLATIONS).map((violation) => (
                <ViolationPill
                  key={violation.name}
                  name={violation.name}
                  severity={violation.severity}
                />
              ))}
            </View>
          </View>
        ) : null}

        {review.reviewerComments ? (
          <View style={{ marginTop: 7 }}>
            <Text style={styles.subLabel}>Reviewer Comments</Text>
            <Text style={styles.bodyText}>{processText(review.reviewerComments, 260, 4)}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.reviewLegal}>
        <Text style={[styles.subLabel, { marginTop: 0 }]}>Legal Violations</Text>
        {review.legalCodes.length > 0 ? (
          review.legalCodes.slice(0, MAX_REVIEW_LEGAL_CODES).map((item, index) => (
            <View key={index} style={styles.legalShell} wrap={false}>
              <View style={styles.legalAccent} />
              <View style={styles.legalInner}>
                <Text style={styles.legalCode}>{processText(item.code, 90)}</Text>
                {item.reasoning ? (
                  <Text style={styles.legalReason}>{processText(item.reasoning, 180, 2)}</Text>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.softText}>No legal findings recorded.</Text>
        )}
        {review.legalCodes.length > MAX_REVIEW_LEGAL_CODES ? (
          <Text style={styles.softText}>
            + {review.legalCodes.length - MAX_REVIEW_LEGAL_CODES} more recorded
          </Text>
        ) : null}
      </View>
    </View>
  </View>
);

const InfrastructureCard = ({ domain, hosting, ssl, redirects, aRecords, adsCount }) => (
  <View style={styles.card}>
    <View style={styles.cardHead}>
      <Text style={[styles.cardLabel, { marginBottom: 0 }]}>Infrastructure</Text>
      {adsCount > 0 ? (
        <View style={styles.adsChip}>
          <Text style={styles.adsChipLabel}>Linked Ads</Text>
          <Text style={styles.adsChipValue}>{adsCount.toLocaleString()}</Text>
        </View>
      ) : null}
    </View>
    <View style={styles.kvGrid}>
      <DetailColumn
        rows={[
          ['Hosting', hosting.provider || domain.list?.hosting_provider, 64],
          ['Country', domainHostingCountry(domain)],
          ['IP / ASN', [hosting.ip, hosting.asn].filter(Boolean).join(' · ')],
          ['DNS A', aRecords.join(', '), 64],
        ]}
      />
      <DetailColumn
        rows={[
          [
            'Redirects',
            redirects.length ? redirects.map((hop) => hop.url || hop.status_code || hop).join(' → ') : '',
            64,
          ],
          ['SSL Issuer', ssl.issuer, 64],
          ['SSL Valid To', formatDateTime(ssl.valid_to)],
          ['SSL Valid', ssl.is_valid === true ? 'Yes' : ssl.is_valid === false ? 'No' : ''],
        ]}
      />
    </View>
  </View>
);

const OtherLandersCard = ({ otherLanders }) => (
  <View style={[styles.card, { marginBottom: 0 }]} wrap={false}>
    <Text style={[styles.cardLabel, { marginBottom: 4 }]}>Other Landers</Text>
    <View style={styles.otherList}>
      {otherLanders.map((item, idx) => (
        <Link
          key={`${item.url}-${idx}`}
          src={item.url}
          style={[styles.otherLink, styles.otherChip]}
          target="_blank"
        >
          {processText(item.url, 52)}
        </Link>
      ))}
    </View>
  </View>
);

const DomainDossierPage = ({ domain, compressedImage, caseNumber, project }) => {
  const analysis = domain.analysis_results || {};
  const whois = analysis.whois || {};
  const hosting = analysis.hosting || {};
  const ssl = analysis.ssl || {};
  const dns = analysis.dns || {};
  const review = buildDomainReviewModel(domain, project);
  const pageContent = domainPageContent(domain);
  const otherLanders = otherLanderVisitUrls(domain);
  const redirects = Array.isArray(analysis.redirect_chain) ? analysis.redirect_chain.slice(0, 5) : [];
  const nameservers = (dns.nameservers || dns.ns || whois.name_servers || []).slice(0, 3);
  const aRecords = (dns.a || []).slice(0, 3);
  const hasOtherLanders = otherLanders.length > 0;
  const hasPageContent = Boolean(
    pageContent.title || pageContent.description || pageContent.excerpt || pageContent.headings.length,
  );
  const adsCount = domainAdsCount(domain);

  return (
    <Page size="A4" style={styles.page}>
      <Header domain={domain} />

      <View style={styles.hookHeading} wrap={false}>
        <Text style={styles.hookTitle}>
          {caseNumber}. {processText(domain.domain_name || 'Unknown domain', 56)}
        </Text>
      </View>

      <View style={styles.columns} wrap={false}>
        <View style={styles.leftCol}>
          <DomainDetailsCard domain={domain} whois={whois} nameservers={nameservers} review={review} />
        </View>
        <View style={styles.rightCol}>
          <RiskAssessmentCard review={review} />
        </View>
      </View>

      <LanderEvidenceCard
        compressedImage={compressedImage}
        pageContent={pageContent}
        hasPageContent={hasPageContent}
      />

      <ReviewDetailsCard review={review} />

      <InfrastructureCard
        domain={domain}
        hosting={hosting}
        ssl={ssl}
        redirects={redirects}
        aRecords={aRecords}
        adsCount={adsCount}
      />

      {hasOtherLanders ? <OtherLandersCard otherLanders={otherLanders} /> : null}

      <PageFooter />
    </Page>
  );
};

const DomainCaptureGalleryPages = ({ domain, screenshotSlices }) => {
  const images = (screenshotSlices || []).filter(Boolean);
  if (images.length === 0) return null;

  return chunk(images, SLICE_PAGE_SIZE).map((pageImages, pageIdx) => (
    <Page key={`${domain._id || 'domain'}-slices-${pageIdx}`} size="A4" style={styles.galleryPage}>
      <Header domain={domain} />
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionHeadingText}>Website Capture</Text>
        <Text style={styles.sectionHeadingMeta}>
          {images.length} capture{images.length === 1 ? '' : 's'}
          {images.length > SLICE_PAGE_SIZE
            ? ` · ${pageIdx + 1} of ${Math.ceil(images.length / SLICE_PAGE_SIZE)}`
            : ''}
        </Text>
      </View>
      <View style={styles.sliceGrid} wrap={false}>
        {Array.from({ length: SLICE_COLS }, (_, colIdx) => {
          const colImages = pageImages.slice(colIdx * SLICE_ROWS, (colIdx + 1) * SLICE_ROWS);
          if (colImages.length === 0) return null;
          return (
            <View key={colIdx} style={styles.sliceCol}>
              {colImages.map((src, rowIdx) => {
                const number = pageIdx * SLICE_PAGE_SIZE + colIdx * SLICE_ROWS + rowIdx + 1;
                return (
                  <View key={rowIdx} style={styles.sliceCell}>
                    <View style={styles.sliceWellRow}>
                      <View style={styles.sliceWell}>
                        <Image style={styles.sliceImage} src={src} />
                      </View>
                    </View>
                    <View style={styles.sliceBadge}>
                      <Text style={styles.sliceBadgeText}>{number}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
      <PageFooter />
    </Page>
  ));
};

export { DomainCaptureGalleryPages };

export const DomainDetailedBlock = ({ domain, compressedImage, screenshotSlices, caseNumber, project }) => (
  <>
    <DomainDossierPage
      domain={domain}
      compressedImage={compressedImage}
      caseNumber={caseNumber}
      project={project}
    />
    <DomainCaptureGalleryPages domain={domain} screenshotSlices={screenshotSlices} />
  </>
);

export const DomainsDetailedReportDocument = (props) => {
  const domains = reportDomains(props);
  const compressedImages = props.compressedImages;
  const screenshotSlices = props.screenshotSlices || props.compressedMediaImages;

  return (
    <Document title="Domains_Detailed_Report">
      {domains.map((domain, index) => (
        <DomainDetailedBlock
          key={domain._id || index}
          domain={domain}
          compressedImage={compressedImages?.[index]}
          screenshotSlices={screenshotSlices?.[index] || []}
          caseNumber={index + 1}
          project={props.project}
        />
      ))}
    </Document>
  );
};

export const DetailedDomainsReportDocument = DomainsDetailedReportDocument;
export const SingleDomainDocument = ({ domain, post, compressedImage, screenshotSlices, compressedMediaImages, project }) => (
  <DomainsDetailedReportDocument
    domains={[domain || post].filter(Boolean)}
    compressedImages={[compressedImage]}
    screenshotSlices={[screenshotSlices || compressedMediaImages || []]}
    project={project}
  />
);

export default DomainsDetailedReportDocument;
