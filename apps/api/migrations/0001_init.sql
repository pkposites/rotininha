CREATE TABLE households (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  valid_until INTEGER,          -- epoch ms; NULL = sem vencimento (apenas dev, até o Marco 4)
  grace_until INTEGER,          -- epoch ms; vencimento + carência
  seq INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  device_id TEXT NOT NULL,
  access_hash TEXT NOT NULL UNIQUE,
  access_expires INTEGER NOT NULL,
  refresh_hash TEXT NOT NULL UNIQUE,
  refresh_expires INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_household ON sessions(household_id);

CREATE TABLE care_events (
  household_id TEXT NOT NULL REFERENCES households(id),
  id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('mamada','sono','fralda')),
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  note TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  seq INTEGER NOT NULL,
  PRIMARY KEY (household_id, id)
);
CREATE INDEX idx_events_seq ON care_events(household_id, seq);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
