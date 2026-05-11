/**
 * ProfileReportDocx.js – Node.js / Lambda version
 *
 * Generates a profile DOCX report: profile overview followed by individual cases.
 * Returns a Buffer instead of using saveAs.
 */

const {
    Document, Packer, Paragraph, TextRun, ImageRun,
    Table, TableRow, TableCell,
    WidthType, AlignmentType,
    Header, Footer,
    VerticalAlign,
} = require('docx');
const { format } = require('date-fns');
const path = require('path');

const {
    generateCaseSections,
    formatCompleteDate,
    processText,
    readLocalImage,
    noBorders,
    PAGE_WIDTH,
    sectionDivider,
    metaPara,
    buildHeaderTable,
    buildFooterTable,
} = require('./SingleCaseReportDocx');

/**
 * @param {object}   profile               - Profile object
 * @param {object[]} cases                 - Array of normalised post objects
 * @param {object}   project               - Project object
 * @param {(string|null)[]} imagePaths     - Local FS paths for case images
 * @param {string|null}    profilePicPath  - Local FS path for profile picture
 * @param {object}   clientDetails         - { organization: string }
 * @returns {Promise<Buffer>}
 */
const generateProfileDocxBuffer = async (profile, cases, project, imagePaths, profilePicPath, clientDetails) => {
    const docChildren = [];

    // ── 1. PROFILE OVERVIEW ─────────────────────────────────────────────────

    let profileImageRun = null;
    const profileImgInfo = await readLocalImage(profilePicPath, 120);
    if (profileImgInfo) {
        try {
            profileImageRun = new ImageRun({ data: profileImgInfo.data, transformation: { width: profileImgInfo.width, height: profileImgInfo.height } });
        } catch (err) {
            console.error('[DOCX] Failed to create profile ImageRun', err.message);
        }
    }

    // Header table: overview text on the left, profile pic on the right
    docChildren.push(
        new Table({
            width: { size: PAGE_WIDTH, type: WidthType.DXA },
            columnWidths: [Math.round(PAGE_WIDTH * 0.8), Math.round(PAGE_WIDTH * 0.2)],
            borders: noBorders,
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            width: { size: Math.round(PAGE_WIDTH * 0.8), type: WidthType.DXA },
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: 'PROFILE OVERVIEW', bold: true, size: 32, color: '1E293B' })],
                                    spacing: { before: 0, after: 200 },
                                }),
                                metaPara('Username', `@${profile?.username || profile?._id || 'unknown'}`),
                                metaPara('Platform', (profile?.platform || 'Unknown').toUpperCase()),
                                metaPara('Full Name', profile?.metadata?.full_name || 'N/A'),
                                ...(profile?.metadata?.biography ? [metaPara('Bio', processText(profile?.metadata?.biography || profile?.metadata?.description || 'N/A', 300))] : []),
                                metaPara('Followers', profile?.metadata?.follower_count?.toLocaleString() || '0'),
                                metaPara('Following', profile?.metadata?.following_count?.toLocaleString() || '0'),
                                metaPara('Total Posts', profile?.metadata?.media_count?.toLocaleString() || '0'),
                                metaPara('Verified', profile?.metadata?.is_verified ? 'Yes' : 'No'),
                                ...(profile?.metadata?.account_creation_date ? [metaPara('Account Creation Date', format(new Date(profile.metadata.account_creation_date), 'dd MMM yyyy') || 'N/A')] : []),
                                ...(profile?.metadata?.location ? [metaPara('Location', profile?.metadata?.location || 'N/A')] : []),
                                ...(profile?.profile_url ? [metaPara('Profile URL', profile.profile_url, true)] : []),
                            ].filter(Boolean),
                        }),
                        new TableCell({
                            width: { size: Math.round(PAGE_WIDTH * 0.2), type: WidthType.DXA },
                            verticalAlign: VerticalAlign.TOP,
                            children: profileImageRun
                                ? [new Paragraph({ children: [profileImageRun], alignment: AlignmentType.RIGHT })]
                                : [],
                        }),
                    ],
                }),
            ],
        })
    );

    docChildren.push(sectionDivider(200));

    // ── 2. ACCOUNT'S CASES REVIEWED TITLE ──
    docChildren.push(new Paragraph({
        children: [new TextRun({ text: "ACCOUNT'S CASES REVIEWED", bold: true, size: 32, color: '1E293B' })],
        alignment: AlignmentType.LEFT,
        spacing: { before: 400, after: 400 },
    }));

    // ── 3. INDIVIDUAL CASES ──
    for (let i = 0; i < cases.length; i++) {
        const caseSections = await generateCaseSections(cases[i], project, imagePaths[i], i + 1);
        docChildren.push(...caseSections);
        if (i < cases.length - 1) {
            docChildren.push(sectionDivider(200));
        }
    }

    const orgName = clientDetails?.organization || null;
    const profileUsername = profile?.username || profile?._id || 'N/A';

    const doc = new Document({
        styles: { default: { document: { run: { font: 'Calibri' } } } },
        sections: [
            {
                properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } }, titlePage: true },
                headers: {
                    first: new Header({ children: [buildHeaderTable('PROFILE ANALYSIS', `Profile Report: @${profileUsername}`)] }),
                },
                footers: {
                    default: new Footer({ children: [buildFooterTable(orgName)] }),
                    first:   new Footer({ children: [buildFooterTable(orgName)] }),
                },
                children: docChildren,
            },
        ],
    });

    return Packer.toBuffer(doc);
};

module.exports = { generateProfileDocxBuffer };
