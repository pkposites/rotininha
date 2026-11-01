import { useState, useEffect } from 'preact/hooks';
import { requestRecovery, resetPassword, validEmail, getPlans, maskPhone, validPhone } from './lib/billing.js';

// Sem link: pede o e-mail (só funciona se o servidor consegue enviar e-mails). Com link (#recover=…): cria a nova senha.
// Só o link recebido por e-mail redefine a senha: informar WhatsApp ou e-mail, sozinhos, nunca basta.
export function RecoverSheet({ token, onClose }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pw, setPw] = useState('');
  const [wa, setWa] = useState('');
  const [needsPhone, setNeedsPhone] = useState(false);
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [mailOk, setMailOk] = useState(null); // null = verificando
  useEffect(() => { getPlans().then((p) => setMailOk(!!p?.emailRecovery)).catch(() => setMailOk(false)); }, []);

  const ask = async (e) => {
    e.preventDefault(); setErr('');
    if (!validEmail(email)) return setErr('Confira o e-mail.');
    setBusy(true);
    try { await requestRecovery(email.trim()); setSent(true); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const reset = async (e) => {
    e.preventDefault(); setErr('');
    if (pw.length < 8) return setErr('A senha precisa ter pelo menos 8 caracteres.');
    if (needsPhone && !validPhone(wa)) return setErr('Confira o WhatsApp: DDD + número.');
    setBusy(true);
    try { await resetPassword(token, pw, needsPhone ? wa : null); setPw(''); setDone(true); }
    catch (x) { if (x.needsPhone) setNeedsPhone(true); setErr(x.message); }
    setBusy(false);
  };

  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && !done && !token && onClose()}>
      <div class="sheet stack" role="dialog" aria-modal="true" aria-label="Recuperar acesso">
        <h2>{token ? 'Criar nova senha' : 'Esqueci a senha'}</h2>
        {done ? (
          <>
            <p role="status"><strong>Pronto!</strong> Sua nova senha já está valendo e este aparelho está conectado. <strong>Seus registros continuam aqui</strong>: nada foi apagado.</p>
            <p class="muted">Os outros aparelhos foram desconectados por segurança. Entre neles com o WhatsApp e a nova senha.</p>
            <button class="btn" onClick={onClose}>Continuar</button>
          </>
        ) : token ? (
          <form class="stack" onSubmit={reset} noValidate>
            <p>Você abriu o link de recuperação. Crie uma nova senha para a sua conta. <strong>Seus registros não são apagados.</strong></p>
            {needsPhone && <label class="field">WhatsApp da conta<input type="tel" inputMode="tel" value={wa} onInput={(e) => setWa(maskPhone(e.target.value))} autocomplete="tel" placeholder="(11) 91234-5678" /></label>}
            <label class="field">Nova senha
              <span class="pw-row">
                <input type={show ? 'text' : 'password'} value={pw} onInput={(e) => setPw(e.target.value)} autocomplete="new-password" placeholder="mínimo 8 caracteres" />
                <button type="button" class="link" onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Ocultar' : 'Mostrar'}</button>
              </span>
            </label>
            {err && <p class="err" role="alert">{err}</p>}
            <button class="btn" disabled={busy}>{busy ? 'Salvando…' : 'Salvar nova senha'}</button>
            <button type="button" class="link" onClick={onClose}>Cancelar</button>
          </form>
        ) : sent ? (
          <>
            <p role="status">Se houver uma conta com <strong>{email}</strong>, enviamos um link (válido por 30 minutos, uso único). Confira também a caixa de spam.</p>
            <p class="muted">Só quem abrir esse link, no e-mail, consegue criar uma nova senha.</p>
            <button class="btn ghost" onClick={onClose}>Fechar</button>
          </>
        ) : mailOk === false ? (
          <div class="stack">
            <p><strong>A recuperação por e-mail ainda não está disponível.</strong> O envio de e-mails do Ninhora ainda não foi configurado no servidor, então nenhum link seria entregue.</p>
            <p><strong>Se você ainda está conectada em algum aparelho</strong> (por exemplo, o celular que usa no dia a dia), abra Ajustes → “Alterar senha de acesso”: dá para trocar a senha por lá, sem perder nada.</p>
            <p class="muted">Se não houver nenhum aparelho conectado, ainda não conseguimos recuperar a conta automaticamente. Por isso, guarde a sua senha em um lugar seguro.</p>
            <button class="btn ghost" onClick={onClose}>Entendi</button>
          </div>
        ) : (
          <form class="stack" onSubmit={ask} noValidate>
            <p class="muted">Informe o e-mail cadastrado na conta. Enviaremos um link para você criar uma nova senha; só quem abrir esse link consegue. Seus registros ficam como estão.</p>
            <label class="field">E-mail da conta<input type="email" value={email} onInput={(e) => setEmail(e.target.value)} autocomplete="email" /></label>
            {err && <p class="err" role="alert">{err}</p>}
            <button class="btn" disabled={busy}>{busy ? 'Enviando…' : 'Enviar link'}</button>
            <p class="muted">Não cadastrou e-mail na conta? Aí o link não tem para onde ir. Veja como proceder em Ajustes → “Alterar senha de acesso”, se ainda estiver conectada em algum aparelho.</p>
            <button type="button" class="link" onClick={onClose}>Cancelar</button>
          </form>
        )}
      </div>
    </div>
  );
}
