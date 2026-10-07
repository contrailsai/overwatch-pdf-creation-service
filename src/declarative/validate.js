const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const schemaPath = path.join(__dirname, 'schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false });
const validateFn = ajv.compile(schema);

/**
 * @param {unknown} template
 * @returns {{ ok: true, template: object } | { ok: false, errors: string[] }}
 */
function validateTemplate(template) {
  if (!template || typeof template !== 'object') {
    return { ok: false, errors: ['Template must be a JSON object'] };
  }
  const valid = validateFn(template);
  if (valid) {
    return { ok: true, template };
  }
  const errors = (validateFn.errors || []).map((e) => {
    const loc = e.instancePath || '/';
    return `${loc} ${e.message}`.trim();
  });
  return { ok: false, errors };
}

/**
 * @param {string} filePath
 * @returns {{ ok: true, template: object } | { ok: false, errors: string[] }}
 */
function validateTemplateFile(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return { ok: false, errors: [`Failed to read ${filePath}: ${err.message}`] };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, errors: [`Invalid JSON in ${filePath}: ${err.message}`] };
  }
  return validateTemplate(parsed);
}

module.exports = {
  schema,
  validateTemplate,
  validateTemplateFile,
};
