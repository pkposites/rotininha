// Painel: aba Compras (lista + ativar avisos no celular) e atalho ?tab=compras (usado pela notificação).
const { chromium } = require('playwright');
const APP = 'http://localhost:4173';
(async () => {
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  await p.addInitScript(() => { Object.defineProperty(window, 'Notification', { value: Object.assign(function () {}, { permission: 'default', requestPermission: async () => 'default' }), configurable: true }); });
  await p.addInitScript(() => { try { localStorage.setItem('ninhora-admin', 'admin-token-local-de-teste-1234567890'); } catch {} });
  await p.goto(APP + '/admin/?tab=compras'); await p.waitForSelector('h2');
  ok(/Compras/.test(await p.locator('h2').first().innerText()), '?tab=compras abre direto na aba Compras');
  await p.waitForTimeout(1000);
  ok(await p.getByRole('button', { name: 'Ativar avisos neste aparelho' }).isVisible(), 'oferece ativar os avisos no celular');
  await p.waitForSelector('text=Últimas compras', { timeout: 8000 });
  const t = await p.locator('main, .wrap').innerText();
  ok(/Ainda não há compras|(R\$ \d+,\d\d[\s\S]*(Pago|Reembolsado))/.test(t), 'lista mostra valor e situação (ou vazia)');
  ok(!/@(?![\w.-]+\*)/.test(t.replace(/\w{2}\*\*\*@/g, '')) , 'e-mail aparece mascarado');
  ok(await p.locator('link[rel=manifest]').getAttribute('href') === '/admin.webmanifest', 'manifesto próprio do painel (instalável no iPhone)');
  const mf = await (await p.request.get(APP + '/admin.webmanifest')).json();
  ok(mf.start_url === '/admin/' && mf.scope === '/admin/' && mf.display === 'standalone', 'manifesto do painel: escopo /admin/, standalone');
  ok(p.errs.length === 0, 'sem erros JS ' + p.errs.join('|'));
  await b.close();
})();
