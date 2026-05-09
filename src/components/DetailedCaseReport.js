import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Link, Svg, Path, Circle } from '@react-pdf/renderer';
import { isValid, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { registerFonts } from './utils/FontRegister';

// --- FONT REGISTRATION ---
registerFonts();

// --- THEME ---
const Theme = {
    INK: '#0F172A',
    INK_SOFT: '#334155',
    MUTED: '#64748B',
    SUBTLE: '#94A3B8',
    LINE: '#E2E8F0',
    LINE_SOFT: '#F1F5F9',
    SURFACE: '#FFFFFF',
    SURFACE_ALT: '#F8FAFC',
    LINK: '#2563EB',

    RISK_HIGH: '#E11D48',
    RISK_HIGH_BG: '#FFF1F2',
    RISK_HIGH_BORDER: '#FECDD3',
    RISK_MEDIUM: '#EA580C',
    RISK_MEDIUM_BG: '#FFF7ED',
    RISK_MEDIUM_BORDER: '#FED7AA',
    RISK_LOW: '#D97706',
    RISK_LOW_BG: '#FFFBEB',
    RISK_LOW_BORDER: '#FDE68A',
    RISK_SAFE: '#059669',
    RISK_SAFE_BG: '#ECFDF5',
    RISK_SAFE_BORDER: '#A7F3D0',

    PENDING_BG: '#FFF7ED',
    PENDING_BORDER: '#FED7AA',
    PENDING_TEXT: '#C2410C',
};

const styles = StyleSheet.create({
    page: {
        paddingTop: 12,
        paddingHorizontal: 12,
        paddingBottom: 12,
        fontFamily: ['Outfit', 'Mukta'],
        backgroundColor: Theme.SURFACE,
        color: Theme.INK,
    },

    // --- BRAND HEADER ---
    brandHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 6,
    },
    brandTitle: {
        fontSize: 18,
        fontWeight: 700,
        color: Theme.INK,
        letterSpacing: 0.2,
    },
    brandSubtitle: {
        fontSize: 8,
        color: Theme.MUTED,
        textTransform: 'uppercase',
        letterSpacing: 1.4,
        fontWeight: 'bold',
        marginBottom: 14,
        paddingBottom: 14,
        borderBottomWidth: 0.5,
        borderBottomColor: Theme.LINE,
    },

    // --- CASE HEADING ROW ---
    caseHeadingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    caseTitle: {
        fontSize: 16,
        fontWeight: 700,
        color: Theme.INK,
    },
    caseId: {
        fontSize: 8,
        color: Theme.SUBTLE,
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        borderWidth: 0.5,
    },
    statusBadgeText: {
        fontSize: 9,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },

    // --- INFO BANNER ---
    infoBanner: {
        backgroundColor: Theme.SURFACE_ALT,
        borderWidth: 0.5,
        borderColor: Theme.LINE,
        borderRadius: 6,
        padding: 12,
        marginBottom: 14,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 5,
    },
    infoRowLast: {
        marginBottom: 0,
    },
    infoLabel: {
        fontSize: 7.2,
        color: Theme.MUTED,
        width: 60,
    },
    infoValue: {
        fontSize: 8,
        fontWeight: 'bold',
        color: Theme.INK,
        flex: 1,
    },
    infoLink: {
        fontSize: 8,
        color: Theme.LINK,
        textDecoration: 'none',
        flex: 1,
        fontWeight: 700,
    },

    // --- TWO COLUMNS ---
    columns: {
        flexDirection: 'row',
        gap: 12,
    },
    leftCol: {
        width: '54%',
    },
    rightCol: {
        width: '46%',
    },

    // --- LEFT CARD ---
    leftCard: {
        borderWidth: 0.5,
        borderColor: Theme.LINE,
        borderRadius: 5,
        overflow: 'hidden',
        backgroundColor: Theme.SURFACE,
    },

    // Media
    mediaWrap: {
        width: '100%',
        backgroundColor: '#0F172A',
        position: 'relative',
    },
    mediaImage: {
        width: '100%',
        height: 208,
        objectFit: 'cover',
    },
    mediaPlaceholder: {
        height: 208,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mediaPlaceholderText: {
        fontSize: 9,
        color: '#94A3B8',
    },
    mediaBadgesRow: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        flexDirection: 'row',
        gap: 4,
    },
    mediaBadge: {
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 3,
        backgroundColor: '#FFFFFF',
        borderWidth: 0.5,
        borderColor: '#E2E8F0',
    },
    mediaBadgeText: {
        fontSize: 6.5,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    viewSourcePill: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        backgroundColor: '#0F172A',
        borderRadius: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    viewSourcePillText: {
        fontSize: 6,
        color: '#FFFFFF',
        fontWeight: 'bold',
        textDecoration: 'none',
    },

    // User strip (no card border, just padded)
    userStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingTop: 8,
        paddingBottom: 4,
    },
    userAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    userAvatarText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    userName: {
        fontSize: 8,
        fontWeight: 'bold',
        color: Theme.INK,
    },
    userMeta: {
        fontSize: 6,
        color: Theme.MUTED,
        marginTop: 2,
    },

    // Section inside left card
    leftSection: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    leftSectionLabel: {
        fontSize: 6,
        color: Theme.MUTED,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: 'medium',
        marginBottom: 4,
    },
    bodyText: {
        fontSize: 5.5,
        lineHeight: 1.55,
        color: Theme.INK_SOFT,
    },
    bodyTextMuted: {
        fontSize: 5.5,
        lineHeight: 1.55,
        color: Theme.MUTED,
    },
    hashtagText: {
        fontSize: 6,
        color: Theme.LINK,
        lineHeight: 1.55,
    },
    softDivider: {
        borderTopWidth: 0.5,
        borderTopColor: Theme.LINE_SOFT,
        marginHorizontal: 14,
    },

    // Stats grid
    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    statCell: {
        flex: 1,
    },
    statLabel: {
        fontSize: 6,
        fontWeight: 400,
        color: Theme.MUTED,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 6,
        fontWeight: 400,
        color: Theme.INK,
    },
    statValueMono: {
        fontSize: 6,
        fontWeight: 400,
        color: Theme.INK,
    },

    // --- RIGHT CARD ---
    rightCard: {
        borderWidth: 0.5,
        borderColor: Theme.LINE,
        borderRadius: 5,
        overflow: 'hidden',
        backgroundColor: Theme.SURFACE,
    },
    rightSection: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    rightSectionLabel: {
        fontSize: 5,
        color: Theme.MUTED,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: 500,
        marginBottom: 6,
    },
    reasoningSection: {
        marginBottom: 4,
    },
    reasoningSectionLast: {
        marginBottom: 0,
    },
    reasoningLabel: {
        fontSize: 5.5,
        fontWeight: 500,
        color: Theme.INK,
    },
    reasoningContent: {
        fontSize: 5.5,
        lineHeight: 1.5,
        color: Theme.INK_SOFT,
    },
    rightDivider: {
        borderTopWidth: 0.5,
        borderTopColor: Theme.LINE_SOFT,
        marginHorizontal: 14,
    },

    // Legal violation card
    legalCard: {
        padding: 4,
        borderRadius: 6,
        borderWidth: 0.5,
        marginBottom: 6,
    },
    legalCardLast: {
        marginBottom: 0,
    },
    legalCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    legalPill: {
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 3,
        borderWidth: 0.5,
        backgroundColor: '#F5F3FF',
        borderColor: '#DDD6FE',
    },
    legalPillText: {
        fontSize: 6.5,
        fontWeight: 500,
        color: '#6D28D9',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    legalCode: {
        fontSize: 6.5,
        fontWeight: 600,
        color: Theme.RISK_HIGH,
    },
    legalReason: {
        fontSize: 5.5,
        lineHeight: 1.4,
        color: Theme.RISK_HIGH,
    },

    // Badge row (AI labels)
    badgeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 5,
    },
    aiLabelBadge: {
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 3,
        borderWidth: 0.5,
    },
    aiLabelBadgeText: {
        fontSize: 4.5,
        fontWeight: 600,
    },

    // Risk badge
    riskBadgeSmall: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 4,
        borderWidth: 0.5,
    },
    riskBadgeSmallText: {
        fontSize: 4.5,
        fontWeight: 600,
    },

    // Action log timeline
    timelineWrap: {
        position: 'relative',
    },
    timelineLine: {
        position: 'absolute',
        left: 13,
        top: 14,
        bottom: 14,
        width: 0.8,
        backgroundColor: Theme.LINE,
    },
    timelineItem: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 9,
        alignItems: 'flex-start',
    },
    timelineItemLast: {
        marginBottom: 0,
    },
    timelineDot: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: Theme.SURFACE,
        borderWidth: 0.5,
        borderColor: Theme.LINE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timelineBody: {
        flex: 1,
        paddingTop: 3,
    },
    timelineHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    timelineWho: {
        fontSize: 6,
        fontWeight: 600,
        color: Theme.INK,
    },
    timelineWhen: {
        fontSize: 5,
        color: Theme.SUBTLE,
    },
    timelineWhat: {
        fontSize: 5.5,
        color: Theme.INK_SOFT,
        marginTop: 2,
        lineHeight: 1.5,
    },

    // Comments block
    commentItem: {
        marginBottom: 5,
    },
    commentItemLast: {
        marginBottom: 0,
    },
    commentMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    commentMeta: {
        fontSize: 5.5,
        fontWeight: 500,
        color: Theme.MUTED,
    },
    commentText: {
        fontSize: 5.5,
        lineHeight: 1.55,
        color: Theme.INK_SOFT,
    },

    // Footer
    footer: {
        position: 'absolute',
        bottom: 16,
        left: 28,
        right: 28,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 6.5,
        color: Theme.MUTED,
        borderTopWidth: 0.5,
        borderTopColor: Theme.LINE,
        paddingTop: 8,
    },
    footerText: {
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        fontWeight: 'bold',
    },
});

// --- HELPERS ---
const sanitize = (text) => {
    if (!text) return '';
    return Array.from(String(text)).filter(char => {
        const cp = char.codePointAt(0);
        return (cp >= 32 && cp <= 126) || cp === 10 || cp === 13 || cp === 9 ||
            /[\u{0900}-\u{097F}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}]/u.test(char);
    }).join('');
};

const truncate = (text, max = 600) => {
    const s = sanitize(text);
    if (s.length <= max) return s;
    return s.slice(0, max).trim() + '...';
};

const formatDateTime = (dateInput) => {
    if (!dateInput) return 'N/A';
    try {
        const d = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
        if (isValid(d)) return formatInTimeZone(d, 'Asia/Kolkata', 'dd MMM yyyy, hh:mm a');
    } catch (e) { }
    return 'N/A';
};

const formatShortDateTime = (dateInput) => {
    if (!dateInput) return 'N/A';
    try {
        const d = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
        if (isValid(d)) return formatInTimeZone(d, 'Asia/Kolkata', 'dd/MM/yyyy hh:mm a');
    } catch (e) { }
    return 'N/A';
};

const getRiskInfo = (score) => {
    if (score >= 96) return { label: 'High Risk', color: Theme.RISK_HIGH, bg: Theme.RISK_HIGH_BG, border: Theme.RISK_HIGH_BORDER };
    if (score >= 76) return { label: 'Medium Risk', color: Theme.RISK_MEDIUM, bg: Theme.RISK_MEDIUM_BG, border: Theme.RISK_MEDIUM_BORDER };
    if (score >= 41) return { label: 'Low Risk', color: Theme.RISK_LOW, bg: Theme.RISK_LOW_BG, border: Theme.RISK_LOW_BORDER };
    return { label: 'Safe', color: Theme.RISK_SAFE, bg: Theme.RISK_SAFE_BG, border: Theme.RISK_SAFE_BORDER };
};

const getStatusInfo = (clientStatus) => {
    const s = (clientStatus || '').toLowerCase();
    if (s === 'no action' || s === 'pass') return { label: 'No Action', color: '#047857', bg: '#ECFDF5', border: '#A7F3D0' };
    if (s === 'flag for takedown') return { label: 'Flagged', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' };
    if (s === 'takedown') return { label: 'Takedown', color: '#BE123C', bg: '#FFF1F2', border: '#FECDD3' };
    return { label: 'Pending', color: Theme.PENDING_TEXT, bg: Theme.PENDING_BG, border: Theme.PENDING_BORDER };
};

// Mirrors overwatch_ui/src/components/ProfilePic.js so the PDF avatar matches
// the web UI fallback: same hash-based color and same initial-extraction rules.
const profilePicPalette = [
    '#FCA5A5', '#FDBA74', '#FCD34D', '#86EFAC', '#6EE7B7', '#5EEAD4',
    '#67E8F9', '#93C5FD', '#A5B4FC', '#C4B5FD', '#D8B4FE', '#F0ABFC',
    '#F9A8D4', '#FDA4AF',
];

const profilePicInitials = (name) => {
    if (!name) return '?';
    return String(name)
        .split(/[\s._]+/)
        .map(n => n && n[0])
        .filter(Boolean)
        .join('')
        .toUpperCase()
        .slice(0, 2) || '?';
};

const profilePicColor = (name) => {
    if (!name) return '#9CA3AF';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return profilePicPalette[Math.abs(hash) % profilePicPalette.length];
};

const splitCaptionAndTags = (caption) => {
    const text = sanitize(caption || '');
    if (!text) return { body: '', hashtags: '' };
    const tagMatch = text.match(/((?:^|\s)#[\w\-À-￿]+(?:\s+#[\w\-À-￿]+)*)\s*$/);
    if (!tagMatch) return { body: text, hashtags: '' };
    const tags = tagMatch[0].trim();
    const body = text.slice(0, text.length - tagMatch[0].length).trim();
    return { body, hashtags: tags };
};

// Parses reasoning text that comes as `\r\n`-separated structured sections
// like "Description: ...", "IT Act and Rules: ...", "BNS & Other Laws: ...",
// "Take Down: ...". Falls back to a single section when no labels are found.
const parseReasoning = (text) => {
    if (!text) return [];
    const cleaned = sanitize(String(text));
    const lines = cleaned.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    return lines.map((line) => {
        const match = line.match(/^([A-Z][A-Za-z0-9 &/()\-]{2,40}?):\s*(.+)$/);
        if (match) return { label: match[1].trim(), content: match[2].trim() };
        return { label: '', content: line };
    });
};

const labelColorMap = {
    purple: { color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
    rose: { color: '#E11D48', bg: '#FFF1F2', border: '#FECDD3' },
    orange: { color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
    indigo: { color: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE' },
    red: { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
    yellow: { color: '#CA8A04', bg: '#FEFCE8', border: '#FEF08A' },
    blue: { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
    emerald: { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
    amber: { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
    slate: { color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' },
};
const getLabelColor = (key) => labelColorMap[key] || labelColorMap.slate;

// --- BRAND HEADER (only on the first physical page of each case) ---
const BrandHeader = () => (
    <View>
        <View style={styles.brandHeader}>
            <Svg viewBox="0 0 24 24" width={24} height={24}>
                <Circle cx="12" cy="12" r="10" stroke={Theme.INK} strokeWidth={1.8} fill="none" />
                <Circle cx="12" cy="12" r="5.5" stroke={Theme.INK} strokeWidth={1.8} fill="none" />
                <Circle cx="12" cy="12" r="2" fill={Theme.INK} />
            </Svg>
            <Text style={styles.brandTitle}>Overwatch</Text>
        </View>
        <Text style={styles.brandSubtitle}>Digital Risk Protection · India Threat Brief</Text>
    </View>
);

// --- TIMELINE ICONS ---
const UserIcon = ({ color }) => (
    <Svg viewBox="0 0 24 24" width={13} height={13}>
        <Circle cx="12" cy="9" r="3.6" stroke={color} strokeWidth={1.7} fill="none" />
        <Path d="M4.5 20.5 V19 a5.5 5.5 0 0 1 5.5 -5.5 h4 a5.5 5.5 0 0 1 5.5 5.5 V20.5" stroke={color} strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const SystemIcon = ({ color }) => (
    <Svg viewBox="0 0 24 24" width={13} height={13}>
        <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.5} fill="none" />
        <Circle cx="12" cy="12" r="5.2" stroke={color} strokeWidth={1.5} fill="none" />
        <Circle cx="12" cy="12" r="1.8" fill={color} />
    </Svg>
);

const PageFooter = () => (
    <View style={styles.footer}>
        <Text style={styles.footerText}>Confidential Document</Text>
        <Text style={styles.footerText}>Powered by Contrails AI</Text>
        <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
);

// --- DETAILED CASE PAGE ---
export const DetailedCasePage = ({ post, project, compressedImage }) => {
    const review = post.review_details || {};
    const analysis = post.analysis_results || {};

    const riskScore = review.threat_score ?? analysis.risk_score ?? 0;
    const riskInfo = getRiskInfo(riskScore);
    const statusInfo = getStatusInfo(post.client_status);

    let projectDetails = project?.project_details;
    if (typeof projectDetails === 'string') {
        try { projectDetails = JSON.parse(projectDetails); } catch (e) { projectDetails = {}; }
    }

    let reasoningRaw = review.reasoning || analysis.categorization_reason || 'No detailed reasoning provided.';
    const reasoning = typeof reasoningRaw === 'object' && reasoningRaw !== null
        ? (reasoningRaw.reasoning || reasoningRaw.text || JSON.stringify(reasoningRaw))
        : reasoningRaw;



    const legalCodesRaw = Array.isArray(review.legal_codes) ? review.legal_codes : [];
    const legalCodes = legalCodesRaw.map((item) => {
        if (typeof item === 'string') return { code: item, reasoning: '' };
        return { code: item.code || item.name || '', reasoning: item.reasoning || '' };
    }).filter(e => e.code);

    const isPoiPresent = review.face_present ?? review.flags?.poi_confirmed ?? (analysis.poi_check?.poi_name_found || analysis.poi_check?.face_present) ?? false;
    const isAigc = review.is_aigc ?? review.flags?.is_aigc ?? analysis.aigc_check?.is_aigc ?? false;

    const projectLabels = projectDetails?.labels || [];
    const aiLabels = [];
    projectLabels.forEach(label => {
        if (review.flags?.[label.name] === true) {
            const title = String(label.name).replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const colorKey = label.severity === 'high' ? 'rose' : label.severity === 'medium' ? 'orange' : label.severity === 'low' ? 'yellow' : 'purple';
            aiLabels.push({ title, color: colorKey });
        }
    });
    const legacyFlagMap = {
        is_hate_speech: { title: 'Hate Speech', color: 'orange' },
        is_fake_news: { title: 'Misinformation', color: 'purple' },
        is_nsfw: { title: 'NSFW Content', color: 'orange' },
        is_fraud: { title: 'Fraud', color: 'rose' },
        is_asset_misuse: { title: 'Asset Misuse', color: 'yellow' },
        is_humor: { title: 'Satire', color: 'yellow' },
        is_terrorism: { title: 'Terrorism', color: 'rose' },
        is_violence: { title: 'Violence', color: 'orange' },
    };
    Object.entries(legacyFlagMap).forEach(([key, cfg]) => {
        if (review.flags?.[key] === true && !aiLabels.some(l => l.title === cfg.title)) {
            aiLabels.push(cfg);
        }
    });

    const { body: captionBody, hashtags: captionTags } = splitCaptionAndTags(post.caption);

    const imageUrl = compressedImage || post.signedImageUrl || post.image_url || null;

    const platformLabel = post.platform ? (post.platform === 'x' || post.platform === 'twitter' ? 'X (Twitter)' : post.platform.charAt(0).toUpperCase() + post.platform.slice(1)) : 'Unknown';
    const sourceUrl = post.original_url || post.url || '';
    const publishedAt = formatDateTime(post.posted_date || post.metadata?.posted_date || post.timestamp || post.sourcing_date);
    const alertedAt = formatDateTime(post.created_at || post.metadata?.created_at);

    const postedShort = formatShortDateTime(post.posted_date || post.metadata?.posted_date || post.timestamp);
    const processedShort = formatShortDateTime(post.metadata?.created_at || post.created_at);
    const caseIdShort = String(post._id || '').slice(-16);

    const updateHistory = Array.isArray(post.update_history) ? post.update_history : [];

    let comments = [];
    const rawComments = post.client_notes || post.notes || post.comments;
    if (Array.isArray(rawComments)) comments = rawComments;
    else if (typeof rawComments === 'string') {
        try { comments = JSON.parse(rawComments); }
        catch (e) {
            if (rawComments.trim().length > 0 && rawComments !== '[]') comments = [{ text: rawComments }];
        }
    }

    const displayName = post.user?.full_name || post.user?.username || 'Unknown';
    const handle = post.user?.username ? `@${post.user.username}` : '';

    const mediaBadges = [];
    if (isAigc) mediaBadges.push({ label: 'AIGC', color: '#7C3AED' });
    if (review.flags?.is_fake_news === true || review.flags?.misinformation === true) mediaBadges.push({ label: 'MIS', color: '#EA580C' });
    if (isPoiPresent) mediaBadges.push({ label: 'POI', color: '#059669' });

    const caseNumber = post.post_id || (post._id ? `#${String(post._id).slice(-5)}` : '');
    const caseTitle = caseNumber ? `Case ${typeof caseNumber === 'string' && caseNumber.startsWith('#') ? caseNumber : '#' + caseNumber}` : 'Case Detail';

    // Pre-compute right-column section visibility for divider rendering
    const rightSections = [];
    if (legalCodes.length > 0) rightSections.push('legal');
    rightSections.push('reasoning');
    if (isPoiPresent || isAigc || aiLabels.length > 0) rightSections.push('labels');
    rightSections.push('risk');
    if (updateHistory.length > 0) rightSections.push('logs');
    // if (comments.length > 0) rightSections.push('comments');

    return (
        <Page size="A4" style={styles.page}>
            <BrandHeader />

            {/* Case heading row */}
            <View style={styles.caseHeadingRow}>
                <View>
                    <Text style={styles.caseTitle}>{caseTitle}</Text>
                    <Text style={styles.caseId}>ID: {String(post._id).toUpperCase()}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg, borderColor: statusInfo.border }]}>
                    <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                </View>
            </View>

            {/* Info banner */}
            <View style={styles.infoBanner}>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Account</Text>
                    <Text style={styles.infoValue}>{handle || '—'}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Platform</Text>
                    <Text style={styles.infoValue}>{platformLabel}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>URL</Text>
                    {sourceUrl ? (
                        <Link src={sourceUrl} style={styles.infoLink}>{truncate(sourceUrl, 80)}</Link>
                    ) : (
                        <Text style={styles.infoValue}>N/A</Text>
                    )}
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Published</Text>
                    <Text style={styles.infoValue}>{publishedAt}</Text>
                </View>
                <View style={[styles.infoRow, styles.infoRowLast]}>
                    <Text style={styles.infoLabel}>Alerted</Text>
                    <Text style={styles.infoValue}>{alertedAt}</Text>
                </View>
            </View>

            {/* Two columns */}
            <View style={styles.columns}>

                {/* LEFT COLUMN — single bordered card */}
                <View style={styles.leftCol}>
                    <View style={styles.leftCard}>
                        {/* Media (flush to top of card) */}
                        <View style={styles.mediaWrap}>
                            {imageUrl ? (
                                <Image src={imageUrl} style={styles.mediaImage} />
                            ) : (
                                <View style={styles.mediaPlaceholder}>
                                    <Text style={styles.mediaPlaceholderText}>No image attached</Text>
                                </View>
                            )}
                            {mediaBadges.length > 0 && (
                                <View style={styles.mediaBadgesRow}>
                                    {mediaBadges.map((b, i) => (
                                        <View key={i} style={styles.mediaBadge}>
                                            <Text style={[styles.mediaBadgeText, { color: b.color }]}>{b.label}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                            {sourceUrl ? (
                                <View style={styles.viewSourcePill}>
                                    <Link src={sourceUrl} style={styles.viewSourcePillText}>View Source</Link>
                                </View>
                            ) : null}
                        </View>

                        {/* User strip — always use the deterministic colored-initials avatar.
                            Social-CDN profile_pic URLs frequently fail server-side rendering
                            (CORS / signed-URL expiry), so we skip the image attempt entirely
                            and match the web UI's ProfilePic fallback look. */}
                        <View style={styles.userStrip}>
                            <View style={[styles.userAvatar, { backgroundColor: profilePicColor(post.user?.username) }]}>
                                <Text style={styles.userAvatarText}>{profilePicInitials(post.user?.username)}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.userName}>{displayName}</Text>
                                <Text style={styles.userMeta}>{handle}{handle && platformLabel ? ' · ' : ''}{platformLabel}</Text>
                            </View>
                        </View>

                        {/* Caption */}
                        <View style={styles.leftSection}>
                            <Text style={styles.leftSectionLabel}>Post Caption</Text>
                            {captionBody ? (
                                <Text style={styles.bodyText}>{truncate(captionBody, 700)}</Text>
                            ) : (
                                <Text style={styles.bodyTextMuted}>No caption content available.</Text>
                            )}
                            {captionTags ? (
                                <Text style={[styles.hashtagText, { marginTop: 8, height: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }]}>{captionTags}</Text>
                            ) : null}
                        </View>

                        <View style={styles.softDivider} />

                        {/* Stats row 1 */}
                        <View style={styles.statsRow}>
                            <View style={styles.statCell}>
                                <Text style={styles.statLabel}>Platform</Text>
                                <Text style={styles.statValue}>{platformLabel}</Text>
                            </View>
                            <View style={styles.statCell}>
                                <Text style={styles.statLabel}>User Handle</Text>
                                <Text style={styles.statValue}>{handle || '—'}</Text>
                            </View>
                            <View style={styles.statCell}>
                                <Text style={styles.statLabel}>Followers</Text>
                                <Text style={styles.statValue}>{post.user?.follower_count != null ? Number(post.user.follower_count).toLocaleString() : '—'}</Text>
                            </View>
                        </View>

                        <View style={styles.softDivider} />

                        {/* Stats row 2 */}
                        <View style={styles.statsRow}>
                            <View style={styles.statCell}>
                                <Text style={styles.statLabel}>Likes</Text>
                                <Text style={styles.statValue}>{(post.stats?.like_count || 0).toLocaleString()}</Text>
                            </View>
                            <View style={styles.statCell}>
                                <Text style={styles.statLabel}>Comments</Text>
                                <Text style={styles.statValue}>{(post.stats?.comment_count || 0).toLocaleString()}</Text>
                            </View>
                            <View style={styles.statCell}>
                                <Text style={styles.statLabel}>Shares</Text>
                                <Text style={styles.statValue}>{(post.stats?.share_count || 0).toLocaleString()}</Text>
                            </View>
                        </View>

                        <View style={styles.softDivider} />

                        {/* Stats row 3 */}
                        <View style={styles.statsRow}>
                            <View style={styles.statCell}>
                                <Text style={styles.statLabel}>Posted On</Text>
                                <Text style={styles.statValue}>{postedShort}</Text>
                            </View>
                            <View style={styles.statCell}>
                                <Text style={styles.statLabel}>Processed On</Text>
                                <Text style={styles.statValue}>{processedShort}</Text>
                            </View>
                            <View style={styles.statCell}>
                                <Text style={styles.statLabel}>Case ID</Text>
                                <Text style={styles.statValueMono}>{caseIdShort}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* RIGHT COLUMN — single bordered card with internal section dividers */}
                <View style={styles.rightCol}>
                    <View style={styles.rightCard}>

                        {/* Legal Violations */}
                        {legalCodes.length > 0 && (
                            <>
                                <View style={styles.rightSection}>
                                    <Text style={styles.rightSectionLabel}>Legal Violations</Text>
                                    {legalCodes.map((lc, i) => {
                                        const tone = i % 2 === 0
                                            ? { bg: Theme.RISK_HIGH_BG, border: Theme.RISK_HIGH_BORDER }
                                            : { bg: Theme.RISK_MEDIUM_BG, border: Theme.RISK_MEDIUM_BORDER };
                                        const isLast = i === legalCodes.length - 1;
                                        const projCode = projectDetails?.legal_codes?.find(pc => pc.name === lc.code);
                                        const description = lc.reasoning || projCode?.description || '';
                                        return (
                                            <View key={i} style={[styles.legalCard, isLast && styles.legalCardLast, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                                                <View style={styles.legalCardHeader}>
                                                    {isAigc ? (
                                                        <View style={styles.legalPill}>
                                                            <Text style={styles.legalPillText}>AIGC</Text>
                                                        </View>
                                                    ) : null}
                                                    <Text style={styles.legalCode}>{lc.code}</Text>
                                                </View>
                                                {description ? (
                                                    <Text style={styles.legalReason}>{truncate(description, 220)}</Text>
                                                ) : null}
                                            </View>
                                        );
                                    })}
                                </View>
                                {rightSections.indexOf('legal') < rightSections.length - 1 && <View style={styles.rightDivider} />}
                            </>
                        )}

                        {/* Content Reasoning */}
                        <View style={styles.rightSection}>
                            <Text style={styles.rightSectionLabel}>Content Reasoning</Text>
                            {(() => {
                                const sections = parseReasoning(reasoning);
                                if (sections.length === 0) {
                                    return <Text style={styles.reasoningContent}>No detailed reasoning provided.</Text>;
                                }
                                if (sections.length === 1 && !sections[0].label) {
                                    return <Text style={styles.reasoningContent}>{truncate(sections[0].content, 700)}</Text>;
                                }
                                return sections.map((sec, i) => {
                                    const isLast = i === sections.length - 1;
                                    return (
                                        <View key={i} style={[styles.reasoningSection, isLast && styles.reasoningSectionLast]}>
                                            <Text style={styles.reasoningContent}>
                                                {sec.label ? <Text style={styles.reasoningLabel}>{sec.label}: </Text> : null}
                                                {truncate(sec.content, 240)}
                                            </Text>
                                        </View>
                                    );
                                });
                            })()}
                        </View>
                        {rightSections.indexOf('reasoning') < rightSections.length - 1 && <View style={styles.rightDivider} />}

                        {/* AI Labels Detected */}
                        {(isPoiPresent || isAigc || aiLabels.length > 0) && (
                            <>
                                <View style={styles.rightSection}>
                                    <Text style={styles.rightSectionLabel}>AI Labels Detected</Text>
                                    <View style={styles.badgeRow}>
                                        {aiLabels.map((l, i) => {
                                            const c = getLabelColor(l.color);
                                            return (
                                                <View key={`l-${i}`} style={[styles.aiLabelBadge, { backgroundColor: c.bg, borderColor: c.border }]}>
                                                    <Text style={[styles.aiLabelBadgeText, { color: c.color }]}>{l.title}</Text>
                                                </View>
                                            );
                                        })}
                                        {isAigc && (
                                            <View style={[styles.aiLabelBadge, { backgroundColor: labelColorMap.blue.bg, borderColor: labelColorMap.blue.border }]}>
                                                <Text style={[styles.aiLabelBadgeText, { color: labelColorMap.blue.color }]}>AI Generated</Text>
                                            </View>
                                        )}
                                        {isPoiPresent && (
                                            <View style={[styles.aiLabelBadge, { backgroundColor: labelColorMap.emerald.bg, borderColor: labelColorMap.emerald.border }]}>
                                                <Text style={[styles.aiLabelBadgeText, { color: labelColorMap.emerald.color }]}>POI Detected</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                {rightSections.indexOf('labels') < rightSections.length - 1 && <View style={styles.rightDivider} />}
                            </>
                        )}

                        {/* Current AI Generated Risk */}
                        <View style={styles.rightSection}>
                            <Text style={styles.rightSectionLabel}>Current AI Generated Risk</Text>
                            <View style={[styles.riskBadgeSmall, { backgroundColor: riskInfo.bg, borderColor: riskInfo.border }]}>
                                <Text style={[styles.riskBadgeSmallText, { color: riskInfo.color }]}>{riskInfo.label}</Text>
                            </View>
                        </View>
                        {rightSections.indexOf('risk') < rightSections.length - 1 && <View style={styles.rightDivider} />}

                        {/* Action Logs */}
                        {updateHistory.length > 0 && (
                            <>
                                <View style={styles.rightSection}>
                                    <Text style={styles.rightSectionLabel}>Action Logs</Text>
                                    <View style={styles.timelineWrap}>
                                        {updateHistory.length > 1 && <View style={styles.timelineLine} />}
                                        {updateHistory.slice().reverse().slice(0, 3).map((entry, i, arr) => {
                                            const summary = (entry.changes_summary || '').toString();
                                            const cleaned = summary === 'Manual ingestion from simplified JSON'
                                                ? 'Content was sourced and ingested into the system.'
                                                : summary.replace(/client/g, 'user').replace(/Client/g, 'User');
                                            const isSystem = !/\S+@\S+\.\S+/.test(entry.updated_by || '');
                                            const who = isSystem ? 'System AI' : entry.updated_by;
                                            const isLast = i === arr.length - 1;
                                            return (
                                                <View key={i} style={[styles.timelineItem, isLast && styles.timelineItemLast]}>
                                                    <View style={styles.timelineDot}>
                                                        {isSystem
                                                            ? <SystemIcon color={Theme.MUTED} />
                                                            : <UserIcon color={Theme.MUTED} />}
                                                    </View>
                                                    <View style={styles.timelineBody}>
                                                        <View style={styles.timelineHeaderRow}>
                                                            <Text style={styles.timelineWho}>{who}</Text>
                                                            <Text style={styles.timelineWhen}>{formatShortDateTime(entry.updated_at)}</Text>
                                                        </View>
                                                        <Text style={styles.timelineWhat}>{truncate(cleaned, 140)}</Text>
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>
                                {rightSections.indexOf('logs') < rightSections.length - 1 && <View style={styles.rightDivider} />}
                            </>
                        )}

                        {/* Comments */}
                        {comments.length > 0 && (
                            <View style={styles.rightSection}>
                                <Text style={styles.rightSectionLabel}>Comments</Text>
                                {comments.slice(0, 2).map((c, i, arr) => {
                                    const isLast = i === arr.length - 1;
                                    return (
                                        <View key={i} style={[styles.commentItem, isLast && styles.commentItemLast]}>
                                            {(c.email || c.created_at) && (
                                                <View style={styles.commentMetaRow}>
                                                    <Text style={styles.commentMeta}>{c.email || 'Unknown User'}</Text>
                                                    <Text style={styles.commentMeta}>{c.created_at ? formatShortDateTime(c.created_at) : ''}</Text>
                                                </View>
                                            )}
                                            <Text style={styles.commentText}>{truncate(c.text || '', 220)}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                    </View>
                </View>
            </View>

            <PageFooter />
        </Page>
    );
};

export const DetailedCasesReportDocument = ({ posts, project, compressedImages }) => {
    return (
        <Document title={`Detailed_Report`}>
            {posts.map((post, index) => (
                <DetailedCasePage 
                    key={post._id || index} 
                    post={post} 
                    project={project} 
                    compressedImage={compressedImages[index]} 
                />
            ))}
        </Document>
    );
};

export default DetailedCasesReportDocument;