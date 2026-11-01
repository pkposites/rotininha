import { useState } from 'preact/hooks';
import { loginPassword } from './lib/sync.js';
import { maskPhone, validPhone } from './lib/billing.js';

// Entrar com WhatsApp + senha (quem já tem cadastro). Usado desde o início do onboarding.
export function LoginForm({ onDone, onBack, onRecover }) {
  const [wa, setWa] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!validPhone(wa)) return setErr('Confira o WhatsApp: DDD + número, por exemplo (11) 91234-5678.');
    if (!pw) return setErr('Digite a sua senha.');
    setBusy(true);
    try { await loginPassword(wa, pw); setPw(''); await onDone(); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <form class="stack" onSubmit={submit} noValidate>
      <label class="field">WhatsApp do cadastro
        <input type="tel" inputMode="tel" value={wa} onInput={(e) => setWa(maskPhone(e.target.value))} autocomplete="tel" placeholder="(11) 91234-5678" />
      </label>
      <label class="field">Senha
        <span class="pw-row">
          <input type={show ? 'text' : 'password'} value={pw} onInput={(e) => setPw(e.target.value)} autocomplete="current-password" />
          <button type="button" class="link" onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Ocultar' : 'Mostrar'}</button>
        </span>
      </label>
      {err && <p class="err" role="alert">{err}</p>}
      <button class="btn" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      {onRecover && <button type="button" class="link" onClick={onRecover}>Esqueci a senha ou perdi o acesso</button>}
      {onBack && <button type="button" class="link" onClick={onBack}>Voltar</button>}
    </form>
  );
}
