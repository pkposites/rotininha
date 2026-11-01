// Teste grátis, uso, notificações promocionais (campanhas + automações) e análises. Serviço de push SIMULADO (decifra com node:crypto).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createECDH, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { zonedToEpoch } from '../../../packages/shared/schedule.js';
import { LEAPS } from '../../../packages/shared/leaps.js';

const _fetch = globalThis.fetch;
globalThis.fetch = async (...a) => { try { return await _fetch(...a); } catch { return _fetch(...a); } };

const API = process.env.API_URL ?? 'http://localhost:8787';
const STATE = process.env.D1_STATE ?? '/tmp/claude-0/d1state';
const ADMIN = 'admin-token-local-de-teste-1234567890';
const TZ = 'America/Sao_Paulo', PORT = 19880, DAY = 86_400_000, H = 3_600_000;
const rnd = () => randomBytes(5).toString('hex');
const ipH = () => ({ 'CF-Connecting-IP': `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
const b64u = (b) => Buffer.from(b).toString('base64url');
const post = (path, body, token, extra = {}) => fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...ipH(), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, body: JSON.stringify(body) });
const json = async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) });
const adm = (path, body, method) => fetch(API + path, { method: method ?? (body === undefined ? 'GET' : 'POST'), headers: { Authorization: `Bearer ${ADMIN}`, 'Content-Type': 'application/json', ...ipH() }, body: body === undefined ? undefined : JSON.stringify(body) }).then(json);
const sql = (q) => {
  for (let i = 0; ; i++) {
    try {
      const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'rotininha', '--local', '--persist-to', STATE, '--json', '--command', q],
        { encoding: 'utf8', cwd: new URL('..', import.meta.url).pathname, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_UPDATE_NOTIFIER: '1' } });
      return JSON.parse(out.slice(out.indexOf('[')))[0].results;
    } catch (e) { if (i >= 3) throw e; }
  }
};
const tick = async (now) => json(await post('/v1/dev/tick', { now }));

// "amanhã às 14:00" em São Paulo: fora do silêncio e sempre no futuro
const daytime = (plusDays = 1, hour = 14) => { const d = new Date(Date.now() + plusDays * DAY); return zonedToEpoch(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), hour, 0, TZ); };

// ---- serviço de push simulado ----
const received = []; let server;
const KEYS = ['welcome', 'first_care', 'first_reminder', 'sounds_tip', 'leap_coming', 'trial_ends_tomorrow', 'trial_last_day', 'trial_ended', 'inactive_3d'];
const allOff = async () => { for (const key of KEYS) await adm('/v1/admin/automations', { key, enabled: false }); };
before(async () => {
  await allOff();   // estado limpo: nada ligado de execuções anteriores
  server = http.createServer((req, res) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => { received.push({ path: req.url, body: Buffer.concat(c) }); res.statusCode = 201; res.end(); }); });
  await new Promise((r) => server.listen(PORT, r));
});
after(async () => { await allOff(); server.close(); });

function decrypt(body, ecdh, auth) {
  const salt = body.subarray(0, 16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  const ikm = Buffer.from(hkdfSync('sha256', ecdh.computeSecret(asPub), auth, Buffer.concat([Buffer.from('WebPush: info\0'), ecdh.getPublicKey(), asPub]), 32));
  const d = createDecipheriv('aes-128-gcm', Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16)), Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12)));
  d.setAuthTag(ct.subarray(ct.length - 16));
  const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  return JSON.parse(pt.subarray(0, pt.length - 1).toString());
}

/** Cria uma família (teste grátis ou dev), opcionalmente com notificações ativadas neste "aparelho" simulado. */
async function household({ trial = false, push = true, email } = {}) {
  let tok, code, trialInfo;
  const dev = 'dev' + rnd() + 'abcd';
  if (trial) { const r = await json(await post('/v1/trial/start', { deviceId: dev, ...(email ? { email } : {}) })); assert.equal(r.status, 201, JSON.stringify(r)); tok = r.session.accessToken; code = r.code; trialInfo = r; }
  else { code = (await (await post('/v1/dev/households', {})).json()).code; tok = (await (await post('/v1/sessions', { code, deviceId: dev })).json()).accessToken; }
  const id = sql(`SELECT household_id AS id FROM sessions WHERE device_id = '${dev}' LIMIT 1`)[0].id;
  const f = { tok, code, id, trialInfo, deviceId: dev, ecdh: null, pushes: () => [] };
  if (push) {
    const ecdh = createECDH('prime256v1'); ecdh.generateKeys(); const auth = randomBytes(16);
    const path = `/${rnd()}`;
    const r = await post('/v1/push/subscribe', { endpoint: `http://localhost:${PORT}${path}`, keys: { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(auth) } }, tok);
    assert.equal(r.status, 201);
    f.pushes = () => received.filter((x) => x.path === path).map((x) => decrypt(x.body, ecdh, auth));
  }
  return f;
}
const set = (id, cols) => sql(`UPDATE households SET ${Object.entries(cols).map(([k, v]) => `${k} = ${v === null ? 'NULL' : typeof v === 'number' ? v : `'${v}'`}`).join(', ')} WHERE id = '${id}'`);
const newCampaign = async (code, over = {}) => adm('/v1/admin/campaigns', { name: 'Teste ' + rnd(), title: 'Olá 💜', body: 'Novidade no Ninhora', target: 'sons', audience: { segment: 'codes', codes: [].concat(code) }, ...over });

test('só o administrador acessa o painel de crescimento', async () => {
  for (const [m, p] of [['GET', '/v1/admin/overview'], ['GET', '/v1/admin/campaigns'], ['GET', '/v1/admin/automations'], ['GET', '/v1/admin/settings'], ['POST', '/v1/admin/campaigns']]) {
    const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', ...ipH() }, body: m === 'POST' ? '{}' : undefined });
    assert.equal(r.status, 401, p);
  }
});

test('teste grátis: cria a conta, devolve o código uma vez e libera o uso; limites por aparelho', async () => {
  const f = await household({ trial: true, push: false, email: `T${rnd()}@Exemplo.com` });
  assert.match(f.code, /^[2-9A-Z]{5}(-[2-9A-Z]{5}){3}$/);
  assert.equal(f.trialInfo.trialDays, 3); assert.ok(Math.abs(f.trialInfo.trialEndsAt - (Date.now() + 3 * DAY)) < 60_000);
  assert.equal(f.trialInfo.enforced, false, 'pré-lançamento: ninguém é cobrado');
  const acc = await json(await post('/v1/billing/account', {}, f.tok));
  assert.equal(acc.plan, 'trial'); assert.equal(acc.state, 'active'); assert.equal(acc.enforcement.active, false); assert.equal(acc.validUntil, null);
  assert.equal(acc.prefs.hasEmail, true); assert.equal(acc.prefs.tips, true);
  assert.equal((await post('/v1/sessions', { code: f.code, deviceId: 'dev' + rnd() + 'zzzz' })).status, 201, 'o código serve em outro aparelho');
  const dev = 'dev' + rnd() + 'once';
  assert.equal((await post('/v1/trial/start', { deviceId: dev })).status, 201);
  assert.equal((await post('/v1/trial/start', { deviceId: dev })).status, 201);
  assert.equal((await post('/v1/trial/start', { deviceId: dev })).status, 429, 'o mesmo aparelho não cria teste sem fim');
  assert.equal((await post('/v1/trial/start', { deviceId: 'x' })).status, 400);
});

test('cobrança do teste: exige aviso prévio, respeita quem já está no teste e depois bloqueia a edição', async () => {
  const c0 = await adm('/v1/admin/settings');
  assert.equal(c0.trialDays, 3); assert.equal(c0.active, false);
  const soon = await adm('/v1/admin/settings', { enforceFrom: Date.now() + 1 * DAY });
  assert.equal(soon.status, 422); assert.equal(soon.error, 'notice_required'); assert.ok(soon.minFrom > Date.now() + 6 * DAY, 'mínimo de 7 dias de aviso');
  const old = await household({ trial: true, push: false });                 // já estava no teste quando a cobrança foi anunciada
  const ann = await adm('/v1/admin/settings', { enforceFrom: Date.now() + 8 * DAY });
  assert.equal(ann.status, 200);
  const a1 = await json(await post('/v1/billing/account', {}, old.tok));
  assert.equal(a1.state, 'active'); assert.equal(a1.enforcement.announced, false, '8 dias antes: ainda fora da janela de aviso (7)');
  assert.ok(a1.enforcement.from > Date.now());
  await adm('/v1/admin/settings', { enforceFrom: Date.now() + 5 * DAY, devSkipNotice: true });          // dentro da janela → "announced"
  assert.equal((await json(await post('/v1/billing/account', {}, old.tok))).enforcement.announced, true);

  // cobrança já em vigor
  const from = Date.now() - 1000;
  const on = await adm('/v1/admin/settings', { enforceFrom: from, devSkipNotice: true });
  assert.equal(on.status, 200); assert.ok(on.applied >= 1, 'o teste de quem já estava dentro é estendido por 3 dias a partir do início da cobrança');
  const a2 = await json(await post('/v1/billing/account', {}, old.tok));
  assert.equal(a2.state, 'trial'); assert.ok(a2.validUntil >= from + 3 * DAY - 1000, 'ganha ao menos 3 dias depois da data de início');
  const fresh = await household({ trial: true, push: false });
  assert.equal(fresh.trialInfo.enforced, true);
  assert.equal((await json(await post('/v1/billing/account', {}, fresh.tok))).state, 'trial');
  assert.equal((await adm('/v1/admin/settings', { enforceFrom: null })).status, 409, 'cobrança em vigor não é "desfeita"');
  // acabou o teste: carência (leitura e escrita) e depois bloqueio de escrita
  set(fresh.id, { valid_until: Date.now() - 1000, grace_until: Date.now() + H });
  assert.equal((await json(await post('/v1/billing/account', {}, fresh.tok))).state, 'grace');
  set(fresh.id, { valid_until: Date.now() - 3 * DAY, grace_until: Date.now() - 2 * DAY });
  assert.equal((await json(await post('/v1/billing/account', {}, fresh.tok))).state, 'expired');
  const ev = { kind: 'event', id: 'ev' + rnd() + 'abcd', type: 'mamada', startedAt: Date.now() - 1000, endedAt: null, note: '', detail: '', updatedAt: Date.now(), deleted: false };
  assert.equal((await post('/v1/sync', { cursor: 0, changes: [ev] }, fresh.tok)).status, 403, 'vencido: não grava');
  assert.equal((await post('/v1/sync', { cursor: 0, changes: [] }, fresh.tok)).status, 200, 'mas ainda lê');
  sql(`DELETE FROM settings WHERE key IN ('trial_enforce_from','trial_days','notice_days')`);   // limpa para os outros testes
  sql(`UPDATE households SET valid_until = NULL, grace_until = NULL WHERE plan = 'trial'`);
});

test('uso do app: contagens por dia, só eventos permitidos, sem conteúdo; sair apaga o histórico', async () => {
  const f = await household({ push: false });
  assert.equal((await post('/v1/usage', { events: [] })).status, 401);
  assert.equal((await post('/v1/usage', { events: [{ event: 'app_open', n: 1 }, { event: 'care_logged', n: 2 }, { event: 'conteudo_do_bebe', n: 9 }, { event: 'sound_played', n: -1 }] }, f.tok)).status, 200);
  await post('/v1/usage', { events: [{ event: 'app_open', n: 2 }] }, f.tok);
  const hid = sql(`SELECT hid FROM households WHERE id='${f.id}'`)[0].hid;
  assert.match(hid, /^[0-9a-f]{20}$/);
  const rows = Object.fromEntries(sql(`SELECT event, n FROM usage_daily WHERE hid='${hid}'`).map((r) => [r.event, Number(r.n)]));
  assert.deepEqual(rows, { app_open: 3, care_logged: 2 }, 'soma, ignora evento desconhecido e n inválido');
  assert.equal(Number(sql(`SELECT COUNT(*) AS n FROM households WHERE first_care_at IS NOT NULL AND id='${f.id}'`)[0].n), 1, 'registrou cuidado → 1º registro marcado');
  assert.ok(!hid.includes(f.id.slice(0, 8)), 'pseudônimo não carrega o id');
  assert.equal((await post('/v1/settings', { usage: false }, f.tok)).status, 200);
  assert.equal(Number(sql(`SELECT COUNT(*) AS n FROM usage_daily WHERE hid='${hid}'`)[0].n), 0, 'sair apaga o que existia');
  assert.equal((await json(await post('/v1/usage', { events: [{ event: 'app_open', n: 1 }] }, f.tok))).recorded, false);
  assert.equal(Number(sql(`SELECT COUNT(*) AS n FROM usage_daily WHERE hid='${hid}'`)[0].n), 0, 'e nada novo é guardado');
});

test('preferências: dicas, nascimento (só para a idade em semanas), e-mail de contato', async () => {
  const f = await household({ push: false });
  assert.equal((await post('/v1/settings', { tips: false, babyBirthDate: '2026-09-20', contactEmail: 'Mae@Exemplo.com' }, f.tok)).status, 200);
  const a = await json(await post('/v1/billing/account', {}, f.tok));
  assert.deepEqual(a.prefs, { tips: false, usage: true, babyBirthDate: '2026-09-20', hasEmail: true });
  assert.equal((await post('/v1/settings', { babyBirthDate: '2027-12-31' }, f.tok)).status, 422, 'data muito no futuro');
  assert.equal((await post('/v1/settings', { babyBirthDate: 'ontem' }, f.tok)).status, 422);
  assert.equal((await post('/v1/settings', { contactEmail: 'sem-arroba' }, f.tok)).status, 422);
  assert.equal((await post('/v1/settings', { tips: 'sim' }, f.tok)).status, 400);
  assert.equal((await post('/v1/settings', { babyBirthDate: null, contactEmail: null }, f.tok)).status, 200);
  const b = await json(await post('/v1/billing/account', {}, f.tok));
  assert.equal(b.prefs.babyBirthDate, null); assert.equal(b.prefs.hasEmail, false);
});

test('campanha: grupo-piloto por códigos; só recebe quem tem notificações e aceitou dicas; cliques são contados', async () => {
  const a = await household(), d = await household({ trial: true }), noPush = await household({ push: false }), tipsOff = await household();
  await post('/v1/settings', { tips: false }, tipsOff.tok);
  const codes = [a.code, d.code, noPush.code, tipsOff.code];
  const prev = await adm('/v1/admin/campaigns/preview', { audience: { segment: 'codes', codes } });
  assert.equal(prev.segment, 4); assert.equal(prev.reachable, 2, 'só 2 podem receber (com push e dicas ligadas)');
  assert.equal((await adm('/v1/admin/campaigns/preview', { audience: { segment: 'codes', codes: ['AAAAA-AAAAA-AAAAA-AAAAA'] } })).error, 'code_not_found');
  const c = await newCampaign(codes, { title: 'Novidade 🌙', body: 'Os sons para a soneca chegaram.' });
  assert.equal(c.status, 'scheduled'); assert.ok(c.id);
  const now = daytime();
  const t = await tick(now);
  assert.ok(t.growth.campaigns.sent >= 2, JSON.stringify(t.growth));
  for (const f of [a, d]) { const p = f.pushes(); assert.equal(p.length, 1); assert.equal(p[0].title, 'Novidade 🌙'); assert.equal(p[0].target, 'sons'); assert.match(p[0].sid, /^[0-9a-f-]{36}$/); assert.match(p[0].click, /\/v1\/push\/click$/); assert.equal(p[0].cid, c.id); }
  assert.equal(noPush.pushes().length + tipsOff.pushes().length, 0);
  await tick(now + 60_000);
  assert.equal(a.pushes().length, 1, 'uma vez só por família');
  const camp = (await adm('/v1/admin/campaigns')).campaigns.find((x) => x.id === c.id);
  assert.equal(camp.status, 'sent'); assert.equal(camp.sent, 2);
  // clique: sid único, contado uma vez
  const sid = a.pushes()[0].sid;
  assert.equal((await post('/v1/push/click', { sid })).status, 204);
  assert.equal((await post('/v1/push/click', { sid })).status, 204);
  assert.equal((await post('/v1/push/click', { sid: 'inventado' })).status, 204, 'não vaza se o sid existe');
  assert.equal((await post('/v1/push/click', {})).status, 400);
  assert.equal(Number(sql(`SELECT COUNT(*) AS n FROM notification_sends WHERE campaign_id='${c.id}' AND clicked_at IS NOT NULL`)[0].n), 1);
  const ov = await adm('/v1/admin/overview?days=7');
  const row = ov.notifications.campaigns.find((x) => x.id === c.id);
  assert.equal(row.sent, 2); assert.equal(row.clicked, 1); assert.equal(row.ctr, 0.5);
});

test('campanha respeita o silêncio (22h–6h) e o limite de 1 aviso promocional a cada 20 h', async () => {
  const a = await household();
  const c1 = await newCampaign(a.code);
  const night = daytime(2, 23);                          // 23:00 em São Paulo
  await tick(night);
  assert.equal(a.pushes().length, 0, 'silêncio: nada enviado');
  assert.equal((await adm('/v1/admin/campaigns')).campaigns.find((x) => x.id === c1.id).status, 'sending', 'segue tentando até de manhã');
  await tick(daytime(3, 9));                             // manhã seguinte
  assert.equal(a.pushes().length, 1, 'de manhã é enviado');
  const c2 = await newCampaign(a.code, { title: 'Segunda', body: 'Outra' });
  await tick(daytime(3, 11));
  assert.equal(a.pushes().length, 1, 'limite: 2º aviso no mesmo dia é barrado');
  assert.equal(sql(`SELECT reason FROM notification_sends WHERE campaign_id='${c2.id}'`)[0].reason, 'cap');
  const c3 = await newCampaign(a.code, { title: 'Terceira', body: 'Depois de 20 h' });
  await tick(daytime(4, 14));
  assert.equal(a.pushes().length, 2, 'passadas 20 h, volta a poder enviar');
  assert.equal(a.pushes()[1].title, 'Terceira');
});

test('campanha: agendamento futuro, cancelamento e validações', async () => {
  const a = await household();
  const later = Date.now() + 2 * DAY;
  const c = await newCampaign(a.code, { sendAt: later });
  await tick(daytime(1));
  assert.equal(a.pushes().length, 0, 'agendada para depois: não sai antes');
  assert.equal((await adm('/v1/admin/campaigns/action', { id: c.id, action: 'cancel' })).updated, 1);
  await tick(daytime(3));
  assert.equal(a.pushes().length, 0, 'cancelada: não sai nunca');
  const d = await newCampaign(a.code, { draft: true });
  await tick(daytime(5));
  assert.equal(a.pushes().length, 0, 'rascunho não é enviado');
  assert.equal((await adm('/v1/admin/campaigns/action', { id: d.id, action: 'send_now' })).updated, 1);
  await tick(daytime(6));
  assert.equal(a.pushes().length, 1, 'rascunho enviado depois do "enviar agora"');
  for (const bad of [{ title: '' }, { title: 'x'.repeat(61) }, { body: 'x'.repeat(181) }, { target: 'qualquer' }, { audience: { segment: 'inventado' } }, { sendAt: Date.now() - 5 * DAY }])
    assert.equal((await newCampaign(a.code, bad)).status, 400, JSON.stringify(bad).slice(0, 40));
});

test('envio de teste para um aparelho: ignora silêncio e limite, e não entra nas métricas', async () => {
  const a = await household();
  const r = await adm('/v1/admin/campaigns/test', { code: a.code, title: 'Teste ✅', body: 'Chegou?', target: 'saltos' });
  assert.equal(r.result, 'sent');
  assert.equal(a.pushes()[0].title, 'Teste ✅');
  assert.equal(Number(sql(`SELECT COUNT(*) AS n FROM notification_sends WHERE campaign_id='test'`)[0].n), 0);
  assert.equal((await adm('/v1/admin/campaigns/test', { code: 'AAAAA-AAAAA-AAAAA-AAAAA', title: 't', body: 'b', target: 'hoje' })).status, 404);
});

test('automações: todas nascem desligadas; só enviam quando ligadas, uma vez, e respeitam a regra de cada gatilho', async () => {
  const list = await adm('/v1/admin/automations');
  assert.equal(list.automations.length, 9); assert.ok(list.automations.every((x) => x.enabled === false), 'nada sai sem o administrador ligar');
  assert.deepEqual(list.automations.map((x) => x.key), ['welcome', 'first_care', 'first_reminder', 'sounds_tip', 'leap_coming', 'trial_ends_tomorrow', 'trial_last_day', 'trial_ended', 'inactive_3d']);
  // isola: só as famílias deste teste têm notificações
  const ours = await Promise.all([household(), household(), household(), household(), household({ trial: true })]);
  const [fc, hasCare, welcome, sleepy, tr] = ours;
  sql(`DELETE FROM push_subscriptions WHERE household_id NOT IN (${ours.map((o) => `'${o.id}'`).join(',')})`);
  const now = daytime(8);
  set(fc.id, { created_at: now - 21 * H, first_care_at: null });
  set(hasCare.id, { created_at: now - 21 * H, first_care_at: now - 10 * H });
  set(welcome.id, { created_at: now - 30 * 60_000 });
  set(sleepy.id, { created_at: now - 50 * H });
  await tick(now);
  assert.ok(ours.every((o) => o.pushes().length === 0), 'desligadas: nenhum envio');

  for (const key of ['first_care', 'welcome']) assert.equal((await adm('/v1/admin/automations', { key, enabled: true })).ok, true);
  await adm('/v1/admin/automations', { key: 'first_care', title: 'Registre o primeiro 🍼', body: 'Texto editado pelo painel.' });
  await tick(now);
  assert.equal(fc.pushes().filter((p) => p.title === 'Registre o primeiro 🍼').length, 1);
  assert.equal(fc.pushes()[0].body, 'Texto editado pelo painel.'); assert.equal(fc.pushes()[0].target, 'hoje');
  assert.equal(hasCare.pushes().filter((p) => p.cid === 'auto:first_care').length, 0, 'já registrou cuidado: não recebe');
  assert.equal(welcome.pushes().filter((p) => p.cid === 'auto:welcome').length, 1);
  await tick(now + 10 * 60_000); await tick(now + 20 * 60_000);
  assert.equal(fc.pushes().filter((p) => p.cid === 'auto:first_care').length, 1, 'automação "uma vez" não repete');
  // dica dos sons (sozinha, no dia seguinte: o limite de 1 aviso por 20 h já passou). Quem já usou os sons não recebe
  await adm('/v1/admin/automations', { key: 'first_care', enabled: false }); await adm('/v1/admin/automations', { key: 'welcome', enabled: false });
  await adm('/v1/admin/automations', { key: 'sounds_tip', enabled: true });
  const used = await household(); set(used.id, { created_at: now - 50 * H });
  await post('/v1/usage', { events: [{ event: 'sound_played', n: 1 }] }, used.tok);
  set(sleepy.id, { first_care_at: now - 40 * H });
  await tick(now + 25 * H);
  assert.equal(sleepy.pushes().filter((p) => p.cid === 'auto:sounds_tip').length, 1, 'quem nunca tocou um som recebe a dica');
  assert.equal(used.pushes().filter((p) => p.cid === 'auto:sounds_tip').length, 0, 'quem já usou os sons não recebe');

  // avisos do teste: ignoram o limite de 1 por 20 h (são aviso de conta) e só valem enquanto o teste está ativo
  await adm('/v1/admin/automations', { key: 'trial_last_day', enabled: true });
  set(tr.id, { valid_until: now + 5 * H, grace_until: now + 29 * H });
  sql(`INSERT INTO notification_sends (id, campaign_id, household_id, sent_at, status) VALUES ('${crypto.randomUUID()}', 'qualquer', '${tr.id}', ${now - H}, 'sent')`);
  await tick(now + 40 * 60_000);
  assert.equal(tr.pushes().filter((p) => p.cid === 'auto:trial_last_day').length, 1);
  assert.match(tr.pushes().at(-1).body, /R\$ 37,90/, 'o aviso informa o preço');
});

test('automações: "sentimos sua falta" respeita intervalo; "salto chegando" avisa uma vez por salto; silêncio adia', async () => {
  const a = await household(), l = await household();
  sql(`DELETE FROM push_subscriptions WHERE household_id NOT IN ('${a.id}','${l.id}')`);
  await adm('/v1/admin/automations', { key: 'inactive_3d', enabled: true }); await adm('/v1/admin/automations', { key: 'leap_coming', enabled: true });
  for (const k of ['welcome', 'first_care', 'sounds_tip']) await adm('/v1/admin/automations', { key: k, enabled: false });
  const t0 = daytime(20);
  set(a.id, { created_at: t0 - 20 * DAY, last_seen_at: t0 - 5 * DAY });
  await tick(t0);
  assert.equal(a.pushes().filter((p) => p.cid === 'auto:inactive_3d').length, 1);
  await tick(t0 + 2 * DAY); assert.equal(a.pushes().filter((p) => p.cid === 'auto:inactive_3d').length, 1, 'menos de 7 dias: não repete');
  set(a.id, { last_seen_at: t0 - 10 * DAY });
  await tick(t0 + 8 * DAY); assert.equal(a.pushes().filter((p) => p.cid === 'auto:inactive_3d').length, 2, 'depois de 7 dias pode avisar de novo');
  // salto: nasceu de modo que o salto 3 comece em 2 dias
  const t1 = daytime(40);
  const ageDays = LEAPS[2].from * 7 - 2;
  const birth = new Date(t1 - 3 * H - ageDays * DAY).toISOString().slice(0, 10);
  assert.equal((await post('/v1/settings', { babyBirthDate: birth, timezone: TZ }, l.tok)).status, 200);
  set(l.id, { last_seen_at: t1 });                          // ativa: não conta como "sumida"
  await tick(t1);
  const p = l.pushes().filter((x) => x.cid === 'auto:leap_coming');
  assert.equal(p.length, 1); assert.equal(p[0].target, 'saltos');
  await tick(t1 + 6 * H); await tick(t1 + 30 * H);
  assert.equal(l.pushes().filter((x) => x.cid === 'auto:leap_coming').length, 1, 'não repete o mesmo salto');
  // silêncio: automação de manhã cedo fica para depois
  const q = await household(); sql(`DELETE FROM push_subscriptions WHERE household_id NOT IN ('${q.id}')`);
  await adm('/v1/admin/automations', { key: 'first_care', enabled: true });
  const tn = daytime(60, 23); set(q.id, { created_at: tn - 21 * H, first_care_at: null });
  await tick(tn); assert.equal(q.pushes().length, 0, 'às 23h não envia (silêncio)');
  await tick(daytime(61, 9)); assert.equal(q.pushes().filter((x) => x.cid === 'auto:first_care').length, 1, 'de manhã envia');
  await adm('/v1/admin/automations', { key: 'first_care', enabled: false }); await adm('/v1/admin/automations', { key: 'leap_coming', enabled: false }); await adm('/v1/admin/automations', { key: 'inactive_3d', enabled: false });
});

test('análise de uso: ativação, retenção D1/D3/D7, recursos, notificações e funil do teste', async () => {
  const f = await household({ trial: true });
  const day = (offset) => new Date(Date.now() - offset * DAY - 3 * H).toISOString().slice(0, 10);
  // cadastro há 8 dias; voltou no dia 1, 3 e 7; registrou cuidado no mesmo dia
  await post('/v1/usage', { events: [{ event: 'app_open', n: 1 }] }, f.tok);
  const hid = sql(`SELECT hid FROM households WHERE id='${f.id}'`)[0].hid;
  const created = Date.now() - 8 * DAY;
  set(f.id, { created_at: created, first_care_at: created + 2 * H });
  sql(`DELETE FROM usage_daily WHERE hid='${hid}'`);
  const d0 = new Date(created - 3 * H).toISOString().slice(0, 10);
  const plus = (n) => new Date(Date.parse(d0 + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
  for (const [n, ev] of [[0, 'app_open'], [1, 'app_open'], [3, 'app_open'], [7, 'app_open'], [7, 'sound_played'], [0, 'care_logged'], [0, 'app_installed'], [0, 'lp_arrival']])
    sql(`INSERT INTO usage_daily (hid, day, event, n) VALUES ('${hid}', '${plus(n)}', '${ev}', 1)`);
  const ov = await adm('/v1/admin/overview?days=30');
  assert.ok(ov.users.total >= 1 && ov.users.trials >= 1);
  assert.ok(ov.activation.cohort >= 1 && ov.activation.within24h > 0 && ov.activation.ever >= ov.activation.within24h);
  for (const k of ['d1', 'd3', 'd7']) { assert.ok(ov.retention[k].cohort >= 1, k); assert.ok(ov.retention[k].returned >= 1, k); assert.ok(ov.retention[k].rate > 0 && ov.retention[k].rate <= 1, k); }
  assert.ok(ov.features.sound_played.households >= 1);
  assert.deepEqual(ov.funnel.leads, { configured: false }, 'sem token do Netlify: não configurado, sem inventar número');
  assert.ok(ov.funnel.installs >= 1 && ov.funnel.fromLp >= 1 && ov.funnel.activePush >= 1);
  for (const k of ['remindersCreated', 'remindersActive']) assert.equal(typeof ov.funnel[k], 'number', k);
  assert.equal(typeof ov.funnel.suggestions.total, 'number');
  assert.ok(Array.isArray(ov.series.dau) && Array.isArray(ov.series.signups));
  assert.ok(ov.push.withPush >= 1 && ov.push.optInRate > 0 && ov.push.optInRate <= 1);
  assert.ok(ov.trial.started >= 1); assert.equal(typeof ov.trial.conversion, 'number');
  assert.equal(typeof ov.revenue.cents, 'number');
  assert.ok(ov.notifications.campaigns.length >= 1);
  assert.equal((await adm('/v1/admin/overview?days=0')).days, 30, 'janela inválida cai no padrão');
});

test('privacidade: apagar a família remove uso e envios; exportação inclui plano e preferências', async () => {
  const f = await household({ trial: true });
  await post('/v1/usage', { events: [{ event: 'app_open', n: 1 }] }, f.tok);
  await post('/v1/settings', { babyBirthDate: '2026-10-01' }, f.tok);
  const hid = sql(`SELECT hid FROM households WHERE id='${f.id}'`)[0].hid;
  const exp = await (await post('/v1/privacy/export', {}, f.tok)).json();
  assert.equal(exp.conta.plano, 'trial'); assert.equal(exp.conta.nascimento_do_bebe, '2026-10-01'); assert.equal(exp.conta.estatisticas_de_uso, true);
  assert.equal((await post('/v1/privacy/delete', { confirm: 'APAGAR' }, f.tok)).status, 200);
  assert.equal(Number(sql(`SELECT COUNT(*) AS n FROM usage_daily WHERE hid='${hid}'`)[0].n), 0);
  assert.equal(Number(sql(`SELECT COUNT(*) AS n FROM households WHERE id='${f.id}'`)[0].n), 0);
});
