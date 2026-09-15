import React from 'react';
import { Page, Document } from '@react-pdf/renderer';
import { registerFonts } from './utils/FontRegister';
import {
  sharedStyles,
  PageHeader,
  PageFooter,
  ProfileReportBlock,
} from './adsProfilesPdfShared';

registerFonts();

/**
 * Single ad-profile dossier (used when the request has exactly one reviewed profile).
 * No per-ad carousel pages — ads stay capped in the table.
 */
export const AdsProfileReportDocument = ({ profiles, project }) => {
  const groups = profiles || [];
  return (
    <Document title="Ads_Profile_Report">
      {groups.map((group, idx) => (
        <Page key={group.profile?._id || idx} size="A4" style={sharedStyles.page}>
          <PageHeader subtitle="Ad Profile Report" />
          <ProfileReportBlock group={group} project={project} />
          <PageFooter />
        </Page>
      ))}
    </Document>
  );
};

/** @deprecated Use AdsProfileReportDocument */
export const AdsProfilesDetailedReportDocument = AdsProfileReportDocument;

export default AdsProfileReportDocument;
