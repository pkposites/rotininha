-- Teste grátis, preferências, uso, campanhas e automações de notificação.
ALTER TABLE households ADD COLUMN plan TEXT NOT NULL DEFAULT 'paid';          -- 'trial' | 'paid'
ALTER TABLE households ADD COLUMN trial_ends_at INTEGER;
ALTER TABLE households ADD COLUMN contact_email TEXT;                          -- opcional (recuperação e avisos do teste)
ALTER TABLE households ADD COLUMN tips_opt_in INTEGER NOT NULL DEFAULT 1;      -- dicas e novidades por notificação
ALTER TABLE households ADD COLUMN usage_opt_in INTEGER NOT NULL DEFAULT 1;     -- estatísticas de uso (sem dados do bebê)
ALTER TABLE households ADD COLUMN baby_birth_date TEXT;                        -- YYYY-MM-DD (opcional; só para calcular a idade em semanas)
ALTER TABLE households ADD COLUMN hid TEXT;                                    -- pseudônimo para estatísticas
ALTER TABLE households ADD COLUMN last_seen_at INTEGER;
ALTER TABLE households ADD COLUMN first_care_at INTEGER;
CREATE INDEX idx_households_hid ON households(hid);
CREATE INDEX idx_households_created ON households(created_at);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

-- Uso por pseudônimo/dia/evento (contagens; sem conteúdo, sem dados do bebê).
CREATE TABLE usage_daily (
  hid TEXT NOT NULL, day TEXT NOT NULL, event TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (hid, day, event)
);
CREATE INDEX idx_usage_day_event ON usage_daily(day, event);

CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'hoje',
  audience TEXT NOT NULL DEFAULT '{"segment":"all"}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','canceled')),
  scheduled_at INTEGER,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER
);
CREATE INDEX idx_campaigns_status ON campaigns(status, scheduled_at);

CREATE TABLE notification_sends (
  id TEXT PRIMARY KEY,                    -- "sid": id único do envio (vai no payload; usado no clique)
  campaign_id TEXT NOT NULL,              -- id de campanha ou "auto:<chave>"
  household_id TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  status TEXT NOT NULL,                   -- sent | failed | suppressed
  reason TEXT,
  clicked_at INTEGER
);
CREATE INDEX idx_sends_campaign ON notification_sends(campaign_id, household_id);
CREATE INDEX idx_sends_household ON notification_sends(household_id, sent_at);

CREATE TABLE automations (
  key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'hoje',
  updated_at INTEGER NOT NULL DEFAULT 0
);
