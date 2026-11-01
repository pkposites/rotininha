const { chromium } = require('playwright');
const API = 'http://localhost:8787', APP = 'http://localhost:4173';
(async () => {
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: 'pt-BR', acceptDownloads: true });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  p.w = (f, arg, t = 8000) => p.waitForFunction(f, arg, { timeout: t }).then(() => true, () => false);
  await p.goto(APP + '/app/'); await p.getByText('Pular tudo').click({ timeout: 3000 });

  // sem conexão: só apagar neste aparelho
  await p.click('[aria-label="Ajustes"]');
  ok(!(await p.locator('.sheet').innerText()).includes('Baixar meus dados'), 'sem conta conectada: não oferece baixar da nuvem');
  await p.click('.sheet >> text=Fechar');

  const { code } = await (await fetch(API + '/v1/dev/households', { method: 'POST' })).json();
  await p.click('[aria-label="Ajustes"]'); await p.fill('input[placeholder^="XXXXX"]', code); await p.click('text=Conectar');
  await p.w(() => document.querySelector('.sheet [role=status]')?.innerText.includes('Sincronizado'));
  await p.click('.sheet >> text=Fechar');
  await p.click('.actions >> text=Mamou'); await p.waitForTimeout(1500);

  // baixar
  await p.click('[aria-label="Ajustes"]');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('text=Baixar meus dados')]);
  const body = JSON.parse(require('fs').readFileSync(await dl.path(), 'utf8'));
  ok(/^rotininha-meus-dados-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), 'arquivo com nome datado: ' + dl.suggestedFilename());
  ok(Array.isArray(body.registros) && body.registros.some((r) => r.type === 'mamada'), 'cópia contém o registro feito');
  ok(!JSON.stringify(body).includes(code), 'cópia não contém o código de acesso');

  // apagar: pede confirmação
  await p.click('text=Apagar meus dados');
  const txt = await p.locator('[role=alertdialog]').innerText();
  ok(/não dá para desfazer/.test(txt) && /nuvem e neste aparelho/.test(txt), 'confirmação clara e irreversível');
  await p.click('text=Manter');
  ok(await p.locator('[role=alertdialog]').count() === 0, '"Manter" cancela');
  const still = await (await fetch(API + '/v1/sessions', { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '10.99.' + (Date.now() % 250) + '.1' }, body: JSON.stringify({ code, deviceId: 'devcheck12345' }) })).status;
  ok(still === 201, 'nada foi apagado ao cancelar');
  await p.click('text=Apagar meus dados'); await p.click('text=Sim, apagar tudo');
  ok(await p.w(() => document.querySelector('.onb'), null, 12000), 'depois de apagar o app recomeça do zero (onboarding)');
  const gone = await fetch(API + '/v1/sessions', { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '10.98.' + (Date.now() % 250) + '.1' }, body: JSON.stringify({ code, deviceId: 'devcheck67890' }) });
  ok(gone.status === 401, 'servidor: código não existe mais');
  const left = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open('rotininha'); r.onsuccess = () => { const db = r.result; const tx = db.transaction(['events', 'tasks', 'occs', 'meta']); const c = {}; let n = 0; for (const s of ['events', 'tasks', 'occs']) { const q = tx.objectStore(s).count(); q.onsuccess = () => { c[s] = q.result; if (++n === 3) res(c); }; } }; }));
  ok(left.events === 0 && left.tasks === 0 && left.occs === 0, 'armazenamento local zerado ' + JSON.stringify(left));
  ok(p.errs.length === 0, 'sem erros JS ' + p.errs.join('|'));
  await b.close();
})();
