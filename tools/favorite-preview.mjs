import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const favoriteRoot = path.join(projectRoot, 'src/favorite');
const stylesRoot = path.join(projectRoot, 'tools/favorite-preview');
export const variants = [
  { id:'tool', label:'A · 工具优先', title:'东方角色排序', subtitle:'选你认识的角色，排出自己的本命。', note:'173 位角色 · 36 个作品条目 · 支持并列与撤销', summary:'准备开始' },
  { id:'notebook', label:'B · 秘封手记', title:'东方角色<br>观测手记', subtitle:'秘封俱乐部的另一份记录：你喜欢哪位东方角色？', note:'观测对象 / 173 位角色　　记录方式 / 两两比较', summary:'本次观测' },
  { id:'courtyard', label:'C · 白玉楼庭院', title:'东方本命榜', subtitle:'从熟悉的角色开始，选出这一次的本命。', note:'角色可自由挑选 · 同样喜欢可以并列', summary:'这次的榜单' },
];
function mustReplace(source, find, replacement) {
  if (!source.includes(find)) throw new Error('Preview hook missing: ' + String(find).slice(0,70));
  return source.replace(find, replacement);
}
export function renderPreview(source, variant) {
  let html = mustReplace(source, '<body>', '<body data-preview="' + variant.id + '">');
  html = mustReplace(html, '<title>东方本命角色测试 · 云梦都 HifuuCraft</title>', '<title>' + variant.label + ' · 东方本命角色测试</title>');
  html = mustReplace(html, '<link rel="stylesheet" href="./style.css">', '<link rel="stylesheet" href="./style.css">\n  <link rel="stylesheet" href="./preview.css">');
  const switcher = '<div class="preview-bar"><span>独立试稿</span><nav aria-label="切换页面试稿">' + variants.map(item => '<a href="/' + item.id + '/favorite/"' + (item.id === variant.id ? ' aria-current="page"' : '') + '>' + item.label + '</a>').join('') + '<a href="/favorite/">原版</a><a href="/">比较说明</a></nav></div>';
  html = mustReplace(html, '<header class="site-header">', switcher + '\n  <header class="site-header">');
  html = html.replace(/<section id="hero"[\s\S]*?<\/section>/, hero(variant));
  html = html.replace(/<div class="invitation-card">[\s\S]*?<p id="start-hint"[^>]*>[\s\S]*?<\/p>\s*<\/div>/, summary(variant));
  html = html.replaceAll('href="../"', 'href="/index.html"');
  html = html.replace(/<div class="little-note">[\s\S]*?<\/div>/, '');
  html = html.replace(/<div class="how-it-works">[\s\S]*?<\/div>\s*<\/section>/, '</section>');
  const copy = [
    ['选择相遇范围','选择角色'], ['听从第一直觉','两两比较'], ['收下本命名单','查看榜单'],
    ['上次的幻想之旅，还在等你。','上次的测试已保存在本机'], ['让这场相遇，从哪里开始？','选择参赛角色'],
    ['36 个作品条目，任选你的世界','36 个作品条目'], ['这次，想找到几位心上人？','排名范围'],
    ['心动前十','前十名'], ['给每一份喜欢排个序','对所有参赛角色排序'],
    ['想再调整一点？<strong>按角色挑选</strong>','<strong>按角色单独选择</strong>'],
    ['这一刻，你更喜欢谁？','你更喜欢谁？'], ['没有正确答案。选择更让你心动的那一位。','选择更喜欢的一位；难分高下就选并列。'],
    ['难分高下，同样喜欢','同样喜欢 · 并列'], ['原来，心之所向是你。','我的东方本命榜'], ['我的心动名单','完整榜单'],
    ['再赴一场相遇','重新设置'], ['这不是一份固定的答案，只是此时此刻的喜欢。<br>下一次相遇，也许又会有新的心动。','排名只代表这次的选择，不是角色人气投票。'],
    ['在日常与非日常的边界，记录一点喜欢。','东方角色排序小工具'],
  ];
  for (const [from,to] of copy) html = html.replaceAll(from,to);
  if (!html.includes('preview-summary')) throw new Error('Summary preview hook missing');
  return html;
}
function hero(variant) {
  let art = '';
  if (variant.id === 'tool') art = '<div class="tool-index" aria-hidden="true"><span>TH</span><small>角色排序 / 01</small></div>';
  if (variant.id === 'notebook') art = '<div class="notebook-art" aria-hidden="true"><div class="notebook-orbit"></div><span class="notebook-moon"></span><img src="./assets/characters/080.webp" alt=""><img src="./assets/characters/079.webp" alt=""><span class="preview-art-caption">宇佐见莲子 / 玛艾露贝莉·赫恩</span></div>';
  if (variant.id === 'courtyard') art = '<div class="courtyard-art" aria-hidden="true"><img src="./assets/characters/019.webp" alt=""><img src="./assets/characters/020.webp" alt=""><span class="preview-art-caption">白玉楼 · 魂魄妖梦 / 西行寺幽幽子</span></div>';
  return '<section id="hero" class="hero preview-hero" aria-labelledby="hero-title"><div class="hero-copy"><p class="preview-kicker">' + (variant.id === 'notebook' ? '秘封俱乐部 / 偏好记录' : variant.id === 'courtyard' ? '云梦都 / 白玉楼试稿' : '云梦都 / 东方 Project') + '</p><h1 id="hero-title">' + variant.title + '</h1><p class="hero-description">' + variant.subtitle + '</p><p class="preview-meta">' + variant.note + '</p></div>' + art + '</section>';
}
function summary(variant) {
  return '<div class="invitation-card preview-summary"><h2>' + variant.summary + '</h2><div class="invited-count"><strong id="character-count">—</strong><span>位参赛角色</span></div><div class="invitation-stats"><div><span>排名范围</span><strong id="ranking-summary">前十名</strong></div><div><span>预计用时</span><strong id="time-estimate">—</strong></div></div><p id="comparison-estimate" class="comparison-estimate">正在计算比较次数…</p><button id="start-button" class="start-button" type="button" disabled>开始比较 <svg><use href="#i-arrow"/></svg></button><p id="start-hint" class="start-hint">每次选择自动保存，可随时暂停。</p><p class="preview-local-note">这版进度单独保存，不会覆盖原版和其他试稿。</p></div>';
}
export function previewApp(source,variant) {
  let app = mustReplace(source, '{ STORAGE_KEY,', '{ STORAGE_KEY as BASE_STORAGE_KEY,');
  app = mustReplace(app, 'const $ = selector', "const STORAGE_KEY = BASE_STORAGE_KEY + '.preview." + variant.id + "';\n\nconst $ = selector");
  const copy = [
    ['请再邀请几位角色加入吧。','请至少选择两位角色。'], ['不必着急，途中可以随时暂停。','每次选择自动保存，可随时暂停。'],
    ['已完成的本命榜单，仍为你妥善保存。','上次已完成的榜单可以继续查看。'], [' 次抉择',' 次比较'],
    ['一份被分享的心动名单 · 从 ','分享的本命榜单 · 从 '], [' 次选择。每一次偏爱，都有了答案。',' 次选择。'],
    ['这份喜欢，不分先后。','并列第一'], ['穿过幻想的边界，<br>原来最想遇见的，一直是你。',''],
    ['长按或全选，复制这份心动','长按或全选，复制榜单'], ['心动榜单已复制，去分享这份喜欢吧。','完整榜单已复制。'],
  ];
  for (const [from,to] of copy) app = app.replaceAll(from,to);
  return app;
}
export function overview() {
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>本命测试 · 三版试稿</title><link rel="icon" href="/assets/favicon.png"><link rel="stylesheet" href="/overview.css"></head><body><main><header><small>云梦都 HifuuCraft / 页面比较</small><h1>少一点宣传页，多一点自己的样子。</h1><p>三版都保留作品筛选、独立选角、并列、撤销、分享和白玉楼结果图。只调整页面布局、样式和操作文案。每版使用独立的本机进度，不影响原版。</p></header><section><article><div class="swatch a">TH / 01</div><h2>A · 工具优先</h2><p>不设宣传首屏。作品、人数和开始按钮直接出现；用更清楚的字号和简单的列表，把排序工具放在第一位。</p><a href="/tool/favorite/">试用工具优先版 →</a></article><article><div class="swatch b">秘封手记</div><h2>B · 秘封手记</h2><p>深蓝灰、米白字和淡青色，像一份观测记录。由莲子与梅莉建立身份，保留工具布局，不再堆通用的装饰。</p><a href="/notebook/favorite/">试用秘封手记版 →</a></article><article><div class="swatch c">白玉楼</div><h2>C · 白玉楼庭院</h2><p>用现有庭院背景与妖梦、幽幽子组成短页头。浅色、较疏朗，更接近结果图，但角色选择仍是主要内容。</p><a href="/courtyard/favorite/">试用白玉楼版 →</a></article></section><footer>原版基线：7abd904 · 正式页面未覆盖 · <a href="/favorite/">查看原版</a><br>白玉楼图片沿用现有素材与来源声明，未增加新的外部素材。试稿不随正式构建发布。</footer></main></body></html>';
}
const types = { '.woff2':'font/woff2', '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.mp3':'audio/mpeg' };
function inside(base,filename) {
  const relative = path.relative(base,filename);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
export function createPreviewServer() {
  return http.createServer(async (request,response) => {
    try {
      if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405,{Allow:'GET, HEAD'}); response.end(); return; }
      const url = new URL(request.url,'http://localhost');
      const segments = decodeURIComponent(url.pathname).split('/').filter(Boolean);
      const variant = variants.find(item => item.id === segments[0]);
      const relativePath = variant ? segments.slice(1).join('/') : segments.join('/');
      let content;
      let type = types['.html'];
      if (!variant && !relativePath) content = overview();
      else if (!variant && relativePath === 'overview.css') { content = await readFile(path.join(stylesRoot,'overview.css')); type = types['.css']; }
      else if (variant && !relativePath) { response.writeHead(302,{Location:'/' + variant.id + '/favorite/' + url.search}); response.end(); return; }
      else if (variant && ['favorite', 'favorite/index.html'].includes(relativePath)) {
        if (!url.pathname.endsWith('/') && !url.pathname.endsWith('.html')) { response.writeHead(302,{Location:url.pathname + '/' + url.search}); response.end(); return; }
        content = renderPreview(await readFile(path.join(favoriteRoot,'index.html'),'utf8'),variant);
      } else if (variant && relativePath === 'favorite/preview.css') {
        type = types['.css'];
        content = await readFile(path.join(stylesRoot,'shared.css'),'utf8') + '\n' + await readFile(path.join(stylesRoot,variant.id + '.css'),'utf8');
      } else if (variant && relativePath === 'favorite/app.js') {
        type = types['.js']; content = previewApp(await readFile(path.join(favoriteRoot,'app.js'),'utf8'),variant);
      } else {
        const base = path.join(projectRoot,'src');
        let filename = path.resolve(base,relativePath);
        if (!inside(base,filename)) { response.writeHead(403); response.end(); return; }
        if ((await stat(filename)).isDirectory()) {
          if (!url.pathname.endsWith('/')) { response.writeHead(302,{Location:url.pathname + '/' + url.search}); response.end(); return; }
          filename = path.join(filename,'index.html');
        }
        content = await readFile(filename); type = types[path.extname(filename)] || 'application/octet-stream';
      }
      response.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      const missing = ['ENOENT','ENOTDIR','URIError'].includes(error.code || error.name);
      response.writeHead(missing ? 404 : 500,{'Content-Type':'text/plain; charset=utf-8'});
      response.end(missing ? 'Not found' : 'Preview unavailable');
      if (!missing) console.error(error);
    }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || 4184);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
  createPreviewServer().listen(port,'127.0.0.1',() => console.log('Favorite previews: http://127.0.0.1:' + port + '/'));
}
