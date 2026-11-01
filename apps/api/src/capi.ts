import type { Env } from './types';
import { sha256Hex } from './crypto';

export interface Tracking { fbp: string | null; fbc: string | null; ip: string | null; ua: string | null; sourceUrl: string | null }

// Formatos dos identificadores da Meta (validados para não gravar lixo do cliente).
export const validFbp = (v: unknown): v is string => typeof v === 'string' && /^fb\.\d\.\d{10,14}\.\d{1,12}$/.test(v);
export const validFbc = (v: unknown): v is string => typeof v === 'string' && v.length <= 200 && /^fb\.\d\.\d{10,14}\.[\w-]{1,150}$/.test(v);

/** Monta o evento Purchase. SÓ contém: valor, moeda, e-mail com hash, ids de navegador e URL de origem.
 *  Nunca: idade do bebê, respostas do quiz, horários, remédios, histórico, CPF. */
export async function buildPurchase(row: { id: string; email: string; amount_cents: number; fbp: string | null; fbc: string | null; client_ip: string | null; client_ua: string | null; source_url: string | null }, now: number) {
  const user: Record<string, unknown> = { em: [await sha256Hex(row.email.trim().toLowerCase())] };
  if (row.fbp) user.fbp = row.fbp;
  if (row.fbc) user.fbc = row.fbc;
  if (row.client_ip) user.client_ip_address = row.client_ip;
  if (row.client_ua) user.client_user_agent = row.client_ua;
  return {
    event_name: 'Purchase',
    event_time: Math.floor(now / 1000),
    event_id: row.id,                    // mesmo id por pagamento: deduplica com o navegador, se um dia houver
    action_source: 'website',
    ...(row.source_url ? { event_source_url: row.source_url } : {}),
    user_data: user,
    custom_data: { currency: 'BRL', value: row.amount_cents / 100 }
  };
}

/** Envia uma vez, com melhor esforço (falha não afeta a concessão do acesso). Apaga os dados de rastreio depois. */
export async function sendPurchase(env: Env, id: string, now: number): Promise<'sent' | 'skipped' | 'failed'> {
  const row = await env.DB.prepare(
    'SELECT id, email, amount_cents, marketing_consent, fbp, fbc, client_ip, client_ua, source_url, capi_sent_at FROM payments WHERE id = ?'
  ).bind(id).first<any>();
  let result: 'sent' | 'skipped' | 'failed' = 'skipped';
  try {
    if (row && row.marketing_consent === 1 && row.capi_sent_at == null && env.META_PIXEL_ID && env.META_CAPI_TOKEN) {
      const base = (env.META_API_BASE ?? 'https://graph.facebook.com').replace(/\/$/, '');
      const res = await fetch(`${base}/v21.0/${encodeURIComponent(env.META_PIXEL_ID)}/events`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [await buildPurchase(row, now)], access_token: env.META_CAPI_TOKEN, ...(env.META_TEST_EVENT_CODE ? { test_event_code: env.META_TEST_EVENT_CODE } : {}) })
      });
      result = res.ok ? 'sent' : 'failed';
      if (!res.ok) console.error('capi_failed', res.status); // sem corpo/token no log
    }
  } catch (e) { result = 'failed'; console.error('capi_error'); }
  // dados de rastreio não ficam guardados: usados (ou descartados) uma única vez
  await env.DB.prepare('UPDATE payments SET fbp = NULL, fbc = NULL, client_ip = NULL, client_ua = NULL, capi_sent_at = ? WHERE id = ?')
    .bind(result === 'sent' ? now : null, id).run();
  return result;
}
