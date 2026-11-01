import type { Env } from './types';
import { dayBR } from './feedback';
import { DAY_MS, GRACE_MS } from './plans';
import { AUTOMATIONS, ensureAutomations, parseAudience, countAudience, sendOne, TARGETS, runCampaigns } from './growth';
import { trialConfig, setSetting, applyEnforcement, enforcementActive } from './settings';
import { hashCode } from './session';

type J = (data: unknown, status: number, h: Record<string, string>) => Response;
type R = (req: Request) => Promise<any | null>;

const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * DAY_MS).toISOString().slice(0, 10);
const rows = async (env: Env, sql: string, ...b: any[]) => (await env.DB.prepare(sql).bind(...b).all<any>()).results;
const one = async (env: Env, sql: string, ...b: any[]) => env.DB.prepare(sql).bind(...b).first<any>();

// ------------------------------------------------------------------ análise de uso

let leadsCache: { at: number; v: any } | null = null;
/** Quantidade de leads da LP (Netlify Forms). Só números: nada de nome ou WhatsApp passa por aqui. */
export async function leadsCount(env: Env, now: number, days: number) {
  if (!env.NETLIFY_TOKEN || !env.NETLIFY_LP_SITE_ID) return { configured: false as const };
  if (leadsCache && now - leadsCache.at < 5 * 60_000 && leadsCache.v.days === days) return leadsCache.v;
  const hdr = { Authorization: `Bearer ${env.NETLIFY_TOKEN}` };
  try {
    const forms = await (await fetch(`https://api.netlify.com/api/v1/sites/${env.NETLIFY_LP_SITE_ID}/forms`, { headers: hdr })).json<any[]>();
    const f = forms.find((x) => x.name === (env.NETLIFY_LP_FORM ?? 'ninhora-leads'));
    if (!f) return { configured: true as const, error: 'form_not_found' };
    let inWindow = 0, capped = false;
    for (let page = 1; page <= 5; page++) {
      const subs = await (await fetch(`https://api.netlify.com/api/v1/forms/${f.id}/submissions?per_page=100&page=${page}`, { headers: hdr })).json<any[]>();
      for (const s of subs) if (Date.parse(s.created_at) >= now - days * DAY_MS) inWindow++;
      if (subs.length < 100 || Date.parse(subs[subs.length - 1].created_at) < now - days * DAY_MS) break;
      if (page === 5) capped = true;
    }
    const v = { configured: true as const, total: f.submission_count ?? null, inWindow, capped, days };
    leadsCache = { at: now, v };
    return v;
  } catch { return { configured: true as const, error: 'netlify_unavailable' }; }
}

export async function overview(env: Env, days: number, now: number) {
  const today = dayBR(now), from = addDays(today, -(days - 1));
  const fromMs = now - days * DAY_MS;

  const signups = await rows(env, `SELECT date((created_at/1000) - 10800, 'unixepoch') AS day, COUNT(*) AS n FROM households WHERE created_at >= ? GROUP BY day ORDER BY day`, fromMs);
  const dau = await rows(env, `SELECT day, COUNT(DISTINCT hid) AS n FROM usage_daily WHERE event = 'app_open' AND day >= ? GROUP BY day ORDER BY day`, from);
  const active = async (d: number) => (await one(env, `SELECT COUNT(DISTINCT hid) AS n FROM usage_daily WHERE event = 'app_open' AND day >= ?`, addDays(today, -(d - 1))))?.n ?? 0;
  const [dau1, wau, mau] = [await active(1), await active(7), await active(30)];

  const totals = await one(env, `SELECT COUNT(*) AS total, SUM(plan = 'trial') AS trials, SUM(created_at >= ?) AS novos FROM households`, fromMs);

  // ativação: registrou o 1º cuidado em até 24 h / 72 h / alguma vez (coorte = famílias criadas na janela)
  const act = await one(env,
    `SELECT COUNT(*) AS cohort,
            SUM(first_care_at IS NOT NULL AND first_care_at - created_at <= 86400000) AS d1,
            SUM(first_care_at IS NOT NULL AND first_care_at - created_at <= 259200000) AS d3,
            SUM(first_care_at IS NOT NULL) AS ever FROM households WHERE created_at >= ?`, fromMs);

  // retenção: abriu o app exatamente N dias depois do cadastro (só coortes que já têm N dias)
  const retention: Record<string, { cohort: number; returned: number; rate: number | null }> = {};
  for (const n of [1, 3, 7]) {
    const r = await one(env,
      `SELECT COUNT(*) AS cohort, SUM(EXISTS (SELECT 1 FROM usage_daily u WHERE u.hid = h.hid AND u.event = 'app_open'
              AND u.day = date((h.created_at/1000) - 10800, 'unixepoch', '+' || ? || ' day'))) AS returned
         FROM households h WHERE h.hid IS NOT NULL AND h.created_at >= ? AND h.created_at <= ?`, n, fromMs, now - n * DAY_MS);
    retention['d' + n] = { cohort: r.cohort ?? 0, returned: r.returned ?? 0, rate: r.cohort ? (r.returned ?? 0) / r.cohort : null };
  }

  // adoção de recursos nos últimos 7 dias, entre quem abriu o app
  const feats = await rows(env, `SELECT event, COUNT(DISTINCT hid) AS n FROM usage_daily WHERE day >= ? GROUP BY event`, addDays(today, -6));
  const features = Object.fromEntries(feats.map((f: any) => [f.event, { households: f.n, rate: wau ? f.n / wau : null }]));

  // notificações
  const push = await one(env,
    `SELECT COUNT(*) AS total, SUM(EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.household_id = h.id)) AS with_push, SUM(tips_opt_in = 0) AS tips_off, SUM(usage_opt_in = 0) AS usage_off FROM households h`);
  const sendsByDay = await rows(env,
    `SELECT date((sent_at/1000) - 10800, 'unixepoch') AS day, SUM(status = 'sent') AS sent, SUM(clicked_at IS NOT NULL) AS clicked FROM notification_sends WHERE sent_at >= ? GROUP BY day ORDER BY day`, fromMs);
  const perCampaign = await rows(env,
    `SELECT c.id, c.name, c.status, c.created_at, c.started_at,
            SUM(s.status = 'sent') AS sent, SUM(s.status = 'failed') AS failed, SUM(s.status = 'suppressed') AS suppressed,
            SUM(s.clicked_at IS NOT NULL) AS clicked,
            SUM(s.status = 'sent' AND EXISTS (SELECT 1 FROM households h JOIN usage_daily u ON u.hid = h.hid
                 WHERE h.id = s.household_id AND u.event = 'app_open'
                   AND u.day >= date((s.sent_at/1000) - 10800, 'unixepoch') AND u.day <= date((s.sent_at/1000) - 10800, 'unixepoch', '+1 day'))) AS opened_24h
       FROM campaigns c LEFT JOIN notification_sends s ON s.campaign_id = c.id GROUP BY c.id HAVING COUNT(s.id) > 0 OR c.id NOT LIKE 'auto:%' ORDER BY COALESCE(c.started_at, c.created_at) DESC LIMIT 50`);

  // funil do teste → pago
  const trial = await one(env,
    `SELECT COUNT(*) AS started,
            SUM(EXISTS (SELECT 1 FROM payments p WHERE p.household_id = h.id AND p.applied_at IS NOT NULL)) AS paid,
            SUM(valid_until IS NOT NULL AND valid_until < ?) AS ended FROM households h WHERE trial_ends_at IS NOT NULL AND created_at >= ?`, now, fromMs);
  const revenue = await one(env, `SELECT COUNT(*) AS n, COALESCE(SUM(amount_cents),0) AS cents FROM payments WHERE applied_at IS NOT NULL AND refunded_at IS NULL AND applied_at >= ?`, fromMs);

  // funil leads → uso (só quantidades)
  const ev = async (e: string) => (await one(env, `SELECT COUNT(DISTINCT hid) AS n FROM usage_daily WHERE event = ? AND day >= ?`, e, from))?.n ?? 0;
  const remMade = (await one(env, `SELECT COALESCE(SUM(n),0) AS n FROM usage_daily WHERE event = 'reminder_created' AND day >= ?`, from))?.n ?? 0;
  const remActive = (await one(env, `SELECT COUNT(*) AS n FROM records WHERE kind = 'task' AND deleted = 0`))?.n ?? 0;
  const pushActive = (await one(env, `SELECT COUNT(DISTINCT household_id) AS n FROM push_subscriptions`))?.n ?? 0;
  const sugg = await one(env, `SELECT COUNT(*) AS total, SUM(created_at >= ?) AS inWindow, SUM(status = 'novo') AS novas FROM feedback_suggestions`, fromMs);
  const funnel = {
    leads: await leadsCount(env, now, days),
    fromLp: await ev('lp_arrival'), installs: await ev('app_installed'), accounts: totals?.total ?? 0,
    activePush: pushActive, remindersCreated: remMade, remindersActive: remActive,
    suggestions: { total: sugg?.total ?? 0, inWindow: sugg?.inWindow ?? 0, new: sugg?.novas ?? 0 }
  };

  const rate = (a: number | null, b: number | null) => (b ? (a ?? 0) / b : null);
  return {
    generatedAt: new Date(now).toISOString(), days,
    funnel,
    users: { total: totals?.total ?? 0, trials: totals?.trials ?? 0, newInWindow: totals?.novos ?? 0, dau: dau1, wau, mau, stickiness: mau ? dau1 / mau : null },
    series: { signups, dau },
    activation: { cohort: act?.cohort ?? 0, within24h: rate(act?.d1, act?.cohort), within72h: rate(act?.d3, act?.cohort), ever: rate(act?.ever, act?.cohort) },
    retention, features,
    push: { households: push?.total ?? 0, withPush: push?.with_push ?? 0, optInRate: rate(push?.with_push, push?.total), tipsOff: push?.tips_off ?? 0, usageOff: push?.usage_off ?? 0 },
    notifications: { byDay: sendsByDay, campaigns: perCampaign.map((c: any) => ({ ...c, ctr: rate(c.clicked, c.sent), openRate24h: rate(c.opened_24h, c.sent) })) },
    trial: { started: trial?.started ?? 0, ended: trial?.ended ?? 0, paid: trial?.paid ?? 0, conversion: rate(trial?.paid, trial?.started) },
    revenue: { payments: revenue?.n ?? 0, cents: revenue?.cents ?? 0 }
  };
}

/** "Grupo-piloto": converte uma lista de códigos de acesso em ids (os códigos não são guardados). */
async function resolveAudience(env: Env, raw: any): Promise<ReturnType<typeof parseAudience> | { error: string }> {
  if (raw?.segment === 'codes') {
    const codes = Array.isArray(raw.codes) ? raw.codes.filter((c: unknown) => typeof c === 'string').slice(0, 50) : [];
    if (!codes.length) return { error: 'no_codes' };
    const ids: string[] = [];
    for (const c of codes) {
      const hh = await one(env, 'SELECT id FROM households WHERE code_hash = ?', await hashCode(env, c));
      if (!hh) return { error: 'code_not_found' };
      ids.push(hh.id);
    }
    return parseAudience({ segment: 'ids', ids });
  }
  return parseAudience(raw);
}

// ------------------------------------------------------------------ rotas administrativas de crescimento

export async function adminGrowth(env: Env, req: Request, url: URL, now: number, h: Record<string, string>, json: J, read: R): Promise<Response | null> {
  const p = url.pathname, m = req.method;

  if (m === 'GET' && p === '/v1/admin/overview') {
    const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days') ?? 30) | 0 || 30));
    return json(await overview(env, days, now), 200, h);
  }

  if (m === 'GET' && p === '/v1/admin/campaigns') {
    const list = await rows(env, `SELECT c.*, (SELECT COUNT(*) FROM notification_sends s WHERE s.campaign_id = c.id AND s.status = 'sent') AS sent,
                                         (SELECT COUNT(*) FROM notification_sends s WHERE s.campaign_id = c.id AND s.clicked_at IS NOT NULL) AS clicked
                                    FROM campaigns c WHERE c.id NOT LIKE 'auto:%' ORDER BY c.created_at DESC LIMIT 100`);
    return json({ campaigns: list.map((c: any) => ({ ...c, audience: JSON.parse(c.audience) })) }, 200, h);
  }

  if (m === 'POST' && p === '/v1/admin/campaigns/preview') {
    const b = await read(req); const a = await resolveAudience(env, b?.audience);
    if (!a || 'error' in a) return json({ error: (a as any)?.error ?? 'bad_audience' }, 400, h);
    return json(await countAudience(env, a, now), 200, h);
  }

  if (m === 'POST' && p === '/v1/admin/campaigns') {
    const b = await read(req); const a = await resolveAudience(env, b?.audience);
    const str = (v: any, max: number) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);
    const name = str(b?.name, 80), title = str(b?.title, 60), body = str(b?.body, 180);
    if (!a || 'error' in a || !name || !title || !body || !TARGETS.includes(b?.target)) return json({ error: (a as any)?.error ?? 'bad_request' }, 400, h);
    const when = b.sendAt == null ? null : Number(b.sendAt);
    if (when != null && (!Number.isFinite(when) || when < now - 60_000 || when > now + 90 * DAY_MS)) return json({ error: 'bad_schedule' }, 400, h);
    const id = crypto.randomUUID();
    const status = b.draft ? 'draft' : 'scheduled';
    await env.DB.prepare(`INSERT INTO campaigns (id, name, title, body, target, audience, status, scheduled_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(id, name, title, body, b.target, JSON.stringify(a), status, status === 'scheduled' ? (when ?? now) : null, now).run();
    return json({ id, status }, 201, h);
  }

  if (m === 'POST' && p === '/v1/admin/campaigns/action') {
    const b = await read(req);
    if (!b || typeof b.id !== 'string' || !['send_now', 'cancel', 'schedule'].includes(b.action)) return json({ error: 'bad_request' }, 400, h);
    let r;
    if (b.action === 'send_now') r = await env.DB.prepare(`UPDATE campaigns SET status = 'scheduled', scheduled_at = ? WHERE id = ? AND status IN ('draft','scheduled')`).bind(now, b.id).run();
    else if (b.action === 'cancel') r = await env.DB.prepare(`UPDATE campaigns SET status = 'canceled', finished_at = ? WHERE id = ? AND status IN ('draft','scheduled','sending')`).bind(now, b.id).run();
    else r = await env.DB.prepare(`UPDATE campaigns SET status = 'scheduled', scheduled_at = ? WHERE id = ? AND status = 'draft'`).bind(Number(b.sendAt) || now, b.id).run();
    return json({ updated: r.meta.changes ?? 0 }, 200, h);
  }

  // envia UM teste para o aparelho de quem tem o código (ignora silêncio e limites; não conta nas métricas)
  if (m === 'POST' && p === '/v1/admin/campaigns/test') {
    const b = await read(req);
    if (!b || typeof b.code !== 'string' || typeof b.title !== 'string' || typeof b.body !== 'string' || !TARGETS.includes(b.target)) return json({ error: 'bad_request' }, 400, h);
    const hh = await one(env, 'SELECT id, plan, valid_until, trial_ends_at, baby_birth_date FROM households WHERE code_hash = ?', await hashCode(env, b.code));
    if (!hh) return json({ error: 'code_not_found' }, 404, h);
    const res = await sendOne(env, hh, { id: 'test', title: b.title.slice(0, 60), body: b.body.slice(0, 180), target: b.target }, now, { bypassCap: true, bypassQuiet: true, reason: 'test' });
    await env.DB.prepare(`DELETE FROM notification_sends WHERE campaign_id = 'test'`).run();
    return json({ result: res }, 200, h);
  }

  if (m === 'GET' && p === '/v1/admin/automations') {
    await ensureAutomations(env);
    const list = await rows(env,
      `SELECT a.key, a.enabled, a.title, a.body, a.target,
              (SELECT COUNT(*) FROM notification_sends s WHERE s.campaign_id = 'auto:' || a.key AND s.status = 'sent') AS sent,
              (SELECT COUNT(*) FROM notification_sends s WHERE s.campaign_id = 'auto:' || a.key AND s.clicked_at IS NOT NULL) AS clicked
         FROM automations a ORDER BY a.rowid`);
    return json({ automations: list.map((a: any) => ({ ...a, enabled: !!a.enabled, label: AUTOMATIONS[a.key]?.label, when: AUTOMATIONS[a.key]?.when })) }, 200, h);
  }

  if (m === 'POST' && p === '/v1/admin/automations') {
    const b = await read(req);
    if (!b || !(b.key in AUTOMATIONS)) return json({ error: 'bad_request' }, 400, h);
    await ensureAutomations(env);
    const title = typeof b.title === 'string' && b.title.trim() && b.title.length <= 60 ? b.title.trim() : null;
    const body = typeof b.body === 'string' && b.body.trim() && b.body.length <= 180 ? b.body.trim() : null;
    const target = TARGETS.includes(b.target) ? b.target : null;
    await env.DB.prepare(`UPDATE automations SET enabled = COALESCE(?, enabled), title = COALESCE(?, title), body = COALESCE(?, body), target = COALESCE(?, target), updated_at = ? WHERE key = ?`)
      .bind(typeof b.enabled === 'boolean' ? (b.enabled ? 1 : 0) : null, title, body, target, now, b.key).run();
    return json({ ok: true }, 200, h);
  }

  // teste grátis e início da cobrança (com aviso prévio obrigatório)
  if (m === 'GET' && p === '/v1/admin/settings') {
    const c = await trialConfig(env);
    const trials = await one(env, `SELECT COUNT(*) AS n, SUM(valid_until IS NULL) AS unlimited FROM households WHERE plan = 'trial'`);
    return json({ trialDays: c.days, enforceFrom: c.enforceFrom, noticeDays: c.noticeDays, active: enforcementActive(c, now), trials: trials?.n ?? 0, trialsWithoutEnd: trials?.unlimited ?? 0 }, 200, h);
  }
  if (m === 'POST' && p === '/v1/admin/settings') {
    const b = await read(req); if (!b) return json({ error: 'bad_request' }, 400, h);
    const c = await trialConfig(env);
    const days = b.trialDays == null ? c.days : Number(b.trialDays), notice = b.noticeDays == null ? c.noticeDays : Number(b.noticeDays);
    if (!Number.isInteger(days) || days < 1 || days > 30 || !Number.isInteger(notice) || notice < 1 || notice > 60) return json({ error: 'bad_request' }, 400, h);
    if (b.enforceFrom !== undefined && b.enforceFrom !== null) {
      const from = Number(b.enforceFrom);
      // aviso prévio: a cobrança só pode começar depois de `notice` dias a partir de agora (a menos que já esteja valendo)
      const devSkip = env.ALLOW_DEV_SIGNUP === 'true' && b.devSkipNotice === true; // só em desenvolvimento/testes
      if (!Number.isFinite(from) || (!devSkip && from < now + notice * DAY_MS && !(c.enforceFrom != null && c.enforceFrom === from)))
        return json({ error: 'notice_required', minFrom: now + notice * DAY_MS }, 422, h);
      await setSetting(env, 'trial_enforce_from', String(from));
    } else if (b.enforceFrom === null) {
      if (enforcementActive(c, now)) return json({ error: 'already_active' }, 409, h); // não "desfaz" cobrança em curso
      await setSetting(env, 'trial_enforce_from', null);
    }
    await setSetting(env, 'trial_days', String(days)); await setSetting(env, 'notice_days', String(notice));
    return json({ ok: true, applied: await applyEnforcement(env, now) }, 200, h);
  }

  if (m === 'POST' && p === '/v1/admin/run') { // força um ciclo agora (útil para conferir uma campanha)
    return json(await runCampaigns(env, now), 200, h);
  }
  return null;
}
