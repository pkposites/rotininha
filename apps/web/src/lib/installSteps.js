// Passo a passo de instalação por aparelho e navegador (dados puros: testáveis e usados pela animação).
export const DEVICES = [['ios', 'iPhone'], ['android', 'Android']];
export const BROWSERS = {
  ios: [['safari', 'Safari'], ['chrome', 'Chrome'], ['inapp', 'Instagram / Facebook']],
  android: [['chrome', 'Chrome'], ['samsung', 'Samsung Internet'], ['inapp', 'Instagram / Facebook']]
};

const HOME = { scene: 'home', t: 'Abra o Ninhora pelo ícone novo', sub: 'Abrir pelo ícone é o que faz os lembretes funcionarem.' };
const SHEET_IOS = { scene: 'menu', row: 'Adicionar à Tela de Início', t: 'Escolha “Adicionar à Tela de Início”', sub: 'Role o menu para baixo se ela não aparecer.' };

export const STEPS = {
  'ios.safari': [
    { scene: 'bar-bottom', target: 'share', t: 'Toque em Compartilhar', sub: 'É o quadrado com uma seta para cima, na barra de baixo do Safari.' },
    SHEET_IOS,
    { scene: 'confirm', ok: 'Adicionar', t: 'Toque em “Adicionar”', sub: 'No canto de cima, à direita.' },
    HOME
  ],
  'ios.chrome': [
    { scene: 'bar-top', target: 'share', t: 'Toque em Compartilhar', sub: 'É o ícone ao lado do endereço, no alto da tela.' },
    SHEET_IOS,
    { scene: 'confirm', ok: 'Adicionar', t: 'Toque em “Adicionar”', sub: 'No canto de cima, à direita.' },
    HOME
  ],
  'android.chrome': [
    { scene: 'bar-top', target: 'dots', t: 'Toque nos três pontinhos', sub: 'Ficam no canto de cima, à direita do Chrome.' },
    { scene: 'menu', row: 'Instalar app', t: 'Escolha “Instalar app”', sub: 'Em alguns aparelhos aparece como “Adicionar à tela inicial”.' },
    { scene: 'confirm', ok: 'Instalar', t: 'Confirme em “Instalar”', sub: 'O ícone vai para a sua tela inicial.' },
    HOME
  ],
  'android.samsung': [
    { scene: 'bar-bottom', target: 'menu', t: 'Toque no menu ☰', sub: 'Fica no canto de baixo, à direita.' },
    { scene: 'menu', row: 'Adicionar página a', t: 'Escolha “Adicionar página a”', sub: 'Depois toque em “Tela inicial”.' },
    { scene: 'confirm', ok: 'Adicionar', t: 'Confirme em “Adicionar”', sub: 'O ícone vai para a sua tela inicial.' },
    HOME
  ],
  inapp: [
    { scene: 'bar-top', target: 'dots', t: 'Toque nos três pontinhos ⋯', sub: 'Ficam no canto da tela do Instagram ou Facebook.' },
    { scene: 'menu', row: 'Abrir no navegador', t: 'Escolha “Abrir no navegador”', sub: 'Pode aparecer como “Abrir no Safari” ou “Abrir no Chrome”.' },
    { scene: 'confirm', ok: 'Pronto', t: 'Depois, siga o passo a passo de instalação', sub: 'Escolha acima o seu navegador (Safari, Chrome…) para ver como.' }
  ]
};

export const stepsFor = (device, browser) => browser === 'inapp' ? STEPS.inapp : STEPS[`${device}.${browser}`] ?? STEPS[`${device}.chrome`];

/** Escolha inicial a partir do user agent (a pessoa pode trocar). */
export function guessChoice(ua = navigator.userAgent) {
  const ios = /iphone|ipad|ipod/i.test(ua), android = /android/i.test(ua);
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Line\/|Snapchat/i.test(ua);
  const device = android ? 'android' : 'ios';
  let browser = 'chrome';
  if (inApp) browser = 'inapp';
  else if (ios) browser = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? 'chrome' : 'safari';
  else if (android && /SamsungBrowser/i.test(ua)) browser = 'samsung';
  else if (!ios && !android) browser = 'safari';
  return { device, browser, known: ios || android };
}

/** O que dá para fazer com um toque só: instalar direto (Chrome/Android), abrir o menu de compartilhar (Safari) ou copiar o link. */
export function oneClick(device, browser, hasPrompt, canShare) {
  if (device === 'android' && browser === 'chrome' && hasPrompt) return 'install';
  if (device === 'ios' && browser === 'safari' && canShare) return 'share';
  if (browser === 'inapp' || (device === 'ios' && browser !== 'safari')) return 'copy';
  return null;
}
