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

// ---------------------------------------------------------------- recuperação de acesso (prova de acesso ao e-mail)
const outbox = async (to) => (await (await fetch(`${API}/v1/dev/outbox?to=${encodeURIComponent(to)}`)).json()).messages;
const tokenFrom = (m) => /#recover=([\w-]+)/.exec(m.body)[1];
const accountOf = async (tok) => (await post('/v1/billing/account', {}, tok)).json();

test('recuperar: só com o link do e-mail; nova senha mantém registros, encerra sessões e o link vale uma vez', async () => {
  const wa = phone(), email = `rec${rnd()}@exemplo.com`;
  const a = await (await post('/v1/trial/start', { deviceId: dev(), whatsapp: wa, password: PW, email })).json();
  const ev = { kind: 'event', id: 'ev-rec-' + rnd(), type: 'mamada', startedAt: Date.now() - 600_000, endedAt: null, note: 'precisa sobreviver', detail: '', updatedAt: Date.now(), deleted: false };
  assert.equal((await post('/v1/sync', { cursor: 0, changes: [ev] }, a.session.accessToken)).status, 200);

  // pedir: resposta neutra, igual para e-mail que não existe
  const known = await post('/v1/recovery/request', { email }); const unknown = await post('/v1/recovery/request', { email: `nao${rnd()}@exemplo.com` });
  assert.equal(known.status, 200); assert.deepEqual(await known.json(), await unknown.json());
  const mails = await outbox(email); assert.equal(mails.length, 1); assert.match(mails[0].body, /nova senha/); assert.doesNotMatch(mails[0].body, new RegExp(PW));
  assert.equal((await outbox(`nao@exemplo.com`)).length, 0);
  const token = tokenFrom(mails[0]);

  // sem o link, ninguém redefine: só com WhatsApp ou e-mail não dá
  assert.equal((await post('/v1/recovery/password', { deviceId: dev(), whatsapp: wa, password: 'outra senha 2026' })).status, 410);
  assert.equal((await post('/v1/recovery/password', { deviceId: dev(), token: 'inventado', password: 'outra senha 2026' })).status, 410);
  assert.equal((await post('/v1/recovery/password', { deviceId: dev(), token, password: '12345678' })).status, 422, 'senha fraca não gasta o link');

  const NEW = 'senha nova 2027 ok';
  const ok = await post('/v1/recovery/password', { deviceId: dev(), token, password: NEW });
  assert.equal(ok.status, 200); const nova = (await ok.json()).session;
  assert.equal((await post('/v1/recovery/password', { deviceId: dev(), token, password: NEW + 'x' })).status, 410, 'link de uso único');
  assert.equal((await post('/v1/billing/account', {}, a.session.accessToken)).status, 401, 'sessão antiga encerrada');
  assert.equal((await post('/v1/sessions/password', { whatsapp: wa, password: PW, deviceId: dev() })).status, 401, 'senha antiga não vale mais');
  const login = await post('/v1/sessions/password', { whatsapp: wa, password: NEW, deviceId: dev() });
  assert.equal(login.status, 201);
  const pull = await (await post('/v1/sync', { cursor: 0, changes: [] }, (await login.json()).accessToken)).json();
  assert.ok(pull.changes.some((c) => c.id === ev.id && c.note === 'precisa sobreviver'), 'registros continuam na conta');
  assert.equal((await accountOf(nova.accessToken)).prefs.hasPassword, true);
});

test('recuperar: link vencido é recusado; conta antiga (sem WhatsApp) informa o número e não pode tomar o de outra conta', async () => {
  const { code } = await (await post('/v1/dev/households', {})).json();
  const s = await (await post('/v1/sessions', { code, deviceId: dev() })).json();
  const email = `leg${rnd()}@exemplo.com`;
  assert.equal((await post('/v1/settings', { contactEmail: email }, s.accessToken)).status, 200);
  await post('/v1/recovery/request', { email });
  const token = tokenFrom((await outbox(email))[0]);
  assert.equal((await post('/v1/recovery/password', { deviceId: dev(), token, password: PW })).status, 422, 'conta sem WhatsApp precisa informá-lo');
  const taken = phone(); await post('/v1/trial/start', { deviceId: dev(), whatsapp: taken, password: PW });
  assert.equal((await post('/v1/recovery/password', { deviceId: dev(), token, password: PW, whatsapp: taken })).status, 409, 'número de outra conta');
  const mine = phone();
  assert.equal((await post('/v1/recovery/password', { deviceId: dev(), token, password: PW, whatsapp: mine })).status, 200);
  assert.equal((await post('/v1/sessions', { code, deviceId: dev() })).status, 401, 'o código antigo deixa de valer depois da recuperação');
  assert.equal((await post('/v1/sessions/password', { whatsapp: mine, password: PW, deviceId: dev() })).status, 201, 'conta antiga passa a entrar com WhatsApp e senha');
});
