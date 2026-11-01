const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, locale: 'pt-BR' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:4173/app/'); await p.getByText('Pular tudo').click({ timeout: 2500 }).catch(() => {}); await p.locator('.install-pop >> text=Agora não').click({ timeout: 2500 }).catch(() => {});
  const w = (f, arg) => p.waitForFunction(f, arg, { timeout: 2500 }).then(() => true, () => false);
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

  ok(await p.locator('.last').first().isDisabled(), 'estado vazio: cartões desabilitados');
  await p.click('.actions >> text=Mamou');
  ok(await w(() => document.querySelector('.toast')?.innerText.includes('Mamada registrada')), 'mamada em 1 toque');
  await p.click('.actions >> text=Dormiu');
  ok(await w(() => document.querySelector('.actions').innerText.includes('Acordou')), 'botão vira Acordou');
  ok(await w(() => document.querySelectorAll('.last')[1].innerText.includes('Dormindo')), 'cartão mostra Dormindo');
  await p.waitForTimeout(1700); // fora da janela de toque duplo
  await p.click('.actions >> text=Acordou');
  ok(await w(() => document.querySelector('.actions').innerText.includes('Dormiu')), 'Acordou fecha o sono');
  await p.click('.actions >> text=Fralda');
  await w(() => document.querySelector('.toast')?.innerText.includes('Fralda'));
  await p.reload();
  ok(await w(() => /\d{2}:\d{2}/.test(document.querySelectorAll('.last')[0].innerText)), 'persiste após reload');

  await p.click('.last >> nth=0');
  await p.fill('textarea', 'mamou bem'); await p.click('text=Salvar');
  await p.click('.tab:has-text("Histórico")');
  ok(await w(() => document.querySelector('.timeline')?.innerText.includes('mamou bem')), 'edição aparece no histórico');
  await p.click('.chip:has-text("Fralda")');
  ok(await w(() => document.querySelectorAll('.timeline li').length === 1), 'filtro por tipo ' + await p.locator('main').innerText().then(t=>t.replace(/\n+/g,' | ')));
  await p.click('.chip:has-text("Todos")');
  const before = await p.locator('.timeline li').count();
  await p.click('.row-btn >> nth=0'); await p.click('text=Excluir registro'); await p.click('text=Confirmar exclusão');
  ok(await w((n) => document.querySelectorAll('.timeline li').length === n, before - 1), 'exclusão');

  await ctx.setOffline(true);
  await p.click('.tab:has-text("Hoje")'); await p.click('.actions >> text=Fralda');
  ok(await w(() => document.querySelector('.toast')?.innerText.includes('Fralda')), 'registra offline');
  ok(errs.length === 0, 'sem erros JS ' + errs.join('|'));
  await p.screenshot({ path: (process.argv[2] || '/tmp') + '/hoje.png' });
  await b.close();
})();
