// App instalado + conta: pede os lembretes com 1 toque na abertura; e reenvia a inscrição sozinho quando já há permissão.
const { chromium } = require('playwright');
const APP = 'http://localhost:4173', API = 'http://localhost:8787';
(async () => {
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const wa = `(11) 9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0').replace(/^(\d{4})(\d{4})$/, '$1-$2')}`, pw = 'senha de teste 2026';
  const t = await fetch(API + '/v1/trial/start', { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '10.77.1.' + (Date.now() % 250) }, body: JSON.stringify({ deviceId: 'pka' + Date.now() + 'abcd', whatsapp: wa, password: pw }) });
  const acc = await t.json();
  const mk = async (standalone, perm, fakeSub) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); p.subs = [];
    p.on('request', (r) => { if (r.url().endsWith('/v1/push/subscribe')) p.subs.push(r.url()); });
    await p.addInitScript(([standalone, perm, fakeSub]) => {
      const mm = window.matchMedia.bind(window);
      window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: standalone, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q));
      Object.defineProperty(window, 'Notification', { value: Object.assign(function () {}, { permission: perm, requestPermission: async () => perm }), configurable: true });
      if (fakeSub && window.PushManager) PushManager.prototype.getSubscription = async () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/fake', toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/fake', keys: { p256dh: 'BFakeKey', auth: 'fakeauth' } }), options: {} });
    }, [standalone, perm, fakeSub]);
    // entra com a conta pelo onboarding
    await p.goto(APP + '/app/'); await p.waitForSelector('.onb');
    await p.getByRole('button', { name: 'Já tenho cadastro' }).click();
    await p.fill('.onb input[type=tel]', wa); await p.fill('.onb input[type=password]', pw);
    await p.getByRole('button', { name: 'Entrar', exact: true }).click();
    await p.waitForFunction(() => !document.querySelector('.onb') && document.querySelector('.actions'), null, { timeout: 12000 });
    await p.locator('.install-pop >> text=Agora não').click({ timeout: 2500 }).catch(() => {});
    return p;
  };

  // 1) instalado, com conta, permissão pendente → pede com um toque
  let p = await mk(true, 'default', false);
  ok(await p.waitForSelector('[aria-label="Ativar lembretes"]', { timeout: 8000 }).then(() => true, () => false), 'app instalado + conta: aparece o convite para ativar os lembretes');
  ok(/permissão/.test(await p.locator('[aria-label="Ativar lembretes"]').innerText()), 'explica a permissão do aparelho');
  await p.getByRole('button', { name: 'Agora não' }).click(); await p.waitForTimeout(400);
  await p.reload(); await p.waitForTimeout(2000);
  ok(await p.locator('[aria-label="Ativar lembretes"]').count() === 0, 'Agora não: não volta logo na próxima abertura');
  ok(p.errs.length === 0, 'sem erros JS ' + p.errs.join('|'));

  // 2) fora do app instalado: não incomoda com o convite
  p = await mk(false, 'default', false);
  await p.waitForTimeout(2500);
  ok(await p.locator('[aria-label="Ativar lembretes"]').count() === 0, 'no navegador (não instalado): o convite não aparece');

  // 3) já tem permissão e inscrição, mas o servidor pode não conhecer: reenvia sozinho, sem convite
  p = await mk(true, 'granted', true);
  await p.waitForTimeout(3000);
  ok(p.subs.length >= 1, 'reenvia a inscrição à conta atual sem pedir nada');
  ok(await p.locator('[aria-label="Ativar lembretes"]').count() === 0, 'com permissão ativa: sem convite');
  await b.close();
})();
