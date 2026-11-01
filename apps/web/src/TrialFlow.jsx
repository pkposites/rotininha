import { useState, useEffect } from 'preact/hooks';
import { startTrial } from './lib/trial.js';
import { getPlans, validEmail, fmtDateTime, maskPhone, validPhone } from './lib/billing.js';
import { trialCopy } from './lib/ux.js';

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
  useEffect(() => { getPlans().then(setPlans).catch(() => {}); }, []);

  const copy = trialCopy(plans?.trial);
  const mailOk = plans?.emailRecovery === true;
  const start = async (e) => {
    e.preventDefault(); setErr('');
    if (!validPhone(phone)) return setErr('Confira o WhatsApp: DDD + número, por exemplo (11) 91234-5678.');
    if (pw.length < 8) return setErr('A senha precisa ter pelo menos 8 caracteres.');
    if (email && !validEmail(email)) return setErr('Confira o e-mail ou deixe em branco.');
    setBusy(true);
    try { setRes(await startTrial({ email, whatsapp: phone, password: pw })); setPw(''); } catch (x) { setErr(x.message); }
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
      {!compact && <h2>{copy.title}</h2>}
      {compact && <p><strong>{copy.title}</strong></p>}
      <p>{copy.lead}</p>
      <ul class="bullets"><li>Todos os recursos liberados</li><li>Você pode usar o app agora, sem conta</li><li>A conta guarda seus registros e permite abri-los em outro aparelho</li></ul>
      <label class="field">WhatsApp
        <input type="tel" inputMode="tel" value={phone} onInput={(e) => setPhone(maskPhone(e.target.value))} autocomplete="tel" placeholder="(11) 91234-5678" required />
      </label>
      <label class="field">Crie uma senha de acesso
        <span class="pw-row">
          <input type={showPw ? 'text' : 'password'} value={pw} onInput={(e) => setPw(e.target.value)} autocomplete="new-password" minLength={8} placeholder="mínimo 8 caracteres" required />
          <button type="button" class="link" onClick={() => setShowPw(!showPw)} aria-pressed={showPw}>{showPw ? 'Ocultar' : 'Mostrar'}</button>
        </span>
      </label>
      <p class="muted">Com o WhatsApp e a senha você abre seus registros em qualquer aparelho e não perde seus dados. Não enviamos mensagens para o seu WhatsApp sem você pedir.</p>
      <label class="field">E-mail (opcional)
        <input type="email" value={email} onInput={(e) => setEmail(e.target.value)} autocomplete="email" placeholder="seu@email.com" />
      </label>
      <p class="muted">{mailOk ? 'Usamos o e-mail para avisar sobre o fim do acesso grátis e, quando a recuperação estiver ativa, ajudar se você esquecer a senha.' : 'Usamos o e-mail para avisar sobre o fim do acesso grátis. A recuperação por e-mail ainda não está ativa: anote bem a sua senha.'}</p>
      {err && <p class="err" role="alert">{err}</p>}
      <button class="btn" disabled={busy}>{busy ? 'Criando…' : 'Criar minha conta grátis'}</button>
      {onHaveAccount && <button type="button" class="link" onClick={onHaveAccount}>Já tenho conta</button>}
      {onSkip && <button type="button" class="link" onClick={onSkip}>Agora não — usar sem conta</button>}
    </form>
  );
}
