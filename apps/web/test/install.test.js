import test from 'node:test';
import assert from 'node:assert/strict';
import { stepsFor, guessChoice, oneClick, BROWSERS, STEPS } from '../src/lib/installSteps.js';

const UA = {
  iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1',
  iosInsta: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0',
  andChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
  andSamsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 SamsungBrowser/23.0 Chrome/115.0 Mobile Safari/537.36',
  andFb: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/400.0]'
};
test('escolha inicial a partir do aparelho e navegador', () => {
  assert.deepEqual(guessChoice(UA.iosSafari), { device: 'ios', browser: 'safari', known: true });
  assert.deepEqual(guessChoice(UA.iosChrome), { device: 'ios', browser: 'chrome', known: true });
  assert.deepEqual(guessChoice(UA.iosInsta), { device: 'ios', browser: 'inapp', known: true });
  assert.deepEqual(guessChoice(UA.andChrome), { device: 'android', browser: 'chrome', known: true });
  assert.deepEqual(guessChoice(UA.andSamsung), { device: 'android', browser: 'samsung', known: true });
  assert.deepEqual(guessChoice(UA.andFb), { device: 'android', browser: 'inapp', known: true });
  assert.equal(guessChoice('Mozilla/5.0 (Macintosh) Chrome/120').known, false, 'computador: a pessoa escolhe');
});
test('toda combinação oferecida tem passo a passo completo', () => {
  for (const [d, list] of Object.entries(BROWSERS)) for (const [b] of list) {
    const s = stepsFor(d, b); assert.ok(s.length >= 3, `${d}.${b}`);
    for (const x of s) { assert.ok(x.t && x.sub && x.scene, `${d}.${b}`); }
  }
  assert.equal(STEPS['ios.safari'].at(-1).scene, 'home');
});
test('atalho de um toque por situação', () => {
  assert.equal(oneClick('android', 'chrome', true, true), 'install');
  assert.equal(oneClick('android', 'chrome', false, true), null, 'sem o evento do navegador, só o passo a passo');
  assert.equal(oneClick('ios', 'safari', false, true), 'share');
  assert.equal(oneClick('ios', 'safari', false, false), null);
  assert.equal(oneClick('ios', 'chrome', false, true), 'copy');
  assert.equal(oneClick('android', 'inapp', false, true), 'copy');
});
