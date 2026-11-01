-- Sugestões das usuárias (PRD §3.9). Sem nome, e-mail ou dados do bebê; identificador pseudonimizado.
CREATE TABLE feedback_suggestions (
  id TEXT PRIMARY KEY,
  pseudo_id TEXT NOT NULL,             -- hash(pepper + household): permite limitar frequência sem expor a família
  category TEXT NOT NULL CHECK (category IN ('lembretes','registros','compartilhar','outros')),
  text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','avaliado','planejado','entregue')),
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_feedback_status ON feedback_suggestions(status, created_at);
CREATE INDEX idx_feedback_pseudo ON feedback_suggestions(pseudo_id, created_at);

-- Contadores AGREGADOS do funil (sem identificador de pessoa). PRD §11.
CREATE TABLE funnel_counts (
  day TEXT NOT NULL,                   -- YYYY-MM-DD (America/Sao_Paulo)
  event TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event)
);
