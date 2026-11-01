const { chromium } = require('playwright');
const APP = 'http://localhost:4173';
(async () => {
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: 'pt-BR' });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  const sent = []; p.on('request', (q) => { if (q.method() === 'POST' && /8787/.test(q.url())) sent.push(q.postData() ?? ''); });
  await p.goto(APP + '/app/'); await p.getByText('Pular tudo').click(); await p.locator('.install-pop >> text=Agora não').click({ timeout: 2500 }).catch(() => {});
  await p.waitForSelector('.actions');
  ok(/O que o bebê acabou de fazer\?/.test(await p.locator('.quick-intro').innerText()), 'sem nome do bebê: texto padrão');

  await p.click('[aria-label="Ajustes"]');
  await p.getByRole('button', { name: 'Criar conta grátis' }).click();
  await p.click('[aria-label="Teste grátis"] summary:has-text("Personalizar")');
  await p.fill('[aria-label="Teste grátis"] input[autocomplete=given-name]', '  Ana   Paula ');
  await p.fill('[aria-label="Teste grátis"] input[autocomplete=off]', 'Theo');
  ok(/ficam apenas neste aparelho/.test(await p.locator('[aria-label="Teste grátis"]').innerText()), 'explica que os nomes ficam só no aparelho');
  await p.fill('[aria-label="Teste grátis"] input[type=tel]', `(11) 9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0').replace(/^(\d{4})(\d{4})$/, '$1-$2')}`);
  await p.fill('[aria-label="Teste grátis"] input[autocomplete=new-password]', 'senha de teste 2026');
  await p.getByRole('button', { name: 'Criar conta e continuar' }).click();
  await p.waitForSelector('text=Conta criada'); await p.getByRole('button', { name: 'Entendi, continuar' }).click();
  await p.waitForTimeout(700);
  ok(/Ana Paula!/.test(await p.locator('.greet h1').innerText()), 'saudação com o nome: ' + (await p.locator('.greet h1').innerText()));
  ok(/Cuidados de Theo/.test(await p.locator('.quick-intro').innerText()), 'título com o nome do bebê');
  await p.reload(); await p.waitForSelector('.actions'); await p.waitForTimeout(600);
  ok(/Ana Paula!/.test(await p.locator('.greet h1').innerText()) && /Cuidados de Theo/.test(await p.locator('.quick-intro').innerText()), 'nomes persistem ao recarregar');

  // editar depois, em Ajustes
  await p.click('[aria-label="Ajustes"]');
  await p.fill('.sheet input[autocomplete=given-name]', 'Ana'); await p.fill('.sheet input[placeholder="opcional"]', 'Maria Clara');
  await p.getByRole('button', { name: 'Salvar nomes' }).click();
  await p.locator('.sheet >> text=Fechar').click(); await p.waitForTimeout(900);
  ok(/Ana!/.test(await p.locator('.greet h1').innerText()) && /Cuidados de Maria Clara/.test(await p.locator('.quick-intro').innerText()), 'edição em Ajustes atualiza a tela na hora');

  // privacidade: nenhum nome foi enviado ao servidor
  await p.locator('.qa-mamada').click(); await p.waitForTimeout(2500);
  ok(sent.length > 0 && sent.every((s) => !/Theo|Maria Clara|Ana/.test(s)), 'nenhuma requisição ao servidor contém os nomes (' + sent.length + ' conferidas)');

  // apagar dados remove os nomes
  await p.click('[aria-label="Ajustes"]'); await p.getByText('Apagar meus dados').click(); await p.getByRole('button', { name: 'Sim, apagar tudo' }).click();
  await p.waitForSelector('.onb', { timeout: 15000 });
  const left = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open('rotininha'); r.onsuccess = () => { const q = r.result.transaction('meta').objectStore('meta').getAll(); q.onsuccess = () => res(JSON.stringify(q.result)); }; }));
  ok(!/Theo|Maria Clara|Ana/.test(left), 'apagar os dados também apaga os nomes do aparelho');
  ok(p.errs.length === 0, 'sem erros JS ' + p.errs.join('|'));
  await b.close();
})();
