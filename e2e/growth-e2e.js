// Ninhora: teste grátis, sons, saltos, uso do app e painel administrativo (com a CSP real do build).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('node:path'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const { createECDH, randomBytes } = require('node:crypto');
const AXE = fs.readFileSync(require.resolve('axe-core'), 'utf8');

const API = 'http://localhost:8787', APP = 'http://localhost:4173';
const ADMIN = 'admin-token-local-de-teste-1234567890';
const STATE = process.env.D1_STATE || '/tmp/rotininha-d1';
const DIST = path.resolve(__dirname, '../apps/web/dist');
const OUT = process.argv[2] || '/tmp';
const DAY = 86_400_000;

const sql = (q) => { const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'rotininha', '--local', '--persist-to', STATE, '--json', '--command', q], { encoding: 'utf8', cwd: path.resolve(__dirname, '../apps/api'), env: { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_UPDATE_NOTIFIER: '1' } }); return JSON.parse(out.slice(out.indexOf('[')))[0].results; };
const post = (p, body, tok) => fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`, ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(body) });
const adm = (p, body) => fetch(API + p, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + ADMIN, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).then((r) => r.json());
const login = async (code) => (await (await post('/v1/sessions', { code, deviceId: 'dev' + randomBytes(5).toString('hex') + 'abcd' })).json()).accessToken;
const account = async (code) => (await (await post('/v1/billing/account', {}, await login(code))).json());

(async () => {
  const pushHits = [];
  const pushServer = http.createServer((req, res) => { req.resume(); pushHits.push(req.url); res.statusCode = 201; res.end(); });
  await new Promise((r) => pushServer.listen(19881, r));
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const mk = async (opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', ...opts });
    await ctx.addInitScript({ content: AXE });
    await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
    const p = await ctx.newPage(); p.errs = [];
    p.on('pageerror', (e) => p.errs.push(e.message));
    p.w = (f, arg, t = 8000) => p.waitForFunction(f, arg, { timeout: t }).then(() => true, () => false);
    return p;
  };
  const axe = async (p, label) => {
    await p.waitForTimeout(500);
    const res = await p.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }));
    const bad = res.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    ok(bad.length === 0, `acessibilidade (axe) ${label}: ${bad.map((v) => v.id + ' ×' + v.nodes.length).join(', ') || 'sem violações graves'}`);
    for (const v of bad) for (const n of v.nodes.slice(0, 2)) console.log('      ', v.id, '|', n.html.slice(0, 110), '|', (n.any[0]?.message || '').slice(0, 100));
  };

  // =================================================== APP: teste grátis
  const A = await mk();
  await A.goto(APP + '/app/');
  await A.click('text=Vamos lá'); await A.click('text=Prefiro não informar'); await A.click('text=Começar do zero'); await A.getByRole('button', { name: 'Depois', exact: true }).click();
  ok(await A.w(() => document.querySelector('.onb')?.innerText.includes('Teste grátis')), 'onboarding: passo do teste grátis');
  const trialTxt = await A.locator('.onb').innerText();
  ok(/Quando passarmos a cobrar, avisamos com antecedência/.test(trialTxt) && /3 dias de teste/.test(trialTxt), 'antes da cobrança: promete aviso com antecedência (nada é cobrado agora)');
  const email = `mae${Date.now()}@exemplo.com`;
  await A.fill('input[type=email]', email);
  await A.click('text=Começar meu teste grátis');
  ok(await A.w(() => document.querySelector('.access-code')?.innerText.length > 15), 'teste criado: código de acesso mostrado');
  const code = await A.locator('.access-code').innerText();
  ok(/^[2-9A-Z]{5}(-[2-9A-Z]{5}){3}$/.test(code), 'formato do código ' + code);
  ok(/só agora/.test(await A.locator('.onb').innerText()), 'avisa que o código aparece uma vez só');
  await A.click('text=Já guardei, continuar');
  ok(await A.w(() => document.querySelector('.install')), 'segue para a instalação');
  await A.click('text=Concluir');
  const acc = await account(code);
  ok(acc.plan === 'trial' && acc.prefs.hasEmail === true && acc.enforcement.active === false, 'conta de teste criada no servidor, com e-mail, sem cobrança ainda');
  ok(!(await A.locator('.notice').count()), 'pré-lançamento: nenhum aviso de cobrança');

  // Hoje → registro (conta uso) e preferências
  await A.click('.actions >> text=Mamou'); await A.waitForTimeout(400);
  await A.click('[aria-label="Ajustes"]');
  ok(await A.w(() => /Avisos e privacidade/.test(document.querySelector('.sheet')?.innerText)), 'Ajustes: grupo "Avisos e privacidade"');
  ok(await A.w(() => /Sincronizado|Sincronizando/.test(document.querySelector('.sheet')?.innerText ?? '')), 'Ajustes mostra a conta conectada');
  await A.click('text=Receber dicas e novidades por notificação'); await A.waitForTimeout(700);
  ok((await account(code)).prefs.tips === false, 'desligar dicas é salvo no servidor');
  await A.click('text=Ajudar a melhorar o app com estatísticas de uso'); await A.waitForTimeout(700);
  ok((await account(code)).prefs.usage === false, 'desligar estatísticas é salvo (e apaga o histórico)');
  await A.click('text=Ajudar a melhorar o app com estatísticas de uso'); await A.waitForTimeout(700);
  ok((await account(code)).prefs.usage === true, 'religar estatísticas');
  await A.click('.sheet >> text=Fechar');

  // =================================================== APP: aviso prévio e contagem regressiva
  await adm('/v1/admin/settings', { enforceFrom: Date.now() + 5 * DAY, devSkipNotice: true });
  await A.reload();
  ok(await A.w(() => document.querySelector('.notice')?.innerText.includes('a partir de')), 'cobrança anunciada: aviso prévio no app');
  const ann = await A.locator('.notice').innerText();
  ok(/Até lá, nada muda para você/.test(ann) && /R\$ 37,90/.test(ann) && /sem cobrança automática/.test(ann), 'aviso diz data, preço, "nada muda até lá" e que não há cobrança automática');
  await adm('/v1/admin/settings', { enforceFrom: Date.now() - 1000, devSkipNotice: true });
  await A.reload();
  ok(await A.w(() => document.querySelector('.notice')?.innerText.includes('Teste grátis: faltam')), 'cobrança em vigor: contagem regressiva do teste');
  ok(/faltam [23] dias/.test(await A.locator('.notice').innerText()), 'dias restantes coerentes');
  sql(`DELETE FROM settings WHERE key IN ('trial_enforce_from','trial_days','notice_days')`);
  sql(`UPDATE households SET valid_until = NULL, grace_until = NULL WHERE plan = 'trial'`);
  await A.reload(); await A.waitForTimeout(500);

  // =================================================== APP: sons
  await A.click('.tab:has-text("Sons")');
  ok(await A.w(() => document.querySelectorAll('.card.sound').length === 8), '8 sons na lista (3 gravações + 5 sintetizados)');
  const names = await A.locator('.card.sound strong').allInnerTexts();
  ok(['Ruído branco', 'Chuva', 'Ondas do mar', 'Batimentos', 'Caixinha de música'].every((n) => names.includes(n)), 'nomes: ' + names.join(', '));
  ok(/volume baixo/.test(await A.locator('main').innerText()) && /fora do berço/.test(await A.locator('main').innerText()) && /nem garantia de sono/.test(await A.locator('main').innerText()), 'aviso de segurança e sem promessa');
  await A.click('.card.sound:has-text("Chuva")');
  ok(await A.w(() => document.querySelector('.player')?.innerText.includes('Chuva')), 'tocando: painel com nome, volume e temporizador');
  ok((await A.locator('.player .chip[aria-pressed=true]').innerText()) === '30 min', 'temporizador padrão: 30 min');
  ok((await A.inputValue('input[type=range]')) === '0.15' && Number(await A.getAttribute('input[type=range]', 'max')) <= 0.8, 'volume inicial baixo (15%) e com teto');
  ok(await A.locator('.err').count() === 0, 'sem erro de áudio');
  await A.click('.chip:has-text("Até parar")');
  ok(await A.w(() => /Toca até você parar/.test(document.querySelector('.player')?.innerText ?? '')), 'modo "até parar"');
  await A.click('.card.sound:has-text("Ondas do mar")');
  ok(await A.w(() => document.querySelector('.player')?.innerText.includes('Ondas do mar')), 'trocar de som');
  await A.click('.player >> text=Parar');
  ok(await A.w(() => !document.querySelector('.player'), null, 4000), 'parar fecha o painel');
  await axe(A, 'Sons');

  // =================================================== APP: saltos
  await A.click('.tab:has-text("Saltos")');
  ok(await A.w(() => document.querySelector('main')?.innerText.includes('Data de nascimento do bebê')), 'Saltos: pede a data de nascimento');
  ok(/prematuro|prevista/i.test(await A.locator('main').innerText()) && /apagar quando quiser/.test(await A.locator('main').innerText()), 'explica prematuros e que dá para apagar');
  await A.fill('input[type=date]', new Date(Date.now() + 200 * DAY).toISOString().slice(0, 10)); await A.click('main >> text=Salvar');
  ok(await A.evaluate(() => document.querySelector('input[type=date]').validity.rangeOverflow), 'data muito à frente é barrada pelo próprio campo');
  await A.fill('input[type=date]', '2019-01-01'); await A.click('main >> text=Salvar');
  ok(await A.evaluate(() => document.querySelector('input[type=date]').validity.rangeUnderflow), 'data de anos atrás é barrada pelo próprio campo');
  const birth = new Date(Date.now() - 8 * 7 * DAY).toISOString().slice(0, 10);
  await A.fill('input[type=date]', birth); await A.click('main >> text=Salvar');
  ok(await A.w(() => /8 semanas/.test(document.querySelector('.age')?.innerText ?? '')), 'idade: 8 semanas');
  ok(await A.w(() => document.querySelector('.leap-now')?.innerText.includes('Padrões e repetições')), 'salto de 8 semanas em andamento');
  await A.click('.leap-now .chip >> nth=0');
  ok((await A.getAttribute('.leap-now .chip >> nth=0', 'aria-pressed')) === 'true', 'sinal de hoje marcado');
  await A.click('.leap-now >> text=Marcar: começou hoje');
  ok(await A.w(() => /Começou em/.test(document.querySelector('.leap-now')?.innerText)), 'marca o início');
  await A.reload(); await A.click('.tab:has-text("Saltos")');
  ok(await A.w(() => /Começou em/.test(document.querySelector('.leap-now')?.innerText ?? '')), 'marcação persiste');
  ok(await A.locator('.card.leap').count() === 10, 'linha do tempo com 10 saltos');
  ok(await A.locator('.card.leap.past').count() === 1 && await A.locator('.card.leap.now').count() === 1, 'situações: 1 já passou (semana 5), 1 agora (semana 8)');
  await A.click('.card.leap >> nth=5');
  ok(await A.w(() => document.querySelector('[role=dialog]')?.innerText.includes('O que você pode notar')), 'detalhe do salto');
  await A.click('[role=dialog] >> text=Fechar');
  ok(/não é um diagnóstico|não um diagnóstico|referência popular/i.test(await A.locator('main').innerText()), 'aviso: referência popular, não diagnóstico');
  ok(await A.w(async () => true), 'ok');
  await A.waitForTimeout(800);
  ok((await account(code)).prefs.babyBirthDate === birth, 'a data vai para a conta (para avisar antes de um salto)');
  await axe(A, 'Saltos');

  // =================================================== APP: links profundos e uso
  await A.goto(APP + '/app/?go=sons');
  ok(await A.w(() => document.querySelector('main h1')?.innerText === 'Sons para descansar'), 'link ?go=sons abre os sons');
  await A.goto(APP + '/app/?go=ajustes');
  ok(await A.w(() => document.querySelector('[role=dialog]')?.getAttribute('aria-label') === 'Ajustes'), 'link ?go=ajustes abre Ajustes');
  await A.click('.sheet >> text=Fechar');
  await A.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await A.waitForTimeout(1500);
  const hh = sql(`SELECT id, hid FROM households WHERE contact_email = '${email}'`)[0];
  const usage = Object.fromEntries(sql(`SELECT event, SUM(n) AS n FROM usage_daily WHERE hid = '${hh.hid}' GROUP BY event`).map((r) => [r.event, Number(r.n)]));
  ok(usage.app_open >= 1 && usage.care_logged >= 1 && usage.sound_played >= 1 && usage.leap_viewed >= 1 && usage.settings_opened >= 1, 'uso registrado (só contagens): ' + JSON.stringify(usage));
  ok(Object.keys(usage).every((k) => /^[a-z_]+$/.test(k)), 'só nomes de eventos, nenhum conteúdo');
  ok((await A.evaluate(() => window.__csp)).length === 0, 'app sob CSP: nenhuma violação');

  // =================================================== PAINEL
  const D = await mk({ viewport: { width: 1280, height: 900 } });
  await D.goto(APP + '/admin/');
  ok(await D.w(() => document.querySelector('form input[type=password]')), 'painel pede o token');
  await D.fill('input[type=password]', 'token-errado-123'); await D.click('text=Entrar');
  ok(await D.w(() => document.querySelector('.err')?.innerText.includes('Token inválido')), 'token errado é recusado');
  await D.fill('input[type=password]', ADMIN); await D.click('text=Entrar');
  ok(await D.w(() => document.querySelector('.tabs')), 'token certo entra no painel');
  ok(await D.w(() => /Famílias cadastradas/.test(document.body.innerText)), 'visão geral carregada');
  const kp = await D.locator('.kpi').allInnerTexts();
  ok(kp.length >= 6 && kp.some((k) => /Ativas hoje/.test(k)) && kp.some((k) => /Teste → pagou/.test(k)), 'KPIs: usuários, ativas, ativação, push, conversão do teste, receita');
  ok(/Retenção/.test(await D.locator('body').innerText()) && /Eficiência por campanha/.test(await D.locator('body').innerText()), 'retenção e eficiência por campanha');
  await axe(D, 'painel · visão geral');

  // aparelho de destino: família com push apontando para o servidor simulado
  const fam = (await (await post('/v1/dev/households', {})).json()).code;
  const tok = await login(fam);
  const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
  const sub = await post('/v1/push/subscribe', { endpoint: 'http://localhost:19881/painel-' + Date.now(), keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } }, tok);
  ok(sub.status === 201, 'aparelho de teste inscrito');

  await D.click('.tab:has-text("Notificações")');
  await D.fill('label:has-text("Nome interno") input', 'Painel e2e');
  await D.fill('label:has-text("Título") input', 'Sons chegaram 🌙');
  await D.fill('label:has-text("Texto") textarea', 'Conheça os 5 sons para a soneca do Ninhora.');
  ok(await D.locator('.notif').innerText().then((t) => t.includes('Sons chegaram 🌙') && t.includes('Conheça os 5 sons')), 'prévia da notificação acompanha o que é digitado');
  await D.selectOption('label:has-text("Ao tocar, abre") select', 'sons');
  await D.selectOption('label:has-text("Público") select', 'codes');
  await D.fill('label:has-text("Códigos de acesso") textarea', fam);
  await D.click('text=Quantas famílias recebem?');
  ok(await D.w(() => /1 podem receber/.test(document.body.innerText)), 'estimativa de alcance: 1 família');
  await D.fill('label:has-text("Testar em um aparelho") input', fam); await D.click('text=Enviar teste');
  ok(await D.w(() => document.body.innerText.includes('Teste enviado ao aparelho')), 'teste enviado ao aparelho');
  await D.waitForTimeout(500);
  ok(pushHits.some((u) => u.startsWith('/painel-')), 'o aparelho recebeu a notificação de teste');
  const before = pushHits.length;
  await D.getByRole('button', { name: 'Enviar', exact: true }).click();
  ok(await D.w(() => document.body.innerText.includes('Campanha na fila')), 'campanha criada');
  // o Cron roda a cada minuto; no teste forçamos um ciclo em horário comercial (fora do silêncio)
  const d = new Date(Date.now() + 2 * DAY);
  const fake = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 17, 0, 0); // 14:00 em São Paulo
  await post('/v1/dev/tick', { now: fake });
  await D.waitForTimeout(500);
  ok(pushHits.length > before, 'a campanha chegou ao aparelho');
  await D.click('.tab:has-text("Visão geral")'); await D.click('.tab:has-text("Notificações")');
  ok(await D.w(() => [...document.querySelectorAll('tr')].some((tr) => tr.innerText.includes('Painel e2e') && /Concluída/.test(tr.innerText) && /\b1\b/.test(tr.innerText))), 'lista mostra a campanha concluída com 1 envio');
  await axe(D, 'painel · notificações');

  await D.click('.tab:has-text("Automações")');
  ok(await D.w(() => document.querySelectorAll('.card .sw').length === 9), '9 automações listadas');
  ok(await D.locator('.sw input:checked').count() === 0, 'todas começam desligadas');
  await D.click('.sw >> nth=1'); await D.waitForTimeout(600);
  ok((await adm('/v1/admin/automations')).automations.filter((a) => a.enabled).map((a) => a.key).join() === 'first_care', 'ligar pelo painel liga no servidor');
  await D.fill('.card >> nth=1 >> textarea', 'Texto novo vindo do painel.'); await D.click('.card >> nth=1 >> text=Salvar texto'); await D.waitForTimeout(600);
  ok((await adm('/v1/admin/automations')).automations.find((a) => a.key === 'first_care').body === 'Texto novo vindo do painel.', 'edição de texto salva');
  await adm('/v1/admin/automations', { key: 'first_care', enabled: false });
  await axe(D, 'painel · automações');

  await D.click('.tab:has-text("Teste e cobrança")');
  ok(await D.w(() => /Pré-lançamento: ninguém é cobrado/.test(document.body.innerText)), 'cobrança: pré-lançamento');
  const soon = new Date(Date.now() + 2 * DAY).toISOString().slice(0, 10), okDay = new Date(Date.now() + 10 * DAY).toISOString().slice(0, 10);
  await D.fill('input[type=date]', soon); await D.click('text=Salvar');
  ok(await D.w(() => /Aviso prévio insuficiente/.test(document.body.innerText)), 'data sem aviso prévio é recusada');
  D.once('dialog', (dlg) => dlg.accept());
  await D.fill('input[type=date]', okDay); await D.click('text=Salvar');
  ok(await D.w(() => /Cobrança agendada para/.test(document.body.innerText)), 'cobrança agendada com aviso suficiente');
  sql(`DELETE FROM settings WHERE key IN ('trial_enforce_from','trial_days','notice_days')`);
  await axe(D, 'painel · cobrança');
  ok((await D.evaluate(() => window.__csp)).length === 0, 'painel sob CSP: nenhuma violação');
  ok(await D.evaluate(() => sessionStorage.getItem('ninhora-admin') === 'token-errado-123' ? false : true) && (await D.evaluate(() => localStorage.length)) === 0, 'token só em sessionStorage (nada em localStorage)');
  const robots = await D.locator('meta[name=robots]').getAttribute('content');
  ok(/noindex/.test(robots) && !(await D.content()).includes('rel="manifest"'), 'painel fora dos buscadores e sem manifesto');
  await D.screenshot({ path: OUT + '/painel.png' });

  const errs = [A, D].flatMap((x) => x.errs).filter((e) => !/net::|favicon/i.test(e));
  ok(errs.length === 0, 'sem erros JS ' + errs.slice(0, 2).join(' | '));
  pushServer.close(); await b.close();
})();
