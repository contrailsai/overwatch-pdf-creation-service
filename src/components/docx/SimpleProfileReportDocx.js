/**
 * SimpleProfileReportDocx.js
 *
 * Generates a minimal profile DOCX: plain profile summary + numbered cases
 * (I., II., …) with URL, description, and bordered image. No header/footer branding.
 */

const {
    Document, Packer, Paragraph,
    ExternalHyperlink,
} = require('docx');

const {
    FONT,
    PAGE_MARGINS,
    textRun,
    generateSimpleCaseBlock,
} = require('./simpleReportShared');

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
    return `This account operates from ${location}`;
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
        const caseSections = await generateSimpleCaseBlock(cases[i], imagePaths[i], { caseNumber: i + 1 });
        docChildren.push(...caseSections);
    }

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

module.exports = { generateSimpleProfileDocxBuffer };
