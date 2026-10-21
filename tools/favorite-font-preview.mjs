import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(root, 'src');
const previewRoot = path.join(root, 'tools/favorite-font-preview');
export const fontVariants = [
  { id: 'baseline', label: '原版对照', detail: '现有宋体标题 + 系统黑体', serif: '"Noto Serif SC","Source Han Serif SC","Songti SC","SimSun",serif', sans: '"Microsoft YaHei","PingFang SC",system-ui,sans-serif' },
  { id: 'serif', label: '雅致均衡', detail: '思源宋体 + 思源黑体', serif: '"Favorite Noto Serif",serif', sans: '"Favorite Noto Sans",sans-serif' },
  { id: 'wenkai', label: '温柔手记', detail: '霞鹜文楷 + 思源黑体', serif: '"Favorite WenKai",serif', sans: '"Favorite Noto Sans",sans-serif' },
  { id: 'sans', label: '清爽现代', detail: '思源黑体标题与正文', serif: '"Favorite Noto Sans",sans-serif', sans: '"Favorite Noto Sans",sans-serif' },
];
function replaceRequired(source, search, replacement) {
  if (!source.includes(search)) throw new Error('Font preview hook missing: ' + search);
  return source.replace(search, replacement);
}
export function fontPreviewHtml(source, variant, readable = true) {
  let html = replaceRequired(source, '<body>', '<body data-font-preview="' + variant.id + '">');
  html = replaceRequired(html, '<title>东方本命角色测试 · 云梦都 HifuuCraft</title>', '<title>' + variant.label + ' · 字体试读</title>');
  html = replaceRequired(html, '<link rel="stylesheet" href="./style.css">', '<link rel="stylesheet" href="./style.css">\n<link rel="stylesheet" href="/fonts/fonts.css">\n<link rel="stylesheet" href="./font-preview.css">');
  const bar = '<div class="font-preview-bar"><a href="/fonts/">← 字体对比</a><nav aria-label="字体方案">' + fontVariants.map(item => '<a href="/type/' + item.id + '/favorite/"' + (item.id === variant.id ? ' aria-current="page"' : '') + '>' + item.label + '</a>').join('') + '</nav><span>仅试读 · 不修改原版进度</span></div>';
  html = replaceRequired(html, '<header class="site-header">', bar + '\n<header class="site-header">').replaceAll('href="../"', 'href="/index.html"');
  if (!readable) {
    html = html.replace('href="./font-preview.css"', 'href="./font-preview.css?readable=0"');
    html = html.replace(/href="(\/type\/[^"]+\/favorite\/)"/g, 'href="$1?readable=0"');
  }
  return html;
}
export function fontPreviewApp(source, variant) {
  let app = replaceRequired(source, '{ STORAGE_KEY,', '{ STORAGE_KEY as BASE_STORAGE_KEY,');
  return replaceRequired(app, 'const $ = selector', "const STORAGE_KEY = BASE_STORAGE_KEY + '.font-preview." + variant.id + "';\n\nconst $ = selector");
}
export function fontPreviewCss(variant, readable = true) {
  return ':root{--serif:' + variant.serif + ';--sans:' + variant.sans + ';}\n' +
    (variant.id === 'baseline' ? '' : '.hero h1{letter-spacing:' + (variant.id === 'wenkai' ? '.6' : variant.id === 'sans' ? '.4' : '1') + 'px;}\n' + (variant.id === 'wenkai' ? '.hero h1,.battle-heading h1,.winner-copy h2,.result-heading h1{font-weight:400;}\n' : '')) +
    (readable && variant.id !== 'baseline' ? readableCss : '') +
    '.font-preview-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px 24px;padding:12px 24px;background:#eee9f3;color:#594966;font:12px/1.7 "Favorite Noto Sans",sans-serif;}.font-preview-bar nav{display:flex;gap:16px;flex-wrap:wrap;}.font-preview-bar a{padding:3px 0;}.font-preview-bar [aria-current]{font-weight:600;text-decoration:underline;text-underline-offset:5px;}.font-preview-bar>span{margin-left:auto;color:#73647d;}\n';
}
const readableCss = `
.hero-description{font-size:14px;color:#746a7b;}
.hero-note,.journey{font-size:12px;}
.field-heading h3,.ranking-field legend{font-size:14px;}
.work-heading-actions>span,.text-button,.preset-heading>span,.preset-description,.group-selection,.work-tabs button{font-size:12px;color:#74627f;}
.preset-heading small,.recommend-label{font-size:11px;color:#74627f;}
.preset-chip{font-size:12px;color:#74627f;}
.work-option{font-size:13px;line-height:1.55;}
.work-info small{font-size:11px;letter-spacing:.3px;color:#776881;}
.mode-top{font-size:13px;}
.mode-option small{font-size:11px;color:#776881;}
.roster-details summary,.roster-description{font-size:12px;color:#74627f;}
.invitation-stats,.comparison-estimate,.start-hint{font-size:12px;}
.invitation-stats span,.comparison-estimate{color:#d2c4dd;}
.work-info>span{white-space:normal;overflow-wrap:anywhere;}
@media(max-width:740px){.works-grid{grid-template-columns:repeat(2,minmax(0,1fr));}.work-option{font-size:12px;padding:9px 8px;min-height:56px;}.preset-chip{min-height:40px;}.mode-top{font-size:12px;white-space:normal;flex-wrap:wrap;}.mode-option small{font-size:11px;}.recommend-label{margin-left:0;}.work-tabs button{font-size:11px;}.mode-option{padding:12px 8px;}.work-search input{font-size:16px;}}
@media(max-width:375px){.mode-options{grid-template-columns:1fr;}.mode-option{display:flex;justify-content:space-between;gap:8px;align-items:center;}.mode-option small{margin-top:0;}.mode-top{font-size:12px;}.hero-note{font-size:11px;}.journey{font-size:10px;}}
`;
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8', '.json':'application/json', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.md':'text/plain; charset=utf-8' };
function inside(base, filename) {
  const relative = path.relative(base, filename);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
export function createFontPreviewServer() {
  return http.createServer(async (request, response) => {
    try {
      if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405, { Allow:'GET, HEAD' }); response.end(); return; }
      const url = new URL(request.url, 'http://localhost');
      const segments = decodeURIComponent(url.pathname).split('/').filter(Boolean);
      let content;
      let type = types['.html'];
      const variant = segments[0] === 'type' && fontVariants.find(item => item.id === segments[1]);
      if (!segments.length) { response.writeHead(302,{Location:'/fonts/'}); response.end(); return; }
      if (segments[0] === 'type' && !variant) { response.writeHead(404); response.end('Unknown font preview'); return; }
      const relative = variant ? segments.slice(2).join('/') : segments[0] === 'fonts' ? segments.slice(1).join('/') : segments.join('/');
      if (variant && relative === 'favorite/font-preview.css') {
        content = fontPreviewCss(variant, url.searchParams.get('readable') !== '0'); type = types['.css'];
      } else if (variant && relative === 'favorite/app.js') {
        content = fontPreviewApp(await readFile(path.join(sourceRoot,'favorite/app.js'),'utf8'),variant); type = types['.js'];
      } else {
        const base = segments[0] === 'fonts' ? previewRoot : sourceRoot;
        let filename = path.resolve(base, relative || '.');
        if (!inside(base, filename)) { response.writeHead(403); response.end(); return; }
        if ((await stat(filename)).isDirectory()) {
          if (!url.pathname.endsWith('/')) { response.writeHead(302,{Location:url.pathname + '/' + url.search}); response.end(); return; }
          filename = path.join(filename,'index.html');
        }
        content = await readFile(filename);
        type = types[path.extname(filename)] || 'application/octet-stream';
        if (variant && filename === path.join(sourceRoot,'favorite/index.html')) content = fontPreviewHtml(content.toString('utf8'),variant,url.searchParams.get('readable') !== '0');
      }
      response.writeHead(200, { 'Content-Type':type, 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      const missing = ['ENOENT','ENOTDIR','URIError'].includes(error.code || error.name);
      response.writeHead(missing ? 404 : 500, { 'Content-Type':'text/plain; charset=utf-8' });
      response.end(missing ? 'Not found' : 'Font preview unavailable');
      if (!missing) console.error(error);
    }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || 4186);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
  createFontPreviewServer().listen(port,'127.0.0.1',()=>console.log('Font previews: http://127.0.0.1:' + port + '/fonts/'));
}
