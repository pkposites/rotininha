import { useState } from 'preact/hooks';
import { FEEDBACK_CATEGORIES } from './lib/feedback.js';
import { authedCall } from './lib/sync.js';
import { setPref } from './lib/prefs.js';

export function FeedbackSheet({ onClose, onSent }) {
  const [cat, setCat] = useState(null);
  const [text, setText] = useState('');
  const [state, setState] = useState('form'); // form | sending | thanks
  const [err, setErr] = useState('');

  const send = async (e) => {
    e.preventDefault(); setErr('');
    if (!cat && !text.trim()) return setErr('Escolha um tema ou escreva sua ideia.');
    setState('sending');
    try {
      const r = await authedCall('/v1/feedback', { category: cat ?? 'outros', text: text.trim() });
      if (r.status === 201) { await setPref('feedbackSubmittedAt', Date.now()); setState('thanks'); onSent?.(); return; }
      setErr(r.status === 429 ? 'Você já enviou algumas ideias hoje. Obrigada! Tente de novo amanhã.' : 'Não foi possível enviar agora. Tente novamente.');
    } catch (x) {
      setErr(x.message === 'not-connected' ? 'Conecte este aparelho com o seu código (Ajustes) para enviar sugestões.' : 'Sem conexão agora. Tente novamente.');
    }
    setState('form');
  };

  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Enviar sugestão">
        {state === 'thanks' ? (
          <div class="stack">
            <h2>Obrigada! 💜</h2>
            <p role="status">Sua ideia ajuda a melhorar o Ninhora.</p>
            <button class="btn" onClick={onClose}>Fechar</button>
          </div>
        ) : (
          <form class="stack" onSubmit={send}>
            <h2>O que deixaria sua rotina mais leve?</h2>
            <div class="chips" role="group" aria-label="Tema (opcional)">
              {FEEDBACK_CATEGORIES.map(([k, l]) => <button type="button" class="chip" aria-pressed={cat === k} onClick={() => setCat(cat === k ? null : k)}>{l}</button>)}
            </div>
            <label>Conte para a gente (opcional)
              <textarea rows="4" maxLength="500" value={text} onInput={(e) => setText(e.target.value)} />
            </label>
            <p class="muted" aria-live="polite">{text.length}/500 · <strong>Não envie nomes, informações médicas ou dados pessoais do bebê.</strong></p>
            {err && <p class="err" role="alert">{err}</p>}
            <button class="btn" disabled={state === 'sending'}>{state === 'sending' ? 'Enviando…' : 'Enviar sugestão'}</button>
            <button type="button" class="link" onClick={onClose}>Agora não</button>
          </form>
        )}
      </div>
    </div>
  );
}

export function FeedbackCard({ onOpen, onDismiss }) {
  return (
    <section class="card feedback-card" aria-label="Sugestões">
      <p><strong>Mamãe, o que deixaria sua rotina mais leve? 💜</strong></p>
      <p class="muted">Conta para a gente o que você gostaria de ter no Ninhora.</p>
      <div class="row">
        <button class="btn" onClick={onOpen}>Dar uma sugestão</button>
        <button class="btn ghost" onClick={onDismiss}>Agora não</button>
      </div>
    </section>
  );
}
