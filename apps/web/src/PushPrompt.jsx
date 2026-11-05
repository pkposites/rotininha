import { useState } from 'preact/hooks';
import { setPref } from './lib/prefs.js';
import { enablePush } from './lib/push.js';
import { DAY } from './lib/nudge.js';

// Primeira abertura do app instalado: um toque e os lembretes passam a chegar (o aparelho exige o toque para liberar).
export function PushPrompt({ onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const later = async () => { await setPref('pushAskNextAt', Date.now() + DAY); onClose(); };
  const go = async () => {
    setBusy(true); setErr('');
    try { await enablePush(false); await setPref('pushAskNextAt', null); setOk(true); setTimeout(onDone, 1800); }
    catch (e) { setErr(e.message || 'Não foi possível ativar agora.'); }
    setBusy(false);
  };
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && later()}>
      <div class="sheet stack" role="dialog" aria-modal="true" aria-label="Ativar lembretes">
        {ok ? (<><h2>Pronto! 💜</h2><p role="status">Os lembretes vão chegar neste aparelho.</p></>) : (<>
        <h2>Quer receber os lembretes? 🔔</h2>
        <p>O app já está na sua tela inicial. Toque abaixo e o aparelho vai pedir permissão: é ela que faz o aviso chegar na hora, mesmo com o app fechado.</p>
        {err && <p class="muted" role="alert">{err}</p>}
        <button class="btn" disabled={busy} onClick={go}>{busy ? 'Ativando…' : 'Ativar lembretes'}</button>
        <button class="link" onClick={later}>Agora não</button></>)}
      </div>
    </div>
  );
}
