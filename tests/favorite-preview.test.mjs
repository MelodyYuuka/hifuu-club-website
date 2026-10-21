import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import CleanCSS from 'clean-css';
import { variants, renderPreview, previewApp, createPreviewServer } from '../tools/favorite-preview.mjs';

const html = await readFile(new URL('../src/favorite/index.html',import.meta.url),'utf8');
const app = await readFile(new URL('../src/favorite/app.js',import.meta.url),'utf8');
const originalIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
for (const variant of variants) {
  test(variant.id + ' preview preserves every app hook and only changes presentation',()=>{
    const output = renderPreview(html,variant);
    const ids = [...output.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
    assert.equal(new Set(ids).size,ids.length,'no duplicate IDs');
    for (const id of originalIds) assert.ok(ids.includes(id),'preserves #' + id);
    assert.ok(output.includes('data-preview="' + variant.id + '"'));
    assert.ok(output.includes('preview-summary'));
    assert.ok(output.includes('开始比较'));
    assert.ok(!output.includes('class="how-it-works"'));
    assert.ok(!output.includes('class="hero-art"'));
    assert.ok(!output.includes('href="../"'),'home links do not point at preview root');
    for (const item of variants) assert.ok(output.includes('/' + item.id + '/favorite/'));
  });
  test(variant.id + ' preview uses isolated progress while keeping sorter and export modules',()=>{
    const output = previewApp(app,variant);
    assert.ok(output.includes("BASE_STORAGE_KEY + '.preview." + variant.id + "'"));
    assert.ok(output.includes('localStorage.getItem(STORAGE_KEY)'));
    assert.ok(output.includes('localStorage.setItem(STORAGE_KEY'));
    assert.ok(output.includes("from './sorter.js'"));
    assert.ok(output.includes("from './export-poster.js'"));
    assert.ok(output.includes("from './export-background.js'"));
    assert.ok(!output.includes('每一次偏爱，都有了答案'));
    // Imports are unchanged apart from a local alias; the rest remains valid JS.
    new vm.Script(output.replace(/^import .*;\s*$/gm,''));
  });
  test(variant.id + ' CSS parses and retains responsive and reduced-motion rules',async()=>{
    const shared = await readFile(new URL('../tools/favorite-preview/shared.css',import.meta.url),'utf8');
    const theme = await readFile(new URL('../tools/favorite-preview/' + variant.id + '.css',import.meta.url),'utf8');
    const result = new CleanCSS().minify(shared + '\n' + theme);
    assert.deepEqual(result.errors,[]);
    assert.ok(result.styles.length>1000);
    assert.ok(shared.includes('@media(max-width:740px)'));
    assert.ok(shared.includes('prefers-reduced-motion'));
  });
}

test('preview server shares existing resources, preserves original routes, and rejects unsafe requests',async()=>{
  const server = createPreviewServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const original = await fetch(base + '/favorite/');
    assert.equal(original.status,200);
    assert.equal(await original.text(),html);
    assert.equal(await (await fetch(base + '/favorite/app.js')).text(),app);
    assert.ok((await (await fetch(base + '/')).text()).includes('三版'));
    for (const variant of variants) {
      const prefix = '/' + variant.id;
      const page = await fetch(base + prefix + '/favorite/');
      assert.equal(page.status,200);
      assert.equal(await page.text(),renderPreview(html,variant));
      assert.equal((await fetch(base + prefix + '/favorite',{redirect:'manual'})).headers.get('location'),prefix + '/favorite/');
      assert.equal((await fetch(base + prefix + '/',{redirect:'manual'})).headers.get('location'),prefix + '/favorite/');
      for (const resource of ['/favorite/preview.css','/favorite/style.css','/favorite/app.js','/favorite/model.js','/favorite/sorter.js','/favorite/vendor/qrcode-generator.js','/favorite/assets/characters/080.webp','/favorite/assets/backgrounds/hakugyokurou.jpg','/assets/favicon.png','/favorite/CREDITS.md']) {
        const response = await fetch(base + prefix + resource);
        assert.equal(response.status,200,prefix + resource);
        assert.equal(response.headers.get('x-content-type-options'),'nosniff');
      }
      assert.equal(await (await fetch(base + prefix + '/favorite/export-poster.js')).text(),await readFile(new URL('../src/favorite/export-poster.js',import.meta.url),'utf8'));
    }
    assert.equal((await fetch(base + '/tool/favorite/',{method:'HEAD'})).status,200);
    assert.equal(await (await fetch(base + '/tool/favorite/',{method:'HEAD'})).text(),'');
    assert.equal((await fetch(base + '/tool/favorite/',{method:'POST'})).status,405);
    assert.equal((await fetch(base + '/tool/missing.js')).status,404);
    assert.equal((await fetch(base + '/tool/%2e%2e%5cpackage.json')).status,403);
    assert.equal((await fetch(base + '/tool/%E0%A4%A')).status,404);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
