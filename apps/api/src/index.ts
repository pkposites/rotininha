import type { Env, Auth, WireRecord } from './types';
import { sha256Hex, randomCode, normalizeCode, randomToken } from './crypto';
import { parseRecord, MAX_CHANGES } from './validate';
import { applyChanges, changesSince, householdTz, rescheduleAll } from './records';
import { saveSubscription, removeSubscription, endpointAllowed, pushToHousehold, runDue } from './push';
import { isValidTimeZone } from '../../../packages/shared/schedule.js';
import { PLANS, ENTRY_PLANS, RENEWAL_PLANS } from './plans';
import { trackingFrom, createPix, paymentStatus, claimAccess, handleMpEvent, accountState, lastPayerEmail, requestRecovery, confirmRecovery } from './billing';
import { verifyMpSignature } from './mpsig';
import { normEmail, normCpf } from './validate';
import { exportHousehold, purgeHousehold } from './privacy';
import { submitFeedback, countEvent, FUNNEL_EVENTS, adminOk, feedbackCsv, adminMetrics, STATUSES } from './feedback';
import { hit } from './ratelimit';
import { hashCode, issueSession } from './session';

const CLOCK_SKEW = 60 * 1000;
const PAGE = 500;

function cors(env: Env, req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');
  const allowed = env.ALLOWED_ORIGIN.split(',').map((s) => s.trim());
  return {
    'Access-Control-Allow-Origin': origin && allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin'
  };
}

const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'"
};
const json = (data: unknown, status: number, h: Record<string, string>) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...SECURITY, ...h } });

async function readJson(req: Request): Promise<any | null> {
  try {
    const text = await req.text();
    if (text.length > 200_000) return null;
    return JSON.parse(text);
  } catch { return null; }
}

async function authenticate(env: Env, req: Request, now: number): Promise<Auth | null> {
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/.exec(req.headers.get('Authorization') ?? '');
  if (!m) return null;
  const row = await env.DB.prepare(
    `SELECT s.id, s.household_id, s.device_id, h.grace_until
       FROM sessions s JOIN households h ON h.id = s.household_id
      WHERE s.access_hash = ? AND s.revoked = 0 AND s.access_expires > ?`
  ).bind(await sha256Hex(m[1]), now).first<any>();
  return row ? { sessionId: row.id, householdId: row.household_id, deviceId: row.device_id, graceUntil: row.grace_until } : null;
}

const clientIp = (req: Request) => req.headers.get('CF-Connecting-IP') ?? 'unknown';
const validDevice = (d: unknown): d is string => typeof d === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(d);

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const h = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    const now = Date.now();

    try {
      // --- Criação de família: somente dev até o Marco 4 (Pix cria o acesso) ---
      if (req.method === 'POST' && url.pathname === '/v1/dev/households') {
        if (env.ALLOW_DEV_SIGNUP !== 'true') return json({ error: 'not_found' }, 404, h);
        const code = randomCode();
        const id = crypto.randomUUID();
        await env.DB.prepare('INSERT INTO households (id, code_hash, created_at) VALUES (?,?,?)')
          .bind(id, await hashCode(env, code), now).run();
        return json({ code }, 201, h);
      }

      // --- Login com código de acesso ---
      if (req.method === 'POST' && url.pathname === '/v1/sessions') {
        const ip = clientIp(req);
        if (!(await hit(env.DB, `login:ip:${ip}`, 10, 15 * 60_000, now))) return json({ error: 'rate_limited' }, 429, h);
        const body = await readJson(req);
        if (!body || typeof body.code !== 'string' || !validDevice(body.deviceId)) return json({ error: 'bad_request' }, 400, h);
        if (!(await hit(env.DB, `login:dev:${body.deviceId}`, 10, 15 * 60_000, now))) return json({ error: 'rate_limited' }, 429, h);
        const hh = await env.DB.prepare('SELECT id FROM households WHERE code_hash = ?')
          .bind(await hashCode(env, body.code)).first<{ id: string }>();
        if (!hh) return json({ error: 'invalid_code' }, 401, h);
        return json(await issueSession(env, hh.id, body.deviceId, now), 201, h);
      }

      // --- Renovação (rotação do refresh token) ---
      if (req.method === 'POST' && url.pathname === '/v1/sessions/refresh') {
        const body = await readJson(req);
        if (!body || typeof body.refreshToken !== 'string') return json({ error: 'bad_request' }, 400, h);
        if (!(await hit(env.DB, `refresh:ip:${clientIp(req)}`, 60, 15 * 60_000, now))) return json({ error: 'rate_limited' }, 429, h);
        const row = await env.DB.prepare(
          'SELECT id, household_id, device_id FROM sessions WHERE refresh_hash = ? AND revoked = 0 AND refresh_expires > ?'
        ).bind(await sha256Hex(body.refreshToken), now).first<any>();
        if (!row) return json({ error: 'invalid_refresh' }, 401, h);
        // rotação: o refresh antigo deixa de valer
        await env.DB.prepare('UPDATE sessions SET revoked = 1 WHERE id = ?').bind(row.id).run();
        return json(await issueSession(env, row.household_id, row.device_id, now), 201, h);
      }

      // ===================== Planos e checkout (público) =====================
      if (req.method === 'GET' && url.pathname === '/v1/plans')
        return json({ paymentsEnabled: env.PAYMENTS_ENABLED === 'true', entry: ENTRY_PLANS.map((id) => PLANS[id]), renewal: RENEWAL_PLANS.map((id) => PLANS[id]) }, 200, h);

      if (req.method === 'POST' && url.pathname === '/v1/checkout') {
        if (env.PAYMENTS_ENABLED !== 'true') return json({ error: 'payments_disabled' }, 503, h);
        const body = await readJson(req);
        const email = normEmail(body?.email), cpf = normCpf(body?.cpf);
        if (!body || !ENTRY_PLANS.includes(body.plan)) return json({ error: 'invalid_plan' }, 400, h);
        if (!email) return json({ error: 'invalid_email' }, 422, h);
        if (!cpf) return json({ error: 'invalid_cpf' }, 422, h);
        if (!(await hit(env.DB, `checkout:ip:${clientIp(req)}`, 8, 3600_000, now))) return json({ error: 'rate_limited' }, 429, h);
        if (!(await hit(env.DB, `checkout:em:${await sha256Hex(email)}`, 5, 3600_000, now))) return json({ error: 'rate_limited' }, 429, h);
        const pix = await createPix(env, { kind: 'entry', plan: PLANS[body.plan], email, cpf, now, tracking: trackingFrom(body, req, env) });
        return pix ? json(pix, 201, h) : json({ error: 'provider_unavailable' }, 502, h);
      }

      if (req.method === 'POST' && url.pathname === '/v1/checkout/status') {
        const body = await readJson(req);
        if (!body || typeof body.paymentId !== 'string') return json({ error: 'bad_request' }, 400, h);
        if (!(await hit(env.DB, `cstatus:${body.paymentId}`, 120, 600_000, now))) return json({ error: 'rate_limited' }, 429, h);
        const st = await paymentStatus(env, body.paymentId, body.pollToken, now);
        return st ? json(st, 200, h) : json({ error: 'not_found' }, 404, h);
      }

      if (req.method === 'POST' && url.pathname === '/v1/checkout/claim') {
        const body = await readJson(req);
        if (!body || typeof body.paymentId !== 'string' || !validDevice(body.deviceId)) return json({ error: 'bad_request' }, 400, h);
        if (!(await hit(env.DB, `claim:ip:${clientIp(req)}`, 20, 3600_000, now))) return json({ error: 'rate_limited' }, 429, h);
        const r = await claimAccess(env, body.paymentId, body.pollToken, body.deviceId, now);
        if ('error' in r) return json({ error: r.error }, r.error === 'not_found' ? 404 : r.error === 'not_paid' ? 409 : 410, h);
        return json(r, 200, h);
      }

      // Webhook do Mercado Pago: só confia na assinatura + consulta à API (nunca no corpo).
      if (req.method === 'POST' && url.pathname === '/v1/webhooks/mercadopago') {
        const body = (await readJson(req)) ?? {};
        const type = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? body.type ?? body.topic;
        const dataId = url.searchParams.get('data.id') ?? (body.data?.id != null ? String(body.data.id) : null);
        if (!(await verifyMpSignature(env.MP_WEBHOOK_SECRET, req.headers.get('x-signature'), req.headers.get('x-request-id'), dataId)))
          return json({ error: 'bad_signature' }, 401, h);
        if (type !== 'payment' || !dataId) return json({ ok: true, ignored: true }, 200, h);
        try {
          return json({ ok: true, result: await handleMpEvent(env, dataId, now) }, 200, h);
        } catch (e) {
          console.error('webhook_fail', (e as Error).message);
          return json({ error: 'try_again' }, 503, h); // o MP reenvia
        }
      }

      // ===================== Analytics agregado (sem identificador) =====================
      if (req.method === 'POST' && url.pathname === '/v1/analytics') {
        const body = await readJson(req);
        if (!body || typeof body.event !== 'string' || !FUNNEL_EVENTS.has(body.event)) return json({ error: 'bad_request' }, 400, h);
        if (!(await hit(env.DB, `an:ip:${clientIp(req)}`, 300, 3600_000, now))) return json({ error: 'rate_limited' }, 429, h);
        await countEvent(env, body.event, now);
        return new Response(null, { status: 204, headers: h });
      }

      // ===================== Administração mínima (token) =====================
      if (url.pathname.startsWith('/v1/admin/')) {
        if (!env.ADMIN_TOKEN) return json({ error: 'not_found' }, 404, h);
        if (!(await hit(env.DB, `admin:ip:${clientIp(req)}`, 60, 600_000, now))) return json({ error: 'rate_limited' }, 429, h);
        if (!adminOk(env, req)) return json({ error: 'unauthorized' }, 401, h);
        if (req.method === 'GET' && url.pathname === '/v1/admin/feedback.csv') {
          return new Response(await feedbackCsv(env, url.searchParams.get('status')), { status: 200, headers: { ...h, 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename="sugestoes.csv"' } });
        }
        if (req.method === 'POST' && url.pathname === '/v1/admin/feedback/status') {
          const b = await readJson(req);
          if (!b || typeof b.id !== 'string' || !STATUSES.includes(b.status)) return json({ error: 'bad_request' }, 400, h);
          const r = await env.DB.prepare('UPDATE feedback_suggestions SET status = ? WHERE id = ?').bind(b.status, b.id).run();
          return json({ updated: r.meta.changes }, 200, h);
        }
        if (req.method === 'POST' && url.pathname === '/v1/admin/feedback/delete') {
          const b = await readJson(req);
          if (!b || typeof b.id !== 'string') return json({ error: 'bad_request' }, 400, h);
          const r = await env.DB.prepare('DELETE FROM feedback_suggestions WHERE id = ?').bind(b.id).run();
          return json({ deleted: r.meta.changes }, 200, h);
        }
        if (req.method === 'GET' && url.pathname === '/v1/admin/metrics') {
          const from = url.searchParams.get('from') ?? '1970-01-01', to = url.searchParams.get('to') ?? '9999-12-31';
          return json(await adminMetrics(env, from, to), 200, h);
        }
        return json({ error: 'not_found' }, 404, h);
      }

      // ===================== Recuperação de acesso =====================
      if (req.method === 'POST' && url.pathname === '/v1/recovery/request') {
        const body = await readJson(req);
        const email = normEmail(body?.email);
        if (!email) return json({ error: 'invalid_email' }, 422, h);
        if (!(await hit(env.DB, `rec:ip:${clientIp(req)}`, 5, 3600_000, now)) || !(await hit(env.DB, `rec:em:${await sha256Hex(email)}`, 3, 86_400_000, now)))
          return json({ error: 'rate_limited' }, 429, h);
        await requestRecovery(env, email, now);
        return json({ ok: true }, 200, h); // resposta idêntica exista ou não o e-mail
      }
      if (req.method === 'POST' && url.pathname === '/v1/recovery/confirm') {
        const body = await readJson(req);
        if (!body || !validDevice(body.deviceId)) return json({ error: 'bad_request' }, 400, h);
        if (!(await hit(env.DB, `recc:ip:${clientIp(req)}`, 10, 3600_000, now))) return json({ error: 'rate_limited' }, 429, h);
        const r = await confirmRecovery(env, body.token, body.deviceId, now);
        return r ? json(r, 200, h) : json({ error: 'invalid_or_expired' }, 410, h);
      }

      if (req.method === 'GET' && url.pathname === '/v1/dev/outbox') {
        if (env.ALLOW_DEV_SIGNUP !== 'true') return json({ error: 'not_found' }, 404, h);
        const to = url.searchParams.get('to') ?? '';
        const rows = await env.DB.prepare('SELECT subject, body, created_at FROM email_outbox WHERE to_email = ? ORDER BY id').bind(to).all();
        return json({ messages: rows.results }, 200, h);
      }

      if (req.method === 'GET' && url.pathname === '/v1/push/key')
        return json({ publicKey: env.VAPID_PUBLIC_KEY }, 200, h);

      // Execução manual do Cron com relógio controlado — só em desenvolvimento.
      if (req.method === 'POST' && url.pathname === '/v1/dev/tick') {
        if (env.ALLOW_DEV_SIGNUP !== 'true') return json({ error: 'not_found' }, 404, h);
        const body = (await readJson(req)) ?? {};
        return json(await runDue(env, Number.isSafeInteger(body.now) ? body.now : now), 200, h);
      }

      // --- Daqui em diante: autenticado ---
      const auth = await authenticate(env, req, now);
      if (!auth) return json({ error: 'unauthorized' }, 401, h);

      if (req.method === 'POST' && url.pathname === '/v1/sessions/logout') {
        await env.DB.prepare('UPDATE sessions SET revoked = 1 WHERE id = ?').bind(auth.sessionId).run();
        return json({ ok: true }, 200, h);
      }

      // ===================== Conta e renovação (autenticado) =====================
      if (req.method === 'POST' && url.pathname === '/v1/billing/account') {
        return json(await accountState(env, auth.householdId, now), 200, h);
      }
      if (req.method === 'POST' && url.pathname === '/v1/billing/renew') {
        if (env.PAYMENTS_ENABLED !== 'true') return json({ error: 'payments_disabled' }, 503, h);
        const body = await readJson(req);
        const cpf = normCpf(body?.cpf);
        if (!body || !RENEWAL_PLANS.includes(body.plan)) return json({ error: 'invalid_plan' }, 400, h);
        if (!cpf) return json({ error: 'invalid_cpf' }, 422, h);
        const email = normEmail(body.email) ?? (await lastPayerEmail(env, auth.householdId));
        if (!email) return json({ error: 'invalid_email' }, 422, h);
        if (!(await hit(env.DB, `renew:${auth.householdId}`, 10, 3600_000, now))) return json({ error: 'rate_limited' }, 429, h);
        const pix = await createPix(env, { kind: 'renewal', plan: PLANS[body.plan], email, cpf, householdId: auth.householdId, now, tracking: trackingFrom(body, req, env) });
        return pix ? json(pix, 201, h) : json({ error: 'provider_unavailable' }, 502, h);
      }

      // ===================== Privacidade (LGPD): portabilidade e exclusão =====================
      if (req.method === 'POST' && url.pathname === '/v1/privacy/export') {
        if (!(await hit(env.DB, `pexp:${auth.householdId}`, 5, 3600_000, now))) return json({ error: 'rate_limited' }, 429, h);
        return json(await exportHousehold(env, auth.householdId, now), 200, h);
      }
      if (req.method === 'POST' && url.pathname === '/v1/privacy/delete') {
        const body = await readJson(req);
        if (body?.confirm !== 'APAGAR') return json({ error: 'confirmation_required' }, 400, h); // evita exclusão acidental
        await purgeHousehold(env, auth.householdId);
        return json({ ok: true }, 200, h);
      }

      if (req.method === 'POST' && url.pathname === '/v1/feedback') {
        const body = await readJson(req);
        const r = await submitFeedback(env, auth.householdId, body, now);
        return r === 'ok' ? json({ ok: true }, 201, h) : json({ error: r }, r === 'rate_limited' ? 429 : 422, h);
      }

      if (req.method === 'POST' && url.pathname === '/v1/sync') {
        const body = await readJson(req);
        if (!body || !Array.isArray(body.changes) || !Number.isSafeInteger(body.cursor) || body.cursor < 0)
          return json({ error: 'bad_request' }, 400, h);
        if (body.changes.length > MAX_CHANGES) return json({ error: 'too_many_changes' }, 413, h);
        if (!(await hit(env.DB, `sync:${auth.householdId}`, 120, 60_000, now))) return json({ error: 'rate_limited' }, 429, h);

        const changes: WireRecord[] = [];
        for (const raw of body.changes) {
          const rec = parseRecord(raw);
          if (!rec) return json({ error: 'invalid_event' }, 422, h);
          changes.push({ ...rec, updatedAt: Math.min(rec.updatedAt, now + CLOCK_SKEW) });
        }

        // Vencido além da carência: leitura continua, escrita não.
        if (changes.length && auth.graceUntil != null && now > auth.graceUntil)
          return json({ error: 'expired' }, 403, h);

        await applyChanges(env, auth.householdId, changes, now);
        return json(await changesSince(env, auth.householdId, body.cursor, PAGE), 200, h);
      }

      // --- Push ---
      if (req.method === 'POST' && url.pathname === '/v1/push/subscribe') {
        const body = await readJson(req);
        const k = body?.keys;
        if (!body || typeof body.endpoint !== 'string' || typeof k?.p256dh !== 'string' || typeof k?.auth !== 'string')
          return json({ error: 'bad_request' }, 400, h);
        if (!endpointAllowed(env, body.endpoint)) return json({ error: 'endpoint_not_allowed' }, 422, h);
        if (k.p256dh.length > 100 || k.auth.length > 40) return json({ error: 'bad_request' }, 400, h);
        if (!(await hit(env.DB, `sub:${auth.householdId}`, 20, 3600_000, now))) return json({ error: 'rate_limited' }, 429, h);
        await saveSubscription(env, auth.householdId, auth.deviceId, { endpoint: body.endpoint, p256dh: k.p256dh, auth: k.auth, privacy: !!body.privacy }, now);
        return json({ ok: true }, 201, h);
      }
      if (req.method === 'POST' && url.pathname === '/v1/push/unsubscribe') {
        const body = await readJson(req);
        if (!body || typeof body.endpoint !== 'string') return json({ error: 'bad_request' }, 400, h);
        await removeSubscription(env, auth.householdId, body.endpoint);
        return json({ ok: true }, 200, h);
      }
      if (req.method === 'POST' && url.pathname === '/v1/push/test') {
        if (!(await hit(env.DB, `pushtest:${auth.householdId}`, 5, 3600_000, now))) return json({ error: 'rate_limited' }, 429, h);
        const sent = await pushToHousehold(env, auth.householdId, { title: 'Rotininha', body: 'Tudo certo! Os lembretes chegam neste aparelho. 💜', tag: 'test' }, now);
        return json({ sent }, 200, h);
      }

      // --- Ajustes da família ---
      if (req.method === 'POST' && url.pathname === '/v1/settings') {
        const body = await readJson(req);
        if (!body || typeof body.timezone !== 'string' || !isValidTimeZone(body.timezone)) return json({ error: 'bad_request' }, 400, h);
        if (body.timezone !== (await householdTz(env, auth.householdId))) {
          await env.DB.prepare('UPDATE households SET timezone = ? WHERE id = ?').bind(body.timezone, auth.householdId).run();
          await rescheduleAll(env, auth.householdId, body.timezone, now);
        }
        return json({ ok: true }, 200, h);
      }

      return json({ error: 'not_found' }, 404, h);
    } catch (e) {
      console.error('unhandled', (e as Error).message); // sem tokens/códigos nos logs
      return json({ error: 'server_error' }, 500, h);
    }
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runDue(env, Date.now()).then((r) => console.log('cron', JSON.stringify(r))));
  }
};
