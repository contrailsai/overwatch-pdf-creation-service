/**
 * SimpleProfileReportDocx.js
 *
 * Generates a minimal profile DOCX: plain profile summary + numbered cases
 * (S1, S2, …) with URL, description, and bordered image. No header/footer branding.
 */

const {
    Document, Packer, Paragraph, TextRun, ImageRun,
    Table, TableRow, TableCell,
    WidthType, BorderStyle, AlignmentType,
    ExternalHyperlink,
} = require('docx');
const { format, isValid } = require('date-fns');

const {
    getCaseData,
    readLocalImage,
    metaPara,
    sectionDivider,
    PAGE_WIDTH,
} = require('./SingleCaseReportDocx');

const BLACK_BORDER = {
    style: BorderStyle.SINGLE,
    size: 18,
    color: '000000',
};

const formatAccountName = (profile) => {
    if (profile?.metadata?.full_name) return profile.metadata.full_name;
    const username = profile?.username || profile?._id;
    return username ? `@${username}` : 'N/A';
};

const formatProfileNote = (profile) => {
    const parts = [];
    const joinDate = profile?.metadata?.account_creation_date;
    if (joinDate) {
        try {
            const date = new Date(joinDate);
            if (isValid(date)) {
                parts.push(`joining date: ${format(date, 'dd MMM yyyy')}`);
            }
        } catch (_) { /* skip invalid date */ }
    }
    if (profile?.metadata?.location) {
        parts.push(profile.metadata.location);
    }
    return parts.length > 0 ? parts.join(' | ') : null;
};

const stripDescriptionPrefix = (text) => {
    if (!text) return text;
    return text.replace(/^Description:\s*/i, '').trim();
};

const buildBorderedImageTable = (imageRun) => {
    if (!imageRun) return null;
    return new Table({
        width: { size: PAGE_WIDTH, type: WidthType.DXA },
        columnWidths: [PAGE_WIDTH],
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: PAGE_WIDTH, type: WidthType.DXA },
                        borders: {
                            top: BLACK_BORDER,
                            bottom: BLACK_BORDER,
                            left: BLACK_BORDER,
                            right: BLACK_BORDER,
                        },
                        children: [
                            new Paragraph({
                                children: [imageRun],
                                alignment: AlignmentType.CENTER,
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
};

const generateSimpleCaseSections = async (post, project, imagePath, caseNumber) => {
    const { reasoning } = getCaseData(post, project);
    const description = stripDescriptionPrefix(reasoning);
    const fullUrl = post.original_url || post.url;

    const docChildren = [];

    docChildren.push(new Paragraph({
        children: [new TextRun({ text: `S${caseNumber}`, bold: true, size: 24, color: '1E293B' })],
        spacing: { before: caseNumber === 1 ? 200 : 0, after: 100 },
    }));

    if (fullUrl) {
        docChildren.push(new Paragraph({
            children: [
                new TextRun({ text: '- URL: ', bold: true, color: '1E293B', size: 22 }),
                new ExternalHyperlink({
                    children: [new TextRun({ text: fullUrl, color: '2563EB', size: 22, underline: { color: '2563EB' } })],
                    link: fullUrl,
                }),
            ],
            spacing: { after: 60 },
        }));
    } else {
        docChildren.push(new Paragraph({
            children: [
                new TextRun({ text: '- URL: ', bold: true, color: '1E293B', size: 22 }),
                new TextRun({ text: 'N/A', color: '374151', size: 22 }),
            ],
            spacing: { after: 60 },
        }));
    }

    docChildren.push(new Paragraph({
        children: [
            new TextRun({ text: '- Description: ', bold: true, color: '1E293B', size: 22 }),
            new TextRun({ text: description, color: '374151', size: 22 }),
        ],
        spacing: { after: 120 },
    }));

    let imageRun = null;
    const imgInfo = await readLocalImage(imagePath, 400);
    if (imgInfo) {
        try {
            imageRun = new ImageRun({
                data: imgInfo.data,
                transformation: { width: imgInfo.width, height: imgInfo.height },
            });
        } catch (err) {
            console.error('[DOCX] Failed to create simple case ImageRun', err.message);
        }
    }

    const borderedTable = buildBorderedImageTable(imageRun);
    if (borderedTable) {
        docChildren.push(borderedTable);
    }

    docChildren.push(sectionDivider(400));

    return docChildren;
};

/**
 * @param {object}   profile           - Profile object
 * @param {object[]} cases             - Array of normalised post objects
 * @param {object}   project           - Project object
 * @param {(string|null)[]} imagePaths - Local FS paths for case images
 * @returns {Promise<Buffer>}
 */
const generateSimpleProfileDocxBuffer = async (profile, cases, project, imagePaths) => {
    const docChildren = [];

    docChildren.push(metaPara('Name of the account', formatAccountName(profile)));

    if (profile?.profile_url) {
        docChildren.push(metaPara('Link to the account', profile.profile_url, true));
    }

    const followerCount = profile?.metadata?.follower_count;
    if (typeof followerCount === 'number') {
        docChildren.push(metaPara('Number of followers', followerCount.toLocaleString()));
    }

    const note = formatProfileNote(profile);
    if (note) {
        docChildren.push(metaPara('Note', note));
    }

    docChildren.push(sectionDivider(300));

    for (let i = 0; i < cases.length; i++) {
        const caseSections = await generateSimpleCaseSections(cases[i], project, imagePaths[i], i + 1);
        docChildren.push(...caseSections);
    }

    const doc = new Document({
        styles: { default: { document: { run: { font: 'Calibri' } } } },
        sections: [
            {
                properties: {
                    page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } },
                },
                children: docChildren,
            },
        ],
    });

    return Packer.toBuffer(doc);
};

module.exports = { generateSimpleProfileDocxBuffer };
