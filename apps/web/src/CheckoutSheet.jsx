import { useState, useEffect, useRef } from 'preact/hooks';
import {
  brl, maskCpf, validCpf, validEmail, fmtDateTime, getPlans, startCheckout, checkStatus,
  claimAccess, clearCheckout, getAccount
} from './lib/billing.js';
import { SUPPLIER } from './config.js';

const copy = async (text) => {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
};

export function CheckoutSheet({ renewal, resume, onClose, onDone }) {
  const [step, setStep] = useState(resume ? 'pix' : 'form'); // form | pix | claiming | code | renewed
  const [plans, setPlans] = useState(null);
  const [plan, setPlan] = useState(renewal ? '30d' : '7d');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pix, setPix] = useState(null);       // dados do Pix em andamento
  const [ctl, setCtl] = useState(resume ?? null); // { paymentId, pollToken }
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState('');
  const [until, setUntil] = useState(null);
  const [now, setNow] = useState(Date.now());
  const stopped = useRef(false);

  useEffect(() => { getPlans().then(setPlans).catch(() => {}); return () => { stopped.current = true; }; }, []);
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);

  // Acompanha o pagamento (a cada 4 s). O servidor também confirma direto no Mercado Pago.
  useEffect(() => {
    if (step !== 'pix' || !ctl) return;
    let alive = true;
    const tick = async () => {
      try {
        const st = await checkStatus(ctl);
        if (!alive || stopped.current) return;
        if (!st) { setErr('Não encontramos este pagamento.'); setStep('form'); return; }
        setPix((p) => ({ ...(p ?? {}), ...st }));
        if (st.status === 'approved') {
          if (renewal || st.kind === 'renewal') {
            const acc = await getAccount();
            setUntil(acc?.validUntil ?? null); await clearCheckout(); setStep('renewed'); onDone?.();
          } else if (st.canClaim) { setStep('claiming'); }
          else { setErr('O pagamento foi confirmado, mas o código já foi entregue. Use "Perdi meu código".'); }
        } else if (st.status === 'failed' || st.status === 'mismatch') {
          setErr(st.status === 'mismatch' ? 'O valor recebido não confere. Fale com o suporte, informando o nº do pagamento.' : 'O pagamento não foi concluído. Você pode gerar um novo Pix.');
          await clearCheckout(); setStep('form');
        }
      } catch { /* sem rede: tenta de novo */ }
    };
    tick();
    const i = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(i); };
  }, [step, ctl]);

  useEffect(() => {
    if (step !== 'claiming') return;
    (async () => {
      try { setCode(await claimAccess(ctl)); setStep('code'); onDone?.(); }
      catch (e) { setErr(e.message); setStep('form'); }
    })();
  }, [step]);

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!renewal && !validEmail(email)) return setErr('Confira o e-mail.');
    if (!validCpf(cpf)) return setErr('Confira o CPF.');
    setBusy(true);
    try {
      const r = await startCheckout({ email, cpf, plan, renewal });
      setCpf(''); // não mantém o CPF em memória depois de enviar
      setPix(r); setCtl({ paymentId: r.paymentId, pollToken: r.pollToken }); setStep('pix');
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  const list = plans ? (renewal ? plans.renewal : plans.entry) : [];
  const chosen = list.find((p) => p.id === plan) ?? list[0];
  const secs = pix?.expiresAt ? Math.max(0, Math.floor((pix.expiresAt - now) / 1000)) : null;
  const flash = async (key, text) => { if (await copy(text)) { setCopied(key); setTimeout(() => setCopied(''), 2000); } };

  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && step !== 'code' && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={renewal ? 'Renovar acesso' : 'Comprar acesso'}>
        {step === 'form' && (
          <form class="stack" onSubmit={submit}>
            <h2>{renewal ? 'Renovar acesso' : 'Seu acesso ao Rotininha'}</h2>
            {renewal && list.length > 0 && (
              <div class="chips" role="radiogroup" aria-label="Período">
                {list.map((p) => <button type="button" role="radio" aria-checked={plan === p.id} class="chip" aria-pressed={plan === p.id} onClick={() => setPlan(p.id)}>{p.label} · {brl(p.cents)}</button>)}
              </div>
            )}
            {!renewal && chosen && <p><strong>{chosen.label} de acesso por {brl(chosen.cents)}</strong></p>}
            <p class="muted">Acesso por {chosen?.label ?? '…'}. Renovação opcional, feita manualmente por Pix. <strong>Não é assinatura</strong> e não há cobrança automática.</p>
            <label>E-mail{renewal && ' (opcional)'}
              <input type="email" value={email} onInput={(e) => setEmail(e.target.value)} autocomplete="email" required={!renewal} />
            </label>
            <label>CPF do pagador
              <input inputMode="numeric" value={cpf} onInput={(e) => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" autocomplete="off" required />
            </label>
            <p class="muted">O Pix exige e-mail e CPF de quem paga. Usamos o e-mail para o comprovante e para recuperar seu acesso; o CPF é enviado ao Mercado Pago e <strong>não fica guardado</strong> no Rotininha.</p>
            {err && <p class="err" role="alert">{err}</p>}
            <button class="btn" disabled={busy || !plans}>{busy ? 'Gerando Pix…' : `Gerar Pix${chosen ? ' de ' + brl(chosen.cents) : ''}`}</button>
            <p class="muted">Direito de arrependimento: em até 7 dias da compra você pode pedir reembolso, sem justificativa{SUPPLIER.email ? ` (${SUPPLIER.email})` : ''}.</p>
            {(SUPPLIER.name || SUPPLIER.cnpj) && <p class="muted">{SUPPLIER.name} {SUPPLIER.cnpj && `· CNPJ ${SUPPLIER.cnpj}`}</p>}
            <p class="muted">O Rotininha ajuda a organizar os cuidados e não substitui a orientação do pediatra.</p>
            <button type="button" class="link" onClick={onClose}>Agora não</button>
          </form>
        )}

        {step === 'pix' && (
          <div class="stack">
            <h2>Pague com Pix</h2>
            {pix?.amountCents != null && <p><strong>{brl(pix.amountCents)}</strong></p>}
            {pix?.qrBase64 && <img class="qr" alt="QR Code do Pix" src={`data:image/png;base64,${pix.qrBase64}`} width="220" height="220" />}
            {pix?.qrCode && (
              <>
                <label>Pix copia e cola<textarea readOnly rows="3" value={pix.qrCode} onFocus={(e) => e.target.select()} /></label>
                <button class="btn" onClick={() => flash('pix', pix.qrCode)}>{copied === 'pix' ? 'Copiado!' : 'Copiar código Pix'}</button>
              </>
            )}
            <p role="status" class="muted">
              {pix?.expired ? 'Este Pix expirou. Gere um novo.' : 'Aguardando o pagamento… Assim que o banco confirmar, liberamos seu acesso aqui.'}
              {secs != null && !pix?.expired && secs > 0 && ` Expira em ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}.`}
            </p>
            {err && <p class="err" role="alert">{err}</p>}
            <div class="row">
              {pix?.expired && <button class="btn" onClick={async () => { await clearCheckout(); setPix(null); setCtl(null); setStep('form'); }}>Gerar novo Pix</button>}
              <button class="btn ghost" onClick={onClose}>Fechar (continuo acompanhando)</button>
            </div>
          </div>
        )}

        {step === 'claiming' && <div class="stack"><h2>Pagamento confirmado ✓</h2><p role="status" class="muted">Preparando seu acesso…</p></div>}

        {step === 'code' && (
          <div class="stack">
            <h2>Tudo certo! 💜</h2>
            <p>Este é o seu <strong>código de acesso</strong>. Ele aparece <strong>só agora</strong>: guarde em um lugar seguro.</p>
            <p class="access-code" aria-label="Código de acesso">{code}</p>
            <button class="btn" onClick={() => flash('code', code)}>{copied === 'code' ? 'Copiado!' : 'Copiar código'}</button>
            <p class="muted">Este aparelho já está conectado. Para usar em outro aparelho, use o código em Ajustes → Conectar. Se perder, use "Perdi meu código" com o e-mail da compra. Enviamos o comprovante por e-mail (sem o código).</p>
            <button class="btn ghost" onClick={onClose}>Já guardei, continuar</button>
          </div>
        )}

        {step === 'renewed' && (
          <div class="stack">
            <h2>Acesso renovado ✓</h2>
            <p>{until ? `Seu acesso vale até ${fmtDateTime(until)}.` : 'Seu acesso foi renovado.'}</p>
            <button class="btn" onClick={onClose}>Continuar</button>
          </div>
        )}
      </div>
    </div>
  );
}
