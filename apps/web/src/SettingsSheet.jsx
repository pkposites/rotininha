import { useState, useEffect } from 'preact/hooks';
import { syncAvailable, subscribe, login, logout, syncNow } from './lib/sync.js';

const LABEL = {
  idle: 'Sincronizado', syncing: 'Sincronizando…', offline: 'Sem conexão — seus registros estão salvos neste aparelho',
  expired: 'Acesso vencido — você ainda pode ver os registros', 'signed-out': 'Este aparelho não está conectado', off: ''
};

export function SettingsSheet({ onClose, night, setNight }) {
  const [sync, setSync] = useState({ status: 'off' });
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => subscribe(setSync), []);

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
              </form>
            ) : (
              <div class="row">
                <button class="btn" onClick={syncNow}>Sincronizar agora</button>
                <button class="btn ghost" onClick={logout}>Sair deste aparelho</button>
              </div>
            )}
          </>
        )}
        <p class="muted">Seus registros não são usados para publicidade. O Rotininha não substitui a orientação do pediatra.</p>
        <button class="btn ghost" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}
