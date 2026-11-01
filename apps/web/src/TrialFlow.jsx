import { useState, useEffect } from 'preact/hooks';
import { startTrial } from './lib/trial.js';
import { getPlans, validEmail, fmtDateTime } from './lib/billing.js';
import { trialCopy } from './lib/ux.js';

// Criar conta: diz com clareza o que é grátis e até quando, pede e-mail só se quiser e mostra o código UMA vez.
export function TrialFlow({ onDone, onSkip, compact }) {
  const [plans, setPlans] = useState(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { getPlans().then(setPlans).catch(() => {}); }, []);

  const copy = trialCopy(plans?.trial);
  const mailOk = plans?.emailRecovery === true;
  const start = async (e) => {
    e.preventDefault(); setErr('');
    if (email && !validEmail(email)) return setErr('Confira o e-mail ou deixe em branco.');
    setBusy(true);
    try { setRes(await startTrial(email)); } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  if (res) return (
    <div class="stack">
      <h2>Conta criada 💜</h2>
      <p>{res.enforced
        ? <>Seu teste grátis vai até <strong>{fmtDateTime(res.trialEndsAt)}</strong>.</>
        : <>Você está no <strong>acesso grátis do lançamento</strong>, sem data para acabar. Avisamos com antecedência antes de qualquer cobrança.</>}</p>
      <div class="card notice info">
        <strong>Guarde este código</strong>
        <p>É a chave da sua conta. Ele aparece <strong>só agora</strong>. Você vai precisar dele para abrir seus registros em outro aparelho ou depois de sair.</p>
        <p class="access-code" aria-label="Código de acesso">{res.code}</p>
        <button class="btn" onClick={async () => { try { await navigator.clipboard.writeText(res.code); setCopied(true); } catch { setCopied('erro'); } }}>{copied === true ? '✓ Copiado' : 'Copiar código'}</button>
        <p role="status" class="muted">{copied === true ? 'Código copiado. Cole em um lugar seguro, como o gerenciador de senhas ou uma nota só sua.' : copied === 'erro' ? 'Não foi possível copiar. Selecione o código acima e copie à mão.' : ''}</p>
      </div>
      <p class="muted">{email && mailOk ? 'Se perder o código, peça um novo com o e-mail que você informou.'
        : email ? 'Guardamos seu e-mail, mas a recuperação por e-mail ainda não está ativa. Por isso, guarde o código.'
        : 'Sem o código, não dá para entrar de novo em outro aparelho.'}</p>
      <p class="muted">Os registros que você já fez neste aparelho foram enviados para a conta e continuam aqui.</p>
      <button class="btn" onClick={onDone}>Já guardei, continuar</button>
    </div>
  );

  return (
    <form class="stack" onSubmit={start}>
      {!compact && <h2>{copy.title}</h2>}
      {compact && <p><strong>{copy.title}</strong></p>}
      <p>{copy.lead}</p>
      <ul class="bullets"><li>Todos os recursos liberados</li><li>Você pode usar o app agora, sem conta</li><li>A conta guarda seus registros e permite abri-los em outro aparelho</li></ul>
      <label class="field">E-mail (opcional)
        <input type="email" value={email} onInput={(e) => setEmail(e.target.value)} autocomplete="email" placeholder="seu@email.com" />
      </label>
      <p class="muted">{mailOk ? 'Usamos o e-mail para recuperar seu acesso e avisar sobre o fim do acesso grátis.' : 'Usamos o e-mail para avisar sobre o fim do acesso grátis. A recuperação de acesso por e-mail ainda não está ativa: guarde o código.'}</p>
      {err && <p class="err" role="alert">{err}</p>}
      <button class="btn" disabled={busy}>{busy ? 'Criando…' : 'Criar minha conta grátis'}</button>
      {onSkip && <button type="button" class="link" onClick={onSkip}>Agora não — usar sem conta</button>}
    </form>
  );
}
