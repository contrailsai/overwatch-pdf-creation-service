/** Allowed block `type` values for schemaVersion 1 declarative templates. */
const BLOCK_TYPES = Object.freeze([
  'row',
  'columns',
  'stack',
  'spacer',
  'divider',
  'text',
  'link',
  'image',
  'badge',
  'kvGrid',
  'list',
  'table',
  'section',
  'metricsRow',
  'brandHeader',
  'pageFooter',
]);

const ENTITY_TYPES = Object.freeze(['posts', 'ads', 'domains', 'ad_profiles']);
const REPORT_TYPES = Object.freeze([
  'Summary',
  'Detailed',
  'Single',
  'Profile',
  'SimpleProfile',
  'SimpleCase',
]);

module.exports = {
  BLOCK_TYPES,
  ENTITY_TYPES,
  REPORT_TYPES,
};
