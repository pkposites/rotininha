// Contagem de uso do app (só nomes de eventos e quantidades; nunca conteúdo nem dados do bebê).
// Enviada em lotes pequenos quando há sessão; o servidor ignora tudo se a pessoa desligou as estatísticas.
import { authedCall, syncAvailable } from './sync.js';

const KEY = 'ninhora:usageq';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
const save = () => { try { Object.keys(q).length ? localStorage.setItem(KEY, JSON.stringify(q)) : localStorage.removeItem(KEY); } catch {} };
const q = load();   // o que sobrou da última vez (app fechado antes do envio) sai na próxima abertura
let timer = null;

export function count(event, n = 1) {
  if (!syncAvailable) return;
  q[event] = (q[event] ?? 0) + n;
  save();
  clearTimeout(timer);
  timer = setTimeout(flush, 15_000);
}

export async function flush() {
  clearTimeout(timer);
  const events = Object.entries(q).map(([event, n]) => ({ event, n }));
  if (!events.length || !syncAvailable) return;
  try {
    const r = await authedCall('/v1/usage', { events });
    if (r.status === 200) { for (const e of events) delete q[e.event]; save(); }
  } catch { /* sem sessão/rede: tenta no próximo ciclo */ }
}

if (typeof document !== 'undefined') {
  if (syncAvailable && Object.keys(q).length) setTimeout(flush, 4000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  addEventListener('pagehide', () => { flush(); });
}
