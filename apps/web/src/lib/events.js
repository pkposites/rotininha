// Lógica pura de eventos de cuidado (sem DOM/IndexedDB) — testável em Node.
export const TYPES = {
  mamada: { label: 'Mamada', icon: '🍼' },
  sono: { label: 'Sono', icon: '😴' },
  fralda: { label: 'Fralda', icon: '👶' }
};

export const uuid = () =>
  globalThis.crypto?.randomUUID?.() ??
  'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export function makeEvent(type, now = Date.now(), extra = {}) {
  return {
    id: uuid(), type, startedAt: now, endedAt: null,
    note: '', detail: '', updatedAt: now, ...extra
  };
}

export const sortDesc = (evs) => [...evs].sort((a, b) => b.startedAt - a.startedAt);

export const lastOf = (evs, type) => sortDesc(evs).find((e) => e.type === type) ?? null;

export const openSleep = (evs) =>
  sortDesc(evs).find((e) => e.type === 'sono' && e.endedAt == null) ?? null;

export function formatElapsed(ms) {
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  if (h < 24) return m ? `há ${h}h ${m}min` : `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

export function formatDuration(ms) {
  const min = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h}h ${m}min` : `${h}h`) : `${m}min`;
}

export const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function groupByDay(evs, filter = 'todos') {
  const out = new Map();
  for (const e of sortDesc(evs)) {
    if (filter !== 'todos' && e.type !== filter) continue;
    const k = dayKey(e.startedAt);
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(e);
  }
  return [...out.entries()].map(([key, events]) => ({ key, events }));
}

// Resumo simples, sem interpretação clínica.
export function summarize(dayEvents) {
  const s = { mamadas: 0, fraldas: 0, sonos: 0, sonoMs: 0 };
  for (const e of dayEvents) {
    if (e.type === 'mamada') s.mamadas++;
    else if (e.type === 'fralda') s.fraldas++;
    else if (e.type === 'sono') {
      s.sonos++;
      if (e.endedAt != null) s.sonoMs += e.endedAt - e.startedAt;
    }
  }
  return s;
}

// <input type="datetime-local"> <-> timestamp (horário local)
export function toInputValue(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export const fromInputValue = (v) => new Date(v).getTime();
