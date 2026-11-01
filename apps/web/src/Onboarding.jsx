import { useState } from 'preact/hooks';
import { AGE_BANDS, TEMPLATES, tasksFromTemplates } from './lib/templates.js';
import { setPref } from './lib/prefs.js';
import { InstallGuide } from './InstallGuide.jsx';
import { enablePush } from './lib/push.js';
import { TYPES } from './lib/events.js';
import { TrialFlow } from './TrialFlow.jsx';
import { syncAvailable } from './lib/sync.js';


function Shell({ step, emoji, title, lead, children, actions }) {
  return (
    <>
      <div class={`onb-body${step === 'welcome' ? ' center' : ''}`} key={step}>
        <div class="onb-hero" aria-hidden="true">{emoji}</div>
        {step === 'welcome' ? <h1>{title}</h1> : <h2>{title}</h2>}
        {lead && <p class="onb-lead">{lead}</p>}
        {children}
      </div>
      <div class="onb-actions">{actions}</div>
    </>
  );
}

// Tela cheia, um passo por vez, botão principal sempre ao alcance do polegar. Tudo é opcional.
// A faixa etária fica só neste aparelho.
export function Onboarding({ store, rem, connected, onFinish }) {
  const [step, setStep] = useState('welcome');
  const [age, setAge] = useState(null);
  const [picked, setPicked] = useState(['noite']);
  const [helpOpen, setHelpOpen] = useState(null);
  const [times, setTimes] = useState({});
  const [logged, setLogged] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = async () => { await setPref('onboardingDone', true); onFinish(); };
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const createFromTemplates = async () => {
    setBusy(true);
    for (const t of tasksFromTemplates(picked, times)) await rem.saveTask(t);
    setBusy(false); setStep('first');
  };
  const withTrial = syncAvailable && !connected;
  const ORDER = withTrial ? ['welcome', 'age', 'how', 'first', 'trial', 'install'] : ['welcome', 'age', 'how', 'first', 'install'];
  const afterFirst = () => setStep(withTrial ? 'trial' : 'install');
  const idx = ORDER.indexOf(step === 'templates' ? 'how' : step);

  return (
    <div class="onb" role="dialog" aria-modal="true" aria-label="Primeiros passos">
      <div class="onb-card">
        <div class="onb-top">
          <div class="dots" aria-hidden="true">{ORDER.map((s, i) => <span class={`dot${i === idx ? ' on' : ''}`} />)}</div>
          {step !== 'welcome' && <button class="link" onClick={finish}>Pular</button>}
        </div>

        {step === 'welcome' && (
          <Shell step={step} emoji="💜" title="Oi! Uma ajudinha na sua rotina" lead="Vamos deixar tudo pronto em 1 minuto. Você pode pular qualquer passo e mudar tudo depois."
            actions={<><button class="btn" onClick={() => setStep('age')}>Vamos lá</button><button class="link" onClick={finish}>Pular tudo</button></>} />
        )}

        {step === 'age' && (
          <Shell step={step} emoji="🍼" title="Quantos meses tem o bebê?" lead="Só para a gente se conhecer melhor. Fica apenas neste aparelho, e você pode não informar."
            actions={<button class="btn" onClick={async () => { if (age) await setPref('ageBand', age); setStep('how'); }}>{age ? 'Continuar' : 'Prefiro não informar'}</button>}>
            <div class="chips" role="group" aria-label="Faixa etária">
              {AGE_BANDS.map(([k, l]) => <button class="chip" aria-pressed={age === k} onClick={() => setAge(k)}>{l}</button>)}
            </div>
          </Shell>
        )}

        {step === 'how' && (
          <Shell step={step} emoji="✨" title="Comece por aqui" lead="O Ninhora ajuda você a lembrar do que o seu bebê precisa e a registrar o dia dele, de um jeito simples."
            actions={<button class="btn" onClick={() => setStep('templates')}>Usar um modelo editável</button>}>
            <ul class="how-list">
              <li><span aria-hidden="true">🍼</span><span><strong>Registre em um toque</strong><br />Mamadas, sono e fraldas, com o horário certinho.</span></li>
              <li><span aria-hidden="true">🔔</span><span><strong>Receba lembretes</strong><br />Banho, remédio conforme orientação, consulta… Você escolhe os horários.</span></li>
              <li><span aria-hidden="true">🕘</span><span><strong>Veja o dia de relance</strong><br />O que já foi feito e o que vem a seguir.</span></li>
            </ul>
            <p class="muted">Para começar, vamos sugerir alguns <strong>modelos de lembretes</strong>. São só um ponto de partida: você ajusta os horários e apaga o que não fizer sentido.</p>
          </Shell>
        )}

        {step === 'templates' && (
          <Shell step={step} emoji="🗓️" title="Escolha os modelos" lead="Modelos são lembretes prontos que se repetem todo dia, para você não precisar guardar tudo de cabeça. Marque os que fizerem sentido, ajuste o horário e toque em “Criar lembretes”. Depois dá para editar ou apagar quando quiser, na tela Hoje. Cada bebê e cada família têm o seu ritmo: os horários são só exemplos."
            actions={<button class="btn" disabled={busy} onClick={createFromTemplates}>{picked.length ? 'Criar lembretes' : 'Continuar sem modelos'}</button>}>
            <ul class="tpl">
              {TEMPLATES.map((t) => (
                <li class="card">
                  <div class="tpl-head">
                    <label class="inline"><input type="checkbox" checked={picked.includes(t.id)} onChange={() => toggle(t.id)} /> <span>{t.icon} {t.title}</span></label>
                    <button type="button" class="help-btn" aria-expanded={helpOpen === t.id} aria-controls={`help-${t.id}`} aria-label={`O que é ${t.title}?`} onClick={() => setHelpOpen(helpOpen === t.id ? null : t.id)}>?</button>
                  </div>
                  <p class="muted">{t.desc}</p>
                  {helpOpen === t.id && <p id={`help-${t.id}`} class="help-text" role="note">{t.help}</p>}
                  {picked.includes(t.id) && t.items.map((it, i) => (
                    <label class="tpl-row">{it.title}
                      <input type="time" value={times[`${t.id}:${i}`] ?? it.time} onInput={(e) => setTimes({ ...times, [`${t.id}:${i}`]: e.target.value })} />
                    </label>
                  ))}
                </li>
              ))}
            </ul>
          </Shell>
        )}

        {step === 'first' && (
          <Shell step={step} emoji="👶" title="Quer registrar o primeiro cuidado?" lead="É só um toque. Você pode corrigir o horário depois."
            actions={<button class={logged ? 'btn' : 'link'} onClick={afterFirst}>{logged ? 'Continuar' : 'Depois'}</button>}>
            <div class="actions">
              {['mamada', 'sono', 'fralda'].map((t) => (
                <button class={`qa qa-${t}`} disabled={logged} onClick={async () => { await store.quickLog(t); setLogged(true); }}>
                  <span class="qa-ico" aria-hidden="true">{TYPES[t].icon}</span><span>{TYPES[t].label === 'Mamada' ? 'Mamou' : TYPES[t].label === 'Sono' ? 'Dormiu' : 'Fralda'}</span>
                </button>
              ))}
            </div>
            {logged && <p role="status" class="toast">Registrado! 💜</p>}
          </Shell>
        )}

        {step === 'trial' && (
          <Shell step={step} emoji="🎁" title="Guardar seus registros" actions={<></>}>
            <TrialFlow compact onDone={() => setStep('install')} onSkip={() => setStep('install')} />
          </Shell>
        )}

        {step === 'install' && (
          <Shell step={step} emoji="📲" title="Instalar e ativar lembretes" lead="Instalado, o Ninhora abre como um app e pode enviar lembretes."
            actions={<button class="btn" onClick={finish}>Concluir</button>}>
            <div class="card"><InstallGuide /></div>
            {connected
              ? <button class="btn ghost" disabled={busy} onClick={async () => {
                  setBusy(true); setMsg('');
                  try { await enablePush(false); setMsg('Lembretes ativados! 🎉'); } catch (e) { setMsg(e.message); }
                  setBusy(false);
                }}>Ativar lembretes neste aparelho</button>
              : <p class="muted">Para receber lembretes no aparelho, conecte com o seu código em Ajustes — dá para fazer depois.</p>}
            {msg && <p role="status" class="muted">{msg}</p>}
            <p class="muted">Notificações dependem da instalação, da permissão e das configurações do aparelho.</p>
          </Shell>
        )}
      </div>
    </div>
  );
}
