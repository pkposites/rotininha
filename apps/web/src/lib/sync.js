import { listDirty, applyRemote, markPushed, markAllDirty, getMeta, setMeta, delMeta } from './db.js';
import { toWire } from './sync-core.js';
import { uuid } from './events.js';

export const API = (import.meta.env?.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
export const syncAvailable = !!API;

// status: 'off' | 'idle' | 'syncing' | 'offline' | 'expired' | 'signed-out'
let state = { status: syncAvailable ? 'signed-out' : 'off', lastSyncAt: null };
const listeners = new Set();
const emit = (patch) => { state = { ...state, ...patch }; listeners.forEach((l) => l(state)); };
export const subscribe = (fn) => { listeners.add(fn); fn(state); return () => listeners.delete(fn); };
const changed = new Set();
export const onRemoteChange = (fn) => { changed.add(fn); return () => changed.delete(fn); };

async function call(path, body, token) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  });
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

async function deviceId() {
  let id = await getMeta('deviceId');
  if (!id) { id = uuid().replace(/-/g, ''); await setMeta('deviceId', id); }
  return id;
}

/** Chamada pública (sem sessão): planos, checkout, recuperação. */
export async function publicCall(path, body, method = 'POST') {
  const res = await fetch(API + path, {
    method, headers: { 'Content-Type': 'application/json' }, ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {})
  });
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data };
}
export const getDeviceId = deviceId;

/** Adota uma sessão recém-criada (compra ou recuperação) neste aparelho e sincroniza. */
export async function adoptSession(session) {
  await setMeta('session', session);
  await setMeta('cursor', 0);
  await markAllDirty(); // registros feitos antes de conectar também sobem
  emit({ status: 'syncing' });
  await syncNow();
}

export async function login(code) {
  const { status, data } = await call('/v1/sessions', { code, deviceId: await deviceId() });
  if (status === 401) throw new Error('Código não encontrado. Confira e tente de novo.');
  if (status === 429) throw new Error('Muitas tentativas. Aguarde alguns minutos.');
  if (status !== 201) throw new Error('Não foi possível conectar agora.');
  await setMeta('session', data);
  await setMeta('cursor', 0);
  await markAllDirty(); // registros feitos antes de conectar também sobem
  emit({ status: 'syncing' });
  await syncNow(); // primeira sincronização imediata; a tela só diz "Sincronizado" quando termina
}

export async function logout() {
  const s = await getMeta('session');
  if (s) { try { await call('/v1/sessions/logout', {}, s.accessToken); } catch {} }
  await delMeta('session'); await delMeta('cursor');
  emit({ status: 'signed-out' });
}

async function accessToken(force = false) {
  const s = await getMeta('session');
  if (!s) return null;
  if (!force && s.accessExpiresAt - Date.now() > 60_000) return s.accessToken;
  const r = await call('/v1/sessions/refresh', { refreshToken: s.refreshToken });
  if (r.status === 201) { await setMeta('session', r.data); return r.data.accessToken; }
  if (r.status === 401) { await delMeta('session'); return null; } // sessão inválida: pede o código de novo
  throw new Error('network');
}

let running = false, again = false, timer;
export function requestSync(delay = 400) {
  if (!syncAvailable) return;
  clearTimeout(timer);
  timer = setTimeout(syncNow, delay);
}

// Fuso da família: o servidor agenda lembretes no fuso informado pelo aparelho.
async function syncTimezone(token) {
  const tz = deviceTimeZone();
  if ((await getMeta('tzSent')) === tz) return;
  const r = await call('/v1/settings', { timezone: tz }, token);
  if (r.status === 200) await setMeta('tzSent', tz);
}
export const deviceTimeZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'; } catch { return 'America/Sao_Paulo'; } };

/** Chamada autenticada (renova token se preciso). Lança 'not-connected' sem sessão. */
export async function authedCall(path, body) {
  let token = await accessToken();
  if (!token) throw new Error('not-connected');
  let r = await call(path, body, token);
  if (r.status === 401) { token = await accessToken(true); if (!token) throw new Error('not-connected'); r = await call(path, body, token); }
  return r;
}

export async function syncNow() {
  if (!syncAvailable) return;
  if (running) { again = true; return; }
  running = true;
  try {
    if (!(await getMeta('session'))) return emit({ status: 'signed-out' });
    emit({ status: 'syncing' });
    for (let guard = 0; guard < 20; guard++) {
      let token = await accessToken();
      if (!token) return emit({ status: 'signed-out' });
      const dirty = await listDirty();
      const pending = dirty.map(({ kind, rec }) => toWire(rec, kind));
      const cursor = (await getMeta('cursor')) ?? 0;
      let r = await call('/v1/sync', { cursor, changes: pending }, token);
      if (r.status === 401) { // access token revogado/expirado: tenta uma renovação
        token = await accessToken(true);
        if (!token) return emit({ status: 'signed-out' });
        r = await call('/v1/sync', { cursor, changes: pending }, token);
      }
      if (r.status === 403 && r.data?.error === 'expired') return emit({ status: 'expired' });
      if (r.status !== 200) throw new Error('http ' + r.status);
      await markPushed(dirty);
      await applyRemote(r.data.changes);
      await setMeta('cursor', r.data.cursor);
      if (r.data.changes.length) changed.forEach((f) => f());
      await syncTimezone(token);
      if (!r.data.more && dirty.length < 200) break;
    }
    emit({ status: 'idle', lastSyncAt: Date.now() });
  } catch {
    emit({ status: 'offline' });
  } finally {
    running = false;
    if (again) { again = false; requestSync(1000); }
  }
}

export async function startSync() {
  if (!syncAvailable) return;
  if (await getMeta('session')) { emit({ status: 'idle' }); requestSync(100); }
  addEventListener('online', () => requestSync(100));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') requestSync(100); });
  setInterval(() => { if (document.visibilityState === 'visible') requestSync(0); }, 60_000);
}
