const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PDFDocument, degrees } = require('pdf-lib');

const WATERMARK_FILL = '#0000A0';
const WATERMARK_OPACITY = 0.07;
const WATERMARK_ROTATION_DEG = 55;
/** Raster width in px — sharp output used as the PDF image source. */
const WATERMARK_RASTER_WIDTH = 2400;
/** Drawn width as a fraction of the page's longer side. */
const WATERMARK_PAGE_FRACTION = 0.85;

const LOGO_SVG_PATH = path.join(__dirname, '..', 'public', 'logo_txt.svg');

/** @type {Promise<Buffer>|null} */
let watermarkPngPromise = null;

/**
 * Recolor the wordmark SVG to the sample watermark blue and rasterize once.
 * @returns {Promise<Buffer>}
 */
function getWatermarkPng() {
  if (!watermarkPngPromise) {
    watermarkPngPromise = (async () => {
      const svg = fs.readFileSync(LOGO_SVG_PATH, 'utf8');
      const recolored = svg.replace(/fill="white"/gi, `fill="${WATERMARK_FILL}"`);
      return sharp(Buffer.from(recolored))
        .resize({ width: WATERMARK_RASTER_WIDTH, fit: 'inside' })
        .png()
        .toBuffer();
    })().catch((err) => {
      watermarkPngPromise = null;
      throw err;
    });
  }
  return watermarkPngPromise;
}

/**
 * @param {import('stream').Readable} readable
 * @returns {Promise<Buffer>}
 */
async function streamToBuffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Stamp a faint diagonal Contrails wordmark on every page of a PDF buffer.
 * @param {Buffer} pdfBuffer
 * @returns {Promise<Buffer>}
 */
async function stampPdfWatermark(pdfBuffer) {
  const pngBytes = await getWatermarkPng();
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const watermarkImage = await pdfDoc.embedPng(pngBytes);
  const pages = pdfDoc.getPages();
  const aspect = watermarkImage.width / watermarkImage.height;
  const theta = (WATERMARK_ROTATION_DEG * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  for (const page of pages) {
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const drawWidth = Math.max(pageWidth, pageHeight) * WATERMARK_PAGE_FRACTION;
    const drawHeight = drawWidth / aspect;
    const cx = pageWidth / 2;
    const cy = pageHeight / 2;
    // pdf-lib rotates around the image's bottom-left; offset so the center stays at (cx, cy).
    const x = cx - (drawWidth / 2) * cos + (drawHeight / 2) * sin;
    const y = cy - (drawWidth / 2) * sin - (drawHeight / 2) * cos;

    page.drawImage(watermarkImage, {
      x,
      y,
      width: drawWidth,
      height: drawHeight,
      rotate: degrees(WATERMARK_ROTATION_DEG),
      opacity: WATERMARK_OPACITY,
    });
  }

  const stamped = await pdfDoc.save();
  return Buffer.from(stamped);
}

/**
 * Buffer a PDF render stream and stamp the watermark on every page.
 * @param {import('stream').Readable} pdfStream
 * @returns {Promise<Buffer>}
 */
async function watermarkPdfStream(pdfStream) {
  const raw = await streamToBuffer(pdfStream);
  return stampPdfWatermark(raw);
}

module.exports = {
  stampPdfWatermark,
  watermarkPdfStream,
  streamToBuffer,
};
