const test = require('node:test');
const assert = require('node:assert/strict');
require('@babel/register')({ presets: ['@babel/preset-env', '@babel/preset-react'], extensions: ['.js', '.jsx'], cache: false });
const { processAndCacheAppImages } = require('../../src/report-job');

test('app evidence image fetches run in batches of four and retain slots', async () => {
  let active = 0;
  let peak = 0;
  const app = { _id: 'batch-test', evidence: { sections: [{ images: Array.from({ length: 9 }, (_, i) => ({ slot: `0:${i}`, url: `https://example.com/${i}.png` })) }] } };
  const imageProcessor = async (url) => {
    if (!url) return null;
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setImmediate(resolve));
    active -= 1;
    return url;
  };
  const result = await processAndCacheAppImages([app], { includeEvidence: true, imageProcessor });
  assert.equal(peak, 4);
  assert.deepEqual([...result.compressedEvidenceImages[0].keys()], Array.from({ length: 9 }, (_, i) => `0:${i}`));
});
