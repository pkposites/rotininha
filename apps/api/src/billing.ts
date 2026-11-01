import type { Env } from './types';
import { PLANS, DAY_MS, GRACE_MS, PIX_TTL_MS, DELIVERY_TTL_MS, type Plan } from './plans';
import { sha256Hex, randomToken, randomCode } from './crypto';
import { sealText, unsealText } from './seal';
import { sendEmail } from './email';
import { hashCode, issueSession } from './session';
import { sendPurchase, validFbp, validFbc, type Tracking } from './capi';
import { countEvent } from './feedback';
import { trialConfig, enforcementActive } from './settings';

const mpBase = (env: Env) => (env.MP_API_BASE ?? 'https://api.mercadopago.com').replace(/\/$/, '');
const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
const fmtDate = (ts: number) =>
  new Date(ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Data no formato aceito pelo MP (fuso -03:00; o Brasil não tem horário de verão desde 2019). */
function mpDate(ts: number): string {
  const d = new Date(ts - 3 * 3_600_000).toISOString().replace('Z', '');
  return d.slice(0, 19) + '.000-03:00';
}

interface PaymentRow {
  id: string; mp_id: string | null; kind: 'entry' | 'renewal'; plan: string; days: number; amount_cents: number;
  status: string; email: string; household_id: string | null; poll_hash: string;
  qr_code: string | null; qr_base64: string | null; expires_at: number | null; created_at: number;
  last_checked_at: number | null; applied_at: number | null; refunded_at: number | null;
  delivery_sealed: string | null; delivery_expires: number | null; claimed_at: number | null;
}
const getRow = (env: Env, id: string) => env.DB.prepare('SELECT * FROM payments WHERE id = ?').bind(id).first<PaymentRow>();

// ---------------------------------------------------------------- Mercado Pago

export async function getMpPayment(env: Env, mpId: string): Promise<any | null> {
  const r = await fetch(`${mpBase(env)}/v1/payments/${encodeURIComponent(mpId)}`, { headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('mp_get_' + r.status);
  return r.json();
}

export interface CreateInput { kind: 'entry' | 'renewal'; plan: Plan; email: string; cpf: string; householdId?: string; now: number; tracking?: Tracking | null }

/** Cria o Pix. O CPF só atravessa esta função em direção ao Mercado Pago: não é gravado nem registrado em log. */
export async function createPix(env: Env, i: CreateInput) {
  const id = crypto.randomUUID(), pollToken = randomToken();
  const expiresAt = i.now + PIX_TTL_MS;
  await env.DB.prepare(
    `INSERT INTO payments (id, kind, plan, days, amount_cents, email, household_id, poll_hash, expires_at, created_at,
                           marketing_consent, fbp, fbc, client_ip, client_ua, source_url)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, i.kind, i.plan.id, i.plan.days, i.plan.cents, i.email, i.householdId ?? null, await sha256Hex(pollToken), expiresAt, i.now,
    i.tracking ? 1 : 0, i.tracking?.fbp ?? null, i.tracking?.fbc ?? null, i.tracking?.ip ?? null, i.tracking?.ua ?? null, i.tracking?.sourceUrl ?? null).run();

  let res: Response;
  try {
    res = await fetch(`${mpBase(env)}/v1/payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': id },
      body: JSON.stringify({
        transaction_amount: i.plan.cents / 100,
        description: `Ninhora — acesso por ${i.plan.label}`,
        payment_method_id: 'pix',
        external_reference: id,
        notification_url: `${env.PUBLIC_API_URL.replace(/\/$/, '')}/v1/webhooks/mercadopago`,
        date_of_expiration: mpDate(expiresAt),
        payer: { email: i.email, identification: { type: 'CPF', number: i.cpf } }
      })
    });
  } catch {
    await env.DB.prepare(`UPDATE payments SET status='failed' WHERE id = ?`).bind(id).run();
    return null;
  }
  const j: any = await res.json().catch(() => null);
  const td = j?.point_of_interaction?.transaction_data;
  if (!res.ok || !j?.id || !td?.qr_code) {
    console.error('mp_create_failed', res.status);
    await env.DB.prepare(`UPDATE payments SET status='failed' WHERE id = ?`).bind(id).run();
    return null;
  }
  await env.DB.prepare('UPDATE payments SET mp_id = ?, qr_code = ?, qr_base64 = ? WHERE id = ?')
    .bind(String(j.id), td.qr_code, td.qr_base64 ?? null, id).run();
  return { paymentId: id, pollToken, qrCode: td.qr_code as string, qrBase64: (td.qr_base64 ?? null) as string | null, expiresAt, amountCents: i.plan.cents, plan: i.plan.id };
}

// ---------------------------------------------------------------- Conciliação (webhook e consulta)

/** Ponto único que decide o que o estado do pagamento no MP significa para nós. Idempotente. */
export async function reconcile(env: Env, row: PaymentRow, mp: any, now: number): Promise<string> {
  const st = String(mp?.status ?? '');
  if (st === 'approved') {
    const paid = Math.round(Number(mp.transaction_amount) * 100);
    if (paid !== row.amount_cents || (mp.currency_id && mp.currency_id !== 'BRL') || (mp.payment_method_id && mp.payment_method_id !== 'pix')) {
      await env.DB.prepare(`UPDATE payments SET status='mismatch' WHERE id = ? AND applied_at IS NULL`).bind(row.id).run();
      console.error('payment_mismatch', row.id);
      return 'mismatch';
    }
    return grant(env, row, now);
  }
  if (st === 'refunded' || st === 'charged_back') return revoke(env, row, now);
  if (st === 'rejected' || st === 'cancelled') {
    await env.DB.prepare(`UPDATE payments SET status='failed' WHERE id = ? AND status='pending'`).bind(row.id).run();
    return 'failed';
  }
  return 'pending';
}

/** Concede o acesso UMA vez: tudo em um lote transacional, condicionado a `applied_at IS NULL`. */
async function grant(env: Env, row: PaymentRow, now: number): Promise<string> {
  if (row.applied_at != null) return 'already';
  const spanMs = row.days * DAY_MS;

  if (row.kind === 'entry') {
    const householdId = crypto.randomUUID(), code = randomCode();
    const validUntil = now + spanMs;
    const [claimed] = await env.DB.batch([
      env.DB.prepare(`UPDATE payments SET status='approved', approved_at=?1, applied_at=?1, household_id=?2, qr_code=NULL, qr_base64=NULL
                       WHERE id=?3 AND applied_at IS NULL`).bind(now, householdId, row.id),
      env.DB.prepare(`INSERT INTO households (id, code_hash, valid_until, grace_until, created_at)
                       SELECT ?1, ?2, ?3, ?4, ?5 WHERE changes() = 1`).bind(householdId, await hashCode(env, code), validUntil, validUntil + GRACE_MS, now),
      env.DB.prepare(`UPDATE payments SET delivery_sealed=?1, delivery_expires=?2
                       WHERE id=?3 AND household_id=?4 AND delivery_sealed IS NULL AND claimed_at IS NULL`)
        .bind(await sealText(env.PUSH_SEAL_KEY, code), now + DELIVERY_TTL_MS, row.id, householdId)
    ]);
    if (!claimed.meta.changes) return 'already';
    await afterGrant(env, row, validUntil, now);
    return 'granted';
  }

  const base = `MAX(COALESCE(valid_until, ?1), ?1) + ?2`; // vence a partir do maior entre vencimento atual e hoje
  const [claimed, ext] = await env.DB.batch([
    env.DB.prepare(`UPDATE payments SET status='approved', approved_at=?1, applied_at=?1, qr_code=NULL, qr_base64=NULL
                     WHERE id=?2 AND applied_at IS NULL`).bind(now, row.id),
    env.DB.prepare(`UPDATE households SET plan = 'paid', valid_until = ${base}, grace_until = ${base} + ?3 WHERE id = ?4 AND changes() = 1`)
      .bind(now, spanMs, GRACE_MS, row.household_id)
  ]);
  if (!claimed.meta.changes) return 'already';
  const h = await env.DB.prepare('SELECT valid_until FROM households WHERE id = ?').bind(row.household_id).first<{ valid_until: number }>();
  if (h && ext.meta.changes) await afterGrant(env, row, h.valid_until, now);
  return 'granted';
}

/** Depois de conceder (uma única vez): comprovante, contador agregado do funil e evento de compra (se houve consentimento). */
async function afterGrant(env: Env, row: PaymentRow, validUntil: number, now: number) {
  await sendReceipt(env, row, validUntil, now);
  await countEvent(env, row.kind === 'entry' ? 'pix_paid' : 'renewal_paid', now).catch(() => {});
  await sendPurchase(env, row.id, now);
}

/** Valida o contexto de rastreio enviado pelo cliente. Sem consentimento explícito: nada é guardado. */
export function trackingFrom(body: any, req: Request, env: Env): Tracking | null {
  if (body?.marketingConsent !== true) return null;
  const origin = (() => { try { return new URL(env.APP_URL).origin; } catch { return ''; } })();
  const src = typeof body.sourceUrl === 'string' && origin && body.sourceUrl.startsWith(origin) ? body.sourceUrl.slice(0, 300) : origin || null;
  return {
    fbp: validFbp(body.fbp) ? body.fbp : null, fbc: validFbc(body.fbc) ? body.fbc : null,
    ip: req.headers.get('CF-Connecting-IP'), ua: (req.headers.get('User-Agent') ?? '').slice(0, 300) || null, sourceUrl: src
  };
}

/** Reembolso/contestação (feito no painel do MP): retira o período concedido. Os dados continuam legíveis. */
async function revoke(env: Env, row: PaymentRow, now: number): Promise<string> {
  if (row.applied_at == null || row.refunded_at != null) {
    if (row.applied_at == null) await env.DB.prepare(`UPDATE payments SET status='failed' WHERE id=? AND applied_at IS NULL`).bind(row.id).run();
    return 'noop';
  }
  const span = row.days * DAY_MS;
  await env.DB.batch([
    env.DB.prepare(`UPDATE payments SET status='refunded', refunded_at=?1, delivery_sealed=NULL WHERE id=?2 AND refunded_at IS NULL AND applied_at IS NOT NULL`).bind(now, row.id),
    env.DB.prepare(`UPDATE households SET
        valid_until = valid_until - ?1,
        grace_until = CASE WHEN valid_until - ?1 > ?2 THEN valid_until - ?1 + ?3 ELSE valid_until - ?1 END
      WHERE id = ?4 AND valid_until IS NOT NULL AND changes() = 1`).bind(span, now, GRACE_MS, row.household_id)
  ]);
  return 'revoked';
}

async function sendReceipt(env: Env, row: PaymentRow, validUntil: number, now: number) {
  const support = env.SUPPORT_EMAIL ?? 'o canal de suporte do app';
  await sendEmail(env, {
    to: row.email,
    subject: 'Ninhora — recebemos seu pagamento',
    text:
`Olá! Recebemos seu pagamento via Pix.

Produto: acesso ao Ninhora por ${PLANS[row.plan]?.label ?? row.days + ' dias'}
Valor: ${brl(row.amount_cents)}
Acesso: vitalício (pagamento único)
Pagamento nº: ${row.id}

Não é assinatura: o pagamento é único e não há cobrança automática nem renovação.
Perdeu o código de acesso? No app, toque em "Perdi meu código" e informe este e-mail.

Direito de arrependimento: em até 7 dias corridos da compra você pode pedir o reembolso, sem justificativa, respondendo este e-mail ou escrevendo para ${support}.

O Ninhora ajuda a organizar os cuidados e não substitui a orientação do pediatra.`
  }, now);
}

/** Processa uma notificação do MP: busca o pagamento na API (não confia no corpo do webhook). */
export async function handleMpEvent(env: Env, mpId: string, now: number): Promise<string> {
  const mp = await getMpPayment(env, mpId); // pode lançar → 5xx para o MP tentar de novo
  if (!mp) return 'unknown';
  const ref = typeof mp.external_reference === 'string' ? mp.external_reference : '';
  const row = ref ? await getRow(env, ref) : null;
  if (!row) return 'unknown';                              // pagamento de outro produto/conta
  if (row.mp_id && row.mp_id !== String(mp.id)) return 'mismatch';
  return reconcile(env, row, mp, now);
}

// ---------------------------------------------------------------- Acompanhamento e entrega

const pollOk = async (row: PaymentRow | null, token: unknown): Promise<boolean> => !!row && typeof token === 'string' && token.length < 100 && (await sha256Hex(token)) === row.poll_hash;

export async function paymentStatus(env: Env, id: string, pollToken: unknown, now: number) {
  let row = await getRow(env, id);
  if (!(await pollOk(row, pollToken))) return null;
  // Se o webhook atrasou/falhou, confirma direto no MP (no máximo a cada 4 s por pagamento).
  if (row!.status === 'pending' && row!.mp_id && now - (row!.last_checked_at ?? 0) > 4000) {
    await env.DB.prepare('UPDATE payments SET last_checked_at = ? WHERE id = ?').bind(now, id).run();
    try { const mp = await getMpPayment(env, row!.mp_id); if (mp) await reconcile(env, row!, mp, now); } catch { /* tenta no próximo ciclo */ }
    row = await getRow(env, id);
  }
  const r = row!;
  return {
    status: r.status, kind: r.kind, plan: r.plan, amountCents: r.amount_cents,
    qrCode: r.status === 'pending' ? r.qr_code : null, qrBase64: r.status === 'pending' ? r.qr_base64 : null,
    expiresAt: r.expires_at, expired: r.status === 'pending' && r.expires_at != null && now > r.expires_at,
    canClaim: r.kind === 'entry' && r.status === 'approved' && !!r.delivery_sealed && now < (r.delivery_expires ?? 0)
  };
}

/** Entrega o código de acesso uma única vez e já abre a sessão neste aparelho. */
export async function claimAccess(env: Env, id: string, pollToken: unknown, deviceId: string, now: number) {
  const row = await getRow(env, id);
  if (!(await pollOk(row, pollToken))) return { error: 'not_found' as const };
  if (row!.status !== 'approved') return { error: 'not_paid' as const };
  if (!row!.delivery_sealed || now >= (row!.delivery_expires ?? 0) || !row!.household_id) return { error: 'gone' as const };
  const sealed = row!.delivery_sealed;
  const code = await unsealText(env.PUSH_SEAL_KEY, sealed);
  const upd = await env.DB.prepare(`UPDATE payments SET delivery_sealed = NULL, claimed_at = ? WHERE id = ? AND delivery_sealed = ?`).bind(now, id, sealed).run();
  if (!upd.meta.changes) return { error: 'gone' as const };  // outro aparelho/aba levou primeiro
  return { code, session: await issueSession(env, row!.household_id, deviceId, now) };
}

// ---------------------------------------------------------------- Conta e recuperação

export async function accountState(env: Env, householdId: string, now: number) {
  const h = await env.DB.prepare(
    `SELECT valid_until, grace_until, plan, trial_ends_at, tips_opt_in, usage_opt_in, baby_birth_date, (contact_email IS NOT NULL) AS has_email, (pw_hash IS NOT NULL) AS has_pw
       FROM households WHERE id = ?`
  ).bind(householdId).first<any>();
  if (!h) return null;
  const cfg = await trialConfig(env);
  const state = h.plan === 'trial' && h.valid_until != null && now <= h.valid_until ? 'trial'
    : h.valid_until == null ? 'active' : now <= h.valid_until ? 'active' : h.grace_until != null && now <= h.grace_until ? 'grace' : 'expired';
  const announced = cfg.enforceFrom != null && now < cfg.enforceFrom && now >= cfg.enforceFrom - cfg.noticeDays * 86_400_000;
  return {
    state, plan: h.plan, validUntil: h.valid_until, graceUntil: h.grace_until, trialEndsAt: h.trial_ends_at,
    trialDays: cfg.days,
    enforcement: { active: enforcementActive(cfg, now), from: cfg.enforceFrom, announced, noticeDays: cfg.noticeDays },
    prefs: { tips: !!h.tips_opt_in, usage: !!h.usage_opt_in, babyBirthDate: h.baby_birth_date ?? null, hasEmail: !!h.has_email, hasPassword: !!h.has_pw }
  };
}

export const lastPayerEmail = async (env: Env, householdId: string) =>
  (await env.DB.prepare(`SELECT email FROM payments WHERE household_id = ? AND applied_at IS NOT NULL ORDER BY applied_at DESC LIMIT 1`).bind(householdId).first<{ email: string }>())?.email ?? null;

/** Sempre "silencioso": quem pede não descobre se o e-mail existe. */
export async function requestRecovery(env: Env, email: string, now: number) {
  const rows = await env.DB.prepare(
    `SELECT household_id FROM payments WHERE email = ? AND applied_at IS NOT NULL AND household_id IS NOT NULL
     UNION SELECT id AS household_id FROM households WHERE contact_email = ?`
  ).bind(email, email).all<{ household_id: string }>();
  for (const { household_id } of rows.results) {
    const token = randomToken();
    await env.DB.prepare('INSERT INTO recovery_tokens (hash, household_id, expires_at) VALUES (?,?,?)').bind(await sha256Hex(token), household_id, now + 30 * 60_000).run();
    // O token vai no fragmento (#), que o navegador não envia ao servidor nem aparece em logs de acesso.
    await sendEmail(env, {
      to: email, subject: 'Ninhora — recuperar acesso',
      text: `Você pediu para recuperar o acesso ao Ninhora.\n\nAbra este link em até 30 minutos (uso único):\n${env.APP_URL.replace(/\/$/, "")}/app/#recover=${token}\n\nAo confirmar, geramos um NOVO código de acesso e os aparelhos conectados antes serão desconectados. Seus registros continuam salvos.\n\nSe não foi você, ignore este e-mail: nada será alterado.`
    }, now);
  }
}

export async function confirmRecovery(env: Env, token: unknown, deviceId: string, now: number) {
  if (typeof token !== 'string' || token.length > 100) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare('SELECT household_id, expires_at, used_at FROM recovery_tokens WHERE hash = ?').bind(hash).first<any>();
  if (!row || row.used_at != null || now > row.expires_at) return null;
  const code = randomCode();
  const [used] = await env.DB.batch([
    env.DB.prepare('UPDATE recovery_tokens SET used_at = ? WHERE hash = ? AND used_at IS NULL').bind(now, hash),
    env.DB.prepare('UPDATE households SET code_hash = ? WHERE id = ? AND changes() = 1').bind(await hashCode(env, code), row.household_id),
    env.DB.prepare('UPDATE sessions SET revoked = 1 WHERE household_id = ? AND changes() = 1').bind(row.household_id)
  ]);
  if (!used.meta.changes) return null; // outro clique usou o link primeiro
  return { code, session: await issueSession(env, row.household_id, deviceId, now) };
}
