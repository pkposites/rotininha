// IndexedDB mínimo. Fonte local offline + fila de sincronização (campo `dirty`).
// Três coleções sincronizáveis: events (cuidados), tasks (lembretes), occs (ocorrências: feito/adiado/pulado).
import { visible, mergeRemote, cleanAfterPush, MAX_BATCH, STORE_OF } from './sync-core.js';

const DB_NAME = 'rotininha', VERSION = 3;
const META = 'meta';
const COLLECTIONS = ['events', 'tasks', 'occs'];

let dbPromise;
function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('events')) db.createObjectStore('events', { keyPath: 'id' }).createIndex('startedAt', 'startedAt');
      if (!db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('occs')) db.createObjectStore('occs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(stores, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const names = [].concat(stores);
    const t = db.transaction(names, mode);
    let out;
    Promise.resolve(fn(...names.map((n) => t.objectStore(n)))).then((v) => { out = v; }, reject);
    t.oncomplete = () => resolve(out);
    t.onerror = t.onabort = () => reject(t.error);
  });
}
const get = (store, key) => new Promise((res, rej) => { const r = store.get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const all = (store) => new Promise((res, rej) => { const r = store.getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

const list = (name) => async () => visible(await run(name, 'readonly', all));
const put = (name) => (e) => run(name, 'readwrite', (s) => { s.put({ ...e, updatedAt: Date.now(), dirty: true }); });
const tombstone = (name) => (id) => run(name, 'readwrite', async (s) => {
  const cur = await get(s, id);
  if (cur) s.put({ ...cur, deleted: true, updatedAt: Date.now(), dirty: true });
});

export const listEvents = list('events'), putEvent = put('events'), deleteEvent = tombstone('events');
export const listTasks = list('tasks'), putTask = put('tasks'), deleteTask = tombstone('tasks');
export const listOccs = list('occs'), putOcc = put('occs');

/** Pendências de envio, de todas as coleções: [{ kind, rec }] (até MAX_BATCH). */
export async function listDirty() {
  const out = [];
  for (const [kind, name] of Object.entries(STORE_OF)) {
    for (const rec of await run(name, 'readonly', all)) if (rec.dirty) out.push({ kind, rec });
  }
  return out.slice(0, MAX_BATCH);
}

export const markAllDirty = () =>
  run(COLLECTIONS, 'readwrite', async (...stores) => {
    for (const s of stores) for (const e of await all(s)) s.put({ ...e, dirty: true });
  });

export const applyRemote = (changes) =>
  run(COLLECTIONS, 'readwrite', async (events, tasks, occs) => {
    const by = { events, tasks, occs };
    for (const { kind, ...r } of changes) {
      const s = by[STORE_OF[kind ?? 'event']];
      if (!s) continue;
      const m = mergeRemote(await get(s, r.id), r);
      if (m) s.put(m);
    }
  });

export const markPushed = (pushed) =>
  run(COLLECTIONS, 'readwrite', async (events, tasks, occs) => {
    const by = { events, tasks, occs };
    for (const { kind, rec } of pushed) {
      const s = by[STORE_OF[kind]];
      const c = cleanAfterPush(await get(s, rec.id), rec.updatedAt);
      if (c) s.put(c);
    }
  });

export const getMeta = (key) => run(META, 'readonly', async (s) => (await get(s, key))?.value);
export const setMeta = (key, value) => run(META, 'readwrite', (s) => { s.put({ key, value }); });
export const delMeta = (key) => run(META, 'readwrite', (s) => { s.delete(key); });
