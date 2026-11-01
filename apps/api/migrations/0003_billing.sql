CREATE TABLE payments (
  id TEXT PRIMARY KEY,                       -- id interno; vai como external_reference no Mercado Pago
  mp_id TEXT UNIQUE,                         -- id do pagamento no Mercado Pago
  kind TEXT NOT NULL CHECK (kind IN ('entry','renewal')),
  plan TEXT NOT NULL,
  days INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | approved | failed | refunded | mismatch
  email TEXT NOT NULL,                       -- e-mail do pagador (exigido pelo MP; usado em comprovante e recuperação)
  household_id TEXT,                         -- renovação: já existe; entrada: preenchido ao aprovar
  poll_hash TEXT NOT NULL,                   -- hash do token de acompanhamento (nunca vai em URL)
  qr_code TEXT,                              -- Pix copia-e-cola (apagado após aprovação)
  qr_base64 TEXT,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  last_checked_at INTEGER,
  approved_at INTEGER,
  applied_at INTEGER,                        -- concessão de acesso: preenchido uma única vez
  refunded_at INTEGER,
  delivery_sealed TEXT,                      -- código de acesso cifrado, entregue uma única vez
  delivery_expires INTEGER,
  claimed_at INTEGER
);
CREATE INDEX idx_payments_email ON payments(email);
CREATE INDEX idx_payments_household ON payments(household_id);

CREATE TABLE recovery_tokens (
  hash TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

-- Só desenvolvimento/testes: e-mails "enviados" quando EMAIL_PROVIDER=dev.
CREATE TABLE email_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
