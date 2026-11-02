import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Link } from '@react-pdf/renderer';
import { registerFonts } from './utils/FontRegister';
import {
  DomainTheme as Theme,
  processText,
  formatDateTime,
  formatVerdictLabel,
  groupTypeLabel,
  groupUsernameLabel,
  groupSourceLabel,
  groupFlagLabel,
  groupSeverityInfo,
  groupFlaggedMessages,
  groupTotalFlaggedMessages,
  groupMediaEvidence,
  groupPromotedLinks,
  groupActorsForPromotedLink,
  groupActorRoleLabel,
  isTelegramGroupPhotoRef,
  buildGroupReviewModel,
} from './telegramGroupPdfShared';

registerFonts();

/** Review-page caps. */
const MAX_REVIEW_VIOLATIONS = 10;
const MAX_REVIEW_LEGAL_CODES = 8;
const MAX_PROMOTED_LINKS = 6;
/** Gallery caps. */
const MAX_GALLERY_MESSAGES = 12;
const MAX_MESSAGE_TEXT = 620;
/** Analysis-page caps. */
const MAX_EVIDENCE_IMAGES = 8;
const MAX_EVIDENCE_TEXT = 260;
const MAX_BATCH_SUMMARIES = 8;

/** Per-group section numbers (the group itself is numbered by caseNumber). */
const SECTION_FLAGGED_MESSAGES = 1;
const SECTION_AI_ANALYSIS = 2;

const styles = StyleSheet.create({
  page: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 26,
    fontFamily: ['Outfit', 'Mukta'],
    backgroundColor: Theme.SURFACE,
    color: Theme.INK,
  },
  /* ---- fixed chrome ---- */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 0.5,
    borderBottomColor: Theme.LINE,
    paddingBottom: 5,
    marginBottom: 8,
  },
  brandTitle: { fontSize: 15, fontWeight: 900, color: Theme.INK, letterSpacing: 0.3 },
  brandSubtitle: { fontSize: 6.5, color: Theme.MUTED, textTransform: 'uppercase', letterSpacing: 1.3 },
  headerRight: { alignItems: 'flex-end', maxWidth: '55%' },
  headerTitle: { fontSize: 8, fontWeight: 700, color: Theme.INK },
  headerMeta: { fontSize: 6.5, color: Theme.MUTED, marginTop: 1 },
  footer: {
    position: 'absolute',
    bottom: 10,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 6.5,
    color: Theme.MUTED,
    borderTopWidth: 0.5,
    borderTopColor: Theme.LINE,
    paddingTop: 5,
  },
  /* ---- headings ---- */
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionHeadingText: {
    fontSize: 11,
    fontWeight: 900,
    color: Theme.PRIMARY_BLUE,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  sectionHeadingMeta: { fontSize: 6.5, color: Theme.MUTED },
  hookHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 5,
  },
  hookTitle: { fontSize: 16, fontWeight: 700, color: Theme.INK, flex: 1, lineHeight: 1.2 },
  /* ---- columns ---- */
  columns: { flexDirection: 'row', gap: 10 },
  leftCol: { width: '57%' },
  rightCol: { width: '43%' },
  reviewColumns: { flexDirection: 'row', alignItems: 'flex-start' },
  reviewMain: { flex: 1, paddingRight: 12 },
  reviewLegal: { width: '44%', borderLeftWidth: 0.5, borderLeftColor: Theme.LINE, paddingLeft: 12 },
  /* ---- cards ---- */
  card: {
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    borderRadius: 6,
    padding: 9,
    marginBottom: 6,
    backgroundColor: Theme.SURFACE,
  },
  cardLabel: {
    fontSize: 8,
    fontWeight: 900,
    color: Theme.PRIMARY_BLUE,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  subLabel: {
    fontSize: 6.5,
    fontWeight: 900,
    color: Theme.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.55,
    marginTop: 5,
    marginBottom: 2,
  },
  /* ---- key/value ---- */
  kvGridRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  kvItem: { marginBottom: 3 },
  kvLabel: {
    fontSize: 6,
    color: Theme.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  kvValue: { fontSize: 8, color: Theme.INK, fontWeight: 700, lineHeight: 1.3 },
  kvValueSoft: { fontSize: 8, color: Theme.INK_SOFT, lineHeight: 1.3 },
  kvLink: { fontSize: 7.5, color: Theme.LINK, fontWeight: 700, textDecoration: 'none', lineHeight: 1.3 },
  /* ---- risk / violations ---- */
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 0.5,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  riskText: { fontSize: 7.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.7 },
  reverseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 2 },
  pill: {
    backgroundColor: Theme.RISK_HIGH_BG,
    borderWidth: 0.5,
    borderColor: Theme.RISK_HIGH,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pillText: { fontSize: 7, fontWeight: 700, color: Theme.RISK_HIGH, textTransform: 'capitalize' },
  legalShell: {
    flexDirection: 'row',
    borderWidth: 0.5,
    borderColor: Theme.RISK_HIGH_BORDER,
    borderRadius: 4,
    backgroundColor: Theme.RISK_HIGH_BG,
    overflow: 'hidden',
    marginBottom: 2,
  },
  legalAccent: { width: 3, backgroundColor: Theme.RISK_HIGH },
  legalInner: { flex: 1, paddingVertical: 3, paddingHorizontal: 7 },
  legalCode: { fontSize: 7, fontWeight: 900, color: Theme.RISK_HIGH, marginBottom: 1 },
  legalReason: { fontSize: 6.5, color: Theme.INK_SOFT, lineHeight: 1.3 },
  /* ---- prose ---- */
  caseSummaryText: { fontSize: 9.5, color: Theme.INK, lineHeight: 1.4 },
  bodyText: { fontSize: 8, color: Theme.INK_SOFT, lineHeight: 1.4 },
  softText: { fontSize: 8, color: Theme.MUTED, lineHeight: 1.4 },
  /* ---- verdict hero ---- */
  verdictHero: {
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  verdictHeroValue: {
    fontSize: 19,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    lineHeight: 1.1,
    marginBottom: 7,
  },
  verdictActionLabel: {
    fontSize: 6,
    fontWeight: 900,
    color: Theme.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  verdictActionText: { fontSize: 9.5, fontWeight: 700, color: Theme.INK, lineHeight: 1.35 },
  /* ---- flagged actors (inside the verdict card) ---- */
  actorBlock: {
    borderTopWidth: 0.5,
    borderTopColor: Theme.LINE,
    paddingTop: 6,
    marginTop: 2,
  },
  actorBlockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  actorCount: { fontSize: 6, color: Theme.MUTED, fontWeight: 700 },
  actorRow: {
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 7,
    marginBottom: 5,
    backgroundColor: Theme.SURFACE_ALT,
  },
  actorName: { fontSize: 8.5, fontWeight: 900, color: Theme.INK },
  actorRole: {
    fontSize: 6,
    fontWeight: 700,
    color: Theme.PRIMARY_BLUE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
    marginBottom: 2,
  },
  actorWhy: { fontSize: 7, color: Theme.INK_SOFT, lineHeight: 1.35, marginTop: 3 },
  /* ---- telegram gallery ---- */
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  msgCard: {
    width: '48.5%',
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    borderRadius: 6,
    padding: 7,
    backgroundColor: Theme.SURFACE,
    marginBottom: 8,
  },
  msgHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  msgAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Theme.LINK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgAvatarText: { fontSize: 8, color: '#FFFFFF', fontWeight: 900 },
  msgSenderWrap: { flex: 1 },
  msgSender: { fontSize: 7, fontWeight: 900, color: Theme.INK },
  msgMeta: { fontSize: 5.5, color: Theme.MUTED, marginTop: 1 },
  sevBadge: { borderWidth: 0.5, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1 },
  sevText: { fontSize: 5.5, fontWeight: 900, textTransform: 'uppercase' },
  bubble: {
    backgroundColor: Theme.SURFACE_ALT,
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 7,
    marginBottom: 4,
  },
  bubbleText: { fontSize: 7, color: Theme.INK_SOFT, lineHeight: 1.35 },
  translation: {
    borderLeftWidth: 2,
    borderLeftColor: Theme.LINK,
    paddingLeft: 6,
    marginBottom: 4,
  },
  translationLabel: {
    fontSize: 5,
    fontWeight: 900,
    color: Theme.LINK,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  translationText: { fontSize: 6.5, color: Theme.MUTED, lineHeight: 1.3 },
  msgImage: {
    width: '100%',
    height: 96,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    objectFit: 'cover',
    objectPosition: 'top',
    marginBottom: 4,
    backgroundColor: Theme.SURFACE_ALT,
  },
  findingBox: {
    borderTopWidth: 0.5,
    borderTopColor: Theme.LINE,
    paddingTop: 3,
    marginTop: 1,
  },
  findingLabel: {
    fontSize: 5,
    fontWeight: 900,
    color: Theme.PRIMARY_BLUE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  findingText: { fontSize: 6.5, color: Theme.INK_SOFT, lineHeight: 1.3 },
  /* ---- evidence grid ---- */
  evidenceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  evidenceCard: {
    width: '48.5%',
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: Theme.SURFACE,
  },
  evidenceImage: {
    width: '100%',
    height: 118,
    objectFit: 'cover',
    objectPosition: 'top',
    backgroundColor: Theme.SURFACE_ALT,
  },
  evidenceBody: { padding: 6 },
  evidenceHead: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  evidenceAvatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Theme.LINK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  evidenceAvatarText: { fontSize: 6.5, color: '#FFFFFF', fontWeight: 900 },
  evidenceProfile: { fontSize: 6.5, fontWeight: 900, color: Theme.INK },
  evidenceMeta: { fontSize: 5.5, color: Theme.MUTED, marginTop: 1 },
  evidenceQuote: {
    fontSize: 6.5,
    color: Theme.INK,
    lineHeight: 1.3,
    borderLeftWidth: 2,
    borderLeftColor: Theme.BORDER_LIGHT,
    paddingLeft: 5,
    marginBottom: 4,
  },
  evidenceFindingLabel: {
    fontSize: 5,
    fontWeight: 900,
    color: Theme.PRIMARY_BLUE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  evidenceText: { fontSize: 6.5, color: Theme.INK_SOFT, lineHeight: 1.3 },
  /* ---- image findings without a stored image ---- */
  findingRow: {
    flexDirection: 'row',
    gap: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: Theme.LINE,
    paddingVertical: 4,
  },
  findingRowId: { width: 74, fontSize: 6.5, fontWeight: 900, color: Theme.PRIMARY_BLUE },
  findingRowBody: { flex: 1 },
  findingRowMeta: { fontSize: 5.5, color: Theme.MUTED, marginBottom: 1 },
  /* ---- monetisation ---- */
  promotedCard: {
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    borderRadius: 5,
    padding: 9,
    marginBottom: 8,
    backgroundColor: Theme.SURFACE_ALT,
  },
  promotedHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 5 },
  promotedName: { fontSize: 10, fontWeight: 900, color: Theme.INK, flex: 1, lineHeight: 1.2 },
  promotedTag: {
    fontSize: 5.5,
    fontWeight: 900,
    color: Theme.RISK_HIGH,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promotedWhat: { fontSize: 7.5, color: Theme.INK_SOFT, lineHeight: 1.4, marginBottom: 5 },
  promotedFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 2 },
  promotedFact: {
    borderWidth: 0.5,
    borderColor: Theme.BORDER_LIGHT,
    backgroundColor: Theme.BG_SECTION,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  promotedFactLabel: { fontSize: 5, color: Theme.MUTED, textTransform: 'uppercase', fontWeight: 'bold' },
  promotedFactValue: { fontSize: 6.5, color: Theme.INK, fontWeight: 700 },
  promotedActor: {
    borderTopWidth: 0.5,
    borderTopColor: Theme.LINE,
    paddingTop: 5,
    marginTop: 5,
  },
  promotedActorLabel: {
    fontSize: 5.5,
    fontWeight: 900,
    color: Theme.PRIMARY_BLUE,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  /* ---- batch list ---- */
  batchRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  batchTag: {
    fontSize: 6,
    fontWeight: 900,
    color: Theme.PRIMARY_BLUE,
    width: 42,
  },
  batchText: { flex: 1, fontSize: 7.5, color: Theme.INK_SOFT, lineHeight: 1.35 },
});

const displayValue = (value, max = 60) => {
  const text = value == null ? '' : String(value).trim();
  if (!text) return '—';
  return processText(text, max) || text;
};

const numeric = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-IN') : null;

const Header = ({ group }) => (
  <View style={styles.header} fixed>
    <View>
      <Text style={styles.brandTitle}>Overwatch</Text>
      <Text style={styles.brandSubtitle}>Telegram Group Integrity</Text>
    </View>
    <View style={styles.headerRight}>
      <Text style={styles.headerTitle}>{processText(group.title || 'Unknown group', 46)}</Text>
      <Text style={styles.headerMeta}>{groupUsernameLabel(group)}</Text>
    </View>
  </View>
);

const Footer = () => (
  <View style={styles.footer} fixed>
    <Text>Confidential Document</Text>
    <Text>Powered by Contrails AI</Text>
    <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
  </View>
);

const RiskBadge = ({ risk }) => (
  <View style={[styles.riskBadge, { backgroundColor: risk.bg, borderColor: risk.border }]}>
    <Text style={[styles.riskText, { color: risk.color }]}>{risk.label}</Text>
  </View>
);

const FLAG_ROWS = [
  ['Verified', 'verified'],
  ['Restricted', 'restricted'],
  ['Scam', 'scam'],
  ['Fake', 'fake'],
  ['Broadcast', 'broadcast'],
  ['Megagroup', 'megagroup'],
  ['Members visible', 'members_visible'],
];

const KeyValue = ({ label, children }) => (
  <View style={styles.kvItem}>
    <Text style={styles.kvLabel}>{label}</Text>
    {children}
  </View>
);

/* ------------------------------------------------------------------ *
 * Page 1 — group details + the complete review                       *
 * ------------------------------------------------------------------ */

const GroupDetailsCard = ({ group }) => {
  const rows = [
    ['Type', groupTypeLabel(group)],
    ['Username', groupUsernameLabel(group)],
    ['Chat ID', group.chat_id != null ? String(group.chat_id) : null],
    ['Linked chat ID', group.linked_chat_id != null ? String(group.linked_chat_id) : null],
    ['Username list', (group.username_list || []).join(', ')],
    ['Participants', numeric(group.participant_count)],
    ['Messages', numeric(group.message_count)],
    ['First seen', formatDateTime(group.first_seen_at)],
    ['Last message', formatDateTime(group.last_message_at)],
    ['Telegram link', group.original_url],
  ];
  const half = Math.ceil(rows.length / 2);

  const renderRow = ([label, value]) => (
    <KeyValue key={label} label={label}>
      {label === 'Telegram link' && value ? (
        <Link src={value} style={styles.kvLink}>
          {groupSourceLabel(group) || processText(value, 40)}
        </Link>
      ) : (
        <Text style={styles.kvValue}>{displayValue(value, 40)}</Text>
      )}
    </KeyValue>
  );

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Group Details</Text>
      <View style={styles.kvGridRow}>
        <View style={{ flex: 1 }}>{rows.slice(0, half).map(renderRow)}</View>
        <View style={{ flex: 1 }}>{rows.slice(half).map(renderRow)}</View>
      </View>
      <Text style={[styles.subLabel, { marginTop: 6 }]}>Channel Flags</Text>
      <View style={styles.pillRow}>
        {FLAG_ROWS.map(([label, key]) => (
          <View key={key} style={[styles.pill, { backgroundColor: Theme.BG_SECTION, borderColor: Theme.BORDER_LIGHT }]}>
            <Text style={[styles.pillText, { color: Theme.SECONDARY_GRAY }]}>
              {label}: {groupFlagLabel(group[key])}
            </Text>
          </View>
        ))}
      </View>
      <Text style={[styles.subLabel, { marginTop: 6 }]}>About</Text>
      {group.about ? (
        <Text style={styles.bodyText}>{processText(group.about, 420, 6)}</Text>
      ) : (
        <Text style={styles.softText}>No channel description captured.</Text>
      )}
    </View>
  );
};

const FlaggedActorsBlock = ({ actors }) => {
  if (!Array.isArray(actors) || actors.length === 0) return null;
  return (
    <View style={styles.actorBlock}>
      <View style={styles.actorBlockHead}>
        <Text style={[styles.cardLabel, { marginBottom: 0 }]}>Flagged Actors</Text>
        <Text style={styles.actorCount}>
          {actors.length} identified
        </Text>
      </View>
      {actors.map((actor) => (
        <View key={actor.actor_key || actor.name} style={styles.actorRow} wrap={false}>
          <Text style={styles.actorName}>{processText(actor.name, 48)}</Text>
          {actor.role ? <Text style={styles.actorRole}>{groupActorRoleLabel(actor.role)}</Text> : null}
          {actor.violations.length > 0 ? (
            <View style={styles.pillRow}>
              {actor.violations.slice(0, MAX_REVIEW_VIOLATIONS).map((violation) => (
                <View key={violation} style={styles.pill}>
                  <Text style={[styles.pillText, { fontSize: 6 }]}>{processText(violation, 26)}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {actor.why ? <Text style={styles.actorWhy}>{processText(actor.why, 300, 4)}</Text> : null}
        </View>
      ))}
    </View>
  );
};

const VerdictCard = ({ group, review }) => {
  const actors = Array.isArray(group.ai?.flagged_actors) ? group.ai.flagged_actors : [];
  const verdict = review.verdict ? String(review.verdict) : '';
  const action = review.recommendedAction ? String(review.recommendedAction) : '';
  const heroValue = verdict
    ? formatVerdictLabel(verdict)
    : review.hasSignal || review.hasAiAnalysis
      ? 'No verdict recorded'
      : 'Not reviewed';
  const heroSize = !verdict && (review.hasSignal || review.hasAiAnalysis) ? 13 : null;

  return (
    <View style={styles.card}>
      <View style={styles.reverseRow}>
        <Text style={[styles.cardLabel, { marginBottom: 0 }]}>Verdict</Text>
        <RiskBadge risk={review.risk} />
      </View>

      <View
        style={[
          styles.verdictHero,
          { backgroundColor: review.risk.bg, borderColor: review.risk.border, borderLeftColor: review.risk.color },
        ]}
        wrap={false}
      >
        <Text style={[styles.verdictHeroValue, { color: review.risk.color }, heroSize ? { fontSize: heroSize } : null]}>
          {heroValue}
        </Text>
        <Text style={styles.verdictActionLabel}>Recommended action</Text>
        <Text style={styles.verdictActionText}>{action ? processText(action, 150, 3) : '—'}</Text>
      </View>

      <FlaggedActorsBlock actors={actors} />
    </View>
  );
};

const OperatorCard = ({ group }) => {
  const operator = group.ai?.operator_involvement || {};
  if (!operator.present && !operator.how && (operator.handles || []).length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Operator Involvement</Text>
      {operator.how ? <Text style={styles.bodyText}>{processText(operator.how, 520, 6)}</Text> : null}
      {(operator.handles || []).length > 0 ? (
        <>
          <Text style={styles.subLabel}>Handles</Text>
          <View style={styles.pillRow}>
            {operator.handles.map((handle) => (
              <View key={handle} style={[styles.pill, { backgroundColor: Theme.BG_SECTION, borderColor: Theme.BORDER_LIGHT }]}>
                <Text style={[styles.pillText, { color: Theme.PRIMARY_BLUE }]}>{processText(handle, 32)}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
};

const ViolationPill = ({ name, severity }) => {
  const tone = groupSeverityInfo(severity);
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.pillText, { color: tone.color }]}>{processText(name, 30)}</Text>
    </View>
  );
};

const ReviewDetailsCard = ({ review }) => (
  <View style={styles.card}>
    <View style={styles.reverseRow}>
      <Text style={[styles.cardLabel, { marginBottom: 0 }]}>Review Details</Text>
      <RiskBadge risk={review.risk} />
    </View>

    <View style={styles.reviewColumns}>
      <View style={styles.reviewMain}>
        <Text style={[styles.subLabel, { marginTop: 0 }]}>Case Summary</Text>
        {review.caseSummary ? (
          <Text style={styles.caseSummaryText}>{processText(review.caseSummary, 560, 7)}</Text>
        ) : (
          <Text style={styles.softText}>No case summary recorded for this group.</Text>
        )}

        {review.violations.length > 0 ? (
          <View style={{ marginTop: 7 }}>
            <Text style={styles.subLabel}>Detected Violations</Text>
            <View style={styles.pillRow}>
              {review.violations.slice(0, MAX_REVIEW_VIOLATIONS).map((violation) => (
                <ViolationPill key={violation.name} name={violation.name} severity={violation.severity} />
              ))}
            </View>
          </View>
        ) : null}

        {review.reviewerComments ? (
          <View style={{ marginTop: 7 }}>
            <Text style={styles.subLabel}>Reviewer Comments</Text>
            <Text style={styles.bodyText}>{processText(review.reviewerComments, 260, 4)}</Text>
          </View>
        ) : null}

        {!review.hasSignal && !review.hasAiAnalysis ? (
          <Text style={[styles.softText, { marginTop: 6 }]}>
            Not yet reviewed. This group has no threat score, violations or legal findings attached yet.
          </Text>
        ) : null}
      </View>

      <View style={styles.reviewLegal}>
        <Text style={[styles.subLabel, { marginTop: 0 }]}>Legal Violations</Text>
        {review.legalCodes.length > 0 ? (
          review.legalCodes.slice(0, MAX_REVIEW_LEGAL_CODES).map((item, index) => (
            <View key={index} style={styles.legalShell} wrap={false}>
              <View style={styles.legalAccent} />
              <View style={styles.legalInner}>
                <Text style={styles.legalCode}>{processText(item.code, 90)}</Text>
                {item.reasoning ? (
                  <Text style={styles.legalReason}>{processText(item.reasoning, 320, 5)}</Text>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.softText}>No legal findings recorded.</Text>
        )}
        {review.legalCodes.length > MAX_REVIEW_LEGAL_CODES ? (
          <Text style={styles.softText}>
            + {review.legalCodes.length - MAX_REVIEW_LEGAL_CODES} more in the AI analysis section
          </Text>
        ) : null}
      </View>
    </View>
  </View>
);

const ProfilePage = ({ group, caseNumber, project }) => {
  const review = buildGroupReviewModel(group, project);
  return (
    <Page size="A4" style={styles.page}>
      <Header group={group} />

      <View style={styles.hookHeading} wrap={false}>
        <Text style={styles.hookTitle}>
          {caseNumber}. {processText(group.title || 'Unknown group', 60)}
        </Text>
      </View>

      <View style={styles.columns}>
        <View style={styles.leftCol}>
          <GroupDetailsCard group={group} />
        </View>
        <View style={styles.rightCol}>
          <VerdictCard group={group} review={review} />
        </View>
      </View>

      <ReviewDetailsCard review={review} />

      <OperatorCard group={group} />

      <Footer />
    </Page>
  );
};

/* ------------------------------------------------------------------ *
 * Section — flagged messages (Telegram format)                        *
 * ------------------------------------------------------------------ */

const MessageCard = ({ group, message }) => {
  const severity = groupSeverityInfo(message.severity);
  const senderName = group.username ? `@${group.username}` : group.title || 'Channel';
  const english = message.english && message.english !== message.quote ? message.english : '';
  const bubbleText = message.text || message.quote || '(media message)';

  return (
    <View style={styles.msgCard} wrap={false}>
      <View style={styles.msgHead}>
        <View style={styles.msgAvatar}>
          <Text style={styles.msgAvatarText}>{(group.username || group.title || 'T').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.msgSenderWrap}>
          <Text style={styles.msgSender}>{processText(senderName, 30)}</Text>
          <Text style={styles.msgMeta}>
            {message.date ? formatDateTime(message.date) : '—'}
            {message.views != null ? ` · ${numeric(message.views)} views` : ''}
            {message.message_id != null ? ` · #${message.message_id}` : ''}
          </Text>
        </View>
        <View style={[styles.sevBadge, { backgroundColor: severity.bg, borderColor: severity.border }]}>
          <Text style={[styles.sevText, { color: severity.color }]}>{severity.label}</Text>
        </View>
      </View>

      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>{processText(bubbleText, MAX_MESSAGE_TEXT, 9)}</Text>
      </View>

      {english ? (
        <View style={styles.translation}>
          <Text style={styles.translationLabel}>Explanation</Text>
          <Text style={styles.translationText}>{processText(english, 320, 5)}</Text>
        </View>
      ) : null}

      {message.localPath ? <Image style={styles.msgImage} src={message.localPath} /> : null}

      {message.finding ? (
        <View style={styles.findingBox}>
          <Text style={styles.findingLabel}>Violation Reasoning</Text>
          <Text style={styles.findingText}>{processText(message.finding, 320, 5)}</Text>
        </View>
      ) : null}

      {message.violations.length > 0 ? (
        <View style={[styles.pillRow, { marginTop: 4 }]}>
          {message.violations.slice(0, 2).map((violation) => (
            <View key={violation} style={styles.pill}>
              <Text style={[styles.pillText, { fontSize: 5.5 }]}>{processText(violation, 26)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const FlaggedMessagesPages = ({ group }) => {
  const total = groupTotalFlaggedMessages(group);
  if (total === 0) return null;
  const messages = groupFlaggedMessages(group, MAX_GALLERY_MESSAGES);

  return (
    <Page size="A4" style={styles.page}>
      <Header group={group} />
      <View style={styles.sectionHeading} wrap={false}>
        <Text style={styles.sectionHeadingText}>
          {SECTION_FLAGGED_MESSAGES}. Flagged Messages
        </Text>
        <Text style={styles.sectionHeadingMeta}>
          {total > messages.length
            ? `${messages.length} of ${total} flagged messages shown`
            : `${messages.length} flagged messages`}
        </Text>
      </View>
      {/* Cards flow and paginate as they fit; a card never splits across pages. */}
      <View style={styles.galleryGrid}>
        {messages.map((message) => (
          <MessageCard key={`${message.message_id}-${message.index}`} group={group} message={message} />
        ))}
      </View>
      <Footer />
    </Page>
  );
};

/* ------------------------------------------------------------------ *
 * Section — AI analysis & evidence                                    *
 * ------------------------------------------------------------------ */

/** `#21` for a message, `Group photo` for the channel picture pseudo-id. */
const messageRefLabel = (messageId) => {
  if (messageId == null) return '';
  if (typeof messageId === 'number') return `#${messageId}`;
  return isTelegramGroupPhotoRef(messageId)
    ? 'Group photo'
    : processText(String(messageId).replace(/[_-]+/g, ' '), 24);
};

const PromotedLinkCard = ({ group, link }) => {
  const actors = groupActorsForPromotedLink(group, link);
  return (
    <View style={styles.promotedCard} wrap={false}>
      <View style={styles.promotedHead}>
        <Text style={styles.promotedName}>{processText(link.name, 80)}</Text>
        <Text style={[styles.promotedTag, link.monetised ? null : { color: Theme.SECONDARY_GRAY }]}>
          {link.monetised ? 'Monetised' : 'Not monetised'}
        </Text>
      </View>

      {link.what.length > 0 ? (
        <Text style={styles.promotedWhat}>{processText(link.what.join(' '), 340, 4)}</Text>
      ) : null}

      <View style={styles.promotedFacts}>
        <View style={styles.promotedFact}>
          <Text style={styles.promotedFactLabel}>Type</Text>
          <Text style={styles.promotedFactValue}>{link.kind === 'handle' ? 'Promoted handle' : 'Promoted service'}</Text>
        </View>
        {link.message_ids.length > 0 ? (
          <View style={styles.promotedFact}>
            <Text style={styles.promotedFactLabel}>Linked messages</Text>
            <Text style={styles.promotedFactValue}>{link.message_ids.length}</Text>
          </View>
        ) : null}
        {link.price_mentions.slice(0, 4).map((price) => (
          <View key={price} style={styles.promotedFact}>
            <Text style={styles.promotedFactLabel}>Payout</Text>
            <Text style={styles.promotedFactValue}>{processText(price, 28)}</Text>
          </View>
        ))}
      </View>

      {actors.length > 0 ? (
        <View style={styles.promotedActor}>
          <Text style={styles.promotedActorLabel}>Linked flagged actor</Text>
          {actors.map((actor) => (
            <View key={actor.actor_key || actor.name} style={{ marginBottom: 3 }}>
              <Text style={styles.actorName}>{processText(actor.name, 48)}</Text>
              {actor.role ? <Text style={styles.actorRole}>{groupActorRoleLabel(actor.role)}</Text> : null}
              {actor.violations.length > 0 ? (
                <Text style={styles.kvValueSoft}>{actor.violations.join(' · ')}</Text>
              ) : null}
              {actor.why ? <Text style={styles.actorWhy}>{processText(actor.why, 280, 3)}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const EvidenceCard = ({ group, entry }) => {
  const senderName = group.username ? `@${group.username}` : group.title || 'Channel';
  const initial = (group.username || group.title || 'T').charAt(0).toUpperCase();
  const ref = messageRefLabel(entry.message_id);
  const isGroupPhoto = isTelegramGroupPhotoRef(entry.message_id);
  return (
    <View style={styles.evidenceCard} wrap={false}>
      {entry.localPath ? <Image style={styles.evidenceImage} src={entry.localPath} /> : null}
      <View style={styles.evidenceBody}>
        <View style={styles.evidenceHead}>
          <View style={styles.evidenceAvatar}>
            <Text style={styles.evidenceAvatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.evidenceProfile}>{processText(senderName, 34)}</Text>
            <Text style={styles.evidenceMeta}>
              {entry.date ? formatDateTime(entry.date) : isGroupPhoto ? 'Group profile photo' : 'No date recorded'}
              {entry.views != null ? ` · ${numeric(entry.views)} views` : ''}
              {ref ? ` · ${ref}` : ''}
            </Text>
          </View>
        </View>

        {entry.text ? (
          <Text style={styles.evidenceQuote}>{processText(entry.text, MAX_EVIDENCE_TEXT, 4)}</Text>
        ) : null}

        <Text style={styles.evidenceFindingLabel}>Image finding</Text>
        <Text style={styles.evidenceText}>{processText(entry.finding, 320, 6)}</Text>
      </View>
    </View>
  );
};

const ImageFindingRow = ({ entry }) => {
  const ref = messageRefLabel(entry.message_id);
  return (
    <View style={styles.findingRow} wrap={false}>
      <Text style={styles.findingRowId}>{ref || 'Image'}</Text>
      <View style={styles.findingRowBody}>
        <Text style={styles.findingRowMeta}>
          {entry.date ? formatDateTime(entry.date) : 'No image stored'}
          {entry.views != null ? ` · ${numeric(entry.views)} views` : ''}
        </Text>
        <Text style={styles.evidenceText}>{processText(entry.finding, 320, 4)}</Text>
      </View>
    </View>
  );
};

const AnalysisPage = ({ group }) => {
  const ai = group.ai || {};
  const evidence = groupMediaEvidence(group, MAX_EVIDENCE_IMAGES);
  const batches = (ai.batch_summaries || []).slice(0, MAX_BATCH_SUMMARIES);
  const links = groupPromotedLinks(group);
  const imageEvidence = evidence.filter((entry) => entry.localPath);
  const textFindings = evidence.filter((entry) => !entry.localPath);

  const hasAnalysis = Boolean(ai.analysis);
  if (!hasAnalysis && evidence.length === 0 && batches.length === 0 && links.length === 0) return null;

  return (
    <Page size="A4" style={styles.page}>
      <Header group={group} />

      <View style={styles.sectionHeading} wrap={false}>
        <Text style={styles.sectionHeadingText}>
          {SECTION_AI_ANALYSIS}. AI Analysis &amp; Evidence
        </Text>
        <Text style={styles.sectionHeadingMeta}>
          {ai.batches ? `${ai.batches} message batches` : ''}
          {ai.media_basis ? ` · ${ai.media_basis}` : ''}
        </Text>
      </View>

      {hasAnalysis ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Detailed AI Analysis</Text>
          <Text style={styles.bodyText}>{processText(ai.analysis, 2600, 40)}</Text>
        </View>
      ) : null}

      {batches.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Message Batch Summaries</Text>
          {batches.map((batch) => (
            <View key={batch.batch} style={styles.batchRow} wrap={false}>
              <Text style={styles.batchTag}>Batch {batch.batch}</Text>
              <Text style={styles.batchText}>{processText(batch.summary, 420, 6)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {evidence.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel} minPresenceAhead={150}>
            Image Evidence
          </Text>
          {imageEvidence.length > 0 ? (
            <View style={styles.evidenceGrid}>
              {imageEvidence.map((entry, index) => (
                <EvidenceCard key={`${entry.message_id}-${index}`} group={group} entry={entry} />
              ))}
            </View>
          ) : (
            <Text style={styles.softText}>No evidence images were stored for this group.</Text>
          )}

          {textFindings.length > 0 ? (
            <View style={{ marginTop: imageEvidence.length > 0 ? 4 : 0 }}>
              <Text style={[styles.subLabel, { marginTop: imageEvidence.length > 0 ? 4 : 0 }]}>
                Additional image findings (no stored image)
              </Text>
              {textFindings.map((entry, index) => (
                <ImageFindingRow key={`${entry.message_id}-${index}`} entry={entry} />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {links.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel} minPresenceAhead={220}>
            Monetisation &amp; Promoted Handles
          </Text>
          <Text style={[styles.softText, { marginBottom: 7 }]}>
            Services and handles promoted by the channel, with the flagged actor behind each one.
          </Text>
          {links.slice(0, MAX_PROMOTED_LINKS).map((link) => (
            <PromotedLinkCard key={`${link.kind}:${link.name}`} group={group} link={link} />
          ))}
        </View>
      ) : null}

      <Footer />
    </Page>
  );
};

const ClientNotesCard = ({ group }) => {
  const notes = Array.isArray(group?.client_notes) ? group.client_notes : [];
  if (notes.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Client Notes</Text>
      {notes.map((note, index) => (
        <View key={index} style={{ marginBottom: 4 }}>
          {note?.created_at || note?.email ? (
            <Text style={styles.kvLabel}>
              {[note?.email, note?.created_at].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          <Text style={styles.kvValueSoft}>{displayValue(note?.text, 220)}</Text>
        </View>
      ))}
    </View>
  );
};

const NotesPage = ({ group, caseNumber }) => {
  const notes = Array.isArray(group?.client_notes) ? group.client_notes : [];
  if (notes.length === 0) return null;
  return (
    <Page size="A4" style={styles.page}>
      <Header group={group} />
      <View style={styles.sectionHeading} wrap={false}>
        <Text style={styles.sectionHeadingText}>{caseNumber}. Client Notes</Text>
      </View>
      <ClientNotesCard group={group} />
      <Footer />
    </Page>
  );
};

export const TelegramGroupsDetailedReportDocument = ({ groups: groupsProp, posts, project }) => {
  const groups = groupsProp || posts || [];
  return (
    <Document>
      {groups.map((group, index) => (
        <React.Fragment key={group._id}>
          <ProfilePage group={group} caseNumber={index + 1} project={project} />
          <FlaggedMessagesPages group={group} />
          <AnalysisPage group={group} />
          <NotesPage group={group} caseNumber={index + 1} />
        </React.Fragment>
      ))}
    </Document>
  );
};

export const TelegramGroupsDetailed = TelegramGroupsDetailedReportDocument;
export default TelegramGroupsDetailedReportDocument;
