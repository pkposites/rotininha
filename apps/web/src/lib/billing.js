import { publicCall, authedCall, getDeviceId, adoptSession } from './sync.js';
import { getMeta, setMeta, delMeta } from './db.js';

export const brl = (cents) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

/** Máscara 000.000.000-00 enquanto digita. */
export function maskCpf(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function validCpf(c) {
  const d = String(c).replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +d[9] && dv(10) === +d[10];
}
/** Máscara de WhatsApp brasileiro: (11) 91234-5678. */
export function maskPhone(v) {
  const d = v.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
export const validPhone = (v) => /^[1-9]{2}9?\d{8}$/.test(v.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')) && !(v.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').length === 11 && v.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')[2] !== '9');
export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

export const fmtDateTime = (ts) => new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Dias inteiros até o vencimento (arredonda para cima); negativo se vencido. */
export const daysLeft = (validUntil, now = Date.now()) => Math.ceil((validUntil - now) / 86_400_000);

/** Mensagem do aviso de acesso (null = nada a mostrar): teste grátis, aviso prévio da cobrança, carência, vencido, perto do fim. */
export function accessNotice(acc, now = Date.now()) {
  if (!acc) return null;
  const fmtDay = (ts) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  if (acc.state === 'trial') {
    const d = daysLeft(acc.validUntil, now);
    return { tone: 'info', kind: 'trial', text: d <= 1 ? `Seu teste grátis termina hoje ou amanhã (${fmtDateTime(acc.validUntil)}). Para continuar, o acesso vitalício custa R$ 37,90, em pagamento único via Pix — sem assinatura.` : `Teste grátis: faltam ${d} dias (até ${fmtDateTime(acc.validUntil)}). Depois, o acesso vitalício custa R$ 37,90, pagamento único via Pix — sem assinatura e sem cobrança automática.` };
  }
  if (acc.plan === 'trial' && acc.enforcement?.announced && acc.enforcement.from)
    return { tone: 'info', kind: 'announce', text: `Aviso: a partir de ${fmtDay(acc.enforcement.from)}, o Ninhora passa a ter ${acc.trialDays} dias de teste grátis e depois acesso vitalício pago (R$ 37,90, pagamento único via Pix, sem cobrança automática). Até lá, nada muda para você.` };
  if (acc.validUntil == null) return null;
  if (acc.state === 'expired') return { tone: 'warn', kind: 'expired', text: acc.plan === 'trial' ? 'Seu teste grátis terminou. Você ainda pode ver seus registros; para voltar a editar e receber lembretes, garanta o acesso vitalício.' : 'Seu acesso venceu. Você ainda pode ver seus registros; para voltar a editar e receber lembretes, renove.' };
  if (acc.state === 'grace') return { tone: 'warn', kind: 'grace', text: `${acc.plan === 'trial' ? 'Seu teste terminou' : 'Seu acesso venceu'} e está na carência até ${fmtDateTime(acc.graceUntil)}. Garanta o acesso vitalício para continuar sem interrupção.` };
  const d = daysLeft(acc.validUntil, now);
  if (d <= 2) return { tone: 'info', kind: 'soon', text: d <= 1 ? `Seu acesso termina hoje ou amanhã (${fmtDateTime(acc.validUntil)}).` : `Seu acesso termina em ${d} dias (${fmtDateTime(acc.validUntil)}).` };
  return null;
}

/** Contexto de medição de anúncios: SÓ se a pessoa aceitou "Medição de anúncios" na LP (mesma origem). Sem consentimento: vazio. */
export function trackingContext() {
  try {
    const c = JSON.parse(localStorage.getItem('rotininha:consent'));
    if (c?.marketing !== true) return {};
    const cookie = (n) => document.cookie.split('; ').find((x) => x.startsWith(n + '='))?.slice(n.length + 1);
    const t = { marketingConsent: true, sourceUrl: location.origin + '/' };
    const fbp = cookie('_fbp'), fbc = cookie('_fbc');
    if (fbp) t.fbp = fbp; if (fbc) t.fbc = fbc;
    return t;
  } catch { return {}; }
}

export const getPlans = async () => (await publicCall('/v1/plans', null, 'GET')).data;

const ERR = {
  invalid_email: 'Confira o e-mail.', invalid_cpf: 'Confira o CPF.', invalid_plan: 'Plano indisponível.',
  rate_limited: 'Muitas tentativas. Aguarde um pouco e tente de novo.',
  provider_unavailable: 'O Pix não pôde ser gerado agora. Tente novamente em instantes — nada foi cobrado.',
  payments_disabled: 'As vendas ainda não foram abertas. Em breve!'
};

export async function startCheckout({ email, cpf, plan, renewal }) {
  const r = renewal
    ? await authedCall('/v1/billing/renew', { plan, cpf, email: email || undefined, ...trackingContext() })
    : await publicCall('/v1/checkout', { plan, email, cpf, ...trackingContext() });
  if (r.status !== 201) throw new Error(ERR[r.data?.error] ?? 'Não foi possível iniciar o pagamento.');
  await setMeta('checkout', { paymentId: r.data.paymentId, pollToken: r.data.pollToken, renewal: !!renewal });
  return r.data;
}

export async function checkStatus(c) {
  const r = await publicCall('/v1/checkout/status', { paymentId: c.paymentId, pollToken: c.pollToken });
  if (r.status === 404) { await delMeta('checkout'); return null; }
  if (r.status !== 200) throw new Error('offline');
  return r.data;
}

/** Retira o código UMA vez e já conecta este aparelho. */
export async function claimAccess(c) {
  const r = await publicCall('/v1/checkout/claim', { paymentId: c.paymentId, pollToken: c.pollToken, deviceId: await getDeviceId() });
  if (r.status === 410) throw new Error('O código já foi entregue. Se você não o guardou, use "Perdi meu código".');
  if (r.status !== 200) throw new Error('Não foi possível entregar o código agora. Tente de novo.');
  await delMeta('checkout');
  await adoptSession(r.data.session);
  return r.data.code;
}

export const pendingCheckout = () => getMeta('checkout');
export const clearCheckout = () => delMeta('checkout');

export async function getAccount() {
  try { const r = await authedCall('/v1/billing/account', {}); return r.status === 200 ? r.data : null; } catch { return null; }
}

export async function requestRecovery(email) {
  const r = await publicCall('/v1/recovery/request', { email });
  if (r.status === 429) throw new Error('Muitos pedidos. Tente novamente mais tarde.');
  if (r.status !== 200) throw new Error('Confira o e-mail.');
}

export async function confirmRecovery(token) {
  const r = await publicCall('/v1/recovery/confirm', { token, deviceId: await getDeviceId() });
  if (r.status === 410) throw new Error('Este link expirou ou já foi usado. Peça um novo.');
  if (r.status !== 200) throw new Error('Não foi possível recuperar agora.');
  await adoptSession(r.data.session);
  return r.data.code;
}
