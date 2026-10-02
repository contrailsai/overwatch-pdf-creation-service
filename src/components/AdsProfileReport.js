import React from 'react';
import { Page, Document } from '@react-pdf/renderer';
import { registerFonts } from './utils/FontRegister';
import {
  sharedStyles,
  PageHeader,
  PageFooter,
  ProfileReportBlock,
} from './adsProfilesPdfShared';
import { DomainCaptureGalleryPages } from './DomainsDetailedReport';

registerFonts();

/**
 * Single ad-profile dossier (used when the request has exactly one reviewed profile).
 * Follow-on pages render full lander captures for linked domains when slices exist.
 */
export const AdsProfileReportDocument = ({ profiles, project }) => {
  const groups = profiles || [];
  return (
    <Document title="Ads_Profile_Report">
      {groups.map((group, idx) => (
        <React.Fragment key={group.profile?._id || idx}>
          <Page size="A4" style={sharedStyles.page}>
            <PageHeader subtitle="Ad Profile Report" />
            <ProfileReportBlock group={group} project={project} />
            <PageFooter />
          </Page>
          {(group.domains || []).map((domain, domainIdx) => (
            <DomainCaptureGalleryPages
              key={`${domain._id || domainIdx}-slices`}
              domain={domain}
              screenshotSlices={group.domainScreenshotSlices?.[domainIdx] || []}
            />
          ))}
        </React.Fragment>
      ))}
    </Document>
  );
};

/** @deprecated Use AdsProfileReportDocument */
export const AdsProfilesDetailedReportDocument = AdsProfileReportDocument;

export default AdsProfileReportDocument;
