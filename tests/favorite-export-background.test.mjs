import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { RESULT_BACKGROUND_URL, drawResultBackground } from '../src/favorite/export-background.js';
import { prepareResultPoster, drawResultPoster } from '../src/favorite/export-poster.js';
import { recordingCanvas } from './helpers/canvas.mjs';

const background = { naturalWidth:694, naturalHeight:462 };

test('the approved Hakugyokurou JPEG is a local deployment-relative asset, not a preview or remote URL', async () => {
  assert.equal(RESULT_BACKGROUND_URL, new URL('../src/favorite/assets/backgrounds/hakugyokurou.jpg', import.meta.url).href);
  const bytes = await readFile(new URL(RESULT_BACKGROUND_URL));
  assert.equal(bytes.subarray(0, 2).toString('hex'), 'ffd8');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '6292387d92aa22e9886a0e0a7b8af883d22b3227f8690fe7c22812fc648041fc');
  const module = await readFile(new URL('../src/favorite/export-background.js', import.meta.url), 'utf8');
  assert.match(module, /new URL\('\.\/assets\/backgrounds\/hakugyokurou\.jpg', import\.meta\.url\)/);
  assert.doesNotMatch(module, /https?:|preview|C:\\|\/favorite\//);
});

test('background preserves landscape proportions for short and long exports and restores canvas alpha', () => {
  for (const height of [1018,1784,2364]) {
    const {ctx, images, imageStates, gradients} = recordingCanvas();
    const original = { alpha:ctx.globalAlpha, fill:ctx.fillStyle };
    drawResultBackground(ctx, background, 1080, height);
    const scenicHeight = 1080 * 462 / 694;
    assert.deepEqual(images, [[background,0,0,1080,scenicHeight], [background,0,height-scenicHeight,1080,scenicHeight]]);
    assert.deepEqual(imageStates.map(item=>item.alpha), [.72,.13]);
    for (const [, , , width, drawnHeight] of images) assert.ok(Math.abs(width/drawnHeight - 694/462) < 1e-12);
    assert.equal(ctx.globalAlpha, original.alpha);
    assert.equal(ctx.fillStyle, original.fill);
    assert.ok(gradients.every(gradient=>gradient.stops.every(([offset])=>offset>=0 && offset<=1)));
  }
});

test('unavailable or invalid background falls back to pale paper without blocking export', () => {
  for (const missing of [null,undefined,{naturalWidth:0,naturalHeight:462},{naturalWidth:694,naturalHeight:0},{naturalWidth:Infinity,naturalHeight:462}]) {
    const {ctx, images, fills} = recordingCanvas();
    drawResultBackground(ctx, missing, 1080, 1784);
    assert.deepEqual(images, []);
    assert.deepEqual(fills[0].args, [0,0,1080,1784]);
    assert.equal(ctx.globalAlpha, 1);
  }
});

test('production poster uses the approved background before unchanged portraits and dark readable header text', async () => {
  const allRows = Array.from({length:30}, (_,i)=>({rank:i+1,character:{name:'角色'+i,title:'称号'}}));
  const layout = prepareResultPoster(allRows);
  const portrait = {naturalWidth:279,naturalHeight:290};
  const {ctx,images,texts} = recordingCanvas();
  drawResultPoster(ctx,layout,{total:173,allRows,background,logo:null,images:layout.rows.map(()=>portrait),height:2364});
  assert.equal(images.length,22);
  assert.equal(images[0][0],background);
  assert.equal(images[1][0],background);
  assert.ok(images.slice(2).every(image=>image[0]===portrait));
  assert.equal(texts.find(item=>item.text==='我的东方本命角色榜单').y,161);
  const renderer = await readFile(new URL('../src/favorite/export-poster.js',import.meta.url),'utf8');
  assert.match(renderer,/drawResultBackground\(ctx, background, WIDTH, height\)/);
  assert.match(renderer,/'我的东方本命角色榜单', 70, 161, 50, '#49334f'/);
  assert.doesNotMatch(renderer, /const sky|959, 59|930, 94|Isolated visual study/);
  const [credits,readme,html] = await Promise.all(['CREDITS.md','README.md','index.html'].map(file=>readFile(new URL('../src/favorite/'+file,import.meta.url),'utf8')));
  assert.match(credits,/C\.Z\.[\s\S]*18696022/);
  assert.match(html,/https:\/\/www\.pixiv\.net\/artworks\/18696022/);
  assert.match(readme,/白玉楼／西行妖樱花庭院背景/);
  assert.doesNotMatch(readme,/深紫色星月页眉|白玉楼背景试排（保留）/);
});
