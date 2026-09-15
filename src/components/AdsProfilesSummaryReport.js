import React from 'react';
import { Page, Document } from '@react-pdf/renderer';
import { registerFonts } from './utils/FontRegister';
import {
  sharedStyles,
  PageHeader,
  PageFooter,
  CatalogMetricsSection,
  ProfileReportBlock,
} from './adsProfilesPdfShared';

registerFonts();

/**
 * Multi ad-profile catalog (used when the request has 2+ reviewed profiles).
 */
export const AdsProfilesSummaryReportDocument = ({ profiles, project }) => (
  <Document title="Ads_Profiles_Summary_Report">
    <Page size="A4" style={sharedStyles.page}>
      <PageHeader subtitle="Ad Profiles Summary Report" />
      <CatalogMetricsSection profiles={profiles} />
      {(profiles || []).map((group, idx) => (
        <ProfileReportBlock
          key={group.profile?._id || idx}
          group={group}
          project={project}
          breakBefore={idx > 0}
        />
      ))}
      <PageFooter />
    </Page>
  </Document>
);

export default AdsProfilesSummaryReportDocument;
