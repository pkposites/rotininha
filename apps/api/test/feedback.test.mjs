import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { csvCell } from '../src/csv.ts';

const API = process.env.API_URL ?? 'http://localhost:8787';
const STATE = process.env.D1_STATE ?? '/tmp/claude-0/d1state';
const ADMIN = 'admin-token-local-de-teste-1234567890';
const rnd = () => randomBytes(5).toString('hex');
const ipH = () => ({ 'CF-Connecting-IP': `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
const post = (path, body, token, extra = {}) =>
  fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...ipH(), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, body: JSON.stringify(body) });
const admin = (path, init = {}) => fetch(API + path, { ...init, headers: { Authorization: `Bearer ${ADMIN}`, 'Content-Type': 'application/json', ...ipH(), ...(init.headers ?? {}) } });
const sql = (q) => { const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'rotininha', '--local', '--persist-to', STATE, '--json', '--command', q], { encoding: 'utf8', cwd: new URL('..', import.meta.url).pathname }); return JSON.parse(out.slice(out.indexOf('[')))[0].results; };

async function family() {
  const { code } = await (await post('/v1/dev/households', {})).json();
  return (await (await post('/v1/sessions', { code, deviceId: 'dev' + rnd() + 'abcd' })).json()).accessToken;
}

test('csvCell neutraliza fórmulas e aspas (unidade)', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('+55 11'), `"'+55 11"`);
  assert.equal(csvCell('-1'), `"'-1"`);
  assert.equal(csvCell('@soma'), `"'@soma"`);
  assert.equal(csvCell('linha1\nlinha2'), '"linha1 linha2"');
  assert.equal(csvCell('normal, com vírgula'), '"normal, com vírgula"');
});

test('enviar sugestão exige sessão; valida categoria e tamanho', async () => {
  assert.equal((await post('/v1/feedback', { category: 'lembretes', text: 'oi' })).status, 401);
  const tok = await family();
  assert.equal((await post('/v1/feedback', { category: 'inventada', text: 'x' }, tok)).status, 422);
  assert.equal((await post('/v1/feedback', { category: 'lembretes', text: 'a'.repeat(501) }, tok)).status, 422);
  assert.equal((await post('/v1/feedback', {}, tok)).status, 422, 'vazio não vale');
  assert.equal((await post('/v1/feedback', { category: 'registros', text: 'a'.repeat(500) }, tok)).status, 201);
  assert.equal((await post('/v1/feedback', { category: 'outros' }, tok)).status, 201, 'só a categoria vale (texto opcional)');
});

test('limite: 3 sugestões por dia por família', async () => {
  const tok = await family(); let last;
  for (let i = 0; i < 4; i++) last = await post('/v1/feedback', { category: 'outros', text: 'ideia ' + i }, tok);
  assert.equal(last.status, 429);
});

test('armazenamento mínimo: sem família identificável, sem dados do bebê; pseudônimo estável', async () => {
  const code = rnd();
  const tok = await family();
  await post('/v1/feedback', { category: 'compartilhar', text: 'texto-' + code }, tok);
  await post('/v1/feedback', { category: 'compartilhar', text: 'texto2-' + code }, tok);
  const rows = sql(`SELECT * FROM feedback_suggestions WHERE text LIKE '%${code}'`);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].pseudo_id, rows[1].pseudo_id, 'mesmo pseudônimo para a mesma família');
  assert.match(rows[0].pseudo_id, /^[0-9a-f]{64}$/);
  const hh = sql(`SELECT id FROM households`).map((r) => r.id);
  assert.ok(!hh.includes(rows[0].pseudo_id), 'pseudônimo não é o id da família');
  assert.deepEqual(Object.keys(rows[0]).sort(), ['category', 'created_at', 'id', 'pseudo_id', 'status', 'text']);
});

test('administração: sem token → 401; token errado → 401; nunca pública', async () => {
  assert.equal((await fetch(API + '/v1/admin/feedback.csv', { headers: ipH() })).status, 401);
  assert.equal((await fetch(API + '/v1/admin/feedback.csv', { headers: { Authorization: 'Bearer ' + 'x'.repeat(40), ...ipH() } })).status, 401);
  assert.equal((await fetch(API + '/v1/admin/metrics', { headers: { Authorization: `Bearer ${ADMIN.slice(0, -1)}`, ...ipH() } })).status, 401);
});

test('administração: exporta CSV seguro, muda status, apaga a pedido', async () => {
  const tok = await family(); const tag = rnd();
  await post('/v1/feedback', { category: 'lembretes', text: `=CMD()|${tag}` }, tok);
  const csv = await (await admin('/v1/admin/feedback.csv')).text();
  assert.ok(csv.startsWith('id,data,categoria,status,texto'));
  const line = csv.split('\n').find((l) => l.includes(tag));
  assert.ok(line.includes(`"'=CMD()`), 'fórmula neutralizada: ' + line);
  const id = /^"([^"]+)"/.exec(line)[1];
  assert.equal((await (await admin('/v1/admin/feedback/status', { method: 'POST', body: JSON.stringify({ id, status: 'planejado' }) })).json()).updated, 1);
  assert.equal((await admin('/v1/admin/feedback/status', { method: 'POST', body: JSON.stringify({ id, status: 'xyz' }) })).status, 400);
  const planned = await (await admin('/v1/admin/feedback.csv?status=planejado')).text();
  assert.ok(planned.includes(tag));
  assert.equal((await (await admin('/v1/admin/feedback/delete', { method: 'POST', body: JSON.stringify({ id }) })).json()).deleted, 1);
  assert.ok(!(await (await admin('/v1/admin/feedback.csv')).text()).includes(tag), 'exclusão atendida');
});

test('analytics: só eventos permitidos, sem identificador, agregado por dia; limite por IP', async () => {
  assert.equal((await post('/v1/analytics', { event: 'qualquer_coisa' })).status, 400);
  assert.equal((await post('/v1/analytics', { event: 'lp_visit' })).status, 204);
  await post('/v1/analytics', { event: 'lp_visit', userId: 'abc', email: 'x@y.com' }); // campos extras são ignorados
  const m = await (await admin('/v1/admin/metrics')).json();
  assert.ok(m.funnel.find((f) => f.event === 'lp_visit').n >= 2);
  const cols = sql(`PRAGMA table_info(funnel_counts)`).map((c) => c.name).sort();
  assert.deepEqual(cols, ['day', 'event', 'n'], 'tabela não tem coluna de identificação');
  const ip = { 'CF-Connecting-IP': '203.0.113.' + Math.floor(Math.random() * 250) };
  let last;
  for (let i = 0; i < 301; i++) last = await fetch(API + '/v1/analytics', { method: 'POST', headers: { 'content-type': 'application/json', ...ip }, body: JSON.stringify({ event: 'lp_visit' }) });
  assert.equal(last.status, 429);
});
