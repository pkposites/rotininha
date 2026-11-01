import test from 'node:test';
import assert from 'node:assert/strict';
import { maskCpf, validCpf, validEmail, brl, daysLeft, accessNotice } from '../src/lib/billing.js';

test('máscara e validação de CPF', () => {
  assert.equal(maskCpf('52998224725'), '529.982.247-25');
  assert.equal(maskCpf('5299'), '529.9');
  assert.equal(maskCpf('529.982.247-25999'), '529.982.247-25');
  assert.equal(validCpf('529.982.247-25'), true);
  assert.equal(validCpf('529.982.247-26'), false);
  assert.equal(validCpf('111.111.111-11'), false);
  assert.equal(validCpf('123'), false);
});
test('e-mail e moeda', () => {
  assert.equal(validEmail('a@b.com'), true);
  assert.equal(validEmail('a@b'), false);
  assert.equal(brl(1190), 'R$ 11,90'); assert.equal(brl(3990), 'R$ 39,90');
});
test('aviso de vencimento: nada com folga, aviso perto, carência e vencido sem culpa', () => {
  const now = Date.UTC(2026, 10, 1, 12);
  const day = 86_400_000;
  assert.equal(accessNotice({ state: 'active', validUntil: now + 5 * day }, now), null);
  assert.equal(accessNotice({ state: 'active', validUntil: null }, now), null);
  assert.match(accessNotice({ state: 'active', validUntil: now + 2 * day - 1000 }, now).text, /termina em 2 dias/);
  assert.match(accessNotice({ state: 'active', validUntil: now + 3600_000 }, now).text, /hoje ou amanhã/);
  assert.match(accessNotice({ state: 'grace', validUntil: now - 1000, graceUntil: now + day }, now).text, /carência/);
  const exp = accessNotice({ state: 'expired', validUntil: now - 5 * day, graceUntil: now - 4 * day }, now).text;
  assert.match(exp, /ainda pode ver seus registros/); assert.ok(!/erro|falha|atrasad/i.test(exp));
  assert.equal(daysLeft(now + day + 1, now), 2);
});
