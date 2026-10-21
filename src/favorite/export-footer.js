import { SANS_FONT } from './typography.js';
import qrcode from './vendor/qrcode-generator.js';
import { BRAND_NAME } from './export-brand.js';

export const TEST_PAGE_URL = 'https://hifuu.club/favorite/';

/** Use the public test page for every generated link, including local previews. */
export function resultPageUrl(href) {
  const page = new URL(href);
  if (!['http:', 'https:'].includes(page.protocol)) throw new Error('Invalid page URL.');
  return TEST_PAGE_URL;
}

/** Wrap without truncation, including long URLs without word boundaries. */
export function wrapCanvasText(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const character of text) {
    if (line && ctx.measureText(line + character).width > maxWidth) {
      lines.push(line);
      line = '';
    }
    line += character;
  }
  if (line) lines.push(line);
  return lines;
}

export function prepareResultFooter(ctx, canvasWidth, top, href) {
  const url = resultPageUrl(href);
  const qr = qrcode(0, 'M');
  qr.addData(url, 'Byte');
  qr.make();
  const quietZone = 4;
  const moduleCount = qr.getModuleCount();
  const cellSize = Math.max(2, Math.floor(160 / (moduleCount + quietZone * 2)));
  const size = (moduleCount + quietZone * 2) * cellSize;
  const right = canvasWidth - 70;
  const x = right - size;
  ctx.font = '17px ' + SANS_FONT;
  const urlLines = wrapCanvasText(ctx, url, x - 100);
  const bottom = top + size;
  const urlTop = bottom - (ctx.measureText(urlLines.at(-1)).actualBoundingBoxDescent ?? 4) - (urlLines.length - 1) * 23;
  return {
    url, qr, quietZone, moduleCount, cellSize, size,
    x, top, right, urlTop, urlLines, bottom,
    height:bottom + 40,
  };
}

export function drawResultFooter(ctx, footer, { truncated }) {
  const { qr, quietZone, moduleCount, cellSize, size, x, top } = footer;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#897793';
  const lines = [
    [22, truncated ? '此图展示前 20 位角色，完整榜单请查看分享链接或文字。' : '扫码测测，你的东方本命是谁？'],
    [20, BRAND_NAME],
    [18, '东方 Project © 上海アリス幻樂団'],
  ];
  const textRows = [];
  for (const [fontSize, text] of lines) {
    ctx.font = fontSize + 'px ' + SANS_FONT;
    for (const line of wrapCanvasText(ctx, text, x - 100)) {
      const metrics = ctx.measureText(line);
      textRows.push({ text:line, font:ctx.font,
        ascent:metrics.actualBoundingBoxAscent ?? fontSize * .8,
        descent:metrics.actualBoundingBoxDescent ?? fontSize * .2 });
    }
  }
  // Keep the URL at the lower left, with its visible bottom aligned to the QR.
  ctx.font = '17px ' + SANS_FONT;
  const urlAscent = ctx.measureText(footer.urlLines[0]).actualBoundingBoxAscent ?? 17 * .8;
  const textHeight = textRows.reduce((sum, row) => sum + row.ascent + row.descent, 0);
  const gap = (footer.urlTop - urlAscent - top - textHeight) / textRows.length;
  let y = top;
  for (const row of textRows) {
    ctx.font = row.font;
    ctx.fillText(row.text, 70, y + row.ascent);
    y += row.ascent + row.descent + gap;
  }
  // Integer cells and a four-module white quiet zone remain sharp after PNG export.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, top, size, size);
  ctx.fillStyle = '#18151c';
  for (let row = 0; row < moduleCount; row++) {
    for (let column = 0; column < moduleCount; column++) {
      if (qr.isDark(row, column)) {
        ctx.fillRect(x + (column + quietZone) * cellSize, top + (row + quietZone) * cellSize, cellSize, cellSize);
      }
    }
  }
  ctx.font = '17px ' + SANS_FONT;
  ctx.fillStyle = '#78638e';
  ctx.textAlign = 'left';
  footer.urlLines.forEach((line, index) => ctx.fillText(line, 70, footer.urlTop + index * 23));
  ctx.restore();
}
