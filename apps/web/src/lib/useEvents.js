import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { listEvents, putEvent, deleteEvent } from './db.js';
import { makeEvent, openSleep } from './events.js';
import { requestSync, onRemoteChange } from './sync.js';
import { isDoubleTap } from './ux.js';

export function useEvents() {
  const [events, setEvents] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try { setEvents(await listEvents()); setError(null); }
    catch { setError('Não foi possível acessar o armazenamento do aparelho.'); }
    setReady(true);
  }, []);
  useEffect(() => { refresh(); return onRemoteChange(refresh); }, [refresh]);

  const save = async (e) => { await putEvent(e); await refresh(); requestSync(); };
  const remove = async (id) => { await deleteEvent(id); await refresh(); requestSync(); };

  // Registro de 1 toque: salva agora, o horário pode ser corrigido depois.
  const lastLog = useRef(null);   // { type, at, result }: evita dois registros por toque duplo
  const quickLog = async (type) => {
    const now = Date.now();
    if (isDoubleTap(lastLog.current, type, now)) return { ...(await lastLog.current.result), duplicate: true };
    const pending = doLog(type, now);
    lastLog.current = { type, at: now, result: pending };   // já vale durante o salvamento (toque duplo muito rápido)
    return pending;
  };
  // Desfaz o último registro rápido: apaga o cuidado criado (ou reabre o sono que o toque encerrou).
  const undoLog = async (r) => {
    if (r.woke) await save({ ...r.event, endedAt: null, updatedAt: Date.now() });
    else await remove(r.event.id);
    lastLog.current = null;
  };
  const doLog = async (type, now) => {
    if (type === 'sono') {
      const open = openSleep(events);
      if (open) { const e = { ...open, endedAt: now }; await save(e); return { event: e, woke: true }; }
    }
    const e = makeEvent(type, now);
    await save(e);
    return { event: e };
  };

  return { events, ready, error, save, remove, quickLog, undoLog };
}
