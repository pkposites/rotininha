const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const mk = async () => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    const p = await ctx.newPage(); p.errs = [];
    p.on('pageerror', (e) => p.errs.push(e.message));
    await p.goto('http://localhost:4173/app/'); await p.getByText('Pular tudo').click({ timeout: 2500 }).catch(() => {}); await p.locator('.install-pop >> text=Agora não').click({ timeout: 2500 }).catch(() => {});
    p.w = (f, arg, t = 8000) => p.waitForFunction(f, arg, { timeout: t }).then(() => true, () => false);
    p.ctx = ctx;
    return p;
  };
  const connect = async (p, code) => {
    await p.click('[aria-label="Ajustes"]');
    await p.getByRole('button', { name: 'Entrar com código de acesso' }).click(); await p.fill('input[placeholder^="XXXXX"]', code);
    await p.click('text=Conectar');
    const done = await p.w(() => document.querySelector('.sheet [role=status]')?.innerText.includes('Sincronizado'));
    await p.click('.sheet >> text=Fechar');
    return done;
  };
  const syncNow = async (p) => { await p.click('[aria-label="Ajustes"]'); await p.click('text=Sincronizar agora'); await p.waitForTimeout(1500); await p.click('.sheet >> text=Fechar'); };
  const newTask = async (p, { title, time, cat, quietConfirm }) => {
    await p.click('.pill');
    await p.fill('input[placeholder="Ex.: Hora do banho"]', title);
    if (cat) await p.selectOption('select >> nth=0', cat);
    await p.fill('input[type=time]', time);
    if (quietConfirm) await p.check('.note-quiet input');
    await p.click('button[type=submit]');
  };

  const A = await mk();
  // 1) criar lembrete (horário já passado hoje → aparece como "ainda não registrado", tom neutro)
  await newTask(A, { title: 'Banho do bebê', time: '00:01' });
  ok(await A.w(() => document.querySelector('.rem')?.innerText.includes('Banho do bebê')), 'lembrete criado aparece em Hoje');
  ok(await A.locator('.late-tag').count() === 1, 'passado e pendente: "ainda não registrado" (sem culpa)');
  ok(!(await A.locator('.err').count()), 'sem alerta vermelho de erro');

  // 2) validação
  await A.click('.pill'); await A.click('button[type=submit]');
  ok(await A.locator('input:invalid').count() >= 1 || await A.locator('.err').count() === 1, 'nome vazio não salva');
  await A.click('.sheet >> text=Cancelar');

  // 3) confirmação de silêncio 22h–6h
  await A.click('.pill');
  await A.fill('input[placeholder="Ex.: Hora do banho"]', 'Mamada da noite');
  await A.fill('input[type=time]', '23:30');
  ok(await A.locator('.note-quiet').count() === 1, 'horário no silêncio pede confirmação explícita');
  ok((await A.locator('.sheet').innerText()).includes('não toca nesse horário'), 'avisa que sem confirmação não toca');
  await A.fill('input[type=time]', '19:00');
  ok(await A.locator('.note-quiet').count() === 0, 'confirmação some fora do silêncio');
  await A.click('.sheet >> text=Cancelar');

  // 4) lembrete de remédio mostra aviso e não pede dose
  await A.click('.pill'); await A.selectOption('select >> nth=0', 'remedio');
  ok((await A.locator('.sheet').innerText()).includes('orientação de profissional de saúde'), 'remédio: aviso de orientação profissional');
  ok(!(await A.locator('.sheet').innerText()).toLowerCase().includes('dose:'), 'remédio: sem campo de dose');
  await A.click('.sheet >> text=Cancelar');

  // 5) concluir com 1 toque
  await A.click('.done-btn');
  ok(await A.w(() => document.querySelector('.rem.handled')), 'Feito em 1 toque');
  ok(await A.locator('.late-tag').count() === 0, 'concluído não é mais "ainda não registrado"');

  // 6) deep link da notificação abre a ação mas NÃO conclui sozinho
  await A.click('.rem-main'); await A.click('.sheet >> text=Desfazer');
  await A.waitForTimeout(300);
  const id = await A.evaluate(() => new Promise((res) => {
    const r = indexedDB.open('rotininha'); r.onsuccess = () => { const q = r.result.transaction('tasks').objectStore('tasks').getAll(); q.onsuccess = () => res(q.result[0].id); };
  }));
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).replace(/-/g, '');
  await A.goto('http://localhost:4173/app/?occ=' + id + '_' + today);
  ok(await A.w(() => document.querySelector('[role=dialog]')?.innerText.includes('Banho do bebê')), 'tocar na notificação abre o lembrete');
  ok((await A.locator('[role=dialog]').innerText()).includes('Feito') && !(await A.locator('[role=dialog]').innerText()).includes('· feito'), 'abrir não marca como feito');

  // 7) adiar
  await A.click('text=Adiar 15 min');
  ok(await A.w(() => document.querySelector('.rem')?.innerText.includes('adiado')), 'adiar 15 min');

  // 8) sincronização entre dois aparelhos
  const code = (await (await fetch('http://localhost:8787/v1/dev/households', { method: 'POST' })).json()).code;
  ok(await connect(A, code), 'A conecta');
  const B = await mk();
  ok(await connect(B, code), 'B conecta');
  ok(await B.w(() => document.querySelector('.rem')?.innerText.includes('Banho do bebê')), 'B recebe o lembrete criado em A');
  ok(await B.w(() => document.querySelector('.rem')?.innerText.includes('adiado')), 'B recebe o adiamento');
  await B.click('.done-btn');
  await B.waitForTimeout(1200);
  await syncNow(A);
  ok(await A.w(() => document.querySelector('.rem.handled')), '"Feito" em B aparece em A');

  // 9) Ajustes: situação honesta do push
  await A.click('[aria-label="Ajustes"]');
  const txt = await A.locator('.sheet').innerText();
  ok(txt.includes('Lembretes no aparelho') && txt.includes('não garante entrega'), 'Ajustes explica limites das notificações');
  await A.screenshot({ path: (process.argv[2] || '/tmp') + '/settings.png' });
  await A.click('.sheet >> text=Fechar');
  await A.screenshot({ path: (process.argv[2] || '/tmp') + '/hoje2.png' });

  ok(A.errs.length === 0 && B.errs.length === 0, 'sem erros JS ' + [...A.errs, ...B.errs].join('|'));
  await b.close();
})();
