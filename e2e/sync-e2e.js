const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const mk = async () => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, locale: 'pt-BR' });
    const p = await ctx.newPage(); p.errs = [];
    p.on('pageerror', (e) => p.errs.push(e.message));
    await p.goto('http://localhost:4173/app/'); await p.getByText('Pular tudo').click({ timeout: 2500 }).catch(() => {}); await p.locator('.install-pop >> text=Agora não').click({ timeout: 2500 }).catch(() => {});
    p.w = (f, arg, t = 8000) => p.waitForFunction(f, arg, { timeout: t }).then(() => true, () => false);
    p.ctx = ctx;
    return p;
  };
  const connect = async (p, code) => {
    await p.click('[aria-label="Ajustes"]');
    await p.getByRole('button', { name: 'Tenho um código de acesso (conta antiga)' }).click(); await p.fill('input[placeholder^="XXXXX"]', code);
    await p.click('text=Conectar');
    const done = await p.w(() => document.querySelector('.sheet [role=status]')?.innerText.includes('Sincronizado'));
    await p.click('text=Fechar');
    return done;
  };
  const tl = (p) => p.evaluate(() => [...document.querySelectorAll('.timeline li')].map((l) => l.innerText.replace(/\s+/g, ' ')));
  const hist = async (p) => { await p.click('.tab:has-text("Histórico")'); await p.waitForTimeout(300); };

  const code = (await (await fetch('http://localhost:8787/v1/dev/households', { method: 'POST' })).json()).code;

  const A = await mk();
  await A.click('.actions >> text=Mamou');
  await A.w(() => document.querySelector('.toast'));
  await A.waitForTimeout(500);
  await A.click('[aria-label="Ajustes"]');
  await A.getByRole('button', { name: 'Tenho um código de acesso (conta antiga)' }).click(); await A.fill('input[placeholder^="XXXXX"]', 'AAAAA-AAAAA-AAAAA-AAAAA');
  await A.click('text=Conectar');
  ok(await A.w(() => document.querySelector('.sheet .err')?.innerText.includes('Código não encontrado')), 'código errado mostra erro');
  await A.click('text=Fechar');

  // login correto
  ok(await connect(A, code), 'A conecta e sincroniza o registro feito antes de conectar');

  const B = await mk();
  ok(await connect(B, code), 'B conecta com o mesmo código');
  await hist(B);
  ok((await tl(B)).some((t) => t.includes('Mamada')), 'B recebe a mamada feita em A');

  // B registra fralda → A recebe sem ação (sync por intervalo/visibilidade: força)
  await B.click('.tab:has-text("Hoje")'); await B.click('.actions >> text=Fralda');
  await B.w(() => document.querySelector('.toast'));
  await B.waitForTimeout(1500);
  await A.click('[aria-label="Ajustes"]'); await A.click('text=Sincronizar agora'); await A.waitForTimeout(1200); await A.click('text=Fechar');
  await hist(A);
  ok((await tl(A)).some((t) => t.includes('Fralda')), 'A recebe a fralda feita em B');

  // exclusão em A propaga para B
  await A.click('.row-btn >> nth=0'); await A.click('text=Excluir registro'); await A.click('text=Confirmar exclusão');
  await A.waitForTimeout(1500);
  const countB0 = (await tl(B)).length;
  await B.click('[aria-label="Ajustes"]'); await B.click('text=Sincronizar agora'); await B.waitForTimeout(1200); await B.click('text=Fechar');
  await hist(B);
  ok((await tl(B)).length === (await tl(A)).length && (await tl(A)).length === 1, 'exclusão em A propaga para B (1 item em ambos)');

  // offline em B: registra, volta online, A recebe uma vez só
  await B.ctx.setOffline(true);
  await B.click('.tab:has-text("Hoje")'); await B.click('.actions >> text=Mamou');
  await B.w(() => document.querySelector('.toast'));
  ok(true, 'B registra offline');
  await B.ctx.setOffline(false);
  await B.evaluate(() => window.dispatchEvent(new Event('online')));
  await B.waitForTimeout(2000);
  await A.click('[aria-label="Ajustes"]'); await A.click('text=Sincronizar agora'); await A.waitForTimeout(1200); await A.click('text=Fechar');
  await hist(A);
  ok((await tl(A)).length === 2, 'registro offline chega a A sem duplicar (2 itens)');

  // sair deste aparelho mantém dados locais
  await A.click('[aria-label="Ajustes"]'); await A.click('text=Sair deste aparelho');
  ok(await A.w(() => document.querySelector('.sheet')?.innerText.includes('não está conectado')), 'logout');
  await A.click('text=Fechar'); await hist(A);
  ok((await tl(A)).length === 2, 'dados locais permanecem após sair');

  ok(A.errs.length === 0 && B.errs.length === 0, 'sem erros JS ' + [...A.errs, ...B.errs].join('|'));
  await b.close();
})();
