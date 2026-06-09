/**
 * SimpleCaseReportDocx.js
 *
 * Generates a minimal single-case DOCX: URL, description, and bordered image only.
 * No profile block, Roman numerals, or header/footer branding.
 */

const { Document, Packer } = require('docx');

const {
    FONT,
    PAGE_MARGINS,
    generateSimpleCaseBlock,
} = require('./simpleReportShared');

/**
 * @param {object}      post      - Normalised post object
 * @param {object}      project   - Project object (unused; kept for API consistency)
 * @param {string|null} imagePath - Local FS path for case image
 * @returns {Promise<Buffer>}
 */
const generateSimpleCaseDocxBuffer = async (post, project, imagePath) => {
    const docChildren = await generateSimpleCaseBlock(post, imagePath);

    const doc = new Document({
        styles: { default: { document: { run: { font: FONT } } } },
        sections: [
            {
                properties: {
                    page: { margin: PAGE_MARGINS },
                },
                children: docChildren,
            },
        ],
    });

    return Packer.toBuffer(doc);
};

module.exports = { generateSimpleCaseDocxBuffer };
