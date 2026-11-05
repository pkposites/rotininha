// Painel: reutilizar notificações e enviar uma automação na hora (com contagem e confirmação).
const { chromium } = require('playwright');
const APP = 'http://localhost:4173', API = 'http://localhost:8787', ADMIN = 'admin-token-local-de-teste-1234567890';
(async () => {
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const adm = (path, body) => fetch(API + path, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + ADMIN, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).then((r) => r.json());
  const tag = 'Reuso ' + Date.now();
  await adm('/v1/admin/campaigns', { name: tag, title: 'Título original', body: 'Texto original da campanha', target: 'sons', audience: { segment: 'inactive', days: 5 }, draft: true });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('ninhora-admin', 'admin-token-local-de-teste-1234567890'); } catch {} });
  await p.goto(APP + '/admin/'); await p.waitForSelector('.bar');

  // 1) reutilizar uma campanha
  await p.getByRole('button', { name: 'Notificações' }).click();
  const row = p.locator('tr', { hasText: tag });
  await row.waitFor({ timeout: 8000 });
  await row.getByRole('button', { name: 'Reutilizar' }).click();
  await p.waitForTimeout(400);
  ok(await p.locator('input[maxlength="60"]').inputValue() === 'Título original', 'Reutilizar: título copiado para o formulário');
  ok((await p.locator('textarea[maxlength="180"]').inputValue()) === 'Texto original da campanha', 'Reutilizar: texto copiado');
  ok(await p.locator('select').nth(1).inputValue() === 'inactive' && await p.locator('input[type=number]').inputValue() === '5', 'Reutilizar: público e dias copiados');
  ok(/Nenhuma|\(cópia\)/.test(await p.locator('input[maxlength="80"]').inputValue()), 'nome vira "(cópia)"');
  ok(await p.getByText(/Copiado para o formulário/).count() > 0, 'avisa que nada foi enviado ainda');

  // 2) automação: enviar agora
  await p.getByRole('button', { name: 'Automações' }).click();
  await p.waitForSelector('text=Boas-vindas');
  await p.getByRole('button', { name: 'Enviar agora' }).first().click();
  ok(await p.waitForFunction(() => /famílias? pode|Contando/.test(document.body.innerText), null, { timeout: 8000 }).then(() => true, () => false), 'mostra quantas famílias recebem antes de enviar');
  await p.waitForFunction(() => /\d+ famílias? pode/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
  // editar na aba Notificações
  await p.getByRole('button', { name: 'Editar na aba Notificações' }).first().click(); await p.waitForTimeout(500);
  ok(/Bem-vinda/.test(await p.locator('input[maxlength="60"]').inputValue()), 'Editar na aba Notificações: leva o texto da automação ao formulário');
  // envio direto (se houver quem receba) — cria campanha manual
  await p.getByRole('button', { name: 'Automações' }).click(); await p.waitForSelector('text=Boas-vindas');
  await p.getByRole('button', { name: 'Enviar agora' }).first().click();
  await p.waitForFunction(() => /\d+ famílias? pode/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
  let dialog = '';
  p.once('dialog', async (d) => { dialog = d.message(); await d.accept(); });
  const enabled = await p.getByRole('button', { name: 'Enviar agora' }).nth(1).isEnabled().catch(() => false);
  if (enabled) {
    await p.getByRole('button', { name: 'Enviar agora' }).nth(1).click(); await p.waitForTimeout(1200);
    const l = await adm('/v1/admin/campaigns');
    ok(/Enviar ".*" agora para \d+/.test(dialog) && l.campaigns.some((c) => /Boas-vindas \(manual\)/.test(c.name)), 'confirma com a contagem e cria a campanha na fila');
  } else console.log('SKIP sem famílias no público local (confirmação não exercitada)');
  ok(p.errs.length === 0, 'sem erros JS ' + p.errs.join('|'));
  await b.close();
})();
