// Compra pelo app (sempre a partir de uma conta): tela do Pix, retomada, aprovação e liberação. Mercado Pago simulado localmente.
const { chromium } = require('playwright');
const { createHmac } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const API = 'http://localhost:8787', MP = 'http://localhost:19877', APP = 'http://localhost:4173';
const STATE = process.env.D1_STATE || '/tmp/claude-0/d1state';
const ADMIN = 'Bearer admin-token-local-de-teste-1234567890';
const sql = (q) => JSON.parse((() => { const o = execFileSync('npx', ['wrangler', 'd1', 'execute', 'rotininha', '--local', '--persist-to', STATE, '--json', '--command', q], { encoding: 'utf8', cwd: __dirname + '/../apps/api', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } }); return o.slice(o.indexOf('[')); })())[0].results;
const approve = async () => {
  const id = (await (await fetch(MP + '/__last')).json()).id;
  await fetch(`${MP}/__set/${id}`, { method: 'POST', body: JSON.stringify({ status: 'approved' }) });
  const reqId = 'r' + Date.now(), ts = String(Date.now());
  const v1 = createHmac('sha256', 'whsec_test').update(`id:${id};request-id:${reqId};ts:${ts};`).digest('hex');
  return fetch(`${API}/v1/webhooks/mercadopago?data.id=${id}&type=payment`, { method: 'POST', headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': reqId, 'content-type': 'application/json', 'CF-Connecting-IP': '10.77.' + (Date.now() % 250) + '.1' }, body: '{}' });
};
(async () => {
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const wa = `(11) 9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0').replace(/^(\d{4})(\d{4})$/, '$1-$2')}`, pw = 'senha de teste 2026';
  await fetch(API + '/v1/admin/settings', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: ADMIN }, body: JSON.stringify({ enforceFrom: Date.now() - 10 * 86400000, devSkipNotice: true }) });
  await fetch(API + '/v1/trial/start', { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '10.56.1.' + (Date.now() % 250) }, body: JSON.stringify({ deviceId: 'pay' + Date.now() + 'abcd', whatsapp: wa, password: pw }) });
  const hh = sql(`SELECT id FROM households WHERE phone_hash IS NOT NULL ORDER BY created_at DESC LIMIT 1`)[0].id;
  sql(`UPDATE households SET valid_until=${Date.now() + 86400000}, grace_until=${Date.now() + 2 * 86400000} WHERE id='${hh}'`);

  const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  p.w = (f, arg, t = 15000) => p.waitForFunction(f, arg, { timeout: t }).then(() => true, () => false);
  await p.goto(APP + '/app/'); await p.getByText('Pular tudo').click({ timeout: 4000 }); await p.locator('.install-pop >> text=Agora não').click({ timeout: 2500 }).catch(() => {});
  await p.waitForSelector('.actions');
  await p.click('[aria-label="Ajustes"]');
  ok(await p.getByText('Ainda não tenho acesso — comprar').count() === 0, 'sem conta não há compra solta: o caminho é criar a conta primeiro');
  await p.fill('.sheet input[type=tel]', wa); await p.fill('.sheet input[type=password]', pw); await p.getByRole('button', { name: 'Entrar', exact: true }).click();
  ok(await p.w(() => /Sincronizado/.test(document.querySelector('.sheet')?.innerText ?? '')), 'conectou com WhatsApp e senha');
  await p.waitForTimeout(800);
  await p.getByRole('button', { name: /Garantir acesso vitalício/ }).click();
  ok(await p.w(() => /Acesso vitalício ao Ninhora/.test(document.querySelector('[aria-label="Comprar acesso vitalício"]')?.innerText ?? '')), 'tela de compra mostra o preço do servidor');
  const D = '[aria-label="Comprar acesso vitalício"]';
  await p.w(() => /R\$ 37,90/.test(document.querySelector('[aria-label="Comprar acesso vitalício"]')?.innerText ?? ''));
  const txt = await p.locator(D).innerText();
  ok(txt.includes('R$ 37,90') && txt.includes('Não é assinatura') && txt.includes('Direito de arrependimento') && txt.includes('não fica guardado'), 'transparência: preço, não é assinatura, arrependimento, CPF');
  await p.fill(`${D} input[type=email]`, `mae${Date.now()}@exemplo.com`);
  await p.fill(`${D} input[placeholder="000.000.000-00"]`, '111.111.111-11'); await p.getByRole('button', { name: /Gerar Pix/ }).click();
  ok((await p.locator(`${D} .err`).innerText()).includes('CPF'), 'CPF inválido é recusado antes de enviar');
  await p.fill(`${D} input[placeholder="000.000.000-00"]`, '52998224725');
  ok((await p.inputValue(`${D} input[placeholder="000.000.000-00"]`)) === '529.982.247-25', 'máscara de CPF');
  await p.getByRole('button', { name: /Gerar Pix/ }).click();
  ok(await p.w(() => document.querySelector('textarea')?.value.startsWith('00020126PIX')), 'Pix copia e cola exibido');
  ok(await p.locator('img.qr').count() === 1 && (await p.locator('[role=dialog]').last().innerText()).includes('Aguardando'), 'QR Code exibido e estado "aguardando"');
  await p.click('text=Fechar (continuo acompanhando)'); await p.reload();
  ok(await p.w(() => /Pague com Pix/.test(document.querySelector('[role=dialog]')?.innerText ?? '')), 'recarregar retoma o Pix em andamento');
  ok((await approve()).status === 200, 'webhook assinado aceito');
  ok(await p.w(() => /Acesso garantido/.test(document.querySelector('[role=dialog]')?.innerText ?? '')), 'pagamento confirmado: acesso liberado na tela');
  await p.getByRole('button', { name: 'Continuar' }).click(); await p.click('[aria-label="Ajustes"]');
  ok(await p.w(() => /Acesso vitalício ✓/.test(document.querySelector('.sheet')?.innerText ?? '')), 'Ajustes mostra "Acesso vitalício ✓"');
  const acc = sql(`SELECT plan, valid_until FROM households WHERE id='${hh}'`)[0];
  ok(acc.plan === 'paid' && acc.valid_until > Date.now() + 3650 * 86400000, 'conta marcada como vitalícia no servidor');

  // #comprar sem conta cria a conta primeiro
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 900 }, locale: 'pt-BR' }); const q = await ctx2.newPage();
  await q.goto(APP + '/app/#comprar'); await q.getByText('Pular tudo').click({ timeout: 4000 }).catch(() => {});
  ok(await q.waitForFunction(() => document.querySelector('[aria-label="Teste grátis"] input[type=tel]'), null, { timeout: 8000 }).then(() => true, () => false), 'link de compra, sem conta: abre o cadastro (WhatsApp e senha), e não uma compra solta');
  sql(`DELETE FROM settings WHERE key='trial_enforce_from'`);
  ok(p.errs.length === 0, 'sem erros JS ' + p.errs.join('|'));
  await b.close();
})();
