import type { ClientEvent } from './types';

const TYPES = new Set(['mamada', 'sono', 'fralda']);
const UUID_LIKE = /^[A-Za-z0-9_-]{8,64}$/;
export const MAX_CHANGES = 200;

export function parseEvent(x: any): ClientEvent | null {
  if (!x || typeof x !== 'object') return null;
  if (typeof x.id !== 'string' || !UUID_LIKE.test(x.id)) return null;
  if (!TYPES.has(x.type)) return null;
  const int = (v: any) => Number.isSafeInteger(v) && v > 0 && v < 4102444800000;
  if (!int(x.startedAt) || !int(x.updatedAt)) return null;
  if (x.endedAt != null && (!int(x.endedAt) || x.endedAt < x.startedAt)) return null;
  const note = typeof x.note === 'string' ? x.note.slice(0, 300) : '';
  const detail = typeof x.detail === 'string' ? x.detail.slice(0, 20) : '';
  return {
    id: x.id, type: x.type, startedAt: x.startedAt, endedAt: x.endedAt ?? null,
    note, detail, updatedAt: x.updatedAt, deleted: !!x.deleted
  };
}
