import { CATEGORIES, SNOOZE_OPTIONS } from './lib/tasks.js';

const hhmm = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// Abre ao tocar no lembrete ou na notificação. Só conclui quando a pessoa toca em "Feito".
export function ReminderSheet({ item, now, onDone, onSkip, onSnooze, onUndo, onEdit, onClose }) {
  const c = CATEGORIES[item.task.category];
  const handled = item.status === 'done' || item.status === 'skipped';
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={item.task.title}>
        <h2>{c.icon} {item.task.title}</h2>
        <p class="muted">
          {hhmm(item.at)}
          {item.status === 'snoozed' && ` · adiado para ${hhmm(item.snoozeUntil)}`}
          {item.status === 'done' && ' · feito'}
          {item.status === 'skipped' && ' · pulado'}
        </p>
        {!handled ? (
          <>
            <button class="btn" onClick={onDone}>✓ Feito</button>
            <div class="row" role="group" aria-label="Adiar">
              {SNOOZE_OPTIONS.map((m) => <button class="btn ghost" onClick={() => onSnooze(m)}>Adiar {m} min</button>)}
            </div>
            <button class="btn ghost" onClick={onSkip}>Pular hoje</button>
          </>
        ) : (
          <button class="btn ghost" onClick={onUndo}>Desfazer</button>
        )}
        <div class="row">
          <button class="link" onClick={onEdit}>Editar lembrete</button>
          <button class="link" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
