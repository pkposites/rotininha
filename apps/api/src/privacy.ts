import type { Env } from './types';
import { sha256Hex } from './crypto';

export const RETENTION_DAYS_AFTER_EXPIRY = 365; // dados do app são apagados 12 meses após o fim do acesso (Política de Privacidade)

const pseudoOf = (env: Env, id: string) => sha256Hex(`${env.CODE_PEPPER}:feedback:${id}`);

/** Cópia legível dos dados da família (portabilidade, LGPD art. 18). Sem segredos (hash de código, chaves de push). */
export async function exportHousehold(env: Env, householdId: string, now: number) {
  const hh = await env.DB.prepare('SELECT timezone, valid_until, grace_until, created_at FROM households WHERE id = ?').bind(householdId).first<any>();
  const recs = await env.DB.prepare('SELECT body, deleted FROM records WHERE household_id = ? ORDER BY seq').bind(householdId).all<{ body: string; deleted: number }>();
  const pays = await env.DB.prepare(
    'SELECT plan, kind, amount_cents, status, email, created_at, approved_at, refunded_at FROM payments WHERE household_id = ? ORDER BY created_at'
  ).bind(householdId).all<any>();
  const fb = await env.DB.prepare('SELECT category, text, status, created_at FROM feedback_suggestions WHERE pseudo_id = ? ORDER BY created_at')
    .bind(await pseudoOf(env, householdId)).all<any>();
  const devices = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE household_id = ?').bind(householdId).first<{ n: number }>();
  return {
    exportedAt: new Date(now).toISOString(),
    conta: { fuso: hh?.timezone, validoAte: hh?.valid_until ? new Date(hh.valid_until).toISOString() : null, criadaEm: hh ? new Date(hh.created_at).toISOString() : null },
    registros: recs.results.map((r) => ({ ...JSON.parse(r.body), deleted: !!r.deleted })).filter((r) => !r.deleted),
    pagamentos: pays.results.map((p) => ({
      plano: p.plan, tipo: p.kind, valor_centavos: p.amount_cents, status: p.status, email: p.email,
      criado_em: new Date(p.created_at).toISOString(), aprovado_em: p.approved_at ? new Date(p.approved_at).toISOString() : null, reembolsado_em: p.refunded_at ? new Date(p.refunded_at).toISOString() : null
    })),
    sugestoes: fb.results.map((f) => ({ tema: f.category, texto: f.text, status: f.status, enviada_em: new Date(f.created_at).toISOString() })),
    aparelhos_com_notificacao: devices?.n ?? 0
  };
}

/**
 * Apaga tudo o que é da família. Pagamentos ficam só com o necessário para obrigação fiscal/contábil,
 * SEM e-mail e SEM vínculo com a conta. Atômico (lote transacional).
 */
export async function purgeHousehold(env: Env, householdId: string) {
  const pseudo = await pseudoOf(env, householdId);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM records WHERE household_id = ?').bind(householdId),
    env.DB.prepare('DELETE FROM push_subscriptions WHERE household_id = ?').bind(householdId),
    env.DB.prepare('DELETE FROM recovery_tokens WHERE household_id = ?').bind(householdId),
    env.DB.prepare('DELETE FROM sessions WHERE household_id = ?').bind(householdId),
    env.DB.prepare('DELETE FROM sent_notifications WHERE key LIKE ?').bind(householdId + ':%'),
    env.DB.prepare('DELETE FROM feedback_suggestions WHERE pseudo_id = ?').bind(pseudo),
    env.DB.prepare("UPDATE payments SET email = 'apagado', household_id = NULL, qr_code = NULL, qr_base64 = NULL, delivery_sealed = NULL, poll_hash = 'apagado' WHERE household_id = ?").bind(householdId),
    env.DB.prepare('DELETE FROM households WHERE id = ?').bind(householdId)
  ]);
}

/** Retenção: apaga famílias cujo acesso terminou há mais de 12 meses. Chamado pelo Cron (a cada hora, em lote pequeno). */
export async function purgeExpired(env: Env, now: number): Promise<number> {
  const cutoff = now - RETENTION_DAYS_AFTER_EXPIRY * 86_400_000;
  const old = await env.DB.prepare('SELECT id FROM households WHERE grace_until IS NOT NULL AND grace_until < ? LIMIT 20').bind(cutoff).all<{ id: string }>();
  for (const { id } of old.results) await purgeHousehold(env, id);
  await env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(now - 2 * 86_400_000).run();
  await env.DB.prepare('DELETE FROM recovery_tokens WHERE expires_at < ?').bind(now - 86_400_000).run();
  await env.DB.prepare('DELETE FROM sessions WHERE refresh_expires < ?').bind(now).run();
  return old.results.length;
}
