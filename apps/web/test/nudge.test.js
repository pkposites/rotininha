import test from 'node:test';
import assert from 'node:assert/strict';
import { nudgePlan, nextDelay, DAY } from '../src/lib/nudge.js';
const base = { now: 10 * DAY, syncAvailable: true, signedOut: true, standalone: false, installDismissed: false, optOut: false, hasData: true, nextAt: 0 };
test('aparece para quem está sem conta e sem o app instalado, só depois de usar', () => {
  const p = nudgePlan(base); assert.deepEqual([p.show, p.needAccount, p.needInstall], [true, true, true]);
  assert.equal(nudgePlan({ ...base, hasData: false }).show, false, 'sem uso ainda: não incomoda');
});
test('mostra só o que falta e some quando está tudo resolvido', () => {
  const a = nudgePlan({ ...base, standalone: true }); assert.deepEqual([a.show, a.needAccount, a.needInstall], [true, true, false]);
  const i = nudgePlan({ ...base, signedOut: false }); assert.deepEqual([i.show, i.needAccount, i.needInstall], [true, false, true]);
  assert.equal(nudgePlan({ ...base, signedOut: false, standalone: true }).show, false);
  assert.equal(nudgePlan({ ...base, syncAvailable: false, standalone: true }).show, false, 'sem servidor não há conta para oferecer');
});
test('respeita o intervalo e a escolha de não mostrar mais', () => {
  assert.equal(nudgePlan({ ...base, nextAt: base.now + 1 }).show, false);
  assert.equal(nudgePlan({ ...base, nextAt: base.now }).show, true);
  assert.equal(nudgePlan({ ...base, optOut: true }).show, false);
});
test('intervalos crescentes: 1, 2, 4 e depois a cada 7 dias', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 9].map((n) => nextDelay(n) / DAY), [1, 2, 4, 7, 7, 7]);
});
