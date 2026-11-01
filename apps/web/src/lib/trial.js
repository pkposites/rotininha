import { publicCall, getDeviceId, adoptSession } from './sync.js';
import { setPref } from './prefs.js';

/** Começa o teste grátis: cria a conta no servidor (sem senha), conecta este aparelho e devolve o código (mostrado uma vez). */
export async function startTrial(email) {
  const r = await publicCall('/v1/trial/start', { deviceId: await getDeviceId(), ...(email ? { email: email.trim() } : {}) });
  if (r.status === 429) throw new Error('Já criamos um teste neste aparelho. Use o código que você recebeu, em Ajustes → Conectar.');
  if (r.status !== 201) throw new Error('Não foi possível começar agora. Tente de novo em instantes.');
  await setPref('trialStartedAt', Date.now());
  await adoptSession(r.data.session);
  return r.data;
}

export async function setAccountPrefs(patch) {
  const { authedCall } = await import('./sync.js');
  const r = await authedCall('/v1/settings', patch);
  if (r.status === 422 && r.data?.error === 'invalid_email') throw new Error('Confira o e-mail.');
  if (r.status !== 200) throw new Error('Não foi possível salvar agora.');
}
