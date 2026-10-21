import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SANS_FONT, SERIF_FONT, loadResultFonts } from '../src/favorite/typography.js';
import { characters } from '../src/favorite/characters.js';
import { prepareResultPoster, drawResultPoster } from '../src/favorite/export-poster.js';
import { prepareResultFooter, drawResultFooter } from '../src/favorite/export-footer.js';
import { recordingCanvas } from './helpers/canvas.mjs';
const html = await readFile(new URL('../src/favorite/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/favorite/style.css', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/favorite/app.js', import.meta.url), 'utf8');

test('approved elegant fonts load from local assets with preloads and system fallbacks', () => {
  for (const [id, family] of [['noto-serif-sc', 'Favorite Noto Serif'], ['noto-sans-sc', 'Favorite Noto Sans']]) {
    assert.ok(css.includes('font-family: "' + family + '"'));
    assert.ok(css.includes('src: url("./assets/fonts/' + id + '.woff2")'));
    assert.ok(html.includes('as="font" type="font/woff2" href="./assets/fonts/' + id + '.woff2" crossorigin'));
  }
  assert.match(css, /font-display: swap/);
  assert.match(css, /--serif: "Favorite Noto Serif"/);
  assert.match(css, /--sans: "Favorite Noto Sans"/);
  assert.match(css, /\.work-info small\{font-size:11px/);
  assert.match(css, /\.works-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(html + css, /localhost|127\.0\.0\.1|fonts\.googleapis|fonts\.gstatic|\/type\/serif|font-preview-bar/);
});

test('shipped font subset manifest matches the binaries and covers current page and character text', async () => {
  const manifest = JSON.parse(await readFile(new URL('../src/favorite/assets/fonts/subset-manifest.json', import.meta.url), 'utf8'));
  const data = await readFile(new URL('../src/favorite/characters.js', import.meta.url), 'utf8');
  const poster = await readFile(new URL('../src/favorite/export-poster.js', import.meta.url), 'utf8');
  const footer = await readFile(new URL('../src/favorite/export-footer.js', import.meta.url), 'utf8');
  const required = [...new Set([...html + css + app + data + poster + footer].filter(ch => /[\u4e00-\u9fff\u3040-\u30ff]/.test(ch)))];
  for (const [id, entry] of Object.entries(manifest.fonts)) {
    const bytes = await readFile(new URL('../src/favorite/assets/fonts/' + id + '.woff2', import.meta.url));
    assert.equal(bytes.subarray(0,4).toString(), 'wOF2');
    assert.equal(bytes.length, entry.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    const points = new Set(entry.codepoints);
    assert.deepEqual(required.filter(ch => !points.has(ch.codePointAt(0))), [], id + ' glyph coverage');
    assert.match(await readFile(new URL('../src/favorite/assets/fonts/OFL-' + id + '.txt', import.meta.url), 'utf8'), /SIL OPEN FONT LICENSE/);
  }
});

test('PNG font preparation waits for both weights of both fonts', async () => {
  const calls = [];
  assert.equal(await loadResultFonts({load:async (font, text) => {calls.push([font,text]); return [{status:'loaded'}];}}), true);
  assert.equal(calls.length,4);
  assert.deepEqual(calls.map(call=>call[0]), [
    '400 17px "Favorite Noto Sans"', '600 24px "Favorite Noto Sans"',
    '400 22px "Favorite Noto Serif"', '600 50px "Favorite Noto Serif"',
  ]);
});

test('missing, failing, empty or stalled font APIs fall back without blocking export', async () => {
  for (const fonts of [null, {}, {load:async()=>[]}, {load:async()=>{throw new Error('font unavailable');}}, {load:()=>{throw new Error('API blocked');}}]) {
    assert.equal(await loadResultFonts(fonts,5),false);
  }
  assert.equal(await loadResultFonts({load:()=>new Promise(()=>{})},5),false);
});

test('poster, brand and footer draw text with the same local families as the page', () => {
  const allRows = characters.slice(0,3).map((character,index)=>({character,rank:index+1}));
  const layout = prepareResultPoster(allRows);
  const {ctx,texts} = recordingCanvas();
  const footer = prepareResultFooter(ctx,layout.width,layout.footerTop,'https://hifuu.club/favorite/');
  drawResultPoster(ctx,layout,{total:3,allRows,images:[null,null,null],logo:null,height:footer.height});
  drawResultFooter(ctx,footer,{truncated:false});
  assert.ok(texts.some(item=>item.font.endsWith(SERIF_FONT)));
  assert.ok(texts.some(item=>item.font.endsWith(SANS_FONT)));
  assert.ok(texts.filter(item=>/[\u4e00-\u9fff]/.test(item.text)).every(item=>item.font.endsWith(SANS_FONT) || item.font.endsWith(SERIF_FONT)));
});

test('PNG handler does not measure or draw until fonts settle and still exports on fallback', async () => {
  let releaseFonts;
  const fonts = new Promise(resolve=>{releaseFonts=resolve;});
  let click;
  const button = {disabled:false,addEventListener(event,handler){click=handler;}};
  const calls=[];
  const ctx={};
  const canvas={getContext:()=>ctx,toBlob(callback){callback({type:'image/png'});}};
  vm.runInNewContext(app.slice(app.indexOf("$('#download-result').addEventListener")),{
    $:()=>button,currentResult:{rankings:[],total:3},flattenRankings:()=>[],location:{href:'https://hifuu.club/favorite/'},
    BRAND_LOGO_URL:'logo',RESULT_BACKGROUND_URL:'background',loadExportImage:async()=>null,loadResultFonts:()=>fonts,
    document:{body:{append(){}},createElement(tag){if(tag==='canvas'){calls.push('canvas');return canvas;}return {click(){calls.push('download');},remove(){}};}},
    prepareResultPoster:()=>({width:1080,footerTop:500}),prepareResultFooter:()=>{calls.push('measure');return {height:750};},
    drawResultPoster:()=>calls.push('poster'),drawResultFooter:()=>calls.push('footer'),
    URL:{createObjectURL:()=> 'blob:local',revokeObjectURL(){}},setTimeout(){},toast:()=>calls.push('toast'),
  });
  const pending=click();
  await Promise.resolve();
  assert.equal(button.disabled,true);
  assert.deepEqual(calls,[]);
  releaseFonts(false);
  await pending;
  assert.deepEqual(calls,['canvas','measure','poster','footer','download','toast']);
  assert.equal(button.disabled,false);
});
