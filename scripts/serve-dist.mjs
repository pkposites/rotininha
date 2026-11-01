// Serve apps/web/dist aplicando o arquivo _headers (CSP, cache, noindex...) — o mais perto do Netlify que dá para chegar localmente.
//   node scripts/serve-dist.mjs [porta]    (padrão 4173)
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

const root = resolve(new URL('../apps/web/dist', import.meta.url).pathname);
const port = Number(process.argv[2] ?? 4173);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8' };

const rules = []; // [{ re, headers }]
let cur = null;
for (const line of readFileSync(join(root, '_headers'), 'utf8').split('\n')) {
  if (!line.trim()) continue;
  if (!/^\s/.test(line)) { cur = { re: new RegExp('^' + line.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'), headers: {} }; rules.push(cur); }
  else { const i = line.indexOf(':'); cur.headers[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
}

function locate(urlPath) {
  const p = decodeURIComponent(urlPath.split('?')[0]);
  const tries = [p, p.endsWith('/') ? p + 'index.html' : p + '/index.html', p + '.html'];
  for (const t of tries) { const f = join(root, t); if (f.startsWith(root) && existsSync(f) && statSync(f).isFile()) return f; }
  if (p.startsWith('/app/')) return join(root, 'app/index.html'); // _redirects: /app/* → /app/index.html
  return null;
}

http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const file = locate(req.url);
  const headers = {};
  for (const r of rules) if (r.re.test(p)) Object.assign(headers, r.headers);
  if (!file) { res.writeHead(404, headers); return res.end('não encontrado'); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', ...headers });
  res.end(readFileSync(file));
}).listen(port, () => console.log(`servindo dist com _headers em http://localhost:${port}`));
