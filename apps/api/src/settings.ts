import type { Env } from './types';
import { DAY_MS, GRACE_MS } from './plans';

export const getSetting = async (env: Env, key: string) =>
  (await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>())?.value ?? null;

export async function setSetting(env: Env, key: string, value: string | null) {
  if (value == null) await env.DB.prepare('DELETE FROM settings WHERE key = ?').bind(key).run();
  else await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, value).run();
}

export interface TrialConfig { days: number; enforceFrom: number | null; noticeDays: number }

/** Teste grátis: duração e data a partir da qual a cobrança passa a valer. Sem data = ninguém é cobrado (pré-lançamento). */
export async function trialConfig(env: Env): Promise<TrialConfig> {
  const [d, f, n] = await Promise.all([getSetting(env, 'trial_days'), getSetting(env, 'trial_enforce_from'), getSetting(env, 'notice_days')]);
  return { days: d ? Number(d) : 3, enforceFrom: f ? Number(f) : null, noticeDays: n ? Number(n) : 7 };
}

export const enforcementActive = (c: TrialConfig, now: number) => c.enforceFrom != null && now >= c.enforceFrom;

/** Fim do teste de um lar que começou em `trialEndsAt`: nunca antes de "início da cobrança + duração do teste" (aviso prévio). */
export const effectiveTrialEnd = (c: TrialConfig, trialEndsAt: number) =>
  c.enforceFrom != null ? Math.max(trialEndsAt, c.enforceFrom + c.days * DAY_MS) : trialEndsAt;

/** Materializa valid_until/grace_until para lares em teste quando a cobrança passa a valer. Idempotente. */
export async function applyEnforcement(env: Env, now: number): Promise<number> {
  const c = await trialConfig(env);
  if (!enforcementActive(c, now)) return 0;
  const r = await env.DB.prepare(
    `UPDATE households SET
        valid_until = MAX(trial_ends_at, ?1),
        grace_until = MAX(trial_ends_at, ?1) + ?2
      WHERE plan = 'trial' AND valid_until IS NULL AND trial_ends_at IS NOT NULL`
  ).bind(c.enforceFrom! + c.days * DAY_MS, GRACE_MS).run();
  return r.meta.changes ?? 0;
}
