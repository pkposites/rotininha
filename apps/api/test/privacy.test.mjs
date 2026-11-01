import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

// Conexões ociosas reaproveitadas pelo Node podem ter sido fechadas pelo servidor local: uma retentativa resolve.
const _fetch = globalThis.fetch;
globalThis.fetch = async (...a) => { try { return await _fetch(...a); } catch { return _fetch(...a); } };

const API = process.env.API_URL ?? 'http://localhost:8787';
const STATE = process.env.D1_STATE ?? '/tmp/claude-0/d1state';
const rnd = () => randomBytes(5).toString('hex');
const ipH = () => ({ 'CF-Connecting-IP': `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
const post = (path, body, token) =>
  fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...ipH(), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const sql = (q) => {
  for (let i = 0; ; i++) {
    try {
      const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'rotininha', '--local', '--persist-to', STATE, '--json', '--command', q],
        { encoding: 'utf8', cwd: new URL('..', import.meta.url).pathname, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_UPDATE_NOTIFIER: '1' } });
      return JSON.parse(out.slice(out.indexOf('[')))[0].results;
    } catch (e) { if (i >= 3) throw e; } // a CLI do wrangler às vezes falha em chamadas de rede auxiliares
  }
};

async function family() {
  const { code } = await (await post('/v1/dev/households', {})).json();
  const s = await (await post('/v1/sessions', { code, deviceId: 'dev' + rnd() + 'abcd' })).json();
  const hh = sql(`SELECT id FROM households ORDER BY created_at DESC LIMIT 1`)[0].id;
  return { code, tok: s.accessToken, id: hh };
}
const ev = (over = {}) => ({ kind: 'event', id: 'ev' + rnd() + 'abcd', type: 'mamada', startedAt: Date.now() - 1000, endedAt: null, note: 'nota', detail: '', updatedAt: Date.now(), deleted: false, ...over });

test('cabeçalhos de segurança em todas as respostas da API', async () => {
  const r = await fetch(API + '/v1/plans');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
  assert.match(r.headers.get('strict-transport-security'), /max-age=\d+/);
  assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('exportar: exige sessão e entrega os dados da própria família, sem segredos', async () => {
  assert.equal((await post('/v1/privacy/export', {})).status, 401);
  const f = await family(); const e = ev({ note: 'segredo-' + rnd() });
  await post('/v1/sync', { cursor: 0, changes: [e] }, f.tok);
  await post('/v1/feedback', { category: 'outros', text: 'minha ideia ' + e.note }, f.tok);
  const other = await family(); await post('/v1/sync', { cursor: 0, changes: [ev({ note: 'DE-OUTRA-FAMILIA' })] }, other.tok);
  const out = await (await post('/v1/privacy/export', {}, f.tok)).json();
  const txt = JSON.stringify(out);
  assert.ok(out.registros.some((r) => r.note === e.note), 'inclui os registros');
  assert.ok(out.sugestoes.some((s) => s.texto.includes(e.note)), 'inclui as sugestões');
  assert.ok(!txt.includes('DE-OUTRA-FAMILIA'), 'não vaza dados de outra família');
  for (const bad of ['code_hash', 'keys_sealed', 'access_hash', 'refresh_hash', 'poll_hash', f.code]) assert.ok(!txt.includes(bad), 'não deve conter ' + bad);
});

test('apagar: exige confirmação explícita; depois nada resta e o acesso deixa de existir', async () => {
  const f = await family(); const keep = await family();
  const e = ev({ note: 'apagar-' + rnd() });
  await post('/v1/sync', { cursor: 0, changes: [e] }, f.tok);
  await post('/v1/sync', { cursor: 0, changes: [ev({ note: 'manter-' + rnd() })] }, keep.tok);
  await post('/v1/feedback', { category: 'outros', text: 'sugestão ' + e.note }, f.tok);
  sql(`INSERT INTO payments (id, kind, plan, days, amount_cents, status, email, household_id, poll_hash, created_at, applied_at) VALUES ('pay-${f.id}', 'entry', '7d', 7, 1190, 'approved', 'mae-${f.id}@exemplo.com', '${f.id}', 'hash', ${Date.now()}, ${Date.now()})`);

  assert.equal((await post('/v1/privacy/delete', {}, f.tok)).status, 400, 'sem confirmação não apaga');
  assert.equal((await post('/v1/privacy/delete', { confirm: 'sim' }, f.tok)).status, 400);
  assert.equal(sql(`SELECT COUNT(*) AS n FROM records WHERE household_id='${f.id}'`)[0].n, 1, 'nada foi apagado ainda');
  assert.equal((await post('/v1/privacy/delete', { confirm: 'APAGAR' }, f.tok)).status, 200);

  for (const t of ['records', 'sessions', 'push_subscriptions', 'recovery_tokens']) assert.equal(sql(`SELECT COUNT(*) AS n FROM ${t} WHERE household_id='${f.id}'`)[0].n, 0, t);
  assert.equal(sql(`SELECT COUNT(*) AS n FROM households WHERE id='${f.id}'`)[0].n, 0);
  assert.equal(sql(`SELECT COUNT(*) AS n FROM feedback_suggestions WHERE text LIKE '%${e.note}%'`)[0].n, 0, 'sugestões apagadas');
  const pay = sql(`SELECT email, household_id IS NULL AS sem_vinculo FROM payments WHERE id='pay-${f.id}'`)[0];
  assert.equal(pay.email, 'apagado'); assert.equal(Number(pay.sem_vinculo), 1, 'pagamento sem e-mail e sem vínculo');
  assert.equal((await post('/v1/sessions', { code: f.code, deviceId: 'dev' + rnd() + 'zzzz' })).status, 401, 'código não existe mais');
  assert.equal((await post('/v1/sync', { cursor: 0, changes: [] }, f.tok)).status, 401, 'sessão encerrada');
  assert.equal(sql(`SELECT COUNT(*) AS n FROM records WHERE household_id='${keep.id}'`)[0].n, 1, 'outra família intacta');
});

test('retenção: famílias vencidas há mais de 12 meses são apagadas pelo Cron; as demais ficam', async () => {
  const old = await family(), recent = await family();
  await post('/v1/sync', { cursor: 0, changes: [ev()] }, old.tok); await post('/v1/sync', { cursor: 0, changes: [ev()] }, recent.tok);
  const hourBoundary = Math.floor(Date.now() / 3_600_000) * 3_600_000; // o Cron faz a limpeza na virada da hora
  sql(`UPDATE households SET valid_until=${hourBoundary - 400 * 86400000}, grace_until=${hourBoundary - 399 * 86400000} WHERE id='${old.id}'`);
  sql(`UPDATE households SET valid_until=${hourBoundary - 100 * 86400000}, grace_until=${hourBoundary - 99 * 86400000} WHERE id='${recent.id}'`);
  await post('/v1/dev/tick', { now: hourBoundary });
  assert.equal(sql(`SELECT COUNT(*) AS n FROM households WHERE id='${old.id}'`)[0].n, 0, 'vencida há 399 dias: apagada');
  assert.equal(sql(`SELECT COUNT(*) AS n FROM records WHERE household_id='${old.id}'`)[0].n, 0);
  assert.equal(sql(`SELECT COUNT(*) AS n FROM households WHERE id='${recent.id}'`)[0].n, 1, 'vencida há 99 dias: permanece (modo leitura)');
});
