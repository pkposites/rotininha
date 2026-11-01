// Lógica pura dos lembretes (sem DOM/IndexedDB).
import { occursOn, occurrenceTime, occId, localParts, inQuietHours, zonedToEpoch } from '../../../../packages/shared/schedule.js';
import { uuid } from './events.js';

export const CATEGORIES = {
  banho: { label: 'Banho', icon: '🛁' },
  mamada: { label: 'Mamada', icon: '🍼' },
  soneca: { label: 'Soneca', icon: '😴' },
  fralda: { label: 'Fralda', icon: '👶' },
  remedio: { label: 'Remédio', icon: '💊' },
  estimulo: { label: 'Estímulo', icon: '🧸' },
  consulta: { label: 'Consulta/Vacina', icon: '🩺' },
  mae: { label: 'Cuidado da mãe', icon: '💜' },
  outro: { label: 'Outro', icon: '📌' }
};
export const SNOOZE_OPTIONS = [10, 15, 30];

export function makeTask(over = {}) {
  return {
    id: uuid(), title: '', category: 'outro', time: '18:30', repeat: 'daily', days: [], date: null,
    leadMin: 0, notify: true, allowQuiet: false, updatedAt: Date.now(), ...over
  };
}

export const validateTask = (t) => {
  if (!t.title.trim()) return 'Dê um nome ao lembrete.';
  if (t.title.trim().length > 80) return 'O nome pode ter até 80 caracteres.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time)) return 'Confira o horário.';
  if (t.repeat === 'weekly' && !t.days.length) return 'Escolha ao menos um dia da semana.';
  if (t.repeat === 'once' && !/^\d{4}-\d{2}-\d{2}$/.test(t.date ?? '')) return 'Escolha a data.';
  return '';
};

/** O horário escolhido cai no silêncio padrão (22h–6h)? Então o app pede confirmação. */
export const needsQuietConfirm = (time) => {
  const h = Number(time.slice(0, 2));
  return h >= 22 || h < 6;
};

/**
 * Lembretes do dia (data local `date`), ordenados pelo horário efetivo.
 * status: pending | snoozed | done | skipped. `late` = pendente cujo horário já passou (texto neutro na UI).
 */
export function dayItems(tasks, occs, now, tz, date = localParts(now, tz).date) {
  const byId = new Map(occs.map((o) => [o.id, o]));
  const items = [];
  for (const task of tasks) {
    if (task.deleted || !occursOn(task, date, tz)) continue;
    const id = occId(task.id, date);
    const occ = byId.get(id);
    const at = occurrenceTime(task, date, tz);
    const status = occ && !occ.deleted ? occ.status : 'pending';
    const snoozeUntil = status === 'snoozed' ? occ.snoozeUntil : null;
    const effective = snoozeUntil ?? at;
    items.push({ task, date, id, at, status, snoozeUntil, effective, late: (status === 'pending' || status === 'snoozed') && effective < now });
  }
  return items.sort((a, b) => a.effective - b.effective);
}

export function occRecord(task, date, patch) {
  return { id: occId(task.id, date), taskId: task.id, date, status: 'pending', snoozeUntil: null, ...patch };
}

export const markDone = (item) => occRecord(item.task, item.date, { status: 'done' });
export const markSkipped = (item) => occRecord(item.task, item.date, { status: 'skipped' });
export const snooze = (item, min, now) => occRecord(item.task, item.date, { status: 'snoozed', snoozeUntil: now + min * 60000 });
export const undo = (item) => occRecord(item.task, item.date, { status: 'pending' });

export { occId, zonedToEpoch, inQuietHours };
