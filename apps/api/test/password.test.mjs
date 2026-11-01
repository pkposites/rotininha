import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { normalizePhone, checkPassword } from '../src/phone.ts';

const API = process.env.API_URL ?? 'http://localhost:8787';
const rnd = () => randomBytes(5).toString('hex');
const ip = () => ({ 'CF-Connecting-IP': `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
const post = (path, body, token, extra = {}) =>
  fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...ip(), ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const phone = () => `(11) 9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0').replace(/^(\d{4})(\d{4})$/, '$1-$2')}`;
const dev = () => 'dev' + rnd() + 'abcd';
const PW = 'minha senha 2026';

test('normalização de WhatsApp e regras de senha', () => {
  assert.equal(normalizePhone('(11) 91234-5678'), '5511912345678');
  assert.equal(normalizePhone('+55 11 91234 5678'), '5511912345678');
  assert.equal(normalizePhone('11 3123-4567'), '551131234567');
  assert.equal(normalizePhone('1234'), null); assert.equal(normalizePhone('(11) 81234-5678'), null); assert.equal(normalizePhone(5511912345678), null);
  assert.equal(checkPassword('12345678', null), 'weak'); assert.equal(checkPassword('abc', null), 'weak'); assert.equal(checkPassword('aaaaaaaa', null), 'weak');
  assert.equal(checkPassword('91234-5678', '5511912345678'), 'weak', 'senha igual ao número');
  assert.equal(checkPassword('minha senha 2026', null), 'ok');
});

test('criar conta com WhatsApp + senha: sem código, entra em outro aparelho, erros iguais para conta inexistente', async () => {
  const wa = phone();
  const r = await post('/v1/trial/start', { deviceId: dev(), whatsapp: wa, password: PW });
  const a = await r.json();
  assert.equal(r.status, 201); assert.equal(a.code, undefined, 'nenhum código é entregue'); assert.ok(a.session.accessToken);
  assert.equal((await post('/v1/trial/start', { deviceId: dev(), whatsapp: wa, password: PW })).status, 409, 'número já usado');
  assert.equal((await post('/v1/trial/start', { deviceId: dev(), whatsapp: '123', password: PW })).status, 422);
  assert.equal((await post('/v1/trial/start', { deviceId: dev(), whatsapp: phone(), password: '12345678' })).status, 422);

  const ok = await post('/v1/sessions/password', { whatsapp: wa.replace(/\D/g, ''), password: PW, deviceId: dev() });
  assert.equal(ok.status, 201, 'login com a máscara removida também funciona'); assert.ok((await ok.json()).accessToken);
  const bad = await post('/v1/sessions/password', { whatsapp: wa, password: PW + 'x', deviceId: dev() });
  const none = await post('/v1/sessions/password', { whatsapp: phone(), password: PW, deviceId: dev() });
  assert.equal(bad.status, 401); assert.equal(none.status, 401);
  assert.deepEqual(await bad.json(), await none.json(), 'mesma resposta: não revela quais números têm conta');

  const acc = await (await post('/v1/billing/account', {}, a.session.accessToken)).json();
  assert.equal(acc.prefs.hasPassword, true);
});

test('login errado repetido é limitado por número', async () => {
  const wa = phone();
  await post('/v1/trial/start', { deviceId: dev(), whatsapp: wa, password: PW });
  let last;
  for (let i = 0; i < 9; i++) last = await post('/v1/sessions/password', { whatsapp: wa, password: 'errada-errada', deviceId: dev() });
  assert.equal(last.status, 429);
  assert.equal((await post('/v1/sessions/password', { whatsapp: wa, password: PW, deviceId: dev() })).status, 429, 'bloqueio vale também para a senha certa durante a janela');
});

test('conta antiga (só código) define WhatsApp + senha logada; troca e conflito de número', async () => {
  const { code } = await (await post('/v1/dev/households', {})).json();
  const s = await (await post('/v1/sessions', { code, deviceId: dev() })).json();
  const wa = phone();
  assert.equal((await post('/v1/account/password', { whatsapp: wa, password: '12345678' }, s.accessToken)).status, 422);
  assert.equal((await post('/v1/account/password', { whatsapp: wa, password: PW }, s.accessToken)).status, 200);
  assert.equal((await post('/v1/sessions/password', { whatsapp: wa, password: PW, deviceId: dev() })).status, 201);
  assert.equal((await post('/v1/account/password', { whatsapp: wa, password: PW + '2' }, s.accessToken)).status, 200, 'logada pode trocar a senha');
  assert.equal((await post('/v1/sessions/password', { whatsapp: wa, password: PW, deviceId: dev() })).status, 401, 'senha antiga deixa de valer');
  const other = await (await post('/v1/dev/households', {})).json(); const o = await (await post('/v1/sessions', { code: other.code, deviceId: dev() })).json();
  assert.equal((await post('/v1/account/password', { whatsapp: wa, password: PW }, o.accessToken)).status, 409, 'número de outra conta');
  assert.equal((await post('/v1/account/password', { whatsapp: wa, password: PW }, null)).status, 401);
});

test('exportar não traz hashes; apagar libera o número', async () => {
  const wa = phone();
  const a = await (await post('/v1/trial/start', { deviceId: dev(), whatsapp: wa, password: PW })).json();
  const exp = JSON.stringify(await (await post('/v1/privacy/export', {}, a.session.accessToken)).json());
  assert.ok(!/pw_hash|pw_salt|phone_hash/.test(exp) && !exp.includes(wa.replace(/\D/g, '')));
  assert.equal((await post('/v1/privacy/delete', { confirm: 'APAGAR' }, a.session.accessToken)).status, 200);
  assert.equal((await post('/v1/trial/start', { deviceId: dev(), whatsapp: wa, password: PW })).status, 201, 'número liberado depois de apagar');
});
