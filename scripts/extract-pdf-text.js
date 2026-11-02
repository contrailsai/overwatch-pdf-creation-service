#!/usr/bin/env node
/**
 * Minimal PDF text extractor for react-pdf output (verification helper).
 *
 * react-pdf/PDFKit embeds subset fonts, so page content streams carry glyph ids
 * rather than ASCII. Each font ships a ToUnicode CMap; this walks the page
 * resources, builds code -> unicode maps per font, then decodes Tj/TJ operators.
 *
 * Usage: node scripts/extract-pdf-text.js <file.pdf> [--page N] [--json]
 */

const fs = require('fs');
const zlib = require('zlib');
const {
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFDict,
  PDFArray,
  PDFRef,
  PDFHexString,
  PDFString,
} = require('pdf-lib');

function streamBytes(obj) {
  let data = obj.getContents();
  const filter = obj.dict.get(PDFName.of('Filter'))?.toString() || '';
  if (filter.includes('FlateDecode')) {
    try {
      data = zlib.inflateSync(data);
    } catch {
      /* leave raw */
    }
  }
  return data;
}

function parseCMap(text) {
  const map = new Map();
  let codeLen = 2;
  const lines = text.split(/\r?\n/);
  let mode = null;
  for (const line of lines) {
    const t = line.trim();
    if (t.endsWith('begincodespacerange')) { mode = 'space'; continue; }
    if (t.endsWith('endcodespacerange')) { mode = null; continue; }
    // PDFKit prefixes the operator with a count: "41 beginbfchar"
    if (t.endsWith('beginbfchar')) { mode = 'char'; continue; }
    if (t.endsWith('endbfchar')) { mode = null; continue; }
    if (t.endsWith('beginbfrange')) { mode = 'range'; continue; }
    if (t.endsWith('endbfrange')) { mode = null; continue; }
    if (!mode) continue;
    const parts = t.match(/<[0-9A-Fa-f]+>|[0-9A-Fa-f]+/g);
    if (!parts || parts.length < 2) continue;
    if (mode === 'space') {
      // <lo><hi> — byte width of every code in this CMap
      codeLen = parts[0].replace(/[<>]/g, '').length / 2;
      continue;
    }
    if (mode === 'char') {
      const src = parseInt(parts[0].replace(/[<>]/g, ''), 16);
      const dstHex = parts[1].replace(/[<>]/g, '');
      map.set(src, hexToUnicode(dstHex));
    } else {
      const lo = parseInt(parts[0].replace(/[<>]/g, ''), 16);
      const hi = parseInt(parts[1].replace(/[<>]/g, ''), 16);
      const dstHex = parts[2].replace(/[<>]/g, '');
      const base = parseInt(dstHex, 16);
      for (let c = lo; c <= hi; c += 1) map.set(c, String.fromCodePoint(base + (c - lo)));
    }
  }
  return { map, codeLen };
}

function hexToUnicode(hex) {
  let out = '';
  for (let i = 0; i + 4 <= hex.length; i += 4) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  }
  return out;
}

function buildFontMaps(doc, page) {
  const maps = new Map(); // /F1 -> {map, codeLen}
  const res = page.node.Resources();
  if (!res) return maps;
  const fonts = res.lookup(PDFName.of('Font'));
  if (!(fonts instanceof PDFDict)) return maps;
  for (const [name, ref] of fonts.entries()) {
    const font = doc.context.lookup(ref);
    if (!(font instanceof PDFDict)) continue;
    const tu = font.get(PDFName.of('ToUnicode'));
    if (!tu) continue;
    const tuObj = doc.context.lookup(tu);
    if (!(tuObj instanceof PDFRawStream)) continue;
    const { map, codeLen } = parseCMap(streamBytes(tuObj).toString('latin1'));
    // Resource names stringify with the leading slash ("/F2"); content uses "F2".
    maps.set(name.toString().replace(/^\//, ''), { map, codeLen });
  }
  return maps;
}

function decodeHex(hex, fontInfo) {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, '');
  let out = '';
  if (!fontInfo) return '';
  const { map, codeLen } = fontInfo;
  for (let i = 0; i + codeLen * 2 <= clean.length; i += codeLen * 2) {
    const code = parseInt(clean.slice(i, i + codeLen * 2), 16);
    out += map.get(code) ?? '';
  }
  return out;
}

function extractPageText(doc, page) {
  const maps = buildFontMaps(doc, page);
  const contents = page.node.Contents();
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
  let text = '';
  let currentFont = null;
  for (const r of refs) {
    const obj = doc.context.lookup(r);
    if (!(obj instanceof PDFRawStream)) continue;
    const content = streamBytes(obj).toString('latin1');
    const tokenRe = /\/([A-Za-z0-9]+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f\s]*)>\s*Tj|\[([^\]]*)\]\s*TJ|\((?:[^()\\]|\\.)*\)\s*Tj/g;
    let m;
    while ((m = tokenRe.exec(content)) !== null) {
      if (m[1]) {
        currentFont = m[1];
        continue;
      }
      const fontInfo = maps.get(currentFont) || null;
      if (m[2] !== undefined) {
        text += decodeHex(m[2], fontInfo);
      } else if (m[3] !== undefined) {
        const parts = m[3].match(/<[0-9A-Fa-f\s]*>|\((?:[^()\\]|\\.)*\)|-?[\d.]+/g) || [];
        for (const part of parts) {
          if (part.startsWith('<')) text += decodeHex(part, fontInfo);
          else if (part.startsWith('(')) text += part.slice(1, -1);
        }
      }
      text += '\n';
    }
  }
  return text;
}

async function main() {
  const file = process.argv[2];
  const pageArg = process.argv.indexOf('--page');
  const onlyPage = pageArg !== -1 ? Number(process.argv[pageArg + 1]) : null;
  const asJson = process.argv.includes('--json');
  if (!file) throw new Error('Usage: node scripts/extract-pdf-text.js <file.pdf> [--page N] [--json]');

  const doc = await PDFDocument.load(fs.readFileSync(file));
  const pages = doc.getPages();
  const out = [];
  for (let i = 0; i < pages.length; i += 1) {
    if (onlyPage != null && i !== onlyPage) continue;
    out.push({ page: i + 1, text: extractPageText(doc, pages[i]) });
  }
  if (asJson) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  for (const p of out) console.log(`===== PAGE ${p.page} =====\n${p.text}`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
