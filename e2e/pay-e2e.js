const { chromium } = require('playwright');
const { createHmac } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const API = 'http://localhost:8787', MP = 'http://localhost:19877', APP = 'http://localhost:4173';
const STATE = process.env.D1_STATE || '/tmp/rotininha-d1';

const sql = (q) => { const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'rotininha', '--local', '--persist-to', STATE, '--json', '--command', q], { encoding: 'utf8', cwd: require('node:path').resolve(__dirname, '../apps/api') }); return JSON.parse(out.slice(out.indexOf('[')))[0].results; };
const mpId = async () => (await (await fetch(MP + '/__last')).json()).id;
const approve = async (status = 'approved') => {
  const id = await mpId();
  await fetch(`${MP}/__set/${id}`, { method: 'POST', body: JSON.stringify({ status }) });
  const reqId = 'r' + Date.now(), ts = String(Date.now());
  const v1 = createHmac('sha256', 'whsec_test').update(`id:${id};request-id:${reqId};ts:${ts};`).digest('hex');
  return fetch(`${API}/v1/webhooks/mercadopago?data.id=${id}&type=payment`, { method: 'POST', headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': reqId, 'content-type': 'application/json', 'CF-Connecting-IP': '10.77.' + (Date.now() % 250) + '.1' }, body: '{}' });
};

(async () => {
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const mk = async (url = APP + '/app/') => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP });
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
    await p.goto(url); await p.getByText('Pular tudo').click({ timeout: 2500 }).catch(() => {});
    p.w = (f, arg, t = 15000) => p.waitForFunction(f, arg, { timeout: t }).then(() => true, () => false);
    return p;
  };
  const email = `mae${Date.now()}@exemplo.com`;

  // ---------- compra ----------
  const A = await mk();
  await A.click('[aria-label="Ajustes"]');
  await A.click('text=Ainda não tenho acesso — comprar');
  ok(await A.w(() => document.querySelector('[role=dialog]')?.innerText.includes('R$ 11,90')), 'tela de compra mostra o preço do servidor');
  const txt = await A.locator('[role=dialog]').innerText();
  ok(txt.includes('Não é assinatura') && txt.includes('Direito de arrependimento') && txt.includes('não fica guardado'), 'transparência: não é assinatura, arrependimento, CPF');
  await A.fill('input[type=email]', email);
  await A.fill('input[placeholder="000.000.000-00"]', '111.111.111-11');
  await A.click('text=Gerar Pix');
  ok(await A.locator('.err').innerText().then((t) => t.includes('CPF')), 'CPF inválido é recusado antes de enviar');
  await A.fill('input[placeholder="000.000.000-00"]', '52998224725');
  ok((await A.inputValue('input[placeholder="000.000.000-00"]')) === '529.982.247-25', 'máscara de CPF');
  await A.click('text=Gerar Pix');
  ok(await A.w(() => document.querySelector('textarea')?.value.startsWith('00020126PIX')), 'Pix copia e cola exibido');
  ok(await A.locator('img.qr').count() === 1, 'QR Code exibido');
  ok((await A.locator('[role=dialog]').innerText()).includes('Aguardando'), 'estado: aguardando pagamento');
  await A.screenshot({ path: (process.argv[2] || '/tmp') + '/pix.png' });

  // fecha e recarrega: o pagamento em andamento é retomado
  await A.click('text=Fechar (continuo acompanhando)');
  await A.reload();
  ok(await A.w(() => document.querySelector('[role=dialog]')?.innerText.includes('Pague com Pix')), 'recarregar retoma o Pix em andamento');

  // pagamento confirmado (webhook assinado)
  ok((await approve()).status === 200, 'webhook assinado aceito');
  ok(await A.w(() => document.querySelector('.access-code')?.innerText.length > 15), 'código de acesso entregue');
  const code = await A.locator('.access-code').innerText();
  ok(/^[2-9A-Z]{5}(-[2-9A-Z]{5}){3}$/.test(code), 'formato do código ' + code);
  await A.click('text=Copiar código');
  ok(await A.w(() => document.querySelector('.sheet')?.innerText.includes('Copiado')), 'botão copiar');
  ok((await A.evaluate(() => navigator.clipboard.readText())) === code, 'código na área de transferência');
  await A.screenshot({ path: (process.argv[2] || '/tmp') + '/codigo.png' });
  await A.click('text=Já guardei, continuar');
  await A.click('[aria-label="Ajustes"]');
  ok(await A.w(() => /Sincronizado/.test(document.querySelector('.sheet')?.innerText) && /Seu acesso/.test(document.querySelector('.sheet')?.innerText)), 'aparelho conectado e validade exibida em Ajustes');
  const acct = await A.locator('.sheet').innerText();
  ok(/Válido até \d{2}\/\d{2}\/\d{4}/.test(acct), 'validade formatada');

  // o código não aparece mais em lugar nenhum: recarregar não o mostra
  await A.click('.sheet >> text=Fechar');
  await A.reload();
  ok(!(await A.content()).includes(code), 'código não fica na página após fechar');
  ok(Number((await sql(`SELECT COUNT(*) AS n FROM payments WHERE email='${email}' AND delivery_sealed IS NOT NULL`))[0].n) === 0, 'servidor apagou o código entregue');

  // ---------- registro sincronizado ----------
  await A.click('.actions >> text=Mamou'); await A.waitForTimeout(1500);

  // ---------- recuperação ----------
  await A.click('[aria-label="Ajustes"]'); await A.click('text=Sair deste aparelho');
  await A.click('text=Perdi meu código');
  await A.fill('input[type=email]', email); await A.click('text=Enviar link');
  ok(await A.w(() => document.querySelector('[role=dialog]')?.innerText.includes('Se houver uma compra')), 'recuperação: mensagem neutra');
  const mails = (await (await fetch(`${API}/v1/dev/outbox?to=${encodeURIComponent(email)}`)).json()).messages;
  const link = /(http:\/\/[^\s]+#recover=[\w-]+)/.exec(mails.find((m) => m.subject.includes('recuperar')).body)[1];
  const B = await mk(link);
  ok(await B.w(() => document.querySelector('[role=dialog]')?.innerText.includes('novo código de acesso')), 'link abre a confirmação (não gera sozinho)');
  ok(!(await B.url()).includes('recover='), 'token removido da barra de endereço');
  await B.click('text=Gerar novo código');
  ok(await B.w(() => document.querySelector('.access-code')?.innerText.length > 15), 'novo código gerado');
  const code2 = await B.locator('.access-code').innerText();
  ok(code2 !== code, 'código novo é diferente');
  const old = await fetch(API + '/v1/sessions', { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '10.88.1.1' }, body: JSON.stringify({ code, deviceId: 'dev12345678' }) });
  ok(old.status === 401, 'código antigo não funciona mais');
  await B.click('text=Já guardei, continuar');
  await B.click('[aria-label="Ajustes"]');
  ok(await B.w(() => /Sincronizado/.test(document.querySelector('.sheet')?.innerText)), 'novo aparelho conectado após recuperação');
  await B.click('.sheet >> text=Fechar');
  await B.click('.tab:has-text("Histórico")');
  ok(await B.w(() => document.querySelector('.timeline')?.innerText.includes('Mamada')), 'registros anteriores continuam disponíveis após recuperar');

  // ---------- renovação ----------
  await B.click('[aria-label="Ajustes"]'); await B.click('text=Renovar acesso');
  ok(await B.w(() => document.querySelector('[role=dialog]')?.innerText.includes('Renovar acesso')), 'tela de renovação');
  await B.w(() => document.querySelectorAll('[role=radio]').length === 3, null, 5000);
  ok((await B.locator('[role=radio]').count()) === 3, 'renovação oferece 7/30/90 dias');
  await B.click('[role=radio]:has-text("90 dias")');
  await B.fill('input[placeholder="000.000.000-00"]', '52998224725');
  await B.click('text=Gerar Pix de R$ 39,90');
  ok(await B.w(() => document.querySelector('textarea')?.value.startsWith('00020126PIX')), 'Pix da renovação');
  await approve();
  ok(await B.w(() => document.querySelector('[role=dialog]')?.innerText.includes('Acesso renovado')), 'renovação confirmada');
  ok(/vale até \d{2}\/\d{2}\/\d{4}/.test(await B.locator('[role=dialog]').innerText()), 'nova validade exibida');
  await B.click('text=Continuar');

  // ---------- aviso de vencimento ----------
  sql(`UPDATE households SET valid_until=${Date.now() - 3 * 86400000}, grace_until=${Date.now() - 2 * 86400000} WHERE id=(SELECT household_id FROM payments WHERE email='${email}' LIMIT 1)`);
  await B.reload();
  ok(await B.w(() => document.querySelector('.notice.warn')?.innerText.includes('ainda pode ver seus registros')), 'vencido: aviso acolhedor com opção de renovar');
  const warn = await B.locator('.notice').innerText();
  ok(!/erro|falha|atrasad|culpa/i.test(warn), 'texto sem tom alarmista');
  await B.screenshot({ path: (process.argv[2] || '/tmp') + '/vencido.png' });

  ok(A.errs.length === 0 && B.errs.length === 0, 'sem erros JS ' + [...A.errs, ...B.errs].join('|'));
  await b.close();
})();
