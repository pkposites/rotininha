import { useState, useEffect } from 'preact/hooks';
import { LESSONS, GUIDE_REVIEWED, unlockedLessons, guideAccessible, SAFE_SLEEP_ITEMS, RITUAL_DEFAULTS, lessonByDay } from './lib/guide.js';
import { getPref, setPref } from './lib/prefs.js';
import { localParts } from '../../../packages/shared/schedule.js';
import { FLAGS } from './config.js';

const REMINDER_ID = 'guide-lesson-reminder';

export function GuideTab({ rem, account, now, onCreateTask, onGoToday, onSuggest, onRenew }) {
  const [start, setStart] = useState(null);
  const [done, setDone] = useState([]);
  const [finished, setFinished] = useState(false);
  const [open, setOpen] = useState(null);
  const [checks, setChecks] = useState({});      // { 'safe-sleep': [bool], ritual: [bool] }
  const [ritual, setRitual] = useState(RITUAL_DEFAULTS);
  const [newStep, setNewStep] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      let s = await getPref('guideStart');
      if (!s) { s = localParts(Date.now(), rem.tz).date; await setPref('guideStart', s); }
      setStart(s);
      setDone(await getPref('guideDone', []));
      setFinished(await getPref('guideFinished', false));
      setChecks(await getPref('guideChecks', {}));
      setRitual(await getPref('guideRitual', RITUAL_DEFAULTS));
      setLoaded(true);
    })();
  }, []);

  if (!loaded) return null;
  const accessible = guideAccessible(account);
  const unlocked = unlockedLessons(start, now, rem.tz);
  const reminderOn = rem.tasks.some((t) => t.id === REMINDER_ID && !t.deleted);

  const toggleReminder = async () => {
    if (reminderOn) return rem.removeTask(REMINDER_ID);
    await rem.saveTask({ id: REMINDER_ID, title: 'Lição do Guia', category: 'outro', time: '20:00', repeat: 'daily', days: [], date: null, leadMin: 0, notify: true, allowQuiet: false, updatedAt: Date.now() });
  };
  const markDone = async (day) => { const n = [...new Set([...done, day])]; setDone(n); await setPref('guideDone', n); };
  const setCheck = async (key, i, v) => {
    const arr = [...(checks[key] ?? [])]; arr[i] = v;
    const next = { ...checks, [key]: arr }; setChecks(next); await setPref('guideChecks', next);
  };
  const saveRitual = async (r) => { setRitual(r); await setPref('guideRitual', r); };

  if (finished && open === 'finish') {
    return (
      <section class="card">
        <h2>Primeira semana concluída 🎉</h2>
        <p>Parabéns pelo cuidado! Seus registros e lembretes continuam aqui.</p>
        <div class="stack">
          <button class="btn" onClick={onGoToday}>Voltar para o Hoje</button>
          <button class="btn ghost" onClick={onSuggest}>Contar o que ajudaria na sua rotina</button>
          {FLAGS.payments && onRenew && <button class="btn ghost" onClick={onRenew}>Continuar com o acesso</button>}
          <button class="link" onClick={() => setOpen(null)}>Rever as lições</button>
        </div>
      </section>
    );
  }

  if (open != null && typeof open === 'number') {
    const l = lessonByDay(open); const a = l.action;
    return (
      <section class="card lesson">
        <button class="link" onClick={() => setOpen(null)}>← Todas as lições</button>
        <p class="muted">Dia {l.day} · {l.minutes} min de leitura</p>
        <h2>{l.title}</h2>
        {l.body.map((p) => <p>{p}</p>)}

        {a.type === 'task' && <button class="btn" onClick={() => onCreateTask(a.task)}>{a.label}</button>}
        {a.type === 'go-today' && <button class="btn" onClick={onGoToday}>{a.label}</button>}
        {a.type === 'checklist' && (
          <div class="stack" role="group" aria-label={a.label}>
            <h3>{a.label}</h3>
            {SAFE_SLEEP_ITEMS.map((it, i) => (
              <label class="inline"><input type="checkbox" checked={!!checks[a.key]?.[i]} onChange={(e) => setCheck(a.key, i, e.target.checked)} /> {it}</label>
            ))}
            <p class="muted">Siga sempre a orientação do pediatra. Fonte: recomendações de sono seguro da Sociedade Brasileira de Pediatria.</p>
          </div>
        )}
        {a.type === 'ritual' && (
          <div class="stack">
            <h3>Meu ritual da noite</h3>
            {ritual.map((it, i) => (
              <div class="rit-row">
                <label class="inline"><input type="checkbox" checked={!!checks.ritual?.[i]} onChange={(e) => setCheck('ritual', i, e.target.checked)} /> {it}</label>
                <button class="link" aria-label={`Remover ${it}`} onClick={() => saveRitual(ritual.filter((_, j) => j !== i))}>remover</button>
              </div>
            ))}
            <div class="row">
              <input value={newStep} maxLength={60} placeholder="Acrescentar um passo" onInput={(e) => setNewStep(e.target.value)} />
              <button class="btn ghost" onClick={() => { if (newStep.trim()) { saveRitual([...ritual, newStep.trim()]); setNewStep(''); } }}>Adicionar</button>
            </div>
            <button class="btn" onClick={() => onCreateTask(a.task)}>Criar lembrete do ritual</button>
          </div>
        )}
        {a.type === 'finish' && (
          <button class="btn" onClick={async () => { await markDone(7); await setPref('guideFinished', true); setFinished(true); setOpen('finish'); }}>{a.label}</button>
        )}

        {a.type !== 'finish' && (
          <button class={done.includes(l.day) ? 'btn ghost' : 'btn ghost'} onClick={() => markDone(l.day)}>{done.includes(l.day) ? '✓ Lição concluída' : 'Marcar lição como concluída'}</button>
        )}
      </section>
    );
  }

  return (
    <>
      <h2>Rotina e Sono em 7 Dias</h2>
      <p class="muted">Uma lição curta por dia (1–2 minutos), sempre com uma ação opcional. Conteúdo educativo: não substitui a orientação do pediatra.</p>
      {!GUIDE_REVIEWED && <p class="card notice info" role="note">Versão preliminar do conteúdo, ainda em revisão por profissional de saúde.</p>}
      {!accessible && <p class="card notice warn" role="status">Seu acesso venceu, então as lições ficam em pausa. Seus registros continuam disponíveis.</p>}
      <ul class="lessons">
        {LESSONS.map((l) => {
          const locked = l.day > unlocked || !accessible;
          return (
            <li key={l.day}>
              <button class="card lesson-item" disabled={locked} onClick={() => setOpen(l.day)} aria-label={`Dia ${l.day}: ${l.title}${locked ? (l.day > unlocked ? ' (libera em breve)' : ' (em pausa)') : ''}`}>
                <span class="ico" aria-hidden="true">{done.includes(l.day) ? '✓' : locked ? '🔒' : l.day}</span>
                <span><strong>{l.title}</strong><br /><small class="muted">{locked && l.day > unlocked ? `Libera no dia ${l.day}` : `${l.minutes} min`}</small></span>
              </button>
            </li>
          );
        })}
      </ul>
      <label class="inline"><input type="checkbox" checked={reminderOn} onChange={toggleReminder} /> Lembrar-me da lição todo dia às 20h (opcional)</label>
      {finished && <button class="btn ghost" onClick={() => setOpen('finish')}>Ver conclusão</button>}
    </>
  );
}
