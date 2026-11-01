// API de Conversões da Meta: só com consentimento, sem dados do bebê, uma vez por pagamento. Mercado Pago e Meta SIMULADOS.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { manifest, signManifest } from '../src/mpsig.ts';

const _fetch = globalThis.fetch;
globalThis.fetch = async (...a) => { try { return await _fetch(...a); } catch { return _fetch(...a); } };

const API = process.env.API_URL ?? 'http://localhost:8787';
const STATE = process.env.D1_STATE ?? '/tmp/claude-0/d1state';
const ADMIN = 'admin-token-local-de-teste-1234567890';
const rnd = () => randomBytes(5).toString('hex');
const ipH = () => ({ 'CF-Connecting-IP': `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
const CPF = '52998224725';
const FBP = 'fb.1.1700000000000.1234567890', FBC = 'fb.1.1700000000000.AbCdEf-123_x';
const post = (path, body, token, extra = {}) =>
  fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...ipH(), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, body: JSON.stringify(body) });
const json = async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) });
const sql = (q) => {
  for (let i = 0; ; i++) {
    try {
      const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'rotininha', '--local', '--persist-to', STATE, '--json', '--command', q],
        { encoding: 'utf8', cwd: new URL('..', import.meta.url).pathname, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_UPDATE_NOTIFIER: '1' } });
      return JSON.parse(out.slice(out.indexOf('[')))[0].results;
    } catch (e) { if (i >= 3) throw e; }
  }
};

const mp = { payments: new Map(), seq: Date.now() };
const meta = { calls: [], fail: false };
let mpServer, metaServer;
before(async () => {
  mpServer = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    const send = (st, o) => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.method === 'POST' && req.url === '/v1/payments') {
      const id = String(++mp.seq);
      const p = { id, status: 'pending', transaction_amount: body.transaction_amount, currency_id: 'BRL', payment_method_id: 'pix', external_reference: body.external_reference, point_of_interaction: { transaction_data: { qr_code: '00020126PIX' + id, qr_base64: 'iVBOR' } } };
      mp.payments.set(id, p); return send(201, p);
    }
    const m = /^\/v1\/payments\/(\w+)$/.exec(req.url);
    if (m) return mp.payments.has(m[1]) ? send(200, mp.payments.get(m[1])) : send(404, {});
    send(404, {});
  });
  metaServer = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    meta.calls.push({ url: req.url, body: JSON.parse(Buffer.concat(chunks).toString() || '{}') });
    res.writeHead(meta.fail ? 500 : 200, { 'content-type': 'application/json' }); res.end('{"events_received":1}');
  });
  await Promise.all([new Promise((r) => mpServer.listen(19877, r)), new Promise((r) => metaServer.listen(19879, r))]);
});
after(() => { mpServer.close(); metaServer.close(); });

async function webhook(mpId) {
  const reqId = 'r' + rnd(), ts = String(Date.now());
  const v1 = await signManifest('whsec_test', manifest(String(mpId), reqId, ts));
  return fetch(`${API}/v1/webhooks/mercadopago?data.id=${mpId}&type=payment`, { method: 'POST', headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': reqId, 'content-type': 'application/json', ...ipH() }, body: '{}' });
}
const pay = (mpId) => { mp.payments.get(String(mpId)).status = 'approved'; return webhook(mpId); };

async function buy(extra = {}, email = `c${rnd()}@Exemplo.com`) {
  const r = await json(await post('/v1/checkout', { plan: 'life', email, cpf: CPF, ...extra }, null, { 'User-Agent': 'Mozilla/5.0 (iPhone) TesteUA' }));
  assert.equal(r.status, 201, JSON.stringify(r));
  return { ...r, email, mpId: String(mp.seq) };
}
const callsFor = (id) => meta.calls.filter((c) => c.body.data?.[0]?.event_id === id);
const sha = (s) => createHash('sha256').update(s).digest('hex');

test('com consentimento: um Purchase com e-mail em hash, valor e ids do navegador — e nada além disso', async () => {
  const c = await buy({ marketingConsent: true, fbp: FBP, fbc: FBC, sourceUrl: 'http://localhost:4173/' });
  await pay(c.mpId);
  const calls = callsFor(c.paymentId);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^\/v21\.0\/123456789012345\/events$/);
  assert.equal(calls[0].body.access_token, 'capi-token-local');
  const ev = calls[0].body.data[0];
  assert.equal(ev.event_name, 'Purchase'); assert.equal(ev.event_id, c.paymentId); assert.equal(ev.action_source, 'website');
  assert.equal(ev.event_source_url, 'http://localhost:4173/');
  assert.deepEqual(ev.custom_data, { currency: 'BRL', value: 37.9 });
  assert.deepEqual(ev.user_data.em, [sha(c.email.toLowerCase())], 'e-mail normalizado e com hash SHA-256');
  assert.equal(ev.user_data.fbp, FBP); assert.equal(ev.user_data.fbc, FBC);
  assert.ok(ev.user_data.client_ip_address && ev.user_data.client_user_agent.includes('TesteUA'));
  assert.deepEqual(Object.keys(ev.user_data).sort(), ['client_ip_address', 'client_user_agent', 'em', 'fbc', 'fbp']);
  assert.deepEqual(Object.keys(ev).sort(), ['action_source', 'custom_data', 'event_id', 'event_name', 'event_source_url', 'event_time', 'user_data']);
  const raw = JSON.stringify(calls[0].body).toLowerCase();
  for (const bad of [CPF, c.email.toLowerCase(), 'bebê', 'bebe', 'idade', 'quiz', 'remédio', 'remedio', 'mamada', 'sono', 'fralda', 'faixa']) assert.ok(!raw.includes(bad), 'não pode conter: ' + bad);
});

test('webhooks duplicados não geram dois eventos', async () => {
  const c = await buy({ marketingConsent: true, fbp: FBP });
  await Promise.all([pay(c.mpId), webhook(c.mpId), webhook(c.mpId), webhook(c.mpId)]);
  await webhook(c.mpId);
  assert.equal(callsFor(c.paymentId).length, 1);
});

test('dados de rastreio são apagados depois do envio', async () => {
  const c = await buy({ marketingConsent: true, fbp: FBP, fbc: FBC });
  const before = sql(`SELECT marketing_consent AS mc, fbp IS NOT NULL AS tem_fbp, client_ip IS NOT NULL AS tem_ip FROM payments WHERE id='${c.paymentId}'`)[0];
  assert.equal(Number(before.mc), 1); assert.equal(Number(before.tem_fbp), 1); assert.equal(Number(before.tem_ip), 1);
  await pay(c.mpId);
  const after = sql(`SELECT fbp IS NULL AS a, fbc IS NULL AS b, client_ip IS NULL AS c, client_ua IS NULL AS d, capi_sent_at IS NOT NULL AS sent FROM payments WHERE id='${c.paymentId}'`)[0];
  assert.deepEqual([after.a, after.b, after.c, after.d, after.sent].map(Number), [1, 1, 1, 1, 1]);
});

test('sem consentimento (ausente, false ou "true" como texto): nada é guardado nem enviado', async () => {
  for (const extra of [{}, { marketingConsent: false, fbp: FBP }, { marketingConsent: 'true', fbp: FBP }, { fbp: FBP, fbc: FBC }]) {
    const c = await buy(extra);
    const row = sql(`SELECT marketing_consent AS mc, fbp IS NULL AS a, fbc IS NULL AS b, client_ip IS NULL AS ip, client_ua IS NULL AS ua FROM payments WHERE id='${c.paymentId}'`)[0];
    assert.deepEqual([row.mc, row.a, row.b, row.ip, row.ua].map(Number), [0, 1, 1, 1, 1], 'nada de rastreio guardado: ' + JSON.stringify(extra));
    await pay(c.mpId);
    assert.equal(callsFor(c.paymentId).length, 0, 'nenhum envio à Meta: ' + JSON.stringify(extra));
  }
});

test('identificadores inválidos e URL de outro domínio são descartados', async () => {
  const c = await buy({ marketingConsent: true, fbp: '<script>', fbc: 'x'.repeat(500), sourceUrl: 'https://malicioso.example/' });
  await pay(c.mpId);
  const ev = callsFor(c.paymentId)[0].body.data[0];
  assert.ok(!('fbp' in ev.user_data) && !('fbc' in ev.user_data));
  assert.equal(ev.event_source_url, 'http://localhost:4173', 'usa a origem do app, não a do cliente');
});

test('Meta fora do ar: o acesso é liberado mesmo assim, sem reenvio e sem reter dados', async () => {
  meta.fail = true;
  const c = await buy({ marketingConsent: true, fbp: FBP });
  assert.equal((await pay(c.mpId)).status, 200);
  meta.fail = false;
  const claim = await json(await post('/v1/checkout/claim', { paymentId: c.paymentId, pollToken: c.pollToken, deviceId: 'dev' + rnd() + 'abcd' }));
  assert.equal(claim.status, 200, 'acesso liberado apesar da falha da Meta');
  await webhook(c.mpId);
  assert.equal(callsFor(c.paymentId).length, 1, 'uma única tentativa');
  const row = sql(`SELECT fbp IS NULL AS a, client_ip IS NULL AS b, capi_sent_at IS NULL AS not_sent FROM payments WHERE id='${c.paymentId}'`)[0];
  assert.deepEqual([row.a, row.b, row.not_sent].map(Number), [1, 1, 1], 'dados apagados; marcado como não enviado');
});

test('compra após o teste gera outro evento (outro event_id e valor)', async () => {
  const c = await buy({ marketingConsent: true, fbp: FBP });
  await pay(c.mpId);
  const claim = await json(await post('/v1/checkout/claim', { paymentId: c.paymentId, pollToken: c.pollToken, deviceId: 'dev' + rnd() + 'abcd' }));
  sql(`UPDATE households SET plan='trial', valid_until=${Date.now() + 86400000} WHERE id=(SELECT household_id FROM payments WHERE id='${c.paymentId}')`);
  const r = await json(await post('/v1/billing/renew', { plan: 'life', cpf: CPF, marketingConsent: true, fbp: FBP }, claim.session.accessToken));
  assert.equal(r.status, 201);
  await pay(String(mp.seq));
  const ev = callsFor(r.paymentId)[0].body.data[0];
  assert.equal(ev.custom_data.value, 37.9); assert.notEqual(ev.event_id, c.paymentId);
  assert.equal(callsFor(c.paymentId).length, 1);
});

test('contadores agregados: pix_paid e renewal_paid (sem identificador)', async () => {
  const m = await (await fetch(API + '/v1/admin/metrics', { headers: { Authorization: 'Bearer ' + ADMIN, ...ipH() } })).json();
  const ev = Object.fromEntries(m.funnel.map((f) => [f.event, f.n]));
  assert.ok(ev.pix_paid >= 3 && ev.renewal_paid >= 1, JSON.stringify(ev));
});
