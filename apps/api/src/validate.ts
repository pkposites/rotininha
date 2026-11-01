import type { WireRecord } from './types';

const EVENT_TYPES = new Set(['mamada', 'sono', 'fralda']);
const CATEGORIES = new Set(['mamada', 'soneca', 'banho', 'remedio', 'fralda', 'estimulo', 'consulta', 'mae', 'outro']);
const STATUSES = new Set(['pending', 'snoozed', 'done', 'skipped']);
const ID = /^[A-Za-z0-9_-]{8,80}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_CHANGES = 200;

const int = (v: any) => Number.isSafeInteger(v) && v > 0 && v < 4102444800000;

export function parseRecord(x: any): WireRecord | null {
  if (!x || typeof x !== 'object') return null;
  const kind = x.kind ?? 'event';
  if (typeof x.id !== 'string' || !ID.test(x.id) || !int(x.updatedAt)) return null;
  const base = { kind, id: x.id, updatedAt: x.updatedAt as number, deleted: !!x.deleted };

  if (kind === 'event') {
    if (!EVENT_TYPES.has(x.type) || !int(x.startedAt)) return null;
    if (x.endedAt != null && (!int(x.endedAt) || x.endedAt < x.startedAt)) return null;
    return {
      ...base, type: x.type, startedAt: x.startedAt, endedAt: x.endedAt ?? null,
      note: typeof x.note === 'string' ? x.note.slice(0, 300) : '',
      detail: typeof x.detail === 'string' ? x.detail.slice(0, 20) : ''
    };
  }

  if (kind === 'task') {
    if (typeof x.title !== 'string' || !x.title.trim() || x.title.length > 80) return null;
    if (!CATEGORIES.has(x.category) || !TIME.test(x.time)) return null;
    if (!['daily', 'weekly', 'once'].includes(x.repeat)) return null;
    const days = Array.isArray(x.days) ? ([...new Set(x.days as number[])]).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [];
    if (x.repeat === 'weekly' && days.length === 0) return null;
    if (x.repeat === 'once' && !(typeof x.date === 'string' && DATE.test(x.date))) return null;
    const lead = x.leadMin ?? 0;
    if (!Number.isInteger(lead) || lead < 0 || lead > 120) return null;
    return {
      ...base, title: x.title.trim(), category: x.category, time: x.time, repeat: x.repeat, days,
      date: x.repeat === 'once' ? x.date : null, leadMin: lead,
      notify: x.notify !== false, allowQuiet: !!x.allowQuiet
    };
  }

  if (kind === 'occ') {
    if (typeof x.taskId !== 'string' || !ID.test(x.taskId)) return null;
    if (typeof x.date !== 'string' || !DATE.test(x.date)) return null;
    if (x.id !== `${x.taskId}_${x.date.replace(/-/g, '')}`) return null; // id determinístico
    if (!STATUSES.has(x.status)) return null;
    if (x.status === 'snoozed' && !int(x.snoozeUntil)) return null;
    return { ...base, taskId: x.taskId, date: x.date, status: x.status, snoozeUntil: x.status === 'snoozed' ? x.snoozeUntil : null };
  }
  return null;
}

export const normEmail = (e: unknown): string | null => {
  if (typeof e !== 'string') return null;
  const v = e.trim().toLowerCase();
  return v.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v : null;
};

/** CPF com dígitos verificadores. Nunca é armazenado nem registrado em log. */
export function normCpf(c: unknown): string | null {
  if (typeof c !== 'string') return null;
  const d = c.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return null;
  const dv = (n: number) => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(d[i]) * (n + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]) ? d : null;
}
