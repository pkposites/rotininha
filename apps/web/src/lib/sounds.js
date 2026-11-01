// Sons para a soneca, sintetizados no próprio app: sem arquivos de terceiros (sem licença a respeitar), funcionam offline
// e fecham o laço sem emenda. Determinísticos (mesma semente → mesmo som). Nada aqui promete efeito terapêutico.

export const SR = 22050;
export const LOOP_SECONDS = 24;
export const N = SR * LOOP_SECONDS;

export const SOUNDS = [
  { id: 'ruido-branco', name: 'Ruído branco', icon: '🌫️', desc: 'Chiado contínuo e suave, como um ventilador distante.' },
  { id: 'chuva', name: 'Chuva', icon: '🌧️', desc: 'Chuva constante, com pingos leves.' },
  { id: 'ondas', name: 'Ondas do mar', icon: '🌊', desc: 'Ondas que vão e voltam devagar.' },
  { id: 'batimentos', name: 'Batimentos', icon: '💓', desc: 'Batimento calmo com um som grave de fundo, lembrando o aconchego do colo.' },
  { id: 'caixinha', name: 'Caixinha de música', icon: '🎵', desc: 'Melodia simples e lenta, tocada numa caixinha de música.' }
];

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const white = (r) => r() * 2 - 1;

function lowpass(x, fc) { const a = 1 - Math.exp(-2 * Math.PI * fc / SR); const y = new Float32Array(x.length); let s = 0; for (let i = 0; i < x.length; i++) { s += a * (x[i] - s); y[i] = s; } return y; }
function highpass(x, fc) { const l = lowpass(x, fc); const y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) y[i] = x[i] - l[i]; return y; }
function pink(len, r) { // Paul Kellet
  const y = new Float32Array(len); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = white(r);
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    y[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  return y;
}
function brown(len, r) { const y = new Float32Array(len); let s = 0; for (let i = 0; i < len; i++) { s = (s + 0.02 * white(r)) / 1.0004; y[i] = s * 3.5; } return y; }

/** Fecha o laço: o final se mistura (potência igual) ao começo, então o fim emenda no início sem estalo. */
function seamless(x, fade = SR * 2) {
  const out = new Float32Array(N);
  for (let i = fade; i < N; i++) out[i] = x[i];
  for (let i = 0; i < fade; i++) { const w = (i / fade) * Math.PI / 2; out[i] = x[i] * Math.sin(w) + x[N + i] * Math.cos(w); } // x[N+i] continua x[N-1]
  return out;
}
function normalize(x, rms, peak = 0.9) {
  let e = 0; for (let i = 0; i < x.length; i++) e += x[i] * x[i];
  const g0 = rms / Math.sqrt(e / x.length || 1e-9);
  let p = 0; for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i] * g0));
  const g = p > peak ? g0 * (peak / p) : g0;
  for (let i = 0; i < x.length; i++) x[i] *= g;
  return x;
}
const TAIL = N + SR * 2; // geramos um pouco a mais para fechar o laço

function genWhite() {
  const r = rng(11); const x = new Float32Array(TAIL); for (let i = 0; i < TAIL; i++) x[i] = white(r);
  return normalize(seamless(highpass(lowpass(x, 7000), 60)), 0.1);
}

function genRain() {
  const r = rng(22); const bed = lowpass(pink(TAIL, r), 9000);
  const drops = new Float32Array(TAIL); const per = 45 / SR; // ~45 pingos por segundo
  for (let i = 0; i < TAIL; i++) if (r() < per) { const a = 0.25 + r() * 0.75, f = 1800 + r() * 3200, len = 160 + Math.floor(r() * 220);
    for (let k = 0; k < len && i + k < TAIL; k++) drops[i + k] += a * Math.exp(-k / (len / 5)) * Math.sin(2 * Math.PI * f * k / SR); }
  const x = new Float32Array(TAIL); for (let i = 0; i < TAIL; i++) x[i] = bed[i] * 1.0 + drops[i] * 0.35;
  return normalize(seamless(highpass(x, 120)), 0.1);
}

function genWaves() {
  const r = rng(33); const base = pink(TAIL, r), low = lowpass(base, 500), high = lowpass(base, 3200);
  const x = new Float32Array(TAIL);
  for (let i = 0; i < TAIL; i++) {
    const t = i / SR;                                           // 24 s = 3 ondas de 8 s e 4 de 6 s (fecham o laço)
    const s1 = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / 8 - 1.2), s2 = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / 6 + 0.7);
    const env = 0.18 + 0.82 * Math.pow(0.65 * s1 + 0.35 * s2, 2);
    x[i] = (low[i] + env * (high[i] - low[i])) * (0.35 + 0.65 * env);
  }
  return normalize(seamless(x), 0.1);
}

function genHeartbeat() {
  const r = rng(44), bpm = 80, period = SR * 60 / bpm;           // 32 batimentos em 24 s (o laço fecha no ritmo)
  const bed = seamless(lowpass(brown(TAIL, r), 260));            // fundo grave contínuo
  const beats = new Float32Array(N);
  const thump = (at, f, a, dec) => { const len = Math.floor(SR * 0.4); for (let k = 0; k < len; k++) beats[(at + k) % N] += a * Math.exp(-k / (SR * dec)) * Math.sin(2 * Math.PI * f * k / SR); };
  for (let b = 0; b < 32; b++) { const at = Math.round(b * period); thump(at, 58, 1.0, 0.05); thump(at + Math.round(SR * 0.27), 46, 0.65, 0.045); }
  const x = new Float32Array(N); for (let i = 0; i < N; i++) x[i] = bed[i] * 0.12 + beats[i];
  return normalize(x, 0.12);
}

// Melodia ORIGINAL (domínio livre de qualquer direito): 8 compassos de 3/4 a 60 bpm = 24 s.
const MELODY = [76, 79, 76, 74, 72, 67, 69, 72, 74, 76, 0, 0, 79, 76, 79, 81, 79, 76, 74, 72, 74, 72, 0, 0]; // 0 = pausa
function genMusicBox() {
  const x = new Float32Array(N), beat = SR; // 1 s por tempo
  MELODY.forEach((m, i) => {
    if (!m) return; const f = 440 * Math.pow(2, (m - 69) / 12), at = i * beat, len = Math.floor(SR * 3.2);
    for (let k = 0; k < len; k++) {
      const t = k / SR, env = Math.min(1, k / (SR * 0.004)) * Math.exp(-t / 0.85);
      const v = env * (Math.sin(2 * Math.PI * f * t) + 0.32 * Math.sin(2 * Math.PI * f * 2.0 * t) * Math.exp(-t / 0.35) + 0.14 * Math.sin(2 * Math.PI * f * 4.1 * t) * Math.exp(-t / 0.12));
      x[(at + k) % N] += v * 0.5; // a ressonância do fim volta ao começo: laço sem emenda
    }
  });
  return normalize(x, 0.06, 0.6);
}

const GEN = { 'ruido-branco': genWhite, chuva: genRain, ondas: genWaves, batimentos: genHeartbeat, caixinha: genMusicBox };
const cache = new Map();
/** Um ciclo de 24 s (mono, 22,05 kHz), pronto para tocar em laço. */
export function generate(id) {
  if (!GEN[id]) throw new Error('som desconhecido: ' + id);
  if (!cache.has(id)) cache.set(id, GEN[id]());
  return cache.get(id);
}

/** WAV PCM16 mono (para quem preferir um <audio> comum). */
export function toWav(samples, sr = SR) {
  const n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true);
  return new Uint8Array(buf);
}

export const TIMER_OPTIONS = [5, 15, 30, 60]; // minutos (além de "até parar")
export const DEFAULT_VOLUME = 0.15, MAX_VOLUME = 0.8;
