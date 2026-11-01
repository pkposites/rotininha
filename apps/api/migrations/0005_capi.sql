-- Medição de compra via API de Conversões da Meta (PRD §10). Só preenchido com CONSENTIMENTO e apagado após o envio.
ALTER TABLE payments ADD COLUMN marketing_consent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN fbp TEXT;
ALTER TABLE payments ADD COLUMN fbc TEXT;
ALTER TABLE payments ADD COLUMN client_ip TEXT;
ALTER TABLE payments ADD COLUMN client_ua TEXT;
ALTER TABLE payments ADD COLUMN source_url TEXT;
ALTER TABLE payments ADD COLUMN capi_sent_at INTEGER;
