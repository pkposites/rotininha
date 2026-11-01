// Guarda o evento de instalação do Chrome/Android para disparar com um toque do usuário.
let deferred = null;
const subs = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; subs.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; subs.forEach((f) => f()); });
}
export const canPrompt = () => !!deferred;
export const onPromptChange = (f) => { subs.add(f); return () => subs.delete(f); };
export async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  const r = await deferred.userChoice.catch(() => null);
  deferred = null; subs.forEach((f) => f());
  return r?.outcome === 'accepted';
}
