// Detecção do ambiente para orientar a instalação (inclui o navegador embutido do Instagram/Facebook).
export function detectEnv(ua = navigator.userAgent, standalone = false) {
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Line\/|Snapchat/i.test(ua);
  const ios = /iphone|ipad|ipod/i.test(ua);
  const android = /android/i.test(ua);
  const iosSafari = ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) && !inApp;
  return { inApp, ios, android, iosSafari, standalone };
}

/** Qual orientação mostrar: installed | in-app | ios-safari | ios-other | android-prompt | android-menu | desktop */
export function installAdvice(env, hasPrompt = false) {
  if (env.standalone) return 'installed';
  if (env.inApp) return 'in-app';
  if (env.ios) return env.iosSafari ? 'ios-safari' : 'ios-other';
  if (env.android) return hasPrompt ? 'android-prompt' : 'android-menu';
  return hasPrompt ? 'android-prompt' : 'desktop';
}
