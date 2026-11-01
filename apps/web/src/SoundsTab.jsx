import { useState, useEffect } from 'preact/hooks';
import { TIMER_OPTIONS, MAX_VOLUME } from './lib/sounds.js';
import { ALL_SOUNDS, NATURE } from './lib/nature.js';
import { subscribe, play, stop, setVolume, setTimer, getState } from './lib/player.js';
import { getPref, setPref } from './lib/prefs.js';
import { count } from './lib/usage.js';

const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function SoundsTab() {
  const [st, setSt] = useState(getState());
  const [timer, setTimerSel] = useState(30);
  const [favs, setFavs] = useState([]);
  const [onlyFavs, setOnlyFavs] = useState(false);
  useEffect(() => subscribe(setSt), []);
  useEffect(() => { (async () => { const v = await getPref('soundVolume'); if (typeof v === 'number') setVolume(v); const t = await getPref('soundTimer', 30); setTimerSel(t); setFavs(await getPref('soundFavs', [])); })(); }, []);

  const tap = async (id) => {
    if (st.playing && st.id === id) return stop();
    await play(id); setTimer(timer); count('sound_played');
  };
  const pickTimer = async (m) => { setTimerSel(m); await setPref('soundTimer', m); setTimer(m); };
  const cur = ALL_SOUNDS.find((s) => s.id === st.id);
  const toggleFav = async (id) => { const n = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id]; setFavs(n); await setPref('soundFavs', n); };
  const list = onlyFavs ? ALL_SOUNDS.filter((x) => favs.includes(x.id)) : ALL_SOUNDS;

  return (
    <>
      <h1 class="h2s">Sons para descansar</h1>
      <section class="card notice info" aria-label="Antes de dar o play">
        <strong>Antes de dar o play</strong>
        <ul class="bullets"><li>Volume baixo, com o celular longe do bebê e fora do berço.</li><li>Sem fones no bebê. Pare se ele se incomodar.</li><li>Som não é tratamento nem garantia de sono.</li></ul>
        <details class="fold"><summary>Mais orientações</summary>
          <p>Não aumente o volume para cobrir o choro; confira primeiro o que ele precisa. Siga as orientações de sono seguro. O temporizador pode atrasar se o navegador for suspenso; não dependa dele para a segurança do bebê.</p>
        </details>
      </section>
      <div class="chips" role="group" aria-label="Filtrar sons">
        <button class="chip" aria-pressed={!onlyFavs} onClick={() => setOnlyFavs(false)}>Todos os sons</button>
        <button class="chip" aria-pressed={onlyFavs} onClick={() => setOnlyFavs(true)}>Meus favoritos ({favs.length})</button>
      </div>
      {onlyFavs && !list.length && <p class="muted">Você ainda não favoritou nenhum som. Toque em ♡ para guardar os que o bebê aceita melhor.</p>}
      {st.error && <p class="err" role="alert">{st.error}</p>}
      <ul class="sounds">
        {list.map((s) => {
          const on = st.playing && st.id === s.id;
          return (
            <li key={s.id}>
              <button class={`card sound${on ? ' on' : ''}`} aria-pressed={on} onClick={() => tap(s.id)} aria-label={`${s.name}. ${on ? 'Tocando. Toque para parar.' : 'Toque para ouvir.'}`}>
                <span class="sound-ico" aria-hidden="true">{s.icon}</span>
                <span class="sound-txt"><strong>{s.name}</strong><span class="muted">{s.desc}</span></span>
                <span class="sound-state" aria-hidden="true">{on ? '❚❚' : '▶'}</span>
              </button>
              <button class="link fav" aria-pressed={favs.includes(s.id)} aria-label={`${favs.includes(s.id) ? 'Remover dos favoritos' : 'Favoritar'}: ${s.name}`} onClick={() => toggleFav(s.id)}>{favs.includes(s.id) ? '♥ Favorito' : '♡ Favoritar'}</button>
            </li>
          );
        })}
      </ul>

      {st.playing && cur && (
        <section class="card player" aria-label="Tocando agora">
          <div class="card-head"><strong>{cur.icon} {cur.name}</strong><button class="pill" onClick={() => stop()}>Parar</button></div>
          <label class="vol">Volume
            <input type="range" min="0" max={MAX_VOLUME} step="0.01" value={st.volume} onInput={(e) => setVolume(Number(e.target.value))} onChange={(e) => setPref('soundVolume', Number(e.target.value))} aria-label="Volume" />
          </label>
          <div class="chips" role="group" aria-label="Desligar sozinho">
            {TIMER_OPTIONS.map((m) => <button class="chip" aria-pressed={timer === m} onClick={() => pickTimer(m)}>{m >= 60 ? `${m / 60} h` : `${m} min`}</button>)}
            <button class="chip" aria-pressed={timer === null} onClick={() => pickTimer(null)}>Até parar</button>
          </div>
          <p class="muted" role="status">{st.endAt ? `Desliga em ${mmss(st.endAt - Date.now())}` : 'Toca até você parar.'}</p>
        </section>
      )}
      <p class="muted">Os sons se repetem até o temporizador terminar. Não há reprodução automática. Sair desta aba não interrompe o som, mas a reprodução com a tela bloqueada depende do aparelho.</p>
      <details class="credits"><summary>Créditos e licença dos áudios</summary>
        <p>Riacho, Vento e Pássaros são gravações CC0 (reutilização permitida, sem royalties), recortadas e convertidas para MP3 e distribuídas com o app:</p>
        <ul>{NATURE.map((n) => <li>{n.name} — <a href={n.url} target="_blank" rel="noopener noreferrer">{n.credit}</a> · CC0</li>)}</ul>
        <p>Os demais sons (ruído branco, chuva, ondas, batimentos e caixinha de música) são gerados pelo próprio app.</p>
        <p><a href="/audio/LICENCAS.txt" target="_blank" rel="noopener">Licença e origem dos arquivos</a></p>
      </details>
      <p class="muted">Dica: se a tela bloquear e o som parar, abra o app e toque de novo. Nos aparelhos da Apple, a reprodução com a tela bloqueada depende da versão do sistema.</p>
    </>
  );
}
