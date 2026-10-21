import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile, stat } from 'node:fs/promises';
import CleanCSS from 'clean-css';
import { createFontPreviewServer, fontVariants, fontPreviewHtml, fontPreviewApp, fontPreviewCss } from '../tools/favorite-font-preview.mjs';
const html = await readFile(new URL('../src/favorite/index.html',import.meta.url),'utf8');
const app = await readFile(new URL('../src/favorite/app.js',import.meta.url),'utf8');
test('font alternatives preserve original copy, artwork, and functional controls',()=>{
  for(const variant of fontVariants){
    const preview = fontPreviewHtml(html,variant);
    assert.match(preview, /id="hero-title">在幻想乡，/);
    assert.match(preview, /id="setup-title" class="sr-only" tabindex="-1"/);
    for(const id of ['start-button','pause-button','resume-button','undo-button','choose-left','choose-right','reset-settings']) assert.ok(preview.includes('id="'+id+'"'),id);
    assert.ok(preview.includes('./assets/characters/001.webp'));
    assert.ok(preview.includes('font-preview.css'));
    assert.equal((preview.match(/aria-current="page"/g)||[]).length,2);
  }
});
test('font trial sessions use isolated keys and do not change sorting or sharing',()=>{
  for(const variant of fontVariants){
    const transformed = fontPreviewApp(app,variant);
    assert.ok(transformed.includes("BASE_STORAGE_KEY + '.font-preview."+variant.id+"'"));
    assert.equal(transformed.replace('{ STORAGE_KEY as BASE_STORAGE_KEY,','{ STORAGE_KEY,').replace("const STORAGE_KEY = BASE_STORAGE_KEY + '.font-preview."+variant.id+"';\n\n",''),app);
  }
});
test('font styles parse and preserve baseline size while alternatives increase small-text readability',()=>{
  for(const variant of fontVariants){
    const css = fontPreviewCss(variant);
    assert.deepEqual(new CleanCSS().minify(css).errors,[]);
    assert.ok(css.includes('--serif:'+variant.serif));
    assert.equal(css.includes('.work-info small{font-size:11px'),variant.id!=='baseline');
    assert.doesNotMatch(fontPreviewCss(variant,false),/\.work-info small\{font-size:11px/);
  }
});
test('font overview script parses and fonts have local files with source licenses',async()=>{
  new vm.Script(await readFile(new URL('../tools/favorite-font-preview/overview.js',import.meta.url),'utf8'));
  for(const id of ['noto-serif-sc','noto-sans-sc','lxgw-wenkai']){
    const font = new URL('../tools/favorite-font-preview/fonts/'+id+'.woff2',import.meta.url);
    const info = await stat(font);
    assert.ok(info.size > 10000 && info.size < 500000);
    const bytes = await readFile(font);
    assert.equal(bytes.subarray(0,4).toString(),'wOF2');
    const license = await readFile(new URL('../tools/favorite-font-preview/fonts/OFL-'+id+'.txt',import.meta.url),'utf8');
    assert.match(license,/SIL OPEN FONT LICENSE/);
  }
});
test('font server preserves original routes, serves real fonts and handles unsafe requests',async()=>{
  const server = createFontPreviewServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base = 'http://127.0.0.1:'+server.address().port;
  try{
    assert.equal(await(await fetch(base+'/favorite/')).text(),html);
    assert.equal(await(await fetch(base+'/favorite/app.js')).text(),app);
    assert.match(await(await fetch(base+'/fonts/')).text(),/字体方案对比/);
    for(const variant of fontVariants){
      const prefix='/type/'+variant.id;
      assert.equal(await(await fetch(base+prefix+'/favorite/')).text(),fontPreviewHtml(html,variant));
      assert.equal(await(await fetch(base+prefix+'/favorite/app.js')).text(),fontPreviewApp(app,variant));
      for(const resource of ['/favorite/font-preview.css','/favorite/style.css','/favorite/characters.js','/favorite/sorter.js','/favorite/assets/characters/001.webp','/assets/favicon.png']) assert.equal((await fetch(base+prefix+resource)).status,200,resource);
    }
    for(const font of ['noto-serif-sc','noto-sans-sc','lxgw-wenkai']){
      const response=await fetch(base+'/fonts/fonts/'+font+'.woff2');
      assert.equal(response.headers.get('content-type'),'font/woff2');
      assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    }
    assert.equal((await fetch(base+'/fonts',{redirect:'manual'})).headers.get('location'),'/fonts/');
    assert.equal(await(await fetch(base+'/fonts/',{method:'HEAD'})).text(),'');
    assert.equal((await fetch(base+'/fonts/',{method:'POST'})).status,405);
    assert.equal((await fetch(base+'/type/missing/favorite/')).status,404);
    assert.equal((await fetch(base+'/fonts/%2e%2e%5cpackage.json')).status,403);
    assert.equal((await fetch(base+'/type/serif/%2e%2e%5cpackage.json')).status,403);
    assert.equal((await fetch(base+'/fonts/%E0%A4%A')).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('pure font comparison keeps the original text sizes and carries the selection between trials',()=>{
  for(const variant of fontVariants){
    const preview=fontPreviewHtml(html,variant,false);
    assert.ok(preview.includes('href="./font-preview.css?readable=0"'));
    for(const item of fontVariants)assert.ok(preview.includes('href="/type/'+item.id+'/favorite/?readable=0"'));
    assert.ok(preview.includes('href="/index.html"'));
  }
});
