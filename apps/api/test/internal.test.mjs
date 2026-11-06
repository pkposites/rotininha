// Contas internas/de teste ficam fora das métricas; "contar a partir de"; funil de notificações.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const API = process.env.API_URL ?? 'http://localhost:8787';
const ADMIN = 'admin-token-local-de-teste-1234567890';
const rnd = () => randomBytes(5).toString('hex');
const ipH = () => ({ 'CF-Connecting-IP': `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
const post = (path, body, token) => fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...ipH(), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const adm = (path, body) => fetch(API + path, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${ADMIN}`, 'Content-Type': 'application/json', ...ipH() }, body: body === undefined ? undefined : JSON.stringify(body) }).then((r) => r.json());
const phone = () => `(11) 9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0').replace(/^(\d{4})(\d{4})$/, '$1-$2')}`;
const PW = 'minha senha 2026';
const signup = async (extra = {}) => { const wa = phone(); const r = await post('/v1/trial/start', { deviceId: 'dev' + rnd() + 'abcd', whatsapp: wa, password: PW, ...extra }); assert.equal(r.status, 201); return { wa, ...(await r.json()) }; };
const ov = () => adm('/v1/admin/overview?days=30');

test('conta criada por aparelho interno nasce como teste: usuário e uso ficam fora das métricas', async () => {
  const base = await ov();
  const real = await signup();
  const internal = await signup({ internal: true });
  const after = await ov();
  assert.equal(after.users.total, base.users.total + 1, 'só a conta real conta');
  assert.equal((await (await post('/v1/billing/account', {}, internal.session.accessToken)).json()).prefs.internal, true, 'o app fica sabendo que é interna');
  assert.equal((await (await post('/v1/billing/account', {}, real.session.accessToken)).json()).prefs.internal, false);
  // uso da conta de teste não é gravado; o da real é
  await post('/v1/usage', { events: [{ event: 'app_open', n: 1 }, { event: 'care_logged', n: 1 }] }, internal.session.accessToken);
  await post('/v1/usage', { events: [{ event: 'app_open', n: 1 }, { event: 'care_logged', n: 1 }] }, real.session.accessToken);
  const o2 = await ov();
  assert.equal(o2.users.dau, after.users.dau + 1, 'só a real aparece como ativa hoje');
});

test('marcar/desmarcar conta como teste pelo WhatsApp, e o painel mostra a diferença', async () => {
  const a = await signup();
  const t0 = await ov();
  assert.equal((await adm('/v1/admin/households/test-flag', { whatsapp: a.wa, test: true })).updated, 1);
  const t1 = await ov();
  assert.equal(t1.users.total, t0.users.total - 1, 'saiu das métricas');
  assert.equal(t1.internal.testAccounts, t0.internal.testAccounts + 1);
});

test('lookup informa se a conta é de teste; número sem conta não altera nada; só o admin mexe', async () => {
  const a = await signup();
  const look = await (await fetch(API + '/v1/admin/households/lookup', { method: 'POST', headers: { Authorization: `Bearer ${ADMIN}`, 'Content-Type': 'application/json', ...ipH() }, body: JSON.stringify({ whatsapp: a.wa }) })).json();
  assert.equal(look.found, true); assert.equal(look.isTest, false);
  assert.equal((await adm('/v1/admin/households/test-flag', { whatsapp: phone(), test: true })).updated, 0);
  assert.equal((await post('/v1/admin/households/test-flag', { whatsapp: a.wa, test: true })).status, 401);
  assert.equal((await adm('/v1/admin/households/test-flag', { whatsapp: a.wa })).error, 'bad_request');
});

test('analytics agregado: aparelho interno não conta', async () => {
  const before = (await adm('/v1/admin/metrics')).funnel.find((f) => f.event === 'lp_visit')?.n ?? 0;
  assert.equal((await post('/v1/analytics', { event: 'lp_visit', internal: true })).status, 204);
  assert.equal((await adm('/v1/admin/metrics')).funnel.find((f) => f.event === 'lp_visit')?.n ?? 0, before, 'interno: sem contagem');
  assert.equal((await post('/v1/analytics', { event: 'lp_visit' })).status, 204);
  assert.equal((await adm('/v1/admin/metrics')).funnel.find((f) => f.event === 'lp_visit')?.n ?? 0, before + 1, 'visita real conta');
});

test('"contar a partir de": ignora o que veio antes da data, sem apagar', async () => {
  const base = await ov();
  assert.ok(base.users.total >= 1);
  assert.equal((await adm('/v1/admin/metrics-from', { day: 'ontem' })).error, 'bad_request');
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  try {
    await adm('/v1/admin/metrics-from', { day: tomorrow });
    const o = await ov();
    assert.equal(o.internal.metricsFrom, tomorrow);
    assert.ok(o.users.newInWindow <= base.users.newInWindow, 'janela só diminui');
    assert.ok(o.series.signups.every((r) => r.day >= tomorrow), 'nenhum cadastro anterior à data de início entra');
    assert.ok(o.series.dau.every((r) => r.day >= tomorrow), 'nenhum uso anterior à data de início entra');
    assert.equal(o.users.total, base.users.total, 'o total de famílias continua o mesmo: nada foi apagado');
  } finally {
    await adm('/v1/admin/metrics-from', { day: null });
  }
  assert.equal((await ov()).internal.metricsFrom, null, 'limpar volta a contar tudo');
});

test('funil de notificações: eventos do convite são aceitos e aparecem no painel', async () => {
  const f = await signup();
  const o0 = await ov();
  await post('/v1/usage', { events: [{ event: 'push_prompt_shown', n: 1 }, { event: 'push_prompt_later', n: 1 }, { event: 'push_denied_seen', n: 1 }, { event: 'push_ios_install_hint', n: 1 }, { event: 'push_enabled', n: 1 }] }, f.session.accessToken);
  const o1 = await ov();
  assert.equal(o1.pushFunnel.asked, o0.pushFunnel.asked + 1);
  assert.equal(o1.pushFunnel.later, o0.pushFunnel.later + 1);
  assert.equal(o1.pushFunnel.blocked, o0.pushFunnel.blocked + 1);
  assert.equal(o1.pushFunnel.iosInstall, o0.pushFunnel.iosInstall + 1);
  assert.equal(o1.pushFunnel.enabled, o0.pushFunnel.enabled + 1);
});
