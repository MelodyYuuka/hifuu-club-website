
import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
const args = process.argv.slice(2);
const directory = path.resolve(args.includes('--dist') ? 'dist' : 'src');
const port = Number(args.find(value => /^\d+$/.test(value)) || 4173);
const types = { '.woff2':'font/woff2', '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.json':'application/json', '.md':'text/plain; charset=utf-8', '.txt':'text/plain; charset=utf-8' };
http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    let filename = path.resolve(directory, '.' + decodeURIComponent(url.pathname));
    const relative = path.relative(directory, filename);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { response.writeHead(403); response.end(); return; }
    let info = await stat(filename);
    if (info.isDirectory()) {
      if (!url.pathname.endsWith('/')) { response.writeHead(302, { Location: url.pathname + '/' + url.search }); response.end(); return; }
      filename = path.join(filename, 'index.html');
    }
    const content = await readFile(filename);
    response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch { response.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log('Hifuu Club: http://127.0.0.1:' + port + '/favorite/ (' + directory + ')'));
