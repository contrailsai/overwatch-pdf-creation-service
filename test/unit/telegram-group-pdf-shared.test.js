const test = require('node:test');
const assert = require('node:assert/strict');

require('@babel/register')({
  presets: ['@babel/preset-env', '@babel/preset-react'],
  extensions: ['.js', '.jsx'],
  cache: false,
});

const {
  groupRiskInfo,
  groupRiskRank,
  hasGroupReviewSignal,
  collectGroupViolations,
  groupTypeLabel,
  groupAudienceLabel,
  groupMessageCountLabel,
  groupUsernameLabel,
  groupSourceLabel,
  groupFlagLabel,
  groupIsAlerted,
  groupSeverityInfo,
  groupConfidenceLabel,
  groupHasAiAnalysis,
  groupFlaggedMessages,
  groupTotalFlaggedMessages,
  groupMediaEvidence,
  groupPromotedLinks,
  buildGroupReviewModel,
} = require('../../src/components/telegramGroupPdfShared');

function makeGroup(overrides = {}) {
  return {
    _id: 'group-1',
    title: 'VFS Alert',
    username: 'vfs_alert',
    type: 'channel',
    original_url: 'https://t.me/vfs_alert',
    participant_count: 81483,
    message_count: 808,
    review: {
      threat_score: null,
      risk_rank: null,
      threat_types: [],
      violation_flags: [],
      flags: {},
      legal_codes: [],
      reasoning: '',
      reviewed_at: null,
    },
    ...overrides,
  };
}

test('groupRiskInfo returns Unreviewed without a review signal', () => {
  const info = groupRiskInfo(makeGroup());
  assert.equal(info.label, 'Unreviewed');
  assert.equal(info.rank, 'unknown');
  assert.equal(hasGroupReviewSignal(makeGroup()), false);
});

test('groupRiskInfo follows the Domains thresholds and prefers a reviewer rank', () => {
  assert.equal(groupRiskRank(makeGroup({ review: { threat_score: 96 } })), 'high');
  assert.equal(groupRiskRank(makeGroup({ review: { threat_score: 76 } })), 'medium');
  assert.equal(groupRiskRank(makeGroup({ review: { threat_score: 41 } })), 'low');
  assert.equal(groupRiskRank(makeGroup({ review: { threat_score: 40 } })), 'safe');
  assert.equal(groupRiskInfo(makeGroup({ review: { threat_score: 96 } })).label, 'High Risk');
  assert.equal(groupRiskInfo(makeGroup({ review: { threat_score: 96, risk_rank: 'low' } })).label, 'Low Risk');
  assert.equal(hasGroupReviewSignal(makeGroup({ review: { threat_score: 12 } })), true);
  assert.equal(
    hasGroupReviewSignal(makeGroup({ review: { reviewed_at: '2026-09-22T00:00:00.000Z' } })),
    true,
  );
});

test('collectGroupViolations resolves project labels, true flags and threat types', () => {
  const project = {
    project_details: {
      labels: [
        { name: 'Fraud', severity: 'high' },
        { name: 'Impersonation', severity: 'high' },
      ],
    },
  };
  const group = makeGroup({
    review: {
      threat_score: 96,
      threat_types: ['Impersonation', 'Fraud', 'Appointment-Scalping', 'Bot-Networks'],
      violation_flags: [],
      flags: {
        Fraud: true,
        Impersonation: true,
        'Appointment-Scalping': true,
        'Bot-Networks': true,
        'Anti-India-Propaganda': false,
        Hate_speech: true,
      },
      reviewed_at: '2026-09-22T00:00:00.000Z',
    },
  });
  const chips = collectGroupViolations(group, project);
  const names = chips.map((chip) => chip.name);

  assert.ok(names.includes('Fraud'));
  assert.ok(names.includes('Impersonation'));
  assert.ok(names.includes('Appointment Scalping'));
  assert.ok(names.includes('Bot Networks'));
  // Legacy snake_case flag maps to its human label.
  assert.ok(names.includes('Hate Speech'));
  // High severity sorts first.
  assert.equal(chips[0].severity, 'high');
  // Deduplicates case-insensitively across flags, labels and threat types.
  assert.equal(names.filter((name) => name.toLowerCase() === 'fraud').length, 1);
  assert.equal(names.filter((name) => name.toLowerCase() === 'impersonation').length, 1);
});

test('groupTypeLabel distinguishes channels from groups', () => {
  assert.equal(groupTypeLabel(makeGroup({ type: 'channel' })), 'Channel');
  assert.equal(groupTypeLabel(makeGroup({ type: '', broadcast: true })), 'Channel');
  assert.equal(groupTypeLabel(makeGroup({ type: 'supergroup' })), 'Group');
  assert.equal(groupTypeLabel(makeGroup({ type: 'group', megagroup: true })), 'Group');
  assert.equal(groupTypeLabel(makeGroup({ type: '', broadcast: false, megagroup: false })), 'Channel');
});

test('group labels degrade safely for missing counts and usernames', () => {
  assert.equal(groupAudienceLabel(makeGroup()), '81.5K');
  assert.equal(groupMessageCountLabel(makeGroup()), '808');
  assert.equal(groupAudienceLabel(makeGroup({ participant_count: null })), '—');
  assert.equal(groupAudienceLabel(makeGroup({ participant_count: 750 })), '750');
  assert.equal(groupMessageCountLabel(makeGroup({ message_count: 0 })), '0');
  assert.equal(groupMessageCountLabel(makeGroup({ message_count: null })), '—');
  assert.equal(groupUsernameLabel(makeGroup()), '@vfs_alert');
  assert.equal(groupUsernameLabel(makeGroup({ username: '' })), '—');
  assert.equal(groupSourceLabel(makeGroup()), 'View Channel');
  assert.equal(groupSourceLabel(makeGroup({ type: 'supergroup' })), 'Open in Telegram');
  assert.equal(groupSourceLabel(makeGroup({ original_url: '' })), '');
  assert.equal(groupFlagLabel(true), 'Yes');
  assert.equal(groupFlagLabel(false), 'No');
  assert.equal(groupFlagLabel(undefined), '—');
});

test('groupIsAlerted follows client status and the processed flag', () => {
  assert.equal(groupIsAlerted(makeGroup({ client_status: 'open', processed: false })), false);
  assert.equal(groupIsAlerted(makeGroup({ client_status: 'alerted' })), true);
  assert.equal(groupIsAlerted(makeGroup({ client_status: 'open', processed: true })), true);
  assert.equal(groupIsAlerted(makeGroup({})), false);
});

test('buildGroupReviewModel normalises verdicts, violations and legal codes', () => {
  const project = {
    project_details: {
      labels: [{ name: 'Fraud', severity: 'high' }],
      legal_codes: [{ name: 'IT-66D', description: 'Cheating by personation' }],
    },
  };
  const review = buildGroupReviewModel(
    makeGroup({
      client_status: 'alerted',
      review: {
        threat_score: 97,
        risk_rank: 'high',
        threat_types: ['Fraud'],
        flags: {},
        legal_codes: [{ code: 'IT-66D' }, 'XYZ-1'],
        case_summary: 'A scam channel.',
        reasoning: 'Overview: flagged.\nEvidence: bot networks.',
        reviewer_comments: 'Escalate.',
        recommended_action: 'channel_takedown',
        reviewed_at: '2026-09-22T00:00:00.000Z',
      },
    }),
    project,
  );

  assert.equal(review.risk.label, 'High Risk');
  assert.equal(review.hasSignal, true);
  assert.equal(review.verdictLabel, 'Channel Takedown');
  assert.deepEqual(review.violations.map((v) => v.name), ['Fraud']);
  assert.equal(review.caseSummary, 'A scam channel.');
  assert.equal(review.legalCodes.length, 2);
  // Project legal-code description is backfilled when the reviewer left none.
  assert.equal(review.legalCodes[0].reasoning, 'Cheating by personation');
  assert.equal(review.legalCodes[1].reasoning, '');
  assert.equal(review.reasoningSections.length, 2);
  assert.equal(review.reasoningSections[0].label, 'Overview');
  assert.equal(review.status, 'alerted');
});

function makeAiGroup(overrides = {}) {
  return makeGroup({
    ai: {
      present: true,
      total_flagged_messages: 30,
      flagged_messages: [
        { index: 0, message_id: 1, severity: 'high', violations: ['FRAUD'], finding: 'f1' },
        { index: 1, message_id: 2, severity: 'low', violations: [], finding: 'f2' },
      ],
      media_evidence: [{ message_id: 2, finding: 'img' }],
      batch_summaries: [],
      promoted_services: [{ kind: 'service', name: 'svc', what: [], monetised: true, price_mentions: [], message_ids: [] }],
      promoted_handles: [
        { kind: 'handle', name: '@op', what: [], monetised: true, price_mentions: [], message_ids: [] },
        { kind: 'handle', name: '@op', what: [], monetised: true, price_mentions: [], message_ids: [] },
      ],
    },
    ...overrides,
  });
}

test('groupSeverityInfo grades high/medium/low and defaults to Info', () => {
  assert.equal(groupSeverityInfo('high').label, 'High');
  assert.equal(groupSeverityInfo('medium').label, 'Medium');
  assert.equal(groupSeverityInfo('low').label, 'Low');
  assert.equal(groupSeverityInfo(undefined).label, 'Info');
});

test('groupConfidenceLabel formats ratios and degrades for missing values', () => {
  assert.equal(groupConfidenceLabel(1), '100%');
  assert.equal(groupConfidenceLabel(0.86), '86%');
  assert.equal(groupConfidenceLabel(null), '—');
  assert.equal(groupConfidenceLabel('x'), '—');
});

test('group flagged/AI accessors expose totals, slices and de-duplicated links', () => {
  const group = makeAiGroup();
  assert.equal(groupHasAiAnalysis(group), true);
  assert.equal(groupHasAiAnalysis(makeGroup()), false);
  assert.equal(groupTotalFlaggedMessages(group), 30);
  assert.equal(groupTotalFlaggedMessages(makeGroup()), 0);
  assert.equal(groupFlaggedMessages(group).length, 2);
  assert.equal(groupFlaggedMessages(group, 1).length, 1);
  assert.equal(groupMediaEvidence(group, 1).length, 1);
  const links = groupPromotedLinks(group);
  assert.deepEqual(
    links.map((link) => link.name),
    ['svc', '@op'],
  );
});
