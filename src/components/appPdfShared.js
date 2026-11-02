import { DomainTheme } from './domainPdfShared';

export { DomainTheme };
export { processText, formatCompleteDate, formatDateTime } from './domainPdfShared';

/** Apps reports share the Domains palette (Generation A accents, detailed token names). */
export const AppTheme = DomainTheme;

/**
 * Risk rank for an app.
 *
 * Apps have no accepted threshold standard of their own. This follows the
 * Domains renderers (>= 96 / >= 76 / >= 41) rather than the older Ads Summary
 * operators (> 95 / > 75 / > 40) — see docs/report-themes.md §3. A `risk_rank`
 * set by a reviewer always wins over the score.
 */
export function appRiskRank(app) {
  const rank = String(app?.review?.risk_rank || '').toLowerCase();
  if (['high', 'medium', 'low', 'safe'].includes(rank)) return rank;
  const score = app?.review?.threat_score;
  if (score == null) return 'unknown';
  if (score >= 96) return 'high';
  if (score >= 76) return 'medium';
  if (score >= 41) return 'low';
  return 'safe';
}

export function appRiskInfo(app) {
  const rank = appRiskRank(app);
  if (rank === 'high') {
    return {
      label: 'High Risk',
      rank,
      color: AppTheme.RISK_HIGH,
      bg: AppTheme.RISK_HIGH_BG,
      border: AppTheme.RISK_HIGH_BORDER,
    };
  }
  if (rank === 'medium') {
    return {
      label: 'Medium Risk',
      rank,
      color: AppTheme.RISK_MEDIUM,
      bg: AppTheme.RISK_MEDIUM_BG,
      border: AppTheme.RISK_MEDIUM_BORDER,
    };
  }
  if (rank === 'low') {
    return {
      label: 'Low Risk',
      rank,
      color: AppTheme.RISK_LOW,
      bg: AppTheme.RISK_LOW_BG,
      border: AppTheme.RISK_LOW_BORDER,
    };
  }
  if (rank === 'safe') {
    return {
      label: 'Safe',
      rank,
      color: AppTheme.SAFE,
      bg: AppTheme.RISK_SAFE_BG,
      border: AppTheme.RISK_SAFE_BORDER,
    };
  }
  return {
    label: 'Unreviewed',
    rank,
    color: AppTheme.SECONDARY_GRAY,
    bg: AppTheme.BG_SECTION,
    border: AppTheme.BORDER_LIGHT,
  };
}

/** True when a reviewer has left any signal on the app. */
export function hasAppReviewSignal(app) {
  const review = app?.review || {};
  return (
    review.threat_score != null ||
    review.risk_rank != null ||
    Boolean(review.reviewed_at) ||
    (Array.isArray(review.threat_types) && review.threat_types.length > 0) ||
    (Array.isArray(review.violation_flags) && review.violation_flags.length > 0) ||
    Boolean(review.reasoning) ||
    Boolean(review.case_summary) ||
    (Array.isArray(review.legal_codes) && review.legal_codes.length > 0)
  );
}

const LEGACY_FLAG_LABELS = {
  is_nsfw: 'NSFW',
  is_hate_speech: 'Hate Speech',
  is_fake_news: 'Misinformation',
  is_fraud: 'Fraud',
  is_asset_misuse: 'Asset Misuse',
  is_humor: 'Satire',
  is_terrorism: 'Terrorism',
  is_violence: 'Violence',
};

const SEVERITY_ORDER = { high: 1, medium: 2, low: 3 };

/** `investment-scams`, `investment_scams` and `Investment Scams` are the same signal. */
function normalizeViolationKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Violation chips: project labels first (matched on flags / threat types), then
 * legacy boolean flags, then any remaining threat types — same precedence the
 * Ads Summary uses.
 */
export function collectAppViolations(app, project) {
  const review = app?.review || {};
  const flags = review.flags && typeof review.flags === 'object' ? review.flags : {};
  const threatTypes = Array.isArray(review.threat_types) ? review.threat_types : [];
  const declared = Array.isArray(review.violation_flags) ? review.violation_flags : [];
  const projectLabels = Array.isArray(project?.project_details?.labels)
    ? project.project_details.labels
    : [];

  const chips = [];
  const seen = new Set();
  const push = (name, severity) => {
    const label = String(name || '').trim();
    const key = normalizeViolationKey(label);
    if (!key || seen.has(key)) return;
    seen.add(key);
    chips.push({ name: label, severity: SEVERITY_ORDER[severity] ? severity : 'medium' });
  };

  // Reviewer flags/threat types use hyphenated lowercase keys; project labels are
  // display names. Compare on a normalised key so both spellings line up.
  const declaredKeys = new Set(
    [
      ...Object.keys(flags).filter((key) => flags[key] === true),
      ...threatTypes,
      ...declared,
    ]
      .map(normalizeViolationKey)
      .filter(Boolean),
  );

  for (const label of projectLabels) {
    if (!label?.name) continue;
    if (declaredKeys.has(normalizeViolationKey(label.name))) push(label.name, label.severity);
  }

  for (const [flag, name] of Object.entries(LEGACY_FLAG_LABELS)) {
    if (flags[flag] === true) push(name, 'medium');
  }

  for (const type of [...threatTypes, ...declared]) {
    if (!type || String(type).toLowerCase() === 'safe') continue;
    push(titleCase(String(type).replace(/[_-]+/g, ' ')), 'medium');
  }

  return chips.sort(
    (a, b) => (SEVERITY_ORDER[a.severity] || 4) - (SEVERITY_ORDER[b.severity] || 4),
  );
}

/** Threat chips use the effective reviewer-authored or fallback values. */
export function collectAppThreatTypes(app, project) {
  const review = app?.review || {};
  const flags = review.flags && typeof review.flags === 'object' ? review.flags : {};
  const projectLabels = Array.isArray(project?.project_details?.labels)
    ? project.project_details.labels
    : [];

  const sources = [
    ...(Array.isArray(review.threat_types) ? review.threat_types : []),
    ...(Array.isArray(review.violation_flags) ? review.violation_flags : []),
    ...Object.keys(flags).filter((key) => flags[key] === true),
  ];

  const chips = [];
  const seen = new Set();
  const push = (name, severity) => {
    const label = String(name || '').trim();
    const key = normalizeViolationKey(label);
    if (!key || seen.has(key)) return;
    seen.add(key);
    chips.push({ name: label, severity: SEVERITY_ORDER[severity] ? severity : 'medium' });
  };

  // Project labels win when they match an effective signal, so severity and
  // the project's display spelling are preserved.
  const sourceKeys = new Set(sources.map(normalizeViolationKey).filter(Boolean));
  for (const label of projectLabels) {
    if (label?.name && sourceKeys.has(normalizeViolationKey(label.name))) {
      push(label.name, label.severity);
    }
  }

  for (const [flag, name] of Object.entries(LEGACY_FLAG_LABELS)) {
    if (flags[flag] === true) push(name, 'medium');
  }

  for (const raw of sources) {
    if (!raw || String(raw).toLowerCase() === 'safe') continue;
    push(titleCase(String(raw).replace(/[_-]+/g, ' ')), 'medium');
  }

  return chips.sort(
    (a, b) => (SEVERITY_ORDER[a.severity] || 4) - (SEVERITY_ORDER[b.severity] || 4),
  );
}

/** 1250000 → "1.3M", 50000 → "50K", 259 → "259". */
export function compactNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '0';
  if (num >= 1_000_000_000) return `${Math.round(num / 100_000_000) / 10}B`;
  if (num >= 1_000_000) return `${Math.round(num / 100_000) / 10}M`;
  if (num >= 1_000) return `${Math.round(num / 100) / 10}K`;
  return String(Math.round(num));
}

/** `list.installs` ("50,000+") when present, else derived from `min_installs`. */
export function appInstallCountLabel(app) {
  const text = app?.store?.installs;
  if (text) return String(text);
  const min = app?.store?.min_installs;
  if (typeof min === 'number' && Number.isFinite(min) && min > 0) {
    return `${compactNumber(min)}+`;
  }
  return '—';
}

export function appDeveloperName(app) {
  return app?.developer?.name || 'Unknown publisher';
}

/** Client-facing "alerted" signal: explicitly alerted, or the legacy processed flag. */
export function appIsAlerted(app) {
  return String(app?.client_status || '').toLowerCase() === 'alerted' || Boolean(app?.processed);
}

/** Short bullets for the Summary "Store" cell. */
export function appStoreFacts(app) {
  const facts = [];
  const installs = appInstallCountLabel(app);
  if (installs && installs !== '—') facts.push(installs);
  if (app?.store?.genre) facts.push(String(app.store.genre));
  if (typeof app?.store?.ratings === 'number') {
    facts.push(`${app.store.ratings.toLocaleString('en-IN')} ratings`);
  }
  if (app?.store?.free) {
    facts.push('Free');
  } else if (typeof app?.store?.price === 'number') {
    facts.push(`${app.store.currency || ''} ${app.store.price}`.trim());
  }
  return facts;
}

export function appPlatformLabel(app) {
  const platform = String(app?.platform || '').toLowerCase();
  if (platform.includes('play')) return 'Google Play';
  if (platform.includes('apple') || platform.includes('ios') || platform.includes('app_store')) {
    return 'App Store';
  }
  return platform ? titleCase(platform.replace(/[_-]+/g, ' ')) : 'App Store';
}

function humanizeKey(key) {
  return String(key || '')
    .replace(/[_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Flatten an arbitrary object (e.g. `analysis_results`) into label/value rows so
 * new or undefined shapes still render without bespoke code.
 */
export function flattenKeyValues(value, { limit = 14, maxDepth = 1 } = {}) {
  const rows = [];
  const walk = (node, depth, prefix) => {
    if (rows.length >= limit || node == null) return;
    if (Array.isArray(node)) {
      const joined = node.map((item) => (item && typeof item === 'object' ? JSON.stringify(item) : String(item))).join(', ');
      if (joined) rows.push({ label: prefix || 'Items', value: joined });
      return;
    }
    if (typeof node === 'object') {
      for (const [key, child] of Object.entries(node)) {
        if (rows.length >= limit) break;
        const label = prefix ? `${prefix} · ${humanizeKey(key)}` : humanizeKey(key);
        if (child && typeof child === 'object' && !Array.isArray(child) && depth < maxDepth) {
          walk(child, depth + 1, label);
        } else if (Array.isArray(child)) {
          walk(child, depth + 1, label);
        } else if (child != null && child !== '') {
          rows.push({ label, value: String(child) });
        }
      }
      return;
    }
    if (String(node) !== '') rows.push({ label: prefix || 'Value', value: String(node) });
  };
  walk(value, 0, '');
  return rows;
}

/* ------------------------------------------------------------------ *
 * Review model                                                        *
 * ------------------------------------------------------------------ */

/** Split reasoning prose into `Label: content` blocks (ads-profile convention). */
export function parseReasoning(text) {
  if (!text) return [];
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  return lines.map((line) => {
    const match = line.match(/^([A-Z][A-Za-z0-9 &/()\-]{2,40}?):\s*(.+)$/);
    if (match) return { label: match[1].trim(), content: match[2].trim() };
    return { label: '', content: line };
  });
}

export function formatVerdictLabel(value) {
  if (!value) return '';
  return String(value)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function resolveProjectLegalCodes(project) {
  const codes = project?.project_details?.legal_codes;
  if (!Array.isArray(codes)) return [];
  return codes
    .map((item) => {
      if (typeof item === 'string') return { name: item, description: '' };
      return {
        name: item?.name || item?.code || '',
        codeName: item?.codeName || item?.code || '',
        description: item?.description || item?.reasoning || '',
      };
    })
    .filter((item) => item.name || item.codeName);
}

/** Page-1 review model using the normalized effective review values. */
export function buildAppReviewModel(app, project) {
  const review = app?.review || {};
  const risk = appRiskInfo(app);
  // The normalizer resolves reviewer precedence, including explicit empty values.
  const caseSummary = String(
    review.case_summary ?? '',
  ).trim();
  const reasoning = String(review.reasoning ?? '').trim();
  const reviewerComments = String(review.reviewer_comments || '').trim();
  const verdictLabel = formatVerdictLabel(
    review.field_sources?.recommended_action === 'review' ? review.recommended_action : (review.recommended_action ?? review.verdict),
  );
  const violations = collectAppViolations(app, project);

  const legalCodes = (Array.isArray(review.legal_codes) ? review.legal_codes : [])
    .map((item) => {
      if (typeof item === 'string') return { code: item, reasoning: '' };
      return { code: item?.code || item?.name || '', reasoning: item?.reasoning || '' };
    })
    .filter((item) => item.code);

  return {
    risk,
    hasSignal: hasAppReviewSignal(app),
    reviewed: Boolean(app?.assessment_reviewed),
    sources: review.field_sources || {},
    status: app?.client_status || 'open',
    reviewedAt: app?.reviewed_at || review.reviewed_at || null,
    caseSummary,
    reasoning,
    reasoningSections: parseReasoning(reasoning),
    reviewerComments,
    verdictLabel,
    violations,
    threatTypes: collectAppThreatTypes(app, project),
    legalCodes,
    // Effective legal findings retain the chosen review reasoning.
    legalFindings: legalCodes,
  };
}

/* ------------------------------------------------------------------ *
 * AI analysis model                                                   *
 * ------------------------------------------------------------------ */

const TAKEDOWN_TARGET_LABELS = [
  ['play_store', 'Play Store'],
  ['domains', 'Domains'],
  ['upi_ids', 'UPI IDs'],
  ['bank_accounts', 'Bank Accounts'],
  ['phone_numbers', 'Phone Numbers'],
  ['emails', 'Emails'],
  ['social', 'Social'],
];

function nonEmptyStrings(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => (item == null ? '' : String(item).trim()))
    .filter(Boolean);
}

/**
 * Group the AI `findings` by category, preserving document order, so the renderer
 * can draw one sub-section per category instead of a flat list.
 */
function groupFindings(findings) {
  const groups = [];
  const byCategory = new Map();
  for (const finding of findings) {
    const key = finding.category || '';
    let group = byCategory.get(key);
    if (!group) {
      group = { category: finding.category || 'Findings', items: [] };
      byCategory.set(key, group);
      groups.push(group);
    }
    group.items.push(finding);
  }
  return groups;
}

/**
 * Everything the "AI Analysis & Evidence" section needs. Deliberately excludes
 * scoring metadata (threat score, confidence, verdict word, media basis) — this
 * section reports the substantive review, threat types and findings instead.
 *
 * @returns {{
 *   hasAnalysis: boolean,
 *   detailedReasoning: string,
 *   reasoningSections: Array<{ label: string, content: string }>,
 *   reviewerComments: string,
 *   threatTypes: Array<{ name: string, severity: string }>,
 *   findings: object[],
 *   findingsByCategory: Array<{ category: string, items: object[] }>,
 *   operator: object|null,
 *   recommendedAction: string,
 *   takedownTargets: Array<{ label: string, items: string[] }>,
 * }}
 */
export function buildAppAnalysisModel(app, project) {
  const analysis =
    app?.analysis_results && typeof app.analysis_results === 'object' ? app.analysis_results : {};
  const review = app?.review || {};

  const detailedReasoning = String(review.reasoning ?? '').trim();
  const reviewerComments = String(review.reviewer_comments || '').trim();

  const resolveSource = createAppPdfSourceResolver(app);
  const findings = (Array.isArray(analysis.findings) ? analysis.findings : [])
    .map((item) => {
      if (typeof item === 'string') return { category: 'Findings', finding: item.trim(), source: '' };
      return {
        category: titleCase(String(item?.category || '').replace(/[_-]+/g, ' ').trim()) || 'Findings',
        finding: String(item?.finding || '').trim(),
        source: titleCase(String(item?.source || '').replace(/[_-]+/g, ' ').trim()),
        references: (Array.isArray(item?.media_ids) ? item.media_ids : []).map(resolveSource),
      };
    })
    .filter((item) => item.finding);

  const rawOperator = analysis.operator && typeof analysis.operator === 'object' ? analysis.operator : null;
  const operator = rawOperator
    ? {
        developerAccount: String(rawOperator.developer_account || '').trim(),
        legalEntities: nonEmptyStrings(rawOperator.legal_entities),
        countries: nonEmptyStrings(rawOperator.countries),
        concealment: String(rawOperator.concealment || '').trim(),
      }
    : null;
  const hasOperator = Boolean(
    operator && (operator.developerAccount || operator.legalEntities.length || operator.countries.length || operator.concealment),
  );

  const takedownTargets = TAKEDOWN_TARGET_LABELS.map(([key, label]) => ({
    label,
    items: nonEmptyStrings(analysis.takedown_targets?.[key]),
  })).filter((target) => target.items.length > 0);

  const threatTypes = collectAppThreatTypes(app, project);
  const recommendedAction = String(
    review.recommended_action ?? '',
  ).trim();

  return {
    hasAnalysis: Boolean(
      detailedReasoning || analysis.analysis || analysis.reasoning || analysis.case_summary || analysis.recommended_action || (analysis.threat_types || []).length || (analysis.legal_codes || []).length ||
        reviewerComments ||
        threatTypes.length ||
        findings.length ||
        hasOperator ||
        recommendedAction ||
        takedownTargets.length,
    ),
    detailedReasoning,
    aiSummary: String(analysis.case_summary || '').trim(),
    aiReasoning: String(analysis.analysis || analysis.reasoning || '').trim(),
    aiThreatTypes: Array.isArray(analysis.threat_types) ? analysis.threat_types : (Array.isArray(analysis.violations) ? analysis.violations : []),
    aiLegalCodes: Array.isArray(analysis.legal_codes) ? analysis.legal_codes : [],
    aiRecommendedAction: String(analysis.recommended_action || '').trim(),
    reasoningSections: parseReasoning(detailedReasoning),
    reviewerComments,
    threatTypes,
    findings,
    findingsByCategory: groupFindings(findings),
    operator: hasOperator ? operator : null,
    recommendedAction,
    takedownTargets,
  };
}

/* ------------------------------------------------------------------ *
 * Evidence model                                                      *
 * ------------------------------------------------------------------ */

export const EVIDENCE_GROUPS = [
  { id: 'listing', label: 'Listing & Contact' },
  { id: 'app', label: 'App Details' },
  { id: 'developer', label: 'Developer Details' },
];

/**
 * Known evidence field titles. These are the items whose titles/values are
 * effectively fixed across apps, so they get a configured columnar grid rather
 * than being dumped in document order.
 */
export const EVIDENCE_FIELDS = {
  'app name': { label: 'App Name', width: 'half' },
  'package name': { label: 'Package Name', width: 'half' },
  'playstore link': { label: 'Store Link', width: 'full' },
  'play store link': { label: 'Store Link', width: 'full' },
  'store link': { label: 'Store Link', width: 'full' },
  'developer name': { label: 'Developer Name', width: 'half' },
  email: { label: 'Email', width: 'full' },
  website: { label: 'Website', width: 'full' },
  'upi id': { label: 'UPI ID', width: 'half' },
  instagram: { label: 'Instagram', width: 'full' },
  facebook: { label: 'Facebook', width: 'full' },
  linkedin: { label: 'LinkedIn', width: 'full' },
  github: { label: 'GitHub', width: 'full' },
  'phone number': { label: 'Phone Number', width: 'half' },
  'associated numbers': { label: 'Associated Numbers', width: 'half' },
  'associated address': { label: 'Associated Address', width: 'full' },
  bank: { label: 'Bank', width: 'half' },
  'account holder name': { label: 'Account Holder', width: 'half' },
  'account number': { label: 'Account Number', width: 'half' },
  'ifsc details': { label: 'IFSC', width: 'half' },
  'company name': { label: 'Company Name', width: 'half' },
  addrerss: { label: 'Address', width: 'full' },
  address: { label: 'Address', width: 'full' },
  gst: { label: 'GST', width: 'half' },
  'privacy policy': { label: 'Privacy Policy', width: 'full' },
};

/** Titles that read as prose even when short. */
const EVIDENCE_NARRATIVE_TITLES = /^(executive summary|.*redirection.*|.*workflow.*|.*video.*)$/i;

const EVIDENCE_SHORT_VALUE_LENGTH = 90;

function cleanEvidenceTitle(title) {
  return String(title || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[:\s]+$/, '');
}

function emptyEvidenceSection(section) {
  return !section.title && !section.description && (section.images || []).length === 0;
}

/** `Company Name (Developer Details)` → `{ label: 'Company Name', group: 'developer' }`. */
function resolveEvidenceField(title, description) {
  const cleaned = cleanEvidenceTitle(title);
  const grouped = cleaned.match(/^(.*?)\s*\((app|developer)\s*details?\)$/i);
  const label = grouped ? grouped[1].trim() : cleaned;
  const group = grouped ? (grouped[2].toLowerCase() === 'developer' ? 'developer' : 'app') : 'listing';
  const key = label.toLowerCase();
  const configured = EVIDENCE_FIELDS[key];
  if (configured) return { label: configured.label, width: configured.width, group };
  const looksShort = description.length <= EVIDENCE_SHORT_VALUE_LENGTH && !/[.!?]\s/.test(description);
  if (looksShort) {
    return { label: titleCase(label), width: description.length > 46 ? 'full' : 'half', group };
  }
  return null;
}

/**
 * Partition evidence sections into the four render buckets:
 * lead prose → configured fields → image sub-sections → other/unknown sections.
 * Video-only sections are dropped entirely.
 *
 * @returns {{
 *   hasEvidence: boolean,
 *   lead: Array<object>,
 *   fieldsByGroup: Array<{ id: string, label: string, items: object[] }>,
 *   media: Array<object>,
 *   other: Array<object>,
 *   totalImages: number,
 * }}
 */
export function buildAppEvidenceModel(app) {
  const sections = Array.isArray(app?.evidence?.sections) ? app.evidence.sections : [];
  const lead = [];
  const fields = [];
  const media = [];
  const other = [];
  let totalImages = 0;

  for (const section of sections) {
    if (emptyEvidenceSection(section)) continue;

    const title = cleanEvidenceTitle(section.title);
    const description = String(section.description || '').trim();
    const images = (section.images || []).filter((image) => image.localPath || image.url);
    totalImages += images.length;

    // Video-only captures have no images left after normalization.
    if (images.length === 0 && !description) continue;

    if (images.length > 0) {
      media.push({
        key: section.key,
        title,
        description,
        images,
        totalImages: section.totalImages || images.length,
      });
      continue;
    }

    if (/^executive summary$/i.test(title)) {
      lead.push({ title, description, images: [] });
      continue;
    }

    if (EVIDENCE_NARRATIVE_TITLES.test(title)) {
      other.push({ title, description, images: [] });
      continue;
    }

    const field = resolveEvidenceField(title, description);
    if (field) {
      fields.push({ ...field, value: description });
      continue;
    }

    other.push({ title, description, images: [] });
  }

  const fieldsByGroup = EVIDENCE_GROUPS.map((group) => ({
    ...group,
    items: fields.filter((field) => field.group === group.id),
  })).filter((group) => group.items.length > 0);

  return {
    hasEvidence: Boolean(lead.length || fieldsByGroup.length || media.length || other.length),
    lead,
    fieldsByGroup,
    media,
    other,
    totalImages,
  };
}

/** Pack half-width fields two per row; full-width fields get their own row. */
export function buildEvidenceFieldRows(items) {
  const rows = [];
  let pending = null;
  for (const item of items || []) {
    if (item.width === 'full') {
      if (pending) {
        rows.push([pending]);
        pending = null;
      }
      rows.push([item]);
    } else if (!pending) {
      pending = item;
    } else {
      rows.push([pending, item]);
      pending = null;
    }
  }
  if (pending) rows.push([pending]);
  return rows;
}

/** Categories describe where evidence was filed, not whether a claim is proven. */
export function appEvidenceCategory(title) {
  const value = String(title || '').toLowerCase().replace(/[_-]/g, ' ');
  if (/payment|deposit|upi.*screenshot|funding/.test(value)) return 'payment';
  if (/indian securit|nse|nifty|sensex|stock.*(screenshot|trading)|securities.*(screenshot|activity)/.test(value)) return 'securities';
  return 'other';
}

export function buildAppProofCards(app) {
  const sections = Array.isArray(app?.evidence?.sections) ? app.evidence.sections : [];
  return [
    { key: 'payment', title: 'Payment request' },
    { key: 'securities', title: 'Indian securities activity' },
  ].map((card) => {
    const matching = sections.filter((section) => appEvidenceCategory(section.title) === card.key);
    const withMedia = matching.filter((section) => (section.media || []).length > 0);
    const sources = withMedia.length ? withMedia : matching;
    const mediaCount = sources.reduce((count, section) => count + (section.media || []).length, 0);
    return { ...card, sources, mediaCount, status: mediaCount ? 'Supporting media available' : 'No supporting media available' };
  });
}

function appSourceLocator(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return '';
  try {
    const url = new URL(raw);
    let bucket; let key;
    if (url.protocol === 's3:') { bucket = url.hostname; key = url.pathname.slice(1); }
    else {
      const host = url.hostname.match(/^(.+)\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/i);
      if (host) { bucket = host[1]; key = url.pathname.slice(1); }
      else if (/^s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/i.test(url.hostname)) {
        const parts = url.pathname.slice(1).split('/'); bucket = parts.shift(); key = parts.join('/');
      }
    }
    if (bucket && key) return `s3://${bucket.toLowerCase()}/${decodeURIComponent(key)}`;
    url.hash = ''; return url.href;
  } catch { return raw.trim(); }
}

function appMediaVersion(media) {
  if (media?.version_id) return String(media.version_id);
  try { return new URL(media?.s3_url || media?.original_url || media?.url).searchParams.get('versionId') || ''; } catch { return ''; }
}
function appMediaChecksum(media) { return String(media?.sha256 || media?.checksum_sha256 || ''); }
function appMediaLocator(media) { return appSourceLocator(media?.s3_url || media?.original_url || media?.url); }

/** Resolve only against the analysis run's manifest or an unambiguous explicit identity. */
export function createAppPdfSourceResolver(app) {
  const sources = [];
  for (const section of app?.evidence?.sections || []) {
    for (const media of section.media || []) if (media) sources.push({ kind: 'evidence', media, sectionTitle: section.title, label: media.label || media.filename || section.title || 'Evidence' });
  }
  for (const media of app?.source_media || []) if (media) sources.push({ kind: 'store', media, label: media.label || media.filename || 'Store media' });
  const manifest = app?.analysis_results?.source_manifest;
  const entries = manifest?.schema_version === 1 && Array.isArray(manifest.media) ? manifest.media : [];
  const unique = (matches, recorded) => {
    if (matches.length === 1) return matches[0];
    if (!matches.length || matches.some((match) => !appMediaLocator(match.media).startsWith('s3://'))) return null;
    const identities = new Set(matches.map((match) => JSON.stringify([match.kind, appMediaLocator(match.media), appMediaVersion(match.media), appMediaChecksum(match.media)])));
    return identities.size === 1 ? (matches.find((match) => recorded?.section_title && match.sectionTitle === recorded.section_title) || matches[0]) : null;
  };
  return (reference) => {
    const id = typeof reference === 'string' ? reference.trim() : '';
    const recorded = id ? entries.filter((entry) => (entry?.media_id && String(entry.media_id) === id) || (entry?.source_id && String(entry.source_id) === id)) : [];
    if (recorded.length) {
      const identities = new Set(recorded.map((entry) => JSON.stringify([entry.kind, entry.source_id || '', appMediaLocator(entry), appMediaVersion(entry), appMediaChecksum(entry)])));
      if (identities.size !== 1) return { id, match: null, status: 'ambiguous', label: '' };
      const original = recorded[0]; const locator = appMediaLocator(original);
      const matches = locator ? sources.filter((source) => source.kind === original.kind && appMediaLocator(source.media) === locator && appMediaVersion(source.media) === appMediaVersion(original) && appMediaChecksum(source.media) === appMediaChecksum(original)) : [];
      const match = unique(matches, original);
      return { id, match: match || null, status: match ? 'matched' : matches.length ? 'ambiguous' : 'source_removed', label: match?.label || original.section_title || '', observed: original.selected === false ? false : Array.isArray(manifest.observed_media_ids) ? manifest.observed_media_ids.includes(original.media_id) : null };
    }
    const matches = /^(?:ev|store)_\d+$/i.test(id) || !id ? [] : sources.filter(({ media }) => [media.source_id, media.media_id, media.id, media.s3_url, media.original_url, media.url].some((value) => value && String(value) === id));
    const match = unique(matches);
    return { id, match: match || null, status: match ? 'matched' : matches.length ? 'ambiguous' : manifest?.schema_version === 1 ? 'unknown_reference' : 'missing_manifest', label: match?.label || '' };
  };
}
