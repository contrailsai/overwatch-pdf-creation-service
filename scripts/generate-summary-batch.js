#!/usr/bin/env node
/**
 * Batch generator for a posts **Summary** (Risk) report over a large ID set.
 *
 * This is the same renderer the SQS/dev pipeline uses (`RiskReportDocument`), but it
 * is built to survive thousands of rows on a laptop:
 *
 *   - post IDs are resolved once and can be locked with `--ids-file` (or the snapshot
 *     this script writes) so the count cannot drift while the report is generated;
 *   - thumbnails are downloaded with bounded concurrency, resized to a small width
 *     (the summary table renders them at 45pt) and freed immediately — never 800px
 *     masters held for every row;
 *   - images that fail to fetch simply render as the built-in "No Img" placeholder;
 *   - progress + heap are logged so a runaway render is visible before it OOMs.
 *
 * Usage:
 *   node scripts/generate-summary-batch.js \
 *     --db Ambani-Data-Search --project-id Ambani --project-name Ambani \
 *     --since 2026-10-09T10:59:35.096Z --until 2026-10-10T10:59:35.096Z \
 *     --out local-reports/ambani-summary-24h
 *
 * Flags:
 *   --ids-file <path>   Use the post IDs from a previous snapshot.json (locks the set).
 *   --limit <n>         Only render the first n rows (smoke test).
 *   --no-images         Skip the whole image pipeline (fast structural check).
 *   --thumb-width <n>   Thumbnail width in px (default 160).
 *   --concurrency <n>   Image download concurrency (default 24).
 *   --dry-run           Resolve + count only; writes nothing.
 */

require('dotenv').config();

require('@babel/register')({
  presets: ['@babel/preset-env', '@babel/preset-react'],
  extensions: ['.js', '.jsx'],
  cache: false,
});

const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const sharp = require('sharp');
const React = require('react');
const { renderToStream } = require('@react-pdf/renderer');

const { normalizePost, resolvePostMediaUrl, generateReportHash } = require('../src/core-utils');
const { RiskReportDocument } = require('../src/components/SummaryReport');
const { watermarkPdfStream } = require('../src/pdf-watermark');
const { fetchImageFromS3Url } = require('../src/s3');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    if (key === 'no-images' || key === 'dry-run') {
      out[key] = true;
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      out[key] = true;
      continue;
    }
    out[key] = value;
    i += 1;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

const DB_NAME = args.db || 'Ambani-Data-Search';
const PROJECT_ID = args['project-id'] || 'Ambani';
const PROJECT_NAME = args['project-name'] || PROJECT_ID;
const OUT_DIR = path.resolve(ROOT, args.out || `local-reports/${DB_NAME}-summary`);
const THUMB_DIR = path.join(OUT_DIR, 'thumbs');
const THUMB_WIDTH = Number(args['thumb-width'] || 160);
const CONCURRENCY = Number(args.concurrency || 24);
const LIMIT = args.limit ? Number(args.limit) : 0;
const SKIP_IMAGES = Boolean(args['no-images']);
const DRY_RUN = Boolean(args['dry-run']);

// Reported window. Defaults to a rolling 24h ending now.
const UNTIL = args.until ? new Date(args.until) : new Date();
const SINCE = args.since ? new Date(args.since) : new Date(UNTIL.getTime() - 24 * 60 * 60 * 1000);

// Human labels used by the "Violations" column. Sourced from the tenant's real
// threat taxonomy; the renderer falls back to `threat_types` when a flag is absent.
const PROJECT = {
  project_name: PROJECT_NAME,
  project_details: {
    description: `${PROJECT_NAME} digital risk summary`,
    labels: [
      { name: 'Fraud', severity: 'high' },
      { name: 'Impersonation', severity: 'high' },
      { name: 'defamation', severity: 'medium' },
      { name: 'Misinformation', severity: 'medium' },
      { name: 'satire', severity: 'low' },
    ],
    legal_codes: [],
  },
};

function fmtBytes(n) {
  return `${(n / 1048576).toFixed(1)}MB`;
}

function logHeap(tag) {
  const { heapUsed, rss } = process.memoryUsage();
  console.log(`[mem] ${tag}: heap=${fmtBytes(heapUsed)} rss=${fmtBytes(rss)}`);
}

/**
 * Download + downscale one thumbnail. Returns the local path, or null when the post
 * has no media or the fetch/resize fails (the renderer shows the "No Img" box).
 */
async function buildThumb(post, postId) {
  const url = resolvePostMediaUrl(post);
  if (!url) return null;

  const dest = path.join(THUMB_DIR, `${postId}.jpg`);
  if (fs.existsSync(dest)) return dest;

  try {
    const raw = await fetchImageFromS3Url(url);
    const thumb = await sharp(raw)
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
    fs.writeFileSync(dest, thumb);
    return dest;
  } catch (error) {
    return null;
  }
}

async function withConcurrency(items, limit, worker, onProgress) {
  const results = new Array(items.length);
  let cursor = 0;
  let done = 0;
  async function runner() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
      done += 1;
      if (onProgress) onProgress(done, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
  return results;
}

async function loadPosts(db) {
  if (args['ids-file']) {
    const file = path.resolve(ROOT, args['ids-file']);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const ids = Array.isArray(parsed) ? parsed : parsed.ids;
    console.log(`[snapshot] ${ids.length} ids from ${file}`);
    const objectIds = ids.map((id) => new ObjectId(id));
    const docs = await db.collection('Posts').find({ _id: { $in: objectIds } }).toArray();
    const byId = new Map(docs.map((doc) => [doc._id.toString(), doc]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }

  const query = {
    'review_details.threat_score': { $exists: true, $ne: null },
    'review_details.reviewed_at': { $gte: SINCE.toISOString(), $lte: UNTIL.toISOString() },
  };
  console.log(`[query] ${DB_NAME}.Posts ${JSON.stringify(query)}`);
  const docs = await db
    .collection('Posts')
    .find(query)
    .sort({ 'review_details.reviewed_at': 1, _id: 1 })
    .toArray();
  return docs;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!SKIP_IMAGES) fs.mkdirSync(THUMB_DIR, { recursive: true });

  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  let docs = await loadPosts(db);
  console.log(`[db] resolved ${docs.length} posts`);

  if (LIMIT > 0) {
    docs = docs.slice(0, LIMIT);
    console.log(`[limit] rendering first ${docs.length}`);
  }

  if (DRY_RUN) {
    const withMedia = docs.filter((d) => resolvePostMediaUrl(d)).length;
    const scores = docs.map((d) => d.review_details?.threat_score ?? 0);
    console.log(
      JSON.stringify(
        {
          db: DB_NAME,
          since: SINCE.toISOString(),
          until: UNTIL.toISOString(),
          count: docs.length,
          withMedia,
          scoreBands: {
            safe: scores.filter((s) => s <= 40).length,
            low: scores.filter((s) => s > 40 && s <= 75).length,
            medium: scores.filter((s) => s > 75 && s <= 95).length,
            high: scores.filter((s) => s > 95).length,
          },
        },
        null,
        2,
      ),
    );
    await client.close();
    return;
  }

  // 1. Normalize into the view model the renderer expects (order preserved).
  const posts = docs.map((doc) => normalizePost(doc, { joinedProfile: null, updateHistory: [] }));

  // 2. Thumbnails — bounded concurrency, small size, failures degrade to placeholders.
  let compressedImages = new Array(posts.length).fill(null);
  if (!SKIP_IMAGES) {
    let lastLog = Date.now();
    compressedImages = await withConcurrency(
      docs,
      CONCURRENCY,
      (doc) => buildThumb(doc, doc._id.toString()),
      (done, total) => {
        if (done % 100 === 0 || done === total || Date.now() - lastLog > 15000) {
          lastLog = Date.now();
          const found = compressedImages.filter(Boolean).length;
          console.log(`[images] ${done}/${total} processed (${found} ok)`);
          logHeap(`images ${done}/${total}`);
        }
      },
    );
    const ok = compressedImages.filter(Boolean).length;
    console.log(`[images] done: ${ok}/${posts.length} thumbnails available`);
  }

  // 3. Render the same Summary document the service ships.
  logHeap('before render');
  const started = Date.now();
  const pdfStream = await renderToStream(
    React.createElement(RiskReportDocument, { posts, project: PROJECT, compressedImages }),
  );
  const stamped = await watermarkPdfStream(pdfStream);
  logHeap('after render');

  const reportHash = generateReportHash(PROJECT_ID, docs.map((d) => d._id.toString()), 'Summary', '', 'pdf', 'posts');
  const outPath = path.join(OUT_DIR, `${reportHash}.pdf`);
  fs.writeFileSync(outPath, stamped);

  const meta = {
    database: DB_NAME,
    projectId: PROJECT_ID,
    reportType: 'Summary',
    format: 'pdf',
    since: SINCE.toISOString(),
    until: UNTIL.toISOString(),
    postCount: posts.length,
    thumbnails: compressedImages.filter(Boolean).length,
    missingThumbnails: compressedImages.filter((p) => !p).length,
    reportHash,
    output: path.relative(ROOT, outPath),
    bytes: stamped.length,
    renderSeconds: Math.round((Date.now() - started) / 1000),
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT_DIR, 'report-meta.json'), JSON.stringify(meta, null, 2));

  console.log(`[done] ${meta.postCount} posts -> ${outPath} (${fmtBytes(stamped.length)}, ${meta.renderSeconds}s)`);
  await client.close();
}

main().catch((error) => {
  console.error('FAILED:', error);
  process.exit(1);
});
