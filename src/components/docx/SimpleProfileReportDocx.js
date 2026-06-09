/**
 * SimpleProfileReportDocx.js
 *
 * Generates a minimal profile DOCX: plain profile summary + numbered cases
 * (I., II., …) with URL, description, and bordered image. No header/footer branding.
 */

const {
    Document, Packer, Paragraph, TextRun, ImageRun,
    Table, TableRow, TableCell,
    WidthType, BorderStyle, AlignmentType,
    ExternalHyperlink, Tab, TabStopType,
} = require('docx');

const {
    readLocalImage,
    sectionDivider,
} = require('./SingleCaseReportDocx');

const FONT = 'Times New Roman';
const CASE_CONTENT_INDENT = 720;
const IMAGE_CELL_PADDING = 60;

const caseContentTabStops = [{ type: TabStopType.LEFT, position: CASE_CONTENT_INDENT }];

const tabRun = () => new TextRun({ children: [new Tab()], font: FONT });

const caseContentIndent = { left: CASE_CONTENT_INDENT, hanging: CASE_CONTENT_INDENT };

const BLACK_BORDER = {
    style: BorderStyle.SINGLE,
    size: 18,
    color: '000000',
};

const textRun = (text, opts = {}) => new TextRun({
    text,
    font: FONT,
    color: opts.color || '374151',
    size: opts.size || 22,
    bold: opts.bold || false,
    underline: opts.underline,
});

const simpleMetaPara = (label, value, isUrl = false) => {
    const children = [textRun(`${label}: `, { bold: true, color: '1E293B' })];

    if (isUrl && value && value !== 'N/A') {
        children.push(
            new ExternalHyperlink({
                children: [textRun(value, { color: '2563EB', underline: { color: '2563EB' } })],
                link: value,
            }),
        );
    } else {
        children.push(textRun(value, { color: '374151' }));
    }

    return new Paragraph({ children, spacing: { after: 60 } });
};

const formatAccountName = (profile) => {
    if (profile?.metadata?.full_name) return profile.metadata.full_name;
    const username = profile?.username || profile?._id;
    return username ? `@${username}` : 'N/A';
};

const formatProfileNote = (profile) => {
    const location = profile?.metadata?.location;
    if (!location) return null;
    return `This account's said location: ${location}`;
};

const toRomanNumeral = (num) => {
    const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const symbols = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
    let result = '';
    let n = num;
    for (let i = 0; i < values.length; i++) {
        while (n >= values[i]) {
            result += symbols[i];
            n -= values[i];
        }
    }
    return result;
};

const pixelsToDxa = (px) => Math.round((px / 96) * 1440);

const stripDescriptionPrefix = (text) => {
    if (!text) return text;
    return text.replace(/^Description:\s*/i, '').trim();
};

const buildBorderedImageTable = (imageRun, imageWidthPx) => {
    if (!imageRun || !imageWidthPx) return null;

    const contentWidth = pixelsToDxa(imageWidthPx);
    const tableWidth = contentWidth + IMAGE_CELL_PADDING * 2;

    return new Table({
        width: { size: tableWidth, type: WidthType.DXA },
        indent: { size: CASE_CONTENT_INDENT, type: WidthType.DXA },
        columnWidths: [tableWidth],
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: tableWidth, type: WidthType.DXA },
                        margins: {
                            top: IMAGE_CELL_PADDING,
                            bottom: IMAGE_CELL_PADDING,
                            left: IMAGE_CELL_PADDING,
                            right: IMAGE_CELL_PADDING,
                        },
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

const getSimpleCaseDescription = (post) => {
    const review = post.review_details || {};
    const simpleDescription = review.simple_report_description;
    if (typeof simpleDescription === 'string' && simpleDescription.trim().length > 0) {
        return simpleDescription;
    }
    const reasoning = review.reasoning;
    if (typeof reasoning === 'string' && reasoning.trim().length > 0) {
        return reasoning;
    }
    return 'No description provided.';
};

const generateSimpleCaseSections = async (post, project, imagePath, caseNumber) => {
    const description = stripDescriptionPrefix(getSimpleCaseDescription(post));
    const fullUrl = post.original_url || post.url;
    const caseLabel = `${toRomanNumeral(caseNumber)}.   `;

    const docChildren = [];

    const urlLineChildren = [
        textRun(caseLabel, { bold: true, color: '1E293B' }),
        tabRun(),
        textRun('URL: ', { bold: true, color: '1E293B' }),
    ];

    if (fullUrl) {
        urlLineChildren.push(
            new ExternalHyperlink({
                children: [textRun(fullUrl, { color: '2563EB', underline: { color: '2563EB' } })],
                link: fullUrl,
            }),
        );
    } else {
        urlLineChildren.push(textRun('N/A', { color: '374151' }));
    }

    docChildren.push(new Paragraph({
        children: urlLineChildren,
        tabStops: caseContentTabStops,
        indent: caseContentIndent,
        spacing: { before: caseNumber === 1 ? 200 : 0, after: 80 },
    }));

    docChildren.push(new Paragraph({
        children: [
            textRun('Description: ', { bold: true, color: '1E293B' }),
            textRun(description, { color: '374151' }),
        ],
        indent: { left: CASE_CONTENT_INDENT },
        spacing: { after: 120 },
    }));

    let imageRun = null;
    let imageWidthPx = null;
    const imgInfo = await readLocalImage(imagePath, 400);
    if (imgInfo) {
        try {
            imageWidthPx = imgInfo.width;
            imageRun = new ImageRun({
                data: imgInfo.data,
                transformation: { width: imgInfo.width, height: imgInfo.height },
            });
        } catch (err) {
            console.error('[DOCX] Failed to create simple case ImageRun', err.message);
        }
    }

    const borderedTable = buildBorderedImageTable(imageRun, imageWidthPx);
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

    docChildren.push(simpleMetaPara('Name of the account', formatAccountName(profile)));

    if (profile?.profile_url) {
        docChildren.push(simpleMetaPara('Link to the account', profile.profile_url, true));
    }

    const followerCount = profile?.metadata?.follower_count;
    if (typeof followerCount === 'number') {
        docChildren.push(simpleMetaPara('Number of followers', followerCount.toLocaleString()));
    }

    const note = formatProfileNote(profile);
    if (note) {
        docChildren.push(simpleMetaPara('Note', note));
    }

    docChildren.push(new Paragraph({
        children: [textRun('Evidence', { bold: true, color: '1E293B' })],
        spacing: { before: 200, after: 300 },
    }));

    for (let i = 0; i < cases.length; i++) {
        const caseSections = await generateSimpleCaseSections(cases[i], project, imagePaths[i], i + 1);
        docChildren.push(...caseSections);
    }

    const doc = new Document({
        styles: { default: { document: { run: { font: FONT } } } },
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
