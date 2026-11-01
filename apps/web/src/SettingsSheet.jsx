import { useState, useEffect } from 'preact/hooks';
import { syncAvailable, subscribe, login, loginPassword, logout, syncNow } from './lib/sync.js';
import { fmtDateTime, maskPhone, validPhone } from './lib/billing.js';
import { downloadMyData, deleteEverything } from './lib/privacy.js';
import { setAccountPrefs, setPassword } from './lib/trial.js';
import { getProfile, saveProfile } from './lib/profile.js';
import { getPlans } from './lib/billing.js';
import { ShareIcon } from './icons.jsx';
import { shareApp, copyShareLink, canNativeShare, shareUrl } from './lib/share.js';
import { pushState, enablePush, disablePush, sendTestPush } from './lib/push.js';

const LABEL = {
  idle: 'Sincronizado', syncing: 'Sincronizando…', offline: 'Sem conexão — seus registros estão salvos neste aparelho',
  expired: 'Acesso vencido — você ainda pode ver os registros', 'signed-out': 'Este aparelho não está conectado', off: ''
};

export function SettingsSheet({ onClose, night, setNight, account, onBuy, onRenew, onRecover, onSuggest, onStartTrial, refreshAccount }) {
  const [sync, setSync] = useState({ status: 'off' });
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [wa, setWa] = useState('');
  const [pw, setPw] = useState('');
  const [byCode, setByCode] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [prof, setProf] = useState({ mom: '', baby: '' });
  const [profMsg, setProfMsg] = useState('');
  const [mailOk, setMailOk] = useState(false);   // o servidor consegue enviar e-mails de recuperação?
  const [shareMsg, setShareMsg] = useState('');
  const [shareFallback, setShareFallback] = useState(false);
  useEffect(() => { getPlans().then((p) => setMailOk(!!p?.emailRecovery)).catch(() => {}); }, []);
  useEffect(() => { getProfile().then(setProf); }, []);
  useEffect(() => subscribe(setSync), []);
  const [push, setPush] = useState('idle');
  const [privacy, setPrivacy] = useState(false);
  const [pushMsg, setPushMsg] = useState('');
  const [pushBusy, setPushBusy] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [dataMsg, setDataMsg] = useState('');
  const [email, setEmail] = useState('');
  const [prefMsg, setPrefMsg] = useState('');
  const savePref = async (patch, okMsg) => { setPrefMsg(''); try { await setAccountPrefs(patch); await refreshAccount?.(); setPrefMsg(okMsg ?? 'Salvo.'); } catch (x) { setPrefMsg(x.message); } };
  useEffect(() => { pushState().then(setPush); }, [sync.status]);

  const act = async (fn, okMsg) => {
    setPushMsg(''); setPushBusy(true);
    try { const r = await fn(); setPushMsg(typeof okMsg === 'function' ? okMsg(r) : okMsg ?? ''); }
    catch (x) { setPushMsg(x.message); }
    setPush(await pushState()); setPushBusy(false);
  };

  const connectPw = async (e) => {
    e.preventDefault(); setErr('');
    if (!validPhone(wa)) return setErr('Confira o WhatsApp: DDD + número, por exemplo (11) 91234-5678.');
    setBusy(true);
    try { await loginPassword(wa, pw); setPw(''); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const savePw = async (e) => {
    e.preventDefault(); setPwMsg('');
    if (!validPhone(wa)) return setPwMsg('Confira o WhatsApp: DDD + número.');
    if (pw.length < 8) return setPwMsg('A senha precisa ter pelo menos 8 caracteres.');
    try { await setPassword(wa, pw); setPw(''); await refreshAccount?.(); setPwMsg('Pronto! Agora você entra em outro aparelho com o WhatsApp e esta senha.'); } catch (x) { setPwMsg(x.message); }
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
        <h3 class="group-title">Aparência</h3>
        <section class="group"><label class="inline"><input type="checkbox" checked={night} onChange={(e) => setNight(e.target.checked)} /> Modo madrugada</label></section>

        <h3 class="group-title">Personalização</h3>
        <section class="group">
          <form class="stack" onSubmit={async (e) => { e.preventDefault(); await saveProfile(prof); setProfMsg('Salvo.'); }}>
            <label>Seu nome<input value={prof.mom} maxLength={30} onInput={(e) => { setProfMsg(''); setProf({ ...prof, mom: e.target.value }); }} autocomplete="given-name" placeholder="como você gosta de ser chamada" /></label>
            <label>Nome do bebê<input value={prof.baby} maxLength={30} onInput={(e) => { setProfMsg(''); setProf({ ...prof, baby: e.target.value }); }} autocomplete="off" placeholder="opcional" /></label>
            <button class="btn ghost">Salvar nomes</button>
            <p role={profMsg ? 'status' : undefined} class="muted">{profMsg || 'Os nomes ficam só neste aparelho; não vão para o servidor.'}</p>
          </form>
        </section>

        <h3 class="group-title">Sincronização</h3>
        <section class="group">
        {syncAvailable && sync.status === 'signed-out' && <p class="notice-inline">Hoje seus registros estão <strong>só neste aparelho</strong>. Com uma conta, eles ficam guardados nela e você pode abri-los em outro aparelho com o WhatsApp e a senha. O que já está aqui é enviado para a conta.</p>}
        {!syncAvailable && <p class="muted">A sincronização entre aparelhos ainda não está disponível nesta versão. Seus registros ficam salvos neste aparelho.</p>}
        {syncAvailable && (
          <>
            <p role="status" class="muted">{LABEL[sync.status]}{sync.lastSyncAt && sync.status === 'idle' ? ` · ${new Date(sync.lastSyncAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
            {sync.status === 'signed-out' ? (
              !byCode ? (
              <form onSubmit={connectPw} class="stack">
                <label>WhatsApp
                  <input type="tel" inputMode="tel" value={wa} onInput={(e) => setWa(maskPhone(e.target.value))} autocomplete="tel" placeholder="(11) 91234-5678" required />
                </label>
                <label>Senha de acesso
                  <input type="password" value={pw} onInput={(e) => setPw(e.target.value)} autocomplete="current-password" required />
                </label>
                {err && <p class="err" role="alert">{err}</p>}
                <button class="btn" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
                <button type="button" class="link" onClick={onRecover}>Esqueci a senha</button>
                <p class="muted">{mailOk ? 'Se esqueceu a senha, enviamos um link para o e-mail cadastrado na conta.' : 'A recuperação por e-mail ainda não está disponível; toque em “Esqueci a senha” para ver as alternativas.'}</p>
                <button type="button" class="link" onClick={() => { setErr(''); setByCode(true); }}>Tenho um código de acesso (conta antiga)</button>
                {onStartTrial && <button type="button" class="btn ghost" onClick={onStartTrial}>Criar conta grátis</button>}
                {onBuy && <button type="button" class="btn ghost" onClick={onBuy}>Ainda não tenho acesso — comprar</button>}
              </form>
              ) : (
              <form onSubmit={connect} class="stack">
                <p class="muted">Código de acesso: só para contas criadas antes do login com WhatsApp e senha.</p>
                <label>Código de acesso
                  <input value={code} onInput={(e) => setCode(e.target.value)} autocomplete="off" autocapitalize="characters" spellcheck={false} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" required />
                </label>
                {err && <p class="err" role="alert">{err}</p>}
                <button class="btn" disabled={busy}>{busy ? 'Conectando…' : 'Conectar'}</button>
                <button type="button" class="link" onClick={() => { setErr(''); setByCode(false); }}>Entrar com WhatsApp e senha</button>
                <button type="button" class="link" onClick={onRecover}>Esqueci a senha</button>
                {onBuy && <button type="button" class="btn ghost" onClick={onBuy}>Ainda não tenho acesso — comprar</button>}
              </form>
              )
            ) : (
              <>
              <div class="row">
                <button class="btn" onClick={syncNow}>Sincronizar agora</button>
                <button class="btn ghost" onClick={logout}>Sair deste aparelho</button>
              </div>
              <p class="muted">Para entrar de novo, ou em outro aparelho, use o WhatsApp e a senha que você criou.</p>
              {account?.prefs && (
                <details class="fold" open={!account.prefs.hasPassword}>
                  <summary>{account.prefs.hasPassword ? 'Alterar senha de acesso' : 'Definir senha de acesso'}</summary>
                  <form class="stack" onSubmit={savePw}>
                    <p class="muted">{account.prefs.hasPassword ? 'Troque o WhatsApp ou a senha usados para entrar.' : 'Com WhatsApp e senha você entra em outro aparelho sem perder seus registros.'}</p>
                    <label>WhatsApp<input type="tel" inputMode="tel" value={wa} onInput={(e) => setWa(maskPhone(e.target.value))} autocomplete="tel" placeholder="(11) 91234-5678" required /></label>
                    <label>Nova senha<input type="password" value={pw} onInput={(e) => setPw(e.target.value)} autocomplete="new-password" minLength={8} required /></label>
                    <button class="btn ghost">Salvar senha</button>
                    {pwMsg && <p role="status" class="muted">{pwMsg}</p>}
                  </form>
                </details>
              )}
              {account?.plan === 'trial' && account.validUntil == null && (
                <>
                  <strong>Seu acesso</strong>
                  <p class="muted">Acesso grátis do lançamento, sem data para acabar. Avisamos com antecedência antes de qualquer cobrança.</p>
                </>
              )}
              {account?.validUntil != null && (
                <>
                  <strong>Seu acesso</strong>
                  {account.plan === 'paid' && account.state === 'active'
                    ? <p class="muted">Acesso vitalício ✓ — obrigada por apoiar o Ninhora.</p>
                    : <>
                        <p class="muted">{account.state === 'trial' ? 'Teste grátis até' : 'Teste encerrado em'} {fmtDateTime(account.validUntil)}</p>
                        {onRenew && <button class="btn ghost" onClick={onRenew}>Garantir acesso vitalício · R$ 37,90</button>}
                      </>}
                </>
              )}
              </>
            )}
          </>
        )}
        </section>
        {syncAvailable && (
          <>
            <h3 class="group-title">Lembretes no aparelho</h3>
            <section class="group">
            {(sync.status === 'signed-out') && (push === 'active' || push === 'idle') && <p class="notice-inline" role="status">Para os lembretes chegarem, este aparelho precisa estar <strong>conectado a uma conta</strong>. Crie a conta ou entre acima; depois ative as notificações aqui.</p>}
            {push === 'active' && sync.status !== 'signed-out' && <p role="status" class="muted">Notificações ativadas neste aparelho.</p>}
            {push === 'ios-install' && <p class="muted">No iPhone, os lembretes só funcionam com o Ninhora instalado: toque em Compartilhar → Adicionar à Tela de Início, depois abra o app por lá e volte aqui.</p>}
            {push === 'unsupported' && <p class="muted">Este navegador não oferece notificações. Você ainda pode registrar e consultar tudo; os lembretes ficam visíveis no app.</p>}
            {push === 'denied' && <p class="muted">As notificações estão bloqueadas para o Ninhora. Libere nas configurações do aparelho ou do navegador.</p>}
            {(push === 'idle' || push === 'active') && (
              <label class="inline"><input type="checkbox" checked={privacy} disabled={push === 'active'} onChange={(e) => setPrivacy(e.target.checked)} /> Esconder detalhes na tela de bloqueio</label>
            )}
            <div class="row">
              {push === 'idle' && <button class="btn" disabled={pushBusy || sync.status === 'signed-out'} onClick={() => act(() => enablePush(privacy), 'Pronto! Vamos testar?')}>Ativar lembretes neste aparelho</button>}
              {push === 'active' && <button class="btn" disabled={pushBusy || sync.status === 'signed-out'} onClick={() => act(sendTestPush, (n) => n ? 'Notificação enviada. Ela deve aparecer em instantes.' : 'Nada foi enviado: ative novamente os lembretes neste aparelho.')}>Enviar notificação de teste</button>}
              {push === 'active' && <button class="btn ghost" disabled={pushBusy} onClick={() => act(disablePush, 'Notificações desativadas neste aparelho.')}>Desativar</button>}
            </div>
            {pushMsg && <p role="status" class="muted">{pushMsg}</p>}
            <p class="muted">Notificações dependem da instalação, da permissão e das configurações do aparelho, e podem atrasar ou não chegar. O Ninhora não garante entrega no minuto exato.</p>
            </section>
          </>
        )}
        {account?.prefs && (
          <>
            <h3 class="group-title">Avisos e privacidade</h3>
            <section class="group">
              <label class="inline"><input type="checkbox" checked={account.prefs.tips} onChange={(e) => savePref({ tips: e.target.checked })} /> Receber dicas e novidades por notificação</label>
              <p class="muted">Os lembretes que você cria continuam chegando. Dicas e novidades têm no máximo 1 aviso por dia e nunca de madrugada.</p>
              <label class="inline"><input type="checkbox" checked={account.prefs.usage} onChange={(e) => savePref({ usage: e.target.checked }, e.target.checked ? 'Obrigada por ajudar!' : 'Pronto: apagamos o histórico de uso.')} /> Ajudar a melhorar o app com estatísticas de uso</label>
              <p class="muted">Contamos só quantas vezes cada recurso é usado. Sem dados do bebê, sem o que você escreve.</p>
              <form class="stack" onSubmit={(e) => { e.preventDefault(); savePref({ contactEmail: email.trim() || null }, email.trim() ? 'E-mail salvo.' : 'E-mail removido.'); }}>
                <label class="field">E-mail para recuperar a senha {account.prefs.hasEmail ? '(já cadastrado)' : '(opcional)'}
                  <input type="email" value={email} onInput={(e) => setEmail(e.target.value)} placeholder={account.prefs.hasEmail ? 'digite para trocar' : 'seu@email.com'} autocomplete="email" />
                </label>
                <button class="btn ghost">Salvar e-mail</button>
                <p class="muted">{mailOk ? 'Se esquecer a senha, enviamos um link para este e-mail; só quem abrir o link cria uma nova senha. Seus registros ficam como estão.' : 'Atenção: o envio de e-mails de recuperação ainda não está ativo. Guardamos o e-mail para quando estiver, mas isso ainda não garante a recuperação: anote a sua senha.'}</p>
              </form>
              {prefMsg && <p role="status" class="muted">{prefMsg}</p>}
            </section>
          </>
        )}
        <h3 class="group-title">Seus dados</h3>
        <section class="group">
        {sync.status !== 'signed-out' && sync.status !== 'off' && <button class="btn ghost" onClick={async () => { setDataMsg(''); try { await downloadMyData(); setDataMsg('Cópia baixada.'); } catch (x) { setDataMsg(x.message); } }}>Baixar meus dados</button>}
        {!confirmWipe
          ? <button class="link-danger" onClick={() => setConfirmWipe(true)}>Apagar meus dados</button>
          : (
            <div class="stack" role="alertdialog" aria-label="Confirmar exclusão">
              <p><strong>Isso apaga todos os seus registros e lembretes{sync.status !== 'signed-out' && sync.status !== 'off' ? ', na nuvem e neste aparelho' : ' deste aparelho'}, e não dá para desfazer.</strong> {sync.status !== 'signed-out' && sync.status !== 'off' ? 'Baixe uma cópia antes, se quiser.' : ''}</p>
              <div class="row">
                <button class="btn danger" onClick={async () => { try { await deleteEverything(); location.replace('/app/'); } catch (x) { setDataMsg(x.message); setConfirmWipe(false); } }}>Sim, apagar tudo</button>
                <button class="btn ghost" onClick={() => setConfirmWipe(false)}>Manter</button>
              </div>
            </div>
          )}
        {dataMsg && <p role="status" class="muted">{dataMsg}</p>}
        </section>
        <h3 class="group-title">Sugestões</h3>
        <section class="group"><button class="btn ghost" onClick={onSuggest}>Enviar sugestão</button></section>
        <h3 class="group-title">Sobre a Ninhora</h3>
        <section class="group">
          <button class="share-row" onClick={async () => {
            setShareMsg('');
            if (!canNativeShare()) { setShareFallback(true); return; }
            const r = await shareApp();
            if (r === 'failed' || r === 'unsupported') setShareFallback(true);   // cancelar não gera mensagem
          }}><ShareIcon width="20" height="20" aria-hidden="true" /><span>Compartilhar a Ninhora</span></button>
          {(shareFallback || !canNativeShare()) && (
            <div class="stack">
              <button class="btn ghost" onClick={async () => setShareMsg((await copyShareLink()) ? 'Link copiado ✓' : 'Não deu para copiar. Selecione o endereço abaixo e copie à mão.')}>Copiar link</button>
              {shareMsg.startsWith('Não') && <input readOnly value={shareUrl()} onFocus={(e) => e.target.select()} aria-label="Endereço para copiar" />}
              <p role="status" class="muted">{shareMsg}</p>
            </div>
          )}
        </section>
        <p class="muted">Seus registros não são usados para publicidade. O Ninhora não substitui a orientação do pediatra.</p>
        <button class="btn ghost" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}
