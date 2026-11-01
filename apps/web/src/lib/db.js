// IndexedDB mínimo (sem dependências). Cache local e, no Marco 2, fila de sincronização.
const DB_NAME = 'rotininha', VERSION = 1, STORE = 'events';

let dbPromise;
function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, { keyPath: 'id' });
      s.createIndex('startedAt', 'startedAt');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const listEvents = () => tx('readonly', (s) => s.getAll());
export const putEvent = (e) => tx('readwrite', (s) => s.put({ ...e, updatedAt: Date.now() }));
export const deleteEvent = (id) => tx('readwrite', (s) => s.delete(id));
