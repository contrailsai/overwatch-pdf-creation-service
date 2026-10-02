/**
 * Domain cloak/lander helpers for PDF reports.
 * Mirrors the UI contract from domain-display / resolveReportLander.
 */

function cloakVariants(domain) {
  const variants = domain?.analysis_results?.cloak_probe?.variants;
  return Array.isArray(variants) ? variants : [];
}

function cloakVariantKey(variant) {
  if (!variant) return '';
  return variant.label || '';
}

function isUniqueLander(variant) {
  if (!variant) return false;
  return cloakVariantKey(variant) === 'bare' || Boolean(variant.differs_from_bare);
}

function uniqueCloakLanders(domain) {
  return cloakVariants(domain).filter(isUniqueLander);
}

function clientVisibleCloakVariants(domain) {
  const unique = uniqueCloakLanders(domain);
  const keys = domain?.review_details?.client_visible_variant_keys;
  if (!Array.isArray(keys) || keys.length === 0) return unique;
  const allowed = new Set(keys.map(String));
  const filtered = unique.filter((variant) => allowed.has(cloakVariantKey(variant)));
  return filtered.length > 0 ? filtered : unique;
}

function resolveReportLander(domain) {
  const visible = clientVisibleCloakVariants(domain);
  if (visible.length === 0) return null;
  const preferred = domain?.reportVariantKey;
  if (preferred) {
    const match = visible.find((variant) => cloakVariantKey(variant) === preferred);
    if (match) return match;
  }
  const scam = visible.find((variant) => variant.kind === 'scam' && variant.differs_from_bare);
  if (scam) return scam;
  return visible[0];
}

function domainHasCloaking(domain) {
  return (
    clientVisibleCloakVariants(domain).some((variant) => variant.differs_from_bare) ||
    Boolean(domain?.discovery?.cloak_unlocked) ||
    Boolean(domain?.analysis_results?.cloak_probe?.unlocked)
  );
}

function domainVisitUrl(domain) {
  const lander = domain?.reportLander || resolveReportLander(domain);
  if (lander?.url) return lander.url;
  if (lander?.final_url) return lander.final_url;
  if (domain?.discovery?.first_seen_url) return domain.discovery.first_seen_url;
  if (domain?.domain_name) return `https://${domain.domain_name}`;
  return '';
}

function collectDomainViolations(domain) {
  const review = domain?.review_details || {};
  const list = domain?.list || {};
  const out = [];
  const seen = new Set();
  const push = (value) => {
    const text = String(value || '').trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(text);
  };

  (Array.isArray(review.threat_types) ? review.threat_types : []).forEach(push);
  (Array.isArray(list.threat_types) ? list.threat_types : []).forEach(push);
  (Array.isArray(list.violation_flags) ? list.violation_flags : []).forEach(push);

  const codes = Array.isArray(review.legal_codes) ? review.legal_codes : [];
  codes.forEach((item) => {
    if (typeof item === 'string') push(item);
    else push(item?.code || item?.name);
  });

  return out;
}

function screenshotSrc(shot) {
  if (!shot) return null;
  if (typeof shot === 'string') return isRasterMediaUrl(shot) ? shot : null;
  return shot.s3_url || shot.url || null;
}

function isRasterMediaUrl(url, contentType) {
  if (!url || typeof url !== 'string') return false;
  if (contentType && String(contentType).startsWith('video/')) return false;
  if (contentType && String(contentType).startsWith('image/')) return true;
  if (/\.(mp4|webm|mov|m4v|avi)(\?|$)/i.test(url)) return false;
  return true;
}

function landerImageSrc(domain) {
  const lander = domain?.reportLander || resolveReportLander(domain);
  const fromLander = screenshotSrc(lander?.screenshot);
  if (fromLander && isRasterMediaUrl(fromLander, lander?.screenshot?.content_type)) return fromLander;
  const primary = screenshotSrc(domain?.analysis_results?.screenshot);
  if (primary && isRasterMediaUrl(primary, domain?.analysis_results?.screenshot?.content_type)) return primary;
  return null;
}

function landerLabel(lander) {
  const key = cloakVariantKey(lander);
  if (!key || key === 'bare') return 'Bare';
  return key;
}

function landerMediaImageUrls(lander, { limit = 16 } = {}) {
  const urls = [];
  const hero = screenshotSrc(lander?.screenshot);

  const images = lander?.media?.images;
  if (Array.isArray(images)) {
    for (const image of images) {
      const url = screenshotSrc(image);
      if (url && url !== hero && isRasterMediaUrl(url, image?.content_type)) urls.push(url);
    }
  }

  const videos = lander?.media?.videos;
  if (Array.isArray(videos)) {
    for (const video of videos) {
      const url = video?.poster_s3_url || video?.thumbnail_s3_url || video?.poster || video?.thumbnail;
      if (url && url !== hero && isRasterMediaUrl(url, video?.poster_content_type || video?.content_type)) {
        urls.push(url);
      }
    }
  }

  return urls.slice(0, limit);
}

function isDomainReviewed(domain) {
  return Boolean(domain?.list?.reviewed_at);
}

function attachReportLander(domain, variantKey) {
  const next = domain || {};
  next.reportVariantKey = variantKey || next.reportVariantKey || '';
  next.reportLander = resolveReportLander(next);
  return next;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function otherLanderVisitUrls(domain) {
  const selected = domain?.reportLander || resolveReportLander(domain);
  const selectedUrl = firstNonEmpty(selected?.url, selected?.final_url);
  const selectedLabel = landerLabel(selected);
  const seen = new Set();
  const out = [];

  for (const variant of clientVisibleCloakVariants(domain)) {
    const url = firstNonEmpty(variant?.url, variant?.final_url);
    if (!url) continue;
    if (landerLabel(variant) === selectedLabel && url === selectedUrl) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ label: landerLabel(variant), url });
  }
  return out;
}

function domainPageContent(domain) {
  const lander = domain?.reportLander || resolveReportLander(domain);
  const analysis = domain?.analysis_results || {};
  const pageText = lander?.page_text || analysis.page_text || {};
  const classification = analysis.content_classification || {};
  const title = firstNonEmpty(lander?.title, pageText.title, pageText.og_title, classification.title);
  const description = firstNonEmpty(pageText.meta_description, pageText.og_description);
  const paragraphLead = Array.isArray(pageText.paragraphs)
    ? pageText.paragraphs.filter(Boolean).slice(0, 2).join(' ')
    : '';
  const excerpt = firstNonEmpty(lander?.excerpt, classification.excerpt, classification.summary, paragraphLead);
  const headings = (Array.isArray(pageText.headings) ? pageText.headings : [])
    .map((item) => (typeof item === 'string' ? item : item?.text))
    .map((text) => String(text || '').trim())
    .filter(Boolean)
    .slice(0, 5);

  return {
    title,
    description,
    excerpt: excerpt && excerpt !== description ? excerpt : '',
    headings,
    language: pageText.language || '',
  };
}

/** First-viewport crop height vs screenshot width (~desktop starting area). */
const SCREENSHOT_HERO_RATIO = 0.72;
/** Tighter above-the-fold crop for summary table thumbs (≈16:10). */
const SCREENSHOT_SUMMARY_RATIO = 0.62;
/** Taller gallery strips — more page per cell; cells use cover-fit to avoid letterboxing. */
const SCREENSHOT_GALLERY_RATIO = 1.2;
/** Tall top-of-page crop for ad-profile evidence (height = width × 16/9 ≈ portrait 9:16). */
const SCREENSHOT_EVIDENCE_RATIO = 16 / 9;
const MAX_SCREENSHOT_SLICES = 24;
const MIN_SCREENSHOT_REMAINDER_PX = 32;

/**
 * Split a full-page screenshot into a top-of-page hero plus equal-height strips
 * for a 3x4 gallery. Heights are source pixels; callers extract with sharp.
 */
function screenshotSlicePlan(width, height, options = {}) {
  const ratio = options.heroRatio ?? SCREENSHOT_HERO_RATIO;
  const maxSlices = options.maxSlices ?? MAX_SCREENSHOT_SLICES;
  const w = Math.max(0, Math.round(Number(width) || 0));
  const h = Math.max(0, Math.round(Number(height) || 0));
  if (!w || !h) return { heroHeight: 0, slices: [] };

  const heroHeight = Math.min(h, Math.max(1, Math.round(w * ratio)));
  const slices = [];
  let top = 0;
  while (top < h && slices.length < maxSlices) {
    const remaining = h - top;
    const sliceHeight = Math.min(heroHeight, remaining);
    if (sliceHeight < MIN_SCREENSHOT_REMAINDER_PX && slices.length > 0) break;
    slices.push({ top, height: sliceHeight });
    top += sliceHeight;
  }
  return { heroHeight, slices };
}

module.exports = {
  cloakVariants,
  cloakVariantKey,
  isUniqueLander,
  uniqueCloakLanders,
  clientVisibleCloakVariants,
  resolveReportLander,
  domainHasCloaking,
  domainVisitUrl,
  collectDomainViolations,
  screenshotSrc,
  isRasterMediaUrl,
  landerImageSrc,
  landerLabel,
  landerMediaImageUrls,
  isDomainReviewed,
  attachReportLander,
  screenshotSlicePlan,
  SCREENSHOT_HERO_RATIO,
  SCREENSHOT_SUMMARY_RATIO,
  SCREENSHOT_GALLERY_RATIO,
  SCREENSHOT_EVIDENCE_RATIO,
  MAX_SCREENSHOT_SLICES,
  otherLanderVisitUrls,
  domainPageContent,
};
