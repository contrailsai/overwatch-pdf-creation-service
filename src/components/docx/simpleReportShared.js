/**
 * Shared building blocks for Simple Profile and Simple Case DOCX reports.
 */

const {
    Paragraph, TextRun, ImageRun,
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
const PAGE_MARGINS = { top: 1080, right: 1080, bottom: 1080, left: 1080 };

const caseContentTabStops = [{ type: TabStopType.LEFT, position: CASE_CONTENT_INDENT }];
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

const tabRun = () => new TextRun({ children: [new Tab()], font: FONT });

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

/**
 * @param {object} post
 * @param {string|null} imagePath
 * @param {{ caseNumber?: number|null, trailingDivider?: boolean }} [options]
 * @returns {Promise<import('docx').Paragraph[]>}
 */
const generateSimpleCaseBlock = async (post, imagePath, options = {}) => {
    const { caseNumber = null, trailingDivider = caseNumber !== null } = options;
    const description = stripDescriptionPrefix(getSimpleCaseDescription(post));
    const fullUrl = post.original_url || post.url;

    const docChildren = [];
    const urlLineChildren = [];

    if (caseNumber !== null && caseNumber !== undefined) {
        urlLineChildren.push(textRun(`${toRomanNumeral(caseNumber)}.   `, { bold: true, color: '1E293B' }));
        urlLineChildren.push(tabRun());
    }

    urlLineChildren.push(textRun('URL: ', { bold: true, color: '1E293B' }));

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

    const urlParagraphOpts = {
        children: urlLineChildren,
        spacing: { after: 80 },
    };

    if (caseNumber !== null && caseNumber !== undefined) {
        urlParagraphOpts.tabStops = caseContentTabStops;
        urlParagraphOpts.indent = caseContentIndent;
        urlParagraphOpts.spacing.before = caseNumber === 1 ? 200 : 0;
    }

    docChildren.push(new Paragraph(urlParagraphOpts));

    docChildren.push(new Paragraph({
        children: [
            textRun('Description: ', { bold: true, color: '1E293B' }),
            textRun(description, { color: '374151' }),
        ],
        indent: caseNumber !== null && caseNumber !== undefined
            ? { left: CASE_CONTENT_INDENT }
            : undefined,
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

    if (trailingDivider) {
        docChildren.push(sectionDivider(400));
    }

    return docChildren;
};

module.exports = {
    FONT,
    PAGE_MARGINS,
    CASE_CONTENT_INDENT,
    textRun,
    stripDescriptionPrefix,
    getSimpleCaseDescription,
    buildBorderedImageTable,
    generateSimpleCaseBlock,
};
