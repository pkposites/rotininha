import test from 'node:test';
import assert from 'node:assert/strict';
import { isBlocked, paywallText } from '../src/lib/gate.js';
test('bloqueio só depois da carência, e só com conta', () => {
  assert.equal(isBlocked(null), false, 'sem conta: uso local livre');
  for (const state of ['trial', 'active', 'grace']) assert.equal(isBlocked({ state }), false, state);
  assert.equal(isBlocked({ state: 'expired' }), true);
});
test('texto do bloqueio: preço, o que continua livre e sem culpa', () => {
  const on = paywallText({ plan: 'trial' }, true);
  assert.match(on, /R\$ 37,90/); assert.match(on, /vê-los e baixá-los/); assert.match(on, /sem assinatura/);
  assert.doesNotMatch(on, /culpa|atrasad|erro/i);
  assert.match(paywallText({ plan: 'paid' }, true), /Seu acesso venceu/);
  assert.doesNotMatch(paywallText({ plan: 'trial' }, false), /R\$ 37,90/, 'sem pagamento ligado, não oferece pagar');
});
