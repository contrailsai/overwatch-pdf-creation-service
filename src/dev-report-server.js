/**
 * Local dev HTTP server: POST the same JSON body as an SQS message record body
 * to generate a report from Mongo + S3 (images) and persist the PDF/DOCX to disk,
 * then GET the file (e.g. wget/curl).
 *
 * Env:
 *   REPORT_DEV_PORT (default 3847)
 *   REPORT_DEV_HOST (default 127.0.0.1)
 *   LOCAL_REPORT_OUTPUT_DIR (default ./local-reports/output)
 *   DEV_REPORT_API_KEY — if set, require Authorization: Bearer <key>
 *
 * Does not load OpenTelemetry instrumentation (keeps startup simple for local use).
 */
require('dotenv').config();

require('@babel/register')({
  presets: ['@babel/preset-env', '@babel/preset-react'],
  extensions: ['.js', '.jsx'],
  cache: false,
});

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { connectToMongo, getMongoClient } = require('./mongo');
const { validatePayload } = require('./core-utils');
const { runReportJob } = require('./report-job');

const PORT = Number(process.env.REPORT_DEV_PORT || 3847);
const HOST = process.env.REPORT_DEV_HOST || '127.0.0.1';
const OUTPUT_DIR = path.resolve(process.cwd(), process.env.LOCAL_REPORT_OUTPUT_DIR || 'local-reports/output');
const API_KEY = process.env.DEV_REPORT_API_KEY || '';
const MAX_BODY = 4 * 1024 * 1024;

const FILE_RE = /^[a-f0-9]{64}\.(pdf|docx)$/;

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function checkAuth(req) {
  if (!API_KEY) return true;
  const h = req.headers.authorization || '';
  const want = `Bearer ${API_KEY}`;
  return h === want;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        reject(new Error('Empty body'));
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

async function handlePostReports(req, res) {
  if (!checkAuth(req)) {
    sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (e) {
    sendJson(res, 400, { ok: false, error: e.message });
    return;
  }

  const validation = validatePayload(payload);
  if (!validation.valid) {
    sendJson(res, 400, { ok: false, error: 'Invalid payload', details: validation.errors });
    return;
  }

  try {
    await connectToMongo();
    const client = getMongoClient();
    const result = await runReportJob(client, payload, {
      persist: 'local',
      localOutputDir: OUTPUT_DIR,
    });

    const fileName = `${result.reportHash}.${result.format}`;
    const downloadPath = `/reports/${fileName}`;
    const base = `http://${HOST}:${PORT}`;
    const wgetLine = `wget -O ${fileName} ${base}${downloadPath}`;

    sendJson(res, 200, {
      ok: true,
      reportHash: result.reportHash,
      format: result.format,
      localPath: result.localPath,
      downloadPath,
      downloadUrl: `${base}${downloadPath}`,
      wget: wgetLine,
    });
  } catch (err) {
    const status = err.code === 'INVALID_PAYLOAD' ? 400 : 500;
    sendJson(res, status, {
      ok: false,
      error: err.message,
      details: err.validationErrors || undefined,
    });
  }
}

function handleGetReport(req, res, pathname) {
  const base = path.basename(pathname);
  if (!FILE_RE.test(base)) {
    sendJson(res, 400, { ok: false, error: 'Invalid file name' });
    return;
  }
  const abs = path.join(OUTPUT_DIR, base);
  const resolved = path.resolve(abs);
  const root = path.resolve(OUTPUT_DIR);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    sendJson(res, 400, { ok: false, error: 'Invalid path' });
    return;
  }
  if (!fs.existsSync(resolved)) {
    sendJson(res, 404, { ok: false, error: 'File not found' });
    return;
  }
  const stat = fs.statSync(resolved);
  const type = base.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Content-Disposition': `attachment; filename="${base}"`,
  });
  fs.createReadStream(resolved).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
    const pathname = url.pathname.replace(/\/$/, '') || '/';

    if (req.method === 'GET' && pathname === '/health') {
      sendJson(res, 200, { ok: true, service: 'report-dev-server' });
      return;
    }

    if (req.method === 'POST' && (pathname === '/' || pathname === '/reports')) {
      await handlePostReports(req, res);
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/reports/')) {
      handleGetReport(req, res, pathname);
      return;
    }

    sendJson(res, 404, {
      ok: false,
      error: 'Not found',
      hint: 'POST / or /reports with SQS-equivalent JSON body; GET /reports/<reportHash>.pdf',
    });
  } catch (e) {
    sendJson(res, 500, { ok: false, error: e.message });
  }
});

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

server.listen(PORT, HOST, () => {
  console.log(`Report dev server listening on http://${HOST}:${PORT}`);
  console.log(`POST JSON (same as SQS body) → saves under ${OUTPUT_DIR}`);
  if (API_KEY) console.log('DEV_REPORT_API_KEY is set — requests require Authorization: Bearer …');
});
