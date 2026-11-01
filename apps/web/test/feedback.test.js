import test from 'node:test';
import assert from 'node:assert/strict';
import { engagement, isEligible, shouldShowCard, usageDays, RULES } from '../src/lib/feedback.js';
import { zonedToEpoch } from '../../../packages/shared/schedule.js';

const TZ = 'America/Sao_Paulo';
const D = 86_400_000;
const t0 = zonedToEpoch(2026, 11, 1, 10, 0, TZ);
const ev = (dayOffset, i = 0) => ({ id: 'e' + dayOffset + i, type: 'mamada', startedAt: t0 + dayOffset * D + i * 60000, deleted: false });
const done = (dayOffset) => ({ id: 'o' + dayOffset, status: 'done', updatedAt: t0 + dayOffset * D, deleted: false });
const base = { now: t0 + 10 * D, dismissedAt: null, submittedAt: null, loggedThisSession: true, tab: 'hoje', night: false, busy: false };

test('elegível: ≥3 dias distintos E (≥5 registros OU ≥3 concluídos)', () => {
  const five = [ev(0, 0), ev(0, 1), ev(1, 0), ev(2, 0), ev(2, 1)];
  assert.equal(isEligible(engagement(five, [], TZ)), true);
  assert.equal(isEligible(engagement(five.slice(0, 4), [], TZ)), false, '4 registros não bastam');
  assert.equal(isEligible(engagement([ev(0), ev(1), ev(2)], [done(0), done(1), done(2)], TZ)), true, '3 concluídos bastam');
  assert.equal(isEligible(engagement([ev(0, 0), ev(0, 1), ev(0, 2), ev(0, 3), ev(0, 4), ev(0, 5)], [], TZ)), false, 'muitos registros em 1 dia só: não');
});

test('dias distintos usam o fuso local e ignoram excluídos', () => {
  const lateNight = { ...ev(0), startedAt: zonedToEpoch(2026, 11, 1, 23, 30, TZ) };
  const afterMidnight = { ...ev(0), id: 'x', startedAt: zonedToEpoch(2026, 11, 2, 0, 30, TZ) };
  assert.equal(usageDays([lateNight, afterMidnight], [], TZ).size, 2);
  assert.equal(usageDays([{ ...lateNight, deleted: true }], [], TZ).size, 0);
});

const eligibleEng = { days: 3, care: 5, done: 0 };

test('cartão: só em Hoje, depois de um registro nesta sessão, nunca em onboarding/pagamento/madrugada', () => {
  assert.equal(shouldShowCard({ ...base, eng: eligibleEng }), true);
  assert.equal(shouldShowCard({ ...base, eng: eligibleEng, tab: 'guia' }), false);
  assert.equal(shouldShowCard({ ...base, eng: eligibleEng, tab: 'historico' }), false);
  assert.equal(shouldShowCard({ ...base, eng: eligibleEng, loggedThisSession: false }), false);
  assert.equal(shouldShowCard({ ...base, eng: eligibleEng, night: true }), false);
  assert.equal(shouldShowCard({ ...base, eng: eligibleEng, busy: true }), false);
  assert.equal(shouldShowCard({ ...base, eng: eligibleEng, flag: false }), false);
  assert.equal(shouldShowCard({ ...base, eng: { days: 2, care: 9, done: 9 } }), false);
});

test('"Agora não" esconde por 7 dias; enviar esconde por 30', () => {
  const now = base.now;
  assert.equal(shouldShowCard({ ...base, eng: eligibleEng, dismissedAt: now - 6 * D }), false);
  assert.equal(shouldShowCard({ ...base, eng: eligibleEng, dismissedAt: now - RULES.hideAfterDismissDays * D - 1 }), true);
  assert.equal(shouldShowCard({ ...base, eng: eligibleEng, submittedAt: now - 29 * D }), false);
  assert.equal(shouldShowCard({ ...base, eng: eligibleEng, submittedAt: now - 31 * D }), true);
});
