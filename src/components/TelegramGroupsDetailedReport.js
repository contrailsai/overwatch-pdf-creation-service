import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Link } from '@react-pdf/renderer';
import { registerFonts } from './utils/FontRegister';
import {
  DomainTheme as Theme,
  processText,
  formatDateTime,
  groupRiskInfo,
  hasGroupReviewSignal,
  groupTypeLabel,
  groupAudienceLabel,
  groupMessageCountLabel,
  groupUsernameLabel,
  groupSourceLabel,
  groupFlagLabel,
  groupSeverityInfo,
  groupConfidenceLabel,
  groupHasAiAnalysis,
  groupFlaggedMessages,
  groupTotalFlaggedMessages,
  groupMediaEvidence,
  groupPromotedLinks,
  buildGroupReviewModel,
} from './telegramGroupPdfShared';

registerFonts();

/** Review-page caps. */
const MAX_REVIEW_VIOLATIONS = 10;
const MAX_REVIEW_LEGAL_CODES = 8;
const MAX_PROMOTED_LINKS = 6;
/** Gallery caps. */
const MAX_GALLERY_MESSAGES = 12;
const GALLERY_PER_PAGE = 4;
const MAX_MESSAGE_TEXT = 620;
/** Analysis-page caps. */
const MAX_EVIDENCE_IMAGES = 8;
const MAX_BATCH_SUMMARIES = 8;

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
  leadText: { fontSize: 11, color: Theme.INK, lineHeight: 1.3 },
  bodyText: { fontSize: 8, color: Theme.INK_SOFT, lineHeight: 1.4 },
  softText: { fontSize: 8, color: Theme.MUTED, lineHeight: 1.4 },
  /* ---- verdict stats ---- */
  statRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  statCell: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: Theme.LINE,
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: Theme.SURFACE_ALT,
  },
  statValue: { fontSize: 11, fontWeight: 900, color: Theme.PRIMARY_BLUE, marginBottom: 1 },
  statLabel: { fontSize: 5.5, color: Theme.MUTED, textTransform: 'uppercase', fontWeight: 'bold' },
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
  evidenceMeta: { fontSize: 5.5, color: Theme.MUTED, marginBottom: 2 },
  evidenceText: { fontSize: 6.5, color: Theme.INK_SOFT, lineHeight: 1.3 },
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

const VerdictCard = ({ group, review }) => {
  const ai = group.ai || {};
  const rows = [
    ['Verdict', review.verdict ? String(review.verdict) : null],
    ['Recommended action', review.recommendedAction],
    ['AI confidence', groupConfidenceLabel(review.confidence)],
    ['Media basis', review.mediaBasis],
    ['AI reviewed at', formatDateTime(ai.reviewed_at)],
    ['Review status', group.workflow?.review_status || null],
    ['AI status', group.workflow?.ai_status || null],
  ];

  return (
    <View style={styles.card}>
      <View style={styles.reverseRow}>
        <Text style={[styles.cardLabel, { marginBottom: 0 }]}>Verdict</Text>
        <RiskBadge risk={review.risk} />
      </View>
      <View style={styles.statRow}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{review.risk?.rank === 'unknown' ? '—' : review.risk?.rank?.toUpperCase()}</Text>
          <Text style={styles.statLabel}>Risk tier</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{group.review?.threat_score ?? '—'}</Text>
          <Text style={styles.statLabel}>Threat score</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{groupTotalFlaggedMessages(group)}</Text>
          <Text style={styles.statLabel}>Flagged msgs</Text>
        </View>
      </View>
      {rows.map(([label, value]) => (
        <KeyValue key={label} label={label}>
          <Text style={styles.kvValue}>{displayValue(value, 64)}</Text>
        </KeyValue>
      ))}
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

const FlaggedActorsCard = ({ group }) => {
  const actors = Array.isArray(group.ai?.flagged_actors) ? group.ai.flagged_actors : [];
  if (actors.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Flagged Actors</Text>
      {actors.map((actor) => (
        <View key={actor.actor_key || actor.name} style={{ marginBottom: 5 }}>
          <Text style={styles.kvValue}>{processText(actor.name, 48)}</Text>
          {actor.role ? <Text style={styles.kvLabel}>{processText(actor.role, 48)}</Text> : null}
          {actor.violations.length > 0 ? (
            <Text style={styles.kvValueSoft}>{actor.violations.join(' · ')}</Text>
          ) : null}
          {actor.why ? <Text style={styles.softText}>{processText(actor.why, 220, 3)}</Text> : null}
        </View>
      ))}
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
        {review.caseSummary ? (
          <View style={{ marginBottom: 5 }}>
            <Text style={[styles.subLabel, { marginTop: 0 }]}>Case Summary</Text>
            <Text style={styles.leadText}>{processText(review.caseSummary, 520, 8)}</Text>
          </View>
        ) : null}

        {review.violations.length > 0 ? (
          <View style={{ marginBottom: 4 }}>
            <Text style={styles.subLabel}>Detected Violations</Text>
            <View style={styles.pillRow}>
              {review.violations.slice(0, MAX_REVIEW_VIOLATIONS).map((violation) => (
                <View key={violation.name} style={styles.pill}>
                  <Text style={styles.pillText}>{processText(violation.name, 30)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {review.reviewerComments ? (
          <View style={{ marginBottom: 4 }}>
            <Text style={styles.subLabel}>Reviewer Comments</Text>
            <Text style={styles.bodyText}>{processText(review.reviewerComments, 260, 4)}</Text>
          </View>
        ) : null}

        {!review.hasSignal && !review.hasAiAnalysis ? (
          <Text style={styles.softText}>
            Not yet reviewed. This group has no threat score, violations or legal findings attached yet.
          </Text>
        ) : null}
      </View>

      <View style={styles.reviewLegal}>
        <Text style={styles.subLabel}>Legal Violations</Text>
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
          <FlaggedActorsCard group={group} />
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
          <Text style={styles.translationLabel}>English</Text>
          <Text style={styles.translationText}>{processText(english, 320, 5)}</Text>
        </View>
      ) : null}

      {message.localPath ? <Image style={styles.msgImage} src={message.localPath} /> : null}

      {message.finding ? (
        <View style={styles.findingBox}>
          <Text style={styles.findingLabel}>AI finding</Text>
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

const FlaggedMessagesPages = ({ group, caseNumber }) => {
  const total = groupTotalFlaggedMessages(group);
  if (total === 0) return null;
  const messages = groupFlaggedMessages(group, MAX_GALLERY_MESSAGES);
  const pages = [];
  for (let i = 0; i < messages.length; i += GALLERY_PER_PAGE) {
    pages.push(messages.slice(i, i + GALLERY_PER_PAGE));
  }

  return (
    <>
      {pages.map((slice, pageIndex) => (
        <Page key={`gallery-${pageIndex}`} size="A4" style={styles.page}>
          <Header group={group} />
          <View style={styles.sectionHeading} wrap={false}>
            <Text style={styles.sectionHeadingText}>{caseNumber}. Flagged Messages</Text>
            <Text style={styles.sectionHeadingMeta}>
              {pageIndex + 1} / {pages.length}
              {total > messages.length ? ` · showing ${messages.length} of ${total}` : ''}
            </Text>
          </View>
          <View style={styles.galleryGrid}>
            {slice.map((message) => (
              <MessageCard key={`${message.message_id}-${message.index}`} group={group} message={message} />
            ))}
          </View>
          <Footer />
        </Page>
      ))}
    </>
  );
};

/* ------------------------------------------------------------------ *
 * Section — AI analysis, evidence, coverage                           *
 * ------------------------------------------------------------------ */

const AnalysisPage = ({ group, caseNumber }) => {
  const ai = group.ai || {};
  const evidence = groupMediaEvidence(group, MAX_EVIDENCE_IMAGES);
  const batches = (ai.batch_summaries || []).slice(0, MAX_BATCH_SUMMARIES);
  const links = groupPromotedLinks(group);

  const hasAnalysis = Boolean(ai.analysis);
  const hasCoverage = Boolean(group.telegram_backfill?.status || group.telegram_backfill?.lookback);
  if (!hasAnalysis && evidence.length === 0 && batches.length === 0 && !hasCoverage) return null;

  return (
    <Page size="A4" style={styles.page}>
      <Header group={group} />

      <View style={styles.sectionHeading} wrap={false}>
        <Text style={styles.sectionHeadingText}>{caseNumber}. AI Analysis &amp; Evidence</Text>
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

      {links.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Monetisation &amp; Promoted Handles</Text>
          <View style={styles.kvGridRow}>
            {links.slice(0, MAX_PROMOTED_LINKS).map((link) => (
              <View key={`${link.kind}:${link.name}`} style={{ flex: 1, marginBottom: 4 }}>
                <Text style={styles.kvValue}>{processText(link.name, 70)}</Text>
                {link.what.length > 0 ? (
                  <Text style={styles.kvValueSoft}>{processText(link.what.join(' · '), 160)}</Text>
                ) : null}
                <Text style={styles.kvLabel}>
                  {link.monetised ? 'Monetised' : 'Not monetised'}
                  {link.price_mentions.length > 0 ? ` · ${link.price_mentions.join(', ')}` : ''}
                  {link.message_ids.length > 0 ? ` · ${link.message_ids.length} msgs` : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {evidence.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Image Evidence</Text>
          <View style={styles.evidenceGrid}>
            {evidence.map((entry, index) => (
              <View key={`${entry.message_id}-${index}`} style={styles.evidenceCard} wrap={false}>
                {entry.localPath ? (
                  <Image style={styles.evidenceImage} src={entry.localPath} />
                ) : (
                  <View style={[styles.evidenceImage, { alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={styles.softText}>
                      {entry.message_id != null ? `Message #${entry.message_id}` : 'No image'}
                    </Text>
                  </View>
                )}
                <View style={styles.evidenceBody}>
                  <Text style={styles.evidenceMeta}>
                    {entry.date ? formatDateTime(entry.date) : ''}
                    {entry.message_id != null ? ` · #${entry.message_id}` : ''}
                  </Text>
                  <Text style={styles.evidenceText}>{processText(entry.finding, 300, 5)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {hasCoverage ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Collection Coverage</Text>
          <View style={styles.kvGridRow}>
            <View style={{ flex: 1 }}>
              <KeyValue label="Backfill status">
                <Text style={styles.kvValue}>{displayValue(group.telegram_backfill.status, 30)}</Text>
              </KeyValue>
              <KeyValue label="Lookback">
                <Text style={styles.kvValue}>{displayValue(group.telegram_backfill.lookback, 30)}</Text>
              </KeyValue>
            </View>
            <View style={{ flex: 1 }}>
              <KeyValue label="Messages seen">
                <Text style={styles.kvValue}>{displayValue(numeric(group.telegram_backfill.messages_seen), 30)}</Text>
              </KeyValue>
              <KeyValue label="Last error">
                <Text style={styles.kvValue}>{displayValue(group.telegram_backfill.last_error, 30)}</Text>
              </KeyValue>
            </View>
          </View>
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
          <FlaggedMessagesPages group={group} caseNumber={index + 1} />
          <AnalysisPage group={group} caseNumber={index + 1} />
          <NotesPage group={group} caseNumber={index + 1} />
        </React.Fragment>
      ))}
    </Document>
  );
};

export const TelegramGroupsDetailed = TelegramGroupsDetailedReportDocument;
export default TelegramGroupsDetailedReportDocument;
