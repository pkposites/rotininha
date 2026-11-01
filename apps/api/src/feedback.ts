import type { Env } from './types';
import { sha256Hex } from './crypto';
import { hit } from './ratelimit';
import { csvCell } from './csv';

export const CATEGORIES = ['lembretes', 'registros', 'compartilhar', 'outros'];
export const STATUSES = ['novo', 'avaliado', 'planejado', 'entregue'];
export const MAX_TEXT = 500;
export const RETENTION_DAYS = 365;

// Eventos agregados permitidos. Nada aqui carrega identificador de pessoa.
export const FUNNEL_EVENTS = new Set([
  'lp_visit', 'lp_motion_viewed', 'lp_preview_used', 'lp_quiz_started', 'lp_quiz_done', 'lp_cta_click',
  'checkout_started', 'pix_paid', 'renewal_paid', 'app_first_open', 'app_installed', 'push_enabled', 'first_record',
  'feedback_eligible', 'feedback_card_shown', 'feedback_card_dismissed', 'feedback_submitted', 'guide_completed'
]);

export const dayBR = (ts: number) => new Date(ts - 3 * 3_600_000).toISOString().slice(0, 10);

export async function countEvent(env: Env, event: string, now: number) {
  await env.DB.prepare(
    `INSERT INTO funnel_counts (day, event, n) VALUES (?, ?, 1) ON CONFLICT(day, event) DO UPDATE SET n = n + 1`
  ).bind(dayBR(now), event).run();
}

export type SubmitResult = 'ok' | 'invalid' | 'rate_limited';

export async function submitFeedback(env: Env, householdId: string, input: any, now: number): Promise<SubmitResult> {
  const category = input?.category ?? 'outros';
  const text = typeof input?.text === 'string' ? input.text.trim() : '';
  if (!CATEGORIES.includes(category) || text.length > MAX_TEXT) return 'invalid';
  if (!text && input?.category == null) return 'invalid';
  if (!(await hit(env.DB, `fb:${householdId}`, 3, 86_400_000, now))) return 'rate_limited';
  const pseudo = await sha256Hex(`${env.CODE_PEPPER}:feedback:${householdId}`);
  await env.DB.prepare('INSERT INTO feedback_suggestions (id, pseudo_id, category, text, created_at) VALUES (?,?,?,?,?)')
    .bind(crypto.randomUUID(), pseudo, category, text, now).run();
  await countEvent(env, 'feedback_submitted', now);
  return 'ok';
}

// ----------------------------------------------------------------- administração mínima

export function adminOk(env: Env, req: Request): boolean {
  const tok = env.ADMIN_TOKEN;
  if (!tok || tok.length < 24) return false;           // token curto/ausente = rotas desligadas
  const got = /^Bearer\s+(.+)$/.exec(req.headers.get('Authorization') ?? '')?.[1] ?? '';
  if (got.length !== tok.length) return false;
  let d = 0;
  for (let i = 0; i < tok.length; i++) d |= tok.charCodeAt(i) ^ got.charCodeAt(i);
  return d === 0;
}

export async function feedbackCsv(env: Env, status?: string | null): Promise<string> {
  const rows = await env.DB.prepare(
    `SELECT id, created_at, category, status, text FROM feedback_suggestions ${status ? 'WHERE status = ?' : ''} ORDER BY created_at DESC LIMIT 5000`
  ).bind(...(status ? [status] : [])).all<any>();
  return ['id,data,categoria,status,texto', ...rows.results.map((r) =>
    [r.id, new Date(r.created_at).toISOString(), r.category, r.status, r.text].map(csvCell).join(','))].join('\n');
}

export async function adminMetrics(env: Env, from: string, to: string) {
  const funnel = await env.DB.prepare('SELECT event, SUM(n) AS n FROM funnel_counts WHERE day >= ? AND day <= ? GROUP BY event ORDER BY event').bind(from, to).all<any>();
  const byCat = await env.DB.prepare('SELECT category, status, COUNT(*) AS n FROM feedback_suggestions GROUP BY category, status').all<any>();
  return { funnel: funnel.results, feedback: byCat.results };
}

export async function purgeOldFeedback(env: Env, now: number) {
  await env.DB.prepare('DELETE FROM feedback_suggestions WHERE created_at < ?').bind(now - RETENTION_DAYS * 86_400_000).run();
}
