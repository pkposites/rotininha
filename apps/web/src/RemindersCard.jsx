import { dayItems, CATEGORIES } from './lib/tasks.js';
import { PlusIcon, CheckIcon } from './icons.jsx';

const hhmm = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function RemindersCard({ tasks, occs, now, tz, onOpen, onNew, onQuickDone }) {
  const items = dayItems(tasks, occs, now, tz);
  return (
    <section class="card" aria-label="Próximos lembretes">
      <div class="card-head">
        <h2 class="h3s">Próximos lembretes</h2>
        <button class="pill" onClick={onNew}><PlusIcon width="16" height="16" /> Novo</button>
      </div>
      {tasks.length === 0 && (
        <p class="muted mt8">Você ainda não criou lembretes. Crie o primeiro quando quiser — banho, remédio conforme orientação, consulta…</p>
      )}
      {tasks.length > 0 && items.length === 0 && <p class="muted">Nenhum lembrete para hoje.</p>}
      <ul class="timeline">
        {items.map((i) => {
          const handled = i.status === 'done' || i.status === 'skipped';
          return (
            <li key={i.id} class={`rem ${handled ? 'handled' : ''} ${i.late ? 'late' : ''}`}>
              {!handled
                ? <button class="done-btn" aria-label={`Marcar ${i.task.title} como feito`} onClick={() => onQuickDone(i)} />
                : <span class="check" role="img" aria-label={i.status === 'done' ? 'Feito' : 'Pulado'}>{i.status === 'done' ? <CheckIcon /> : <span aria-hidden="true">—</span>}</span>}
              <button class="rem-main" onClick={() => onOpen(i)}>
                <span class="rem-title">{CATEGORIES[i.task.category].icon} {i.task.title}</span>
                <span class="rem-sub time">
                  {hhmm(i.effective)}
                  {i.status === 'snoozed' && ' · adiado'}
                  {i.status === 'skipped' && ' · pulado'}
                  {i.late && <> · <span class="late-tag">ainda não registrado</span></>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
