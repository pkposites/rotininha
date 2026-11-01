import { useState } from 'preact/hooks';
import { TYPES, toInputValue, fromInputValue } from './lib/events.js';

const DETAILS = {
  fralda: [['', 'Sem detalhe'], ['xixi', 'Xixi'], ['coco', 'Cocô'], ['ambos', 'Xixi e cocô']],
  mamada: [['', 'Sem detalhe'], ['esquerdo', 'Peito esquerdo'], ['direito', 'Peito direito'], ['mamadeira', 'Mamadeira']]
};

export function EditSheet({ event, onSave, onDelete, onClose }) {
  const [start, setStart] = useState(toInputValue(event.startedAt));
  const [end, setEnd] = useState(event.endedAt ? toInputValue(event.endedAt) : '');
  const [note, setNote] = useState(event.note || '');
  const [detail, setDetail] = useState(event.detail || '');
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState('');
  const t = TYPES[event.type];

  const submit = (ev) => {
    ev.preventDefault();
    const s = fromInputValue(start);
    const e = end ? fromInputValue(end) : null;
    if (Number.isNaN(s)) return setErr('Confira o horário.');
    if (e != null && e < s) return setErr('O fim precisa ser depois do início.');
    onSave({ ...event, startedAt: s, endedAt: e, note: note.trim().slice(0, 300), detail });
  };

  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form class="sheet" role="dialog" aria-modal="true" aria-label={`Editar ${t.label}`} onSubmit={submit}>
        <h2>{t.icon} {t.label}</h2>
        <label>Horário<input type="datetime-local" value={start} onInput={(e) => setStart(e.target.value)} required /></label>
        {event.type === 'sono' && (
          <label>Acordou às (opcional)<input type="datetime-local" value={end} onInput={(e) => setEnd(e.target.value)} /></label>
        )}
        {DETAILS[event.type] && (
          <label>Detalhe (opcional)
            <select value={detail} onChange={(e) => setDetail(e.target.value)}>
              {DETAILS[event.type].map(([v, l]) => <option value={v}>{l}</option>)}
            </select>
          </label>
        )}
        <label>Observação (opcional)<textarea rows="2" maxLength="300" value={note} onInput={(e) => setNote(e.target.value)} /></label>
        {err && <p class="err" role="alert">{err}</p>}
        <div class="row">
          <button type="submit" class="btn">Salvar</button>
          <button type="button" class="btn ghost" onClick={onClose}>Cancelar</button>
        </div>
        {!confirm
          ? <button type="button" class="link-danger" onClick={() => setConfirm(true)}>Excluir registro</button>
          : <div class="row"><button type="button" class="btn danger" onClick={() => onDelete(event.id)}>Confirmar exclusão</button>
              <button type="button" class="btn ghost" onClick={() => setConfirm(false)}>Manter</button></div>}
      </form>
    </div>
  );
}
