import { useState, useEffect } from 'preact/hooks';
import { setPref } from './lib/prefs.js';
import { enablePush } from './lib/push.js';
import { DAY } from './lib/nudge.js';
import { count } from './lib/usage.js';

// Pede os lembretes com 1 toque (o aparelho exige o toque para liberar). `reason`: 'open' (app instalado aberto) ou 'task' (acabou de criar um lembrete).
export function PushPrompt({ reason = 'open', onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  useEffect(() => { count('push_prompt_shown'); }, []);
  const later = async () => { count('push_prompt_later'); await setPref('pushAskNextAt', Date.now() + (reason === 'task' ? 3 : 1) * DAY); onClose(); };
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
        <h2>{reason === 'task' ? 'Quer ser avisada na hora? 🔔' : 'Quer receber os lembretes? 🔔'}</h2>
        <p>{reason === 'task' ? 'Seu lembrete está salvo. Para o aviso tocar no horário, mesmo com o app fechado, toque abaixo e aceite a permissão do aparelho.' : 'Toque abaixo e o aparelho vai pedir permissão: é ela que faz o aviso chegar na hora, mesmo com o app fechado.'}</p>
        {err && <p class="muted" role="alert">{err}</p>}
        <button class="btn" disabled={busy} onClick={go}>{busy ? 'Ativando…' : 'Ativar lembretes'}</button>
        <button class="link" onClick={later}>Agora não</button></>)}
      </div>
    </div>
  );
}
