# Declarative report templates (phase 1)

JSON layouts for Overwatch PDF reports. **Not wired into `report-job.js` yet** — production exports still use React components under `src/components/`.

## Layout

| Piece | Location |
|---|---|
| JSON Schema | `src/declarative/schema.json` |
| Validator | `src/declarative/validate.js` |
| Defaults | `templates/default-posts-summary/v1.json`, `templates/default-posts-detailed/v1.json` |
| Publish | `npm run publish-template -- <file> [--default] [--owner PROJECT]` |
| Metadata DDL | `overwatch_ui/supabase/scripts/create-report-templates.sql` |

## S3 keys

Same bucket as `AWS_BUCKET_NAME` / `AWS_S3_BUCKET`:

- System: `report_templates/_system/{template_key}/v{version}.json`
- Project-owned: `report_templates/{owner_project_name}/{template_key}/v{version}.json`

## Publish system defaults

```bash
# Apply DDL in Supabase first, then:
node scripts/publish-template.js templates/default-posts-summary/v1.json --default
node scripts/publish-template.js templates/default-posts-detailed/v1.json --default
```

Requires a local `.env` (copy from `.env.example`):

```bash
cp .env.example .env
# fill AWS_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
# SUPABASE_URL, SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
```

Validate JSON without uploading: add `--dry-run`.

## Preview / assignment UI

`overwatch_ui` → Configurations → **Report Templates** loads JSON from S3 and renders one reviewed post with `@react-pdf/renderer`.
