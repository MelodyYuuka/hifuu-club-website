import { SANS_FONT as SANS, SERIF_FONT as SERIF } from './typography.js';
import { portraitCrop } from './image-layout.js';
import { drawResultBrand } from './export-brand.js';
import { drawResultBackground } from './export-background.js';

const WIDTH = 1080;
const MARGIN = 54;
const GAP = 22;
const CONTENT = WIDTH - MARGIN * 2;
const HALF = (CONTENT - GAP) / 2;

/** Keep tied ranks in equally sized cards, including a tie crossing the export limit. */
export function prepareResultPoster(allRows) {
  const rows = allRows.slice(0, 20);
  const counts = new Map();
  for (const row of allRows) counts.set(row.rank, (counts.get(row.rank) || 0) + 1);
  const cards = [];
  let cursor = 0;
  let top = 314;
  const addFeature = (index, x, y, width, height, kind) => {
    cards.push({ index, row:rows[index], x, y, width, height, kind, tied:counts.get(rows[index].rank) > 1 });
  };
  if (rows.length && counts.get(rows[0].rank) === 1) {
    addFeature(0, MARGIN, top, CONTENT, 466, 'winner');
    top += 490;
    cursor = 1;
    // Only promote complete rank groups so a tie never straddles two card styles.
    const nextCount = counts.get(rows[1]?.rank) || 0;
    const twoComplete = rows.length > 2 && (nextCount === 2 || (nextCount === 1 && counts.get(rows[2].rank) === 1));
    const featured = twoComplete ? 2 : rows.length === 2 ? 1 : 0;
    for (let index = 0; index < featured; index++) {
      addFeature(cursor++, MARGIN + index * (HALF + GAP), top, featured === 1 ? CONTENT : HALF, 258, 'featured');
    }
    if (featured) top += 284;
  } else if (rows.length && counts.get(rows[0].rank) <= 4) {
    const tied = counts.get(rows[0].rank);
    for (let index = 0; index < tied; index++) {
      addFeature(cursor++, MARGIN + (index % 2) * (HALF + GAP), top + Math.floor(index / 2) * 280, HALF, 258, 'featured');
    }
    top += Math.ceil(tied / 2) * 280;
  }
  const listTop = top;
  const remaining = rows.length - cursor;
  for (let index = 0; index < remaining; index++) {
    addFeature(cursor + index, MARGIN + (index % 2) * (HALF + GAP), listTop + Math.floor(index / 2) * 116, HALF, 102, 'row');
  }
  return { width:WIDTH, rows, cards, counts,
    footerTop:remaining ? listTop + Math.ceil(remaining / 2) * 116 + 44 : top + 26 };
}

function rounded(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

function text(ctx, value, x, y, size, color, { weight = '', family = SANS, width, min = size } = {}) {
  let fitted = size;
  ctx.font = (weight ? weight + ' ' : '') + fitted + 'px ' + family;
  while (width && ctx.measureText(value).width > width && fitted > min) {
    fitted--;
    ctx.font = (weight ? weight + ' ' : '') + fitted + 'px ' + family;
  }
  ctx.fillStyle = color;
  ctx.fillText(value, x, y, width);
}

function lines(ctx, value, x, y, width, size, color, maxLines = 2, lineHeight = size * 1.35) {
  ctx.font = '600 ' + size + 'px ' + SANS;
  const result = [];
  let line = '';
  for (const character of value) {
    if (line && ctx.measureText(line + character).width > width) { result.push(line); line = ''; }
    line += character;
  }
  if (line) result.push(line);
  result.slice(0, maxLines).forEach((line, index) => text(ctx, line, x, y + index * lineHeight, size, color, {weight:'600', width}));
  return Math.min(result.length, maxLines);
}

function star(ctx, x, y, size, color) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x, y, x + size, y);
  ctx.quadraticCurveTo(x, y, x, y + size);
  ctx.quadraticCurveTo(x, y, x - size, y);
  ctx.quadraticCurveTo(x, y, x, y - size);
  ctx.fillStyle = color;
  ctx.fill();
}

function orbit(ctx, x, y, radius, color) {
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
}

function containedPortrait(ctx, image, x, y, width, height, fallback) {
  if (!image) {
    text(ctx, fallback.slice(0, 2), x + width / 2 - 50, y + height / 2 + 20, 50, '#b5a5c2', {family:SERIF});
    return;
  }
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawnWidth = image.naturalWidth * scale;
  const drawnHeight = image.naturalHeight * scale;
  ctx.drawImage(image, x + (width - drawnWidth) / 2, y + (height - drawnHeight), drawnWidth, drawnHeight);
}

function drawWinner(ctx, card, image) {
  const {x, y, width, height, row} = card;
  ctx.save();
  ctx.shadowColor = '#43304a16'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
  rounded(ctx, x, y, width, height, 28, '#fffdf9');
  ctx.restore();
  ctx.save();
  rounded(ctx, x, y, width, height, 28); ctx.clip();
  const wash = ctx.createLinearGradient(x + 360, y, x + width, y + height);
  wash.addColorStop(0, '#fffdf900'); wash.addColorStop(1, '#e6ddef');
  ctx.fillStyle = wash; ctx.fillRect(x, y, width, height);
  ctx.beginPath(); ctx.ellipse(x + 735, y + 246, 186, 192, -.16, 0, Math.PI * 2);
  ctx.fillStyle = '#e9dff0'; ctx.fill();
  orbit(ctx, x + 742, y + 234, 200, '#b3a0c149');
  orbit(ctx, x + 742, y + 234, 211, '#b3a0c126');
  text(ctx, '01', x + 775, y + 435, 134, '#c8b6d047', {family:'Georgia, serif'});
  star(ctx, x + 540, y + 106, 14, '#baa477'); star(ctx, x + 908, y + 350, 11, '#a38bb6');
  containedPortrait(ctx, image, x + 480, y + 20, width - 504, height - 42, row.character.name);
  rounded(ctx, x + 42, y + 38, 208, 40, 20, '#f2e9db');
  text(ctx, '♡  我的本命角色', x + 60, y + 65, 21, '#8a7046');
  const count = lines(ctx, row.character.name, x + 42, y + 155, 440, 48, '#46334f', 2, 61);
  text(ctx, row.character.title, x + 44, y + 155 + count * 61, 23, '#8b7594', {width:420, min:18});
  ctx.fillStyle = '#c5ac7e'; ctx.fillRect(x + 44, y + 322, 42, 2);
  text(ctx, '穿过幻想的边界，', x + 44, y + 364, 22, '#8d7f91', {family:SERIF});
  text(ctx, '最想遇见的，一直是你。', x + 44, y + 400, 22, '#8d7f91', {family:SERIF});
  text(ctx, '第 1 名', x + 44, y + 441, 17, '#a28c68');
  ctx.restore();
  rounded(ctx, x + .5, y + .5, width - 1, height - 1, 28, null, '#d9ccbb');
}

function drawFeatured(ctx, card, image) {
  const {x, y, width, height, row, tied} = card;
  const purple = row.rank <= 2;
  ctx.save();
  rounded(ctx, x, y, width, height, 22, purple ? '#eee6f2' : '#f3e9df', purple ? '#ded1e5' : '#e7d8c7');
  ctx.clip();
  const artWidth = width > HALF ? 340 : 206;
  const artX = x + width - artWidth - 14;
  ctx.beginPath(); ctx.arc(artX + artWidth / 2, y + 143, 95, 0, Math.PI * 2);
  ctx.fillStyle = purple ? '#e2d5e8' : '#eadaca'; ctx.fill();
  containedPortrait(ctx, image, artX, y + 16, artWidth, height - 25, row.character.name);
  text(ctx, String(row.rank).padStart(2, '0'), x + 27, y + 80, 66, purple ? '#897198' : '#a18a6d', {family:'Georgia, serif'});
  text(ctx, tied ? '并列第 ' + row.rank + ' 名' : '第 ' + row.rank + ' 名', x + 111, y + 63, 17, '#95829c');
  const textWidth = width - artWidth - 64;
  const count = lines(ctx, row.character.name, x + 28, y + 145, textWidth, 27, '#4d3b56', 2, 36);
  text(ctx, row.character.title, x + 29, y + 145 + count * 36, 17, '#97849d', {width:textWidth, min:14});
  ctx.restore();
}

function drawRow(ctx, card, image) {
  const {x, y, width, height, row, tied} = card;
  rounded(ctx, x, y, width, height, 16, '#fffdf9', '#e9e1d7');
  text(ctx, String(row.rank).padStart(2, '0'), x + 20, y + 57, 32, '#a08aae', {family:'Georgia, serif'});
  if (tied) text(ctx, '并列', x + 24, y + 80, 13, '#ac9aaf');
  ctx.save();
  rounded(ctx, x + 76, y + 8, 78, 86, 12, '#f0eaf2'); ctx.clip();
  if (image) {
    const crop = portraitCrop(image.naturalWidth, image.naturalHeight, 78, 86);
    ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, x + 76, y + 8, 78, 86);
  } else {
    text(ctx, row.character.name.slice(0, 2), x + 83, y + 60, 25, '#b5a5c2', {family:SERIF});
  }
  ctx.restore();
  text(ctx, row.character.name, x + 174, y + 43, 23, '#4d3b56', {weight:'500', width:width - 195, min:17});
  text(ctx, row.character.title, x + 174, y + 73, 16, '#9b899f', {width:width - 195, min:13});
}

/** Draw the local Hakugyokurou backdrop and portraits directly into the exported PNG. */
export function drawResultPoster(ctx, layout, { total, allRows, logo, images, height, background }) {
  ctx.save();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  drawResultBackground(ctx, background, WIDTH, height);
  drawResultBrand(ctx, logo);
  text(ctx, '我的东方本命角色榜单', 70, 161, 50, '#49334f', {weight:'600', family:SERIF});
  text(ctx, '没有标准答案，只有此刻的心之所向。', 72, 215, 23, '#806c88');
  const summary = '从 ' + total + ' 位角色中选出  ·  ' + allRows.length + ' 位上榜角色';
  ctx.font = '17px ' + SANS;
  // Fit the badge to its actual label, with the same 16px inset on both sides.
  const summaryWidth = Math.ceil(ctx.measureText(summary).width);
  rounded(ctx, 70, 247, summaryWidth + 32, 34, 17, '#fffaf7b0', '#aa8eaf55');
  text(ctx, summary, 86, 270, 17, '#7e6789');
  for (const card of layout.cards) {
    const image = images[card.index];
    if (card.kind === 'winner') drawWinner(ctx, card, image);
    else if (card.kind === 'featured') drawFeatured(ctx, card, image);
    else drawRow(ctx, card, image);
  }
  ctx.beginPath(); ctx.moveTo(70, layout.footerTop - 25); ctx.lineTo(1010, layout.footerTop - 25);
  ctx.strokeStyle = '#d6cadd'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}
