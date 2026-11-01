import test from 'node:test';
import assert from 'node:assert/strict';
import { localParts, zonedToEpoch, nextFire, occursOn, inQuietHours, occId, addDays } from '../schedule.js';

const TZ = 'America/Sao_Paulo'; // UTC-3 (sem horário de verão desde 2019)

test('zonedToEpoch / localParts são inversos', () => {
  const t = zonedToEpoch(2026, 11, 1, 18, 30, TZ);
  assert.equal(new Date(t).toISOString(), '2026-11-01T21:30:00.000Z');
  const p = localParts(t, TZ);
  assert.deepEqual([p.date, p.h, p.mi, p.weekday], ['2026-11-01', 18, 30, 0]);
});

test('diário: depois do horário de hoje vai para amanhã', () => {
  const task = { time: '18:30', repeat: 'daily' };
  const after = zonedToEpoch(2026, 11, 1, 19, 0, TZ);
  const n = nextFire(task, after, TZ);
  assert.equal(n.date, '2026-11-02');
  assert.equal(n.fireAt, zonedToEpoch(2026, 11, 2, 18, 30, TZ));
});

test('antes do horário de hoje dispara hoje', () => {
  const n = nextFire({ time: '18:30', repeat: 'daily' }, zonedToEpoch(2026, 11, 1, 8, 0, TZ), TZ);
  assert.equal(n.date, '2026-11-01');
});

test('semanal respeita os dias (0=dom) e pula para a próxima semana', () => {
  const task = { time: '09:00', repeat: 'weekly', days: [1, 3] }; // seg e qua
  const dom = zonedToEpoch(2026, 11, 1, 12, 0, TZ);                // domingo
  assert.equal(nextFire(task, dom, TZ).date, '2026-11-02');        // segunda
  const qua = zonedToEpoch(2026, 11, 4, 10, 0, TZ);
  assert.equal(nextFire(task, qua, TZ).date, '2026-11-09');
});

test('uma vez: dispara só na data e depois é null', () => {
  const task = { time: '10:00', repeat: 'once', date: '2026-11-05' };
  assert.equal(nextFire(task, zonedToEpoch(2026, 11, 1, 0, 0, TZ), TZ).date, '2026-11-05');
  assert.equal(nextFire(task, zonedToEpoch(2026, 11, 5, 10, 0, TZ), TZ), null);
});

test('antecedência antecipa o disparo, ocorrência segue no horário', () => {
  const n = nextFire({ time: '10:00', repeat: 'daily', leadMin: 15 }, zonedToEpoch(2026, 11, 1, 0, 0, TZ), TZ);
  assert.equal(n.fireAt, zonedToEpoch(2026, 11, 1, 9, 45, TZ));
  assert.equal(n.occAt, zonedToEpoch(2026, 11, 1, 10, 0, TZ));
});

test('notificação desligada, apagada ou inativa → null', () => {
  const b = { time: '10:00', repeat: 'daily' };
  assert.equal(nextFire({ ...b, notify: false }, 0, TZ), null);
  assert.equal(nextFire({ ...b, deleted: true }, 0, TZ), null);
  assert.equal(nextFire({ ...b, active: false }, 0, TZ), null);
});

test('janela de silêncio 22h–6h', () => {
  assert.equal(inQuietHours(zonedToEpoch(2026, 11, 1, 23, 0, TZ), TZ), true);
  assert.equal(inQuietHours(zonedToEpoch(2026, 11, 1, 5, 59, TZ), TZ), true);
  assert.equal(inQuietHours(zonedToEpoch(2026, 11, 1, 6, 0, TZ), TZ), false);
  assert.equal(inQuietHours(zonedToEpoch(2026, 11, 1, 21, 59, TZ), TZ), false);
});

test('fuso com horário de verão (Nova York) converte corretamente', () => {
  const NY = 'America/New_York';
  assert.equal(new Date(zonedToEpoch(2026, 7, 1, 12, 0, NY)).toISOString(), '2026-07-01T16:00:00.000Z'); // EDT
  assert.equal(new Date(zonedToEpoch(2026, 12, 1, 12, 0, NY)).toISOString(), '2026-12-01T17:00:00.000Z'); // EST
});

test('occId e addDays', () => {
  assert.equal(occId('abc', '2026-11-01'), 'abc_20261101');
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(occursOn({ repeat: 'daily' }, '2026-11-01', TZ), true);
});
