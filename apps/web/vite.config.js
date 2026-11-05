import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve, join } from 'node:path';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';

// Duas "áreas": a LP estática na raiz (rápida, sem service worker) e o app em /app/ (PWA).
// Cabeçalhos de segurança do Netlify. A CSP libera a API (VITE_API_BASE_URL) e, só para o Pixel (opt-in), a Meta.
function headersFile() {
  let api = '';
  try { api = process.env.VITE_API_BASE_URL ? new URL(process.env.VITE_API_BASE_URL).origin : ''; } catch {}
  const csp = [
    "default-src 'self'",
    "script-src 'self' https://connect.facebook.net",
    "style-src 'self'",
    "img-src 'self' data: https://www.facebook.com",
    "font-src 'self'",
    `connect-src 'self' ${api} https://www.facebook.com https://connect.facebook.net`.replace(/\s+/g, ' ').trim(),
    "worker-src 'self'", "manifest-src 'self'", "object-src 'none'",
    "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"
  ].join('; ');
  return `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains

/manifest.webmanifest
  Content-Type: application/manifest+json
  Cache-Control: no-cache

/admin/*
  X-Robots-Tag: noindex, nofollow, noarchive
  Cache-Control: no-store

/sw.js
  Cache-Control: no-cache
  Service-Worker-Allowed: /

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;
}

// Pré-lançamento: LP fora dos buscadores até VITE_LP_INDEX=1.
const robots = () => {
  let outDir = 'dist';
  return {
    name: 'rotininha-robots',
    configResolved: (c) => { outDir = c.build.outDir; },
    transformIndexHtml: (html) => html.replace('__ROBOTS__', process.env.VITE_LP_INDEX === '1' ? 'index, follow' : 'noindex, nofollow'),
    // Só o app (/app/) é instalável: tira o manifesto da LP e das páginas legais (o PWA o injeta em todas).
    closeBundle: { order: 'post', sequential: true, handler() {
      const walk = (d) => readdirSync(d).forEach((f) => {
        const p = join(d, f);
        if (statSync(p).isDirectory()) return f === 'app' ? undefined : walk(p);
        if (!p.endsWith('.html')) return;
        const h = readFileSync(p, 'utf8'), n = h.replace(/<link rel="manifest"[^>]*>\s*/g, (m) => (m.includes('admin.webmanifest') ? m : ''));
        if (n !== h) writeFileSync(p, n);
      });
      walk(resolve(__dirname, outDir));
      writeFileSync(join(resolve(__dirname, outDir), '_headers'), headersFile());
    } }
  };
};

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        lp: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
        termos: resolve(__dirname, 'termos.html'),
        privacidade: resolve(__dirname, 'privacidade.html'),
        reembolso: resolve(__dirname, 'reembolso.html')
      }
    }
  },
  preview: { headers: { 'Service-Worker-Allowed': '/app/' } },
  plugins: [
    preact(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectRegister: false,            // registro manual, só no app
      registerType: 'autoUpdate',
      scope: '/app/',
      injectManifest: { globPatterns: ['app/**/*.html', 'assets/**/*.{js,css,woff2}', 'icons/**/*', 'art/**/*.svg', '*.webmanifest'] },
      includeAssets: ['icons/icon.svg'],
      manifest: {
        id: '/app/',
        name: 'Ninhora',
        short_name: 'Ninhora',
        description: 'Uma ajudinha na sua rotina de mãe.',
        lang: 'pt-BR',
        start_url: '/app/',
        scope: '/app/',
        display: 'standalone',
        background_color: '#150C33',
        theme_color: '#150C33',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    }),
    robots()
  ]
});
