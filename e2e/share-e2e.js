// Compartilhar a Ninhora (Ajustes → "Sobre a Ninhora"): nativo, cancelar e copiar link. Nenhuma mensagem real é enviada.
const { chromium } = require('playwright');
const APP = 'http://localhost:4173';
const MSG = 'Uma ajudinha na rotina com o bebê 💜 Conheça a Ninhora para registrar mamadas, sono, fraldas e organizar lembretes.';
(async () => {
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const mk = async (init, perms = false) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: 'pt-BR' });
    if (perms) await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP });
    if (init) await ctx.addInitScript(init);
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
    await p.goto(APP + '/app/'); await p.getByText('Pular tudo').click({ timeout: 4000 }); await p.locator('.install-pop >> text=Agora não').click({ timeout: 2500 }).catch(() => {});
    await p.waitForSelector('.actions');
    // dados pessoais que NUNCA podem sair no compartilhamento
    await p.evaluate(() => new Promise((res) => { const r = indexedDB.open('rotininha'); r.onsuccess = () => { const tx = r.result.transaction('meta', 'readwrite'); const s = tx.objectStore('meta'); s.put({ key: 'pref:profileBaby', value: 'Theo' }); s.put({ key: 'pref:profileMom', value: 'Ana' }); s.put({ key: 'session', value: { accessToken: 'TOKEN-SECRETO', refreshToken: 'REFRESH-SECRETO' } }); tx.oncomplete = res; }; }));
    await p.reload(); await p.waitForSelector('.actions'); await p.waitForTimeout(500);
    await p.click('[aria-label="Ajustes"]');
    return p;
  };

  // 1) compartilhamento nativo
  const N = await mk(() => { window.__shared = []; navigator.share = async (d) => { window.__shared.push(d); }; });
  const t = await N.locator('.sheet').innerText();
  ok(/Sobre a Ninhora/.test(t) && /Compartilhar a Ninhora/.test(t), 'seção "Sobre a Ninhora" com a linha "Compartilhar a Ninhora"');
  const heads = await N.locator('.group-title').allInnerTexts(); ok(heads.indexOf('Sobre a Ninhora') > heads.indexOf('Sugestões') && heads.indexOf('Sobre a Ninhora') === heads.length - 1, 'fica perto do final, depois de Sugestões');
  ok(await N.locator('.share-row svg').count() === 1, 'linha com ícone');
  ok(await N.locator('.install-pop, .nudge, [aria-label="Falta pouco"]').count() === 0 && await N.evaluate(() => (window.__shared ?? []).length) === 0, 'nada é compartilhado nem aparece sozinho (sem pop-up, banner ou pedido automático)');
  await N.getByRole('button', { name: /Compartilhar a Ninhora/ }).click(); await N.waitForTimeout(300);
  const d = (await N.evaluate(() => window.__shared))[0];
  ok(d && d.text === MSG, 'mensagem sugerida exata');
  const u = new URL(d.url);
  ok(u.origin === APP && u.pathname === '/' && !u.hash && [...u.searchParams.keys()].sort().join() === 'utm_medium,utm_source', 'link é só a página pública (origem do app) com marcação de origem: ' + d.url);
  ok(!/Theo|Ana|TOKEN|REFRESH|code|codigo|senha|hh|household|device|whatsapp/i.test(JSON.stringify(d).replace(/utm_(source|medium)/g, '')), 'o conteúdo compartilhado não tem dados de conta, código, senha, nomes nem tokens');
  ok(await N.locator('.sheet .err, [role=alert]').count() === 0, 'sem mensagem de erro');
  // o link abre a apresentação pública
  const page = await (await fetch(d.url)).text();
  ok(/Ninhora/.test(page) && /Grátis no lançamento/.test(page) && !/TOKEN-SECRETO|Theo/.test(page), 'o link abre a apresentação pública da Ninhora (sem dados da conta)');
  ok(!(await N.getByRole('button', { name: 'Copiar link' }).count()), 'com compartilhamento nativo, não mostra o "Copiar link" à toa');

  // 2) cancelar não gera erro
  const C = await mk(() => { navigator.share = async () => { const e = new Error('cancelado'); e.name = 'AbortError'; throw e; }; });
  await C.getByRole('button', { name: /Compartilhar a Ninhora/ }).click(); await C.waitForTimeout(400);
  ok(await C.locator('[role=alert], .err').count() === 0 && await C.getByRole('button', { name: 'Copiar link' }).count() === 0 && !/não deu|erro|falha/i.test(await C.locator('.sheet').innerText()), 'cancelar o compartilhamento não gera mensagem de erro');

  // 3) sem compartilhamento nativo: copiar link e confirmar
  const K = await mk(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); }, true);
  ok(await K.getByRole('button', { name: 'Copiar link' }).count() === 1, 'sem compartilhamento nativo: oferece "Copiar link"');
  await K.getByRole('button', { name: 'Copiar link' }).click();
  ok(await K.waitForFunction(() => /Link copiado/.test(document.querySelector('.sheet')?.innerText ?? ''), null, { timeout: 4000 }).then(() => true, () => false), 'confirma quando a cópia funciona');
  const clip = await K.evaluate(() => navigator.clipboard.readText());
  ok(new URL(clip).origin === APP && !/Theo|TOKEN/.test(clip), 'o link copiado é o público: ' + clip);

  // 4) cópia bloqueada: não finge sucesso
  const F = await mk(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('bloqueado'); } }, configurable: true }); });
  await F.getByRole('button', { name: 'Copiar link' }).click(); await F.waitForTimeout(400);
  ok(!/Link copiado/.test(await F.locator('.sheet').innerText()) && await F.locator('input[aria-label="Endereço para copiar"]').count() === 1, 'se a cópia falhar, não diz que copiou e mostra o endereço para copiar à mão');
  ok([N, C, K, F].every((p) => p.errs.length === 0), 'sem erros JS');
  await b.close();
})();
