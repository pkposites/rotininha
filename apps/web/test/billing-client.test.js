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
  assert.equal(brl(3790), 'R$ 37,90');
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

import { trackingContext } from '../src/lib/billing.js';
test('medição de anúncios: sem consentimento nada é enviado; com consentimento só ids e URL', () => {
  const set = (consent, cookie) => {
    globalThis.localStorage = { getItem: () => consent };
    globalThis.document = { cookie };
    globalThis.location = { origin: 'https://rotininha.exemplo' };
  };
  set(null, '_fbp=fb.1.1700000000000.123');
  assert.deepEqual(trackingContext(), {}, 'sem escolha: vazio');
  set(JSON.stringify({ v: 1, marketing: false }), '_fbp=fb.1.1700000000000.123');
  assert.deepEqual(trackingContext(), {}, 'recusou: vazio, mesmo com cookie presente');
  set('lixo{', '_fbp=x');
  assert.deepEqual(trackingContext(), {}, 'armazenamento corrompido: vazio');
  set(JSON.stringify({ v: 1, marketing: true }), 'a=1; _fbp=fb.1.1700000000000.123; _fbc=fb.1.1700000000000.AbC');
  assert.deepEqual(trackingContext(), { marketingConsent: true, sourceUrl: 'https://rotininha.exemplo/', fbp: 'fb.1.1700000000000.123', fbc: 'fb.1.1700000000000.AbC' });
  set(JSON.stringify({ v: 1, marketing: true }), '');
  assert.deepEqual(trackingContext(), { marketingConsent: true, sourceUrl: 'https://rotininha.exemplo/' }, 'aceitou mas sem cookies ainda');
});

test('teste grátis: contagem regressiva, aviso prévio da cobrança e fim do teste', () => {
  const now = Date.UTC(2026, 10, 1, 12), day = 86_400_000;
  const trial = (extra) => ({ state: 'trial', plan: 'trial', trialDays: 3, validUntil: now + 2 * day, graceUntil: now + 3 * day, enforcement: { active: true }, ...extra });
  const t = accessNotice(trial({}), now);
  assert.equal(t.kind, 'trial'); assert.match(t.text, /faltam 2 dias/); assert.match(t.text, /R\$ 37,90/); assert.match(t.text, /sem assinatura/);
  assert.match(accessNotice(trial({ validUntil: now + 3600_000 }), now).text, /termina hoje ou amanhã/);
  // antes da cobrança: só o aviso prévio (nada muda até lá)
  const ann = accessNotice({ state: 'active', plan: 'trial', trialDays: 3, validUntil: null, enforcement: { active: false, announced: true, from: now + 5 * day } }, now);
  assert.equal(ann.kind, 'announce'); assert.match(ann.text, /Até lá, nada muda/); assert.match(ann.text, /3 dias de teste grátis/);
  assert.equal(accessNotice({ state: 'active', plan: 'trial', validUntil: null, enforcement: { active: false, announced: false, from: null } }, now), null, 'sem aviso quando nada foi anunciado');
  const end = accessNotice({ state: 'expired', plan: 'trial', validUntil: now - 5 * day, graceUntil: now - 4 * day }, now);
  assert.match(end.text, /teste grátis terminou/); assert.match(end.text, /ainda pode ver seus registros/); assert.ok(!/erro|falha|atrasad/i.test(end.text));
  assert.match(accessNotice({ state: 'grace', plan: 'trial', validUntil: now - 1000, graceUntil: now + day }, now).text, /teste terminou/);
});
