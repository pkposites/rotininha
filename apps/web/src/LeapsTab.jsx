import { useState, useEffect } from 'preact/hooks';
import { LEAPS, ageInDays, weeksOf, currentAndNext, validBirthDate } from '../../../packages/shared/leaps.js';
import { localParts } from '../../../packages/shared/schedule.js';
import { getPref, setPref } from './lib/prefs.js';
import { authedCall } from './lib/sync.js';
import { count } from './lib/usage.js';

const STATUS = { past: 'Já passou', now: 'Agora', next: 'Próximo', future: 'Mais adiante' };
const fmt = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—';

export function LeapsTab({ tz }) {
  const today = localParts(Date.now(), tz).date;
  const [data, setData] = useState(null);          // { birthDate, marks }
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null);          // salto aberto (n)

  useEffect(() => { (async () => { setData(await getPref('leaps', { birthDate: null, marks: {} })); count('leap_viewed'); })(); }, []);
  if (!data) return null;
  const save = async (next) => { setData(next); await setPref('leaps', next); };

  const saveBirth = async (e) => {
    e.preventDefault(); setErr('');
    if (!validBirthDate(draft, today)) return setErr('Confira a data. Se o bebê ainda não nasceu, use a data prevista (até 60 dias à frente).');
    await save({ ...data, birthDate: draft }); setEditing(false);
    authedCall('/v1/settings', { babyBirthDate: draft }).catch(() => {}); // o servidor só usa para avisar antes de um salto
  };
  const clearBirth = async () => { await save({ birthDate: null, marks: {} }); authedCall('/v1/settings', { babyBirthDate: null }).catch(() => {}); setEditing(false); };

  if (!data.birthDate || editing) {
    return (
      <>
        <h1 class="h2s">Saltos de desenvolvimento</h1>
        <p class="muted">Bebês passam por fases de mais manha enquanto aprendem coisas novas. Informe a data de nascimento para acompanhar a idade em semanas e receber um aviso antes de cada fase.</p>
        <form class="card stack" onSubmit={saveBirth}>
          <label class="field">Data de nascimento do bebê
            <input type="date" value={draft || data.birthDate || ''} min={new Date(Date.parse(today) - 3 * 365 * 86400000).toISOString().slice(0, 10)} max={new Date(Date.parse(today) + 60 * 86400000).toISOString().slice(0, 10)} onInput={(e) => setDraft(e.target.value)} required />
          </label>
          <p class="muted">Bebê prematuro? Use a <strong>data prevista do parto</strong>. A data fica neste aparelho e, se você estiver conectada, também na sua conta, só para calcular a idade e avisar antes de cada fase. Você pode apagar quando quiser.</p>
          {err && <p class="err" role="alert">{err}</p>}
          <button class="btn">Salvar</button>
          {data.birthDate && <button type="button" class="link-danger" onClick={clearBirth}>Apagar a data</button>}
          {editing && <button type="button" class="link" onClick={() => setEditing(false)}>Cancelar</button>}
        </form>
        <Disclaimer />
      </>
    );
  }

  const age = ageInDays(data.birthDate, today);
  const { current, next, all } = currentAndNext(age);
  const mark = (n) => data.marks[n] ?? { start: null, end: null, signs: {} };
  const patch = (n, p) => { save({ ...data, marks: { ...data.marks, [n]: { ...mark(n), ...p } } }); count('leap_marked'); };
  const toggleSign = (n, i) => {
    const m = mark(n), cur = new Set(m.signs[today] ?? []); cur.has(i) ? cur.delete(i) : cur.add(i);
    patch(n, { signs: { ...m.signs, [today]: [...cur] } });
  };
  const detail = open ? all.find((l) => l.n === open) : null;

  return (
    <>
      <h1 class="h2s">Saltos de desenvolvimento</h1>
      <section class="card age">
        {age < 0
          ? <><strong>Faltam {-age} {-age === 1 ? 'dia' : 'dias'} para a data prevista</strong><span class="muted">Depois do nascimento, mostramos a idade em semanas.</span></>
          : <><strong class="big">{weeksOf(age)} semanas e {age % 7} {age % 7 === 1 ? 'dia' : 'dias'}</strong><span class="muted">Nascimento: {fmt(data.birthDate)} · <button class="link inline-link" onClick={() => setEditing(true)}>alterar</button></span></>}
      </section>

      {current ? (
        <section class="card leap-now" aria-label="Salto em andamento">
          <span class="chip-s now">Possível salto agora</span>
          <h2 class="h3s">{current.title}</h2>
          <p>{current.skill}</p>
          <p class="muted">Por volta da semana {current.week} (janela provável: semanas {current.from} a {current.to}). Cada bebê tem o seu ritmo.</p>
          <h3 class="sub">Sinais de hoje <span class="muted">(toque nos que notou)</span></h3>
          <div class="chips" role="group" aria-label="Sinais de hoje">
            {current.signs.map((s, i) => <button class="chip" aria-pressed={(mark(current.n).signs[today] ?? []).includes(i)} onClick={() => toggleSign(current.n, i)}>{s}</button>)}
          </div>
          <div class="row">
            <button class="btn ghost" onClick={() => patch(current.n, { start: mark(current.n).start ?? today })}>{mark(current.n).start ? `Começou em ${fmt(mark(current.n).start)}` : 'Marcar: começou hoje'}</button>
            <button class="btn ghost" disabled={!mark(current.n).start} onClick={() => patch(current.n, { end: today })}>{mark(current.n).end ? `Terminou em ${fmt(mark(current.n).end)}` : 'Marcar: terminou hoje'}</button>
          </div>
          <h3 class="sub">O que costuma ajudar</h3>
          <ul class="bullets">{current.tips.map((t) => <li>{t}</li>)}</ul>
        </section>
      ) : next ? (
        <section class="card" aria-label="Próximo salto">
          <span class="chip-s">Próximo</span>
          <h2 class="h3s">{next.title}</h2>
          <p class="muted">A janela provável começa na semana {next.from} — {next.daysToStart <= 1 ? 'amanhã' : `em cerca de ${next.daysToStart} dias`}. {next.skill}</p>
          <button class="pill" onClick={() => setOpen(next.n)}>Ver o que esperar</button>
        </section>
      ) : <section class="card empty"><p>Você já passou por todas as fases listadas. Continue acompanhando o desenvolvimento com o pediatra. 💜</p></section>}

      <h2 class="h3s">Linha do tempo</h2>
      <ul class="leaps">
        {all.map((l) => (
          <li key={l.n}>
            <button class={`card leap ${l.status}`} onClick={() => { setOpen(l.n); count('leap_viewed'); }}>
              <span class="leap-n" aria-hidden="true">{l.status === 'past' ? '✓' : l.n}</span>
              <span class="leap-txt"><strong>{l.title}</strong><span class="muted">Semana {l.week}{mark(l.n).start ? ` · marcado ${fmt(mark(l.n).start)}` : ''}</span></span>
              <span class={`chip-s ${l.status}`}>{STATUS[l.status]}</span>
            </button>
          </li>
        ))}
      </ul>
      <Disclaimer />

      {detail && (
        <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div class="sheet" role="dialog" aria-modal="true" aria-label={detail.title}>
            <span class={`chip-s ${detail.status}`}>{STATUS[detail.status]}</span>
            <h2>{detail.title}</h2>
            <p>{detail.skill}</p>
            <p class="muted">Por volta da semana {detail.week} (janela provável: semanas {detail.from} a {detail.to}).</p>
            <h3 class="sub">O que você pode notar</h3><ul class="bullets">{detail.signs.map((s) => <li>{s}</li>)}</ul>
            <h3 class="sub">O que costuma ajudar</h3><ul class="bullets">{detail.tips.map((s) => <li>{s}</li>)}</ul>
            {(mark(detail.n).start || mark(detail.n).end) && <p class="muted">Seu registro: começou {fmt(mark(detail.n).start)} · terminou {fmt(mark(detail.n).end)}</p>}
            <button class="btn" onClick={() => setOpen(null)}>Fechar</button>
          </div>
        </div>
      )}
    </>
  );
}

const Disclaimer = () => (
  <p class="muted note">Os “saltos” são uma referência popular, não um diagnóstico nem um calendário garantido: nem todo bebê passa por todas as fases, nem nas mesmas semanas. Se algo preocupar você (febre, recusa de mamar, choro muito diferente do habitual), converse com o pediatra.</p>
);
