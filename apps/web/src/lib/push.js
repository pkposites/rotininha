import { authedCall, syncAvailable } from './sync.js';
import { getMeta, setMeta } from './db.js';
import { track } from './analytics.js';
import { count } from './usage.js';

const b64uToBytes = (str) => {
  const p = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
};
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

/**
 * Situação honesta do aparelho para lembretes:
 * unavailable (sem servidor) | unsupported | ios-install (iPhone fora da Tela de Início) | denied | idle | active
 */
export async function pushState() {
  if (!syncAvailable) return 'unavailable';
  if (isIOS() && !isStandalone()) return 'ios-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (await reg.pushManager.getSubscription()) return 'active';
    } catch {}
  }
  return 'idle';
}

/** Deve ser chamado a partir de um toque do usuário (exigência do iOS). */
export async function enablePush(privacy = false) {
  const st = await pushState();
  if (st === 'ios-install') throw new Error('No iPhone, primeiro instale o Ninhora na Tela de Início (Compartilhar → Adicionar à Tela de Início) e abra por lá.');
  if (st === 'unsupported') throw new Error('Este navegador não oferece notificações para sites instalados.');
  if (st === 'denied') throw new Error('As notificações estão bloqueadas. Libere nas configurações do aparelho para o Ninhora.');

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Sem a permissão, os lembretes não chegam como notificação. Você pode tentar de novo quando quiser.');

  const keyRes = await fetch((import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '') + '/v1/push/key');
  const { publicKey } = await keyRes.json();
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(publicKey) });

  const json = sub.toJSON();
  let r;
  try { r = await authedCall('/v1/push/subscribe', { endpoint: json.endpoint, keys: json.keys, privacy }); }
  catch (e) { if (e.message === 'not-connected') throw new Error('Conecte este aparelho com o código de acesso primeiro.'); throw e; }
  if (r.status !== 201) throw new Error('Não foi possível ativar agora. Tente novamente em instantes.');
  await setMeta('pushPrivacy', !!privacy);
  track('push_enabled', { once: true });
  count('push_enabled');
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  try { await authedCall('/v1/push/unsubscribe', { endpoint: sub.endpoint }); } catch {}
  await sub.unsubscribe();
}

export async function sendTestPush() {
  const r = await authedCall('/v1/push/test', {});
  if (r.status === 429) throw new Error('Muitos testes seguidos. Tente mais tarde.');
  if (r.status !== 200) throw new Error('Não foi possível enviar o teste.');
  return r.data.sent;
}

export const getPushPrivacy = async () => !!(await getMeta('pushPrivacy'));
