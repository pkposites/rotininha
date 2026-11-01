// IndexedDB mínimo. Fonte local de verdade offline + fila de sincronização (campo `dirty`).
const DB_NAME = 'rotininha', VERSION = 2;
const EVENTS = 'events', META = 'meta';
import { visible, dirtyOf, mergeRemote, cleanAfterPush } from './sync-core.js';

let dbPromise;
function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(EVENTS)) {
        db.createObjectStore(EVENTS, { keyPath: 'id' }).createIndex('startedAt', 'startedAt');
      }
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
    const t = db.transaction(stores, mode);
    let out;
    Promise.resolve(fn(...[].concat(stores).map((s) => t.objectStore(s)))).then((v) => { out = v; }, reject);
    t.oncomplete = () => resolve(out);
    t.onerror = t.onabort = () => reject(t.error);
  });
}
const get = (store, key) => new Promise((res, rej) => { const r = store.get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const all = (store) => new Promise((res, rej) => { const r = store.getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const listEvents = async () => visible(await run(EVENTS, 'readonly', all));
export const listDirty = async () => dirtyOf(await run(EVENTS, 'readonly', all));

export const putEvent = (e) =>
  run(EVENTS, 'readwrite', (s) => { s.put({ ...e, updatedAt: Date.now(), dirty: true }); });

// Exclusão = tombstone, para poder propagar aos outros aparelhos.
export const deleteEvent = (id) =>
  run(EVENTS, 'readwrite', async (s) => {
    const cur = await get(s, id);
    if (cur) s.put({ ...cur, deleted: true, updatedAt: Date.now(), dirty: true });
  });

export const markAllDirty = () =>
  run(EVENTS, 'readwrite', async (s) => { for (const e of await all(s)) s.put({ ...e, dirty: true }); });

export const applyRemote = (changes) =>
  run(EVENTS, 'readwrite', async (s) => {
    for (const r of changes) {
      const m = mergeRemote(await get(s, r.id), r);
      if (m) s.put(m);
    }
  });

export const markPushed = (pushed) =>
  run(EVENTS, 'readwrite', async (s) => {
    for (const p of pushed) {
      const c = cleanAfterPush(await get(s, p.id), p.updatedAt);
      if (c) s.put(c);
    }
  });

export const getMeta = (key) => run(META, 'readonly', async (s) => (await get(s, key))?.value);
export const setMeta = (key, value) => run(META, 'readwrite', (s) => { s.put({ key, value }); });
export const delMeta = (key) => run(META, 'readwrite', (s) => { s.delete(key); });
