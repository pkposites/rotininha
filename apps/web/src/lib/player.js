// Toca os sons em laço com Web Audio (laço sem emenda, volume e fade). Para continuar com a tela bloqueada usa
// Audio Session ("playback") e Media Session quando o navegador oferece — o que precisa ser conferido em aparelho real.
import { generate, SR, N, DEFAULT_VOLUME, MAX_VOLUME } from './sounds.js';
import { ALL_SOUNDS } from './nature.js';

const decoded = new Map();
async function fileBuffer(def) {
  if (!decoded.has(def.id)) {
    const r = await fetch(def.file);
    if (!r.ok) throw new Error('Não foi possível carregar este som. Verifique a conexão e tente de novo.');
    decoded.set(def.id, await ctx.decodeAudioData(await r.arrayBuffer()));
  }
  return decoded.get(def.id);
}

let ctx = null, src = null, gain = null, timer = null, tick = null;
const state = { id: null, playing: false, volume: DEFAULT_VOLUME, endAt: null, error: null };
const subs = new Set();
const emit = () => { const s = { ...state }; subs.forEach((f) => f(s)); };
export const getState = () => ({ ...state });
export const subscribe = (f) => { subs.add(f); f(getState()); return () => subs.delete(f); };

async function ensureCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('Este navegador não consegue tocar os sons.');
  if (!ctx) { try { ctx = new AC({ sampleRate: SR }); } catch { ctx = new AC(); } }
  if (ctx.state === 'suspended') await ctx.resume();
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
}

function mediaSession(name) {
  try {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: name, artist: 'Ninhora', album: 'Sons para a soneca' });
    navigator.mediaSession.setActionHandler('pause', () => stop());
    navigator.mediaSession.setActionHandler('stop', () => stop());
  } catch {}
}

function killNow() {
  clearTimeout(timer); clearInterval(tick); timer = tick = null;
  try { src?.stop(); } catch {}
  try { src?.disconnect(); gain?.disconnect(); } catch {}
  src = gain = null;
}

export async function play(id) {
  const def = ALL_SOUNDS.find((s) => s.id === id); if (!def) return;
  state.error = null;
  try {
    await ensureCtx();
    const buf = def.file ? await fileBuffer(def) : (() => { const b = ctx.createBuffer(1, N, SR); b.copyToChannel(generate(id), 0); return b; })();
    killNow();
    src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    gain = ctx.createGain(); gain.gain.setValueAtTime(0, ctx.currentTime);
    src.connect(gain); gain.connect(ctx.destination); src.start();
    gain.gain.linearRampToValueAtTime(state.volume, ctx.currentTime + 1.5); // entra devagar
    Object.assign(state, { id, playing: true, endAt: null });
    mediaSession(def.name);
  } catch (e) { state.error = e.message || 'Não foi possível tocar agora.'; state.playing = false; }
  emit();
}

export function stop(fade = 1.2) {
  if (!state.playing) return;
  try { gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime); gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fade); } catch {}
  const s = src; setTimeout(() => { try { s?.stop(); } catch {} }, fade * 1000 + 100);
  clearTimeout(timer); clearInterval(tick); timer = tick = null;
  Object.assign(state, { playing: false, endAt: null });
  setTimeout(() => { if (!state.playing) killNow(); }, fade * 1000 + 200);
  emit();
}

export function setVolume(v) {
  state.volume = Math.max(0, Math.min(MAX_VOLUME, v));
  if (gain && state.playing) gain.gain.setTargetAtTime(state.volume, ctx.currentTime, 0.1);
  emit();
}

/** minutos = null → toca até parar. No fim, o som some em 20 s. */
export function setTimer(minutes) {
  clearTimeout(timer); clearInterval(tick);
  if (!minutes || !state.playing) { state.endAt = null; emit(); return; }
  state.endAt = Date.now() + minutes * 60_000;
  timer = setTimeout(() => stop(20), Math.max(0, minutes * 60_000 - 20_000));
  tick = setInterval(emit, 1000);
  emit();
}
