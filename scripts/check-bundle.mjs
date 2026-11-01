// Orçamento de tamanho (gzip) após `npm run build`. Falha se a LP ou o app engordarem demais.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
const dist = new URL('../apps/web/dist/', import.meta.url).pathname;
const gz = (f) => gzipSync(readFileSync(join(dist, f))).length;
const assets = readdirSync(join(dist, 'assets'));
const size = (re) => assets.filter((f) => re.test(f)).reduce((n, f) => n + gz('assets/' + f), 0);
const rows = [
  ['LP (HTML + JS + CSS)', gz('index.html') + size(/^lp-.*\.(js|css)$/), 25_000],
  ['App (JS)', size(/^app-.*\.js$/), 52_000],
  ['App (CSS)', size(/^app-.*\.css$/), 8_000]
];
let bad = 0;
for (const [name, n, max] of rows) { const ok = n <= max; if (!ok) bad++; console.log(`${ok ? 'OK  ' : 'FALHA'} ${name}: ${(n / 1024).toFixed(1)} KB gzip (limite ${(max / 1024).toFixed(0)} KB)`); }
process.exit(bad ? 1 : 0);
