#!/usr/bin/env node
/**
 * Validate a declarative template JSON, upload to S3, and upsert Supabase metadata.
 *
 * Usage:
 *   node scripts/publish-template.js templates/default-posts-detailed/v1.json
 *   node scripts/publish-template.js templates/default-posts-summary/v1.json --default
 *   node scripts/publish-template.js path/to/file.json --owner SEBI --display-name "SEBI Detailed"
 *
 * Env (see .env.example):
 *   AWS_BUCKET_NAME or AWS_S3_BUCKET
 *   AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *   SUPABASE_URL
 *   SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY
 *
 * Does not wire report-job generation.
 */

const path = require('path');
const fs = require('fs');

const envPath = path.resolve(process.cwd(), '.env');
require('dotenv').config({ path: envPath });

// Aliases used elsewhere in Overwatch
if (!process.env.AWS_BUCKET_NAME && process.env.AWS_S3_BUCKET) {
  process.env.AWS_BUCKET_NAME = process.env.AWS_S3_BUCKET;
}
if (!process.env.SUPABASE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
}

const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { validateTemplateFile } = require('../src/declarative');
const { s3Client } = require('../src/s3');
const { supabase, supabaseEnabled } = require('../src/supabase');

function parseArgs(argv) {
  const args = { file: null, isDefault: false, owner: null, displayName: null, dryRun: false };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--default') args.isDefault = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--owner') args.owner = argv[++i] || null;
    else if (a === '--display-name') args.displayName = argv[++i] || null;
    else if (a.startsWith('-')) {
      console.error(`Unknown flag: ${a}`);
      process.exit(1);
    } else positional.push(a);
  }
  args.file = positional[0] || null;
  return args;
}

function buildS3Key(ownerProjectName, templateKey, version) {
  const ownerSegment = ownerProjectName ? ownerProjectName : '_system';
  return `report_templates/${ownerSegment}/${templateKey}/v${version}.json`;
}

function humanizeKey(templateKey) {
  return String(templateKey)
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function printEnvHelp(missing) {
  console.error('');
  console.error('Missing required environment variables:');
  missing.forEach((name) => console.error(`  - ${name}`));
  console.error('');
  if (!fs.existsSync(envPath)) {
    console.error(`No .env file found at ${envPath}`);
    console.error('Copy .env.example → .env and fill in values from your Overwatch AWS / Supabase setup:');
    console.error('  cp .env.example .env');
  } else {
    console.error(`Loaded .env from ${envPath}, but some keys are still empty.`);
  }
  console.error('');
  console.error('For a validation-only check without upload:');
  console.error('  node scripts/publish-template.js templates/default-posts-summary/v1.json --default --dry-run');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Usage: node scripts/publish-template.js <template.json> [--default] [--owner PROJECT] [--display-name NAME] [--dry-run]');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), args.file);
  const result = validateTemplateFile(filePath);
  if (!result.ok) {
    console.error('Template validation failed:');
    result.errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  const template = result.template;
  const templateKey = template.id;
  const versionMatch = path.basename(filePath).match(/^v(.+)\.json$/i);
  const version = versionMatch ? versionMatch[1] : '1';
  const ownerProjectName = args.owner || null;

  if (args.isDefault && ownerProjectName) {
    console.error('--default is only allowed for system templates (omit --owner)');
    process.exit(1);
  }

  const bucket = process.env.AWS_BUCKET_NAME || process.env.AWS_S3_BUCKET || '';
  const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
  // AWS creds: env keys optional — S3Client falls back to the default provider chain
  // (~/.aws/credentials, AWS_PROFILE, SSO, instance role, etc.)

  if (!args.dryRun) {
    const missing = [];
    if (!bucket) missing.push('AWS_BUCKET_NAME (or AWS_S3_BUCKET)');
    if (!hasSupabase) missing.push('SUPABASE_URL + SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
    if (missing.length) {
      printEnvHelp(missing);
      process.exit(1);
    }
  }

  const s3Key = buildS3Key(ownerProjectName, templateKey, version);
  const latestKey = `report_templates/${ownerProjectName || '_system'}/${templateKey}/latest.json`;
  const body = Buffer.from(JSON.stringify(template, null, 2), 'utf8');
  const displayName = args.displayName || humanizeKey(templateKey);

  console.log(JSON.stringify({
    templateKey,
    version,
    ownerProjectName,
    entityType: template.entityType,
    reportType: template.reportType,
    s3Bucket: bucket || '(dry-run)',
    s3Key,
    isDefault: args.isDefault,
    displayName,
    envFile: fs.existsSync(envPath) ? envPath : '(none)',
  }, null, 2));

  if (args.dryRun) {
    console.log('Dry run — skipped S3 upload and Supabase upsert.');
    return;
  }

  await s3Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    Body: body,
    ContentType: 'application/json',
  }));
  console.log(`Uploaded s3://${bucket}/${s3Key}`);

  await s3Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: latestKey,
    Body: body,
    ContentType: 'application/json',
  }));
  console.log(`Uploaded s3://${bucket}/${latestKey}`);

  if (!supabaseEnabled) {
    console.error('Supabase client failed to initialize after env check — aborting metadata upsert.');
    process.exit(1);
  }

  const row = {
    template_key: templateKey,
    version: String(version),
    owner_project_name: ownerProjectName,
    entity_type: template.entityType,
    report_type: template.reportType,
    display_name: displayName,
    s3_bucket: bucket,
    s3_key: s3Key,
    schema_version: template.schemaVersion,
    is_default: Boolean(args.isDefault),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('report_templates')
    .upsert(row, { onConflict: 'template_key,version' })
    .select('id, template_key, version, s3_key')
    .single();

  if (error) {
    console.error('Supabase upsert failed:', error.message);
    if (error.message?.includes('relation') || error.code === '42P01') {
      console.error('Apply DDL first: overwatch_ui/supabase/scripts/create-report-templates.sql');
    }
    process.exit(1);
  }

  console.log('Supabase upserted:', data);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
