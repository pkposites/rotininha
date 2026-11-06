import type { Env } from './types';
import { sha256Hex } from './crypto';
import { pushToHousehold } from './push';
import { householdTz } from './records';
import { dayBR } from './feedback';
import { PLANS, DAY_MS } from './plans';
import { inQuietHours, localParts } from '../../../packages/shared/schedule.js';
import { ageInDays, leapStartingSoon } from '../../../packages/shared/leaps.js';

export const USAGE_EVENTS = new Set([
  'app_open', 'care_logged', 'reminder_created', 'reminder_done', 'reminder_snoozed', 'sound_played', 'leap_viewed', 'leap_marked',
  'guide_lesson_done', 'push_enabled', 'settings_opened', 'paywall_viewed', 'checkout_started', 'trial_banner_seen', 'care_tip_opened', 'help_card_opened', 'app_installed', 'lp_arrival',
  'push_prompt_shown', 'push_prompt_later', 'push_card_shown', 'push_denied_seen', 'push_ios_install_hint'
]);
export const TARGETS = ['hoje', 'historico', 'saltos', 'sons', 'guia', 'ajustes'];
export const CAP_MS = 20 * 3_600_000; // no máximo 1 aviso promocional a cada 20 h por família
const price7 = () => `R$ ${(PLANS.life.cents / 100).toFixed(2).replace('.', ',')}`;

// ------------------------------------------------------------------ uso (estatísticas sem dados do bebê)

export async function hidFor(env: Env, householdId: string): Promise<string | null> {
  const h = await env.DB.prepare('SELECT hid FROM households WHERE id = ?').bind(householdId).first<{ hid: string | null }>();
  if (!h) return null;
  if (h.hid) return h.hid;
  const hid = (await sha256Hex(`${env.CODE_PEPPER}:usage:${householdId}`)).slice(0, 20);
  await env.DB.prepare('UPDATE households SET hid = ? WHERE id = ? AND hid IS NULL').bind(hid, householdId).run();
  return hid;
}

export async function recordUsage(env: Env, householdId: string, events: { event: string; n: number }[], now: number) {
  const h = await env.DB.prepare('SELECT usage_opt_in, is_test FROM households WHERE id = ?').bind(householdId).first<{ usage_opt_in: number; is_test: number }>();
  if (!h || !h.usage_opt_in || h.is_test) return false; // conta de teste/interna não entra nas métricas
  const hid = await hidFor(env, householdId);
  if (!hid) return false;
  const day = dayBR(now);
  const clean = events.filter((e) => USAGE_EVENTS.has(e.event) && Number.isInteger(e.n) && e.n > 0 && e.n <= 500).slice(0, 30);
  const stmts = clean.map((e) => env.DB.prepare(
    `INSERT INTO usage_daily (hid, day, event, n) VALUES (?,?,?,?) ON CONFLICT(hid, day, event) DO UPDATE SET n = n + excluded.n`
  ).bind(hid, day, e.event, e.n));
  stmts.push(env.DB.prepare('UPDATE households SET last_seen_at = ? WHERE id = ?').bind(now, householdId));
  if (clean.some((e) => e.event === 'care_logged'))
    stmts.push(env.DB.prepare('UPDATE households SET first_care_at = ? WHERE id = ? AND first_care_at IS NULL').bind(now, householdId));
  await env.DB.batch(stmts);
  return true;
}

export async function deleteUsage(env: Env, householdId: string) {
  const h = await env.DB.prepare('SELECT hid FROM households WHERE id = ?').bind(householdId).first<{ hid: string | null }>();
  if (h?.hid) await env.DB.prepare('DELETE FROM usage_daily WHERE hid = ?').bind(h.hid).run();
}

// ------------------------------------------------------------------ segmentos

export interface Audience { segment: 'all' | 'trial' | 'paid' | 'expired' | 'inactive' | 'no_care' | 'new' | 'leap' | 'ids'; days?: number; ids?: string[] }
export const SEGMENTS = ['all', 'trial', 'paid', 'expired', 'inactive', 'no_care', 'new', 'leap', 'ids'];

export function parseAudience(x: any): Audience | null {
  if (!x || typeof x !== 'object' || !SEGMENTS.includes(x.segment)) return null;
  const days = x.days == null ? undefined : Number(x.days);
  if (days != null && (!Number.isInteger(days) || days < 1 || days > 365)) return null;
  if (x.segment === 'ids') {
    const ids = Array.isArray(x.ids) ? x.ids.filter((i: unknown) => typeof i === 'string' && /^[\w-]{8,64}$/.test(i)).slice(0, 200) : [];
    return ids.length ? { segment: 'ids', ids } : null;
  }
  return { segment: x.segment, days };
}

export function segmentSql(a: Audience, now: number): { where: string; binds: any[] } {
  switch (a.segment) {
    case 'trial': return { where: `h.plan = 'trial' AND (h.valid_until IS NULL OR h.valid_until > ?)`, binds: [now] };
    case 'paid': return { where: `EXISTS (SELECT 1 FROM payments p WHERE p.household_id = h.id AND p.applied_at IS NOT NULL)`, binds: [] };
    case 'expired': return { where: `h.valid_until IS NOT NULL AND h.valid_until < ?`, binds: [now] };
    case 'inactive': return { where: `COALESCE(h.last_seen_at, h.created_at) < ?`, binds: [now - (a.days ?? 3) * DAY_MS] };
    case 'no_care': return { where: `h.first_care_at IS NULL AND h.created_at < ?`, binds: [now - (a.days ?? 1) * DAY_MS] };
    case 'new': return { where: `h.created_at > ?`, binds: [now - (a.days ?? 3) * DAY_MS] };
    case 'leap': return { where: `h.baby_birth_date IS NOT NULL`, binds: [] };
    case 'ids': return { where: `h.id IN (${(a.ids ?? []).map(() => '?').join(',') || "''"})`, binds: a.ids ?? [] };
    default: return { where: '1 = 1', binds: [] };
  }
}

const BASE = `FROM households h WHERE h.tips_opt_in = 1 AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.household_id = h.id)`;

export async function countAudience(env: Env, a: Audience, now: number) {
  const sg = segmentSql(a, now);
  const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM households h WHERE ${sg.where}`).bind(...sg.binds).first<{ n: number }>();
  const reachable = await env.DB.prepare(`SELECT COUNT(*) AS n ${BASE} AND ${sg.where}`).bind(...sg.binds).first<{ n: number }>();
  return { segment: total?.n ?? 0, reachable: reachable?.n ?? 0 };
}

// ------------------------------------------------------------------ envio

export interface Campaign { id: string; title: string; body: string; target: string }
type SendResult = 'sent' | 'failed' | 'quiet' | 'cap';

function fill(text: string, h: any, now: number) {
  const end = h.valid_until ?? h.trial_ends_at;
  const dias = end ? Math.max(0, Math.ceil((end - now) / DAY_MS)) : '';
  return text.replace(/\{dias\}/g, String(dias)).replace(/\{preco\}/g, price7());
}

/** Envia uma notificação promocional/de ciclo de vida respeitando silêncio (22h–6h) e o limite de 1 por 20 h. */
export async function sendOne(env: Env, h: any, c: Campaign, now: number, opts: { bypassCap?: boolean; bypassQuiet?: boolean; reason?: string; recordSuppressed?: boolean } = {}): Promise<SendResult> {
  if (!opts.bypassQuiet) {
    const tz = await householdTz(env, h.id).catch(() => 'America/Sao_Paulo');
    if (inQuietHours(now, tz)) return 'quiet'; // adia: tenta de novo nos próximos ciclos
  }
  const record = (status: string, reason: string | null, sid = crypto.randomUUID()) =>
    env.DB.prepare('INSERT INTO notification_sends (id, campaign_id, household_id, sent_at, status, reason) VALUES (?,?,?,?,?,?)').bind(sid, c.id, h.id, now, status, reason).run();
  if (!opts.bypassCap) {
    const recent = await env.DB.prepare(`SELECT COUNT(*) AS n FROM notification_sends WHERE household_id = ? AND status = 'sent' AND sent_at > ?`).bind(h.id, now - CAP_MS).first<{ n: number }>();
    if ((recent?.n ?? 0) > 0) { if (opts.recordSuppressed !== false) await record('suppressed', 'cap'); return 'cap'; }
  }
  const sid = crypto.randomUUID();
  const n = await pushToHousehold(env, h.id, {
    title: fill(c.title, h, now), body: fill(c.body, h, now), tag: `c:${c.id}`,
    extra: { sid, cid: c.id, target: c.target, click: `${env.PUBLIC_API_URL.replace(/\/$/, '')}/v1/push/click` }
  }, now);
  await record(n > 0 ? 'sent' : 'failed', n > 0 ? opts.reason ?? null : 'no_delivery', sid);
  return n > 0 ? 'sent' : 'failed';
}

export async function recordClick(env: Env, sid: string, now: number) {
  const r = await env.DB.prepare('UPDATE notification_sends SET clicked_at = ? WHERE id = ? AND clicked_at IS NULL').bind(now, sid).run();
  return r.meta.changes ?? 0;
}

// ------------------------------------------------------------------ campanhas (disparos manuais/agendados)

export async function runCampaigns(env: Env, now: number): Promise<{ sent: number; finished: number }> {
  await env.DB.prepare(`UPDATE campaigns SET status = 'sending', started_at = ? WHERE status = 'scheduled' AND scheduled_at <= ?`).bind(now, now).run();
  const live = await env.DB.prepare(`SELECT * FROM campaigns WHERE status = 'sending' AND id NOT LIKE 'auto:%'`).all<any>();
  let sent = 0, finished = 0;
  for (const c of live.results) {
    const a = parseAudience(JSON.parse(c.audience)) ?? { segment: 'all' as const };
    const sg = segmentSql(a, now);
    const elig = await env.DB.prepare(
      `SELECT h.id, h.plan, h.valid_until, h.trial_ends_at, h.baby_birth_date ${BASE} AND ${sg.where}
         AND NOT EXISTS (SELECT 1 FROM notification_sends s WHERE s.campaign_id = ? AND s.household_id = h.id) LIMIT 200`
    ).bind(...sg.binds, c.id).all<any>();
    let deferred = 0;
    for (const h of elig.results) { const r = await sendOne(env, h, c, now); if (r === 'sent') sent++; else if (r === 'quiet') deferred++; }
    // termina quando todos foram atendidos (ninguém adiado por silêncio e o lote não estourou), ou depois de 24 h
    const done = deferred === 0 && elig.results.length < 200;
    if (done || now - (c.started_at ?? now) > 24 * 3_600_000) {
      await env.DB.prepare(`UPDATE campaigns SET status = 'sent', finished_at = ? WHERE id = ? AND status = 'sending'`).bind(now, c.id).run();
      finished++;
    }
  }
  return { sent, finished };
}

// ------------------------------------------------------------------ automações (ciclo de vida)

interface AutoDef { label: string; when: string; once: boolean; cooldownDays?: number; bypassCap?: boolean; where: (now: number) => { where: string; binds: any[] }; title: string; body: string; target: string }
const H = 3_600_000;

export const AUTOMATIONS: Record<string, AutoDef> = {
  welcome: { label: 'Boas-vindas', when: 'entre 20 min e 3 h depois do primeiro acesso', once: true,
    where: (n) => ({ where: 'h.created_at < ? AND h.created_at > ?', binds: [n - 20 * 60_000, n - 3 * H] }),
    title: 'Bem-vinda ao Ninhora 💜', body: 'Registre o primeiro cuidado em 1 toque: abra o app e toque em Mamou, Dormiu ou Fralda.', target: 'hoje' },
  first_care: { label: 'Primeiro registro', when: '20 h depois, se ainda não registrou nada', once: true,
    where: (n) => ({ where: 'h.created_at < ? AND h.created_at > ? AND h.first_care_at IS NULL', binds: [n - 20 * H, n - 4 * DAY_MS] }),
    title: 'Vamos começar? 🍼', body: 'Registre a primeira mamada, soneca ou fralda. Leva 1 toque e você corrige o horário depois.', target: 'hoje' },
  first_reminder: { label: 'Primeiro lembrete', when: '26 h depois, se registrou mas não criou lembretes', once: true,
    where: (n) => ({ where: `h.created_at < ? AND h.created_at > ? AND h.first_care_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM records r WHERE r.household_id = h.id AND r.kind = 'task' AND r.deleted = 0)`, binds: [n - 26 * H, n - 5 * DAY_MS] }),
    title: 'Que tal um lembrete? ⏰', body: 'Crie o lembrete do banho ou da hora de dormir e a gente avisa no horário que você escolher.', target: 'hoje' },
  sounds_tip: { label: 'Sons para a soneca', when: '44 h depois, se nunca tocou um som', once: true,
    where: (n) => ({ where: `h.created_at < ? AND h.created_at > ? AND NOT EXISTS (SELECT 1 FROM usage_daily u WHERE u.hid = h.hid AND u.event = 'sound_played')`, binds: [n - 44 * H, n - 6 * DAY_MS] }),
    title: 'Sons para a soneca 🌙', body: 'Conheça os 5 sons do Ninhora: ruído branco, chuva, ondas, batimentos e caixinha de música.', target: 'sons' },
  leap_coming: { label: 'Salto chegando', when: 'até 3 dias antes de uma possível fase de salto (um aviso por salto)', once: false, cooldownDays: 1,
    where: () => ({ where: 'h.baby_birth_date IS NOT NULL', binds: [] }),
    title: 'Um salto pode estar chegando 🌱', body: 'Seu bebê pode entrar numa fase de mais manha. Veja o que costuma ajudar.', target: 'saltos' },
  trial_ends_tomorrow: { label: 'Teste termina amanhã', when: 'entre 16 h e 32 h antes do fim do teste (só com a cobrança ativa)', once: true, bypassCap: true,
    where: (n) => ({ where: `h.plan = 'trial' AND h.valid_until BETWEEN ? AND ?`, binds: [n + 16 * H, n + 32 * H] }),
    title: 'Seu teste grátis termina amanhã', body: 'Depois disso, o acesso vitalício custa {preco}, em pagamento único via Pix. Sem cobrança automática: só paga quem quiser continuar.', target: 'ajustes' },
  trial_last_day: { label: 'Último dia do teste', when: 'nas últimas 10 h do teste', once: true, bypassCap: true,
    where: (n) => ({ where: `h.plan = 'trial' AND h.valid_until BETWEEN ? AND ?`, binds: [n, n + 10 * H] }),
    title: 'Último dia do teste grátis', body: 'Seu teste termina hoje. Para continuar, o acesso vitalício custa {preco}, pagamento único via Pix — sem assinatura.', target: 'ajustes' },
  trial_ended: { label: 'Teste terminou', when: 'nas 24 h depois do fim do teste', once: true, bypassCap: true,
    where: (n) => ({ where: `h.plan = 'trial' AND h.valid_until BETWEEN ? AND ?`, binds: [n - 24 * H, n] }),
    title: 'Seu teste terminou', body: 'Você continua vendo seus registros. Para voltar a editar e receber lembretes, renove por Pix.', target: 'ajustes' },
  inactive_3d: { label: 'Reengajamento (3 dias sem abrir)', when: '3 a 30 dias sem abrir o app; no máximo 1 a cada 7 dias', once: false, cooldownDays: 7,
    where: (n) => ({ where: 'COALESCE(h.last_seen_at, h.created_at) < ? AND COALESCE(h.last_seen_at, h.created_at) > ?', binds: [n - 3 * DAY_MS, n - 30 * DAY_MS] }),
    title: 'Sentimos sua falta 💜', body: 'Como está a rotina do bebê? Seus registros e lembretes estão aqui quando você precisar.', target: 'hoje' }
};

export async function ensureAutomations(env: Env) {
  await env.DB.batch(Object.entries(AUTOMATIONS).flatMap(([key, d]) => [
    env.DB.prepare('INSERT OR IGNORE INTO automations (key, enabled, title, body, target, updated_at) VALUES (?,0,?,?,?,0)').bind(key, d.title, d.body, d.target),
    env.DB.prepare(`INSERT OR IGNORE INTO campaigns (id, name, title, body, target, audience, status, created_at) VALUES (?,?,?,?,?,'{"segment":"all"}','sending',0)`).bind('auto:' + key, 'Automação: ' + d.label, d.title, d.body, d.target)
  ]));
}

export async function runAutomations(env: Env, now: number): Promise<Record<string, number>> {
  await ensureAutomations(env);
  const on = await env.DB.prepare('SELECT key, title, body, target FROM automations WHERE enabled = 1').all<any>();
  const out: Record<string, number> = {};
  for (const a of on.results) {
    const def = AUTOMATIONS[a.key]; if (!def) continue;
    const cid = 'auto:' + a.key, sg = def.where(now);
    const dedupe = def.once
      ? `NOT EXISTS (SELECT 1 FROM notification_sends s WHERE s.campaign_id = '${cid}' AND s.household_id = h.id AND s.status IN ('sent','failed'))`
      : `NOT EXISTS (SELECT 1 FROM notification_sends s WHERE s.campaign_id = '${cid}' AND s.household_id = h.id AND s.sent_at > ${now - (def.cooldownDays ?? 7) * DAY_MS})`;
    const elig = await env.DB.prepare(
      `SELECT h.id, h.plan, h.valid_until, h.trial_ends_at, h.baby_birth_date ${BASE} AND ${sg.where} AND ${dedupe} LIMIT 150`
    ).bind(...sg.binds).all<any>();
    let n = 0;
    for (const h of elig.results) {
      let reason: string | undefined;
      if (a.key === 'leap_coming') { // calcula pela idade; um aviso por salto
        const today = localParts(now, await householdTz(env, h.id)).date;
        const l = leapStartingSoon(ageInDays(h.baby_birth_date, today), 3);
        if (!l) continue;
        const already = await env.DB.prepare(`SELECT 1 AS x FROM notification_sends WHERE campaign_id = ? AND household_id = ? AND reason = ?`).bind(cid, h.id, 'leap' + l.n).first();
        if (already) continue;
        reason = 'leap' + l.n;
      }
      const r = await sendOne(env, h, { id: cid, title: a.title, body: a.body, target: a.target }, now, { bypassCap: def.bypassCap, reason, recordSuppressed: false });
      if (r === 'sent') n++;
    }
    out[a.key] = n;
  }
  return out;
}
