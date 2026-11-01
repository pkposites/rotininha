import { dayItems, CATEGORIES } from './lib/tasks.js';

const hhmm = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function RemindersCard({ tasks, occs, now, tz, onOpen, onNew, onQuickDone }) {
  const items = dayItems(tasks, occs, now, tz);
  return (
    <section class="card" aria-label="Próximos lembretes">
      <div class="card-head">
        <h2 class="h3s">Próximos lembretes</h2>
        <button class="link" onClick={onNew}>+ Novo</button>
      </div>
      {tasks.length === 0 && (
        <p class="muted">Você ainda não criou lembretes. Crie o primeiro quando quiser — banho, remédio conforme orientação, consulta…</p>
      )}
      {tasks.length > 0 && items.length === 0 && <p class="muted">Nenhum lembrete para hoje.</p>}
      <ul class="timeline">
        {items.map((i) => {
          const handled = i.status === 'done' || i.status === 'skipped';
          return (
            <li key={i.id} class={`rem ${handled ? 'handled' : ''} ${i.late ? 'late' : ''}`}>
              <button class="row-btn rem-main" onClick={() => onOpen(i)}>
                <span class="time">{hhmm(i.effective)}</span>
                <span>
                  {CATEGORIES[i.task.category].icon} {i.task.title}
                  {i.status === 'snoozed' && <small class="muted"> · adiado</small>}
                  {i.status === 'skipped' && <small class="muted"> · pulado</small>}
                  {i.late && <small class="late-tag"> · ainda não registrado</small>}
                </span>
              </button>
              {!handled
                ? <button class="chip done-btn" aria-label={`Marcar ${i.task.title} como feito`} onClick={() => onQuickDone(i)}>✓ Feito</button>
                : <span class="ok-mark" aria-label={i.status === 'done' ? 'Feito' : 'Pulado'}>{i.status === 'done' ? '✓' : '—'}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
