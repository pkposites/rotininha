import { render } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import './styles.css';
import { useEvents } from './lib/useEvents.js';
import {
  TYPES, lastOf, openSleep, formatElapsed, formatDuration, groupByDay, summarize
} from './lib/events.js';
import { EditSheet } from './EditSheet.jsx';
import { SettingsSheet } from './SettingsSheet.jsx';
import { CheckoutSheet } from './CheckoutSheet.jsx';
import { RecoverSheet } from './RecoverSheet.jsx';
import { FLAGS } from './config.js';
import { Onboarding } from './Onboarding.jsx';
import { HomeIcon, ClockIcon, BookIcon, MoonIcon, SunIcon, GearIcon, BrandMark, LeafIcon, MusicIcon } from './icons.jsx';
import { SoundsTab } from './SoundsTab.jsx';
import { LeapsTab } from './LeapsTab.jsx';
import { TrialFlow } from './TrialFlow.jsx';
import { count } from './lib/usage.js';
import { FeedbackSheet, FeedbackCard } from './FeedbackSheet.jsx';
import { engagement, shouldShowCard, isEligible } from './lib/feedback.js';
import { track } from './lib/analytics.js';
import { GuideTab } from './GuideTab.jsx';
import { getPref, setPref } from './lib/prefs.js';
import { getMeta, listEvents, listTasks } from './lib/db.js';
import { getAccount, accessNotice, pendingCheckout } from './lib/billing.js';
import { TaskSheet } from './TaskSheet.jsx';
import { ReminderSheet } from './ReminderSheet.jsx';
import { InstallPopup } from './InstallPopup.jsx';
import { MiniPlayer } from './MiniPlayer.jsx';
import { isStandalone, pushState, resyncPush } from './lib/push.js';
import { PushPrompt } from './PushPrompt.jsx';
import { registeredMessage } from './lib/ux.js';
import { isBlocked } from './lib/gate.js';
import { nudgePlan, DAY } from './lib/nudge.js';
import { useProfile } from './lib/profile.js';
import { NudgePopup } from './NudgePopup.jsx';
import { PaywallSheet } from './PaywallSheet.jsx';
import { RemindersCard } from './RemindersCard.jsx';
import { useReminders } from './lib/useReminders.js';
import { makeTask, dayItems, markDone, markSkipped, snooze, undo } from './lib/tasks.js';
import { startSync, subscribe as subSync, syncAvailable } from './lib/sync.js';

// Lido na abertura: o fragmento #recover=… é removido da barra de endereço logo depois.
const OPENED_WITH_RECOVERY_LINK = typeof location !== 'undefined' && /[#&]recover=/.test(location.hash);

const TABS = [
  { id: 'hoje', label: 'Hoje', Icon: HomeIcon },
  { id: 'historico', label: 'Histórico', Icon: ClockIcon },
  { id: 'saltos', label: 'Saltos', Icon: LeafIcon },
  { id: 'sons', label: 'Sons', Icon: MusicIcon },
  { id: 'guia', label: 'Guia', Icon: BookIcon }
];
const hhmm = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const dateOfOcc = (id) => { const m = /_(\d{4})(\d{2})(\d{2})$/.exec(id); return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined; };

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function useNow(everyMs = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), everyMs);
    const vis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(i); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return now;
}

function LastCard({ type, events, now, onEdit }) {
  const t = TYPES[type];
  const open = type === 'sono' ? openSleep(events) : null;
  const last = lastOf(events, type);
  let main = 'Ainda não registrado', sub = '';
  if (open) { main = 'Dormindo'; sub = `desde ${hhmm(open.startedAt)} · ${formatDuration(now - open.startedAt)}`; }
  else if (last) {
    const ref = type === 'sono' && last.endedAt ? last.endedAt : last.startedAt;
    main = hhmm(ref);
    sub = `${type === 'sono' ? 'acordou ' : ''}${formatElapsed(now - ref)}`;
  }
  const target = open ?? last;
  const empty = !target;
  return (
    <button class={`card last${open ? ' on' : ''}`} disabled={empty} onClick={() => target && onEdit(target)}
      aria-label={`${t.label}: ${main} ${sub}. ${target ? 'Toque para editar.' : ''}`}>
      <span class="ico" aria-hidden="true">{t.icon}</span>
      <span class="lbl muted">{type === 'mamada' ? 'Mamada' : type === 'sono' ? 'Sono' : 'Fralda'}</span>
      <strong class="time">{empty ? '—' : main}</strong>
      <span class="sub">{empty ? 'Ainda não registrado' : sub}</span>
    </button>
  );
}

function Hoje({ store, rem, now, onEdit, onOpenItem, onNewTask, onLogged, feedbackNode, onHelp, syncStatus, onConnect, hideLocal, onInstall, blocked, onBlocked }) {
  const { events, quickLog } = store;
  const profile = useProfile();
  const [toast, setToast] = useState(null);
  const sleeping = openSleep(events);
  const [showInstall, setShowInstall] = useState(false);
  const [localDismissed, setLocalDismissed] = useState(true);
  useEffect(() => { (async () => {
    if (!isStandalone() && !(await getPref('installDismissed', false))) setShowInstall(true);
    const until = await getPref('localCardUntil', 0); setLocalDismissed(Date.now() < until);
  })(); }, []);
  const data = new Date(now).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  const log = async (type) => {
    if (blocked) return onBlocked();
    const r = await quickLog(type);
    if (!r.duplicate) { count('care_logged'); onLogged?.(); }
    setToast({ msg: registeredMessage(type, r.event, r.woke), r, dup: !!r.duplicate });
  };
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 9000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      <section class="greet">
        <h1>{greeting()}{profile.mom ? `, ${profile.mom}` : ''}! 💜</h1>
        <p class="muted">{data}</p>
      </section>
      <div class="quick-intro">
        <h2 class="h3s">{profile.baby ? `Cuidados de ${profile.baby}` : 'O que o bebê acabou de fazer?'}</h2>
        <p class="muted">Toque em um botão para registrar agora. Assim guardamos o horário e mostramos abaixo há quanto tempo foi, para você não precisar lembrar de cabeça.</p>
      </div>
      <section class="actions" aria-label="Registro rápido">
        <button class="qa qa-mamada" onClick={() => log('mamada')}><span class="qa-ico" aria-hidden="true">🍼</span><span>Mamou</span></button>
        <button class="qa qa-sono" onClick={() => log('sono')}><span class="qa-ico" aria-hidden="true">{sleeping ? '☀️' : '😴'}</span><span>{sleeping ? 'Acordou' : 'Dormiu'}</span></button>
        <button class="qa qa-fralda" onClick={() => log('fralda')}><span class="qa-ico" aria-hidden="true">👶</span><span>Fralda</span></button>
      </section>
      <div class="toast-slot" role="status" aria-live="polite">
        {toast && (
          <div class="toast">
            <span>{toast.dup ? 'Você acabou de registrar. ' : ''}{toast.msg}</span>
            <span class="toast-actions">
              {!toast.undone && <button class="link" onClick={async () => { await store.undoLog(toast.r); setToast({ msg: 'Registro desfeito.', undone: true }); }}>Desfazer</button>}
              {!toast.undone && <button class="link" onClick={() => { onEdit(toast.r.event); setToast(null); }}>Ajustar horário</button>}
            </span>
          </div>
        )}
      </div>
      <section class="lasts" aria-label="Últimos cuidados">
        {['mamada', 'sono', 'fralda'].map((t) => <LastCard type={t} events={events} now={now} onEdit={onEdit} />)}
      </section>
      <RemindersCard tasks={rem.tasks} occs={rem.occs} now={now} tz={rem.tz} onOpen={onOpenItem} onNew={() => blocked ? onBlocked() : onNewTask()} onQuickDone={(i) => { if (blocked) return onBlocked(); count('reminder_done'); rem.saveOcc(markDone(i)); }} />
      {feedbackNode}
      {syncStatus === 'signed-out' && !localDismissed && !hideLocal && (
        <section class="card local-card" aria-label="Seus registros estão só neste aparelho">
          <strong>Seus registros estão só neste aparelho</strong>
          <p class="muted">Crie uma conta grátis para guardar os registros nela e abri-los em outro aparelho, com o código de acesso. O que você já registrou aqui será enviado para a conta.</p>
          <div class="row"><button class="btn" onClick={onConnect}>Criar conta</button><button class="link" onClick={async () => { setLocalDismissed(true); await setPref('localCardUntil', Date.now() + 7 * 86_400_000); }}>Depois</button></div>
        </section>
      )}
      <section class="card help-card" aria-label="Ajuda rápida">
        <strong>Precisa de uma ajuda agora?</strong>
        <p class="muted">Dicas curtas sobre sono, bebê agitado e cuidados com você.</p>
        <button class="btn ghost" onClick={onHelp}>Ver dicas práticas</button>
      </section>
      {showInstall && (
        <section class="card install-card" aria-label="Instalar o app">
          <div class="card-head"><strong>📲 Instalar na tela inicial</strong><button class="link" onClick={async () => { setShowInstall(false); await setPref('installDismissed', true); }}>Dispensar</button></div>
          <p class="muted">Abra como um app, sem procurar o link. Mostramos o passo a passo para o seu celular.</p>
          <button class="btn ghost" onClick={onInstall}>Ver como instalar</button>
        </section>
      )}
    </>
  );
}

function Historico({ events, onEdit }) {
  const [filter, setFilter] = useState('todos');
  const groups = groupByDay(events, filter);
  const dayLabel = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  };
  return (
    <>
      <h1 class="h2s">Histórico</h1>
      <div class="chips" role="group" aria-label="Filtrar por tipo">
        {[['todos', 'Todos'], ...Object.entries(TYPES).map(([k, v]) => [k, v.label])].map(([k, l]) => (
          <button class="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      {groups.length === 0 && <section class="card empty"><p class="muted">Nenhum registro ainda. Use os botões da tela Hoje.</p></section>}
      {groups.map(({ key, events: evs }) => {
        const s = summarize(evs);
        return (
          <section class="card" key={key}>
            <h2 class="day h3s">{dayLabel(key)}</h2>
            <p class="muted">{s.mamadas} mamadas · {s.fraldas} fraldas · {s.sonos} sonos{s.sonoMs ? ` (${formatDuration(s.sonoMs)})` : ''}</p>
            <ul class="timeline">
              {evs.map((e) => (
                <li key={e.id}>
                  <button class="row-btn" onClick={() => onEdit(e)}>
                    <span class="time">{hhmm(e.startedAt)}{e.endedAt ? `–${hhmm(e.endedAt)}` : ''}</span>
                    <span>{TYPES[e.type].icon} {TYPES[e.type].label}{e.type === 'sono' && !e.endedAt ? ' (em andamento)' : ''}{e.note ? ` · ${e.note}` : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

function App() {
  const store = useEvents();
  const now = useNow();
  const [tab, setTab] = useState('hoje');
  const [night, setNight] = useState(() => { try { return localStorage.getItem('night') === '1'; } catch { return false; } });
  const [editing, setEditing] = useState(null);
  const rem = useReminders();
  const [openOcc, setOpenOcc] = useState(null);   // id da ocorrência aberta (sheet de ação)
  const [taskEdit, setTaskEdit] = useState(null); // { task, isNew }
  const [syncStatus, setSyncStatus] = useState('off');
  const [settings, setSettings] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [loggedThisSession, setLoggedThisSession] = useState(false);
  const [fbPrefs, setFbPrefs] = useState({ dismissedAt: null, submittedAt: null });
  useEffect(() => { track('app_first_open', { once: true }); count('app_open'); }, []);
  const [trialOpen, setTrialOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [nudge, setNudge] = useState(null);       // { plan, dismissals }
  const nudgeRan = useRef(false);
  const [pushAsk, setPushAsk] = useState(false);
  const pushAskRan = useRef(false);
  const offerInstall = async () => { if (!isStandalone() && !(await getPref('installDismissed', false)) && Date.now() > (await getPref('installSnoozeUntil', 0))) setInstallOpen(true); };
  useEffect(() => { (async () => setFbPrefs({ dismissedAt: await getPref('feedbackDismissedAt'), submittedAt: await getPref('feedbackSubmittedAt') }))(); }, [feedbackOpen]);
  // Primeira abertura: onboarding só para quem ainda não tem dados nem já o concluiu.
  useEffect(() => {
    (async () => {
      if (OPENED_WITH_RECOVERY_LINK) return;   // quem abriu o link de recuperação vai direto criar a nova senha, sem onboarding por cima
      if (await getPref('onboardingDone', false)) return;
      const has = (await listEvents()).length + (await listTasks()).length > 0;
      if (has) return setPref('onboardingDone', true);
      setOnboarding(true);
    })();
  }, []);
  const [checkout, setCheckout] = useState(null);   // { renewal, resume }
  const [recover, setRecover] = useState(null);     // { token }
  const [account, setAccount] = useState(null);
  const blocked = isBlocked(account);   // acesso vencido: só leitura até pagar
  const refreshAccount = async () => setAccount(await getAccount());
  // Link de recuperação: #recover=TOKEN (fragmento: não vai ao servidor). Pagamento em andamento: retoma.
  useEffect(() => {
    const m = /[#&]recover=([\w-]+)/.exec(location.hash);
    // Compra só com conta: quem já está conectada vai ao pagamento; quem não está cria a conta primeiro (WhatsApp + senha)
    if (/[#&]comprar\b/.test(location.hash) && FLAGS.payments) { getMeta('session').then((ss) => (ss ? setCheckout({ renewal: true }) : setTrialOpen(true))); history.replaceState(null, '', location.pathname + location.search); }
    if (m) { setRecover({ token: m[1] }); history.replaceState(null, '', location.pathname + location.search); }
    pendingCheckout().then((c) => { if (c && !m) setCheckout({ renewal: c.renewal, resume: c }); });
  }, []);
  useEffect(() => { if (syncStatus === 'idle') refreshAccount(); if (syncStatus === 'signed-out') setAccount(null); }, [syncStatus]);
  const notice = accessNotice(account);
  useEffect(() => { if (notice?.kind === 'trial' || notice?.kind === 'announce') count('trial_banner_seen'); if (notice?.kind === 'expired' || notice?.kind === 'grace') count('paywall_viewed'); }, [notice?.kind]);
  const eng = engagement(store.events, rem.occs, rem.tz);
  const showFeedbackCard = shouldShowCard({
    eng, now, tab, night, loggedThisSession, busy: onboarding || !!checkout || !!recover || settings || !!editing || !!taskEdit || !!openOcc,
    flag: FLAGS.feedbackCard, ...fbPrefs
  });
  useEffect(() => { if (isEligible(eng)) track('feedback_eligible', { once: true }); }, [isEligible(eng)]);
  useEffect(() => { if (showFeedbackCard) track('feedback_card_shown'); }, [showFeedbackCard]);
  useEffect(() => { startSync(); return subSync((st) => setSyncStatus(st.status)); }, []);
  // Lembrete dentro do app para quem está sem conta e/ou sem o app instalado (uma vez por abertura)
  useEffect(() => { (async () => {
    if (nudgeRan.current || onboarding || !store.ready || (syncAvailable && syncStatus === 'off')) return;
    if (checkout || recover || settings || trialOpen || installOpen || editing || taskEdit || openOcc || paywall) return;
    nudgeRan.current = true;
    let nextAt = await getPref('nudgeNextAt', null);
    if (nextAt == null) { nextAt = Date.now() + DAY; await setPref('nudgeNextAt', nextAt); }
    const plan = nudgePlan({ now: Date.now(), syncAvailable, signedOut: syncStatus === 'signed-out', standalone: isStandalone(), installDismissed: await getPref('installDismissed', false), optOut: await getPref('nudgeOptOut', false), hasData: store.events.length > 0 || rem.tasks.length > 0, nextAt });
    if (plan.show) setNudge({ plan, dismissals: await getPref('nudgeDismissals', 0) });
  })(); }, [onboarding, store.ready, syncStatus, checkout, recover, settings, trialOpen, installOpen, editing, taskEdit, openOcc, paywall]);
  // App instalado + conta: reenvia a inscrição (silencioso) e, se ainda falta a permissão, pede com um toque.
  useEffect(() => { (async () => {
    if (syncStatus !== 'idle' || onboarding || !store.ready || pushAskRan.current) return;
    if (checkout || recover || settings || trialOpen || installOpen || editing || taskEdit || openOcc || paywall || nudge) return;
    pushAskRan.current = true;
    await resyncPush();
    if (!isStandalone() || (await pushState()) !== 'idle') return;
    const nextAt = await getPref('pushAskNextAt', null);
    if (nextAt == null || Date.now() >= nextAt) setPushAsk(true);
  })(); }, [syncStatus, onboarding, store.ready, checkout, recover, settings, trialOpen, installOpen, editing, taskEdit, openOcc, paywall, nudge]);
  // Notificação → abre o lembrete para confirmar (nunca conclui sozinho).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('occ'), go = params.get('go');
    const goTo = (t) => { if (t === 'ajustes') setSettings(true); else if (['hoje', 'historico', 'saltos', 'sons', 'guia'].includes(t)) setTab(t); };
    if (q) setOpenOcc(q);
    if (go) goTo(go);
    const src = params.get('src');
    if (src) { (async () => { if (src === 'lp' && !(await getPref('lpArrival', false))) { await setPref('lpArrival', true); count('lp_arrival'); } })(); }
    (async () => { if (isStandalone() && !(await getPref('installCounted', false))) { await setPref('installCounted', true); count('app_installed'); } })();
    if (q || go || src) history.replaceState(null, '', location.pathname);
    const onMsg = (e) => {
      if (e.data?.type === 'open-occ' && e.data.occId) setOpenOcc(e.data.occId);
      if (e.data?.type === 'open-target' && e.data.target) goTo(e.data.target);
    };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, []);
  const openItem = openOcc ? dayItems(rem.tasks, rem.occs, now, rem.tz).find((i) => i.id === openOcc) ?? dayItems(rem.tasks, rem.occs, now, rem.tz, dateOfOcc(openOcc)).find((i) => i.id === openOcc) : null;
  useEffect(() => {
    document.documentElement.dataset.theme = night ? 'night' : 'day';
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', night ? '#171A2A' : '#FBF9F7');
    try { localStorage.setItem('night', night ? '1' : '0'); } catch {}
  }, [night]);

  return (
    <div class="shell">
      <header class="topbar">
        <span class="brand"><BrandMark />Ninhora</span>
        <div class="topbar-actions">
          {syncAvailable && syncStatus === 'offline' && <span class="muted" role="status">sem conexão</span>}
          <button class="icon-btn" aria-label={night ? 'Desativar modo madrugada' : 'Ativar modo madrugada'} onClick={() => setNight(!night)}>
            {night ? <SunIcon /> : <MoonIcon />}
          </button>
          <button class="icon-btn" aria-label="Ajustes" onClick={() => { setSettings(true); count('settings_opened'); }}><GearIcon /></button>
        </div>
      </header>
      <main>
        {store.error && <p class="card err" role="alert">{store.error}</p>}
        {notice && <section class={`card notice ${notice.tone}`} role="status"><p>{notice.text}</p>{FLAGS.payments && <button class="btn" onClick={() => setCheckout({ renewal: true })}>Garantir acesso</button>}</section>}
        {tab === 'hoje' && <Hoje blocked={blocked} onBlocked={() => setPaywall(true)} onInstall={() => setInstallOpen(true)} hideLocal={onboarding} syncStatus={syncStatus} onConnect={() => setTrialOpen(true)} onHelp={() => { setTab('guia'); count('help_card_opened'); }} store={store} rem={rem} now={now} onLogged={() => { setLoggedThisSession(true); track('first_record', { once: true }); }}
          feedbackNode={showFeedbackCard ? <FeedbackCard onOpen={() => setFeedbackOpen(true)} onDismiss={async () => { await setPref('feedbackDismissedAt', Date.now()); setFbPrefs((f) => ({ ...f, dismissedAt: Date.now() })); track('feedback_card_dismissed'); }} /> : null} onEdit={setEditing} onOpenItem={(i) => setOpenOcc(i.id)} onNewTask={() => setTaskEdit({ task: makeTask(), isNew: true })} />}
        {tab === 'historico' && <Historico events={store.events} onEdit={setEditing} />}
        {tab === 'saltos' && <LeapsTab tz={rem.tz} />}
        {tab === 'sons' && <SoundsTab blocked={blocked} onBlocked={() => setPaywall(true)} />}
        {tab === 'guia' && <GuideTab onGoSounds={() => setTab('sons')} rem={rem} account={account} now={now}
          onCreateTask={(p) => setTaskEdit({ task: makeTask(p), isNew: true })} onGoToday={() => setTab('hoje')}
          onSuggest={() => setFeedbackOpen(true)} onRenew={FLAGS.payments ? () => setCheckout({ renewal: true }) : null} />}
        <p class="muted disclaimer">O Ninhora ajuda a organizar os cuidados e não substitui a orientação do pediatra.</p>
      </main>
      {tab !== 'sons' && <MiniPlayer onOpen={() => setTab('sons')} />}
      <nav class="tabs" aria-label="Navegação principal">
        {TABS.map((t) => (
          <button class="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            <span class="tab-ico"><t.Icon /></span><span>{t.label}</span>
          </button>
        ))}
      </nav>
      {onboarding && <Onboarding store={store} rem={rem} onRecover={() => { setOnboarding(false); setRecover({ token: null }); }} connected={syncStatus !== 'signed-out' && syncStatus !== 'off'} onFinish={() => { setOnboarding(false); offerInstall(); }} />}
      {openItem && (
        <ReminderSheet item={openItem} now={now} onClose={() => setOpenOcc(null)}
          onDone={() => { if (blocked) { setOpenOcc(null); return setPaywall(true); } count('reminder_done'); rem.saveOcc(markDone(openItem)); setOpenOcc(null); }}
          onSkip={() => { if (blocked) { setOpenOcc(null); return setPaywall(true); } rem.saveOcc(markSkipped(openItem)); setOpenOcc(null); }}
          onSnooze={(m) => { if (blocked) { setOpenOcc(null); return setPaywall(true); } count('reminder_snoozed'); rem.saveOcc(snooze(openItem, m, Date.now())); setOpenOcc(null); }}
          onUndo={() => { if (blocked) { setOpenOcc(null); return setPaywall(true); } rem.saveOcc(undo(openItem)); setOpenOcc(null); }}
          onEdit={() => { setTaskEdit({ task: openItem.task, isNew: false }); setOpenOcc(null); }} />
      )}
      {taskEdit && (
        <TaskSheet task={taskEdit.task} isNew={taskEdit.isNew} tz={rem.tz} onClose={() => setTaskEdit(null)}
          onSave={async (t) => { if (blocked) { setTaskEdit(null); return setPaywall(true); } await rem.saveTask(t); setTaskEdit(null); }}
          onDelete={async (id) => { await rem.removeTask(id); setTaskEdit(null); }} />
      )}
      {pushAsk && !onboarding && <PushPrompt onClose={() => setPushAsk(false)} onDone={() => setPushAsk(false)} />}
      {nudge && !onboarding && <NudgePopup plan={nudge.plan} dismissals={nudge.dismissals} onClose={() => setNudge(null)}
        onAccount={async () => { setNudge(null); await setPref('nudgeNextAt', Date.now() + DAY); setTrialOpen(true); }}
        onInstall={async () => { setNudge(null); await setPref('nudgeNextAt', Date.now() + DAY); setInstallOpen(true); }} />}
      {paywall && <PaywallSheet account={account} onClose={() => setPaywall(false)} onPay={() => { setPaywall(false); setCheckout({ renewal: true }); }} />}
      {installOpen && !recover && !checkout && !trialOpen && <InstallPopup onClose={() => setInstallOpen(false)} />}
      {feedbackOpen && <FeedbackSheet onClose={() => setFeedbackOpen(false)} />}
      {settings && <SettingsSheet onClose={() => setSettings(false)} night={night} setNight={setNight} account={account}
        onSuggest={() => { setSettings(false); setFeedbackOpen(true); }}
        onStartTrial={() => { setSettings(false); setTrialOpen(true); }} refreshAccount={refreshAccount}
        onBuy={null}
        onRenew={!FLAGS.payments ? null : () => { setSettings(false); setCheckout({ renewal: true }); }}
        onRecover={() => { setSettings(false); setRecover({ token: null }); }} />}
      {checkout && <CheckoutSheet renewal={checkout.renewal} resume={checkout.resume} onClose={() => setCheckout(null)} onDone={refreshAccount} />}
      {trialOpen && <div class="sheet-backdrop"><div class="sheet" role="dialog" aria-modal="true" aria-label="Teste grátis"><TrialFlow onDone={() => { setTrialOpen(false); refreshAccount(); }} onSkip={() => setTrialOpen(false)} onHaveAccount={() => { setTrialOpen(false); setSettings(true); }} /></div></div>}
      {recover && <RecoverSheet token={recover.token} onClose={() => setRecover(null)} />}
      {editing && (
        <EditSheet event={editing} onClose={() => setEditing(null)}
          onSave={async (e) => { if (blocked) { setEditing(null); return setPaywall(true); } await store.save(e); setEditing(null); }}
          onDelete={async (id) => { await store.remove(id); setEditing(null); }} />
      )}
    </div>
  );
}

render(<App />, document.getElementById('app'));

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js', { scope: '/app/' }).catch(() => {}));
}
