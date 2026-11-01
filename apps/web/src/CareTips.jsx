import { TIPS, WHEN_HELP, WHEN_HELP_NOTE } from './lib/tips.js';
import { count } from './lib/usage.js';

export function CareTips({ onCreateTask, onGoSounds }) {
  return (
    <section aria-labelledby="care-h" class="stack">
      <h1 class="h2s" id="care-h">Guia de cuidado</h1>
      <p class="muted">Uma ajuda para agora. Entenda o porquê, experimente um passo e observe. Consulte estas dicas quando precisar.</p>
      <ul class="tips">
        {TIPS.map((t) => (
          <li key={t.id}>
            <details class="card tip" onToggle={(e) => e.currentTarget.open && count('care_tip_opened')}>
              <summary>{t.icon} {t.title}</summary>
              <h3>Por que isso importa</h3><p>{t.why}</p>
              <h3>O que você pode fazer</h3><ul>{t.do.map((d) => <li>{d}</li>)}</ul>
              <p class="tip-safe">{t.care}</p>
              {t.action && (
                <>
                  <button class="btn ghost" onClick={() => onCreateTask(t.action.task)}>{t.action.label}</button>
                  <p class="muted">O próximo passo abre um lembrete editável. Escolha seu horário e toque em Salvar; nada é criado automaticamente.</p>
                </>
              )}
              {t.sounds && onGoSounds && <button class="btn ghost" onClick={onGoSounds}>Ouvir sons para descansar</button>}
            </details>
          </li>
        ))}
      </ul>
      <section class="card notice warn" aria-label="Quando buscar ajuda">
        <strong>Quando buscar ajuda</strong>
        <p>{WHEN_HELP}</p>
        <p>{WHEN_HELP_NOTE}</p>
      </section>
      <h2 class="h3s">Sobre estas orientações</h2>
    </section>
  );
}
