// Integração: Worker (wrangler dev, ALLOW_DEV_SIGNUP=true) → "serviço de push" falso local.
// O teste decifra com node:crypto (implementação independente da do Worker).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createECDH, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { nextFire, zonedToEpoch, occId } from '../../../packages/shared/schedule.js';

const API = process.env.API_URL ?? 'http://localhost:8787';
const TZ = 'America/Sao_Paulo';
const PORT = 19876;
const b64u = (b) => Buffer.from(b).toString('base64url');
const post = (path, body, token, extra = {}) =>
  fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, body: JSON.stringify(body) });
const rnd = () => 'dev' + randomBytes(6).toString('hex');

// ---- serviço de push falso ----
const received = []; // { path, headers, body: Buffer }
let server;
before(async () => {
  server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      received.push({ path: req.url, headers: req.headers, body: Buffer.concat(chunks) });
      res.statusCode = req.url.startsWith('/gone') ? 410 : 201;
      res.end();
    });
  });
  await new Promise((r) => server.listen(PORT, r));
});
after(() => server.close());

function decrypt(body, uaEcdh, auth) {
  const salt = body.subarray(0, 16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  const ecdh = uaEcdh.computeSecret(asPub);
  const uaPub = uaEcdh.getPublicKey();
  const ikm = Buffer.from(hkdfSync('sha256', ecdh, auth, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]), 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  assert.equal(pt[pt.length - 1], 2, 'delimitador de último registro');
  return JSON.parse(pt.subarray(0, pt.length - 1).toString());
}

async function family({ path = 'ok', privacy = false } = {}) {
  const { code } = await (await post('/v1/dev/households', {})).json();
  const sess = await (await post('/v1/sessions', { code, deviceId: rnd() }, null, { 'CF-Connecting-IP': '10.1.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250) })).json();
  const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
  const auth = randomBytes(16);
  const endpoint = `http://localhost:${PORT}/${path}/${rnd()}`;
  const r = await post('/v1/push/subscribe', { endpoint, keys: { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(auth) }, privacy }, sess.accessToken);
  assert.equal(r.status, 201);
  const fam = { token: sess.accessToken, ecdh, auth, endpoint, path: new URL(endpoint).pathname };
  fam.sync = (changes) => post('/v1/sync', { cursor: 0, changes }, fam.token);
  fam.pushes = () => received.filter((x) => x.path === fam.path).map((x) => ({ ...x, msg: decrypt(x.body, ecdh, auth) }));
  return fam;
}

const now0 = Date.now();
const task = (over = {}) => ({ kind: 'task', id: rnd(), title: '🛁 Hora do banho', category: 'banho', time: '18:30', repeat: 'daily', days: [], leadMin: 0, notify: true, allowQuiet: false, updatedAt: now0, deleted: false, ...over });
const tick = async (now) => (await post('/v1/dev/tick', { now })).json();
const fireOf = (t) => nextFire(t, Date.now(), TZ);

test('endpoint fora da lista de serviços de push é recusado (SSRF)', async () => {
  const f = await family();
  for (const ep of ['https://evil.example.com/x', 'http://169.254.169.254/latest', 'https://fcm.googleapis.com.evil.com/x']) {
    const r = await post('/v1/push/subscribe', { endpoint: ep, keys: { p256dh: 'a', auth: 'b' } }, f.token);
    assert.equal(r.status, 422, ep);
  }
});

test('lembrete diário dispara uma vez, cifrado, com VAPID válido', async () => {
  const f = await family(); const t = task();
  assert.equal((await f.sync([t])).status, 200);
  const fire = fireOf(t).fireAt;
  await tick(fire + 5000);
  const p = f.pushes();
  assert.equal(p.length, 1);
  assert.equal(p[0].msg.title, t.title);
  assert.equal(p[0].msg.occId, occId(t.id, fireOf(t).date));
  assert.match(p[0].headers.authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
  assert.equal(p[0].headers['content-encoding'], 'aes128gcm');
  await tick(fire + 6000); await tick(fire + 5000); // reprocessar não reenvia
  assert.equal(f.pushes().length, 1);
});

test('"Feito" antes do horário cancela o alerta', async () => {
  const f = await family(); const t = task();
  const { fireAt, date } = fireOf(t);
  await f.sync([t, { kind: 'occ', id: occId(t.id, date), taskId: t.id, date, status: 'done', snoozeUntil: null, updatedAt: now0, deleted: false }]);
  const r = await tick(fireAt + 5000);
  assert.equal(f.pushes().length, 0);
  assert.ok(r.skipped.already_handled >= 1);
});

test('adiar: não toca no horário original; toca no fim do adiamento; concluir depois cancela', async () => {
  const f = await family(); const t = task();
  const { fireAt, date } = fireOf(t);
  const until = fireAt + 15 * 60000;
  const oid = occId(t.id, date);
  await f.sync([t, { kind: 'occ', id: oid, taskId: t.id, date, status: 'snoozed', snoozeUntil: until, updatedAt: now0, deleted: false }]);
  await tick(fireAt + 5000);
  assert.equal(f.pushes().length, 0, 'horário original suprimido');
  await tick(until + 5000);
  assert.equal(f.pushes().length, 1);
  assert.equal(f.pushes()[0].msg.body, 'Lembrete adiado');

  // adiar de novo e concluir antes do fim → nada toca
  const t2 = task(); const d2 = fireOf(t2); const until2 = d2.fireAt + 30 * 60000;
  await f.sync([t2, { kind: 'occ', id: occId(t2.id, d2.date), taskId: t2.id, date: d2.date, status: 'snoozed', snoozeUntil: until2, updatedAt: now0, deleted: false }]);
  await f.sync([{ kind: 'occ', id: occId(t2.id, d2.date), taskId: t2.id, date: d2.date, status: 'done', snoozeUntil: null, updatedAt: now0 + 1000, deleted: false }]);
  await tick(until2 + 5000);
  assert.equal(f.pushes().filter((x) => x.msg.occId === occId(t2.id, d2.date)).length, 0);
});

test('silêncio 22h–6h: bloqueia, exceto com confirmação explícita (allowQuiet)', async () => {
  const f = await family();
  const quiet = task({ time: '23:00' }), allowed = task({ time: '23:00', allowQuiet: true, title: 'Permitido' });
  await f.sync([quiet, allowed]);
  const fire = fireOf(quiet).fireAt;
  const r = await tick(fire + 5000);
  const titles = f.pushes().map((x) => x.msg.title);
  assert.deepEqual(titles, ['Permitido']);
  assert.ok(r.skipped.quiet_hours >= 1);
});

test('remédio e modo privacidade: texto genérico, sem título', async () => {
  const f = await family(); const g = await family({ privacy: true });
  const med = task({ category: 'remedio', title: 'Dipirona 10 gotas' });
  const bath = task({ title: 'Banho secreto' });
  await f.sync([med]); await g.sync([bath]);
  await tick(fireOf(med).fireAt + 5000);
  const a = f.pushes()[0].msg, b = g.pushes()[0].msg;
  assert.equal(a.body, 'Você tem um lembrete no Ninhora'); assert.ok(!JSON.stringify(a).includes('Dipirona'));
  assert.equal(b.body, 'Você tem um lembrete no Ninhora'); assert.ok(!JSON.stringify(b).includes('secreto'));
});

test('lembrete muito atrasado (Cron parado) não é enviado', async () => {
  const f = await family(); const t = task(); await f.sync([t]);
  const r = await tick(fireOf(t).fireAt + 31 * 60000);
  assert.equal(f.pushes().length, 0);
  assert.ok(r.skipped.stale >= 1);
});

test('notify=false e exclusão: nada é enviado', async () => {
  const f = await family(); const a = task({ notify: false }), b = task();
  await f.sync([a, b]); await f.sync([{ ...b, deleted: true, updatedAt: now0 + 1000 }]);
  await tick(fireOf(b).fireAt + 5000);
  assert.equal(f.pushes().length, 0);
});

test('serviço de push responde 410 → inscrição é removida', async () => {
  const f = await family({ path: 'gone' }); const t = task(); await f.sync([t]);
  await tick(fireOf(t).fireAt + 5000);
  assert.equal(f.pushes().length, 1);
  const r = await post('/v1/push/test', {}, f.token);
  assert.equal((await r.json()).sent, 0, 'inscrição já foi descartada');
  await post('/v1/dev/tick', { now: Date.now() });
});

test('notificação de teste chega cifrada', async () => {
  const f = await family();
  const r = await (await post('/v1/push/test', {}, f.token)).json();
  assert.equal(r.sent, 1);
  assert.match(f.pushes()[0].msg.body, /Tudo certo/);
});

test('troca de fuso reagenda os lembretes', async () => {
  // Horário entre 10h e 18h em SP: em SP e em Nova York (2 h antes) fica fora do silêncio (22h–6h), e o disparo de NY vem 2 h depois do de SP,
  // qualquer que seja a hora em que o teste rode.
  const hourSP = (ms) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(ms));
  let hh = '10';
  for (let k = 1; k <= 24; k++) { const h = hourSP(Date.now() + k * 3_600_000); if (h >= 10 && h <= 18) { hh = String(h).padStart(2, '0'); break; } }
  const f = await family(); const t = task({ time: `${hh}:00` }); await f.sync([t]);
  const spFire = fireOf(t).fireAt;
  assert.equal((await post('/v1/settings', { timezone: 'America/New_York' }, f.token)).status, 200);
  assert.equal((await post('/v1/settings', { timezone: 'Marte/Olympus' }, f.token)).status, 400);
  await tick(spFire + 5000);
  assert.equal(f.pushes().length, 0, 'horário antigo (SP) não dispara mais');
  const ny = nextFire(t, Date.now(), 'America/New_York').fireAt;
  await tick(ny + 5000);
  assert.equal(f.pushes().length, 1);
});

test('registros inválidos de lembrete/ocorrência são rejeitados', async () => {
  const f = await family();
  const bads = [task({ time: '25:00' }), task({ category: 'x' }), task({ repeat: 'weekly', days: [] }), task({ title: '' }), task({ leadMin: 999 }),
    { kind: 'occ', id: 'errado123', taskId: 'abcdefgh', date: '2026-11-01', status: 'done', updatedAt: now0 }];
  for (const b of bads) assert.equal((await f.sync([b])).status, 422);
});
