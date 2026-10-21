import { SANS_FONT } from '../src/favorite/typography.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { BRAND_NAME, BRAND_LOGO_URL, drawResultBrand } from '../src/favorite/export-brand.js';
import { prepareResultPoster, drawResultPoster } from '../src/favorite/export-poster.js';
import { RESULT_BACKGROUND_URL } from '../src/favorite/export-background.js';
import { recordingCanvas } from './helpers/canvas.mjs';

const app = await readFile(new URL('../src/favorite/app.js', import.meta.url), 'utf8');

const drawingContext = recordingCanvas;

test('export reuses the existing main-site favicon with a deployment-relative asset URL', async () => {
  assert.equal(BRAND_LOGO_URL, new URL('../src/assets/favicon.png', import.meta.url).href);
  const png = await readFile(new URL(BRAND_LOGO_URL));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 512);
  assert.equal(png.readUInt32BE(20), 512);
  const html = await readFile(new URL('../src/favorite/index.html', import.meta.url), 'utf8');
  assert.match(html, /class="brand-logo" src="\.\.\/assets\/favicon\.png"/);
});

test('header emblem is fully contained beside the site name, preserving proportions and canvas state', () => {
  for (const [naturalWidth, naturalHeight] of [[512, 512], [800, 400], [400, 800]]) {
    const {ctx, images, texts} = drawingContext();
    const logo = {naturalWidth, naturalHeight};
    drawResultBrand(ctx, logo);
    assert.equal(images.length, 1);
    const [image, x, y, width, height] = images[0];
    assert.equal(image, logo);
    assert.equal(images[0].length, 5, 'Draw the full emblem rather than a source crop');
    assert.ok(Math.abs(width / height - naturalWidth / naturalHeight) < 1e-12);
    assert.ok(x >= 70 && y >= 41 && x + width <= 114 && y + height <= 85);
    assert.deepEqual(texts, [{text:BRAND_NAME, x:128, y:70, font:'19px ' + SANS_FONT, align:'left', baseline:'alphabetic'}]);
    assert.equal(ctx.textAlign, 'right');
    assert.equal(ctx.textBaseline, 'top');
    assert.equal(ctx.font, '10px sans-serif');
    assert.equal(ctx.fillStyle, '#000000');
  }
});

test('unavailable emblem keeps the original site-name position without blocking export', () => {
  const {ctx, images, texts} = drawingContext();
  drawResultBrand(ctx, null);
  assert.deepEqual(images, []);
  assert.equal(texts[0].text, BRAND_NAME);
  assert.equal(texts[0].x, 70);
  assert.equal(texts[0].y, 70);
});

test('actual export image loader resolves success, failure and timeout safely', async () => {
  const start = app.indexOf('async function loadExportImage(');
  const end = app.indexOf("$('#download-result').addEventListener", start);
  assert.ok(start >= 0 && end > start);
  for (const outcome of ['success', 'failure', 'timeout']) {
    const created = [];
    const cleared = [];
    let onTimeout;
    const context = vm.createContext({
      Image:class { constructor() { created.push(this); } },
      setTimeout(callback, delay) { assert.equal(delay, 5000); onTimeout = callback; return 1; },
      clearTimeout(id) { cleared.push(id); },
    });
    vm.runInContext(app.slice(start, end), context);
    const loaded = context.loadExportImage('../assets/favicon.png');
    assert.equal(created[0].src, '../assets/favicon.png');
    if (outcome === 'success') created[0].onload();
    else if (outcome === 'failure') created[0].onerror();
    else onTimeout();
    assert.equal(await loaded, outcome === 'success' ? created[0] : null);
    assert.deepEqual(cleared, outcome === 'timeout' ? [] : [1]);
  }
});

test('actual PNG handler includes the background, portraits and emblem, with safe missing-image fallback', async () => {
  const start = app.indexOf("$('#download-result').addEventListener");
  assert.ok(start >= 0);
  for (const showImages of [true, false]) for (const logoAvailable of [true, false]) for (const backgroundAvailable of [true, false]) {
    const {ctx, images, texts} = drawingContext();
    const logo = {naturalWidth:512, naturalHeight:512};
    const portrait = {naturalWidth:279, naturalHeight:290};
    const background = {naturalWidth:694, naturalHeight:462};
    const character = {name:'博丽灵梦', title:'乐园的巫女', image:'./assets/characters/001.webp'};
    const loaded = [];
    const calls = [];
    const button = {disabled:false};
    const canvas = {width:0, height:0, getContext:() => ctx, toBlob(callback, type) { calls.push(type); callback({type}); }};
    let onClick;
    const context = vm.createContext({
      $:selector => {
        assert.equal(selector, '#download-result');
        return Object.assign(button, {addEventListener(event, callback) { assert.equal(event, 'click'); onClick = callback; }});
      },
      currentResult:{rankings:[{rank:1, ids:['001']}], total:173, showImages},
      flattenRankings:() => [{rank:1, character}],
      location:{href:'http://127.0.0.1:4174/favorite/'},
      BRAND_LOGO_URL, RESULT_BACKGROUND_URL, prepareResultPoster, drawResultPoster,
      loadResultFonts:async () => true,
      loadExportImage:async src => { loaded.push(src); return src === BRAND_LOGO_URL ? (logoAvailable ? logo : null) : src === RESULT_BACKGROUND_URL ? (backgroundAvailable ? background : null) : portrait; },
      prepareResultFooter:() => ({height:755}),
      drawResultFooter() { calls.push('footer'); },
      document:{
        body:{append() {}},
        createElement(tag) {
          if (tag === 'canvas') return canvas;
          assert.equal(tag, 'a');
          return {click() { calls.push('download'); }, remove() {}};
        },
      },
      URL:{createObjectURL:() => 'blob:export-test', revokeObjectURL() {}},
      setTimeout() {}, toast:message => calls.push(message),
    });
    vm.runInContext(app.slice(start), context);
    await onClick();
    assert.deepEqual(loaded, [BRAND_LOGO_URL, RESULT_BACKGROUND_URL, character.image]);
    assert.equal(images.length, Number(backgroundAvailable) * 2 + Number(logoAvailable) + 1);
    if (logoAvailable) assert.equal(images[Number(backgroundAvailable) * 2][0], logo);
    assert.equal(texts.find(item => item.text === BRAND_NAME).x, logoAvailable ? 128 : 70);
    assert.equal(texts.find(item => item.text === '我的东方本命角色榜单').y, 161);
    assert.deepEqual(calls.slice(0, 3), ['footer', 'image/png', 'download']);
    assert.ok(calls.at(-1).includes('结果图已生成'));
    assert.equal(button.disabled, false);
  }
});


test('active page, main-site title and both PNG brand labels use the new site name', async () => {
  assert.equal(BRAND_NAME, '云梦都 HifuuCraft');
  const html = await readFile(new URL('../src/favorite/index.html', import.meta.url), 'utf8');
  const main = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  const footer = await readFile(new URL('../src/favorite/export-footer.js', import.meta.url), 'utf8');
  assert.match(html, /<title>东方本命角色测试 · 云梦都 HifuuCraft<\/title>/);
  assert.match(html, /aria-label="云梦都 HifuuCraft首页"/);
  assert.match(html, /class="brand-name-cn">云梦都<\/span> <span class="brand-name-latin">HifuuCraft<\/span>/);
  assert.match(html, /class="footer-brand">✧ 云梦都 HifuuCraft<\/span>/);
  assert.match(main, /<title>🐝敬请期待 - 云梦都 HifuuCraft<\/title>/);
  assert.doesNotMatch(html + footer + main, /秘封俱乐部/);
  assert.match(footer, /\[20, BRAND_NAME\]/);
  assert.doesNotMatch(footer, /非官方同人测试|图像：/);
  const { characterById } = await import('../src/favorite/model.js');
  assert.equal(characterById.get('129')?.name, '鬼人正邪');
  const { characters } = await import('../src/favorite/characters.js');
  assert.equal(characters.find(character => character.name === '宇佐见堇子').title, '秘封俱乐部初代会长');
});
