// Notificações: cartão na tela Hoje (ligar / instalar no iPhone / liberar), convite logo após criar lembrete,
// e aparelho interno (?interno=1) que não envia métricas.
const { chromium } = require('playwright');
const APP = 'http://localhost:4173', API = 'http://localhost:8787';
(async () => {
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const wa = `(11) 9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0').replace(/^(\d{4})(\d{4})$/, '$1-$2')}`, pw = 'senha de teste 2026';
  await fetch(API + '/v1/trial/start', { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '10.88.1.' + (Date.now() % 250) }, body: JSON.stringify({ deviceId: 'pkc' + Date.now() + 'abcd', whatsapp: wa, password: pw, internal: true }) });
  const mk = async ({ ua, perm = 'default', standalone = false, query = '' } = {}) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR', ...(ua ? { userAgent: ua } : {}) });
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); p.reqs = [];
    p.on('request', (r) => { if (/\/v1\/(analytics|usage)$/.test(r.url())) p.reqs.push(r.url()); });
    await p.addInitScript(([perm, standalone]) => {
      const mm = window.matchMedia.bind(window);
      window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: standalone, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q));
      Object.defineProperty(window, 'Notification', { value: Object.assign(function () {}, { permission: perm, requestPermission: async () => perm }), configurable: true });
    }, [perm, standalone]);
    await p.goto(APP + '/app/' + query); await p.waitForSelector('.onb');
    await p.getByRole('button', { name: 'Já tenho cadastro' }).click();
    await p.fill('.onb input[type=tel]', wa); await p.fill('.onb input[type=password]', pw);
    await p.getByRole('button', { name: 'Entrar', exact: true }).click();
    await p.waitForFunction(() => !document.querySelector('.onb') && document.querySelector('.actions'), null, { timeout: 12000 });
    await p.locator('.install-pop >> text=Agora não').click({ timeout: 2500 }).catch(() => {});
    await p.locator('.qa-mamada').click(); await p.waitForTimeout(600); // conteúdo: 1 cuidado registrado
    return p;
  };

  // 1) permissão pendente, no navegador: cartão com "Ativar agora"
  let p = await mk();
  ok(await p.waitForSelector('.push-card', { timeout: 8000 }).then(() => true, () => false), 'conta + 1 registro + permissão pendente: aparece o cartão de notificações');
  ok(await p.getByRole('button', { name: 'Ativar agora' }).isVisible(), 'cartão oferece "Ativar agora" (1 toque)');
  await p.getByRole('button', { name: 'Agora não' }).first().click(); await p.waitForTimeout(400);
  ok(await p.locator('.push-card').count() === 0, '"Agora não" some com o cartão');
  await p.reload(); await p.waitForTimeout(2000);
  ok(await p.locator('.push-card').count() === 0, 'e ele não volta logo na próxima abertura (espera alguns dias)');

  // 2) permissão bloqueada: explica como liberar
  p = await mk({ perm: 'denied' });
  await p.waitForSelector('.push-card', { timeout: 8000 });
  ok(/bloqueadas/.test(await p.locator('.push-card').innerText()), 'bloqueada: o cartão explica');
  await p.getByRole('button', { name: 'Como liberar' }).click();
  ok(/iPhone:.*Notificações/.test(await p.locator('.push-card').innerText()) && /Android:/.test(await p.locator('.push-card').innerText()), 'mostra o passo a passo para iPhone e Android');

  // 3) iPhone fora da tela inicial: manda instalar
  p = await mk({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  await p.waitForSelector('.push-card', { timeout: 8000 });
  ok(/instale/i.test(await p.locator('.push-card').innerText()), 'iPhone sem instalar: o cartão pede para instalar');
  await p.getByRole('button', { name: 'Como instalar', exact: true }).click();
  ok(await p.waitForSelector('.install-pop', { timeout: 5000 }).then(() => true, () => false), '"Como instalar" abre o passo a passo');

  // 4) logo depois de criar um lembrete: convite para ativar
  p = await mk();
  await p.getByRole('button', { name: /Novo/ }).first().click();
  await p.fill('input[placeholder="Ex.: Hora do banho"]', 'Banho teste'); await p.getByRole('button', { name: /Salvar|Criar/ }).first().click();
  ok(await p.waitForSelector('[aria-label="Ativar lembretes"]', { timeout: 8000 }).then(() => true, () => false), 'depois de criar um lembrete, aparece o convite para ativar as notificações');
  ok(/lembrete está salvo/.test(await p.locator('[aria-label="Ativar lembretes"]').innerText()), 'texto do momento certo ("seu lembrete está salvo")');

  // 5) aparelho interno: nada vai para as métricas
  p = await mk({ query: '?interno=1' });
  ok(await p.evaluate(() => localStorage.getItem('ninhora-internal')) === '1', '?interno=1 marca o aparelho como interno');
  ok(!(await p.url()).includes('interno'), 'e limpa o parâmetro do endereço');
  await p.reload(); await p.waitForTimeout(2500); await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  ok(p.reqs.length === 0, 'aparelho interno: nenhum envio de analytics/uso (' + p.reqs.length + ')');
  ok(p.errs.length === 0, 'sem erros JS ' + p.errs.join('|'));
  await b.close();
})();
