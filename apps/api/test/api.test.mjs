// Teste de integração: exige o Worker rodando (npm run dev) com .dev.vars (ALLOW_DEV_SIGNUP=true).
import test from 'node:test';
import assert from 'node:assert/strict';

const API = process.env.API_URL ?? 'http://localhost:8787';
const post = (path, body, token, extra = {}) =>
  fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
    body: JSON.stringify(body)
  });
const rnd = () => 'dev' + Math.random().toString(36).slice(2, 12).padEnd(10, 'x');
const now = Date.now();
const ev = (id, over = {}) => ({ id, type: 'mamada', startedAt: now - 5000, endedAt: null, note: '', detail: '', updatedAt: now, deleted: false, ...over });

async function newFamily() {
  const r = await post('/v1/dev/households', {});
  assert.equal(r.status, 201);
  const { code } = await r.json();
  const s = await post('/v1/sessions', { code, deviceId: rnd() }, null, { 'CF-Connecting-IP': '10.0.0.' + Math.floor(Math.random() * 250) });
  assert.equal(s.status, 201);
  return { code, ...(await s.json()) };
}

test('código tem formato forte e login falha com código errado', async () => {
  const f = await newFamily();
  assert.match(f.code, /^[2-9A-Z]{5}(-[2-9A-Z]{5}){3}$/);
  const bad = await post('/v1/sessions', { code: 'AAAAA-AAAAA-AAAAA-AAAAA', deviceId: rnd() }, null, { 'CF-Connecting-IP': '10.9.9.1' });
  assert.equal(bad.status, 401);
});

test('sem token → 401; token inválido → 401', async () => {
  assert.equal((await post('/v1/sync', { cursor: 0, changes: [] })).status, 401);
  assert.equal((await post('/v1/sync', { cursor: 0, changes: [] }, 'x'.repeat(43))).status, 401);
});

test('sync é idempotente e devolve o evento', async () => {
  const f = await newFamily();
  const id = rnd() + 'a';
  for (let i = 0; i < 2; i++) assert.equal((await post('/v1/sync', { cursor: 0, changes: [ev(id)] }, f.accessToken)).status, 200);
  const r = await (await post('/v1/sync', { cursor: 0, changes: [] }, f.accessToken)).json();
  assert.equal(r.changes.filter((c) => c.id === id).length, 1);
});

test('último que escreve vence; update antigo é ignorado', async () => {
  const f = await newFamily(); const id = rnd() + 'b';
  await post('/v1/sync', { cursor: 0, changes: [ev(id, { note: 'novo', updatedAt: now })] }, f.accessToken);
  await post('/v1/sync', { cursor: 0, changes: [ev(id, { note: 'velho', updatedAt: now - 10000 })] }, f.accessToken);
  const r = await (await post('/v1/sync', { cursor: 0, changes: [] }, f.accessToken)).json();
  assert.equal(r.changes.find((c) => c.id === id).note, 'novo');
});

test('exclusão vira tombstone e chega ao outro aparelho pelo cursor', async () => {
  const f = await newFamily(); const id = rnd() + 'c';
  const first = await (await post('/v1/sync', { cursor: 0, changes: [ev(id)] }, f.accessToken)).json();
  await post('/v1/sync', { cursor: first.cursor, changes: [ev(id, { deleted: true, updatedAt: now + 1000 })] }, f.accessToken);
  const r = await (await post('/v1/sync', { cursor: first.cursor, changes: [] }, f.accessToken)).json();
  assert.equal(r.changes.length, 1); assert.equal(r.changes[0].deleted, true);
});

test('famílias são isoladas', async () => {
  const a = await newFamily(), b = await newFamily(); const id = rnd() + 'd';
  await post('/v1/sync', { cursor: 0, changes: [ev(id)] }, a.accessToken);
  const r = await (await post('/v1/sync', { cursor: 0, changes: [] }, b.accessToken)).json();
  assert.equal(r.changes.length, 0);
});

test('validação rejeita evento inválido e lote grande', async () => {
  const f = await newFamily();
  assert.equal((await post('/v1/sync', { cursor: 0, changes: [ev('curto')] }, f.accessToken)).status, 422);
  assert.equal((await post('/v1/sync', { cursor: 0, changes: [ev(rnd() + 'e', { type: 'x' })] }, f.accessToken)).status, 422);
  const many = Array.from({ length: 201 }, (_, i) => ev(rnd() + i));
  assert.equal((await post('/v1/sync', { cursor: 0, changes: many }, f.accessToken)).status, 413);
});

test('refresh rotaciona: refresh antigo não funciona de novo; access antigo some', async () => {
  const f = await newFamily();
  const r1 = await post('/v1/sessions/refresh', { refreshToken: f.refreshToken });
  assert.equal(r1.status, 201);
  assert.equal((await post('/v1/sessions/refresh', { refreshToken: f.refreshToken })).status, 401);
  assert.equal((await post('/v1/sync', { cursor: 0, changes: [] }, f.accessToken)).status, 401);
  const n = await r1.json();
  assert.equal((await post('/v1/sync', { cursor: 0, changes: [] }, n.accessToken)).status, 200);
});

test('logout revoga a sessão', async () => {
  const f = await newFamily();
  assert.equal((await post('/v1/sessions/logout', {}, f.accessToken)).status, 200);
  assert.equal((await post('/v1/sync', { cursor: 0, changes: [] }, f.accessToken)).status, 401);
});

test('força bruta: 11ª tentativa do mesmo IP é bloqueada', async () => {
  const ip = { 'CF-Connecting-IP': '172.16.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250) };
  let last;
  for (let i = 0; i < 11; i++) last = await post('/v1/sessions', { code: 'BBBBB-BBBBB-BBBBB-BBBBB', deviceId: rnd() }, null, ip);
  assert.equal(last.status, 429);
});

test('erros não vazam código nem tokens', async () => {
  const r = await post('/v1/sessions', { code: 'ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ', deviceId: rnd() }, null, { 'CF-Connecting-IP': '10.8.8.8' });
  const t = await r.text();
  assert.ok(!t.includes('ZZZZZ'));
});
