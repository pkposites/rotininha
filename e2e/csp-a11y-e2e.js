const { chromium } = require('playwright');
const fs = require('fs');
const AXE = fs.readFileSync(require.resolve('axe-core'), 'utf8');
const DIST = require('node:path').resolve(__dirname, '../apps/web/dist');
const APP = 'http://localhost:4173';
const headersTxt = fs.readFileSync(DIST + '/_headers', 'utf8');
const CSP = /Content-Security-Policy: (.*)/.exec(headersTxt)[1];

(async () => {
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  ok(!/unsafe-inline|unsafe-eval/.test(CSP), 'CSP sem unsafe-inline/unsafe-eval');
  ok(/frame-ancestors 'none'/.test(CSP) && /object-src 'none'/.test(CSP) && /base-uri 'self'/.test(CSP), 'CSP: frame-ancestors, object-src e base-uri restritos');

  const mk = async (opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', ...opts });
    await ctx.route(/localhost:4173/, async (r) => { const res = await r.fetch(); await r.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': CSP } }); });
    await ctx.route(/facebook/, (r) => r.abort());
    await ctx.addInitScript({ content: AXE });
    await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
    const p = await ctx.newPage(); p.errs = [];
    p.on('pageerror', (e) => p.errs.push(e.message));
    p.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) p.errs.push('CSP: ' + m.text()); });
    p.w = (f, arg, t = 8000) => p.waitForFunction(f, arg, { timeout: t }).then(() => true, () => false);
    p.csp = () => p.evaluate(() => window.__csp);
    return p;
  };
  const axe = async (p, label) => {
    await p.waitForTimeout(500); // espera as animações de entrada (fade/slide) terminarem: avalia o estado final
    const res = await p.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }));
    const bad = res.violations.filter((v) => ['serious', 'critical', 'moderate'].includes(v.impact));
    ok(bad.length === 0, `axe ${label}: ${bad.map((v) => v.id + ' ×' + v.nodes.length).join(', ') || 'sem violações'}`);
    for (const v of bad) for (const n of v.nodes.slice(0, 3)) console.log('      ', v.id, '|', n.html.slice(0, 100), '|', (n.any[0]?.message || n.all[0]?.message || '').slice(0, 110));
  };

  // ---------- LP sob CSP ----------
  const L = await mk({ reducedMotion: 'reduce' });
  await L.goto(APP + '/'); await L.click('#consent-all'); await L.click('#pv-chips [data-pv=banho]');
  await L.click('[data-q=age] .chip >> nth=0'); await L.click('[data-q=pain] .chip >> nth=0'); await L.click('[data-q=other] .chip >> nth=1');
  ok((await L.csp()).length === 0, 'LP sob CSP: nenhuma violação ' + JSON.stringify(await L.csp()));

  // ---------- app sob CSP ----------
  const A = await mk();
  await A.goto(APP + '/app/');
  ok(await A.w(() => document.querySelector('.onb')), 'onboarding abre');
  await axe(A, 'onboarding');
  await A.click('text=Pular tudo');
  await A.click('.actions >> text=Mamou'); await A.click('.actions >> text=Dormiu');
  await A.waitForTimeout(400);
  await axe(A, 'Hoje');
  await A.click('.pill'); await A.fill('input[placeholder="Ex.: Hora do banho"]', 'Banho'); await A.fill('input[type=time]', '23:30');
  await axe(A, 'novo lembrete (com confirmação de silêncio)');
  await A.click('.sheet >> text=Cancelar');
  await A.click('.last >> nth=0'); await axe(A, 'editar registro'); await A.click('.sheet >> text=Cancelar');
  await A.click('.tab:has-text("Histórico")'); await A.waitForTimeout(300); await axe(A, 'Histórico');
  await A.click('.tab:has-text("Guia")'); await A.waitForTimeout(500); await axe(A, 'Guia');
  await A.click('.lesson-item:not([disabled])'); await axe(A, 'lição do guia');
  await A.click('text=← Todas as lições');
  await A.click('.tab:has-text("Hoje")');
  await A.click('[aria-label="Ajustes"]'); await axe(A, 'Ajustes');
  await A.click('.sheet >> text=Enviar sugestão'); await axe(A, 'formulário de sugestão'); await A.click('text=Agora não');
  await A.click('[aria-label="Ajustes"]'); await A.click('text=Apagar meus dados'); await axe(A, 'confirmação de exclusão'); await A.click('text=Manter'); await A.click('.sheet >> text=Fechar');

  // modo madrugada (contraste do tema escuro)
  await A.click('[aria-label="Ativar modo madrugada"]'); await A.waitForTimeout(300);
  await axe(A, 'Hoje (modo madrugada)');
  await A.click('.tab:has-text("Guia")'); await A.waitForTimeout(300); await axe(A, 'Guia (modo madrugada)');
  await A.click('[aria-label="Ajustes"]'); await axe(A, 'Ajustes (modo madrugada)');

  ok((await A.csp()).length === 0, 'app sob CSP: nenhuma violação ' + JSON.stringify(await A.csp()));
  const sw = await A.evaluate(async () => { try { const r = await navigator.serviceWorker.getRegistration('/app/'); return r ? r.scope : null; } catch { return 'erro'; } });
  ok(typeof sw === 'string' && sw.endsWith('/app/'), 'service worker registrado com escopo /app/ sob CSP: ' + sw);
  const realErrs = [L, A].flatMap((x) => x.errs).filter((e) => !/facebook|net::/i.test(e));
  ok(realErrs.length === 0, 'sem erros/violações no console ' + realErrs.join('|'));
  await b.close();
})();
