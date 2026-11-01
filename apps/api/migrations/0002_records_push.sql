-- Tabela genérica sincronizável: eventos de cuidado, lembretes (task) e ocorrências (occ).
CREATE TABLE records (
  household_id TEXT NOT NULL REFERENCES households(id),
  kind TEXT NOT NULL CHECK (kind IN ('event','task','occ')),
  id TEXT NOT NULL,
  body TEXT NOT NULL,                -- JSON do registro (formato de rede)
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  seq INTEGER NOT NULL,
  next_fire_at INTEGER,              -- task: próximo disparo; occ: fim do adiamento
  PRIMARY KEY (household_id, kind, id)
);
CREATE INDEX idx_records_seq ON records(household_id, seq);
CREATE INDEX idx_records_fire ON records(next_fire_at) WHERE next_fire_at IS NOT NULL;

INSERT INTO records (household_id, kind, id, body, updated_at, deleted, seq)
SELECT household_id, 'event', id,
       json_object('kind','event','id',id,'type',type,'startedAt',started_at,'endedAt',ended_at,
                   'note',note,'detail',detail,'updatedAt',updated_at,'deleted',json(CASE WHEN deleted=1 THEN 'true' ELSE 'false' END)),
       updated_at, deleted, seq
FROM care_events;
DROP TABLE care_events;

CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  device_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  keys_sealed TEXT NOT NULL,         -- p256dh/auth cifrados (AES-GCM)
  privacy INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_push_household ON push_subscriptions(household_id);

-- Deduplicação: uma linha por (família, registro, instante de disparo).
CREATE TABLE sent_notifications (
  key TEXT PRIMARY KEY,
  sent_at INTEGER NOT NULL
);
