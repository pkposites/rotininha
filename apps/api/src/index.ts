import type { Env, Auth, WireRecord } from './types';
import { sha256Hex, randomCode, normalizeCode, randomToken } from './crypto';
import { parseRecord, MAX_CHANGES } from './validate';
import { applyChanges, changesSince, householdTz, rescheduleAll } from './records';
import { saveSubscription, removeSubscription, endpointAllowed, pushToHousehold, runDue, saveAdminSubscription, removeAdminSubscription, adminDeviceCount, notifyAdmins } from './push';
import { isValidTimeZone } from '../../../packages/shared/schedule.js';
import { PLANS, ENTRY_PLANS, RENEWAL_PLANS, DAY_MS } from './plans';
import { trackingFrom, createPix, paymentStatus, claimAccess, handleMpEvent, accountState, lastPayerEmail, requestRecovery, confirmRecovery, resetPasswordWithToken, reconcilePending } from './billing';
import { verifyMpSignature } from './mpsig';
import { normEmail, normCpf } from './validate';
import { exportHousehold, purgeHousehold } from './privacy';
import { adminGrowth } from './admin';
import { startTrial } from './trial';
import { recordUsage, deleteUsage, recordClick, runCampaigns, runAutomations } from './growth';
import { applyEnforcement, trialConfig, enforcementActive } from './settings';
import { validBirthDate } from '../../../packages/shared/leaps.js';
import { localParts } from '../../../packages/shared/schedule.js';
import { submitFeedback, countEvent, FUNNEL_EVENTS, adminOk, feedbackCsv, adminMetrics, STATUSES } from './feedback';
import { hit } from './ratelimit';
import { hashCode, issueSession } from './session';
import { normalizePhone, checkPassword, hashPhone, makePassword, verifyLogin } from './password';

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

/** Campanhas a cada minuto; automações a cada 5; início da cobrança do teste a cada hora. `force` (testes) roda tudo. */
async function runGrowth(env: Env, now: number, force: boolean) {
  const minute = Math.floor(now / 60000);
  const out: Record<string, unknown> = { campaigns: await runCampaigns(env, now) };
  if (force || minute % 5 === 0) out.automations = await runAutomations(env, now);
  if (force || minute % 60 === 0) out.enforced = await applyEnforcement(env, now);
  return out;
}

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

      // --- Login com WhatsApp + senha ---
      if (req.method === 'POST' && url.pathname === '/v1/sessions/password') {
        const body = await readJson(req);
        const phone = normalizePhone(body?.whatsapp);
        if (!body || !phone || typeof body.password !== 'string' || body.password.length > 128 || !validDevice(body.deviceId)) return json({ error: 'bad_request' }, 400, h);
        if (!(await hit(env.DB, `login:ip:${clientIp(req)}`, 10, 15 * 60_000, now))) return json({ error: 'rate_limited' }, 429, h);
        if (!(await hit(env.DB, `login:wa:${await hashPhone(env, phone)}`, 8, 15 * 60_000, now))) return json({ error: 'rate_limited' }, 429, h);
        const id = await verifyLogin(env, phone, body.password);
        if (!id) return json({ error: 'invalid_credentials' }, 401, h);
        return json(await issueSession(env, id, body.deviceId, now), 201, h);
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
      if (req.method === 'GET' && url.pathname === '/v1/plans') {
        const tc = await trialConfig(env);
        return json({
          paymentsEnabled: env.PAYMENTS_ENABLED === 'true',
          emailRecovery: env.EMAIL_PROVIDER === 'dev' || (env.EMAIL_PROVIDER === 'resend' && !!env.RESEND_API_KEY && !!env.EMAIL_FROM), // recuperação por e-mail só funciona com provedor configurado
          trial: { days: tc.days, enforceFrom: tc.enforceFrom, active: enforcementActive(tc, now), noticeDays: tc.noticeDays },
          entry: ENTRY_PLANS.map((id) => PLANS[id]), renewal: RENEWAL_PLANS.map((id) => PLANS[id])
        }, 200, h);
      }

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

      // ===================== Teste grátis (cria a conta, sem senha) =====================
      if (req.method === 'POST' && url.pathname === '/v1/trial/start') {
        const body = await readJson(req);
        if (!body || !validDevice(body.deviceId)) return json({ error: 'bad_request' }, 400, h);
        if (!(await hit(env.DB, `trial:ip:${clientIp(req)}`, 6, 86_400_000, now)) || !(await hit(env.DB, `trial:dev:${body.deviceId}`, 2, 86_400_000, now)))
          return json({ error: 'rate_limited' }, 429, h);
        if (body.whatsapp !== undefined || body.password !== undefined) {
          const phone = normalizePhone(body.whatsapp);
          if (!phone) return json({ error: 'invalid_whatsapp' }, 422, h);
          if (checkPassword(body.password, phone) !== 'ok') return json({ error: 'weak_password' }, 422, h);
          const phone_hash = await hashPhone(env, phone);
          if (await env.DB.prepare('SELECT 1 AS x FROM households WHERE phone_hash = ?').bind(phone_hash).first()) return json({ error: 'phone_in_use' }, 409, h);
          try {
            return json(await startTrial(env, { deviceId: body.deviceId, email: body.email, now, credentials: { phone_hash, ...(await makePassword(env, body.password)) } }), 201, h);
          } catch (e) { if (/UNIQUE/i.test((e as Error).message)) return json({ error: 'phone_in_use' }, 409, h); throw e; }
        }
        return json(await startTrial(env, { deviceId: body.deviceId, email: body.email, now }), 201, h);
      }

      // Clique numa notificação promocional (sid único no payload; não identifica a pessoa por si só)
      if (req.method === 'POST' && url.pathname === '/v1/push/click') {
        const body = await readJson(req);
        if (!body || typeof body.sid !== 'string' || body.sid.length > 64) return json({ error: 'bad_request' }, 400, h);
        if (!(await hit(env.DB, `click:ip:${clientIp(req)}`, 120, 3600_000, now))) return json({ error: 'rate_limited' }, 429, h);
        await recordClick(env, body.sid, now);
        return new Response(null, { status: 204, headers: h });
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
        if (!(await hit(env.DB, `admin:ip:${clientIp(req)}`, 300, 600_000, now))) return json({ error: 'rate_limited' }, 429, h);
        if (!adminOk(env, req)) {
          // senha errada: no máximo 8 tentativas a cada 10 min por IP (a senha certa nunca passa por aqui)
          if (!(await hit(env.DB, `adminfail:ip:${clientIp(req)}`, 8, 600_000, now))) return json({ error: 'rate_limited' }, 429, h);
          return json({ error: 'unauthorized' }, 401, h);
        }
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
        if (req.method === 'GET' && url.pathname === '/v1/admin/push') return json({ devices: await adminDeviceCount(env) }, 200, h);
        if (req.method === 'POST' && url.pathname === '/v1/admin/push/subscribe') {
          const b = await readJson(req); const k = b?.keys;
          if (!b || typeof b.endpoint !== 'string' || typeof k?.p256dh !== 'string' || typeof k?.auth !== 'string' || k.p256dh.length > 100 || k.auth.length > 40) return json({ error: 'bad_request' }, 400, h);
          if (!endpointAllowed(env, b.endpoint)) return json({ error: 'endpoint_not_allowed' }, 422, h);
          if (!(await saveAdminSubscription(env, { endpoint: b.endpoint, p256dh: k.p256dh, auth: k.auth }, now))) return json({ error: 'too_many_devices' }, 409, h);
          return json({ ok: true, devices: await adminDeviceCount(env) }, 201, h);
        }
        if (req.method === 'POST' && url.pathname === '/v1/admin/push/unsubscribe') {
          const b = await readJson(req);
          if (!b || typeof b.endpoint !== 'string') return json({ error: 'bad_request' }, 400, h);
          await removeAdminSubscription(env, b.endpoint);
          return json({ ok: true, devices: await adminDeviceCount(env) }, 200, h);
        }
        if (req.method === 'POST' && url.pathname === '/v1/admin/push/test') {
          const sent = await notifyAdmins(env, { title: 'Ninhora · painel', body: 'Tudo certo! Você vai receber aqui o aviso de cada compra. 💜', tag: 'admin-test' }, now);
          return json({ sent }, 200, h);
        }
        const g = await adminGrowth(env, req, url, now, h, json, readJson);
        return g ?? json({ error: 'not_found' }, 404, h);
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

      if (req.method === 'POST' && url.pathname === '/v1/recovery/password') {
        const body = await readJson(req);
        if (!body || !validDevice(body.deviceId)) return json({ error: 'bad_request' }, 400, h);
        if (!(await hit(env.DB, `recp:ip:${clientIp(req)}`, 10, 3600_000, now))) return json({ error: 'rate_limited' }, 429, h);
        const r = await resetPasswordWithToken(env, { token: body.token, password: body.password, whatsapp: body.whatsapp, deviceId: body.deviceId, now });
        if ('error' in r) return json({ error: r.error }, r.error === 'invalid_or_expired' ? 410 : r.error === 'phone_in_use' ? 409 : 422, h);
        return json(r, 200, h);
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
        const at = Number.isSafeInteger(body.now) ? body.now : now;
        const due = await runDue(env, at);
        return json({ ...due, growth: await runGrowth(env, at, true), payments: await reconcilePending(env, at) }, 200, h);
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
        const cur = await env.DB.prepare('SELECT plan, valid_until FROM households WHERE id = ?').bind(auth.householdId).first<{ plan: string; valid_until: number | null }>();
        if (cur?.plan === 'paid' && cur.valid_until != null && cur.valid_until > now + 3650 * DAY_MS) return json({ error: 'already_lifetime' }, 409, h);
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
        await env.DB.prepare('UPDATE households SET last_seen_at = ? WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < ?)').bind(now, auth.householdId, now - 600_000).run();
        if (changes.some((c) => c.kind === 'event' && !c.deleted))
          await env.DB.prepare('UPDATE households SET first_care_at = ? WHERE id = ? AND first_care_at IS NULL').bind(now, auth.householdId).run();
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
        const sent = await pushToHousehold(env, auth.householdId, { title: 'Ninhora', body: 'Tudo certo! Os lembretes chegam neste aparelho. 💜', tag: 'test' }, now);
        return json({ sent }, 200, h);
      }

      // --- Ajustes da família (qualquer subconjunto) ---
      if (req.method === 'POST' && url.pathname === '/v1/account/password') {
        const body = await readJson(req);
        const phone = normalizePhone(body?.whatsapp);
        if (!phone) return json({ error: 'invalid_whatsapp' }, 422, h);
        if (checkPassword(body.password, phone) !== 'ok') return json({ error: 'weak_password' }, 422, h);
        if (!(await hit(env.DB, `pw:${auth.householdId}`, 10, 3600_000, now))) return json({ error: 'rate_limited' }, 429, h);
        const phone_hash = await hashPhone(env, phone);
        const other = await env.DB.prepare('SELECT id FROM households WHERE phone_hash = ? AND id <> ?').bind(phone_hash, auth.householdId).first();
        if (other) return json({ error: 'phone_in_use' }, 409, h);
        const pw = await makePassword(env, body.password);
        await env.DB.prepare('UPDATE households SET phone_hash = ?, pw_hash = ?, pw_salt = ? WHERE id = ?').bind(phone_hash, pw.pw_hash, pw.pw_salt, auth.householdId).run();
        return json({ ok: true }, 200, h);
      }

      if (req.method === 'POST' && url.pathname === '/v1/settings') {
        const body = await readJson(req);
        if (!body || typeof body !== 'object') return json({ error: 'bad_request' }, 400, h);
        const sets: string[] = [], vals: any[] = [];
        if (body.timezone !== undefined) {
          if (typeof body.timezone !== 'string' || !isValidTimeZone(body.timezone)) return json({ error: 'bad_request' }, 400, h);
          if (body.timezone !== (await householdTz(env, auth.householdId))) {
            await env.DB.prepare('UPDATE households SET timezone = ? WHERE id = ?').bind(body.timezone, auth.householdId).run();
            await rescheduleAll(env, auth.householdId, body.timezone, now);
          }
        }
        if (body.tips !== undefined) { if (typeof body.tips !== 'boolean') return json({ error: 'bad_request' }, 400, h); sets.push('tips_opt_in = ?'); vals.push(body.tips ? 1 : 0); }
        if (body.usage !== undefined) {
          if (typeof body.usage !== 'boolean') return json({ error: 'bad_request' }, 400, h);
          sets.push('usage_opt_in = ?'); vals.push(body.usage ? 1 : 0);
          if (!body.usage) await deleteUsage(env, auth.householdId); // sair apaga o histórico de uso
        }
        if (body.babyBirthDate !== undefined) {
          const tz = await householdTz(env, auth.householdId);
          if (body.babyBirthDate !== null && !validBirthDate(body.babyBirthDate, localParts(now, tz).date)) return json({ error: 'bad_birth_date' }, 422, h);
          sets.push('baby_birth_date = ?'); vals.push(body.babyBirthDate);
        }
        if (body.contactEmail !== undefined) {
          const em = body.contactEmail === null ? null : normEmail(body.contactEmail);
          if (body.contactEmail !== null && !em) return json({ error: 'invalid_email' }, 422, h);
          sets.push('contact_email = ?'); vals.push(em);
        }
        if (sets.length) await env.DB.prepare(`UPDATE households SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, auth.householdId).run();
        return json({ ok: true }, 200, h);
      }

      // --- Uso do app (contagens por dia; sem conteúdo nem dados do bebê) ---
      if (req.method === 'POST' && url.pathname === '/v1/usage') {
        const body = await readJson(req);
        if (!body || !Array.isArray(body.events)) return json({ error: 'bad_request' }, 400, h);
        if (!(await hit(env.DB, `usage:${auth.householdId}`, 60, 3600_000, now))) return json({ error: 'rate_limited' }, 429, h);
        const evs = body.events.filter((e: any) => e && typeof e.event === 'string').map((e: any) => ({ event: e.event, n: Number(e.n) }));
        return json({ recorded: await recordUsage(env, auth.householdId, evs, now) }, 200, h);
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
        const sent = await pushToHousehold(env, auth.householdId, { title: 'Ninhora', body: 'Tudo certo! Os lembretes chegam neste aparelho. 💜', tag: 'test' }, now);
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
    ctx.waitUntil((async () => {
      const now = Date.now();
      const r = await runDue(env, now);
      const g = await runGrowth(env, now, false);
      const pay = await reconcilePending(env, now);
      console.log('cron', JSON.stringify({ ...r, growth: g, payments: pay }));
    })());
  }
};
