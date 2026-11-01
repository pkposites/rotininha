import type { Env, WireRecord } from './types';
import { sendWebPush, type VapidConfig } from './webpush';
import { seal, unseal } from './seal';
import { householdTz, DEFAULT_TZ } from './records';
import { nextFire, inQuietHours, localParts, occId } from '../../../packages/shared/schedule.js';

const STALE_MS = 30 * 60_000;      // não envia lembrete atrasado mais de 30 min (Cron parado, por exemplo)
const MAX_FAILURES = 5;
const GENERIC_BODY = 'Você tem um lembrete do Rotininha';

// Só serviços de push conhecidos (evita SSRF por endpoint arbitrário). Em dev, localhost.
const PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
export function endpointAllowed(env: Env, endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    if (env.ALLOW_DEV_SIGNUP === 'true' && u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true;
    return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch { return false; }
}

const vapid = (env: Env): VapidConfig => ({ subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY });

export async function saveSubscription(
  env: Env, householdId: string, deviceId: string,
  s: { endpoint: string; p256dh: string; auth: string; privacy: boolean }, now: number
) {
  const sealed = await seal(env.PUSH_SEAL_KEY, { p256dh: s.p256dh, auth: s.auth });
  await env.DB.prepare(
    `INSERT INTO push_subscriptions (id, household_id, device_id, endpoint, keys_sealed, privacy, created_at)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(endpoint) DO UPDATE SET household_id=excluded.household_id, device_id=excluded.device_id,
       keys_sealed=excluded.keys_sealed, privacy=excluded.privacy, failures=0`
  ).bind(crypto.randomUUID(), householdId, deviceId, s.endpoint, sealed, s.privacy ? 1 : 0, now).run();
}

export const removeSubscription = (env: Env, householdId: string, endpoint: string) =>
  env.DB.prepare('DELETE FROM push_subscriptions WHERE household_id = ? AND endpoint = ?').bind(householdId, endpoint).run();

interface Message { title: string; body: string; occId?: string; tag: string }

/** Envia a todas as inscrições da família. Texto genérico quando `private`. Retorna quantas foram aceitas. */
export async function pushToHousehold(env: Env, householdId: string, msg: Message & { sensitive?: boolean }, now: number): Promise<number> {
  const subs = await env.DB.prepare('SELECT id, endpoint, keys_sealed, privacy, failures FROM push_subscriptions WHERE household_id = ?')
    .bind(householdId).all<any>();
  let ok = 0;
  await Promise.all(subs.results.map(async (s) => {
    try {
      const keys = await unseal(env.PUSH_SEAL_KEY, s.keys_sealed);
      const hide = s.privacy || msg.sensitive;
      const payload = {
        title: hide ? 'Rotininha' : msg.title,
        body: hide ? GENERIC_BODY : msg.body,
        tag: msg.tag, occId: msg.occId ?? null
      };
      const status = await sendWebPush({ endpoint: s.endpoint, ...keys }, payload, vapid(env), { now });
      if (status >= 200 && status < 300) {
        ok++;
        if (s.failures) await env.DB.prepare('UPDATE push_subscriptions SET failures = 0 WHERE id = ?').bind(s.id).run();
      } else if (status === 404 || status === 410) {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(s.id).run(); // inscrição expirada
      } else if (s.failures + 1 >= MAX_FAILURES) {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(s.id).run();
      } else {
        await env.DB.prepare('UPDATE push_subscriptions SET failures = failures + 1 WHERE id = ?').bind(s.id).run();
      }
    } catch (e) {
      console.error('push_fail', (e as Error).message);
    }
  }));
  return ok;
}

async function getRecord(env: Env, hh: string, kind: string, id: string): Promise<WireRecord | null> {
  const r = await env.DB.prepare('SELECT body, deleted FROM records WHERE household_id = ? AND kind = ? AND id = ?')
    .bind(hh, kind, id).first<{ body: string; deleted: number }>();
  return r ? { ...JSON.parse(r.body), deleted: !!r.deleted } : null;
}

export interface TickResult { due: number; sent: number; skipped: Record<string, number> }

/** Executado pelo Cron a cada minuto. Idempotente: reprocessar o mesmo minuto não reenvia. */
export async function runDue(env: Env, now: number): Promise<TickResult> {
  const res: TickResult = { due: 0, sent: 0, skipped: {} };
  const skip = (why: string) => { res.skipped[why] = (res.skipped[why] ?? 0) + 1; };

  const due = await env.DB.prepare(
    `SELECT household_id, kind, id, body, next_fire_at FROM records
      WHERE next_fire_at IS NOT NULL AND next_fire_at <= ? AND deleted = 0 ORDER BY next_fire_at LIMIT 200`
  ).bind(now).all<{ household_id: string; kind: string; id: string; body: string; next_fire_at: number }>();

  const tzCache = new Map<string, string>();
  const graceCache = new Map<string, number | null>();
  for (const row of due.results) {
    res.due++;
    const hh = row.household_id, fireAt = row.next_fire_at;
    let tz = tzCache.get(hh);
    if (!tz) { tz = await householdTz(env, hh).catch(() => DEFAULT_TZ); tzCache.set(hh, tz); }
    const rec: WireRecord = JSON.parse(row.body);
    // Acesso vencido além da carência: sem push (o app continua legível).
    let gu = graceCache.get(hh);
    if (gu === undefined) {
      gu = (await env.DB.prepare('SELECT grace_until FROM households WHERE id = ?').bind(hh).first<{ grace_until: number | null }>())?.grace_until ?? null;
      graceCache.set(hh, gu);
    }
    const expired = gu != null && fireAt > gu;

    // 1) reivindica o disparo (dedupe): quem inserir primeiro envia
    const claim = await env.DB.prepare('INSERT OR IGNORE INTO sent_notifications (key, sent_at) VALUES (?, ?)')
      .bind(`${hh}:${row.kind}:${row.id}:${fireAt}`, now).run();

    // 2) avança o relógio do registro (compare-and-set: não atropela edição concorrente)
    const nextAt = row.kind === 'task' ? (nextFire(rec as any, fireAt, tz)?.fireAt ?? null) : null;
    const adv = await env.DB.prepare(
      `UPDATE records SET next_fire_at = ? WHERE household_id = ? AND kind = ? AND id = ? AND next_fire_at = ?`
    ).bind(nextAt, hh, row.kind, row.id, fireAt).run();

    if (!claim.meta.changes) { skip('duplicate'); continue; }
    if (!adv.meta.changes) { skip('changed'); continue; }
    if (now - fireAt > STALE_MS) { skip('stale'); continue; }
    if (expired) { skip('expired'); continue; }

    // 3) descobre tarefa e ocorrência
    let task: WireRecord | null, date: string;
    if (row.kind === 'task') {
      task = rec;
      date = localParts(fireAt + (rec.leadMin ?? 0) * 60000, tz).date;
    } else {
      task = await getRecord(env, hh, 'task', rec.taskId);
      date = rec.date;
    }
    if (!task || task.deleted || task.notify === false) { skip('no_task'); continue; }
    const oid = occId(task.id, date);

    // 4) concluída/pulada/adiada → não notifica ("Feito" cancela alertas)
    const occ = row.kind === 'occ' ? rec : await getRecord(env, hh, 'occ', oid);
    if (occ && !occ.deleted) {
      if (occ.status === 'done' || occ.status === 'skipped') { skip('already_handled'); continue; }
      if (row.kind === 'task' && occ.status === 'snoozed') { skip('snoozed'); continue; }
      if (row.kind === 'occ' && occ.status !== 'snoozed') { skip('already_handled'); continue; }
    }

    // 5) silêncio 22h–6h, salvo lembrete que a família confirmou explicitamente
    if (inQuietHours(fireAt, tz) && !task.allowQuiet) { skip('quiet_hours'); continue; }

    const n = await pushToHousehold(env, hh, {
      title: task.title, body: row.kind === 'occ' ? 'Lembrete adiado' : 'Chegou a hora', tag: oid, occId: oid,
      sensitive: task.category === 'remedio'
    }, now);
    if (n) res.sent += n; else skip('no_subscription');
  }

  // limpeza leve da tabela de dedupe (mantém 3 dias)
  if (Math.floor(now / 60000) % 60 === 0) {
    await env.DB.prepare('DELETE FROM sent_notifications WHERE sent_at < ?').bind(now - 3 * 86400000).run();
  }
  return res;
}
