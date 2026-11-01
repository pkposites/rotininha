import { dayItems, CATEGORIES } from './lib/tasks.js';
import { reminderView, nextLabel } from './lib/ux.js';
import { PlusIcon, CheckIcon } from './icons.jsx';

const hhmm = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function RemindersCard({ tasks, occs, now, tz, onOpen, onNew, onQuickDone }) {
  const items = dayItems(tasks, occs, now, tz);
  const { pending, handled, next } = reminderView(items, tasks, occs, now, tz);
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
      {items.length > 0 && pending.length === 0 && (
        <p class="all-done" role="status">✓ Tudo feito por hoje.{next ? <> Próximo lembrete: <strong>{next.task.title}</strong>, {nextLabel(next)}.</> : ''}</p>
      )}
      {pending.length === 0 && items.length === 0 && next && <p class="muted">Próximo lembrete: <strong>{next.task.title}</strong>, {nextLabel(next)}.</p>}
      <ul class="timeline">
        {pending.map((i) => (
          <li key={i.id} class={`rem ${i.late ? 'late' : ''}`}>
            <button class="done-btn" aria-label={`Marcar ${i.task.title} como feito`} onClick={() => onQuickDone(i)} />
            <button class="rem-main" onClick={() => onOpen(i)}>
              <span class="rem-title">{CATEGORIES[i.task.category].icon} {i.task.title}</span>
              <span class="rem-sub time">
                hoje, {hhmm(i.effective)}
                {i.status === 'snoozed' && ' · adiado só por hoje'}
                {i.late && <> · <span class="late-tag">ainda não registrado</span></>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {handled.length > 0 && (
        <details class="handled-box" open={pending.length === 0}>
          <summary>Já resolvidos hoje ({handled.length})</summary>
          <ul class="timeline">
            {handled.map((i) => (
              <li key={i.id} class="rem handled">
                <span class="check" role="img" aria-label={i.status === 'done' ? 'Feito' : 'Pulado'}>{i.status === 'done' ? <CheckIcon /> : <span aria-hidden="true">—</span>}</span>
                <button class="rem-main" onClick={() => onOpen(i)}>
                  <span class="rem-title">{CATEGORIES[i.task.category].icon} {i.task.title}</span>
                  <span class="rem-sub time">{i.status === 'done' ? 'feito' : 'pulado hoje'} · era às {hhmm(i.at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
