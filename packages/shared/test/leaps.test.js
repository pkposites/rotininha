import test from 'node:test';
import assert from 'node:assert/strict';
import { LEAPS, ageInDays, weeksOf, leapStatus, currentAndNext, leapStartingSoon, validBirthDate } from '../leaps.js';

test('10 saltos, em ordem crescente, janelas coerentes e sem sobreposição', () => {
  assert.equal(LEAPS.length, 10);
  assert.deepEqual(LEAPS.map((l) => l.week), [5, 8, 12, 19, 26, 37, 46, 55, 64, 75]);
  for (let i = 1; i < LEAPS.length; i++) assert.ok(LEAPS[i].from * 7 > LEAPS[i - 1].to * 7 + 6, 'janela ' + LEAPS[i].n);
  for (const l of LEAPS) { assert.ok(l.title && l.skill && l.signs.length >= 3 && l.tips.length >= 3); assert.ok(l.from < l.week && l.to > l.week); }
});

test('idade em dias e semanas', () => {
  assert.equal(ageInDays('2026-10-01', '2026-11-01'), 31);
  assert.equal(weeksOf(31), 4);
  assert.equal(ageInDays('2026-11-01', '2026-11-01'), 0);
});

test('bebê de 3 semanas: nenhum salto agora; o 1º é o próximo', () => {
  const { current, next } = currentAndNext(21);
  assert.equal(current, null); assert.equal(next.n, 1);
});

test('dentro da janela do salto 1 (semana 5): "agora"; o próximo é o 2', () => {
  const { current, next } = currentAndNext(5 * 7 + 2);
  assert.equal(current.n, 1); assert.equal(next.n, 2);
  assert.equal(leapStatus(5 * 7 + 2).filter((l) => l.status === 'past').length, 0);
});

test('depois de todas as janelas: tudo "past", sem próximo', () => {
  const { current, next, all } = currentAndNext(900);
  assert.equal(current, null); assert.equal(next, null); assert.ok(all.every((l) => l.status === 'past'));
});

test('aviso antecipado: começa em até 3 dias', () => {
  const start = LEAPS[2].from * 7; // salto 3
  assert.equal(leapStartingSoon(start - 3, 3).n, 3);
  assert.equal(leapStartingSoon(start - 1, 3).n, 3);
  assert.equal(leapStartingSoon(start - 4, 3), null);
  assert.equal(leapStartingSoon(start, 3)?.n, undefined, 'já começou: não é mais "em breve"');
});

test('data de nascimento: aceita recente/prevista (até 60 dias à frente) e rejeita absurdos', () => {
  assert.equal(validBirthDate('2026-10-01', '2026-11-01'), true);
  assert.equal(validBirthDate('2026-12-15', '2026-11-01'), true);   // data prevista próxima
  assert.equal(validBirthDate('2027-03-01', '2026-11-01'), false);  // longe demais no futuro
  assert.equal(validBirthDate('2020-01-01', '2026-11-01'), false);  // > 3 anos
  assert.equal(validBirthDate('não é data', '2026-11-01'), false);
});

test('conteúdo sem promessas médicas', () => {
  const t = JSON.stringify(LEAPS).toLowerCase();
  for (const bad of ['diagnóstico', 'cura', 'garant', 'doença', 'remédio', 'medicamento']) assert.ok(!t.includes(bad), bad);
});
