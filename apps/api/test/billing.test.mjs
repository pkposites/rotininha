// Integração do faturamento: Worker (wrangler dev) ↔ Mercado Pago SIMULADO (localhost:19877).
// O simulador valida método, cabeçalhos e corpo como a API real exigiria.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { manifest, signManifest, verifyMpSignature, parseSignature } from '../src/mpsig.ts';

// Conexões ociosas reaproveitadas pelo Node podem ter sido fechadas pelo servidor local: uma retentativa resolve.
const _fetch = globalThis.fetch;
globalThis.fetch = async (...a) => { try { return await _fetch(...a); } catch { return _fetch(...a); } };

const API = process.env.API_URL ?? 'http://localhost:8787';
const MP_PORT = 19877, PUSH_PORT = 19878, SECRET = 'whsec_test';
const STATE = process.env.D1_STATE ?? '/tmp/claude-0/d1state';
const DAY = 86_400_000;
const rnd = () => randomBytes(5).toString('hex');
const ip = () => ({ 'CF-Connecting-IP': `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
const post = (path, body, token, extra = {}) =>
  fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...ip(), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, body: JSON.stringify(body) });
const json = async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) });
const CPF = '52998224725'; // CPF válido de teste

// ---------------- Mercado Pago simulado ----------------
const mp = { payments: new Map(), seq: Date.now(), created: [], failCreate: false };
let mpServer, pushServer; const pushHits = [];
before(async () => {
  mpServer = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    const send = (st, o) => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.method === 'POST' && req.url === '/v1/payments') {
      if (mp.failCreate) return send(500, { message: 'boom' });
      if (req.headers.authorization !== 'Bearer TEST-token-local') return send(401, {});
      if (!req.headers['x-idempotency-key']) return send(400, { message: 'X-Idempotency-Key obrigatório' });
      if (body.payment_method_id !== 'pix' || !body.payer?.email || !body.payer?.identification?.number) return send(400, { message: 'dados do pagador' });
      const id = ++mp.seq;
      const p = { id, status: 'pending', transaction_amount: body.transaction_amount, currency_id: 'BRL', payment_method_id: 'pix',
        external_reference: body.external_reference, point_of_interaction: { transaction_data: { qr_code: '00020126PIX' + id, qr_base64: 'iVBORw0KGgo' + id } } };
      mp.payments.set(String(id), p); mp.created.push({ body, headers: req.headers });
      return send(201, p);
    }
    const m = /^\/v1\/payments\/(\w+)$/.exec(req.url);
    if (req.method === 'GET' && m) return mp.payments.has(m[1]) ? send(200, mp.payments.get(m[1])) : send(404, {});
    if (req.method === 'POST' && req.url.startsWith('/__set/')) { Object.assign(mp.payments.get(req.url.split('/')[2]), body); return send(200, {}); }
    send(404, {});
  });
  pushServer = http.createServer((req, res) => { pushHits.push(req.url); req.resume(); res.statusCode = 201; res.end(); });
  await Promise.all([new Promise((r) => mpServer.listen(MP_PORT, r)), new Promise((r) => pushServer.listen(PUSH_PORT, r))]);
});
after(() => { mpServer.close(); pushServer.close(); });

const setMp = (mpId, patch) => { Object.assign(mp.payments.get(String(mpId)), patch); };
const lastMpId = () => String(mp.seq);

async function webhook(mpId, { secret = SECRET, reqId = 'req-' + rnd(), badSig = false } = {}) {
  const ts = String(Date.now());
  const sig = badSig ? 'f'.repeat(64) : await signManifest(secret, manifest(String(mpId), reqId, ts));
  return fetch(`${API}/v1/webhooks/mercadopago?data.id=${mpId}&type=payment`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-signature': `ts=${ts},v1=${sig}`, 'x-request-id': reqId, ...ip() },
    body: JSON.stringify({ action: 'payment.updated', data: { id: String(mpId) }, type: 'payment' })
  });
}
const sql = (q) => {
  for (let i = 0; ; i++) {
    try {
      const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'rotininha', '--local', '--persist-to', STATE, '--json', '--command', q],
        { encoding: 'utf8', cwd: new URL('..', import.meta.url).pathname, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_UPDATE_NOTIFIER: '1' } });
      return JSON.parse(out.slice(out.indexOf('[')))[0].results;
    } catch (e) { if (i >= 3) throw e; } // a CLI do wrangler às vezes falha em chamadas de rede auxiliares
  }
};

async function buy(email = `mae${rnd()}@exemplo.com`) {
  const r = await json(await post('/v1/checkout', { plan: 'life', email, cpf: '529.982.247-25' }));
  assert.equal(r.status, 201, JSON.stringify(r));
  return { ...r, email, mpId: lastMpId() };
}
async function paid(email) {
  const c = await buy(email);
  setMp(c.mpId, { status: 'approved' });
  assert.equal((await webhook(c.mpId)).status, 200);
  const dev = 'dev' + rnd() + 'abcd';
  const claim = await json(await post('/v1/checkout/claim', { paymentId: c.paymentId, pollToken: c.pollToken, deviceId: dev }));
  assert.equal(claim.status, 200, JSON.stringify(claim));
  return { ...c, code: claim.code, session: claim.session, deviceId: dev };
}
const account = async (tok) => json(await post('/v1/billing/account', {}, tok));

// ---------------- testes ----------------

test('assinatura: manifesto, parse e verificação (unidade)', async () => {
  assert.equal(manifest('ABC123', 'rid', '1700'), 'id:abc123;request-id:rid;ts:1700;');
  assert.deepEqual(parseSignature('ts=1,v1=abc'), { ts: '1', v1: 'abc' });
  assert.equal(parseSignature('lixo'), null);
  const ts = '1700', sig = await signManifest('s', manifest('1', 'r', ts));
  assert.equal(await verifyMpSignature('s', `ts=${ts},v1=${sig}`, 'r', '1'), true);
  assert.equal(await verifyMpSignature('outro', `ts=${ts},v1=${sig}`, 'r', '1'), false);
  assert.equal(await verifyMpSignature('s', `ts=${ts},v1=${sig}`, 'r', '2'), false);
  assert.equal(await verifyMpSignature('s', null, 'r', '1'), false);
});

test('planos: preço único vitalício vem do servidor', async () => {
  const p = await (await fetch(API + '/v1/plans')).json();
  assert.deepEqual(p.entry.map((x) => [x.id, x.cents]), [['life', 3790]]);
  assert.deepEqual(p.renewal.map((x) => [x.id, x.cents]), [['life', 3790]]);
});

test('checkout: validações (plano de renovação na entrada, e-mail, CPF, valor do cliente ignorado)', async () => {
  const ok = { plan: 'life', email: `a${rnd()}@exemplo.com`, cpf: CPF };
  assert.equal((await post('/v1/checkout', { ...ok, plan: '30d' })).status, 400);
  assert.equal((await post('/v1/checkout', { ...ok, plan: 'grátis' })).status, 400);
  assert.equal((await post('/v1/checkout', { ...ok, email: 'sem-arroba' })).status, 422);
  assert.equal((await post('/v1/checkout', { ...ok, cpf: '11111111111' })).status, 422);
  assert.equal((await post('/v1/checkout', { ...ok, cpf: '52998224726' })).status, 422);
  const before = mp.created.length;
  const r = await post('/v1/checkout', { ...ok, amount: 0.01, transaction_amount: 0.01, cents: 1 });
  assert.equal(r.status, 201);
  assert.equal(mp.created.at(-1).body.transaction_amount, 37.9, 'valor do cliente é ignorado');
  assert.equal(mp.created.length, before + 1);
});

test('checkout: corpo enviado ao Mercado Pago (idempotência, referência, expiração, webhook URL)', async () => {
  const c = await buy();
  const { body, headers } = mp.created.at(-1);
  assert.equal(headers['x-idempotency-key'], c.paymentId);
  assert.equal(body.external_reference, c.paymentId);
  assert.equal(body.payment_method_id, 'pix');
  assert.equal(body.payer.identification.type, 'CPF');
  assert.equal(body.payer.identification.number, CPF);
  assert.equal(body.notification_url, 'http://localhost:8787/v1/webhooks/mercadopago');
  assert.match(body.date_of_expiration, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000-03:00$/);
  assert.equal(c.amountCents, 3790);
  assert.match(c.qrCode, /^00020126PIX/);
});

test('privacidade: CPF não é gravado no banco', async () => {
  const c = await buy();
  const rows = JSON.stringify(sql(`SELECT * FROM payments WHERE id='${c.paymentId}'`));
  assert.ok(!rows.includes(CPF) && !rows.includes('529.982'), 'CPF não deve aparecer');
});

test('provedor fora do ar → 502, sem acesso liberado', async () => {
  mp.failCreate = true;
  const r = await post('/v1/checkout', { plan: 'life', email: `f${rnd()}@exemplo.com`, cpf: CPF });
  mp.failCreate = false;
  assert.equal(r.status, 502);
});

test('webhook: sem assinatura ou com assinatura errada → 401', async () => {
  const c = await buy(); setMp(c.mpId, { status: 'approved' });
  assert.equal((await webhook(c.mpId, { badSig: true })).status, 401);
  assert.equal((await webhook(c.mpId, { secret: 'segredo-errado' })).status, 401);
  const noHeaders = await fetch(`${API}/v1/webhooks/mercadopago?data.id=${c.mpId}&type=payment`, { method: 'POST', body: '{}', headers: ip() });
  assert.equal(noHeaders.status, 401);
  const st = await json(await post('/v1/checkout/status', { paymentId: c.paymentId, pollToken: 'x'.repeat(43) }));
  assert.equal(st.status, 404, 'token de acompanhamento errado');
});

test('webhook com pagamento ainda pendente não libera nada', async () => {
  const c = await buy();
  assert.equal((await webhook(c.mpId)).status, 200);
  const st = await json(await post('/v1/checkout/status', { paymentId: c.paymentId, pollToken: c.pollToken }));
  assert.equal(st.status, 'pending'); assert.equal(st.canClaim, false);
  assert.match(st.qrCode, /^00020126PIX/);
});

test('pagamento aprovado: libera uma vez, entrega o código uma vez e abre sessão', async () => {
  const email = `ok${rnd()}@exemplo.com`;
  const p = await paid(email);
  assert.match(p.code, /^[2-9A-Z]{5}(-[2-9A-Z]{5}){3}$/);
  const acc = await account(p.session.accessToken);
  assert.equal(acc.state, 'active');
  assert.ok(acc.validUntil > Date.now() + 3650 * DAY, 'vitalício');
  assert.equal(acc.graceUntil - acc.validUntil, 24 * 3600_000, 'carência de 24 h');
  // segunda tentativa de entrega (outra aba/aparelho)
  const again = await post('/v1/checkout/claim', { paymentId: p.paymentId, pollToken: p.pollToken, deviceId: 'dev' + rnd() + 'zzzz' });
  assert.equal(again.status, 410);
  // o código funciona no login normal
  const login = await post('/v1/sessions', { code: p.code, deviceId: 'dev' + rnd() + 'login' });
  assert.equal(login.status, 201);
  // status final não expõe QR nem permite nova entrega
  const st = await json(await post('/v1/checkout/status', { paymentId: p.paymentId, pollToken: p.pollToken }));
  assert.equal(st.status, 'approved'); assert.equal(st.canClaim, false); assert.equal(st.qrCode, null);
});

test('comprovante por e-mail: valor, validade, arrependimento — e SEM o código de acesso', async () => {
  const email = `rc${rnd()}@exemplo.com`;
  const p = await paid(email);
  const out = await (await fetch(`${API}/v1/dev/outbox?to=${encodeURIComponent(email)}`)).json();
  assert.equal(out.messages.length, 1);
  const m = out.messages[0];
  assert.match(m.body, /R\$ 37,90/); assert.match(m.body, /vitalício/); assert.match(m.body, /arrependimento/i);
  assert.match(m.body, /Não é assinatura/); assert.ok(m.body.includes(p.paymentId));
  assert.ok(!m.body.includes(p.code), 'o código não vai por e-mail');
});

test('webhooks duplicados e simultâneos: um único acesso, validade não duplica, um comprovante', async () => {
  const email = `dup${rnd()}@exemplo.com`;
  const c = await buy(email); setMp(c.mpId, { status: 'approved' });
  const rs = await Promise.all(Array.from({ length: 6 }, () => webhook(c.mpId)));
  assert.ok(rs.every((r) => r.status === 200));
  await webhook(c.mpId); await webhook(c.mpId);
  const claim = await json(await post('/v1/checkout/claim', { paymentId: c.paymentId, pollToken: c.pollToken, deviceId: 'dev' + rnd() + 'abcd' }));
  assert.equal(claim.status, 200);
  const acc = await account(claim.session.accessToken);
  assert.ok(acc.validUntil > Date.now() + 3650 * DAY && acc.validUntil < Date.now() + 36_600 * DAY, 'não somou períodos (um único vitalício)');
  const hh = sql(`SELECT COUNT(DISTINCT household_id) AS n, COUNT(*) AS rows FROM payments WHERE email='${email}' AND applied_at IS NOT NULL`);
  assert.equal(hh[0].n, 1); assert.equal(hh[0].rows, 1);
  const out = await (await fetch(`${API}/v1/dev/outbox?to=${encodeURIComponent(email)}`)).json();
  assert.equal(out.messages.length, 1, 'um comprovante apenas');
});

test('valor divergente no Mercado Pago → "mismatch", sem acesso', async () => {
  const c = await buy(); setMp(c.mpId, { status: 'approved', transaction_amount: 1 });
  assert.equal((await webhook(c.mpId)).status, 200);
  const st = await json(await post('/v1/checkout/status', { paymentId: c.paymentId, pollToken: c.pollToken }));
  assert.equal(st.status, 'mismatch'); assert.equal(st.canClaim, false);
});

test('pagamento de outro produto (external_reference desconhecida) é ignorado', async () => {
  const id = String(++mp.seq);
  mp.payments.set(id, { id, status: 'approved', transaction_amount: 37.9, currency_id: 'BRL', payment_method_id: 'pix', external_reference: 'outro-sistema' });
  const r = await json(await webhook(id));
  assert.equal(r.status, 200); assert.equal(r.result, 'unknown');
});

test('webhook perdido: a consulta de status concilia direto com o Mercado Pago', async () => {
  const c = await buy(); setMp(c.mpId, { status: 'approved' }); // nenhum webhook enviado
  let st;
  for (let i = 0; i < 3 && !st?.canClaim; i++) { st = await json(await post('/v1/checkout/status', { paymentId: c.paymentId, pollToken: c.pollToken })); }
  assert.equal(st.status, 'approved'); assert.equal(st.canClaim, true);
});

test('Pix rejeitado/cancelado vira "failed"', async () => {
  const c = await buy(); setMp(c.mpId, { status: 'cancelled' });
  await webhook(c.mpId);
  const st = await json(await post('/v1/checkout/status', { paymentId: c.paymentId, pollToken: c.pollToken }));
  assert.equal(st.status, 'failed'); assert.equal(st.canClaim, false);
});

test('teste grátis → compra do vitalício (uma vez, mesmo com webhook duplicado); vencido também compra', async () => {
  const p = await paid(`rn${rnd()}@exemplo.com`);
  const tok = p.session.accessToken;
  const hid = `(SELECT household_id FROM payments WHERE id='${p.paymentId}')`;
  sql(`UPDATE households SET plan='trial', valid_until=${Date.now() + DAY}, grace_until=${Date.now() + 2 * DAY} WHERE id=${hid}`);
  assert.equal((await account(tok)).state, 'trial');
  const r = await json(await post('/v1/billing/renew', { plan: 'life', cpf: CPF }, tok));
  assert.equal(r.status, 201); assert.equal(r.amountCents, 3790);
  assert.equal(mp.created.at(-1).body.transaction_amount, 37.9);
  const mpId = lastMpId(); setMp(mpId, { status: 'approved' });
  await webhook(mpId); await webhook(mpId); // duplicado
  const after = await account(tok);
  assert.equal(after.plan, 'paid'); assert.equal(after.state, 'active');
  assert.ok(after.validUntil > Date.now() + 3650 * DAY, 'vitalício');
  const once = after.validUntil;
  assert.equal((await post('/v1/billing/renew', { plan: 'life', cpf: CPF }, tok)).status, 409, 'já vitalício: não cobra de novo');
  assert.equal((await account(tok)).validUntil, once);

  // teste vencido há 3 dias → compra a partir de HOJE
  sql(`UPDATE households SET plan='trial', valid_until=${Date.now() - 3 * DAY}, grace_until=${Date.now() - 2 * DAY} WHERE id=${hid}`);
  assert.equal((await account(tok)).state, 'expired');
  const r2 = await json(await post('/v1/billing/renew', { plan: 'life', cpf: CPF }, tok));
  const id2 = lastMpId(); setMp(id2, { status: 'approved' }); await webhook(id2);
  const a2 = await account(tok);
  assert.equal(a2.state, 'active');
  assert.ok(a2.validUntil > Date.now() + 3650 * DAY);
  assert.ok(r2.paymentId);
});

test('renovação exige login e valida plano/CPF', async () => {
  assert.equal((await post('/v1/billing/renew', { plan: 'life', cpf: CPF })).status, 401);
  const p = await paid(`rv${rnd()}@exemplo.com`);
  assert.equal((await post('/v1/billing/renew', { plan: 'x', cpf: CPF }, p.session.accessToken)).status, 400);
  assert.equal((await post('/v1/billing/renew', { plan: 'life', cpf: '123' }, p.session.accessToken)).status, 422);
});

test('vencido além da carência: leitura continua, escrita é bloqueada e push para', async () => {
  const p = await paid(`ex${rnd()}@exemplo.com`);
  const tok = p.session.accessToken;
  // inscrição de push + um lembrete diário
  const sub = await post('/v1/push/subscribe', { endpoint: `http://localhost:${PUSH_PORT}/x/${rnd()}`, keys: { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' } }, tok);
  assert.equal(sub.status, 201);
  const now = Date.now();
  const task = { kind: 'task', id: 'tk' + rnd() + 'abcd', title: 'Banho', category: 'banho', time: '12:00', repeat: 'daily', days: [], leadMin: 0, notify: true, allowQuiet: false, updatedAt: now, deleted: false };
  assert.equal((await post('/v1/sync', { cursor: 0, changes: [task] }, tok)).status, 200);
  sql(`UPDATE households SET valid_until=${now - 3 * DAY}, grace_until=${now - 2 * DAY} WHERE id=(SELECT household_id FROM payments WHERE id='${p.paymentId}')`);
  assert.equal((await account(tok)).state, 'expired');
  assert.equal((await post('/v1/sync', { cursor: 0, changes: [] }, tok)).status, 200, 'leitura continua');
  assert.equal((await post('/v1/sync', { cursor: 0, changes: [{ ...task, id: 'tk' + rnd() + 'zzzz' }] }, tok)).status, 403, 'escrita bloqueada');
  const hits = pushHits.length;
  const fire = Number(sql(`SELECT next_fire_at AS t FROM records WHERE id='${task.id}'`)[0].t);
  const tick = await json(await post('/v1/dev/tick', { now: fire + 5000 }));
  assert.equal(pushHits.length, hits, 'nenhum push após a carência');
  assert.ok(tick.skipped.expired >= 1, JSON.stringify(tick));
});

test('reembolso no Mercado Pago retira o período e o acesso expira sem apagar dados', async () => {
  const p = await paid(`rf${rnd()}@exemplo.com`);
  const tok = p.session.accessToken;
  assert.equal((await account(tok)).state, 'active');
  setMp(p.mpId, { status: 'refunded' });
  await webhook(p.mpId); await webhook(p.mpId); // duplicado não retira duas vezes
  const acc = await account(tok);
  assert.equal(acc.state, 'expired');
  assert.ok(acc.validUntil <= Date.now() + 60_000 && acc.validUntil >= Date.now() - 60_000, 'volta ao instante da compra');
  assert.equal(acc.graceUntil, acc.validUntil, 'sem carência após reembolso');
  assert.equal((await post('/v1/sync', { cursor: 0, changes: [] }, tok)).status, 200, 'dados continuam legíveis');
});

test('reembolso de entrega ainda não retirada: código nunca é entregue', async () => {
  const c = await buy(); setMp(c.mpId, { status: 'approved' }); await webhook(c.mpId);
  setMp(c.mpId, { status: 'refunded' }); await webhook(c.mpId);
  const claim = await post('/v1/checkout/claim', { paymentId: c.paymentId, pollToken: c.pollToken, deviceId: 'dev' + rnd() + 'abcd' });
  assert.ok([409, 410].includes(claim.status), 'status ' + claim.status);
});

test('recuperação: resposta idêntica para e-mail existente ou não; link único; gira o código; derruba sessões antigas', async () => {
  const email = `rec${rnd()}@exemplo.com`;
  const p = await paid(email);
  const ghost = `nao${rnd()}@exemplo.com`;
  const a = await json(await post('/v1/recovery/request', { email }));
  const b = await json(await post('/v1/recovery/request', { email: ghost }));
  assert.deepEqual(a, b); assert.equal(a.status, 200);
  assert.equal((await (await fetch(`${API}/v1/dev/outbox?to=${encodeURIComponent(ghost)}`)).json()).messages.length, 0);
  const mails = (await (await fetch(`${API}/v1/dev/outbox?to=${encodeURIComponent(email)}`)).json()).messages;
  const rec = mails.find((m) => m.subject.includes('recuperar'));
  const token = /#recover=([\w-]+)/.exec(rec.body)[1];
  assert.ok(!/\?.*recover/.test(rec.body), 'token no fragmento, não na query');
  const dev = 'dev' + rnd() + 'new1';
  const ok = await json(await post('/v1/recovery/confirm', { token, deviceId: dev }));
  assert.equal(ok.status, 200);
  assert.notEqual(ok.code, p.code);
  assert.equal((await post('/v1/sessions', { code: p.code, deviceId: 'dev' + rnd() + 'old1' })).status, 401, 'código antigo morreu');
  assert.equal((await post('/v1/sessions', { code: ok.code, deviceId: 'dev' + rnd() + 'new2' })).status, 201);
  assert.equal((await post('/v1/sync', { cursor: 0, changes: [] }, p.session.accessToken)).status, 401, 'sessão antiga revogada');
  assert.equal((await post('/v1/sync', { cursor: 0, changes: [] }, ok.session.accessToken)).status, 200);
  assert.equal((await post('/v1/recovery/confirm', { token, deviceId: dev })).status, 410, 'link de uso único');
  assert.equal((await post('/v1/recovery/confirm', { token: 'x'.repeat(40), deviceId: dev })).status, 410);
});

test('recuperação: link expirado não funciona', async () => {
  const email = `rx${rnd()}@exemplo.com`; await paid(email);
  await post('/v1/recovery/request', { email });
  const mails = (await (await fetch(`${API}/v1/dev/outbox?to=${encodeURIComponent(email)}`)).json()).messages;
  const token = /#recover=([\w-]+)/.exec(mails.find((m) => m.subject.includes('recuperar')).body)[1];
  sql(`UPDATE recovery_tokens SET expires_at=${Date.now() - 1000} WHERE used_at IS NULL AND household_id=(SELECT household_id FROM payments WHERE email='${email}' LIMIT 1)`);
  assert.equal((await post('/v1/recovery/confirm', { token, deviceId: 'dev' + rnd() + 'abcd' })).status, 410);
});

test('limites: checkout por e-mail e recuperação por e-mail', async () => {
  const email = `lim${rnd()}@exemplo.com`;
  let last;
  for (let i = 0; i < 6; i++) last = await post('/v1/checkout', { plan: 'life', email, cpf: CPF });
  assert.equal(last.status, 429);
  let lr;
  for (let i = 0; i < 4; i++) lr = await post('/v1/recovery/request', { email: `r${rnd()}@x.com` }); // outros e-mails passam
  assert.equal(lr.status, 200);
  const same = `same${rnd()}@exemplo.com`; let ls;
  for (let i = 0; i < 4; i++) ls = await post('/v1/recovery/request', { email: same });
  assert.equal(ls.status, 429);
});
