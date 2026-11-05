-- Aparelhos do administrador que recebem aviso de compra/reembolso (separado das famílias).
CREATE TABLE admin_push (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  keys_sealed TEXT NOT NULL,
  failures INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
