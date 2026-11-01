import { useState, useEffect } from 'preact/hooks';
import { subscribe, stop, getState } from './lib/player.js';
import { ALL_SOUNDS } from './lib/nature.js';

const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// Controle compacto do som que está tocando, visível em qualquer aba (menos na própria aba Sons).
export function MiniPlayer({ onOpen }) {
  const [st, setSt] = useState(getState());
  useEffect(() => subscribe(setSt), []);
  if (!st.playing) return null;
  const cur = ALL_SOUNDS.find((s) => s.id === st.id);
  return (
    <>
    <div class="mini-spacer" aria-hidden="true" />
    <div class="miniplayer" role="region" aria-label="Som tocando">
      <button class="mini-info" onClick={onOpen} aria-label={`Abrir controles de ${cur?.name ?? 'som'}`}>
        <span aria-hidden="true">{cur?.icon}</span>
        <span class="mini-txt"><strong>{cur?.name}</strong><small>{st.endAt ? `desliga em ${mmss(st.endAt - Date.now())}` : 'toca até você parar'}</small></span>
      </button>
      <button class="pill" onClick={() => stop()} aria-label="Parar o som">Parar</button>
    </div>
    </>
  );
}
