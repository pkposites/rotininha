import { useState } from 'preact/hooks';
import { CATEGORIES, validateTask, needsQuietConfirm } from './lib/tasks.js';
import { localParts } from '../../../packages/shared/schedule.js';

const DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const DAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function TaskSheet({ task, isNew, tz, onSave, onDelete, onClose }) {
  const [t, setT] = useState(task);
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (patch) => setT((x) => ({ ...x, ...patch }));
  const quiet = t.notify && needsQuietConfirm(t.time);

  const submit = (e) => {
    e.preventDefault();
    const msg = validateTask(t);
    if (msg) return setErr(msg);
    onSave({ ...t, title: t.title.trim(), date: t.repeat === 'once' ? t.date : null, allowQuiet: quiet ? t.allowQuiet : false });
  };
  const toggleDay = (d) => set({ days: t.days.includes(d) ? t.days.filter((x) => x !== d) : [...t.days, d].sort() });

  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form class="sheet" role="dialog" aria-modal="true" aria-label={isNew ? 'Novo lembrete' : 'Editar lembrete'} onSubmit={submit}>
        <h2>{isNew ? 'Novo lembrete' : 'Editar lembrete'}</h2>
        <label>Nome<input value={t.title} maxLength={80} onInput={(e) => set({ title: e.target.value })} placeholder="Ex.: Hora do banho" required /></label>
        <label>Tipo
          <select value={t.category} onChange={(e) => set({ category: e.target.value })}>
            {Object.entries(CATEGORIES).map(([k, v]) => <option value={k}>{v.icon} {v.label}</option>)}
          </select>
        </label>
        {t.category === 'remedio' && (
          <p class="muted">Registre somente horários conforme orientação de profissional de saúde. O Rotininha não calcula nem sugere doses.</p>
        )}
        <label>Horário<input type="time" value={t.time} onInput={(e) => set({ time: e.target.value })} required /></label>
        <label>Repetição
          <select value={t.repeat} onChange={(e) => set({ repeat: e.target.value })}>
            <option value="daily">Todos os dias</option>
            <option value="weekly">Em dias da semana</option>
            <option value="once">Uma vez</option>
          </select>
        </label>
        {t.repeat === 'weekly' && (
          <div class="chips" role="group" aria-label="Dias da semana">
            {DAYS.map((l, d) => (
              <button type="button" class="chip" aria-pressed={t.days.includes(d)} aria-label={DAY_NAMES[d]} onClick={() => toggleDay(d)}>{l}</button>
            ))}
          </div>
        )}
        {t.repeat === 'once' && (
          <label>Data<input type="date" value={t.date ?? ''} min={localParts(Date.now(), tz).date} onInput={(e) => set({ date: e.target.value })} /></label>
        )}
        <label>Avisar com antecedência
          <select value={t.leadMin} onChange={(e) => set({ leadMin: Number(e.target.value) })}>
            {[0, 5, 10, 15, 30, 60].map((m) => <option value={m}>{m ? `${m} min antes` : 'No horário'}</option>)}
          </select>
        </label>
        <label class="inline"><input type="checkbox" checked={t.notify} onChange={(e) => set({ notify: e.target.checked })} /> Receber notificação</label>
        {quiet && (
          <label class="inline note-quiet">
            <input type="checkbox" checked={t.allowQuiet} onChange={(e) => set({ allowQuiet: e.target.checked })} />
            <span>Este horário está no silêncio (22h–6h). Quero ser avisada mesmo assim.</span>
          </label>
        )}
        {quiet && !t.allowQuiet && <p class="muted">Sem essa confirmação, este lembrete aparece no app, mas não toca nesse horário.</p>}
        {err && <p class="err" role="alert">{err}</p>}
        <div class="row">
          <button type="submit" class="btn">Salvar</button>
          <button type="button" class="btn ghost" onClick={onClose}>Cancelar</button>
        </div>
        {!isNew && (!confirmDel
          ? <button type="button" class="link-danger" onClick={() => setConfirmDel(true)}>Excluir lembrete</button>
          : <div class="row"><button type="button" class="btn danger" onClick={() => onDelete(t.id)}>Confirmar exclusão</button>
              <button type="button" class="btn ghost" onClick={() => setConfirmDel(false)}>Manter</button></div>)}
      </form>
    </div>
  );
}
