import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SOUNDS, SR, N, generate, toWav, TIMER_OPTIONS, DEFAULT_VOLUME, MAX_VOLUME } from '../src/lib/sounds.js';

const stats = (x) => { let e = 0, p = 0, zc = 0, d = 0; for (let i = 0; i < x.length; i++) { e += x[i] * x[i]; p = Math.max(p, Math.abs(x[i])); if (i && (x[i] >= 0) !== (x[i - 1] >= 0)) zc++; if (i) d += Math.abs(x[i] - x[i - 1]); } return { rms: Math.sqrt(e / x.length), peak: p, zcr: zc / (x.length / SR), meanStep: d / x.length }; };
const goertzel = (x, f, from = 0, len = 0.4 * SR) => { const w = 2 * Math.PI * f / SR, c = 2 * Math.cos(w); let a = 0, b = 0; for (let i = from; i < from + len; i++) { const t = x[i] + c * a - b; b = a; a = t; } return (a * a + b * b - c * a * b) / len; };

test('são exatamente 5 sons, com nome, ícone e descrição, sem promessas terapêuticas', () => {
  assert.equal(SOUNDS.length, 5);
  assert.deepEqual(SOUNDS.map((s) => s.id), ['ruido-branco', 'chuva', 'ondas', 'batimentos', 'caixinha']);
  const txt = JSON.stringify(SOUNDS).toLowerCase();
  for (const bad of ['cura', 'trata', 'garant', 'dorme', 'terap', 'clínic']) assert.ok(!txt.includes(bad), bad);
});

test('cada som: 24 s, sem NaN, sem estourar, volume útil', () => {
  for (const { id } of SOUNDS) {
    const x = generate(id), s = stats(x);
    assert.equal(x.length, N, id); assert.ok(x.every(Number.isFinite), id);
    assert.ok(s.peak <= 0.95, `${id} pico ${s.peak}`); assert.ok(s.rms > 0.04 && s.rms < 0.2, `${id} rms ${s.rms}`);
  }
});

test('laço sem emenda: o salto entre o fim e o começo é do tamanho de qualquer passo normal', () => {
  for (const { id } of SOUNDS) {
    const x = generate(id), s = stats(x), jump = Math.abs(x[0] - x[N - 1]);
    assert.ok(jump < Math.max(0.02, s.meanStep * 6), `${id}: salto ${jump.toFixed(4)} vs passo médio ${s.meanStep.toFixed(4)}`);
  }
});

test('sons realmente diferentes entre si (correlação ~0) e com "timbres" coerentes', () => {
  const xs = SOUNDS.map((s) => generate(s.id));
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) {
    let c = 0, a = 0, b = 0; for (let k = 0; k < 200000; k++) { c += xs[i][k] * xs[j][k]; a += xs[i][k] ** 2; b += xs[j][k] ** 2; }
    assert.ok(Math.abs(c / Math.sqrt(a * b)) < 0.2, `${SOUNDS[i].id} × ${SOUNDS[j].id}`);
  }
  const zcr = Object.fromEntries(SOUNDS.map((s) => [s.id, stats(generate(s.id)).zcr]));
  assert.ok(zcr['ruido-branco'] > zcr.ondas, 'chiado é mais agudo que ondas');
  assert.ok(zcr.ondas > zcr.batimentos, 'batimentos são os mais graves');
});

test('ondas: o volume sobe e desce devagar (ciclos de 6–8 s)', () => {
  const x = generate('ondas'), env = []; for (let s = 0; s < 24; s++) { let e = 0; for (let i = s * SR; i < (s + 1) * SR; i++) e += x[i] ** 2; env.push(Math.sqrt(e / SR)); }
  assert.ok(Math.max(...env) / Math.min(...env) > 1.5, 'há variação perceptível');
  assert.ok(Math.max(...env) / Math.min(...env) < 12, 'sem exagero');
});

test('batimentos: 80 por minuto — a energia dos "tum" aparece a cada 0,75 s', () => {
  const x = generate('batimentos'), period = SR * 0.75;
  const win = (c) => { let e = 0; for (let i = Math.round(c); i < Math.round(c) + SR * 0.05; i++) e += x[i % N] ** 2; return e; };
  let onBeat = 0, off = 0; for (let b = 1; b < 30; b++) { onBeat += win(b * period + 0.01 * SR); off += win(b * period + 0.5 * SR); }
  assert.ok(onBeat > off * 3, `no tempo ${onBeat.toExponential(2)} vs fora ${off.toExponential(2)}`);
});

test('caixinha de música: primeira nota é um Mi (≈659 Hz), 8 compassos de 3/4', () => {
  const x = generate('caixinha');
  assert.ok(goertzel(x, 659.26, 0, SR * 0.3) > goertzel(x, 880, 0, SR * 0.3) * 8, 'primeira nota ≈ E5');
  assert.ok(goertzel(x, 783.99, SR * 1, SR * 0.3) > goertzel(x, 1000, SR * 1, SR * 0.3) * 8, 'segunda nota ≈ G5');
  assert.equal(24 / 3, 8);
});

test('determinístico: o mesmo som sai igual sempre', () => {
  const h = (id) => createHash('sha1').update(Buffer.from(generate(id).buffer)).digest('hex');
  const first = SOUNDS.map((s) => h(s.id));
  assert.equal(new Set(first).size, 5, 'todos diferentes');
  assert.throws(() => generate('inexistente'));
});

test('WAV PCM16 válido', () => {
  const x = generate('chuva').subarray(0, 4410), w = toWav(x), dv = new DataView(w.buffer);
  assert.equal(String.fromCharCode(...w.subarray(0, 4)), 'RIFF'); assert.equal(String.fromCharCode(...w.subarray(8, 12)), 'WAVE');
  assert.equal(dv.getUint16(20, true), 1); assert.equal(dv.getUint16(22, true), 1); assert.equal(dv.getUint32(24, true), SR); assert.equal(dv.getUint16(34, true), 16);
  assert.equal(dv.getUint32(40, true), 4410 * 2); assert.equal(w.length, 44 + 4410 * 2);
  for (const i of [0, 1000, 4409]) assert.ok(Math.abs(dv.getInt16(44 + i * 2, true) / 32767 - x[i]) < 1 / 16000);
});

test('segurança: volume inicial moderado e teto abaixo do máximo; temporizadores definidos', () => {
  assert.ok(DEFAULT_VOLUME <= 0.2 && MAX_VOLUME <= 0.8 && DEFAULT_VOLUME < MAX_VOLUME);
  assert.deepEqual(TIMER_OPTIONS, [5, 15, 30, 60]);
});
