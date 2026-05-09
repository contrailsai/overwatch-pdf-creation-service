/**
 * DetailedCasesReportDocx.js – Node.js / Lambda version
 *
 * Generates a multi-case DOCX document with one case per section.
 * Returns a Buffer instead of using saveAs.
 */

const {
    Document, Packer, Paragraph, TextRun,
    Header, Footer, PageBreak,
} = require('docx');

const {
    generateCaseSections,
    formatCompleteDate,
    noBorders,
    PAGE_WIDTH,
    buildHeaderTable,
    buildFooterTable,
} = require('./SingleCaseReportDocx');

/**
 * @param {object[]} posts            - Array of normalised post objects
 * @param {object}   project          - Project object
 * @param {(string|null)[]} imagePaths - Local FS paths (index-aligned with posts)
 * @param {object}   clientDetails    - { organization: string }
 * @returns {Promise<Buffer>}
 */
const generateDetailedCasesDocxBuffer = async (posts, project, imagePaths, clientDetails) => {
    let allDocChildren = [];

    for (let i = 0; i < posts.length; i++) {
        if (i > 0) {
            allDocChildren.push(new Paragraph({ children: [new PageBreak()] }));
        }
        const caseSections = await generateCaseSections(posts[i], project, imagePaths[i], i + 1);
        allDocChildren.push(...caseSections);
    }

    const orgName = clientDetails?.organization || null;

    const doc = new Document({
        styles: { default: { document: { run: { font: 'Calibri' } } } },
        sections: [
            {
                properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } }, titlePage: true },
                headers: {
                    first: new Header({ children: [buildHeaderTable('DETAILED ANALYSIS', 'Detailed Cases Report')] }),
                },
                footers: {
                    default: new Footer({ children: [buildFooterTable(orgName)] }),
                    first:   new Footer({ children: [buildFooterTable(orgName)] }),
                },
                children: allDocChildren,
            },
        ],
    });

    return Packer.toBuffer(doc);
};

module.exports = { generateDetailedCasesDocxBuffer };
