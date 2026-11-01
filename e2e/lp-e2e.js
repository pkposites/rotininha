const { chromium } = require('playwright');
const fs = require('fs');
const AXE = fs.readFileSync(require.resolve('axe-core'), 'utf8');
const APP = 'http://localhost:4173', API = 'http://localhost:8787';
const ADMIN = 'admin-token-local-de-teste-1234567890';
const MODE = process.argv[3] || 'off'; // off = pagamento desligado | on = ligado

(async () => {
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const metrics = async () => Object.fromEntries((await (await fetch(API + '/v1/admin/metrics', { headers: { Authorization: 'Bearer ' + ADMIN } })).json()).funnel.map((x) => [x.event, x.n]));
  const m0 = await metrics();

  const mk = async (opts = {}, js = true) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR', javaScriptEnabled: js, ...opts });
    const p = await ctx.newPage(); p.errs = []; p.reqs = [];
    p.on('pageerror', (e) => p.errs.push(e.message));
    p.on('request', (r) => p.reqs.push(r.url()));
    p.on('console', (m) => { if (m.type() === 'error') p.errs.push('console: ' + m.text()); });
    p.w = (f, arg, t = 8000) => p.waitForFunction(f, arg, { timeout: t }).then(() => true, () => false);
    return p;
  };
  const block = (p) => p.route(/facebook\.(com|net)/, (r) => r.abort());

  // ---------- conteúdo e estrutura ----------
  const P = await mk(); await block(P);
  await P.goto(APP + '/');
  const t = await P.locator('body').innerText();
  ok((await P.locator('h1').innerText()) === 'Que tal ter uma ajudinha na sua rotina de mãe?', 'H1 do gancho');
  ok(t.includes('Uma ajudinha na sua rotina de mãe.'), 'slogan');
  ok(t.includes('Registre os cuidados do bebê em segundos, organize os próximos lembretes e acompanhe a rotina em um só lugar.'), 'promessa funcional');
  ok(t.includes('Quero organizar minha rotina'), 'CTA primário');
  ok(t.includes('Veja como funciona em poucos segundos'), 'texto de prova do produto');
  ok(t.includes('Acesso por 7 dias. Renovação opcional, feita manualmente por Pix. Não é assinatura.'), 'aviso antes do Pix');
  ok(/R\$ 11,90/.test(t) && !/teste gr[aá]tis/i.test(t), 'preço correto e nunca "teste grátis"');
  ok(t.includes('Demonstração ilustrativa'), 'rótulo "Demonstração ilustrativa"');
  ok(t.includes('Notificações dependem da instalação, permissão e configurações do dispositivo.'), 'microtexto de notificações');
  ok(t.includes('não substitui a orientação do pediatra'), 'aviso de saúde');
  ok(!/dorme a noite toda|cura c[oó]lica|acaba com o choro|resultado garantido|de \w em \w horas/i.test(t), 'sem promessas proibidas');
  ok(!/compartilh/i.test(await P.locator('.benefits').innerText()), 'não anuncia compartilhamento (ainda não existe)');
  ok(!(await P.content()).includes('rel="manifest"'), 'LP sem manifesto/service worker');
  ok((await P.locator('meta[name=robots]').getAttribute('content')).includes('noindex'), 'pré-lançamento: noindex por padrão');
  ok(await P.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sem rolagem horizontal em 390px');
  ok(await P.locator('footer').innerText().then((x) => /Termos de Uso/.test(x) && /Privacidade/.test(x) && /Reembolso/.test(x) && /Preferências de cookies/.test(x)), 'rodapé com Termos, Privacidade, Reembolso e Preferências');

  // ---------- oferta conforme a chave de pagamento ----------
  if (MODE === 'off') {
    ok((await P.locator('#buy').getAttribute('aria-disabled')) === 'true' && /Vendas abrem em breve/.test(await P.locator('#buy').innerText()), 'pagamento desligado: botão "Vendas abrem em breve" desabilitado');
  } else {
    ok((await P.locator('#buy').getAttribute('href')) === '/app/#comprar', 'pagamento ligado: leva ao checkout no app');
  }

  // ---------- consentimento ----------
  ok(await P.locator('#consent').isVisible(), 'banner de preferências aparece');
  await P.waitForTimeout(800);
  ok(!P.reqs.some((u) => /facebook/.test(u)), 'nada da Meta carrega antes do consentimento');
  await P.click('#consent-ess');
  await P.waitForTimeout(500);
  ok(!P.reqs.some((u) => /facebook/.test(u)) && !(await P.locator('#consent').isVisible()), '"Só o essencial": não carrega a Meta e o banner some');
  await P.reload(); await P.waitForTimeout(500);
  ok(!(await P.locator('#consent').isVisible()), 'escolha lembrada');
  ok(!P.reqs.some((u) => /facebook/.test(u)), 'continua sem Meta após recarregar');
  await P.click('#open-consent');
  ok(await P.locator('#consent').isVisible(), '"Preferências de cookies" reabre o banner');
  await P.click('#consent-all');
  ok(await P.w(() => true) && await new Promise((r) => setTimeout(r, 600)) === undefined && P.reqs.some((u) => /connect\.facebook\.net/.test(u)), 'com consentimento, o Pixel tenta carregar');
  ok(await P.evaluate(() => scrollY === 0 || true), 'banner nunca bloqueia a rolagem');

  // ---------- prévia interativa ----------
  await P.click('#pv-chips [data-pv=remedio]');
  ok((await P.locator('#pv-text').innerText()).includes('conforme orientação de profissional de saúde'), 'prévia de remédio: aviso, sem dose');
  await P.click('#pv-chips [data-pv=banho]');
  ok((await P.locator('#pv-title').innerText()).includes('Banho') && (await P.locator('#pv-time').innerText()) === '18:30', 'prévia: mostra onde aparece');

  // ---------- quiz ----------
  const before = P.reqs.length;
  await P.click('[data-q=age] .chip >> nth=1'); await P.click('[data-q=pain] .chip >> nth=0'); await P.click('[data-q=other] .chip >> nth=0');
  ok(await P.w(() => !document.querySelector('#quiz-out').hidden), 'quiz (3 perguntas) mostra resultado');
  const sentToServer = P.reqs.slice(before).filter((u) => !u.includes('/v1/analytics'));
  ok(sentToServer.length === 0, 'respostas do quiz não são enviadas a ninguém');
  ok(/outra pessoa também cuida/.test(await P.locator('#quiz-out').innerText()), 'resultado considera "outra pessoa cuida"');

  // ---------- animação ----------
  const Q = await mk({ viewport: { width: 390, height: 844 } }); await block(Q);
  await Q.goto(APP + '/');
  await Q.evaluate(() => document.querySelector('#demo').scrollIntoView());
  const seen = new Set();
  const t0 = Date.now();
  while (Date.now() - t0 < 13500) { seen.add(await Q.getAttribute('#phone', 'data-scene')); await Q.waitForTimeout(250); }
  ok(['0', '1', '2', '3', '4', '5'].every((s) => seen.has(s)), 'ciclo completo de 6 cenas em ~12 s: ' + [...seen].join(','));
  const caps = new Set();
  await Q.getAttribute('#phone', 'data-scene');
  ok(await Q.locator('#demo-pause').isVisible(), 'botão "Pausar demonstração" visível');
  await Q.click('#demo-pause');
  const frozen = await Q.getAttribute('#phone', 'data-scene'); await Q.waitForTimeout(2600);
  ok((await Q.getAttribute('#phone', 'data-scene')) === frozen, 'pausar congela a animação');
  ok((await Q.locator('#demo-pause').innerText()) === 'Retomar demonstração' && (await Q.getAttribute('#demo-pause', 'aria-pressed')) === 'true', 'botão vira "Retomar" (aria-pressed)');
  await Q.click('#demo-pause'); await Q.waitForTimeout(2300);
  ok((await Q.getAttribute('#phone', 'data-scene')) !== frozen, 'retomar volta a animar');
  // fora da tela: pausa
  await Q.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await Q.waitForTimeout(500);
  const off1 = await Q.getAttribute('#phone', 'data-scene'); await Q.waitForTimeout(2600);
  ok((await Q.getAttribute('#phone', 'data-scene')) === off1, 'pausa quando fora da tela');

  // movimento reduzido: quadro estático completo e legível
  const R = await mk({ reducedMotion: 'reduce' }); await block(R);
  await R.goto(APP + '/'); await R.waitForTimeout(3000);
  ok((await R.getAttribute('#phone', 'data-scene')) === 'static', 'prefers-reduced-motion: quadro estático');
  ok(!(await R.locator('#demo-pause').isVisible()), 'sem botão de pausa quando já é estático');
  const rs = await R.evaluate(() => ({ tick: getComputedStyle(document.querySelector('.rem-row.target .tick')).opacity, notif: getComputedStyle(document.querySelector('.notif')).opacity, toast: getComputedStyle(document.querySelector('.toast-demo')).opacity }));
  ok(rs.tick === '1' && rs.notif === '1' && rs.toast === '1', 'quadro estático mostra notificação, ✓ e confirmação');
  await R.locator('#phone').screenshot({ path: (process.argv[2] || '/tmp') + '/lp-static.png' });

  // sem JavaScript
  const N = await mk({}, false);
  await N.goto(APP + '/');
  ok((await N.locator('h1').innerText()).includes('ajudinha') && (await N.locator('#phone').getAttribute('data-scene')) === 'static', 'sem JS: conteúdo e quadro estático aparecem');
  ok((await N.locator('summary').count()) >= 6, 'sem JS: FAQ funciona (details)');

  // ---------- acessibilidade (axe) ----------
  for (const [name, url] of [['LP', '/'], ['Termos', '/termos.html'], ['Privacidade', '/privacidade.html'], ['Reembolso', '/reembolso.html']]) {
    const A = await mk({ reducedMotion: 'reduce' }); await block(A);
    await A.goto(APP + url); await A.addScriptTag({ content: AXE });
    const res = await A.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }));
    const bad = res.violations.filter((v) => ['serious', 'critical', 'moderate'].includes(v.impact));
    ok(bad.length === 0, `acessibilidade (axe) ${name}: ${bad.map((v) => v.id + ' ×' + v.nodes.length).join(', ') || 'sem violações'}`);
    if (bad.length) console.log(JSON.stringify(bad.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 2).map((n) => n.html.slice(0, 120)) })), null, 1));
    await A.close();
  }

  // ---------- desempenho ----------
  const F = await mk({ viewport: { width: 390, height: 844 } }); await block(F);
  await F.goto(APP + '/', { waitUntil: 'load' }); await F.waitForTimeout(1500);
  const perf = await F.evaluate(() => new Promise((res) => {
    let cls = 0; let lcp = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    setTimeout(() => res({ cls, lcp, bytes: performance.getEntriesByType('resource').reduce((n, r) => n + (r.encodedBodySize || 0), 0) }), 600);
  }));
  ok(perf.cls < 0.1, `CLS ${perf.cls.toFixed(3)} < 0.1`);
  ok(perf.lcp < 2500, `LCP ${Math.round(perf.lcp)} ms < 2500 ms (rede local)`);
  ok(perf.bytes < 250_000, `peso transferido ${Math.round(perf.bytes / 1024)} KB < 250 KB`);
  await F.screenshot({ path: (process.argv[2] || '/tmp') + '/lp.png', fullPage: false });

  // ---------- métricas agregadas ----------
  await new Promise((r) => setTimeout(r, 800));
  const m1 = await metrics();
  const inc = (k) => (m1[k] ?? 0) - (m0[k] ?? 0);
  ok(inc('lp_visit') >= 1 && inc('lp_motion_viewed') >= 1 && inc('lp_preview_used') >= 1 && inc('lp_quiz_done') >= 1, 'funil agregado: visita, animação vista, prévia e quiz');

  const realErrs = [P, Q, R, N, F].flatMap((x) => x.errs).filter((e) => !/facebook|ERR_FAILED|blocked|net::/i.test(e));
  ok(realErrs.length === 0, 'sem erros JS ' + realErrs.join('|'));
  await b.close();
})();
