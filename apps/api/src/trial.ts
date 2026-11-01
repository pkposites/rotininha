import type { Env } from './types';
import { randomCode } from './crypto';
import { hashCode, issueSession } from './session';
import { trialConfig, enforcementActive } from './settings';
import { DAY_MS, GRACE_MS } from './plans';
import { normEmail } from './validate';

/** Cria uma conta de teste grátis (sem senha: o código de acesso é entregue uma vez). */
export async function startTrial(env: Env, input: { deviceId: string; email?: unknown; now: number }) {
  const cfg = await trialConfig(env);
  const code = randomCode(), id = crypto.randomUUID();
  const trialEnd = input.now + cfg.days * DAY_MS;
  const enforced = enforcementActive(cfg, input.now);
  const email = input.email ? normEmail(input.email) : null;
  await env.DB.prepare(
    `INSERT INTO households (id, code_hash, plan, trial_ends_at, valid_until, grace_until, contact_email, created_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).bind(id, await hashCode(env, code), 'trial', trialEnd, enforced ? trialEnd : null, enforced ? trialEnd + GRACE_MS : null, email, input.now).run();
  return { code, session: await issueSession(env, id, input.deviceId, input.now), trialEndsAt: trialEnd, trialDays: cfg.days, enforced };
}
