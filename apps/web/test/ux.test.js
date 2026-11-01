import test from 'node:test';
import assert from 'node:assert/strict';
import { registeredMessage, isDoubleTap, reminderView, nextLabel, trialCopy, cleanName } from '../src/lib/ux.js';
import { dayItems, makeTask, occId } from '../src/lib/tasks.js';

const TZ = 'America/Sao_Paulo';
test('mensagens de registro com concordância', () => {
  const e = { startedAt: Date.UTC(2026, 10, 1, 15, 5), endedAt: Date.UTC(2026, 10, 1, 16, 5) };
  assert.match(registeredMessage('mamada', e), /^Mamada registrada às/);
  assert.match(registeredMessage('fralda', e), /^Fralda registrada às/);
  assert.match(registeredMessage('sono', e), /^Soneca iniciada às/);
  assert.match(registeredMessage('sono', e, true), /^Acordou às/);
  assert.doesNotMatch(registeredMessage('sono', e), /Sono registrada/);
});
test('toque duplo: mesmo botão em < 1,5 s; outro botão ou depois disso é legítimo', () => {
  const last = { type: 'mamada', at: 1000 };
  assert.equal(isDoubleTap(last, 'mamada', 1800), true);
  assert.equal(isDoubleTap(last, 'fralda', 1100), false);
  assert.equal(isDoubleTap(last, 'mamada', 2600), false);
  assert.equal(isDoubleTap(null, 'mamada', 5), false);
});
test('lembretes: concluído sai de pendentes e o próximo é amanhã', () => {
  const now = Date.parse('2026-11-01T15:00:00Z'); // 12h em SP
  const t = makeTask({ id: 't1', title: 'Banho', time: '18:30', repeat: 'daily' });
  const date = '2026-11-01';
  const occs = [{ id: occId('t1', date), taskId: 't1', date, status: 'done', deleted: false }];
  const items = dayItems([t], occs, now, TZ);
  const v = reminderView(items, [t], occs, now, TZ);
  assert.equal(v.pending.length, 0); assert.equal(v.handled.length, 1);
  assert.equal(v.next.days, 1); assert.match(nextLabel(v.next), /^amanhã às \d\d:\d\d$/);
  const v2 = reminderView(dayItems([t], [], now, TZ), [t], [], now, TZ);
  assert.equal(v2.pending.length, 1); assert.equal(v2.next, null);
});
test('texto do acesso grátis acompanha a regra do servidor', () => {
  const launch = trialCopy({ days: 3, enforceFrom: null, active: false, noticeDays: 7 });
  assert.equal(launch.kind, 'launch'); assert.match(launch.title, /grátis no lançamento/); assert.match(launch.lead, /não tem data para acabar/); assert.match(launch.lead, /7 dias de antecedência/); assert.match(launch.lead, /valor previsto/);
  const from = Date.UTC(2026, 11, 10);
  const sch = trialCopy({ days: 3, enforceFrom: from, active: false, noticeDays: 7 });
  assert.equal(sch.kind, 'scheduled'); assert.match(sch.lead, /10\/12/); assert.match(sch.title, /13\/12/);
  assert.equal(trialCopy({ days: 3, active: true }).kind, 'active');
  assert.doesNotMatch(launch.lead, /Seu teste começou/);
});

test('nome de personalização: limpo, curto e sem HTML', () => {
  assert.equal(cleanName('  Maria   Clara '), 'Maria Clara');
  assert.equal(cleanName('<b>Theo</b>'), 'bTheo/b');
  assert.equal(cleanName('x'.repeat(80)).length, 30);
  assert.equal(cleanName(null), ''); assert.equal(cleanName('a\u0000b\nc'), 'abc');
});
