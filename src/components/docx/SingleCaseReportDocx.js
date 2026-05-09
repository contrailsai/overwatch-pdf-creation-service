/**
 * SingleCaseReportDocx.js – Node.js / Lambda version
 *
 * Adapted from overwatch_ui/src/components/docx/SingleCaseReportDocx.js
 * Key differences from the browser version:
 *   - No window.atob / window.Image / Canvas – uses Buffer + sharp instead
 *   - Images are passed as local file-system paths (same as the PDF pipeline)
 *   - No saveAs – callers receive a Buffer via Packer.toBuffer()
 */

const {
    Document, Packer, Paragraph, TextRun, ImageRun,
    Table, TableRow, TableCell,
    WidthType, BorderStyle, AlignmentType,
    Header, Footer, PageNumber,
    VerticalAlign,
    HeadingLevel, ExternalHyperlink,
} = require('docx');
const { format, isValid, parseISO } = require('date-fns');
const fs = require('fs');
const sharp = require('sharp');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCompleteDate = (dateInput) => {
    if (!dateInput) return 'N/A';
    try {
        const dateObj = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
        if (isValid(dateObj)) return format(dateObj, 'dd MMM yyyy, hh:mm a');
    } catch (_) { /* fall through */ }
    return 'N/A';
};

const getRiskLabel = (score) => {
    if (score > 95) return { label: 'HIGH RISK', color: 'E11D48', bg: 'FFF1F2' };
    if (score > 75) return { label: 'MEDIUM RISK', color: 'EA580C', bg: 'FFF7ED' };
    if (score > 40) return { label: 'LOW RISK', color: 'D97706', bg: 'FFFBEB' };
    return { label: 'SAFE CONTENT', color: '059669', bg: 'ECFDF5' };
};

const processText = (text, maxLength = 500, maxLines = null) => {
    if (!text) return '';
    let result = text;
    let truncated = false;
    if (maxLines) {
        const lines = result.split(/\r\n|\r|\n/);
        if (lines.length > maxLines) { result = lines.slice(0, maxLines).join('\n'); truncated = true; }
    }
    if (result.length > maxLength) { result = result.substring(0, maxLength); truncated = true; }
    return truncated ? result.trim() + '…' : result;
};

/**
 * Reads a local image file and returns { data: Buffer, width, height }
 * Falls back gracefully if the file can't be read or doesn't exist.
 */
const readLocalImage = async (localPath, maxSize = 400) => {
    if (!localPath || !fs.existsSync(localPath)) return null;
    try {
        const rawBuffer = fs.readFileSync(localPath);
        const metadata = await sharp(rawBuffer).metadata();
        let width = metadata.width || maxSize;
        let height = metadata.height || maxSize;

        // Scale down proportionally
        if (width > maxSize || height > maxSize) {
            if (width > height) {
                height = Math.round((height * maxSize) / width);
                width = maxSize;
            } else {
                width = Math.round((width * maxSize) / height);
                height = maxSize;
            }
        }
        return { data: rawBuffer, width, height };
    } catch (err) {
        console.error('[DOCX] Failed to read local image', localPath, err.message);
        return null;
    }
};

// ─── Border / Shading presets ─────────────────────────────────────────────────

const noBorders = {
    top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    insideVertical:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

// Page geometry (US Letter, margins 1080 TWIPs each side)
// 1 inch = 1440 TWIPs, Letter = 12240 TWIPs wide
// Available body width: 12240 – 1080*2 = 10080 TWIPs
const PAGE_WIDTH = 10080;

// A simple spacing paragraph
const sectionDivider = (space = 300) =>
    new Paragraph({ spacing: { before: 0, after: space } });

// Section heading paragraph
const sectionHeading = (text) =>
    new Paragraph({
        children: [new TextRun({ text: text.toUpperCase(), bold: true, color: '1E293B', size: 24 })],
        spacing: { before: 200, after: 100 },
    });

// Body text paragraph
const bodyPara = (text, opts = {}) =>
    new Paragraph({
        children: [new TextRun({ text, color: opts.color || '374151', size: opts.size || 20, bold: opts.bold || false })],
        spacing: { before: opts.spaceBefore || 0, after: opts.spaceAfter || 100 },
    });

const metaPara = (label, value, isUrl = false, linkOverride = null) => {
    const children = [
        new TextRun({ text: `${label}: `, bold: true, color: '1E293B', size: 22 }),
    ];

    if (isUrl && value && value !== 'N/A') {
        children.push(
            new ExternalHyperlink({
                children: [new TextRun({ text: value, color: '2563EB', size: 22, underline: { color: '2563EB' } })],
                link: linkOverride || value,
            })
        );
    } else {
        children.push(new TextRun({ text: value, color: '374151', size: 22 }));
    }

    return new Paragraph({ children, spacing: { after: 60 } });
};

const getCaseData = (post, project) => {
    const review = post.review_details || {};
    const analysis = post.analysis_results || {};
    const riskScore = review.threat_score ?? analysis.risk_score ?? 0;

    const reasoning = review.reasoning
        || analysis.categorization_reason
        || 'Analyzed content for policy adherence. No detailed reasoning provided.';

    // Project labels / violations
    let projectDetails = project?.project_details;
    if (typeof projectDetails === 'string') {
        try { projectDetails = JSON.parse(projectDetails); } catch (_) { projectDetails = {}; }
    }
    const projectLabels = projectDetails?.labels || [];
    const activeViolations = [];
    const severityMap = { high: 1, medium: 2, low: 3 };

    projectLabels.forEach(label => {
        if (review.flags?.[label.name] === true) {
            activeViolations.push({
                title: label.name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                severity: label.severity || 'medium',
                order: severityMap[label.severity] || 4,
            });
        }
    });

    const legacyFlags = {
        is_nsfw: 'NSFW Content', is_hate_speech: 'Hate Speech',
        is_fake_news: 'Misinformation', is_fraud: 'Fraud',
        is_asset_misuse: 'Asset Misuse', is_terrorism: 'Terrorism', is_violence: 'Violence',
    };
    Object.entries(legacyFlags).forEach(([key, title]) => {
        if (review.flags?.[key] === true && !activeViolations.some(v => v.title === title)) {
            activeViolations.push({ title, severity: 'medium', order: severityMap['medium'] });
        }
    });
    activeViolations.sort((a, b) => a.order - b.order);

    const posted_date  = formatCompleteDate(post.posted_date || post.metadata?.posted_date || post.timestamp || post.sourcing_date);
    const sourced_date = formatCompleteDate(post.metadata?.created_at || post.created_at);
    const reviewedDate = formatCompleteDate(post.updated_at || review.reviewed_at || post.created_at);
    const stats        = post.stats || {};
    const legalCodes   = review.legal_codes || [];

    let parsedComments = [];
    const rawComments = post.client_notes || post.notes || post.comments;
    if (Array.isArray(rawComments)) {
        parsedComments = rawComments;
    } else if (typeof rawComments === 'string') {
        try { parsedComments = JSON.parse(rawComments); }
        catch (_) { if (rawComments.trim().length > 0 && rawComments !== '[]') parsedComments = [{ text: rawComments }]; }
    }

    return {
        review, analysis, riskScore, reasoning, activeViolations,
        posted_date, sourced_date, reviewedDate, stats, legalCodes, parsedComments,
    };
};

/**
 * Generates the child paragraphs/tables for a single case section.
 * @param {object} post              - Normalised post object
 * @param {object} project           - Project object
 * @param {string|null} imagePath    - Local filesystem path produced by sharp (may be null)
 * @param {number|null} caseNumber   - 1-based index for multi-case reports (null = single)
 */
const generateCaseSections = async (post, project, imagePath, caseNumber = null) => {
    const {
        posted_date, sourced_date, reviewedDate, stats, legalCodes,
        activeViolations, reasoning, parsedComments,
    } = getCaseData(post, project);

    const docChildren = [];

    // ── CASE NUMBER (Optional) ──
    if (caseNumber !== null) {
        docChildren.push(new Paragraph({
            children: [new TextRun({ text: `CASE #${caseNumber}`, bold: true, size: 28, color: '2563EB' })],
            spacing: { before: 400, after: 200 },
        }));
    }

    // ── 1. BASIC META INFORMATION ──
    docChildren.push(metaPara('Account', `@${post.user?.username || 'unknown'}`));
    docChildren.push(metaPara('Platform', (post.platform || 'Unknown').toUpperCase()));
    const fullUrl = post.original_url || post.url;
    docChildren.push(metaPara('URL', processText(fullUrl || 'N/A', 100), !!fullUrl, fullUrl));
    docChildren.push(metaPara('Publish Date', posted_date));
    docChildren.push(metaPara('Alert Date', sourced_date));
    docChildren.push(metaPara('Review Date', reviewedDate));
    docChildren.push(sectionDivider(200));

    // ── 2. VISUAL EVIDENCE ──
    let imageRun = null;
    const imgInfo = await readLocalImage(imagePath, 400);
    if (imgInfo) {
        try {
            imageRun = new ImageRun({ data: imgInfo.data, transformation: { width: imgInfo.width, height: imgInfo.height } });
        } catch (err) {
            console.error('[DOCX] Failed to create ImageRun', err.message);
        }
    }

    docChildren.push(sectionHeading('Visual Evidence'));

    if (imageRun) {
        docChildren.push(new Paragraph({ children: [imageRun], alignment: AlignmentType.CENTER }));
    } else {
        docChildren.push(new Paragraph({
            children: [new TextRun({ text: 'No image available for this case.', color: '94A3B8', size: 20 })],
        }));
    }
    docChildren.push(sectionDivider(200));

    // ── 3. ENGAGEMENT STATS ──
    docChildren.push(sectionHeading('Engagement Stats'));
    const statsParts = [];
    statsParts.push(`Likes: ${stats.like_count ? stats.like_count.toLocaleString() : '0'}`);
    statsParts.push(`Comments: ${stats.comment_count ? stats.comment_count.toLocaleString() : '0'}`);
    if (stats.share_count !== undefined) statsParts.push(`Shares: ${stats.share_count.toLocaleString()}`);
    if (stats.view_count !== undefined && stats.view_count !== 0) statsParts.push(`Views: ${stats.view_count.toLocaleString()}`);
    docChildren.push(new Paragraph({ children: [new TextRun({ text: statsParts.join('   |   '), color: '374151', size: 20 })] }));
    docChildren.push(sectionDivider(200));

    // ── 4. CAPTION / CONTENT ──
    docChildren.push(sectionHeading('Caption / Content'));
    docChildren.push(new Paragraph({
        children: [new TextRun({ text: processText(post.caption || post.content || 'Empty content field.', 800, 20), color: '374151', size: 20 })],
    }));
    docChildren.push(sectionDivider(200));

    // ── 5. VIOLATIONS ──
    docChildren.push(sectionHeading('Violations'));
    if (activeViolations.length > 0) {
        activeViolations.forEach(v => {
            docChildren.push(new Paragraph({
                children: [new TextRun({ text: `• ${v.title}`, color: '374151', size: 20 })],
                spacing: { after: 40 },
            }));
        });
    } else {
        docChildren.push(new Paragraph({
            children: [new TextRun({ text: 'No specific violations flagged by the system.', color: '94A3B8', size: 20 })],
        }));
    }
    docChildren.push(sectionDivider(200));

    // ── 6. LEGAL FRAMEWORK (conditional) ──
    if (legalCodes.length > 0) {
        docChildren.push(sectionHeading('Legal Framework'));
        const legalCodeChildren = [];
        legalCodes.forEach((c, idx) => {
            const codeName = typeof c === 'string' ? c : c.code;
            const projectCode = project?.project_details?.legal_codes?.find(pc => pc.name === codeName);
            if (projectCode?.referenceLink) {
                legalCodeChildren.push(new ExternalHyperlink({
                    children: [new TextRun({ text: codeName, color: '2563EB', size: 20, underline: { type: 'single' } })],
                    link: projectCode.referenceLink,
                }));
            } else {
                legalCodeChildren.push(new TextRun({ text: codeName, color: '374151', size: 20 }));
            }
            if (idx < legalCodes.length - 1) {
                legalCodeChildren.push(new TextRun({ text: '  ·  ', color: '9CA3AF', size: 20 }));
            }
        });
        docChildren.push(new Paragraph({ children: legalCodeChildren }));
        docChildren.push(sectionDivider(200));
    }

    // ── 7. ANALYSIS & COMPLETE REASONING ──
    docChildren.push(sectionHeading('Analysis & Complete Reasoning'));
    const reasoningParagraphs = reasoning.split(/\n+/).filter(p => p.trim().length > 0);
    reasoningParagraphs.forEach(para => {
        docChildren.push(new Paragraph({
            children: [new TextRun({ text: para.trim(), color: '374151', size: 20 })],
            spacing: { after: 80 },
        }));
    });
    docChildren.push(sectionDivider(200));

    return docChildren;
};

// ─── Shared header / footer builder ──────────────────────────────────────────

const buildHeaderTable = (titleText, subtitleText) =>
    new Table({
        width: { size: PAGE_WIDTH, type: WidthType.DXA },
        columnWidths: [Math.round(PAGE_WIDTH * 0.55), Math.round(PAGE_WIDTH * 0.45)],
        borders: noBorders,
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: Math.round(PAGE_WIDTH * 0.55), type: WidthType.DXA },
                        borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' } },
                        margins: { top: 0, bottom: 120, left: 0, right: 200 },
                        verticalAlign: VerticalAlign.BOTTOM,
                        children: [new Paragraph({ children: [new TextRun({ text: titleText, bold: true, size: 34, color: '1E293B' })] })],
                    }),
                    new TableCell({
                        width: { size: Math.round(PAGE_WIDTH * 0.45), type: WidthType.DXA },
                        borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' } },
                        margins: { top: 0, bottom: 120, left: 200, right: 0 },
                        verticalAlign: VerticalAlign.BOTTOM,
                        children: [
                            new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatCompleteDate(new Date()), bold: false, size: 15, color: '475569' })] }),
                            new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: subtitleText, bold: true, size: 14, color: '64748B' })], spacing: { after: 80 } }),
                        ],
                    }),
                ],
            }),
        ],
    });

const buildFooterTable = (organizationName) => {
    const orgText = organizationName ? `REQUESTED BY ${organizationName.toUpperCase()}` : 'REQUESTED BY CLIENT';
    return new Table({
        width: { size: PAGE_WIDTH, type: WidthType.DXA },
        columnWidths: [Math.round(PAGE_WIDTH / 3), Math.round(PAGE_WIDTH / 3), PAGE_WIDTH - Math.round(PAGE_WIDTH / 3) * 2],
        borders: noBorders,
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: Math.round(PAGE_WIDTH / 3), type: WidthType.DXA },
                        borders: { ...noBorders, top: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' } },
                        verticalAlign: VerticalAlign.CENTER,
                        children: [new Paragraph({ children: [new TextRun({ text: orgText, bold: true, size: 14, color: '94A3B8' })], spacing: { before: 120 } })],
                    }),
                    new TableCell({
                        width: { size: Math.round(PAGE_WIDTH / 3), type: WidthType.DXA },
                        borders: { ...noBorders, top: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' } },
                        verticalAlign: VerticalAlign.CENTER,
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'POWERED BY OVERWATCH', size: 14, color: '94A3B8' })], spacing: { before: 120 } })],
                    }),
                    new TableCell({
                        width: { size: PAGE_WIDTH - Math.round(PAGE_WIDTH / 3) * 2, type: WidthType.DXA },
                        borders: { ...noBorders, top: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' } },
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.RIGHT,
                                spacing: { before: 120 },
                                children: [
                                    new TextRun({ text: 'Page ', bold: true, size: 14, color: '94A3B8' }),
                                    new TextRun({ children: [PageNumber.CURRENT], bold: true, size: 14, color: '64748B' }),
                                    new TextRun({ text: ' of ', bold: true, size: 14, color: '94A3B8' }),
                                    new TextRun({ children: [PageNumber.TOTAL_PAGES], bold: true, size: 14, color: '64748B' }),
                                ],
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
};

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generates a single-case DOCX document and returns a Buffer.
 *
 * @param {object} post            - Normalised post object
 * @param {object} project         - Project object
 * @param {string|null} imagePath  - Local FS path to the processed image (may be null)
 * @param {object} clientDetails   - { organization: string } etc.
 * @returns {Promise<Buffer>}
 */
const generateSingleCaseDocxBuffer = async (post, project, imagePath, clientDetails) => {
    const docChildren = await generateCaseSections(post, project, imagePath);
    const orgName = clientDetails?.organization || null;

    const doc = new Document({
        styles: { default: { document: { run: { font: 'Calibri' } } } },
        sections: [
            {
                properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } }, titlePage: true },
                headers: {
                    first: new Header({ children: [buildHeaderTable('CASE ANALYSIS', `Case ID: ${String(post._id).toUpperCase()}`)] }),
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

module.exports = {
    generateSingleCaseDocxBuffer,
    // Shared helpers consumed by DetailedCasesReportDocx & ProfileReportDocx
    generateCaseSections,
    formatCompleteDate,
    processText,
    readLocalImage,
    noBorders,
    PAGE_WIDTH,
    sectionDivider,
    sectionHeading,
    metaPara,
    buildHeaderTable,
    buildFooterTable,
};
