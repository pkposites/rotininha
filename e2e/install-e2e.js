const { chromium } = require('playwright');
const APP = 'http://localhost:4173';
(async () => {
  const b = await chromium.launch();
  const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const mk = async (opts = {}, init) => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR', ...opts }); if (init) await ctx.addInitScript(init); const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); p.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) p.errs.push(m.text()); }); return p; };
  const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const AND = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36';
  const skip = async (p) => { await p.goto(APP + '/app/'); await p.getByText('Pular tudo').click({ timeout: 4000 }); };

  // iPhone/Safari: pop-up ao terminar, escolha já correta, animação e atalho de compartilhar
  const S = await mk({ userAgent: IOS }, () => { navigator.share = async () => { window.__shared = true; }; });
  await skip(S);
  ok(await S.waitForSelector('.install-pop', { timeout: 4000 }).then(() => true, () => false), 'pop-up de instalação aparece ao terminar o caminho');
  const pressed = await S.locator('.install-pop .chip[aria-pressed=true]').allInnerTexts();
  ok(pressed.join('|') === 'iPhone|Safari', 'detecta iPhone + Safari: ' + pressed);
  ok(await S.locator('.hw-phone').count() === 1, 'animação do passo a passo presente');
  const sc0 = await S.locator('.hw-phone').getAttribute('data-scene');
  await S.waitForTimeout(3600);
  ok((await S.locator('.hw-phone').getAttribute('data-scene')) !== sc0, 'animação avança sozinha entre os passos (' + sc0 + ' → ' + await S.locator('.hw-phone').getAttribute('data-scene') + ')');
  await S.locator('.hw-stepbtn >> nth=1').click();
  ok((await S.locator('.hw-phone').getAttribute('data-scene')) === 'menu' && /Adicionar à Tela de Início/.test(await S.locator('.install-pop').innerText()), 'tocar num passo mostra aquela cena');
  await S.getByRole('button', { name: 'Abrir o menu de compartilhar' }).click();
  ok(await S.evaluate(() => window.__shared === true), 'atalho de 1 toque abre o menu de compartilhar do iPhone');
  ok(/Adicionar à Tela de Início/.test(await S.locator('.install-pop [role=status]').innerText()), 'depois do atalho, diz qual opção tocar');
  // trocar para Chrome do iPhone e Android
  await S.getByRole('button', { name: 'Chrome', exact: true }).click();
  ok(await S.getByRole('button', { name: 'Copiar o link do app' }).count() === 1 && /abra no Safari/.test(await S.locator('.install-pop').innerText()), 'iPhone + Chrome: copiar link e dica de abrir no Safari');
  await S.getByRole('button', { name: 'Android', exact: true }).click();
  ok((await S.locator('.install-pop .chip').allInnerTexts()).includes('Samsung Internet'), 'Android: opções Chrome / Samsung Internet / Instagram');
  await S.getByRole('button', { name: 'Samsung Internet' }).click();
  ok(/Adicionar página a/.test(await S.locator('.install-pop').innerText()), 'Samsung Internet: passos próprios');
  await S.locator('.install-pop >> text=Agora não').click(); await S.waitForTimeout(500);
  ok(await S.locator('.install-pop').count() === 0, 'Agora não fecha o pop-up');
  await S.reload(); await S.waitForSelector('.actions'); await S.waitForTimeout(800);
  ok(await S.locator('.install-pop').count() === 0, 'Agora não adia: não reabre logo em seguida');
  ok(await S.locator('.install-card').count() === 1, 'cartão compacto continua na tela Hoje');
  await S.locator('.install-card >> text=Ver como instalar').click();
  ok(await S.locator('.install-pop').count() === 1, 'cartão reabre o pop-up quando a pessoa quiser');
  await S.getByRole('button', { name: 'Já instalei' }).click(); await S.waitForTimeout(500); await S.reload(); await S.waitForSelector('.actions'); await S.waitForTimeout(700);
  ok(await S.locator('.install-card').count() === 0, '"Já instalei" some com o convite');

  // Android/Chrome: instalar com 1 toque (evento do navegador)
  const A = await mk({ userAgent: AND }, () => { window.addEventListener('DOMContentLoaded', () => { const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__prompted = true; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); setTimeout(() => window.dispatchEvent(e), 100); }); });
  await skip(A);
  await A.waitForSelector('.install-pop');
  ok((await A.locator('.install-pop .chip[aria-pressed=true]').allInnerTexts()).join('|') === 'Android|Chrome', 'detecta Android + Chrome');
  ok(await A.getByRole('button', { name: 'Instalar agora (1 toque)' }).count() === 1, 'Android/Chrome: botão de instalar com 1 toque');
  await A.getByRole('button', { name: 'Instalar agora (1 toque)' }).click(); await A.waitForTimeout(400);
  ok(await A.evaluate(() => window.__prompted === true) && /Instalado/.test(await A.locator('.install-pop [role=status]').innerText()), 'instala direto e confirma');

  // Instagram/Facebook
  const I = await mk({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Mobile/15E148 Instagram 300.0' });
  await skip(I); await I.waitForSelector('.install-pop');
  ok((await I.locator('.install-pop .chip[aria-pressed=true]').allInnerTexts()).join('|') === 'iPhone|Instagram / Facebook' && /Abrir no navegador/.test(await I.locator('.install-pop').innerText()), 'dentro do Instagram: orienta abrir no navegador');

  // movimento reduzido: não anima sozinho, mas o passo a passo continua legível
  const R = await mk({ userAgent: IOS, reducedMotion: 'reduce' });
  await skip(R); await R.waitForSelector('.install-pop');
  const r0 = await R.locator('.hw-phone').getAttribute('data-scene'); await R.waitForTimeout(3600);
  ok((await R.locator('.hw-phone').getAttribute('data-scene')) === r0 && await R.locator('.hw-steps li').count() === 4, 'movimento reduzido: sem troca automática; os 4 passos em texto');
  ok([S, A, I, R].every((p) => p.errs.length === 0), 'sem erros JS/CSP ' + [S, A, I, R].flatMap((p) => p.errs).join('|'));
  await b.close();
})();
