import { useState, useEffect, useCallback } from 'preact/hooks';
import { listEvents, putEvent, deleteEvent } from './db.js';
import { makeEvent, openSleep } from './events.js';

export function useEvents() {
  const [events, setEvents] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try { setEvents(await listEvents()); setError(null); }
    catch { setError('Não foi possível acessar o armazenamento do aparelho.'); }
    setReady(true);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const save = async (e) => { await putEvent(e); await refresh(); };
  const remove = async (id) => { await deleteEvent(id); await refresh(); };

  // Registro de 1 toque: salva agora, o horário pode ser corrigido depois.
  const quickLog = async (type) => {
    const now = Date.now();
    if (type === 'sono') {
      const open = openSleep(events);
      if (open) { const e = { ...open, endedAt: now }; await save(e); return { event: e, woke: true }; }
    }
    const e = makeEvent(type, now);
    await save(e);
    return { event: e };
  };

  return { events, ready, error, save, remove, quickLog };
}
