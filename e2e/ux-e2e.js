const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const APP = 'http://localhost:4173', API = 'http://localhost:8787';
const STATE = process.env.D1_STATE || '/tmp/claude-0/d1state';
const sql = (q) => { const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'rotininha', '--local', '--persist-to', STATE, '--json', '--command', q], { encoding: 'utf8', cwd: __dirname + '/../apps/api', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } }); return JSON.parse(out.slice(out.indexOf('[')))[0].results; };
(async () => {
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  p.w = (f, arg, t = 8000) => p.waitForFunction(f, arg, { timeout: t }).then(() => true, () => false);
  const toastTxt = () => p.locator('.toast').innerText().catch(() => '');
  const mamadas = () => p.evaluate(() => new Promise((res) => { const r = indexedDB.open('rotininha'); r.onsuccess = () => { const q = r.result.transaction('events').objectStore('events').getAll(); q.onsuccess = () => res(q.result.filter((e) => e.type === 'mamada' && !e.deleted).length); }; }));

  // 1) primeiro acesso sem conta
  await p.goto(APP + '/app/'); await p.getByText('Pular tudo').click({ timeout: 4000 }); await p.locator('.install-pop >> text=Agora não').click({ timeout: 2500 }).catch(() => {}); await p.waitForSelector('.actions'); await p.waitForTimeout(600);
  ok(await p.getByText('Seus registros estão só neste aparelho').first().isVisible(), 'sem conta: aviso discreto de que os registros estão só no aparelho');
  ok(await p.locator('.install-card').count() === 1 && (await p.locator('.install-card').boundingBox()).height < 260, 'instalação aparece como convite compacto');
  const top = await p.locator('.install-card').boundingBox(); const rem = await p.locator('[aria-label="Próximos lembretes"]').boundingBox();
  ok(rem.y < top.y, 'lembretes vêm antes do convite de instalação');

  // 2) toque duplo + desfazer + editar
  await p.locator('.qa-mamada').dblclick();
  await p.waitForTimeout(500);
  ok(await mamadas() === 1, 'toque duplo cria só 1 mamada');
  ok(/^.*Mamada registrada às \d\d:\d\d/s.test(await toastTxt()), 'mensagem: "Mamada registrada às …"');
  await p.getByRole('button', { name: 'Desfazer' }).click(); await p.waitForTimeout(400);
  ok(await mamadas() === 0 && /Registro desfeito/.test(await toastTxt()), 'Desfazer remove o registro');
  await p.waitForTimeout(1700); await p.locator('.qa-mamada').click(); await p.waitForTimeout(300);
  await p.waitForTimeout(1700); await p.locator('.qa-mamada').click(); await p.waitForTimeout(300);
  ok(await mamadas() === 2, 'duas mamadas legítimas (com intervalo) são preservadas');
  await p.locator('.qa-sono').click(); await p.waitForTimeout(300);
  ok(/Soneca iniciada/.test(await toastTxt()) && !/Sono registrada/.test(await toastTxt()), 'concordância: "Soneca iniciada"');
  await p.getByRole('button', { name: 'Ajustar horário' }).click();
  ok(await p.locator('.sheet').count() === 1, 'ajustar horário abre a edição'); await p.locator('.sheet >> text=Cancelar').click();
  await p.locator('.last >> nth=0').click(); ok(await p.locator('.sheet').count() === 1, 'depois do aviso sumir, tocar no cartão ainda edita'); await p.locator('.sheet >> text=Cancelar').click();

  // 3) lembretes
  await p.getByRole('button', { name: /Novo/ }).click();
  await p.fill('input[placeholder="Ex.: Hora do banho"]', 'Teste banho'); await p.fill('input[type=time]', '12:00');
  ok(/só avisa por notificação depois que você ativar|aparece aqui no app|instale o app/i.test(await p.locator('.sheet').innerText()), 'formulário explica o estado real das notificações');
  await p.getByRole('button', { name: 'Salvar' }).click(); await p.waitForTimeout(500);
  await p.getByLabel('Marcar Teste banho como feito').click(); await p.waitForTimeout(400);
  const card = await p.locator('[aria-label="Próximos lembretes"]').innerText();
  ok(/Tudo feito por hoje/.test(card) && /amanhã às/.test(card), 'concluído sai de pendentes; mostra o próximo (amanhã)');
  ok(await p.locator('.handled-box').count() === 1 && /Já resolvidos hoje \(1\)/.test(card), 'concluído fica em "Já resolvidos hoje"');
  await p.locator('.handled-box .rem-main').click();
  ok(/feito hoje/.test(await p.locator('.sheet').innerText()), 'detalhe diz "feito hoje"');
  await p.getByRole('button', { name: /Desfazer/ }).click(); await p.waitForTimeout(400);
  ok(/hoje, 12:00/.test(await p.locator('[aria-label="Próximos lembretes"]').innerText()), 'desfazer volta o lembrete para pendente');
  await p.locator('.rem-main >> nth=0').click();
  const sh = await p.locator('.sheet').innerText();
  ok(/Adiar vale só para hoje/.test(sh) && /Mudar horário e repetição/.test(sh), 'adiar (só hoje) separado de mudar o horário recorrente');
  await p.getByRole('button', { name: 'Adiar 10 min' }).click(); await p.waitForTimeout(400);
  ok(/adiado só por hoje/.test(await p.locator('[aria-label="Próximos lembretes"]').innerText()), 'adiado aparece como "só por hoje"');

  // 4) sons + miniplayer
  await p.locator('.tab:has-text("Sons")').click();
  ok(/Volume baixo/.test(await p.locator('main').innerText()) && await p.locator('details.fold').count() === 1, 'segurança essencial visível; detalhes recolhidos');
  await p.locator('.card.sound >> nth=3').click(); await p.waitForTimeout(800);
  ok(await p.locator('.miniplayer').count() === 0, 'na aba Sons não duplica o controle');
  await p.locator('.tab:has-text("Hoje")').click();
  ok(await p.locator('.miniplayer').count() === 1 && /desliga em/.test(await p.locator('.miniplayer').innerText()), 'miniplayer aparece em outra aba com nome e tempo');
  const mp = await p.locator('.miniplayer').boundingBox(), tabs = await p.locator('.tabs').boundingBox();
  ok(mp.y + mp.height <= tabs.y + 1, 'miniplayer não sobrepõe a navegação');
  await p.locator('.tab:has-text("Sons")').click(); await p.locator('.card.sound >> nth=1').click(); await p.waitForTimeout(500);
  ok(await p.locator('.card.sound.on').count() === 1, 'só um som ativo ao trocar');
  await p.locator('.tab:has-text("Guia")').click();
  await p.getByRole('button', { name: 'Parar o som' }).click(); await p.waitForTimeout(400);
  ok(await p.locator('.miniplayer').count() === 0, 'parar pelo miniplayer');

  // 5) guia
  ok(await p.getByRole('button', { name: 'Ajuda agora' }).getAttribute('aria-pressed') === 'true', 'Guia abre em "Ajuda agora"');
  await p.getByRole('button', { name: 'Percurso de 7 dias' }).click();
  ok(/próxima libera no dia seguinte/.test(await p.locator('main').innerText()) && /Libera amanhã/.test(await p.locator('main').innerText()), 'percurso explica quando a próxima lição libera');

  // 6) instalação: dispensar persiste
  await p.locator('.tab:has-text("Hoje")').click();
  await p.locator('.install-card >> text=Ver como instalar').click(); ok(await p.locator('.install-pop').count() === 1, 'convite abre o pop-up com o passo a passo'); await p.locator('.install-pop >> text=Agora não').click(); await p.waitForTimeout(400);
  await p.getByRole('button', { name: 'Dispensar' }).click(); await p.waitForTimeout(700); await p.reload(); await p.waitForSelector('.actions'); await p.waitForTimeout(600);
  ok(await p.locator('.install-card').count() === 0, 'dispensa do convite de instalação persiste');

  // 7) criar conta com registros locais (sem perda nem duplicação)
  const before = await mamadas();
  await p.getByRole('button', { name: 'Criar conta' }).click();
  await p.click('.sheet summary:has-text("Sobre o acesso grátis")');
  const t = await p.locator('.sheet').innerText();
  ok(/não tem data para acabar/.test(t) && /pelo menos 7 dias de antecedência/.test(t) && !/Seu teste começou/.test(t), 'texto do acesso grátis coerente com a regra real (lançamento, sem prazo)');
  const wa = `(11) 9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0').replace(/^(\d{4})(\d{4})$/, '$1-$2')}`;
  await p.fill('.sheet input[type=tel]', wa);
  await p.fill('.sheet input[autocomplete=new-password]', '1234');
  await p.getByRole('button', { name: 'Criar conta e continuar' }).click();
  ok(/pelo menos 8 caracteres/.test(await p.locator('.sheet .err').innerText()), 'senha curta é recusada com explicação');
  await p.fill('.sheet input[autocomplete=new-password]', 'senha de teste 2026');
  await p.getByRole('button', { name: 'Criar conta e continuar' }).click();
  ok(await p.w(() => /Conta criada/.test(document.querySelector('.sheet')?.innerText ?? '')), 'conta criada');
  const t2 = await p.locator('.sheet').innerText();
  ok(/Como entrar em outro aparelho/.test(t2) && /senha que você acabou de criar/.test(t2) && /Anote a senha/.test(t2) && !/Seu teste começou/.test(t2), 'mensagem pós-criação: entra com WhatsApp e senha');
  ok(await p.locator('.access-code').count() === 0, 'nenhum código é exibido');
  await p.getByRole('button', { name: 'Entendi, continuar' }).click();
  await p.click('[aria-label="Ajustes"]');
  ok(await p.w(() => /Sincronizado/.test(document.querySelector('.sheet')?.innerText)), 'Ajustes mostra Sincronizado');
  ok(/Acesso grátis do lançamento/.test(await p.locator('.sheet').innerText()), 'Ajustes mostra o tipo de acesso');
  await p.locator('.sheet >> text=Fechar').click(); await p.waitForTimeout(1500);
  ok(await p.getByText('Seus registros estão só neste aparelho').count() === 0, 'após criar a conta o aviso some');
  await p.reload(); await p.waitForSelector('.actions'); await p.waitForTimeout(800);
  ok(await mamadas() === before, 'registros locais preservados após recarregar (' + before + ')');
  const hh = sql(`SELECT household_id AS id FROM sessions ORDER BY rowid DESC LIMIT 1`)[0].id;
  const srv = sql(`SELECT COUNT(*) AS n FROM records WHERE household_id='${hh}' AND kind='event' AND deleted=0 AND body LIKE '%"type":"mamada"%'`)[0].n;
  ok(srv === before, 'servidor recebeu os mesmos registros, sem duplicar (' + srv + ' de ' + before + ')');

  // 8) recuperação por e-mail (ambiente local com caixa de saída simulada)
  await p.click('[aria-label="Ajustes"]');
  await p.fill('input[type=email]', `ux${Date.now()}@exemplo.com`); await p.getByRole('button', { name: 'Salvar e-mail' }).click();
  ok(await p.w(() => /E-mail salvo/.test(document.querySelector('.sheet')?.innerText)), 'e-mail de recuperação salvo');
  const em = await p.locator('input[type=email]').inputValue();
  await p.getByRole('button', { name: 'Sair deste aparelho' }).click(); await p.waitForTimeout(800);
  ok(await p.locator('.sheet input[type=tel]').count() === 1, 'sem conexão: entrar com WhatsApp e senha é o caminho principal');
  await p.fill('.sheet input[type=tel]', wa); await p.fill('.sheet input[type=password]', 'senha errada 123'); await p.getByRole('button', { name: 'Entrar', exact: true }).click();
  ok(await p.w(() => /não conferem/.test(document.querySelector('.sheet .err')?.innerText ?? '')), 'senha errada: mensagem clara');
  await p.fill('.sheet input[type=password]', 'senha de teste 2026'); await p.getByRole('button', { name: 'Entrar', exact: true }).click();
  ok(await p.w(() => /Sincronizado/.test(document.querySelector('.sheet')?.innerText ?? ''), null, 15000), 'entrou com WhatsApp e senha');
  await p.getByRole('button', { name: 'Sair deste aparelho' }).click(); await p.waitForTimeout(800);
  await p.getByRole('button', { name: 'Perdi meu acesso' }).click();
  await p.fill('.sheet input[type=email]', em); await p.getByRole('button', { name: 'Enviar link' }).click();
  ok(await p.w(() => /Se houver uma conta/.test(document.querySelector('[role=dialog]')?.innerText ?? '')), 'recuperação: mensagem neutra');
  const mails = (await (await fetch(`${API}/v1/dev/outbox?to=${encodeURIComponent(em)}`)).json()).messages;
  ok(mails.length >= 1 && /recover=/.test(mails[0].body), 'e-mail com link de recuperação gerado (caixa de saída simulada)');
  ok(p.errs.length === 0, 'sem erros JS ' + p.errs.join('|'));
  await b.close();
})();
