// Compartilhar a Ninhora: só a página pública de apresentação. Nenhum código, conta, WhatsApp, e-mail ou dado do bebê entra aqui.
export const SHARE_TEXT = 'Uma ajudinha na rotina com o bebê 💜 Conheça a Ninhora para registrar mamadas, sono, fraldas e organizar lembretes.';
export const SHARE_TITLE = 'Ninhora';

/** Endereço público (apresentação). Pode ser trocado no build por VITE_SHARE_URL. A origem do app é a única informação usada. */
export function shareUrl(origin = location.origin, override = import.meta.env?.VITE_SHARE_URL) {
  const u = new URL(override || origin + '/');
  u.search = ''; u.hash = ''; u.username = ''; u.password = '';
  u.searchParams.set('utm_source', 'ninhora_app'); u.searchParams.set('utm_medium', 'compartilhar');
  return u.toString();
}

export const canNativeShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/** → 'shared' (menu aberto e enviado), 'cancelled' (a pessoa desistiu: sem erro), 'unsupported' ou 'failed'. */
export async function shareApp() {
  if (!canNativeShare()) return 'unsupported';
  try { await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: shareUrl() }); return 'shared'; }
  catch (e) { return e?.name === 'AbortError' ? 'cancelled' : 'failed'; }
}

export async function copyShareLink() {
  try { await navigator.clipboard.writeText(shareUrl()); return true; } catch { return false; }
}
