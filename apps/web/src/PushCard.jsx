import { useState, useEffect } from 'preact/hooks';
import { pushState, enablePush } from './lib/push.js';
import { getPref, setPref } from './lib/prefs.js';
import { count } from './lib/usage.js';
import { DAY } from './lib/nudge.js';

const SNOOZE = [2, 4, 7]; // dias entre um convite e o próximo; depois de 3 "agora não", só volta a cada 7 dias

// Cartão discreto na tela Hoje: convida a ligar as notificações (o recurso que mais faz a pessoa voltar).
export function PushCard({ connected, hasContent, blocked, onInstall }) {
  const [st, setSt] = useState(null);       // idle | ios-install | denied | null (não mostrar)
  const [help, setHelp] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { (async () => {
    if (!connected || !hasContent || blocked) return setSt(null);
    const s = await pushState();
    if (!['idle', 'ios-install', 'denied'].includes(s)) return setSt(null);
    const nextAt = await getPref('pushCardNextAt', null);
    if (nextAt != null && Date.now() < nextAt) return setSt(null);
    setSt(s);
    count(s === 'denied' ? 'push_denied_seen' : s === 'ios-install' ? 'push_ios_install_hint' : 'push_card_shown');
  })(); }, [connected, hasContent, blocked]);
  if (!st) return msg ? <p class="muted" role="status">{msg}</p> : null;
  const later = async () => { const n = (await getPref('pushCardDismissals', 0)) + 1; await setPref('pushCardDismissals', n); await setPref('pushCardNextAt', Date.now() + SNOOZE[Math.min(n - 1, SNOOZE.length - 1)] * DAY); if (st === 'idle') count('push_prompt_later'); setSt(null); };
  const on = async () => {
    setBusy(true);
    try { await enablePush(false); setSt(null); setMsg('Pronto! Os lembretes vão chegar neste aparelho 💜'); setTimeout(() => setMsg(''), 5000); }
    catch (e) { setMsg(e.message || 'Não foi possível ativar agora.'); }
    setBusy(false);
  };
  return (
    <section class="card push-card" aria-label="Notificações">
      {st === 'idle' && (<>
        <strong>Não perca a hora dos lembretes 🔔</strong>
        <p class="muted">Ative as notificações e o app avisa no horário, mesmo fechado. Leva um toque.</p>
        <div class="row"><button class="btn" disabled={busy} onClick={on}>Ativar agora</button><button class="link" onClick={later}>Agora não</button></div></>)}
      {st === 'ios-install' && (<>
        <strong>No iPhone, instale para receber avisos 📲</strong>
        <p class="muted">O iPhone só entrega notificações a apps na Tela de Início. Leva menos de um minuto.</p>
        <div class="row"><button class="btn" onClick={onInstall}>Como instalar</button><button class="link" onClick={later}>Depois</button></div></>)}
      {st === 'denied' && (<>
        <strong>As notificações estão bloqueadas 🔕</strong>
        <p class="muted">Sem elas o aviso não chega na hora. Dá para liberar nas configurações do aparelho.</p>
        {help && <ol class="muted push-help"><li><b>iPhone:</b> Ajustes → Notificações → Ninhora → Permitir notificações.</li><li><b>Android:</b> segure o ícone do app → Informações → Notificações → Permitir (ou, no Chrome, toque no cadeado ao lado do endereço → Notificações).</li><li>Depois volte aqui e toque em “Ativar agora”.</li></ol>}
        <div class="row"><button class="btn" onClick={() => setHelp(!help)}>{help ? 'Fechar' : 'Como liberar'}</button><button class="link" onClick={later}>Depois</button></div></>)}
      {msg && <p class="muted" role="alert">{msg}</p>}
    </section>
  );
}
