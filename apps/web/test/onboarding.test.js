import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, tasksFromTemplates } from '../src/lib/templates.js';
import { validateTask } from '../src/lib/tasks.js';
import { detectEnv, installAdvice } from '../src/lib/install.js';
import { guideDay, unlockedLessons, guideAccessible, LESSONS, SAFE_SLEEP_ITEMS } from '../src/lib/guide.js';
import { zonedToEpoch } from '../../../packages/shared/schedule.js';

const TZ = 'America/Sao_Paulo';

test('modelos geram tarefas válidas, diárias e editáveis; horário pode ser ajustado', () => {
  const tasks = tasksFromTemplates(TEMPLATES.map((t) => t.id), { 'noite:0': '18:15' });
  assert.ok(tasks.length >= 4);
  for (const t of tasks) { assert.equal(validateTask(t), ''); assert.equal(t.repeat, 'daily'); }
  assert.equal(tasks.find((t) => t.title === 'Banho').time, '18:15');
  assert.equal(tasksFromTemplates([]).length, 0);
});

test('modelos não trazem horários de soneca, intervalos de mamada nem remédio', () => {
  const all = JSON.stringify(TEMPLATES).toLowerCase();
  for (const bad of ['soneca', 'mamada', 'mamar', 'remédio', 'remedio', 'dose', 'gotas']) assert.ok(!all.includes(bad), bad);
  assert.ok(!TEMPLATES.some((t) => t.items.some((i) => i.category === 'remedio' || i.category === 'mamada' || i.category === 'soneca')));
});

test('instalação: Instagram, iPhone Safari, iPhone Chrome, Android, desktop, já instalado', () => {
  const ig = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Mobile/15E148 Instagram 300.0';
  const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Version/17.0 Mobile/15E148 Safari/604.1';
  const crios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 CriOS/120 Mobile/15E148 Safari/604.1';
  const and = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537 Chrome/120 Mobile Safari/537';
  const andFb = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537 Chrome/120 Mobile Safari/537 [FB_IAB/FB4A;FBAV/450]';
  assert.equal(installAdvice(detectEnv(ig)), 'in-app');
  assert.equal(installAdvice(detectEnv(andFb)), 'in-app');
  assert.equal(installAdvice(detectEnv(ios)), 'ios-safari');
  assert.equal(installAdvice(detectEnv(crios)), 'ios-other');
  assert.equal(installAdvice(detectEnv(and), true), 'android-prompt');
  assert.equal(installAdvice(detectEnv(and), false), 'android-menu');
  assert.equal(installAdvice(detectEnv('Mozilla/5.0 (X11; Linux x86_64) Chrome/120')), 'desktop');
  assert.equal(installAdvice(detectEnv(ios, true)), 'installed');
});

test('guia: lição 1 na hora, demais em dias corridos, sem perder lição pelo horário da compra', () => {
  const start = '2026-11-01';
  const at = (d, h, m = 0) => zonedToEpoch(2026, 11, d, h, m, TZ);
  assert.equal(guideDay(start, at(1, 23, 59), TZ), 1);   // comprou às 23:59 → ainda dia 1
  assert.equal(guideDay(start, at(2, 0, 1), TZ), 2);     // 2 minutos depois já é o dia 2
  assert.equal(unlockedLessons(start, at(1, 12), TZ), 1);
  assert.equal(unlockedLessons(start, at(4, 8), TZ), 4);
  assert.equal(unlockedLessons(start, at(30, 8), TZ), 7); // nunca passa de 7
  assert.equal(guideDay(start, at(1, 0, 0) - 3600_000, TZ), 1, 'nunca abaixo de 1');
});

test('guia: acessível com acesso ativo ou em carência; bloqueado quando vencido', () => {
  assert.equal(guideAccessible(null), true);
  assert.equal(guideAccessible({ state: 'active' }), true);
  assert.equal(guideAccessible({ state: 'grace' }), true);
  assert.equal(guideAccessible({ state: 'trial' }), true);
  assert.equal(guideAccessible({ state: 'expired' }), false);
});

test('conteúdo: 7 lições curtas, sem promessas médicas, com sono seguro conforme a SBP', () => {
  assert.equal(LESSONS.length, 7);
  LESSONS.forEach((l, i) => { assert.equal(l.day, i + 1); assert.ok(l.minutes <= 2); assert.ok(l.action); });
  const txt = JSON.stringify(LESSONS).toLowerCase() + SAFE_SLEEP_ITEMS.join(' ').toLowerCase();
  for (const bad of ['dormirá a noite toda', 'dorme a noite toda', 'cura', 'garant', 'resultado', 'acaba com o choro', 'de x em x', 'dose'])
    assert.ok(!txt.includes(bad), 'não pode conter: ' + bad);
  for (const must of ['barriga para cima', 'firme', 'plana', 'inclinad', 'objetos soltos', 'pediatra']) assert.ok(txt.includes(must), 'deve conter: ' + must);
  assert.match(txt, /sociedade brasileira de pediatria/);
});
