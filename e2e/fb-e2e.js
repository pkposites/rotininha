const { chromium } = require('playwright');
const API = 'http://localhost:8787', APP = 'http://localhost:4173';
const ADMIN = 'admin-token-local-de-teste-1234567890';
(async () => {
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  p.w = (f, arg, t = 8000) => p.waitForFunction(f, arg, { timeout: t }).then(() => true, () => false);
  await p.goto(APP + '/app/');
  await p.getByText('Pular tudo').click({ timeout: 3000 }); await p.locator('.install-pop >> text=Agora não').click({ timeout: 2500 }).catch(() => {});

  // Poucos dados: sem cartão mesmo registrando
  await p.click('.actions >> text=Mamou'); await p.waitForTimeout(500);
  ok(await p.locator('.feedback-card').count() === 0, 'sem cartão com pouco uso');

  // semeia 3 dias distintos e 5 registros (via IndexedDB) e recarrega
  await p.evaluate(() => new Promise((res, rej) => {
    const r = indexedDB.open('rotininha');
    r.onsuccess = () => {
      const tx = r.result.transaction('events', 'readwrite'); const s = tx.objectStore('events');
      const day = 86400000;
      for (let i = 1; i <= 4; i++) s.put({ id: 'seed' + i + 'abcdefgh', type: 'fralda', startedAt: Date.now() - i * day, endedAt: null, note: '', detail: '', updatedAt: Date.now(), dirty: false });
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    };
  }));
  await p.reload(); await p.waitForTimeout(600);
  ok(await p.locator('.feedback-card').count() === 0, 'elegível mas sem registrar nesta sessão: nada');
  await p.click('.actions >> text=Fralda');
  ok(await p.w(() => document.querySelector('.feedback-card')), 'cartão aparece depois de registrar um cuidado');
  const card = await p.locator('.feedback-card').innerText();
  ok(card.includes('Mamãe, o que deixaria sua rotina mais leve?') && card.includes('Dar uma sugestão') && card.includes('Agora não'), 'texto do cartão');
  ok(!/obrigatóri|nota|indique/i.test(card), 'sem nota/indicação');

  // modo madrugada: não mostra
  await p.click('[aria-label="Ativar modo madrugada"]');
  ok(await p.w(() => !document.querySelector('.feedback-card')), 'modo madrugada esconde o cartão');
  await p.click('[aria-label="Desativar modo madrugada"]');
  ok(await p.w(() => document.querySelector('.feedback-card')), 'volta ao sair do modo madrugada');

  // outra aba: não mostra
  await p.click('.tab:has-text("Histórico")');
  ok(await p.locator('.feedback-card').count() === 0, 'só aparece na tela Hoje');
  await p.click('.tab:has-text("Hoje")');

  // Agora não → some e não volta no recarregamento
  await p.click('.feedback-card >> text=Agora não');
  ok(await p.w(() => !document.querySelector('.feedback-card')), '"Agora não" fecha com um toque');
  await p.reload(); await p.waitForTimeout(500); await p.click('.actions >> text=Fralda'); await p.waitForTimeout(600);
  ok(await p.locator('.feedback-card').count() === 0, 'não reaparece por 7 dias');

  // Ajustes → Enviar sugestão sempre disponível; sem conexão avisa
  await p.click('[aria-label="Ajustes"]'); await p.click('text=Enviar sugestão');
  ok(await p.w(() => document.querySelector('[role=dialog]')?.innerText.includes('O que deixaria sua rotina mais leve')), 'formulário em Ajustes');
  const f = await p.locator('[role=dialog]').innerText();
  ok(f.includes('Não envie nomes, informações médicas ou dados pessoais do bebê'), 'aviso de privacidade');
  ok(f.includes('Lembretes') && f.includes('Registros') && f.includes('Compartilhar cuidados') && f.includes('Outros'), 'categorias');
  await p.click('.chip:has-text("Lembretes")');
  await p.fill('textarea', 'Queria lembrete a cada duas horas, por favor ' + Date.now());
  const sent = (await p.inputValue('textarea'));
  await p.click('text=Enviar sugestão >> nth=-1');
  ok(await p.w(() => document.querySelector('[role=alert]')?.innerText.includes('Conecte')), 'sem conexão: orienta conectar (não perde o texto)');
  ok((await p.inputValue('textarea')) === sent, 'texto preservado');
  await p.click('text=Agora não');

  // conecta e envia
  const code = (await (await fetch(API + '/v1/dev/households', { method: 'POST' })).json()).code;
  await p.click('[aria-label="Ajustes"]'); await p.getByRole('button', { name: 'Tenho um código de acesso (conta antiga)' }).click(); await p.fill('input[placeholder^="XXXXX"]', code); await p.click('text=Conectar');
  await p.w(() => document.querySelector('.sheet [role=status]')?.innerText.includes('Sincronizado'));
  await p.click('.sheet >> text=Enviar sugestão');
  await p.click('.chip:has-text("Lembretes")'); await p.fill('textarea', sent);
  await p.click('button:has-text("Enviar sugestão")');
  ok(await p.w(() => document.querySelector('[role=dialog]')?.innerText.includes('Obrigada! 💜')), 'agradecimento');
  const thanks = await p.locator('[role=dialog]').innerText();
  ok(!/prometemos|responderemos|prazo|vamos implementar/i.test(thanks), 'sem promessa de implementação/resposta');
  await p.click('text=Fechar');
  const csv = await (await fetch(API + '/v1/admin/feedback.csv', { headers: { Authorization: 'Bearer ' + ADMIN } })).text();
  ok(csv.includes(sent.slice(0, 30)) && csv.includes('lembretes'), 'sugestão chegou à exportação administrativa');
  const m = await (await fetch(API + '/v1/admin/metrics', { headers: { Authorization: 'Bearer ' + ADMIN } })).json();
  const ev = Object.fromEntries(m.funnel.map((x) => [x.event, x.n]));
  ok(ev.feedback_submitted >= 1 && ev.feedback_card_shown >= 1 && ev.feedback_card_dismissed >= 1 && ev.feedback_eligible >= 1, 'métricas agregadas: elegíveis, exibidos, dispensados, enviados');

  ok(p.errs.length === 0, 'sem erros JS ' + p.errs.join('|'));
  await p.screenshot({ path: (process.argv[2] || '/tmp') + '/feedback.png' });
  await b.close();
})();
