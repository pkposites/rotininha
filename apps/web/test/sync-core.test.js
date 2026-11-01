import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRemote, dirtyOf, cleanAfterPush, visible, toWire, MAX_BATCH } from '../src/lib/sync-core.js';

const base = { id: 'abcdefgh', type: 'mamada', startedAt: 1, endedAt: null, note: '', detail: '' };

test('remoto novo sobre local limpo antigo → aplica', () => {
  const r = mergeRemote({ ...base, updatedAt: 1, dirty: false }, { ...base, updatedAt: 2, note: 'x' });
  assert.equal(r.note, 'x'); assert.equal(r.dirty, false);
});
test('edição local pendente mais nova não é sobrescrita', () => {
  assert.equal(mergeRemote({ ...base, updatedAt: 5, dirty: true }, { ...base, updatedAt: 2 }), null);
});
test('remoto mais novo vence mesmo se local pendente', () => {
  assert.ok(mergeRemote({ ...base, updatedAt: 1, dirty: true }, { ...base, updatedAt: 9 }));
});
test('registro inexistente localmente → cria', () => {
  assert.ok(mergeRemote(undefined, { ...base, updatedAt: 1 }));
});
test('tombstone remoto apaga localmente', () => {
  const r = mergeRemote({ ...base, updatedAt: 1, dirty: false }, { ...base, updatedAt: 2, deleted: true });
  assert.equal(r.deleted, true);
});
test('dirtyOf respeita o limite do lote', () => {
  const many = Array.from({ length: MAX_BATCH + 50 }, (_, i) => ({ ...base, id: 'id' + i, updatedAt: 1, dirty: true }));
  assert.equal(dirtyOf(many).length, MAX_BATCH);
});
test('cleanAfterPush só limpa se não houve edição durante o envio', () => {
  assert.equal(cleanAfterPush({ ...base, updatedAt: 7, dirty: true }, 7).dirty, false);
  assert.equal(cleanAfterPush({ ...base, updatedAt: 8, dirty: true }, 7), null);
});
test('visible esconde tombstones; toWire não envia "dirty"', () => {
  assert.equal(visible([{ ...base, deleted: true }, base]).length, 1);
  assert.ok(!('dirty' in toWire({ ...base, updatedAt: 1, dirty: true })));
});
