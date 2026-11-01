import { useState, useEffect } from 'preact/hooks';
import { syncAvailable, subscribe, login, logout, syncNow } from './lib/sync.js';
import { fmtDateTime } from './lib/billing.js';
import { pushState, enablePush, disablePush, sendTestPush } from './lib/push.js';

const LABEL = {
  idle: 'Sincronizado', syncing: 'Sincronizando…', offline: 'Sem conexão — seus registros estão salvos neste aparelho',
  expired: 'Acesso vencido — você ainda pode ver os registros', 'signed-out': 'Este aparelho não está conectado', off: ''
};

export function SettingsSheet({ onClose, night, setNight, account, onBuy, onRenew, onRecover }) {
  const [sync, setSync] = useState({ status: 'off' });
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => subscribe(setSync), []);
  const [push, setPush] = useState('idle');
  const [privacy, setPrivacy] = useState(false);
  const [pushMsg, setPushMsg] = useState('');
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => { pushState().then(setPush); }, [sync.status]);

  const act = async (fn, okMsg) => {
    setPushMsg(''); setPushBusy(true);
    try { const r = await fn(); setPushMsg(typeof okMsg === 'function' ? okMsg(r) : okMsg ?? ''); }
    catch (x) { setPushMsg(x.message); }
    setPush(await pushState()); setPushBusy(false);
  };

  const connect = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await login(code); setCode(''); } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Ajustes">
        <h2>Ajustes</h2>
        <label class="inline"><input type="checkbox" checked={night} onChange={(e) => setNight(e.target.checked)} /> Modo madrugada</label>

        <h3>Sincronização</h3>
        {!syncAvailable && <p class="muted">A sincronização entre aparelhos ainda não está disponível nesta versão. Seus registros ficam salvos neste aparelho.</p>}
        {syncAvailable && (
          <>
            <p role="status" class="muted">{LABEL[sync.status]}{sync.lastSyncAt && sync.status === 'idle' ? ` · ${new Date(sync.lastSyncAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
            {sync.status === 'signed-out' ? (
              <form onSubmit={connect} class="stack">
                <label>Código de acesso
                  <input value={code} onInput={(e) => setCode(e.target.value)} autocomplete="off" autocapitalize="characters" spellcheck={false} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" required />
                </label>
                {err && <p class="err" role="alert">{err}</p>}
                <button class="btn" disabled={busy}>{busy ? 'Conectando…' : 'Conectar'}</button>
                <button type="button" class="link" onClick={onRecover}>Perdi meu código</button>
                <button type="button" class="btn ghost" onClick={onBuy}>Ainda não tenho acesso — comprar</button>
              </form>
            ) : (
              <>
              <div class="row">
                <button class="btn" onClick={syncNow}>Sincronizar agora</button>
                <button class="btn ghost" onClick={logout}>Sair deste aparelho</button>
              </div>
              {account?.validUntil != null && (
                <>
                  <h3>Seu acesso</h3>
                  <p class="muted">{account.state === 'expired' ? 'Venceu em' : 'Válido até'} {fmtDateTime(account.validUntil)}</p>
                  <button class="btn ghost" onClick={onRenew}>Renovar acesso</button>
                </>
              )}
              </>
            )}
          </>
        )}
        {syncAvailable && (
          <>
            <h3>Lembretes no aparelho</h3>
            {push === 'active' && <p role="status" class="muted">Notificações ativadas neste aparelho.</p>}
            {push === 'ios-install' && <p class="muted">No iPhone, os lembretes só funcionam com o Rotininha instalado: toque em Compartilhar → Adicionar à Tela de Início, depois abra o app por lá e volte aqui.</p>}
            {push === 'unsupported' && <p class="muted">Este navegador não oferece notificações. Você ainda pode registrar e consultar tudo; os lembretes ficam visíveis no app.</p>}
            {push === 'denied' && <p class="muted">As notificações estão bloqueadas para o Rotininha. Libere nas configurações do aparelho ou do navegador.</p>}
            {(push === 'idle' || push === 'active') && (
              <label class="inline"><input type="checkbox" checked={privacy} disabled={push === 'active'} onChange={(e) => setPrivacy(e.target.checked)} /> Esconder detalhes na tela de bloqueio</label>
            )}
            <div class="row">
              {push === 'idle' && <button class="btn" disabled={pushBusy} onClick={() => act(() => enablePush(privacy), 'Pronto! Vamos testar?')}>Ativar lembretes neste aparelho</button>}
              {push === 'active' && <button class="btn" disabled={pushBusy} onClick={() => act(sendTestPush, (n) => n ? 'Notificação enviada. Ela deve aparecer em instantes.' : 'Nada foi enviado: ative novamente os lembretes neste aparelho.')}>Enviar notificação de teste</button>}
              {push === 'active' && <button class="btn ghost" disabled={pushBusy} onClick={() => act(disablePush, 'Notificações desativadas neste aparelho.')}>Desativar</button>}
            </div>
            {pushMsg && <p role="status" class="muted">{pushMsg}</p>}
            <p class="muted">Notificações dependem da instalação, da permissão e das configurações do aparelho, e podem atrasar ou não chegar. O Rotininha não garante entrega no minuto exato.</p>
          </>
        )}
        <p class="muted">Seus registros não são usados para publicidade. O Rotininha não substitui a orientação do pediatra.</p>
        <button class="btn ghost" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}
