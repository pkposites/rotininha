import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
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
import { FeedbackSheet, FeedbackCard } from './FeedbackSheet.jsx';
import { engagement, shouldShowCard, isEligible } from './lib/feedback.js';
import { track } from './lib/analytics.js';
import { GuideTab } from './GuideTab.jsx';
import { getPref, setPref } from './lib/prefs.js';
import { listEvents, listTasks } from './lib/db.js';
import { getAccount, accessNotice, pendingCheckout } from './lib/billing.js';
import { TaskSheet } from './TaskSheet.jsx';
import { ReminderSheet } from './ReminderSheet.jsx';
import { RemindersCard } from './RemindersCard.jsx';
import { useReminders } from './lib/useReminders.js';
import { makeTask, dayItems, markDone, markSkipped, snooze, undo } from './lib/tasks.js';
import { startSync, subscribe as subSync, syncAvailable } from './lib/sync.js';

const TABS = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'historico', label: 'Histórico' },
  { id: 'guia', label: 'Guia' }
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
  return (
    <button class="card last" disabled={!target} onClick={() => target && onEdit(target)}
      aria-label={`${t.label}: ${main} ${sub}. ${target ? 'Toque para editar.' : ''}`}>
      <span class="ico" aria-hidden="true">{t.icon}</span>
      <span class="lbl muted">{type === 'mamada' ? 'Última mamada' : type === 'sono' ? 'Sono' : 'Última fralda'}</span>
      <strong class="time">{main}</strong>
      <span class="muted">{sub}</span>
    </button>
  );
}

function Hoje({ store, rem, now, onEdit, onOpenItem, onNewTask, onLogged, feedbackNode }) {
  const { events, quickLog } = store;
  const [toast, setToast] = useState(null);
  const sleeping = openSleep(events);
  const data = new Date(now).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  const log = async (type) => {
    const r = await quickLog(type);
    onLogged?.();
    const msg = r.woke ? `Acordou às ${hhmm(r.event.endedAt)}` : `${TYPES[type].label} registrada às ${hhmm(r.event.startedAt)}`;
    setToast({ msg, event: r.event });
  };
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      <section>
        <h1>{greeting()}! 💜</h1>
        <p class="muted">{data}</p>
      </section>
      <section class="actions" aria-label="Registro rápido">
        <button class="btn" onClick={() => log('mamada')}>🍼 Mamou</button>
        <button class="btn" onClick={() => log('sono')}>{sleeping ? '☀️ Acordou' : '😴 Dormiu'}</button>
        <button class="btn" onClick={() => log('fralda')}>👶 Fralda</button>
      </section>
      <div class="toast-slot" role="status" aria-live="polite">
        {toast && (
          <div class="toast">
            <span>{toast.msg}</span>
            <button class="link" onClick={() => { onEdit(toast.event); setToast(null); }}>Ajustar horário</button>
          </div>
        )}
      </div>
      <section class="lasts" aria-label="Últimos cuidados">
        {['mamada', 'sono', 'fralda'].map((t) => <LastCard type={t} events={events} now={now} onEdit={onEdit} />)}
      </section>
      {feedbackNode}
      <RemindersCard tasks={rem.tasks} occs={rem.occs} now={now} tz={rem.tz} onOpen={onOpenItem} onNew={onNewTask} onQuickDone={(i) => rem.saveOcc(markDone(i))} />
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
  useEffect(() => { track('app_first_open', { once: true }); }, []);
  useEffect(() => { (async () => setFbPrefs({ dismissedAt: await getPref('feedbackDismissedAt'), submittedAt: await getPref('feedbackSubmittedAt') }))(); }, [feedbackOpen]);
  // Primeira abertura: onboarding só para quem ainda não tem dados nem já o concluiu.
  useEffect(() => {
    (async () => {
      if (await getPref('onboardingDone', false)) return;
      const has = (await listEvents()).length + (await listTasks()).length > 0;
      if (has) return setPref('onboardingDone', true);
      setOnboarding(true);
    })();
  }, []);
  const [checkout, setCheckout] = useState(null);   // { renewal, resume }
  const [recover, setRecover] = useState(null);     // { token }
  const [account, setAccount] = useState(null);
  const refreshAccount = async () => setAccount(await getAccount());
  // Link de recuperação: #recover=TOKEN (fragmento: não vai ao servidor). Pagamento em andamento: retoma.
  useEffect(() => {
    const m = /[#&]recover=([\w-]+)/.exec(location.hash);
    if (/[#&]comprar\b/.test(location.hash) && FLAGS.payments) { setCheckout({ renewal: false }); history.replaceState(null, '', location.pathname + location.search); }
    if (m) { setRecover({ token: m[1] }); history.replaceState(null, '', location.pathname + location.search); }
    pendingCheckout().then((c) => { if (c && !m) setCheckout({ renewal: c.renewal, resume: c }); });
  }, []);
  useEffect(() => { if (syncStatus === 'idle') refreshAccount(); if (syncStatus === 'signed-out') setAccount(null); }, [syncStatus]);
  const notice = accessNotice(account);
  const eng = engagement(store.events, rem.occs, rem.tz);
  const showFeedbackCard = shouldShowCard({
    eng, now, tab, night, loggedThisSession, busy: onboarding || !!checkout || !!recover || settings || !!editing || !!taskEdit || !!openOcc,
    flag: FLAGS.feedbackCard, ...fbPrefs
  });
  useEffect(() => { if (isEligible(eng)) track('feedback_eligible', { once: true }); }, [isEligible(eng)]);
  useEffect(() => { if (showFeedbackCard) track('feedback_card_shown'); }, [showFeedbackCard]);
  useEffect(() => { startSync(); return subSync((st) => setSyncStatus(st.status)); }, []);
  // Notificação → abre o lembrete para confirmar (nunca conclui sozinho).
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('occ');
    if (q) { setOpenOcc(q); history.replaceState(null, '', location.pathname); }
    const onMsg = (e) => { if (e.data?.type === 'open-occ' && e.data.occId) setOpenOcc(e.data.occId); };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, []);
  const openItem = openOcc ? dayItems(rem.tasks, rem.occs, now, rem.tz).find((i) => i.id === openOcc) ?? dayItems(rem.tasks, rem.occs, now, rem.tz, dateOfOcc(openOcc)).find((i) => i.id === openOcc) : null;
  useEffect(() => {
    document.documentElement.dataset.theme = night ? 'night' : 'day';
    try { localStorage.setItem('night', night ? '1' : '0'); } catch {}
  }, [night]);

  return (
    <div class="shell">
      <header class="topbar">
        <span class="brand">Rotininha</span>
        <div>
          {syncAvailable && syncStatus === 'offline' && <span class="muted" role="status">sem conexão </span>}
          <button class="icon-btn" aria-label={night ? 'Desativar modo madrugada' : 'Ativar modo madrugada'} onClick={() => setNight(!night)}>
            {night ? '☀️' : '🌙'}
          </button>
          <button class="icon-btn" aria-label="Ajustes" onClick={() => setSettings(true)}>⚙️</button>
        </div>
      </header>
      <main>
        {store.error && <p class="card err" role="alert">{store.error}</p>}
        {notice && <section class={`card notice ${notice.tone}`} role="status"><p>{notice.text}</p>{FLAGS.payments && <button class="btn" onClick={() => setCheckout({ renewal: true })}>Renovar</button>}</section>}
        {tab === 'hoje' && <Hoje store={store} rem={rem} now={now} onLogged={() => { setLoggedThisSession(true); track('first_record', { once: true }); }}
          feedbackNode={showFeedbackCard ? <FeedbackCard onOpen={() => setFeedbackOpen(true)} onDismiss={async () => { await setPref('feedbackDismissedAt', Date.now()); setFbPrefs((f) => ({ ...f, dismissedAt: Date.now() })); track('feedback_card_dismissed'); }} /> : null} onEdit={setEditing} onOpenItem={(i) => setOpenOcc(i.id)} onNewTask={() => setTaskEdit({ task: makeTask(), isNew: true })} />}
        {tab === 'historico' && <Historico events={store.events} onEdit={setEditing} />}
        {tab === 'guia' && <GuideTab rem={rem} account={account} now={now}
          onCreateTask={(p) => setTaskEdit({ task: makeTask(p), isNew: true })} onGoToday={() => setTab('hoje')}
          onSuggest={() => setFeedbackOpen(true)} onRenew={FLAGS.payments ? () => setCheckout({ renewal: true }) : null} />}
        <p class="muted disclaimer">O Rotininha ajuda a organizar os cuidados e não substitui a orientação do pediatra.</p>
      </main>
      <nav class="tabs" aria-label="Navegação principal">
        {TABS.map((t) => (
          <button class="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>
      {onboarding && <Onboarding store={store} rem={rem} connected={syncStatus !== 'signed-out' && syncStatus !== 'off'} onFinish={() => setOnboarding(false)} />}
      {openItem && (
        <ReminderSheet item={openItem} now={now} onClose={() => setOpenOcc(null)}
          onDone={() => { rem.saveOcc(markDone(openItem)); setOpenOcc(null); }}
          onSkip={() => { rem.saveOcc(markSkipped(openItem)); setOpenOcc(null); }}
          onSnooze={(m) => { rem.saveOcc(snooze(openItem, m, Date.now())); setOpenOcc(null); }}
          onUndo={() => { rem.saveOcc(undo(openItem)); setOpenOcc(null); }}
          onEdit={() => { setTaskEdit({ task: openItem.task, isNew: false }); setOpenOcc(null); }} />
      )}
      {taskEdit && (
        <TaskSheet task={taskEdit.task} isNew={taskEdit.isNew} tz={rem.tz} onClose={() => setTaskEdit(null)}
          onSave={async (t) => { await rem.saveTask(t); setTaskEdit(null); }}
          onDelete={async (id) => { await rem.removeTask(id); setTaskEdit(null); }} />
      )}
      {feedbackOpen && <FeedbackSheet onClose={() => setFeedbackOpen(false)} />}
      {settings && <SettingsSheet onClose={() => setSettings(false)} night={night} setNight={setNight} account={account}
        onSuggest={() => { setSettings(false); setFeedbackOpen(true); }}
        onBuy={!FLAGS.payments ? null : () => { setSettings(false); setCheckout({ renewal: false }); }}
        onRenew={!FLAGS.payments ? null : () => { setSettings(false); setCheckout({ renewal: true }); }}
        onRecover={() => { setSettings(false); setRecover({ token: null }); }} />}
      {checkout && <CheckoutSheet renewal={checkout.renewal} resume={checkout.resume} onClose={() => setCheckout(null)} onDone={refreshAccount} />}
      {recover && <RecoverSheet token={recover.token} onClose={() => setRecover(null)} />}
      {editing && (
        <EditSheet event={editing} onClose={() => setEditing(null)}
          onSave={async (e) => { await store.save(e); setEditing(null); }}
          onDelete={async (id) => { await store.remove(id); setEditing(null); }} />
      )}
    </div>
  );
}

render(<App />, document.getElementById('app'));

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js', { scope: '/app/' }).catch(() => {}));
}
