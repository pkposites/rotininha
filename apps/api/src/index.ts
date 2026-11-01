import type { Env, Auth, ClientEvent } from './types';
import { sha256Hex, randomCode, normalizeCode, randomToken } from './crypto';
import { parseEvent, MAX_CHANGES } from './validate';
import { hit } from './ratelimit';

const ACCESS_TTL = 60 * 60 * 1000;            // 1 h
const REFRESH_TTL = 30 * 24 * 60 * 60 * 1000; // 30 dias
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

const json = (data: unknown, status: number, h: Record<string, string>) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...h } });

async function readJson(req: Request): Promise<any | null> {
  try {
    const text = await req.text();
    if (text.length > 200_000) return null;
    return JSON.parse(text);
  } catch { return null; }
}

async function hashCode(env: Env, code: string) {
  return sha256Hex(env.CODE_PEPPER + ':' + normalizeCode(code));
}

async function issueSession(env: Env, householdId: string, deviceId: string, now: number) {
  const access = randomToken(), refresh = randomToken(), id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO sessions (id, household_id, device_id, access_hash, access_expires, refresh_hash, refresh_expires, created_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).bind(id, householdId, deviceId, await sha256Hex(access), now + ACCESS_TTL, await sha256Hex(refresh), now + REFRESH_TTL, now).run();
  return { accessToken: access, refreshToken: refresh, accessExpiresAt: now + ACCESS_TTL };
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

      // --- Daqui em diante: autenticado ---
      const auth = await authenticate(env, req, now);
      if (!auth) return json({ error: 'unauthorized' }, 401, h);

      if (req.method === 'POST' && url.pathname === '/v1/sessions/logout') {
        await env.DB.prepare('UPDATE sessions SET revoked = 1 WHERE id = ?').bind(auth.sessionId).run();
        return json({ ok: true }, 200, h);
      }

      if (req.method === 'POST' && url.pathname === '/v1/sync') {
        const body = await readJson(req);
        if (!body || !Array.isArray(body.changes) || !Number.isSafeInteger(body.cursor) || body.cursor < 0)
          return json({ error: 'bad_request' }, 400, h);
        if (body.changes.length > MAX_CHANGES) return json({ error: 'too_many_changes' }, 413, h);
        if (!(await hit(env.DB, `sync:${auth.householdId}`, 120, 60_000, now))) return json({ error: 'rate_limited' }, 429, h);

        const changes: ClientEvent[] = [];
        for (const raw of body.changes) {
          const ev = parseEvent(raw);
          if (!ev) return json({ error: 'invalid_event' }, 422, h);
          changes.push({ ...ev, updatedAt: Math.min(ev.updatedAt, now + CLOCK_SKEW) });
        }

        // Vencido além da carência: leitura continua, escrita não.
        if (changes.length && auth.graceUntil != null && now > auth.graceUntil)
          return json({ error: 'expired' }, 403, h);

        if (changes.length) {
          // Último vence (LWW por updatedAt); idempotente por (household, id).
          const existing = new Map<string, number>();
          const ids = changes.map((c) => c.id);
          const q = await env.DB.prepare(
            `SELECT id, updated_at FROM care_events WHERE household_id = ? AND id IN (${ids.map(() => '?').join(',')})`
          ).bind(auth.householdId, ...ids).all<{ id: string; updated_at: number }>();
          for (const r of q.results) existing.set(r.id, r.updated_at);

          const winners = new Map<string, ClientEvent>();
          for (const c of changes) {
            const cur = winners.get(c.id);
            if (cur && cur.updatedAt >= c.updatedAt) continue;
            const ex = existing.get(c.id);
            if (ex != null && ex >= c.updatedAt) continue;
            winners.set(c.id, c);
          }

          if (winners.size) {
            const r = await env.DB.prepare('UPDATE households SET seq = seq + ? WHERE id = ? RETURNING seq')
              .bind(winners.size, auth.householdId).first<{ seq: number }>();
            let seq = (r!.seq) - winners.size;
            const stmts = [...winners.values()].map((c) =>
              env.DB.prepare(
                `INSERT INTO care_events (household_id, id, type, started_at, ended_at, note, detail, updated_at, deleted, seq)
                 VALUES (?,?,?,?,?,?,?,?,?,?)
                 ON CONFLICT(household_id, id) DO UPDATE SET
                   type=excluded.type, started_at=excluded.started_at, ended_at=excluded.ended_at,
                   note=excluded.note, detail=excluded.detail, updated_at=excluded.updated_at,
                   deleted=excluded.deleted, seq=excluded.seq
                 WHERE excluded.updated_at > care_events.updated_at`
              ).bind(auth.householdId, c.id, c.type, c.startedAt, c.endedAt, c.note, c.detail, c.updatedAt, c.deleted ? 1 : 0, ++seq)
            );
            await env.DB.batch(stmts);
          }
        }

        const rows = await env.DB.prepare(
          `SELECT id, type, started_at, ended_at, note, detail, updated_at, deleted, seq
             FROM care_events WHERE household_id = ? AND seq > ? ORDER BY seq LIMIT ?`
        ).bind(auth.householdId, body.cursor, PAGE + 1).all<any>();
        const more = rows.results.length > PAGE;
        const page = rows.results.slice(0, PAGE);
        return json({
          cursor: page.length ? page[page.length - 1].seq : body.cursor,
          more,
          changes: page.map((r) => ({
            id: r.id, type: r.type, startedAt: r.started_at, endedAt: r.ended_at, note: r.note,
            detail: r.detail, updatedAt: r.updated_at, deleted: !!r.deleted
          }))
        }, 200, h);
      }

      return json({ error: 'not_found' }, 404, h);
    } catch (e) {
      console.error('unhandled', (e as Error).message); // sem tokens/códigos nos logs
      return json({ error: 'server_error' }, 500, h);
    }
  }
};
