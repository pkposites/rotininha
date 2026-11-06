-- Contas internas/de teste (dono, equipe, testes): ficam fora de todas as métricas do painel.
ALTER TABLE households ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0;
