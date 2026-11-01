import test from 'node:test';
import assert from 'node:assert/strict';
import { makeTask, dayItems, markDone, snooze, undo, validateTask, needsQuietConfirm, occRecord } from '../src/lib/tasks.js';
import { zonedToEpoch } from '../../../packages/shared/schedule.js';

const TZ = 'America/Sao_Paulo';
const at = (h, m = 0) => zonedToEpoch(2026, 11, 1, h, m, TZ); // domingo
const T = (over) => makeTask({ id: 'task' + Math.random().toString(36).slice(2, 8), ...over });

test('dayItems: só lembretes que ocorrem hoje, ordenados', () => {
  const a = T({ title: 'A', time: '18:30' }), b = T({ title: 'B', time: '08:00' });
  const seg = T({ title: 'só segunda', repeat: 'weekly', days: [1] });
  const items = dayItems([a, b, seg], [], at(7), TZ);
  assert.deepEqual(items.map((i) => i.task.title), ['B', 'A']);
});

test('pendente com horário passado fica "late" (neutro), futuro não', () => {
  const a = T({ time: '08:00' }), b = T({ time: '20:00' });
  const items = dayItems([a, b], [], at(12), TZ);
  assert.equal(items.find((i) => i.task.id === a.id).late, true);
  assert.equal(items.find((i) => i.task.id === b.id).late, false);
});

test('concluído deixa de estar "late" e vira done', () => {
  const a = T({ time: '08:00' });
  const [item] = dayItems([a], [], at(12), TZ);
  const occ = { ...markDone(item), updatedAt: 1 };
  const [after] = dayItems([a], [occ], at(12), TZ);
  assert.equal(after.status, 'done'); assert.equal(after.late, false);
});

test('adiar guarda snoozeUntil e usa-o para ordenar; desfazer volta a pendente', () => {
  const a = T({ time: '08:00' }), b = T({ time: '10:00' });
  const now = at(8, 5);
  const [ia] = dayItems([a, b], [], now, TZ);
  const occ = { ...snooze(ia, 120, now), updatedAt: 1 };
  const items = dayItems([a, b], [occ], now, TZ);
  assert.deepEqual(items.map((i) => i.task.id), [b.id, a.id]);
  assert.equal(items[1].status, 'snoozed'); assert.equal(items[1].snoozeUntil, now + 120 * 60000);
  const undone = { ...undo(items[1]), updatedAt: 2 };
  assert.equal(dayItems([a, b], [undone], now, TZ)[0].status, 'pending');
});

test('tombstone de ocorrência é ignorado; tarefa apagada não aparece', () => {
  const a = T({ time: '08:00' }), b = T({ time: '09:00', deleted: true });
  const occ = { ...occRecord(a, '2026-11-01', { status: 'done' }), deleted: true, updatedAt: 1 };
  const items = dayItems([a, b], [occ], at(7), TZ);
  assert.equal(items.length, 1); assert.equal(items[0].status, 'pending');
});

test('validateTask e confirmação de silêncio', () => {
  assert.ok(validateTask(T({ title: ' ' })));
  assert.ok(validateTask(T({ title: 'x', repeat: 'weekly', days: [] })));
  assert.ok(validateTask(T({ title: 'x', repeat: 'once', date: null })));
  assert.equal(validateTask(T({ title: 'Banho' })), '');
  assert.equal(needsQuietConfirm('23:30'), true);
  assert.equal(needsQuietConfirm('05:59'), true);
  assert.equal(needsQuietConfirm('06:00'), false);
  assert.equal(needsQuietConfirm('21:59'), false);
});
