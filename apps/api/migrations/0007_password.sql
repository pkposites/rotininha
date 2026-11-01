-- Entrar com WhatsApp + senha (escolhida pela pessoa). Guardamos só hashes: nem o número nem a senha em texto.
ALTER TABLE households ADD COLUMN phone_hash TEXT;     -- HMAC do número normalizado (identifica a conta; não permite ligar para a pessoa)
ALTER TABLE households ADD COLUMN pw_hash TEXT;        -- PBKDF2-SHA256 da senha
ALTER TABLE households ADD COLUMN pw_salt TEXT;
CREATE UNIQUE INDEX idx_households_phone ON households(phone_hash) WHERE phone_hash IS NOT NULL;
