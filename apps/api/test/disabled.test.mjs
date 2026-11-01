// Com PAYMENTS_ENABLED=false (padrão em produção até validar o Pix): nada cobra, nada coleta CPF. Usa uma 2ª instância (API_OFF_URL).
import test from 'node:test';
import assert from 'node:assert/strict';
const OFF = process.env.API_OFF_URL;
const skip = !OFF && 'defina API_OFF_URL (scripts/ci-integration.sh sobe uma 2ª instância com a chave desligada)';
const post = (path, body, token) => fetch(OFF + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `10.7.${Math.floor(Math.random() * 250)}.1`, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

test('planos informam que as vendas estão fechadas', { skip }, async () => {
  const p = await (await fetch(OFF + '/v1/plans')).json();
  assert.equal(p.paymentsEnabled, false);
});
test('checkout e renovação são recusados (503) antes de qualquer validação ou chamada ao Mercado Pago', { skip }, async () => {
  const r = await post('/v1/checkout', { plan: 'life', email: 'a@b.com', cpf: '52998224725' });
  assert.equal(r.status, 503); assert.equal((await r.json()).error, 'payments_disabled');
  const { code } = await (await post('/v1/dev/households', {})).json();
  const s = await (await post('/v1/sessions', { code, deviceId: 'devoffabcdef' })).json();
  const r2 = await post('/v1/billing/renew', { plan: 'life', cpf: '52998224725' }, s.accessToken);
  assert.equal(r2.status, 503);
});
test('o que já existe continua funcionando (login, sincronização, conta); webhook segue exigindo assinatura', { skip }, async () => {
  const { code } = await (await post('/v1/dev/households', {})).json();
  const s = await (await post('/v1/sessions', { code, deviceId: 'devoffabcdeg' })).json();
  assert.equal((await post('/v1/sync', { cursor: 0, changes: [] }, s.accessToken)).status, 200);
  assert.equal((await post('/v1/billing/account', {}, s.accessToken)).status, 200);
  const w = await fetch(OFF + '/v1/webhooks/mercadopago?data.id=1&type=payment', { method: 'POST', body: '{}' });
  assert.equal(w.status, 401, 'webhook continua protegido (reembolsos de compras existentes precisam ser processados)');
});

test('data de cobrança agendada NÃO bloqueia ninguém enquanto o pagamento está desligado', { skip }, async () => {
  const ADMIN = 'Bearer admin-token-local-de-teste-1234567890';
  const adm = (path, body) => fetch(OFF + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: ADMIN, 'CF-Connecting-IP': `10.8.${Math.floor(Math.random() * 250)}.1` }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());
  const past = Date.now() - 86_400_000;
  try {
    assert.equal((await adm('/v1/admin/settings', { enforceFrom: past, devSkipNotice: true })).ok, true);
    const s = await adm('/v1/admin/settings');
    assert.equal(s.enforceFrom, past, 'o painel mostra a data programada'); assert.equal(s.payments, false, 'e avisa que o pagamento está desligado'); assert.equal(s.active, false);
    const p = await (await fetch(OFF + '/v1/plans')).json();
    assert.equal(p.trial.enforceFrom, null); assert.equal(p.trial.active, false, 'público: sem cobrança');
    const t = await post('/v1/trial/start', { deviceId: 'dev' + Math.random().toString(36).slice(2, 10) + 'abcd', whatsapp: `(11) 9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, password: 'senha de teste 2026' });
    const j = await t.json();
    assert.equal(t.status, 201); assert.equal(j.enforced, false, 'conta nova não ganha prazo');
    const acc = await (await post('/v1/billing/account', {}, j.session.accessToken)).json();
    assert.equal(acc.state, 'active'); assert.equal(acc.validUntil, null); assert.equal(acc.enforcement.active, false);
  } finally { await adm('/v1/admin/settings', { enforceFrom: null }); }
});
