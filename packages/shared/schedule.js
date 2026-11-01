// Cálculo de horários de lembretes — usado pelo app e pelo Worker (mesma regra nos dois lados).
// Tarefa: { time:'HH:MM', repeat:'daily'|'weekly'|'once', days:[0-6] (0=domingo), date:'YYYY-MM-DD' (once), leadMin }

const fmtCache = new Map();
function fmt(tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz) {
  try { fmt(tz); return true; } catch { return false; }
}

/** Partes locais de um instante no fuso. weekday: 0=domingo. */
export function localParts(ts, tz) {
  const p = {};
  for (const { type, value } of fmt(tz).formatToParts(new Date(ts))) p[type] = value;
  const y = +p.year, m = +p.month, d = +p.day;
  return {
    y, m, d, h: +p.hour, mi: +p.minute,
    weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
    date: `${p.year}-${p.month}-${p.day}`
  };
}

function offsetAt(ts, tz) {
  const p = localParts(ts, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, 0);
  return asUtc - Math.floor(ts / 60000) * 60000;
}

/** Instante (ms) em que o relógio do fuso marca y-m-d h:mi. */
export function zonedToEpoch(y, m, d, h, mi, tz) {
  const guess = Date.UTC(y, m - 1, d, h, mi, 0);
  let t = guess - offsetAt(guess, tz);
  t = guess - offsetAt(t, tz);
  return t;
}

const parseTime = (s) => { const [h, mi] = s.split(':').map(Number); return { h, mi }; };
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };

/** A tarefa ocorre nesta data local (YYYY-MM-DD)? */
export function occursOn(task, date, tz) {
  if (task.deleted || task.active === false) return false;
  if (task.repeat === 'once') return task.date === date;
  if (task.repeat === 'daily') return true;
  if (task.repeat === 'weekly') {
    const { y, m, d } = parseDate(date);
    return (task.days ?? []).includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay());
  }
  return false;
}

/** Instante do horário da ocorrência (sem antecedência) numa data local. */
export function occurrenceTime(task, date, tz) {
  const { y, m, d } = parseDate(date);
  const { h, mi } = parseTime(task.time);
  return zonedToEpoch(y, m, d, h, mi, tz);
}

const addDays = (date, n) => {
  const { y, m, d } = parseDate(date);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
};
export { addDays };

/** Id determinístico da ocorrência — igual em todos os aparelhos e no servidor. */
export const occId = (taskId, date) => `${taskId}_${date.replace(/-/g, '')}`;

/**
 * Próximo instante de disparo estritamente depois de `after`.
 * Retorna { fireAt, date, occAt } ou null. fireAt = horário da ocorrência − antecedência.
 */
export function nextFire(task, after, tz) {
  if (!task || task.deleted || task.active === false || task.notify === false) return null;
  const lead = (task.leadMin ?? 0) * 60000;
  const start = addDays(localParts(after, tz).date, -1);
  for (let i = 0; i <= 9; i++) {
    const date = addDays(start, i);
    if (!occursOn(task, date, tz)) continue;
    const occAt = occurrenceTime(task, date, tz);
    if (occAt - lead > after) return { fireAt: occAt - lead, date, occAt };
  }
  return null;
}

/** Hora local (0-23) cai na janela de silêncio [22h, 6h)? */
export function inQuietHours(ts, tz, from = 22, to = 6) {
  const { h } = localParts(ts, tz);
  return h >= from || h < to;
}
