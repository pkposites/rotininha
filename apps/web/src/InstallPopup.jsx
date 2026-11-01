import { useState, useEffect } from 'preact/hooks';
import { DEVICES, BROWSERS, stepsFor, guessChoice, oneClick } from './lib/installSteps.js';
import { canPrompt, onPromptChange, promptInstall } from './lib/install-prompt.js';
import { getPref, setPref } from './lib/prefs.js';
import { count } from './lib/usage.js';
import './install.css';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const LINK = () => location.origin + '/app/';

// Animação do passo a passo (só CSS + troca de passo). Decorativa: o texto ao lado diz tudo.
function Phone({ step, steps }) {
  const s = steps[step];
  return (
    <div class="hw-phone" aria-hidden="true" data-scene={s.scene} data-target={s.target ?? ''}>
      <div class="hw-notch" />
      <div class={`hw-screen sc-${s.scene}`}>
        {(s.scene === 'bar-top') && <div class="hw-bar top"><span class="hw-url">ninhora</span><span class={`hw-btn ${s.target}`}>{s.target === 'dots' ? '⋮' : '⬆'}</span></div>}
        {(s.scene === 'bar-bottom') && <><div class="hw-page"><i /><i /><i /></div><div class="hw-bar bottom"><span class="hw-url">ninhora</span><span class={`hw-btn ${s.target}`}>{s.target === 'menu' ? '☰' : '⬆'}</span></div></>}
        {s.scene === 'menu' && (
          <div class="hw-sheet">
            <div class="hw-row dim" /><div class="hw-row dim" />
            <div class="hw-row hit">{s.row}</div>
            <div class="hw-row dim" />
          </div>
        )}
        {s.scene === 'confirm' && (
          <div class="hw-dialog"><div class="hw-appicon big">N</div><b>Ninhora</b><span class="hw-ok">{s.ok}</span></div>
        )}
        {s.scene === 'home' && (
          <div class="hw-home">{Array.from({ length: 7 }, (_, i) => <div class="hw-appicon dim" key={i} />)}<div class="hw-appicon new">N<small>Ninhora</small></div></div>
        )}
        {s.scene !== 'home' && <span class="hw-tap" />}
      </div>
    </div>
  );
}

export function InstallPopup({ onClose }) {
  const g = guessChoice();
  const [device, setDevice] = useState(g.device);
  const [browser, setBrowser] = useState(g.browser);
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState('');
  const [, tick] = useState(0);
  useEffect(() => onPromptChange(() => tick((n) => n + 1)), []);
  useEffect(() => { (async () => { const c = await getPref('installChoice'); if (c && !g.known) { setDevice(c.device); setBrowser(c.browser); } })(); }, []);
  const steps = stepsFor(device, browser);
  useEffect(() => { setStep(0); }, [device, browser]);
  useEffect(() => {
    if (reduced()) return;
    const i = setInterval(() => setStep((n) => (n + 1) % steps.length), 3200);
    return () => clearInterval(i);
  }, [device, browser]);

  const choose = (d, b) => { setDevice(d); setBrowser(b); setPref('installChoice', { device: d, browser: b }); count('install_choice'); };
  const action = oneClick(device, browser, canPrompt(), typeof navigator.share === 'function');
  const copy = async () => { try { await navigator.clipboard.writeText(LINK()); setMsg('Link copiado. Cole no navegador do celular.'); } catch { setMsg('Não deu para copiar. Selecione o endereço do app e copie à mão.'); } };
  const run = async () => {
    setMsg('');
    if (action === 'install') { const ok = await promptInstall(); if (ok) { await setPref('installDismissed', true); setMsg('Instalado! Abra o Ninhora pelo ícone da tela inicial.'); } return; }
    if (action === 'share') { try { await navigator.share({ title: 'Ninhora', url: LINK() }); setMsg('Agora toque em “Adicionar à Tela de Início”, como no passo 2.'); } catch { /* cancelou */ } return; }
    if (action === 'copy') return copy();
  };
  const later = async () => { await setPref('installSnoozeUntil', Date.now() + 3 * 86_400_000); onClose(); };
  const done = async () => { await setPref('installDismissed', true); onClose(); };

  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && later()}>
      <div class="sheet install-pop" role="dialog" aria-modal="true" aria-label="Instalar o Ninhora na tela inicial">
        <h2>📲 Leve o Ninhora para a tela inicial</h2>
        <p class="muted">Abre como um app, sem procurar o link. No iPhone, é assim que os lembretes chegam.</p>

        <div class="stack" role="group" aria-label="Qual é o seu celular?">
          <strong>Qual é o seu celular?</strong>
          <div class="chips">{DEVICES.map(([d, l]) => <button class="chip" aria-pressed={device === d} onClick={() => choose(d, BROWSERS[d][0][0])}>{l}</button>)}</div>
          <strong>E o navegador?</strong>
          <div class="chips">{BROWSERS[device].map(([b, l]) => <button class="chip" aria-pressed={browser === b} onClick={() => choose(device, b)}>{l}</button>)}</div>
        </div>

        {action === 'install' && <button class="btn" onClick={run}>Instalar agora (1 toque)</button>}
        {action === 'share' && <button class="btn" onClick={run}>Abrir o menu de compartilhar</button>}
        {action === 'copy' && <button class="btn" onClick={run}>Copiar o link do app</button>}
        {browser === 'inapp' && <p class="muted">Dentro do Instagram ou Facebook não dá para instalar: abra o link no navegador do celular primeiro.</p>}
        {device === 'ios' && browser === 'chrome' && <p class="muted">Se “Adicionar à Tela de Início” não aparecer no Chrome, copie o link e abra no Safari.</p>}
        <p role="status" class="muted">{msg}</p>

        <div class="hw">
          <Phone step={step} steps={steps} />
          <ol class="hw-steps">
            {steps.map((s, i) => (
              <li key={i} aria-current={i === step ? 'step' : undefined} class={i === step ? 'on' : ''}>
                <button class="hw-stepbtn" onClick={() => setStep(i)}><strong>{i + 1}. {s.t}</strong><small>{s.sub}</small></button>
              </li>
            ))}
          </ol>
        </div>

        <div class="row">
          <button class="btn ghost" onClick={done}>Já instalei</button>
          <button class="link" onClick={later}>Agora não</button>
        </div>
      </div>
    </div>
  );
}
