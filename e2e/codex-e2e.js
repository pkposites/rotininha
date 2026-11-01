const { chromium } = require('playwright');
const APP = 'http://localhost:4173';
(async () => {
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  p.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) p.errs.push(m.text()); });
  await p.goto(APP + '/app/'); await p.getByText('Pular tudo').click({ timeout: 4000 }); await p.locator('.install-pop >> text=Agora não').click({ timeout: 2500 }).catch(() => {});

  // Hoje: instalação + ajuda rápida
  ok(await p.locator('.install-card').count() === 1, 'convite de instalação (compacto) na tela Hoje');
  await p.getByRole('button', { name: 'Dispensar', exact: true }).click(); await p.waitForTimeout(600);
  await p.reload(); await p.waitForSelector('.actions'); await p.waitForTimeout(600);
  ok(await p.getByText('Leve o Ninhora para a tela inicial').count() === 0, '"Dispensar" dispensa o banner (lembrado)');
  ok(await p.getByText('Precisa de uma ajuda agora?').count() === 1, 'cartão de ajuda rápida');
  await p.getByRole('button', { name: 'Ver dicas práticas' }).click();

  // Guia de cuidado
  await p.waitForSelector('text=Guia de cuidado');
  ok(await p.getByRole('heading', { name: 'Guia de cuidado' }).count() === 1, 'abre o Guia de cuidado');
  await p.locator('.tip >> nth=0').locator('summary').click();
  const t0 = await p.locator('.tip >> nth=0').innerText();
  ok(/não ofereça água a bebês menores de 6 meses/.test(t0) && /Por que isso importa/.test(t0), 'dica da água com cuidado sobre bebês < 6 meses');
  await p.locator('.tip >> nth=2').locator('summary').click();
  ok(/Nunca sacuda o bebê/.test(await p.locator('.tip >> nth=2').innerText()), 'dica do bebê agitado: nunca sacudir');
  ok(/192 \(SAMU\)/.test(await p.locator('[aria-label="Quando buscar ajuda"]').innerText()), '"Quando buscar ajuda" com SAMU');
  await p.getByRole('button', { name: 'Preparar lembrete de água' }).click();
  ok(await p.locator('.sheet').count() === 1 && (await p.locator('.sheet input').first().inputValue()) === 'Beber água', 'abre lembrete editável (nada criado automaticamente)');
  await p.locator('.sheet >> text=Cancelar').click();

  // Sons
  await p.locator('.tab:has-text("Sons")').click();
  const st = await p.locator('main').innerText();
  ok(/Antes de dar o play/.test(st) && /fora do berço/.test(st) && /Sem fones no bebê/.test(st), 'aviso de segurança antes do play');
  ok(await p.locator('.card.sound').count() === 8, '3 sons de natureza + 5 sintetizados');
  const r = await p.request.get(APP + '/audio/riacho.mp3'); ok(r.status() === 200 && /audio\/mpeg/.test(r.headers()['content-type']), 'arquivo de áudio servido (audio/mpeg)');
  await p.getByRole('button', { name: /Favoritar: Riacho/ }).click();
  ok(await p.getByRole('button', { name: /Meus favoritos \(1\)/ }).count() === 1, 'favoritar atualiza o contador');
  await p.getByRole('button', { name: /Meus favoritos/ }).click();
  ok(await p.locator('.card.sound').count() === 1, 'filtro de favoritos mostra só o favorito');
  await p.getByRole('button', { name: 'Todos os sons' }).click();
  await p.locator('summary:has-text("Créditos e licença")').click();
  const cr = await p.locator('.credits').innerText();
  ok(/gluckose/.test(cr) && /felix\.blume/.test(cr) && /kvgarlic/.test(cr) && /CC0/.test(cr), 'créditos e licença CC0 dos áudios');
  await p.locator('.card.sound >> nth=0').click(); await p.waitForTimeout(1500);
  ok(await p.locator('.player').count() === 1 && !(await p.locator('.err').count()), 'toca o Riacho (arquivo real) sem erro');
  const vol = await p.inputValue('input[type=range]'); ok(vol === '0.15', 'volume inicial 15%');
  ok(await p.locator('.player .chip').allInnerTexts().then((a) => a.slice(0, 3).join('|') === '5 min|15 min|30 min'), 'temporizador 5/15/30 min');
  ok(p.errs.length === 0, 'sem erros JS/CSP ' + p.errs.join('|'));
  await b.close();
})();
