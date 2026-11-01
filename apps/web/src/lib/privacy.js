import { authedCall, getDeviceId } from './sync.js';
import { getMeta, wipeLocal } from './db.js';

/** Baixa uma cópia (JSON) dos dados da família. Exige conexão. */
export async function downloadMyData() {
  const r = await authedCall('/v1/privacy/export', {});
  if (r.status === 429) throw new Error('Muitos pedidos seguidos. Tente mais tarde.');
  if (r.status !== 200) throw new Error('Não foi possível gerar a cópia agora.');
  const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rotininha-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Apaga os dados no servidor (se conectado) e neste aparelho. Irreversível. */
export async function deleteEverything() {
  if (await getMeta('session')) {
    const r = await authedCall('/v1/privacy/delete', { confirm: 'APAGAR' }).catch((e) => { throw new Error(e.message === 'not-connected' ? 'Sessão expirada. Conecte de novo para apagar os dados na nuvem.' : 'Sem conexão. Tente de novo.'); });
    if (r.status !== 200) throw new Error('Não foi possível apagar na nuvem agora. Tente novamente.');
  }
  try { const reg = await navigator.serviceWorker?.getRegistration('/app/'); const sub = await reg?.pushManager.getSubscription(); await sub?.unsubscribe(); } catch {}
  await wipeLocal();
}
