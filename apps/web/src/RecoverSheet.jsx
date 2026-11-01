import { useState } from 'preact/hooks';
import { requestRecovery, confirmRecovery, validEmail } from './lib/billing.js';

// token != null → confirma o link recebido por e-mail; senão, pede o link.
export function RecoverSheet({ token, onClose }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const ask = async (e) => {
    e.preventDefault(); setErr('');
    if (!validEmail(email)) return setErr('Confira o e-mail.');
    setBusy(true);
    try { await requestRecovery(email.trim()); setSent(true); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const confirm = async () => {
    setErr(''); setBusy(true);
    try { setCode(await confirmRecovery(token)); } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && !code && onClose()}>
      <div class="sheet stack" role="dialog" aria-modal="true" aria-label="Recuperar acesso">
        <h2>Recuperar acesso</h2>
        {code ? (
          <>
            <p>Seu <strong>novo código de acesso</strong> (o anterior deixou de valer). Guarde-o em um lugar seguro:</p>
            <p class="access-code" aria-label="Novo código de acesso">{code}</p>
            <button class="btn" onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); } catch {} }}>{copied ? 'Copiado!' : 'Copiar código'}</button>
            <button class="btn ghost" onClick={onClose}>Já guardei, continuar</button>
          </>
        ) : token ? (
          <>
            <p>Vamos gerar um <strong>novo código de acesso</strong>. O código antigo e os aparelhos conectados antes serão desconectados. Seus registros continuam salvos.</p>
            {err && <p class="err" role="alert">{err}</p>}
            <button class="btn" disabled={busy} onClick={confirm}>{busy ? 'Gerando…' : 'Gerar novo código'}</button>
            <button class="link" onClick={onClose}>Cancelar</button>
          </>
        ) : sent ? (
          <>
            <p role="status">Se houver uma compra com <strong>{email}</strong>, enviamos um link (válido por 30 minutos). Confira também a caixa de spam.</p>
            <button class="btn ghost" onClick={onClose}>Fechar</button>
          </>
        ) : (
          <form class="stack" onSubmit={ask}>
            <p class="muted">Informe o e-mail usado na compra. Enviaremos um link para gerar um novo código de acesso.</p>
            <label>E-mail da compra<input type="email" value={email} onInput={(e) => setEmail(e.target.value)} autocomplete="email" required /></label>
            {err && <p class="err" role="alert">{err}</p>}
            <button class="btn" disabled={busy}>{busy ? 'Enviando…' : 'Enviar link'}</button>
            <button type="button" class="link" onClick={onClose}>Cancelar</button>
          </form>
        )}
      </div>
    </div>
  );
}
