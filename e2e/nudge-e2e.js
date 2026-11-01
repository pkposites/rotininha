const { chromium } = require('playwright');
const APP = 'http://localhost:4173';
(async () => {
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  const setPref = (k, v) => p.evaluate(([k, v]) => new Promise((res) => { const r = indexedDB.open('rotininha'); r.onsuccess = () => { const tx = r.result.transaction('meta', 'readwrite'); tx.objectStore('meta').put({ key: 'pref:' + k, value: v }); tx.oncomplete = res; }; }), [k, v]);
  const getPref = (k) => p.evaluate((k) => new Promise((res) => { const r = indexedDB.open('rotininha'); r.onsuccess = () => { const q = r.result.transaction('meta').objectStore('meta').get('pref:' + k); q.onsuccess = () => res(q.result?.value ?? null); }; }), k);
  const open = async () => { await p.goto(APP + '/app/'); await p.waitForSelector('.actions, .onb'); await p.waitForTimeout(1200); };

  await open(); await p.getByText('Pular tudo').click(); await p.locator('.install-pop >> text=Agora não').click({ timeout: 2500 }).catch(() => {});
  await p.waitForSelector('.actions');
  ok(await p.locator('[aria-label="Falta pouco"]').count() === 0, 'sem uso ainda e logo após o onboarding: não incomoda');
  await p.locator('.qa-mamada').click(); await p.waitForTimeout(500);

  // 1ª abertura com uso: ainda dentro do 1º dia → não aparece; depois de 1 dia → aparece
  await open();
  ok(await p.locator('[aria-label="Falta pouco"]').count() === 0, 'antes de 1 dia de uso: não aparece');
  await setPref('nudgeNextAt', Date.now() - 1000); await open();
  ok(await p.locator('[aria-label="Falta pouco"]').count() === 1, 'depois de 1 dia, sem conta: aparece o lembrete');
  const t = await p.locator('[aria-label="Falta pouco"]').innerText();
  ok(/Crie a sua conta grátis/.test(t) && /não consegue te avisar/.test(t) && /Instale o app na tela inicial/.test(t), 'explica a conta (e por que sem ela não há aviso) e a instalação');
  ok(await p.getByRole('button', { name: 'Não mostrar mais' }).count() === 0, '"Não mostrar mais" só depois de algumas vezes');
  await p.getByRole('button', { name: 'Agora não' }).click(); await p.waitForTimeout(400);
  ok(await getPref('nudgeDismissals') === 1 && (await getPref('nudgeNextAt')) > Date.now() + 1.5 * 86400000, 'Agora não: próxima vez em ~2 dias');
  await open(); ok(await p.locator('[aria-label="Falta pouco"]').count() === 0, 'não reaparece logo em seguida');

  // criar conta pelo lembrete
  await setPref('nudgeNextAt', Date.now() - 1000); await open();
  await p.locator('[aria-label="Falta pouco"] >> text=Criar conta').click(); await p.waitForTimeout(600);
  ok(await p.locator('[aria-label="Teste grátis"] input[type=tel]').count() === 1, '"Criar conta" abre o cadastro com WhatsApp e senha');
  await p.getByRole('button', { name: /Agora não/ }).last().click().catch(() => {});

  // instalar pelo lembrete
  await setPref('nudgeNextAt', Date.now() - 1000); await open();
  await p.locator('[aria-label="Falta pouco"] >> text=Ver como instalar').click(); await p.waitForTimeout(600);
  ok(await p.locator('.install-pop').count() === 1, '"Ver como instalar" abre o passo a passo com animação');
  await p.locator('.install-pop >> text=Já instalei').click(); await p.waitForTimeout(500);

  // só a conta falta (app instalado): mostra só ela; 4ª vez: opção de parar
  await setPref('nudgeDismissals', 3); await setPref('nudgeNextAt', Date.now() - 1000); await open();
  const t2 = await p.locator('[aria-label="Falta pouco"]').innerText();
  ok(/Crie a sua conta grátis/.test(t2) && !/Instale o app/.test(t2), 'com o app já instalado, mostra só a conta');
  ok(await p.getByRole('button', { name: 'Não mostrar mais' }).count() === 1, 'depois de 3 vezes: oferece "Não mostrar mais"');
  await p.getByRole('button', { name: 'Não mostrar mais' }).click(); await p.waitForTimeout(400);
  await setPref('nudgeNextAt', Date.now() - 1000); await open();
  ok(await p.locator('[aria-label="Falta pouco"]').count() === 0, 'escolha de não mostrar mais é respeitada');
  ok(p.errs.length === 0, 'sem erros JS ' + p.errs.join('|'));
  await b.close();
})();
