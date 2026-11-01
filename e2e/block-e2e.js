// Bloqueio por falta de pagamento e liberação ao pagar (ambiente local: API + Mercado Pago simulado).
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
  // conta de teste + cobrança em vigor (simulada)
  const adm = (body) => fetch(API + '/v1/admin/settings', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: ADMIN }, body: JSON.stringify(body) });
  await adm({ enforceFrom: Date.now() - 10 * 86400000, devSkipNotice: true });
  const r = await (await fetch(API + '/v1/trial/start', { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '10.55.1.' + (Date.now() % 250) }, body: JSON.stringify({ deviceId: 'blk' + Date.now() + 'abcd', whatsapp: wa, password: pw }) })).json();
  ok(r.enforced === true, 'conta nova com cobrança em vigor tem teste com data de fim');
  const hh = sql(`SELECT id FROM households WHERE phone_hash IS NOT NULL ORDER BY created_at DESC LIMIT 1`)[0].id;

  const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  p.w = (f, arg, t = 12000) => p.waitForFunction(f, arg, { timeout: t }).then(() => true, () => false);
  await p.goto(APP + '/app/'); await p.getByText('Pular tudo').click({ timeout: 4000 }); await p.locator('.install-pop >> text=Agora não').click({ timeout: 2500 }).catch(() => {});
  await p.waitForSelector('.actions');
  await p.click('[aria-label="Ajustes"]'); await p.fill('.sheet input[type=tel]', wa); await p.fill('.sheet input[type=password]', pw); await p.getByRole('button', { name: 'Entrar', exact: true }).click();
  ok(await p.w(() => /Sincronizado/.test(document.querySelector('.sheet')?.innerText ?? '')), 'conectou com WhatsApp e senha');
  await p.locator('.sheet >> text=Fechar').click();

  // em teste: tudo liberado
  await p.locator('.qa-mamada').click(); await p.waitForTimeout(400);
  ok(/Mamada registrada/.test(await p.locator('.toast').innerText().catch(() => '')), 'em teste grátis: registra normalmente');

  // vence (depois da carência) → bloqueio
  sql(`UPDATE households SET valid_until=${Date.now() - 3 * 86400000}, grace_until=${Date.now() - 2 * 86400000} WHERE id='${hh}'`);
  await p.reload(); await p.waitForSelector('.actions'); await p.waitForTimeout(1500);
  ok(/Seu teste grátis terminou/.test(await p.locator('.notice').first().innerText()), 'aviso claro de que o teste terminou');
  const before = await p.evaluate(() => new Promise((res) => { const q = indexedDB.open('rotininha'); q.onsuccess = () => { const g = q.result.transaction('events').objectStore('events').getAll(); g.onsuccess = () => res(g.result.length); }; }));
  await p.locator('.qa-fralda').click(); await p.waitForTimeout(500);
  ok(await p.locator('[aria-label="Acesso vencido"]').count() === 1, 'registrar abre o aviso de acesso vencido');
  const t = await p.locator('[aria-label="Acesso vencido"]').innerText();
  ok(/R\$ 37,90/.test(t) && /vê-los e baixá-los/.test(t) && /sem assinatura/.test(t), 'aviso: preço único, registros continuam visíveis, sem assinatura');
  const after = await p.evaluate(() => new Promise((res) => { const q = indexedDB.open('rotininha'); q.onsuccess = () => { const g = q.result.transaction('events').objectStore('events').getAll(); g.onsuccess = () => res(g.result.length); }; }));
  ok(after === before, 'nada foi gravado enquanto bloqueado');
  await p.getByRole('button', { name: 'Agora não' }).click();
  await p.getByRole('button', { name: /Novo/ }).click();
  ok(await p.locator('[aria-label="Acesso vencido"]').count() === 1, 'criar lembrete também é bloqueado');
  await p.getByRole('button', { name: 'Agora não' }).click();
  await p.locator('.tab:has-text("Sons")').click(); await p.locator('.card.sound >> nth=0').click(); await p.waitForTimeout(300);
  ok(await p.locator('[aria-label="Acesso vencido"]').count() === 1 && await p.locator('.miniplayer, .player').count() === 0, 'tocar som é bloqueado');
  await p.getByRole('button', { name: 'Agora não' }).click();
  await p.locator('.tab:has-text("Histórico")').click(); await p.waitForTimeout(300);
  ok(/Mamada/.test(await p.locator('main').innerText()), 'histórico continua visível (só leitura)');
  await p.locator('.tab:has-text("Guia")').click(); await p.waitForTimeout(500);
  ok(/Quando buscar ajuda/.test(await p.locator('main').innerText()), 'informações de segurança continuam sempre disponíveis');
  await p.click('[aria-label="Ajustes"]'); await p.waitForTimeout(400);
  ok(await p.getByRole('button', { name: /Baixar meus dados/ }).count() === 1 && await p.getByText('Apagar meus dados').count() === 1, 'baixar e apagar dados continuam livres');
  await p.locator('.sheet >> text=Fechar').click();
  const srv = sql(`SELECT COUNT(*) AS n FROM records WHERE household_id='${hh}' AND kind='event'`)[0].n;

  // pagamento → liberação total
  await p.locator('.tab:has-text("Hoje")').click(); await p.locator('.qa-fralda').click();
  await p.getByRole('button', { name: /Garantir acesso vitalício/ }).click();
  await p.fill('input[type=email]', `blk${Date.now()}@exemplo.com`).catch(() => {});
  await p.fill('input[placeholder="000.000.000-00"]', '52998224725');
  await p.getByRole('button', { name: /Gerar Pix/ }).click();
  ok(await p.w(() => document.querySelector('textarea')?.value.startsWith('00020126PIX')), 'Pix gerado para o acesso vitalício');
  await approve();
  ok(await p.w(() => /Acesso garantido/.test(document.querySelector('[role=dialog]')?.innerText ?? '')), 'pagamento confirmado');
  await p.getByRole('button', { name: 'Continuar' }).click(); await p.waitForTimeout(800);
  ok(await p.locator('.notice').filter({ hasText: 'terminou' }).count() === 0, 'aviso de vencido some');
  await p.locator('.qa-fralda').click(); await p.waitForTimeout(500);
  ok(/Fralda registrada/.test(await p.locator('.toast').innerText().catch(() => '')) && await p.locator('[aria-label="Acesso vencido"]').count() === 0, 'depois de pagar: uso totalmente liberado');
  await p.waitForTimeout(2500);
  const srv2 = sql(`SELECT COUNT(*) AS n FROM records WHERE household_id='${hh}' AND kind='event'`)[0].n;
  ok(srv2 === srv + 1, 'o registro feito depois de pagar sincroniza com o servidor (' + srv + ' → ' + srv2 + ')');
  const acc = sql(`SELECT plan, valid_until FROM households WHERE id='${hh}'`)[0];
  ok(acc.plan === 'paid' && acc.valid_until > Date.now() + 3650 * 86400000, 'conta marcada como vitalícia no servidor');
  await adm({ enforceFrom: null }).catch(() => {});
  ok(p.errs.length === 0, 'sem erros JS ' + p.errs.join('|'));
  await b.close();
})();
