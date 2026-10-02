import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Link } from '@react-pdf/renderer';
import { registerFonts } from './utils/FontRegister';
import {
  DomainTheme as Theme,
  processText,
  formatDateTime,
  domainRiskInfo,
  domainLanderCaption,
  domainAdsCount,
  domainHostingCountry,
  domainVisitUrl,
  collectDomainViolations,
  otherLanderVisitUrls,
  domainPageContent,
  reportDomains,
} from './domainPdfShared';

registerFonts();

const SLICE_PAGE_SIZE = 12;
const SLICE_COLS = 3;
const SLICE_ROWS = 4; // fill column top→bottom, then next column (still 12/page)
const HERO_FRAME_HEIGHT = 210;
const HERO_PAD = 8;
// Fits 4 rows on A4 with caption/footer; cover-fit removes letterboxing inside cells
const SLICE_CELL_HEIGHT = 186;
const SLICE_PAD = 2;

const styles = StyleSheet.create({
  page: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 28,
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
  brandHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  brandTitle: { fontSize: 17, fontWeight: 700, color: Theme.INK, letterSpacing: 0.2 },
  brandSubtitle: {
    fontSize: 7.5,
    color: Theme.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 8,
    paddingBottom: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: Theme.LINE,
  },
  caseHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  caseTitle: { fontSize: 14, fontWeight: 700, color: Theme.INK, maxWidth: '72%' },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
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
    padding: 8,
    marginBottom: 8,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 3 },
  infoRowLast: { marginBottom: 0 },
  infoLabel: { fontSize: 7.5, color: Theme.MUTED, width: 78 },
  infoValue: { fontSize: 8.5, fontWeight: 'bold', color: Theme.INK, flex: 1 },
  infoLink: { fontSize: 8, color: Theme.LINK, textDecoration: 'none', flex: 1, fontWeight: 700 },
  otherLink: { fontSize: 7, color: Theme.LINK, textDecoration: 'none', marginBottom: 1, fontWeight: 600 },
  columns: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  leftCol: { width: '46%' },
  rightCol: { width: '54%' },
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
  sectionCard: {
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    borderRadius: 5,
    padding: 8,
    marginBottom: 7,
    backgroundColor: Theme.SURFACE,
  },
  sectionLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    color: Theme.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  bodyText: { fontSize: 8, color: Theme.INK_SOFT, lineHeight: 1.4 },
  contentTitle: { fontSize: 9, fontWeight: 700, color: Theme.INK, marginBottom: 4, lineHeight: 1.3 },
  contentMeta: { fontSize: 7.5, color: Theme.INK_SOFT, lineHeight: 1.35, marginBottom: 3 },
  headingItem: { fontSize: 7, color: Theme.MUTED, lineHeight: 1.3, marginBottom: 1 },
  kvRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 7 },
  kvLabel: { width: 62, fontSize: 8.5, color: Theme.MUTED },
  kvValue: { flex: 1, fontSize: 9, color: Theme.INK, fontWeight: 700 },
  otherList: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  otherChip: { width: '48%' },
  infraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
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
    fontSize: 7.5,
    fontWeight: 700,
    color: Theme.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  adsChipValue: { fontSize: 12, fontWeight: 700, color: Theme.INK },
  infraGrid: { flexDirection: 'row', gap: 10 },
  infraCol: { width: '33.3%' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  threatBadge: {
    backgroundColor: Theme.SURFACE_ALT,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: Theme.LINE,
  },
  threatText: { fontSize: 7.5, color: Theme.INK, textTransform: 'capitalize' },
  legalCode: { fontSize: 8.5, fontWeight: 700, color: Theme.INK, marginBottom: 2 },
  legalReason: { fontSize: 7.5, color: Theme.INK_SOFT, lineHeight: 1.35, marginBottom: 5 },
  reasoningText: { fontSize: 8, color: Theme.INK_SOFT, lineHeight: 1.42 },
  galleryCaption: { fontSize: 8, color: Theme.MUTED, marginBottom: 6 },
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

const BrandHeader = () => (
  <View>
    <View style={styles.brandHeader}>
      <Text style={styles.brandTitle}>Overwatch</Text>
    </View>
    <Text style={styles.brandSubtitle}>Domain Integrity</Text>
  </View>
);

const PageFooter = () => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerText}>Confidential Document</Text>
    <Text style={styles.footerText}>Powered by Contrails AI</Text>
    <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
  </View>
);

const InfoRow = ({ label, children, last }) => (
  <View style={last ? [styles.infoRow, styles.infoRowLast] : styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    {children}
  </View>
);

const Kv = ({ label, value, max = 56 }) => (
  <View style={styles.kvRow}>
    <Text style={styles.kvLabel}>{label}</Text>
    <Text style={styles.kvValue}>{processText(value == null || value === '' ? '—' : String(value), max)}</Text>
  </View>
);


const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const DomainDossierPage = ({ domain, compressedImage, caseNumber }) => {
  const review = domain.review_details || {};
  const analysis = domain.analysis_results || {};
  const whois = analysis.whois || {};
  const hosting = analysis.hosting || {};
  const ssl = analysis.ssl || {};
  const dns = analysis.dns || {};
  const riskInfo = domainRiskInfo(domain);
  const visitUrl = domainVisitUrl(domain);
  const violations = collectDomainViolations(domain);
  const pageContent = domainPageContent(domain);
  const otherLanders = otherLanderVisitUrls(domain);
  const legalCodes = (Array.isArray(review.legal_codes) ? review.legal_codes : []).map((item) => {
    if (typeof item === 'string') return { code: item, reasoning: '' };
    return { code: item.code || item.name || '', reasoning: item.reasoning || '' };
  }).filter((item) => item.code);
  const reasoning = review.reasoning || analysis.content_classification?.summary || '';
  const redirects = Array.isArray(analysis.redirect_chain) ? analysis.redirect_chain.slice(0, 5) : [];
  const nameservers = (dns.nameservers || dns.ns || whois.name_servers || []).slice(0, 3);
  const aRecords = (dns.a || []).slice(0, 3);
  const hasOtherLanders = otherLanders.length > 0;
  const hasPageContent = Boolean(pageContent.title || pageContent.description || pageContent.excerpt || pageContent.headings.length);

  return (
    <Page size="A4" style={styles.page}>
      <BrandHeader />
      <View style={styles.caseHeadingRow} wrap={false}>
        <Text style={styles.caseTitle}>
          {caseNumber}. {processText(domain.domain_name || 'Unknown domain', 56)}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: riskInfo.bg, borderColor: riskInfo.border }]}>
          <Text style={[styles.statusBadgeText, { color: riskInfo.color }]}>{riskInfo.label}</Text>
        </View>
      </View>

      <View style={styles.infoBanner} wrap={false}>
        <InfoRow label="Lander">
          <Text style={styles.infoValue}>{domainLanderCaption(domain)}</Text>
        </InfoRow>
        <InfoRow label="Visit URL" last>
          {visitUrl ? (
            <Link src={visitUrl} style={styles.infoLink} target="_blank">
              {processText(visitUrl, 86)}
            </Link>
          ) : (
            <Text style={styles.infoValue}>—</Text>
          )}
        </InfoRow>
      </View>

      <View style={styles.columns} wrap={false}>
        <View style={styles.leftCol}>
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

        <View style={styles.rightCol}>
          <View style={[styles.sectionCard, { marginBottom: 0, minHeight: HERO_FRAME_HEIGHT }]}>
            <Text style={styles.sectionLabel}>Page content</Text>
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
              <Text style={styles.bodyText}>No captured page title or description.</Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Legal / Reasoning</Text>
        {legalCodes.length > 0
          ? legalCodes.slice(0, 2).map((item, idx) => (
              <View key={idx}>
                <Text style={styles.legalCode}>{processText(item.code, 48)}</Text>
                {item.reasoning ? <Text style={styles.legalReason}>{processText(item.reasoning, 140)}</Text> : null}
              </View>
            ))
          : null}
        <Text style={styles.reasoningText}>
          {processText(reasoning || 'No reviewer reasoning.', 520, 7)}
        </Text>
        {violations.length > 0 ? (
          <View style={[styles.badgeRow, { marginTop: 6 }]}>
            {violations.slice(0, 6).map((item, idx) => (
              <View key={idx} style={styles.threatBadge}>
                <Text style={styles.threatText}>{processText(String(item).replace(/[-_]/g, ' '), 28)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={[styles.sectionCard, { marginBottom: 0 }]}>
        <View style={styles.infraHeader}>
          <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>Infrastructure</Text>
          <View style={styles.adsChip}>
            <Text style={styles.adsChipLabel}>Ads count</Text>
            <Text style={styles.adsChipValue}>{domainAdsCount(domain).toLocaleString()}</Text>
          </View>
        </View>
        <View style={styles.infraGrid}>
          <View style={styles.infraCol}>
            <Kv label="Registrar" value={whois.registrar || domain.list?.registrar} />
            <Kv label="Created" value={formatDateTime(whois.created_at)} />
            <Kv label="Expires" value={formatDateTime(whois.expires_at)} />
            <Kv label="Privacy" value={whois.privacy_protected ? 'Protected' : 'No'} />
            <Kv label="Nameservers" value={nameservers.join(', ') || '—'} max={72} />
          </View>
          <View style={styles.infraCol}>
            <Kv label="Hosting" value={hosting.provider || domain.list?.hosting_provider} />
            <Kv label="Country" value={domainHostingCountry(domain)} />
            <Kv label="IP / ASN" value={[hosting.ip, hosting.asn].filter(Boolean).join(' · ')} />
            <Kv label="DNS A" value={aRecords.join(', ') || '—'} />
            <Kv
              label="Redirects"
              value={
                redirects.length
                  ? redirects.map((hop) => hop.url || hop.status_code || hop).join(' → ')
                  : '—'
              }
              max={72}
            />
          </View>
          <View style={styles.infraCol}>
            <Kv label="SSL issuer" value={ssl.issuer} />
            <Kv label="SSL valid to" value={formatDateTime(ssl.valid_to)} />
            <Kv label="SSL valid" value={ssl.is_valid === true ? 'Yes' : ssl.is_valid === false ? 'No' : '—'} />
          </View>
        </View>
      </View>

      {hasOtherLanders ? (
        <View style={[styles.sectionCard, { marginTop: 7, marginBottom: 0 }]} wrap={false}>
          <Text style={styles.sectionLabel}>Other landers</Text>
          <View style={styles.otherList}>
            {otherLanders.map((item, idx) => (
              <Link key={`${item.url}-${idx}`} src={item.url} style={[styles.otherLink, styles.otherChip]} target="_blank">
                {processText(item.url, 52)}
              </Link>
            ))}
          </View>
        </View>
      ) : null}

      <PageFooter />
    </Page>
  );
};

const DomainCaptureGalleryPages = ({ domain, screenshotSlices }) => {
  const images = (screenshotSlices || []).filter(Boolean);
  if (images.length === 0) return null;

  return chunk(images, SLICE_PAGE_SIZE).map((pageImages, pageIdx) => (
    <Page key={`${domain._id || 'domain'}-slices-${pageIdx}`} size="A4" style={styles.galleryPage}>
      <Text style={styles.galleryCaption}>
        Full-page capture · {processText(domain.domain_name, 40)} · {domainLanderCaption(domain)}
        {images.length > SLICE_PAGE_SIZE ? ` · ${pageIdx + 1} of ${Math.ceil(images.length / SLICE_PAGE_SIZE)}` : ''}
      </Text>
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

export const DomainDetailedBlock = ({ domain, compressedImage, screenshotSlices, caseNumber }) => (
  <>
    <DomainDossierPage domain={domain} compressedImage={compressedImage} caseNumber={caseNumber} />
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
