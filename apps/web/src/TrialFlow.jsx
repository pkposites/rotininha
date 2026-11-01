import { useState, useEffect } from 'preact/hooks';
import { startTrial } from './lib/trial.js';
import { getPlans, validEmail, fmtDateTime } from './lib/billing.js';

// Teste grátis: explica com clareza o que acontece depois, pede e-mail só se quiser, e mostra o código UMA vez.
export function TrialFlow({ onDone, onSkip, compact }) {
  const [plans, setPlans] = useState(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { getPlans().then(setPlans).catch(() => {}); }, []);

  const t = plans?.trial, days = t?.days ?? 3;
  const planned = t && (t.active || t.enforceFrom);
  const start = async (e) => {
    e.preventDefault(); setErr('');
    if (email && !validEmail(email)) return setErr('Confira o e-mail ou deixe em branco.');
    setBusy(true);
    try { setRes(await startTrial(email)); } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  if (res) return (
    <div class="stack">
      <h2>Seu teste começou 💜</h2>
      <p>Este é o seu <strong>código de acesso</strong>. Ele aparece <strong>só agora</strong>: guarde para usar em outro aparelho ou se precisar entrar de novo.</p>
      <p class="access-code" aria-label="Código de acesso">{res.code}</p>
      <button class="btn ghost" onClick={async () => { try { await navigator.clipboard.writeText(res.code); setCopied(true); } catch {} }}>{copied ? 'Copiado!' : 'Copiar código'}</button>
      {res.enforced && <p class="muted">Seu teste vai até {fmtDateTime(res.trialEndsAt)}.</p>}
      <p class="muted">{email ? 'Se perder o código, é só pedir um novo com o e-mail que você informou.' : 'Sem e-mail cadastrado não conseguimos recuperar o código: anote em um lugar seguro. Dá para cadastrar um e-mail em Ajustes.'}</p>
      <button class="btn" onClick={onDone}>Já guardei, continuar</button>
    </div>
  );

  return (
    <form class="stack" onSubmit={start}>
      {!compact && <h2>Teste grátis de {days} dias</h2>}
      <p>{planned
        ? <>Use o Ninhora grátis por <strong>{days} dias</strong>. Depois, para continuar, o acesso vitalício custa <strong>R$ 37,90</strong>, em pagamento único via Pix — sem assinatura e sem cobrança automática. <strong>Avisamos antes</strong> de o teste terminar.</>
        : <>Use o Ninhora <strong>grátis</strong> agora. Quando passarmos a cobrar, <strong>avisamos com antecedência</strong> e você terá {days} dias de teste antes de qualquer pagamento.</>}</p>
      <ul class="bullets"><li>Todos os recursos liberados</li><li>Sem cartão e sem cobrança automática</li><li>Notificações para você não esquecer nada</li></ul>
      <label class="field">E-mail (opcional)
        <input type="email" value={email} onInput={(e) => setEmail(e.target.value)} autocomplete="email" placeholder="para recuperar o acesso" />
      </label>
      <p class="muted">Usamos o e-mail só para recuperar seu acesso e avisar sobre o teste.</p>
      {err && <p class="err" role="alert">{err}</p>}
      <button class="btn" disabled={busy}>{busy ? 'Preparando…' : `Começar meu teste grátis`}</button>
      {onSkip && <button type="button" class="link" onClick={onSkip}>Agora não</button>}
    </form>
  );
}
