#!/usr/bin/env node
/**
 * Batch generator for **Domains Detailed** PDFs over a reviewed window.
 *
 * One PDF per domain, named `NN-<slug>-<id>.pdf` (matching the existing
 * `local-reports/output/sebi-apps` convention), plus a `manifest.json`.
 *
 * It reuses the exact production pipeline (`runReportJob` with `persist: 'local'`),
 * so lander resolution, screenshot slicing, compression and the watermark are the
 * same code paths the service ships. Supabase status writes are disabled for the
 * batch so a local run does not create report rows in the live table.
 *
 * Usage:
 *   node scripts/generate-domains-batch.js \
 *     --db SEBI-Data-Search --project-id SEBI \
 *     --since 2026-10-13T00:00:00.000Z --until 2026-10-16T00:00:00.000Z \
 *     --out local-reports/output/sebi-domains
 *
 * Flags:
 *   --limit <n>        Render only the first n domains.
 *   --concurrency <n>  Domains rendered in parallel (default 3).
 *   --force            Overwrite files that already exist.
 *   --dry-run          Resolve + list only; writes nothing.
 */

require('dotenv').config();

// Side-effect guard: keep the batch out of the live report-status table.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_KEY;

require('@babel/register')({
  presets: ['@babel/preset-env', '@babel/preset-react'],
  extensions: ['.js', '.jsx'],
  cache: false,
});

const fs = require('fs');
const path = require('path');
const { connectToMongo } = require('../src/mongo');
const { runReportJob } = require('../src/report-job');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    if (key === 'force' || key === 'dry-run') {
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

const DB_NAME = args.db || 'SEBI-Data-Search';
const PROJECT_ID = args['project-id'] || 'SEBI';
const OUT_DIR = path.resolve(ROOT, args.out || 'local-reports/output/sebi-domains');
const TMP_DIR = path.join(OUT_DIR, '.tmp');
const CONCURRENCY = Math.max(1, Number(args.concurrency || 3));
const LIMIT = args.limit ? Number(args.limit) : 0;
const FORCE = Boolean(args.force);
const DRY_RUN = Boolean(args['dry-run']);
const SINCE = new Date(args.since || '2026-10-13T00:00:00.000Z');
const UNTIL = new Date(args.until || '2026-10-16T00:00:00.000Z'); // exclusive

const PROJECT = {
  project_name: PROJECT_ID,
  project_details: {
    labels: [
      { name: 'Fraud', severity: 'high' },
      { name: 'Impersonation', severity: 'high' },
    ],
    legal_codes: [],
  },
};

const slug = (value) =>
  String(value || 'domain')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'domain';

function fmtBytes(n) {
  return `${(n / 1048576).toFixed(1)}MB`;
}

async function withConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function runner() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
  return results;
}

async function main() {
  const started = Date.now();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const client = await connectToMongo();
  const db = client.db(DB_NAME);

  const query = { 'list.reviewed_at': { $gte: SINCE, $lt: UNTIL } };
  console.log(`[query] ${DB_NAME}.Domains ${JSON.stringify(query)}`);
  let docs = await db
    .collection('Domains')
    .find(query)
    .sort({ 'list.reviewed_at': 1, _id: 1 })
    .toArray();
  console.log(`[db] resolved ${docs.length} reviewed domains`);

  if (LIMIT > 0) docs = docs.slice(0, LIMIT);

  const jobs = docs.map((doc, index) => ({
    doc,
    index: index + 1,
    id: doc._id.toString(),
    name: doc.domain_name || 'unknown-domain',
    reviewedAt: doc.list?.reviewed_at || null,
  }));

  for (const job of jobs) {
    job.fileName = `${String(job.index).padStart(2, '0')}-${slug(job.name)}-${job.id}.pdf`;
    job.filePath = path.join(OUT_DIR, job.fileName);
  }

  if (DRY_RUN) {
    for (const job of jobs) console.log(`[dry-run] ${job.fileName}  reviewed_at=${job.reviewedAt}`);
    console.log(`[dry-run] ${jobs.length} domains, nothing written`);
    await client.close();
    return;
  }

  if (!FORCE) fs.mkdirSync(TMP_DIR, { recursive: true });

  let done = 0;
  const results = await withConcurrency(jobs, CONCURRENCY, async (job) => {
    if (!FORCE && fs.existsSync(job.filePath)) {
      done += 1;
      console.log(`[skip] ${job.fileName} (exists)`);
      return { ...job, status: 'skipped' };
    }

    const payload = {
      projectId: PROJECT_ID,
      entityType: 'domains',
      domainIds: [job.id],
      database_name: DB_NAME,
      reportType: 'Detailed',
      reportFormat: 'pdf',
      project: PROJECT,
      profile: null,
    };

    const jobStarted = Date.now();
    try {
      const result = await runReportJob(client, payload, {
        persist: 'local',
        localOutputDir: FORCE ? OUT_DIR : TMP_DIR,
      });
      fs.renameSync(result.localPath, job.filePath);
      done += 1;
      const bytes = fs.statSync(job.filePath).size;
      console.log(
        `[${done}/${jobs.length}] ${job.fileName} (${fmtBytes(bytes)}, ${Math.round((Date.now() - jobStarted) / 1000)}s)`,
      );
      return { ...job, status: 'ok', reportHash: result.reportHash, bytes };
    } catch (error) {
      done += 1;
      console.error(`[${done}/${jobs.length}] FAILED ${job.fileName}: ${error.message}`);
      return { ...job, status: 'failed', error: error.message };
    }
  });

  const ok = results.filter((r) => r.status === 'ok');
  const skipped = results.filter((r) => r.status === 'skipped');
  const failed = results.filter((r) => r.status === 'failed');

  const manifest = {
    database: DB_NAME,
    projectId: PROJECT_ID,
    entityType: 'domains',
    reportType: 'Detailed',
    format: 'pdf',
    since: SINCE.toISOString(),
    until: UNTIL.toISOString(),
    domainCount: jobs.length,
    generated: ok.length,
    skipped: skipped.length,
    failed: failed.length,
    generatedAt: new Date().toISOString(),
    renderSeconds: Math.round((Date.now() - started) / 1000),
    reports: results.map((r) => ({
      index: r.index,
      domain: r.name,
      domainId: r.id,
      reviewedAt: r.reviewedAt,
      file: r.status === 'failed' ? null : r.fileName,
      status: r.status,
      bytes: r.bytes || null,
      error: r.error || null,
    })),
  };
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Drop the scratch dir when the pipeline left nothing behind.
  try {
    if (fs.existsSync(TMP_DIR) && fs.readdirSync(TMP_DIR).length === 0) fs.rmdirSync(TMP_DIR);
  } catch {
    /* ignore */
  }

  console.log(
    `[done] ${ok.length} generated, ${skipped.length} skipped, ${failed.length} failed -> ${path.relative(ROOT, OUT_DIR)} (${manifest.renderSeconds}s)`,
  );
  if (failed.length > 0) process.exitCode = 1;
  await client.close();
}

main().catch((error) => {
  console.error('FAILED:', error);
  process.exit(1);
});
