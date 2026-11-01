import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import './styles.css';
import { useEvents } from './lib/useEvents.js';
import {
  TYPES, lastOf, openSleep, formatElapsed, formatDuration, groupByDay, summarize
} from './lib/events.js';
import { EditSheet } from './EditSheet.jsx';

const TABS = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'historico', label: 'Histórico' },
  { id: 'guia', label: 'Guia' }
];
const hhmm = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

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

function Hoje({ store, now, onEdit }) {
  const { events, quickLog } = store;
  const [toast, setToast] = useState(null);
  const sleeping = openSleep(events);
  const data = new Date(now).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  const log = async (type) => {
    const r = await quickLog(type);
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
      <section class="card empty">
        <h3>Próximos lembretes</h3>
        <p class="muted">Você ainda não criou lembretes. Em breve você poderá começar do zero ou usar um modelo.</p>
      </section>
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
      <h2>Histórico</h2>
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
            <h3 class="day">{dayLabel(key)}</h3>
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
  useEffect(() => {
    document.documentElement.dataset.theme = night ? 'night' : 'day';
    try { localStorage.setItem('night', night ? '1' : '0'); } catch {}
  }, [night]);

  return (
    <div class="shell">
      <header class="topbar">
        <span class="brand">Rotininha</span>
        <button class="icon-btn" aria-label={night ? 'Desativar modo madrugada' : 'Ativar modo madrugada'} onClick={() => setNight(!night)}>
          {night ? '☀️' : '🌙'}
        </button>
      </header>
      <main>
        {store.error && <p class="card err" role="alert">{store.error}</p>}
        {tab === 'hoje' && <Hoje store={store} now={now} onEdit={setEditing} />}
        {tab === 'historico' && <Historico events={store.events} onEdit={setEditing} />}
        {tab === 'guia' && <section class="card empty"><h2>Rotina e Sono em 7 Dias</h2><p class="muted">Conteúdo em preparação, com revisão profissional antes de publicar.</p></section>}
        <p class="muted disclaimer">O Rotininha ajuda a organizar os cuidados e não substitui a orientação do pediatra.</p>
      </main>
      <nav class="tabs" aria-label="Navegação principal">
        {TABS.map((t) => (
          <button class="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>
      {editing && (
        <EditSheet event={editing} onClose={() => setEditing(null)}
          onSave={async (e) => { await store.save(e); setEditing(null); }}
          onDelete={async (id) => { await store.remove(id); setEditing(null); }} />
      )}
    </div>
  );
}

render(<App />, document.getElementById('app'));
