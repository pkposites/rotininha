import type { Env, WireRecord } from './types';
import { nextFire, isValidTimeZone } from '../../../packages/shared/schedule.js';

export const DEFAULT_TZ = 'America/Sao_Paulo';

export async function householdTz(env: Env, householdId: string): Promise<string> {
  const r = await env.DB.prepare('SELECT timezone FROM households WHERE id = ?').bind(householdId).first<{ timezone: string }>();
  return r && isValidTimeZone(r.timezone) ? r.timezone : DEFAULT_TZ;
}

/** Próximo disparo derivado do registro: task → próximo horário; occ adiada → fim do adiamento. */
export function fireAtFor(rec: WireRecord, tz: string, now: number): number | null {
  if (rec.deleted) return null;
  if (rec.kind === 'task') return nextFire(rec as any, now, tz)?.fireAt ?? null;
  if (rec.kind === 'occ' && rec.status === 'snoozed') return rec.snoozeUntil ?? null;
  return null;
}

const rowToWire = (r: { body: string; deleted: number }): WireRecord => ({ ...JSON.parse(r.body), deleted: !!r.deleted });

export async function applyChanges(env: Env, householdId: string, changes: WireRecord[], now: number) {
  if (!changes.length) return;
  const tz = await householdTz(env, householdId);

  const existing = new Map<string, number>();
  for (let i = 0; i < changes.length; i += 40) { // D1 limita parâmetros por consulta
    const part = changes.slice(i, i + 40);
    const q = await env.DB.prepare(
      `SELECT kind, id, updated_at FROM records WHERE household_id = ? AND (${part.map(() => '(kind = ? AND id = ?)').join(' OR ')})`
    ).bind(householdId, ...part.flatMap((c) => [c.kind, c.id])).all<{ kind: string; id: string; updated_at: number }>();
    for (const r of q.results) existing.set(`${r.kind}:${r.id}`, r.updated_at);
  }

  const winners = new Map<string, WireRecord>();
  for (const c of changes) {
    const k = `${c.kind}:${c.id}`;
    const cur = winners.get(k);
    if (cur && cur.updatedAt >= c.updatedAt) continue;
    const ex = existing.get(k);
    if (ex != null && ex >= c.updatedAt) continue;
    winners.set(k, c);
  }
  if (!winners.size) return;

  const r = await env.DB.prepare('UPDATE households SET seq = seq + ? WHERE id = ? RETURNING seq')
    .bind(winners.size, householdId).first<{ seq: number }>();
  let seq = r!.seq - winners.size;
  await env.DB.batch([...winners.values()].map((c) =>
    env.DB.prepare(
      `INSERT INTO records (household_id, kind, id, body, updated_at, deleted, seq, next_fire_at)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(household_id, kind, id) DO UPDATE SET
         body=excluded.body, updated_at=excluded.updated_at, deleted=excluded.deleted,
         seq=excluded.seq, next_fire_at=excluded.next_fire_at
       WHERE excluded.updated_at > records.updated_at`
    ).bind(householdId, c.kind, c.id, JSON.stringify(c), c.updatedAt, c.deleted ? 1 : 0, ++seq, fireAtFor(c, tz, now))
  ));
}

export async function changesSince(env: Env, householdId: string, cursor: number, page: number) {
  const rows = await env.DB.prepare(
    `SELECT body, deleted, seq FROM records WHERE household_id = ? AND seq > ? ORDER BY seq LIMIT ?`
  ).bind(householdId, cursor, page + 1).all<{ body: string; deleted: number; seq: number }>();
  const more = rows.results.length > page;
  const slice = rows.results.slice(0, page);
  return { cursor: slice.length ? slice[slice.length - 1].seq : cursor, more, changes: slice.map(rowToWire) };
}

/** Recalcula próximos disparos de todos os lembretes (ex.: troca de fuso). */
export async function rescheduleAll(env: Env, householdId: string, tz: string, now: number) {
  const rows = await env.DB.prepare(`SELECT id, body FROM records WHERE household_id = ? AND kind = 'task' AND deleted = 0`)
    .bind(householdId).all<{ id: string; body: string }>();
  if (!rows.results.length) return;
  await env.DB.batch(rows.results.map((r) =>
    env.DB.prepare(`UPDATE records SET next_fire_at = ? WHERE household_id = ? AND kind = 'task' AND id = ?`)
      .bind(fireAtFor({ ...JSON.parse(r.body), deleted: false }, tz, now), householdId, r.id)
  ));
}
