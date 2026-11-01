// "Já tenho cadastro" desde o começo: quem entra pelo app com conta existente NÃO refaz o onboarding.
const { chromium } = require('playwright');
const APP = 'http://localhost:4173', API = 'http://localhost:8787';
(async () => {
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const wa = `(11) 9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0').replace(/^(\d{4})(\d{4})$/, '$1-$2')}`, pw = 'senha de teste 2026';
  const t = await fetch(API + '/v1/trial/start', { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '10.61.1.' + (Date.now() % 250) }, body: JSON.stringify({ deviceId: 'cad' + Date.now() + 'abcd', whatsapp: wa, password: pw }) });
  const acc = await t.json();
  await fetch(API + '/v1/sync', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + acc.session.accessToken }, body: JSON.stringify({ cursor: 0, changes: [{ kind: 'event', id: 'ev-cad-12345678', type: 'mamada', startedAt: Date.now() - 600000, endedAt: null, note: 'veio da conta', detail: '', updatedAt: Date.now(), deleted: false }] }) });

  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  p.w = (f, arg, t = 12000) => p.waitForFunction(f, arg, { timeout: t }).then(() => true, () => false);
  await p.goto(APP + '/app/'); await p.waitForSelector('.onb');
  ok(await p.getByRole('button', { name: 'Já tenho cadastro' }).isVisible(), '"Já tenho cadastro" aparece já na primeira tela');
  await p.getByRole('button', { name: 'Já tenho cadastro' }).click();
  ok(/Entrar na sua conta/.test(await p.locator('.onb').innerText()), 'abre direto o login (sem refazer o fluxo)');
  await p.fill('.onb input[type=tel]', wa); await p.fill('.onb input[type=password]', 'senha errada 123');
  await p.getByRole('button', { name: 'Entrar', exact: true }).click();
  ok(await p.w(() => /não conferem/.test(document.querySelector('.onb .err')?.innerText ?? '')), 'senha errada: mensagem clara, continua na mesma tela');
  await p.fill('.onb input[type=password]', pw); await p.getByRole('button', { name: 'Entrar', exact: true }).click();
  ok(await p.w(() => !document.querySelector('.onb') && document.querySelector('.actions')), 'depois de entrar, o onboarding fecha: não recomeça o fluxo');
  ok(await p.w(() => document.querySelector('.install-pop')), 'segue para a instalação do app');
  await p.locator('.install-pop >> text=Agora não').click(); await p.waitForTimeout(500);
  await p.locator('.tab:has-text("Histórico")').click();
  ok(await p.w(() => /Mamada/.test(document.querySelector('main')?.innerText ?? '')), 'os registros da conta chegam a este aparelho');
  await p.reload(); await p.waitForTimeout(1200);
  ok(await p.locator('.onb').count() === 0, 'ao reabrir, não volta o onboarding');
  ok(p.errs.length === 0, 'sem erros JS ' + p.errs.join('|'));
  await b.close();
})();
