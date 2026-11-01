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
      <details class="fold how-rem">
        <summary>Como funcionam os lembretes?</summary>
        <ol class="how-steps">
          <li><strong>Crie.</strong> Toque em “+ Novo”, escolha o nome (por exemplo, Banho), o horário e se repete: todos os dias, em dias da semana ou uma vez só.</li>
          <li><strong>Receba o aviso.</strong> No horário, o Ninhora avisa por notificação e o lembrete aparece aqui, em “Próximos lembretes”.</li>
          <li><strong>Responda.</strong> Toque no círculo para marcar como feito. Ou toque no lembrete para adiar (10, 15 ou 30 minutos, só por hoje) ou pular hoje. Errou? Tem “Desfazer”.</li>
          <li><strong>Amanhã.</strong> Se o lembrete repete, ele volta sozinho no dia seguinte. Os resolvidos ficam em “Já resolvidos hoje”.</li>
        </ol>
        <p class="muted"><strong>Para as notificações chegarem:</strong> ative em Ajustes. No iPhone, só funciona depois de instalar o app na Tela de Início. Entre 22h e 6h não avisamos, a menos que você permita ao criar o lembrete. A entrega depende do aparelho e pode atrasar, mas o lembrete sempre aparece aqui no app.</p>
        <p class="muted">Marcar um lembrete como feito não cria um registro de cuidado: para registrar mamada, sono ou fralda, use os botões da tela Hoje.</p>
      </details>
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
