import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeEvent, lastOf, openSleep, formatElapsed, formatDuration,
  groupByDay, summarize, toInputValue, fromInputValue
} from '../src/lib/events.js';

const T = new Date(2026, 10, 1, 12, 0).getTime();
const H = 3600000;

test('lastOf devolve o mais recente do tipo', () => {
  const a = makeEvent('mamada', T - 3 * H), b = makeEvent('mamada', T - H), c = makeEvent('fralda', T);
  assert.equal(lastOf([a, b, c], 'mamada').id, b.id);
  assert.equal(lastOf([a], 'sono'), null);
});

test('excluir o último registro faz o anterior voltar a ser o último', () => {
  const a = makeEvent('fralda', T - 2 * H), b = makeEvent('fralda', T);
  assert.equal(lastOf([a, b].filter((e) => e.id !== b.id), 'fralda').id, a.id);
});

test('openSleep encontra sono sem fim', () => {
  const s = makeEvent('sono', T - H);
  assert.equal(openSleep([s]).id, s.id);
  assert.equal(openSleep([{ ...s, endedAt: T }]), null);
});

test('formatElapsed', () => {
  assert.equal(formatElapsed(10_000), 'agora há pouco');
  assert.equal(formatElapsed(25 * 60000), 'há 25 min');
  assert.equal(formatElapsed(2 * H + 10 * 60000), 'há 2h 10min');
  assert.equal(formatElapsed(3 * H), 'há 3h');
  assert.equal(formatElapsed(50 * H), 'há 2 dias');
  assert.equal(formatElapsed(-5), 'agora há pouco');
});

test('formatDuration', () => {
  assert.equal(formatDuration(90 * 60000), '1h 30min');
  assert.equal(formatDuration(45 * 60000), '45min');
});

test('groupByDay agrupa e filtra', () => {
  const evs = [makeEvent('mamada', T), makeEvent('fralda', T - H), makeEvent('mamada', T - 24 * H)];
  assert.equal(groupByDay(evs).length, 2);
  const f = groupByDay(evs, 'mamada');
  assert.equal(f.reduce((n, g) => n + g.events.length, 0), 2);
});

test('summarize conta e soma sono fechado', () => {
  const s = summarize([
    makeEvent('mamada', T), makeEvent('fralda', T),
    makeEvent('sono', T, { endedAt: T + 2 * H }), makeEvent('sono', T) 
  ]);
  assert.deepEqual(s, { mamadas: 1, fraldas: 1, sonos: 2, sonoMs: 2 * H });
});

test('datetime-local faz round-trip', () => {
  assert.equal(fromInputValue(toInputValue(T)), T);
});
