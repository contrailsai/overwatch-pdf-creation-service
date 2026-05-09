import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Link, Svg, Path, Circle } from '@react-pdf/renderer';
import { isValid, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { registerFonts } from './utils/FontRegister';

// --- FONT REGISTRATION ---
registerFonts();

// --- THEME & STYLES ---
// Aligned with DetailedCaseReport.js so both PDF surfaces share the same compact
// design language (slate text, rose/amber/emerald risk accents).
const Theme = {
    INK: '#0F172A',          // slate-900
    INK_SOFT: '#334155',     // slate-700
    BODY: '#1E293B',         // slate-800 (kept for backward compat)
    MUTED: '#64748B',        // slate-500
    SUBTLE: '#94A3B8',       // slate-400
    SOFT: '#94A3B8',         // alias of SUBTLE (kept for backward compat)
    LINE: '#E2E8F0',         // slate-200
    LINE_SOFT: '#F1F5F9',    // slate-100
    BG: '#FFFFFF',
    SURFACE: '#FFFFFF',      // alias of BG
    PANEL: '#F8FAFC',        // slate-50
    SURFACE_ALT: '#F8FAFC',  // alias of PANEL
    PANEL_INSET: '#F1F5F9',  // slate-100
    LINK: '#2563EB',         // blue-600
    RISK_HIGH: '#E11D48',    // rose-600
    RISK_MEDIUM: '#EA580C',  // orange-600
    RISK_LOW: '#D97706',     // amber-600
    RISK_SAFE: '#059669',    // emerald-600
    BADGE_GREEN_BG: '#ECFDF5',
    BADGE_GREEN_FG: '#047857',
    BADGE_GREEN_LINE: '#A7F3D0',
    BADGE_AMBER_BG: '#FFFBEB',
    BADGE_AMBER_FG: '#B45309',
    BADGE_AMBER_LINE: '#FCD34D',
    BADGE_PURPLE_BG: '#F5F3FF',
    BADGE_PURPLE_FG: '#6D28D9',
    BADGE_PURPLE_LINE: '#DDD6FE',
    BADGE_ROSE_BG: '#FFF1F2',
    BADGE_ROSE_FG: '#BE123C',
    BADGE_ROSE_LINE: '#FECDD3',
    BADGE_ORANGE_BG: '#FFF7ED',
    BADGE_ORANGE_FG: '#C2410C',
    BADGE_ORANGE_LINE: '#FED7AA',
    BADGE_BLUE_BG: '#EFF6FF',
    BADGE_BLUE_FG: '#1D4ED8',
    BADGE_BLUE_LINE: '#BFDBFE',
    BADGE_SLATE_BG: '#F8FAFC',
    BADGE_SLATE_FG: '#475569',
    BADGE_SLATE_LINE: '#E2E8F0',
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
        fontSize: 18, fontWeight: 700, color: Theme.INK,
        letterSpacing: 0.2,
    },
    brandSubtitle: {
        fontSize: 8, color: Theme.MUTED,
        textTransform: 'uppercase', letterSpacing: 1.4,
        fontWeight: 'bold',
        marginBottom: 14, paddingBottom: 14,
        borderBottomWidth: 0.5, borderBottomColor: Theme.LINE,
    },
    // --- CASE TITLE STRIP ---
    caseTitleRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 12,
    },
    caseTitle: { fontSize: 16, fontWeight: 700, color: Theme.INK },
    caseId: {
        fontSize: 8, color: Theme.SUBTLE, marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 4, borderWidth: 0.5, alignSelf: 'flex-start',
    },
    statusBadgeText: {
        fontSize: 9, fontWeight: 'bold',
        textTransform: 'uppercase', letterSpacing: 1,
    },
    // --- ACCOUNT CARD (info banner) ---
    accountCard: {
        backgroundColor: Theme.SURFACE_ALT,
        borderWidth: 0.5, borderColor: Theme.LINE,
        borderRadius: 6, padding: 12, marginBottom: 14,
    },
    accountRow: {
        flexDirection: 'row', alignItems: 'flex-start',
        marginBottom: 5,
    },
    accountLabel: {
        width: 60,
        fontSize: 7.2, color: Theme.MUTED,
    },
    accountValue: {
        flex: 1, fontSize: 8, fontWeight: 'bold', color: Theme.INK,
    },
    accountLink: {
        flex: 1, fontSize: 8, fontWeight: 700, color: Theme.LINK,
        textDecoration: 'none',
    },
    // --- TWO-COL BODY ---
    body: { flexDirection: 'row', gap: 12 },
    leftCol: { width: '54%', flexDirection: 'column', gap: 8 },
    rightCol: {
        width: '46%', flexDirection: 'column', gap: 8,
        borderWidth: 0.5, borderColor: Theme.LINE,
        borderRadius: 5, padding: 10,
        backgroundColor: Theme.SURFACE,
    },
    // --- MEDIA CARD ---
    mediaCard: {
        borderWidth: 0.5, borderColor: Theme.LINE,
        borderRadius: 5, overflow: 'hidden',
        backgroundColor: Theme.SURFACE,
    },
    mediaImage: { width: '100%', height: 208, objectFit: 'cover', backgroundColor: '#0F172A' },
    mediaPlaceholder: {
        height: 208, alignItems: 'center', justifyContent: 'center',
        backgroundColor: Theme.SURFACE_ALT,
    },
    mediaFooter: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 10, paddingVertical: 6,
        borderTopWidth: 0.5, borderTopColor: Theme.LINE,
        backgroundColor: Theme.SURFACE,
    },
    inlineBadgeRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
    miniBadge: {
        paddingHorizontal: 6, paddingVertical: 3,
        borderRadius: 3, borderWidth: 0.5,
    },
    miniBadgeText: {
        fontSize: 6.5, fontWeight: 'bold',
        textTransform: 'uppercase', letterSpacing: 0.5,
    },
    viewSourcePill: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: 4, backgroundColor: Theme.INK,
    },
    viewSourceText: {
        fontSize: 6, fontWeight: 'bold', color: '#FFFFFF',
        letterSpacing: 0.4,
    },
    // --- USER ROW ---
    userRow: {
        flexDirection: 'row', alignItems: 'center',
        gap: 10, paddingTop: 8, paddingBottom: 4,
    },
    avatar: {
        width: 32, height: 32, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
    },
    avatarLetter: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },
    userName: { fontSize: 8, fontWeight: 'bold', color: Theme.INK },
    userHandle: { fontSize: 6, color: Theme.MUTED, marginTop: 2 },
    // --- SECTION HEADERS ---
    sectionLabel: {
        fontSize: 6, fontWeight: 500,
        color: Theme.MUTED, textTransform: 'uppercase',
        letterSpacing: 1, marginBottom: 4,
    },
    sectionDivider: {
        marginVertical: 6,
        borderBottomWidth: 0.5, borderBottomColor: Theme.LINE_SOFT,
    },
    // --- CAPTION / TEXT BLOCKS ---
    paragraph: {
        fontSize: 5.5, lineHeight: 1.55, color: Theme.INK_SOFT,
    },
    hashtagText: {
        fontSize: 6, color: Theme.LINK, lineHeight: 1.55,
    },
    // --- KV GRID (Platform / Handle / Followers etc.) ---
    kvGrid: {
        flexDirection: 'row',
        marginTop: 4,
        borderTopWidth: 0.5, borderTopColor: Theme.LINE_SOFT,
        paddingTop: 8,
    },
    kvCell: { flex: 1, paddingRight: 6 },
    kvLabel: {
        fontSize: 6, fontWeight: 400, color: Theme.MUTED,
        textTransform: 'uppercase', letterSpacing: 0.8,
        marginBottom: 4,
    },
    kvValue: { fontSize: 6, fontWeight: 400, color: Theme.INK },
    // --- LEGAL VIOLATIONS ---
    legalCard: {
        borderRadius: 6, borderWidth: 0.5,
        padding: 4, marginBottom: 6,
    },
    legalCardHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginBottom: 4,
    },
    legalAigcBadge: {
        paddingHorizontal: 5, paddingVertical: 2,
        borderRadius: 3, borderWidth: 0.5,
        backgroundColor: Theme.BADGE_PURPLE_BG, borderColor: Theme.BADGE_PURPLE_LINE,
    },
    legalAigcText: {
        fontSize: 6.5, fontWeight: 500,
        color: Theme.BADGE_PURPLE_FG,
        textTransform: 'uppercase', letterSpacing: 0.4,
    },
    legalCode: {
        fontSize: 6.5, fontWeight: 600, color: Theme.RISK_HIGH,
    },
    legalReasoning: {
        fontSize: 5.5, color: Theme.RISK_HIGH, lineHeight: 1.4,
    },
    // --- BADGES (AI Labels) ---
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    badge: {
        paddingHorizontal: 9, paddingVertical: 4,
        borderRadius: 3, borderWidth: 0.5,
    },
    badgeText: {
        fontSize: 4.5, fontWeight: 600, letterSpacing: 0.2,
    },
    riskBadgeOutline: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: 4, borderWidth: 0.5,
    },
    riskBadgeOutlineText: {
        fontSize: 4.5, fontWeight: 600, letterSpacing: 0.3,
    },
    // --- AUDIT LOG / TIMELINE ---
    auditWrap: { position: 'relative' },
    auditLine: {
        position: 'absolute',
        left: 13, top: 14, bottom: 14,
        width: 0.8, backgroundColor: Theme.LINE,
    },
    auditEntry: {
        flexDirection: 'row', gap: 10, marginBottom: 9,
        alignItems: 'flex-start',
    },
    auditDot: {
        width: 26, height: 26, borderRadius: 13,
        backgroundColor: Theme.SURFACE,
        borderWidth: 0.5, borderColor: Theme.LINE,
        alignItems: 'center', justifyContent: 'center',
    },
    auditText: { flex: 1, paddingTop: 3 },
    auditWho: { fontSize: 6, fontWeight: 600, color: Theme.INK },
    auditWhen: { fontSize: 5, color: Theme.SUBTLE, marginTop: 1 },
    auditDetail: { fontSize: 5.5, color: Theme.INK_SOFT, marginTop: 2, lineHeight: 1.5 },
    // --- REASONING SECTIONS ---
    reasoningSection: { marginBottom: 4 },
    reasoningSectionLast: { marginBottom: 0 },
    reasoningLabel: { fontSize: 5.5, fontWeight: 500, color: Theme.INK },
    // --- COMMENTS ---
    commentBox: {
        backgroundColor: Theme.SURFACE_ALT,
        borderWidth: 0.5, borderColor: Theme.LINE_SOFT,
        borderRadius: 6, padding: 8, marginBottom: 5,
    },
    commentMeta: {
        flexDirection: 'row', justifyContent: 'space-between',
        marginBottom: 4,
    },
    commentMetaText: { fontSize: 5.5, color: Theme.MUTED, fontWeight: 500 },
    commentText: { fontSize: 5.5, color: Theme.INK_SOFT, lineHeight: 1.55 },
    // --- FOOTER ---
    footer: {
        position: 'absolute',
        bottom: 16, left: 28, right: 28,
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', fontSize: 6.5, color: Theme.MUTED,
        borderTopWidth: 0.5, borderTopColor: Theme.LINE,
        paddingTop: 8,
    },
    footerLeft: { textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: 0.6 },
    footerCenter: { textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: 0.6 },
    footerRight: { textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: 0.6 },
});

// --- ICONS ---
const UserIcon = ({ color = Theme.MUTED }) => (
    <Svg viewBox="0 0 24 24" width={13} height={13}>
        <Circle cx="12" cy="9" r="3.6" stroke={color} strokeWidth={1.7} fill="none" />
        <Path
            d="M4.5 20.5 V19 a5.5 5.5 0 0 1 5.5 -5.5 h4 a5.5 5.5 0 0 1 5.5 5.5 V20.5"
            stroke={color} strokeWidth={1.7} fill="none"
            strokeLinecap="round" strokeLinejoin="round"
        />
    </Svg>
);

const SystemIcon = ({ color = Theme.MUTED }) => (
    <Svg viewBox="0 0 24 24" width={13} height={13}>
        <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.5} fill="none" />
        <Circle cx="12" cy="12" r="5.2" stroke={color} strokeWidth={1.5} fill="none" />
        <Circle cx="12" cy="12" r="1.8" fill={color} />
    </Svg>
);

// --- UTILS ---
const sanitizeText = (text) => {
    if (!text) return '';
    return Array.from(String(text)).filter(char => {
        const cp = char.codePointAt(0);
        return (cp >= 32 && cp <= 126) || cp === 10 || cp === 13 || cp === 9 ||
            /[\u{0900}-\u{097F}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}]/u.test(char);
    }).join('');
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

// Splits a caption into body text and a trailing run of hashtags so they can be
// rendered with different styling (link color for tags).
const splitCaptionAndTags = (caption) => {
    const text = sanitizeText(caption || '');
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
    const cleaned = sanitizeText(String(text));
    const lines = cleaned.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    return lines.map((line) => {
        const match = line.match(/^([A-Z][A-Za-z0-9 &/()\-]{2,40}?):\s*(.+)$/);
        if (match) return { label: match[1].trim(), content: match[2].trim() };
        return { label: '', content: line };
    });
};

const truncate = (text, maxLength) => {
    if (!text) return '';
    const sanitized = sanitizeText(text);
    if (sanitized.length <= maxLength) return sanitized;
    return sanitized.substring(0, maxLength).trim() + '…';
};

const formatLongDate = (dateInput) => {
    if (!dateInput) return 'N/A';
    try {
        const dateObj = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
        if (isValid(dateObj)) {
            return formatInTimeZone(dateObj, 'Asia/Kolkata', "dd MMM yyyy, hh:mm a");
        }
    } catch (e) { return 'N/A'; }
    return 'N/A';
};

const formatShortDate = (dateInput) => {
    if (!dateInput) return '';
    try {
        const dateObj = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
        if (isValid(dateObj)) {
            return formatInTimeZone(dateObj, 'Asia/Kolkata', "dd/MM/yyyy HH:mm");
        }
    } catch (e) { return ''; }
    return '';
};

const getRiskInfo = (score) => {
    if (score > 95) return { label: 'High Risk', color: Theme.RISK_HIGH, bg: Theme.BADGE_ROSE_BG, line: Theme.BADGE_ROSE_LINE };
    if (score > 75) return { label: 'Medium Risk', color: Theme.RISK_MEDIUM, bg: Theme.BADGE_ORANGE_BG, line: Theme.BADGE_ORANGE_LINE };
    if (score > 40) return { label: 'Low Risk', color: Theme.RISK_LOW, bg: Theme.BADGE_AMBER_BG, line: Theme.BADGE_AMBER_LINE };
    return { label: 'Safe', color: Theme.RISK_SAFE, bg: Theme.BADGE_GREEN_BG, line: Theme.BADGE_GREEN_LINE };
};

// Map a UI client_status to a header status badge style.
const getStatusBadge = (clientStatus, takedownInfo) => {
    const status = (clientStatus || 'To Be Reviewed').trim();
    const td = (takedownInfo?.takedown_status || takedownInfo?.status || '').toLowerCase();
    if (td === 'requested' || status.toLowerCase().includes('takedown')) {
        return { label: 'Takedown', fg: Theme.BADGE_ROSE_FG, bg: Theme.BADGE_ROSE_BG, line: Theme.BADGE_ROSE_LINE };
    }
    if (status === 'No Action' || status === 'Pass') {
        return { label: 'No Action', fg: Theme.BADGE_GREEN_FG, bg: Theme.BADGE_GREEN_BG, line: Theme.BADGE_GREEN_LINE };
    }
    if (status === 'Flag for Takedown') {
        return { label: 'Flagged', fg: Theme.BADGE_AMBER_FG, bg: Theme.BADGE_AMBER_BG, line: Theme.BADGE_AMBER_LINE };
    }
    return { label: 'Pending', fg: Theme.BADGE_AMBER_FG, bg: Theme.BADGE_AMBER_BG, line: Theme.BADGE_AMBER_LINE };
};

// Convert label severity / type into a badge palette tuple.
const badgePalette = (color) => {
    const map = {
        rose: { bg: Theme.BADGE_ROSE_BG, fg: Theme.BADGE_ROSE_FG, line: Theme.BADGE_ROSE_LINE },
        orange: { bg: Theme.BADGE_ORANGE_BG, fg: Theme.BADGE_ORANGE_FG, line: Theme.BADGE_ORANGE_LINE },
        amber: { bg: Theme.BADGE_AMBER_BG, fg: Theme.BADGE_AMBER_FG, line: Theme.BADGE_AMBER_LINE },
        purple: { bg: Theme.BADGE_PURPLE_BG, fg: Theme.BADGE_PURPLE_FG, line: Theme.BADGE_PURPLE_LINE },
        emerald: { bg: Theme.BADGE_GREEN_BG, fg: Theme.BADGE_GREEN_FG, line: Theme.BADGE_GREEN_LINE },
        blue: { bg: Theme.BADGE_BLUE_BG, fg: Theme.BADGE_BLUE_FG, line: Theme.BADGE_BLUE_LINE },
    };
    return map[color] || { bg: Theme.BADGE_SLATE_BG, fg: Theme.BADGE_SLATE_FG, line: Theme.BADGE_SLATE_LINE };
};

const severityToColor = (severity) => {
    if (severity === 'high') return 'rose';
    if (severity === 'medium') return 'orange';
    if (severity === 'low') return 'amber';
    return 'orange';
};

const titleCase = (raw) =>
    String(raw || '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// Resolves project labels + legacy flags + threat_types into a deduped list of
// { title, color } badges for the "AI Labels Detected" panel.
const resolveActiveLabels = (projectLabels, review) => {
    const out = [];
    const threatTypes = Array.isArray(review.threat_types) ? review.threat_types : [];

    projectLabels.forEach(label => {
        const inFlags = review.flags?.[label.name] === true;
        const inThreatTypes = threatTypes.includes(label.name);
        if (inFlags || inThreatTypes) {
            out.push({
                title: titleCase(label.name),
                color: severityToColor(label.severity),
            });
        }
    });

    const legacyFlagMap = {
        is_hate_speech: { title: 'Hate Speech', color: 'orange' },
        is_fake_news: { title: 'Misinformation', color: 'orange' },
        is_nsfw: { title: 'NSFW Content', color: 'orange' },
        is_fraud: { title: 'Fraud', color: 'rose' },
        is_asset_misuse: { title: 'Asset Misuse', color: 'amber' },
        is_humor: { title: 'Satire', color: 'amber' },
        is_terrorism: { title: 'Terrorism', color: 'rose' },
        is_violence: { title: 'Violence', color: 'orange' },
    };
    Object.entries(legacyFlagMap).forEach(([key, cfg]) => {
        if (review.flags?.[key] === true && !out.some(l => l.title === cfg.title)) {
            out.push(cfg);
        }
    });

    threatTypes.forEach(type => {
        if (!type || type === 'safe') return;
        const formatted = titleCase(type);
        if (!out.some(l => l.title.toLowerCase() === formatted.toLowerCase())) {
            out.push({ title: formatted, color: 'slate' });
        }
    });

    return out;
};

// --- COMPONENTS ---
const PageHeader = () => (
    <View fixed>
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

const PageFooter = () => (
    <View style={styles.footer} fixed>
        <Text style={styles.footerLeft}>Confidential Document</Text>
        <Text style={styles.footerCenter}>Powered by Contrails AI</Text>
        <Text
            style={styles.footerRight}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
    </View>
);

const Badge = ({ color, children }) => {
    const p = badgePalette(color);
    return (
        <View style={[styles.badge, { backgroundColor: p.bg, borderColor: p.line }]}>
            <Text style={[styles.badgeText, { color: p.fg }]}>{children}</Text>
        </View>
    );
};

const KV = ({ label, value }) => (
    <View style={styles.kvCell}>
        <Text style={styles.kvLabel}>{label}</Text>
        <Text style={styles.kvValue}>{value || '—'}</Text>
    </View>
);

const AccountRow = ({ label, value, link }) => (
    <View style={styles.accountRow}>
        <Text style={styles.accountLabel}>{label}</Text>
        {link ? (
            <Link src={link} style={styles.accountLink}>{truncate(value, 90)}</Link>
        ) : (
            <Text style={styles.accountValue}>{truncate(value || '—', 90)}</Text>
        )}
    </View>
);

// --- MAIN PAGE ---
export const SingleCasePage = ({ post, project, compressedImage }) => {
    const review = post.review_details || {};
    const analysis = post.analysis_results || {};

    const riskScore = review.threat_score ?? analysis.risk_score ?? 0;
    const riskInfo = getRiskInfo(riskScore);

    let reasoningRaw = review.reasoning || analysis.categorization_reason ||
        'No detailed reasoning provided.';
    const reasoning = typeof reasoningRaw === 'object' && reasoningRaw !== null
        ? (reasoningRaw.reasoning || reasoningRaw.text || JSON.stringify(reasoningRaw))
        : reasoningRaw;

    // Project details (string or object).
    let projectDetails = project?.project_details;
    if (typeof projectDetails === 'string') {
        try { projectDetails = JSON.parse(projectDetails); } catch { projectDetails = {}; }
    }
    const projectLabels = projectDetails?.labels || [];
    const projectLegalCodes = projectDetails?.legal_codes || [];

    // Active AI labels (flags + threat_types + legacy)
    const activeLabels = resolveActiveLabels(projectLabels, review);
    const isAigc = review.is_aigc ?? review.flags?.is_aigc ?? analysis.aigc_check?.is_aigc ?? false;
    const isPoiPresent = review.face_present ?? review.flags?.poi_confirmed ??
        (analysis.poi_check?.poi_name_found || analysis.poi_check?.face_present) ?? false;

    // Legal codes — array of strings or { code, reasoning } objects.
    const legalCodesRaw = review.legal_codes || [];
    const legalCodes = legalCodesRaw.map(item => {
        if (typeof item === 'string') return { code: item, reasoning: '' };
        return { code: item.code || item.name, reasoning: item.reasoning || '' };
    }).filter(l => l.code);

    // Mini badges over the image (≤ 3 of the most important labels for compactness).
    const miniBadges = [];
    if (isAigc) miniBadges.push({ title: 'AIGC', color: 'purple' });
    if (isPoiPresent) miniBadges.push({ title: 'POI', color: 'emerald' });
    activeLabels.slice(0, 2).forEach(l => {
        const short = l.title.length > 4 ? l.title.substring(0, 3).toUpperCase() : l.title.toUpperCase();
        miniBadges.push({ title: short, color: l.color });
    });

    // Dates
    const postedDate = formatLongDate(post.posted_date || post.metadata?.posted_date || post.timestamp || post.sourcing_date);
    const alertDate = formatLongDate(post.updated_at || review.reviewed_at || post.created_at);

    // Stats
    const stats = post.stats || {};
    const platformLabel = (post.platform || 'Unknown').toUpperCase();
    const username = post.user?.username || 'unknown';
    const fullName = post.user?.full_name || post.user?.username || 'Unknown';
    const sourceUrl = post.original_url || post.url || '#';
    const imageUrl = compressedImage || post.signedImageUrl || post.image_url || null;

    // Status / takedown
    const statusBadge = getStatusBadge(post.client_status, post.takedown_info);

    // Audit log
    const auditEntries = Array.isArray(post.update_history) ? post.update_history.slice().reverse() : [];

    // Comments
    let comments = [];
    const rawComments = post.client_notes || post.notes || post.comments;
    if (Array.isArray(rawComments)) {
        comments = rawComments;
    } else if (typeof rawComments === 'string' && rawComments.trim() && rawComments !== '[]') {
        try { comments = JSON.parse(rawComments); }
        catch { comments = [{ text: rawComments }]; }
    }

    // Case title: prefer human-friendly post.post_id, fall back to last 5 chars of _id.
    const idStr = String(post._id || '');
    const caseNumber = post.post_id || (idStr ? `#${idStr.slice(-5)}` : '');
    const caseTitleText = caseNumber
        ? `Case ${typeof caseNumber === 'string' && caseNumber.startsWith('#') ? caseNumber : '#' + caseNumber}`
        : 'Case Detail';

    // Caption split into body + trailing hashtags so tags can render as links.
    const { body: captionBody, hashtags: captionTags } = splitCaptionAndTags(post.caption || post.content);

    return (
        <Page size="A4" style={styles.page}>
            <PageHeader />

            {/* CASE TITLE STRIP */}
            <View style={styles.caseTitleRow}>
                <View>
                    <Text style={styles.caseTitle}>{caseTitleText}</Text>
                    <Text style={styles.caseId}>ID: {idStr}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg, borderColor: statusBadge.line }]}>
                    <Text style={[styles.statusBadgeText, { color: statusBadge.fg }]}>{statusBadge.label}</Text>
                </View>
            </View>

            {/* ACCOUNT CARD */}
            <View style={styles.accountCard}>
                <AccountRow label="Account" value={`@${username}`} />
                <AccountRow label="Platform" value={platformLabel} />
                <AccountRow label="URL" value={sourceUrl} link={sourceUrl !== '#' ? sourceUrl : null} />
                <AccountRow label="Published" value={postedDate} />
                <AccountRow label="Alerted" value={alertDate} />
            </View>

            {/* TWO-COLUMN BODY */}
            <View style={styles.body}>

                {/* LEFT COLUMN */}
                <View style={styles.leftCol}>
                    {/* Media */}
                    <View style={styles.mediaCard}>
                        {imageUrl ? (
                            <Image src={imageUrl} style={styles.mediaImage} />
                        ) : (
                            <View style={styles.mediaPlaceholder}>
                                <Text style={{ color: Theme.MUTED, fontSize: 8 }}>No media available</Text>
                            </View>
                        )}
                        <View style={styles.mediaFooter}>
                            <View style={styles.inlineBadgeRow}>
                                {miniBadges.map((b, i) => {
                                    const p = badgePalette(b.color);
                                    return (
                                        <View key={i} style={[styles.miniBadge, { backgroundColor: p.bg, borderColor: p.line }]}>
                                            <Text style={[styles.miniBadgeText, { color: p.fg }]}>{b.title}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                            {sourceUrl !== '#' && (
                                <Link src={sourceUrl} style={styles.viewSourcePill}>
                                    <Text style={styles.viewSourceText}>View Source ↗</Text>
                                </Link>
                            )}
                        </View>
                    </View>

                    {/* User row — always use the deterministic colored-initials avatar.
                        Social-CDN profile_pic URLs frequently fail server-side rendering
                        (CORS / signed-URL expiry), so we skip the image attempt entirely
                        and match the web UI's ProfilePic fallback look. */}
                    <View style={styles.userRow}>
                        <View style={[styles.avatar, { backgroundColor: profilePicColor(username) }]}>
                            <Text style={styles.avatarLetter}>{profilePicInitials(username)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.userName}>{truncate(fullName, 50)}</Text>
                            <Text style={styles.userHandle}>@{truncate(username, 40)} · {platformLabel}</Text>
                        </View>
                    </View>

                    {/* Caption */}
                    <View>
                        <Text style={styles.sectionLabel}>Post Caption</Text>
                        {captionBody ? (
                            <Text style={styles.paragraph}>{truncate(captionBody, 1200)}</Text>
                        ) : !captionTags ? (
                            <Text style={[styles.paragraph, { color: Theme.MUTED }]}>Empty content field.</Text>
                        ) : null}
                        {captionTags ? (
                            <Text style={[styles.hashtagText, { marginTop: 6 }]}>{captionTags}</Text>
                        ) : null}
                    </View>

                    <View style={styles.sectionDivider} />

                    {/* Stats row 1: Platform / Handle / Followers */}
                    <View style={styles.kvGrid}>
                        <KV label="Platform" value={platformLabel} />
                        <KV label="User Handle" value={`@${username}`} />
                        <KV label="Followers" value={
                            post.user?.follower_count != null
                                ? Number(post.user.follower_count).toLocaleString()
                                : '—'
                        } />
                    </View>

                    {/* Stats row 2: Likes / Comments / Shares (or Views) */}
                    <View style={styles.kvGrid}>
                        <KV label="Likes" value={(stats.like_count ?? 0).toLocaleString()} />
                        <KV label="Comments" value={(stats.comment_count ?? 0).toLocaleString()} />
                        <KV
                            label={stats.view_count ? 'Views' : 'Shares'}
                            value={(stats.view_count ?? stats.share_count ?? 0).toLocaleString()}
                        />
                    </View>

                    {/* Stats row 3: Posted / Processed / Case ID */}
                    <View style={styles.kvGrid}>
                        <KV label="Posted On" value={formatLongDate(post.posted_date || post.metadata?.posted_date)} />
                        <KV label="Processed On" value={formatLongDate(post.updated_at || review.reviewed_at)} />
                        <KV label="Case ID" value={truncate(idStr, 14)} />
                    </View>
                </View>

                {/* RIGHT COLUMN */}
                <View style={styles.rightCol}>

                    {/* Legal Violations */}
                    {legalCodes.length > 0 && (
                        <View>
                            <Text style={styles.sectionLabel}>Legal Violations</Text>
                            {legalCodes.map((lc, i) => {
                                const isEven = i % 2 === 0;
                                const palette = isEven
                                    ? { bg: Theme.BADGE_ROSE_BG, line: Theme.BADGE_ROSE_LINE }
                                    : { bg: Theme.BADGE_ORANGE_BG, line: Theme.BADGE_ORANGE_LINE };
                                const projCode = projectLegalCodes.find(pc => pc.name === lc.code);
                                return (
                                    <View key={i} style={[styles.legalCard, { backgroundColor: palette.bg, borderColor: palette.line }]}>
                                        <View style={styles.legalCardHeader}>
                                            {isAigc && (
                                                <View style={styles.legalAigcBadge}>
                                                    <Text style={styles.legalAigcText}>AIGC</Text>
                                                </View>
                                            )}
                                            <Text style={styles.legalCode}>{lc.code}</Text>
                                        </View>
                                        {(lc.reasoning || projCode?.description) && (
                                            <Text style={styles.legalReasoning}>
                                                {truncate(lc.reasoning || projCode?.description || '', 320)}
                                            </Text>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* Content Reasoning */}
                    <View>
                        <Text style={styles.sectionLabel}>Content Reasoning</Text>
                        {(() => {
                            const sections = parseReasoning(reasoning);
                            if (sections.length === 0) {
                                return <Text style={styles.paragraph}>No detailed reasoning provided.</Text>;
                            }
                            if (sections.length === 1 && !sections[0].label) {
                                return <Text style={styles.paragraph}>{truncate(sections[0].content, 1000)}</Text>;
                            }
                            return sections.map((sec, i) => {
                                const isLast = i === sections.length - 1;
                                return (
                                    <View key={i} style={[styles.reasoningSection, isLast && styles.reasoningSectionLast]}>
                                        <Text style={styles.paragraph}>
                                            {sec.label ? <Text style={styles.reasoningLabel}>{sec.label}: </Text> : null}
                                            {truncate(sec.content, 320)}
                                        </Text>
                                    </View>
                                );
                            });
                        })()}
                    </View>

                    {/* AI Labels Detected */}
                    <View>
                        <Text style={styles.sectionLabel}>AI Labels Detected</Text>
                        <View style={styles.badgeRow}>
                            {isPoiPresent && <Badge color="emerald">POI Detected</Badge>}
                            {isAigc && <Badge color="purple">AI Generated</Badge>}
                            {activeLabels.map((l, i) => (
                                <Badge key={i} color={l.color}>{l.title}</Badge>
                            ))}
                            {!isPoiPresent && !isAigc && activeLabels.length === 0 && (
                                <Text style={{ fontSize: 8, color: Theme.MUTED }}>No labels detected.</Text>
                            )}
                        </View>
                    </View>

                    {/* Current AI Generated Risk */}
                    <View>
                        <Text style={styles.sectionLabel}>Current AI Generated Risk</Text>
                        <View style={[styles.riskBadgeOutline, { backgroundColor: riskInfo.bg, borderColor: riskInfo.line }]}>
                            <Text style={[styles.riskBadgeOutlineText, { color: riskInfo.color }]}>
                                {riskInfo.label}
                            </Text>
                        </View>
                    </View>

                    {/* Action Logs */}
                    {auditEntries.length > 0 && (
                        <View>
                            <Text style={styles.sectionLabel}>Action Logs</Text>
                            <View style={styles.auditWrap}>
                                {auditEntries.length > 1 && <View style={styles.auditLine} />}
                                {auditEntries.slice(0, 4).map((entry, i) => {
                                    const summary = entry.changes_summary === 'Manual ingestion from simplified JSON'
                                        ? 'Content was sourced and ingested into the system.'
                                        : (entry.changes_summary || '').replace(/client/g, 'user').replace(/Client/g, 'User');
                                    const isSystem = !/\S+@\S+\.\S+/.test(entry.updated_by || '');
                                    const who = isSystem ? 'System AI' : entry.updated_by;
                                    return (
                                        <View key={i} style={styles.auditEntry} wrap={false}>
                                            <View style={styles.auditDot}>
                                                {isSystem ? <SystemIcon /> : <UserIcon />}
                                            </View>
                                            <View style={styles.auditText}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                    <Text style={styles.auditWho}>
                                                        {truncate(who, 30)}
                                                    </Text>
                                                    <Text style={styles.auditWhen}>{formatShortDate(entry.updated_at)}</Text>
                                                </View>
                                                <Text style={styles.auditDetail}>{truncate(summary, 200)}</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                            {auditEntries.length > 4 && (
                                <Text style={{ fontSize: 7, color: Theme.SOFT, marginTop: 2 }}>
                                    + {auditEntries.length - 4} more log{auditEntries.length - 4 === 1 ? '' : 's'}
                                </Text>
                            )}
                        </View>
                    )}

                    {/* Comments */}
                    {comments.length > 0 && (
                        <View>
                            <Text style={styles.sectionLabel}>Comments</Text>
                            {comments.slice(0, 3).map((c, i) => (
                                <View key={i} style={styles.commentBox} wrap={false}>
                                    {(c.email || c.created_at) && (
                                        <View style={styles.commentMeta}>
                                            <Text style={styles.commentMetaText}>{truncate(c.email || 'Unknown', 30)}</Text>
                                            {c.created_at && (
                                                <Text style={styles.commentMetaText}>{formatShortDate(c.created_at)}</Text>
                                            )}
                                        </View>
                                    )}
                                    <Text style={styles.commentText}>{truncate(c.text || '', 320)}</Text>
                                </View>
                            ))}
                            {comments.length > 3 && (
                                <Text style={{ fontSize: 7, color: Theme.SOFT, marginTop: 2 }}>
                                    + {comments.length - 3} more comment{comments.length - 3 === 1 ? '' : 's'}
                                </Text>
                            )}
                        </View>
                    )}
                </View>
            </View>

            <PageFooter />
        </Page>
    );
};

export const SingleCaseReportDocument = ({ post, project, compressedImage }) => (
    <Document title={`CaseExport_${post._id}`}>
        <SingleCasePage post={post} project={project} compressedImage={compressedImage} />
    </Document>
);

export default SingleCaseReportDocument;
