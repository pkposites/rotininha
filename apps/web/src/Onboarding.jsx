import { useState } from 'preact/hooks';
import { AGE_BANDS, TEMPLATES, tasksFromTemplates } from './lib/templates.js';
import { setPref } from './lib/prefs.js';
import { InstallGuide } from './InstallGuide.jsx';
import { pushState, enablePush } from './lib/push.js';
import { TYPES } from './lib/events.js';

// Tudo é opcional e pode ser pulado. A faixa etária fica só neste aparelho.
export function Onboarding({ store, rem, connected, onFinish }) {
  const [step, setStep] = useState('welcome');
  const [age, setAge] = useState(null);
  const [picked, setPicked] = useState(['noite']);
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

  return (
    <div class="onb" role="dialog" aria-modal="true" aria-label="Primeiros passos">
      <div class="onb-card">
        {step === 'welcome' && (
          <>
            <h1>Oi! Uma ajudinha na sua rotina 💜</h1>
            <p>Vamos deixar tudo pronto em 1 minuto. Você pode pular qualquer passo e mudar tudo depois.</p>
            <button class="btn" onClick={() => setStep('age')}>Vamos lá</button>
            <button class="link" onClick={finish}>Pular tudo</button>
          </>
        )}
        {step === 'age' && (
          <>
            <h2>Quantos meses tem o bebê?</h2>
            <p class="muted">Só para a gente se conhecer melhor. Fica apenas neste aparelho, e você pode não informar.</p>
            <div class="chips" role="group" aria-label="Faixa etária">
              {AGE_BANDS.map(([k, l]) => <button class="chip" aria-pressed={age === k} onClick={() => setAge(k)}>{l}</button>)}
            </div>
            <button class="btn" onClick={async () => { if (age) await setPref('ageBand', age); setStep('how'); }}>{age ? 'Continuar' : 'Prefiro não informar'}</button>
          </>
        )}
        {step === 'how' && (
          <>
            <h2>Como quer começar?</h2>
            <button class="btn" onClick={() => setStep('templates')}>Usar um modelo editável</button>
            <button class="btn ghost" onClick={() => setStep('first')}>Começar do zero</button>
          </>
        )}
        {step === 'templates' && (
          <>
            <h2>Escolha os modelos</h2>
            <p class="muted">Os horários são só exemplos para você ajustar — cada bebê e cada família têm o seu ritmo.</p>
            <ul class="tpl">
              {TEMPLATES.map((t) => (
                <li class="card">
                  <label class="inline"><input type="checkbox" checked={picked.includes(t.id)} onChange={() => toggle(t.id)} /> <strong>{t.icon} {t.title}</strong></label>
                  <p class="muted">{t.desc}</p>
                  {picked.includes(t.id) && t.items.map((it, i) => (
                    <label class="tpl-row">{it.title}
                      <input type="time" value={times[`${t.id}:${i}`] ?? it.time} onInput={(e) => setTimes({ ...times, [`${t.id}:${i}`]: e.target.value })} />
                    </label>
                  ))}
                </li>
              ))}
            </ul>
            <button class="btn" disabled={busy} onClick={createFromTemplates}>{picked.length ? 'Criar lembretes' : 'Continuar sem modelos'}</button>
          </>
        )}
        {step === 'first' && (
          <>
            <h2>Quer registrar o primeiro cuidado?</h2>
            <p class="muted">É só um toque. Você pode corrigir o horário depois.</p>
            <div class="actions">
              {['mamada', 'sono', 'fralda'].map((t) => (
                <button class="btn" disabled={logged} onClick={async () => { await store.quickLog(t); setLogged(true); }}>{TYPES[t].icon} {TYPES[t].label}</button>
              ))}
            </div>
            {logged && <p role="status" class="toast">Registrado! 💜</p>}
            <button class={logged ? 'btn' : 'link'} onClick={() => setStep('install')}>{logged ? 'Continuar' : 'Depois'}</button>
          </>
        )}
        {step === 'install' && (
          <>
            <h2>Instalar e ativar lembretes</h2>
            <p class="muted">Instalado, o Rotininha abre como um app e pode enviar lembretes.</p>
            <InstallGuide />
            {connected
              ? <button class="btn ghost" disabled={busy} onClick={async () => {
                  setBusy(true); setMsg('');
                  try { await enablePush(false); setMsg('Lembretes ativados! 🎉'); } catch (e) { setMsg(e.message); }
                  setBusy(false);
                }}>Ativar lembretes neste aparelho</button>
              : <p class="muted">Para receber lembretes no aparelho, conecte com o seu código em Ajustes (⚙️) — dá para fazer depois.</p>}
            {msg && <p role="status" class="muted">{msg}</p>}
            <p class="muted">Notificações dependem da instalação, da permissão e das configurações do aparelho.</p>
            <button class="btn" onClick={finish}>Concluir</button>
          </>
        )}
      </div>
    </div>
  );
}
