import { isInternal } from './internal.js';
import { publicCall, getDeviceId, adoptSession } from './sync.js';
import { setPref } from './prefs.js';

/** Começa o teste grátis: cria a conta no servidor (sem senha), conecta este aparelho e devolve o código (mostrado uma vez). */
export async function startTrial({ email, whatsapp, password } = {}) {
  const r = await publicCall('/v1/trial/start', { deviceId: await getDeviceId(), whatsapp, password, ...(isInternal() ? { internal: true } : {}), ...(email ? { email: email.trim() } : {}) });
  if (r.status === 422 && r.data?.error === 'invalid_whatsapp') throw new Error('Confira o WhatsApp: DDD + número, por exemplo (11) 91234-5678.');
  if (r.status === 422 && r.data?.error === 'weak_password') throw new Error('Escolha uma senha com pelo menos 8 caracteres, que não seja óbvia (como 12345678) nem o seu número.');
  if (r.status === 409) throw new Error('Este WhatsApp já tem uma conta. Toque em “Já tenho conta” para entrar com a sua senha.');
  if (r.status === 429) throw new Error('Já criamos um teste neste aparelho. Use o código que você recebeu, em Ajustes → Conectar.');
  if (r.status !== 201) throw new Error('Não foi possível começar agora. Tente de novo em instantes.');
  await setPref('trialStartedAt', Date.now());
  await adoptSession(r.data.session);
  return r.data;
}

export async function setPassword(whatsapp, password) {
  const { authedCall } = await import('./sync.js');
  const r = await authedCall('/v1/account/password', { whatsapp, password });
  if (r.status === 422 && r.data?.error === 'invalid_whatsapp') throw new Error('Confira o WhatsApp: DDD + número.');
  if (r.status === 422) throw new Error('Escolha uma senha com pelo menos 8 caracteres, que não seja óbvia nem o seu número.');
  if (r.status === 409) throw new Error('Este WhatsApp já pertence a outra conta.');
  if (r.status !== 200) throw new Error('Não foi possível salvar agora.');
}

export async function setAccountPrefs(patch) {
  const { authedCall } = await import('./sync.js');
  const r = await authedCall('/v1/settings', patch);
  if (r.status === 422 && r.data?.error === 'invalid_email') throw new Error('Confira o e-mail.');
  if (r.status !== 200) throw new Error('Não foi possível salvar agora.');
}
