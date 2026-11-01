import { useState, useEffect } from 'preact/hooks';
import { startTrial } from './lib/trial.js';
import { getPlans, validEmail, fmtDateTime, maskPhone, validPhone } from './lib/billing.js';
import { trialCopy } from './lib/ux.js';
import { saveProfile } from './lib/profile.js';

// Criar conta: diz com clareza o que é grátis e até quando, pede e-mail só se quiser e mostra o código UMA vez.
export function TrialFlow({ onDone, onSkip, onHaveAccount, compact }) {
  const [plans, setPlans] = useState(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState(null);
  const [phone, setPhone] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [mom, setMom] = useState('');
  const [baby, setBaby] = useState('');
  useEffect(() => { getPlans().then(setPlans).catch(() => {}); }, []);

  const copy = trialCopy(plans?.trial);
  const mailOk = plans?.emailRecovery === true;
  const start = async (e) => {
    e.preventDefault(); setErr('');
    if (!validPhone(phone)) return setErr('Confira o WhatsApp: DDD + número, por exemplo (11) 91234-5678.');
    if (pw.length < 8) return setErr('A senha precisa ter pelo menos 8 caracteres.');
    if (email && !validEmail(email)) return setErr('Confira o e-mail ou deixe em branco.');
    setBusy(true);
    try { setRes(await startTrial({ email, whatsapp: phone, password: pw })); setPw(''); if (mom.trim() || baby.trim()) await saveProfile({ mom, baby }); } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  if (res) return (
    <div class="stack">
      <h2>Conta criada 💜</h2>
      <p>{res.enforced
        ? <>Seu teste grátis vai até <strong>{fmtDateTime(res.trialEndsAt)}</strong>.</>
        : <>Você está no <strong>acesso grátis do lançamento</strong>, sem data para acabar. Avisamos com antecedência antes de qualquer cobrança.</>}</p>
      <div class="card notice info">
        <strong>Como entrar em outro aparelho</strong>
        <p>Use o seu <strong>WhatsApp</strong> ({phone}) e a <strong>senha que você acabou de criar</strong>. Seus registros ficam guardados na conta.</p>
        <p><strong>Anote a senha</strong> em um lugar seguro: por enquanto não conseguimos recuperá-la automaticamente.</p>
      </div>
      <p class="muted">Os registros que você já fez neste aparelho foram enviados para a conta e continuam aqui.</p>
      <button class="btn" onClick={onDone}>Entendi, continuar</button>
    </div>
  );

  return (
    <form class="stack" onSubmit={start} noValidate>
      {!compact && <h2>Criar conta grátis</h2>}
      <p class="lead-short">Crie sua conta para <strong>guardar seus registros</strong> e abri-los em qualquer aparelho. É grátis.</p>
      <label class="field">WhatsApp
        <input type="tel" inputMode="tel" value={phone} onInput={(e) => setPhone(maskPhone(e.target.value))} autocomplete="tel" placeholder="(11) 91234-5678" required />
      </label>
      <label class="field">Crie uma senha
        <span class="pw-row">
          <input type={showPw ? 'text' : 'password'} value={pw} onInput={(e) => setPw(e.target.value)} autocomplete="new-password" minLength={8} placeholder="mínimo 8 caracteres" required />
          <button type="button" class="link" onClick={() => setShowPw(!showPw)} aria-pressed={showPw}>{showPw ? 'Ocultar' : 'Mostrar'}</button>
        </span>
      </label>
      <p class="muted"><strong>Para que usamos:</strong> o WhatsApp e a senha servem só para você entrar e para guardar os dados de uso do app (registros e lembretes). Não usamos para publicidade e não enviamos mensagens sem você pedir.</p>
      {err && <p class="err" role="alert">{err}</p>}
      <button class="btn" disabled={busy}>{busy ? 'Criando…' : 'Criar conta e continuar'}</button>
      <details class="fold">
        <summary>Personalizar e e-mail (opcional)</summary>
        <div class="stack">
          <label class="field">Seu nome
            <input value={mom} onInput={(e) => setMom(e.target.value)} maxLength={30} autocomplete="given-name" placeholder="como você gosta de ser chamada" />
          </label>
          <label class="field">Nome do bebê
            <input value={baby} onInput={(e) => setBaby(e.target.value)} maxLength={30} autocomplete="off" placeholder="para deixar o app com a cara dele(a)" />
          </label>
          <p class="muted">Os nomes servem só para personalizar o app e <strong>ficam apenas neste aparelho</strong>: não enviamos ao servidor.</p>
          <label class="field">E-mail
            <input type="email" value={email} onInput={(e) => setEmail(e.target.value)} autocomplete="email" placeholder="seu@email.com" />
          </label>
          <p class="muted">{mailOk ? 'Usamos o e-mail para avisar sobre o fim do acesso grátis e, quando a recuperação estiver ativa, ajudar se você esquecer a senha.' : 'Usamos o e-mail para avisar sobre o fim do acesso grátis. A recuperação por e-mail ainda não está ativa: anote bem a sua senha.'}</p>
        </div>
      </details>
      <details class="fold">
        <summary>Sobre o acesso grátis</summary>
        <p>{copy.lead}</p>
      </details>
      {onHaveAccount && <button type="button" class="btn ghost" onClick={onHaveAccount}>Já tenho cadastro</button>}
      {onSkip && <button type="button" class="link" onClick={onSkip}>Agora não — usar sem conta</button>}
    </form>
  );
}
