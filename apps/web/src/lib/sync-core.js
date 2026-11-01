// Regras puras de sincronização (testáveis em Node).
export const MAX_BATCH = 200;

export const visible = (evs) => evs.filter((e) => !e.deleted);
export const dirtyOf = (evs) => evs.filter((e) => e.dirty).slice(0, MAX_BATCH);

// Mescla um evento remoto no local. Último que escreve vence (updatedAt).
// Retorna o registro a gravar, ou null se o local vence/é igual.
export function mergeRemote(local, remote) {
  if (!local) return { ...remote, dirty: false };
  if (local.dirty && local.updatedAt >= remote.updatedAt) return null; // edição local mais nova ainda não enviada
  if (!local.dirty && local.updatedAt >= remote.updatedAt) return null; // já temos
  return { ...remote, dirty: false };
}

// Após enviar, só limpa "dirty" se o registro não mudou durante o envio.
export const cleanAfterPush = (local, pushedUpdatedAt) =>
  local && local.dirty && local.updatedAt === pushedUpdatedAt ? { ...local, dirty: false } : null;

export const toWire = (e) => ({
  id: e.id, type: e.type, startedAt: e.startedAt, endedAt: e.endedAt ?? null,
  note: e.note ?? '', detail: e.detail ?? '', updatedAt: e.updatedAt, deleted: !!e.deleted
});
