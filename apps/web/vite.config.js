import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve, join } from 'node:path';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';

// Duas "áreas": a LP estática na raiz (rápida, sem service worker) e o app em /app/ (PWA).
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
        const h = readFileSync(p, 'utf8'), n = h.replace(/<link rel="manifest"[^>]*>\s*/g, '');
        if (n !== h) writeFileSync(p, n);
      });
      walk(resolve(__dirname, outDir));
    } }
  };
};

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        lp: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html'),
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
      injectManifest: { globPatterns: ['app/**/*.html', 'assets/**/*.{js,css,woff2}', 'icons/**/*', '*.webmanifest'] },
      includeAssets: ['icons/icon.svg'],
      manifest: {
        id: '/app/',
        name: 'Rotininha',
        short_name: 'Rotininha',
        description: 'Uma ajudinha na sua rotina de mãe.',
        lang: 'pt-BR',
        start_url: '/app/',
        scope: '/app/',
        display: 'standalone',
        background_color: '#FBF9F7',
        theme_color: '#6D56A6',
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
