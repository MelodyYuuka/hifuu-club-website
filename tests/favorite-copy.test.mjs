import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { access, readFile } from 'node:fs/promises';
import { resultText, encodeResult, decodeResult } from '../src/favorite/model.js';
import { resultPageUrl } from '../src/favorite/export-footer.js';

const html = await readFile(new URL('../src/favorite/index.html',import.meta.url),'utf8');
const app = await readFile(new URL('../src/favorite/app.js',import.meta.url),'utf8');
const presets = await readFile(new URL('../src/favorite/presets.js',import.meta.url),'utf8');
const css = await readFile(new URL('../src/favorite/style.css',import.meta.url),'utf8');

test('normal UI copy omits implementation explanations without removing useful controls and credits', () => {
  for (const text of [
    '始终列出全部角色','可直接勾选作品范围外的角色','进度自动保存在当前浏览器',
    '无需登录','不会上传你的选择','重复角色自动合并','同角色自动去重',
    '每项显示本站收录人数','按每次 3 秒估算','手动修改作品或角色后转为自定义',
    '逐轮取出胜者的比较算法','分享链接只包含角色排名','进度只留在你的浏览器',
    '叠加其他预设时不排除其他组合的角色',
  ]) assert.ok(!(html+app+presets).includes(text),text);
  for (const id of ['roster-summary','character-search','select-visible','exclude-visible','work-presets','start-button','save-status']) {
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  for (const text of ['可多选 · 叠加范围','结果图展示前 20 位角色','并列名次','图像：dairi / はるか、ZUN','东方二次创作指南']) {
    assert.ok(html.includes(text),text);
  }
  for (const obsolete of ['local-note','work-group-note','selection-note']) {
    assert.ok(!(html+app+css).includes(obsolete),obsolete);
  }
  assert.match(app,/'已选预设：'/);
});

test('save status keeps normal setup quiet, warns on failure and clears the warning after recovery', () => {
  const status = {textContent:''};
  const warning = {textContent:'',hidden:true};
  const notices = [];
  let shouldFail = false;
  let writes = 0;
  const context = vm.createContext({
    storageAvailable:true,
    $:selector=>({ '#save-status':status, '#storage-warning':warning }[selector]),
    localStorage:{ setItem(){ if(shouldFail)throw new Error('Storage unavailable'); writes++; } },
    STORAGE_KEY:'test',settings:{},sorter:null,startedAt:null,
    serializeSession:()=>'{"saved":true}',toast:message=>notices.push(message),
  });
  const start = app.indexOf('function renderSaveStatus()');
  const end = app.indexOf('\nfunction setView',start);
  assert.ok(start>=0 && end>start);
  vm.runInContext(app.slice(start,end),context);
  vm.runInContext('save()',context);
  assert.equal(writes,1);
  assert.equal(status.textContent,'已保存');
  assert.equal(warning.hidden,true);
  assert.equal(warning.textContent,'');
  shouldFail=true;
  vm.runInContext('save()',context);
  assert.equal(context.storageAvailable,false);
  assert.equal(warning.hidden,false);
  assert.match(warning.textContent,/请勿刷新或关闭页面/);
  assert.equal(notices.length,1);
  vm.runInContext('save()',context);
  assert.equal(notices.length,1);
  shouldFail=false;
  vm.runInContext('save()',context);
  assert.equal(context.storageAvailable,true);
  assert.equal(writes,2);
  assert.equal(warning.hidden,true);
  assert.equal(warning.textContent,'');
  assert.match(html,/<p id="storage-warning"[^>]*hidden><\/p>/);
});


test('about dialog omits requested attribution sentence and document links but retains source records', async () => {
  assert.doesNotMatch(html,/部分中文角色资料改编自 uzkk\/favorite|遵循 MIT 协议|href="\.\/WORKS\.md"|href="\.\/CREDITS\.md"/);
  assert.match(html,/二色幽紫蝶本命测试/);
  assert.match(html,/dairi \/ はるか/);
  const credits=await readFile(new URL('../src/favorite/CREDITS.md',import.meta.url),'utf8');
  assert.match(credits,/YuukaBot-v6/);
  assert.match(credits,/characters_bot\.json/);
  assert.match(credits,/CC BY-NC-SA 3\.0/);
  const data=await readFile(new URL('../src/favorite/characters.js',import.meta.url),'utf8');
  assert.doesNotMatch(credits + data,/Shigma|github\.com\/uzkk\/favorite|metadata adapted from uzkk/);
  assert.doesNotMatch(credits,/Permission is hereby granted|## 角色资料 MIT 许可/);
  assert.doesNotMatch(data,/Permission is hereby granted|THE SOFTWARE IS PROVIDED "AS IS"/);
  await assert.rejects(access(new URL('../src/favorite/THIRD_PARTY_LICENSES.txt',import.meta.url)),{code:'ENOENT'});
});


test('header GitHub icon links to this repository and requested catalog qualifiers are removed',()=>{
  assert.ok(html.includes('href="https://github.com/MelodyYuuka/hifuu-club-website"'));
  assert.match(html,/<a class="github-link"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*aria-label="[^"]+"/);
  assert.match(html,/<a class="github-link"[\s\S]*?<svg[^>]*aria-hidden="true"/);
  assert.doesNotMatch(html+app+presets,/名单并非东方全角色全集|，含 EX/);
  assert.match(css,/\.github-link svg[^}]*fill:currentColor; stroke:none/);
});


test('copied ranking matches the requested title, complete list and test-page link', () => {
  const ids = ['035', '036', '129', '013', '005', '002', '001', '014', '003', '012'];
  const rankings = ids.map((id, index) => ({ rank:index + 1, ids:[id] }));
  assert.equal(resultText(rankings, 'https://hifuu.club/favorite/'), [
    '我的东方本命角色榜单',
    '1. 射命丸文',
    '2. 梅蒂欣·梅兰可莉',
    '3. 鬼人正邪',
    '4. 橙',
    '5. 琪露诺',
    '6. 雾雨魔理沙',
    '7. 博丽灵梦',
    '8. 爱丽丝·玛格特洛依德',
    '9. 露米娅',
    '10. 蕾蒂·霍瓦特洛克',
    '',
    'https://hifuu.club/favorite/',
  ].join('\n'));
});

test('actual copy button appends hifuu.club without local origins, tracking or a shared-result hash', () => {
  const handler = app.split('\n').find(line => line.startsWith("$('#copy-result').addEventListener"));
  assert.ok(handler);
  const rankings = [{rank:1, ids:['079', '080']}, {rank:3, ids:['001']}];
  for (const [href, pageUrl] of [
    ['http://127.0.0.1:4174/favorite/#result=shared', 'https://hifuu.club/favorite/'],
    ['https://example.com/club/favorite/index.html?utm_source=share#result=shared', 'https://hifuu.club/favorite/'],
  ]) {
    let onClick;
    let copied;
    const context = vm.createContext({
      $:selector => {
        assert.equal(selector, '#copy-result');
        return { addEventListener(event, callback) { assert.equal(event, 'click'); onClick = callback; } };
      },
      currentResult:{rankings, total:173, showImages:false},
      location:{href}, resultText, resultPageUrl,
      copyText:text => { copied = text; },
    });
    vm.runInContext(handler, context);
    onClick();
    assert.equal(copied, resultText(rankings, pageUrl));
    assert.match(copied, /（并列）/);
    assert.doesNotMatch(copied, /127\.0\.0\.1|example\.com|#result=|utm_source|从 173 位角色中选出|秘封俱乐部/);
  }
});

test('favorite footer retains the main-site links, local icons and source credits', async () => {
  const main = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  const mainFooter = main.match(/<footer class="custom-footer">([\s\S]*?)<\/footer>/)?.[1];
  const footer = html.match(/<footer class="site-footer">([\s\S]*?)<\/footer>/)?.[1];
  assert.ok(mainFooter && footer);
  const nav = footer.match(/<nav class="footer-links" aria-label="相关链接">([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav);
  const links = [...nav.matchAll(/<a href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g)];
  assert.deepEqual(links.map(link => link[1]), [...mainFooter.matchAll(/<a href="([^"]+)"/g)].map(link => link[1]));
  assert.deepEqual(links.map(link => link[3].match(/<span>([^<]+)<\/span>/)?.[1]), ['GitHub', '幽幽子', 'QQ频道', 'MC服务器']);
  for (const [, , attributes, content] of links) {
    assert.match(attributes, /target="_blank"/);
    assert.match(attributes, /rel="noopener noreferrer"/);
    assert.match(content, /alt=""/);
    const icon = content.match(/src="([^"]+)"/)?.[1];
    assert.ok(icon?.startsWith('../assets/'));
    assert.ok((await readFile(new URL('../src/favorite/' + icon, import.meta.url))).length > 0);
  }
  assert.match(footer, /东方 Project © 上海アリス幻樂団/);
  assert.match(footer, /关于测试与素材/);
  assert.match(css, /\.site-footer \.footer-links\s*\{[^}]*flex-wrap: wrap/);
});


test('shared result links always use hifuu.club and preserve all ranks and ties with portraits always enabled', () => {
  const start = app.indexOf("$('#share-result').addEventListener");
  const end = app.indexOf("\n$$('[data-open-about]')", start);
  assert.ok(start >= 0 && end > start);
  const handler = app.slice(start, end);
  const rankings = [{rank:1, ids:['079', '080']}, {rank:3, ids:['001']}];
  for (const href of [
    'http://127.0.0.1:4174/favorite/?test=preview#result=old',
    'https://example.com/mirror/favorite/index.html?utm_source=share#result=old',
    'https://hifuu.club/favorite/#result=old',
  ]) for (const showImages of [true, false]) {
    let onClick;
    let copied;
    const currentResult = {rankings, total:173, showImages};
    const context = vm.createContext({
      $:selector => {
        assert.equal(selector, '#share-result');
        return {addEventListener(event, callback) {assert.equal(event, 'click'); onClick = callback;}};
      },
      currentResult, location:{href}, URL, resultPageUrl, encodeResult,
      copyText:text => {copied = text;},
    });
    vm.runInContext(handler, context);
    onClick();
    const url = new URL(copied);
    assert.equal(url.origin + url.pathname, 'https://hifuu.club/favorite/');
    assert.equal(url.search, '');
    assert.equal(url.username, '');
    assert.equal(url.password, '');
    assert.ok(url.hash.startsWith('#result='));
    assert.deepEqual(decodeResult(url.hash.slice(8)), {...currentResult,showImages:true});
  }
});
