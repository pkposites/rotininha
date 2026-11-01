import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import './styles.css';

const TABS = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'historico', label: 'Histórico' },
  { id: 'guia', label: 'Guia' }
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function Hoje() {
  const data = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <>
      <section>
        <h1>{greeting()}! 💜</h1>
        <p class="muted">{data}</p>
      </section>
      <section class="actions" aria-label="Registro rápido">
        <button class="btn" disabled>Mamou</button>
        <button class="btn" disabled>Dormiu</button>
        <button class="btn" disabled>Fralda</button>
      </section>
      <section class="card empty">
        <h3>Próximos lembretes</h3>
        <p class="muted">Você ainda não criou lembretes. Quando quiser, é só começar do zero ou usar um modelo.</p>
      </section>
    </>
  );
}

const Placeholder = ({ title, text }) => (
  <section class="card empty"><h2>{title}</h2><p class="muted">{text}</p></section>
);

function App() {
  const [tab, setTab] = useState('hoje');
  const [night, setNight] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = night ? 'night' : 'day';
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
        {tab === 'hoje' && <Hoje />}
        {tab === 'historico' && <Placeholder title="Histórico" text="Os registros do dia vão aparecer aqui." />}
        {tab === 'guia' && <Placeholder title="Rotina e Sono em 7 Dias" text="Conteúdo em preparação, com revisão profissional antes de publicar." />}
        <p class="muted disclaimer">O Rotininha ajuda a organizar os cuidados e não substitui a orientação do pediatra.</p>
      </main>
      <nav class="tabs" aria-label="Navegação principal">
        {TABS.map(t => (
          <button class="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>
    </div>
  );
}

render(<App />, document.getElementById('app'));
