import { useState, useEffect, useCallback } from 'preact/hooks';
import { listTasks, putTask, deleteTask, listOccs, putOcc } from './db.js';
import { requestSync, onRemoteChange, deviceTimeZone } from './sync.js';

export function useReminders() {
  const [tasks, setTasks] = useState([]);
  const [occs, setOccs] = useState([]);
  const refresh = useCallback(async () => {
    try { setTasks(await listTasks()); setOccs(await listOccs()); } catch {}
  }, []);
  useEffect(() => { refresh(); return onRemoteChange(refresh); }, [refresh]);

  const saveTask = async (t) => { await putTask(t); await refresh(); requestSync(); };
  const removeTask = async (id) => { await deleteTask(id); await refresh(); requestSync(); };
  const saveOcc = async (o) => { await putOcc(o); await refresh(); requestSync(); };
  return { tasks, occs, tz: deviceTimeZone(), saveTask, removeTask, saveOcc };
}
