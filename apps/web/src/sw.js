/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/app/index.html'), { allowlist: [/^\/app\//] }));

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('message', (e) => { if (e.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Push: toda mensagem precisa virar uma notificação visível (exigência do iOS/Safari).
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data?.text?.() }; }
  event.waitUntil(
    self.registration.showNotification(d.title || 'Ninhora', {
      body: d.body || 'Você tem um lembrete no Ninhora',
      tag: d.tag || 'rotininha',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { occId: d.occId || null, target: d.target || null, sid: d.sid || null, click: d.click || null }
    })
  );
});

// Tocar na notificação abre o lembrete para o usuário CONFIRMAR; nunca marca como feito sozinho.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { occId, target, sid, click } = event.notification.data ?? {};
  // Avisos promocionais: conta o clique (id único do envio; não identifica a pessoa por si só)
  if (sid && click) { try { event.waitUntil(fetch(click, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sid }), keepalive: true }).catch(() => {})); } catch {} }
  const url = occId ? `/app/?occ=${encodeURIComponent(occId)}` : target ? `/app/?go=${encodeURIComponent(target)}` : '/app/';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) {
      if ('focus' in c) { c.postMessage(occId ? { type: 'open-occ', occId } : { type: 'open-target', target }); return c.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});
