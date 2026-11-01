const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const mk = async (opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', ...opts });
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
    p.w = (f, arg, t = 8000) => p.waitForFunction(f, arg, { timeout: t }).then(() => true, () => false);
    return p;
  };

  // ---------- onboarding completo ----------
  const A = await mk();
  await A.goto('http://localhost:4173/app/');
  ok(await A.w(() => document.querySelector('.onb')?.innerText.includes('Uma ajudinha')), 'onboarding abre na primeira vez');
  await A.click('text=Vamos lá');
  await A.click('.chip:has-text("4 a 6 meses")'); await A.click('text=Continuar');
  ok(await A.w(() => document.querySelector('.onb')?.innerText.includes('Como quer começar')), 'passo: modelo ou do zero');
  await A.click('text=Usar um modelo editável');
  ok((await A.locator('.onb').innerText()).includes('só exemplos para você ajustar'), 'aviso: horários são exemplos');
  ok(!/soneca|mamada|remédio/i.test(await A.locator('.tpl').innerText()), 'modelos sem soneca/mamada/remédio');
  await A.fill('.tpl input[type=time] >> nth=0', '18:45');
  await A.click('text=Criar lembretes');
  await A.waitForSelector('.onb .actions'); await A.click('.onb .actions >> text=Fralda');
  ok(await A.w(() => document.querySelector('.onb .toast')), 'primeiro registro em 1 toque');
  await A.click('.onb >> text=Continuar');
  ok(await A.w(() => document.querySelector('.onb')?.innerText.includes('Acesso grátis no lançamento')), 'passo da conta grátis (explica o que é grátis e o aviso antes de cobrar)');
  ok(/Sem cartão|sem cartão/.test(await A.locator('.onb').innerText()) && /avisamos/i.test(await A.locator('.onb').innerText()), 'teste: sem cartão e com aviso antes');
  await A.click('text=Agora não');
  ok(await A.w(() => document.querySelector('.onb .install')), 'orientação de instalação');
  ok((await A.locator('.onb').innerText()).includes('dependem da instalação'), 'aviso honesto sobre notificações');
  await A.click('text=Concluir');
  ok(await A.w(() => !document.querySelector('.onb')), 'onboarding fecha');
  ok(await A.w(() => document.querySelector('.rem')?.innerText.includes('18:45')), 'modelo criou lembrete com horário ajustado');
  ok(await A.w(() => document.querySelectorAll('.last')[2].innerText.includes('há')), 'primeiro registro aparece em Hoje');
  await A.reload();
  await A.waitForTimeout(800);
  ok(await A.locator('.onb').count() === 0, 'não reaparece depois de concluído');

  // ---------- pular tudo ----------
  const P = await mk();
  await P.goto('http://localhost:4173/app/');
  await P.click('text=Pular tudo');
  ok(await P.w(() => !document.querySelector('.onb') && document.querySelector('.actions')), 'pular tudo vai direto para o app');
  ok((await P.locator('.rem, .timeline li').count()) === 0, 'nenhum dado criado ao pular');

  // ---------- instalação dentro do Instagram ----------
  const I = await mk({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Mobile/15E148 Instagram 300.0' });
  await I.goto('http://localhost:4173/app/');
  await I.click('text=Vamos lá'); await I.click('text=Prefiro não informar'); await I.click('text=Começar do zero'); await I.getByRole('button', { name: 'Depois', exact: true }).click(); await I.click('text=Agora não');
  ok(await I.w(() => document.querySelector('.onb .install')?.dataset.advice === 'in-app'), 'navegador do Instagram: orienta abrir no navegador');
  ok((await I.locator('.onb .install').innerText()).includes('Abrir no navegador'), 'texto "Abrir no navegador"');
  await I.screenshot({ path: (process.argv[2] || '/tmp') + '/instagram.png' });
  const S = await mk({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Version/17.0 Mobile/15E148 Safari/604.1' });
  await S.goto('http://localhost:4173/app/');
  await S.click('text=Vamos lá'); await S.click('text=Prefiro não informar'); await S.click('text=Começar do zero'); await S.getByRole('button', { name: 'Depois', exact: true }).click(); await S.click('text=Agora não');
  await S.w(() => document.querySelector('.onb .install'));
  ok((await S.locator('.onb .install').innerText()).includes('Adicionar à Tela de Início'), 'iPhone/Safari: Adicionar à Tela de Início');

  // ---------- guia ----------
  const G = await A; // reutiliza o contexto (dados locais)
  await G.click('.tab:has-text("Guia")'); await G.getByRole('button', { name: 'Percurso de 7 dias' }).click();
  ok(await G.w(() => document.querySelector('main')?.innerText.includes('Rotina e Sono em 7 Dias')), 'aba Guia');
  ok((await G.locator('main').innerText()).includes('Versão preliminar'), 'aviso de conteúdo em revisão');
  ok((await G.locator('.lesson-item:not([disabled])').count()) === 1, 'só a lição 1 liberada no dia 1');
  ok((await G.locator('.lesson-item[disabled]').count()) === 6, 'demais lições bloqueadas até o dia certo');
  await G.click('.lesson-item:not([disabled])');
  ok((await G.locator('.lesson').innerText()).includes('rotina flexível'), 'lição 1');
  await G.click('text=Escolher meu marco do dia');
  ok(await G.w(() => document.querySelector('[role=dialog]')?.innerText.includes('Novo lembrete')), 'ação da lição abre lembrete pré-preenchido');
  ok((await G.inputValue('input[placeholder="Ex.: Hora do banho"]')) === 'Meu marco do dia', 'campos preenchidos');
  await G.click('.sheet >> text=Cancelar');
  await G.click('text=Marcar lição como concluída');
  ok(await G.locator('text=✓ Lição concluída').count() === 1, 'marcar concluída');
  await G.click('text=← Todas as lições');
  ok((await G.locator('.lesson-item .ico').first().innerText()) === '✓', 'lição concluída aparece com ✓');

  // avançar o relógio: dia 4 (sono seguro)
  await G.clock.install({ time: Date.now() + 3 * 86400000 }).catch(() => {});
  await G.reload(); await G.waitForTimeout(500);
  await G.click('.tab:has-text("Guia")'); await G.getByRole('button', { name: 'Percurso de 7 dias' }).click();
  ok(await G.w(() => document.querySelectorAll('.lesson-item:not([disabled])').length === 4, null, 4000), 'no 4º dia, 4 lições liberadas');
  await G.click('.lesson-item >> nth=3');
  const t4 = await G.locator('.lesson').innerText();
  ok(/barriga para cima/.test(t4) && /Sociedade Brasileira de Pediatria/.test(t4) && /objetos|travesseiros/.test(t4), 'sono seguro: SBP, barriga para cima, sem objetos soltos');
  await G.check('.lesson .inline input >> nth=0'); await G.waitForTimeout(600);
  await G.reload(); await G.click('.tab:has-text("Guia")'); await G.getByRole('button', { name: 'Percurso de 7 dias' }).click(); await G.click('.lesson-item >> nth=3');
  ok(await G.locator('.lesson .inline input >> nth=0').isChecked(), 'checklist persiste');
  await G.screenshot({ path: (process.argv[2] || '/tmp') + '/guia.png' });
  ok(!/dormirá|dorme a noite toda|garantid|cura/i.test(await G.locator('main').innerText()), 'sem promessas médicas');

  ok([A, P, I, S].every((x) => x.errs.length === 0), 'sem erros JS ' + [A, P, I, S].flatMap((x) => x.errs).join('|'));
  await b.close();
})();
