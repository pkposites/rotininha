#!/usr/bin/env bash
# Integração da API do zero: banco temporário, migrações, Worker local e a suíte de testes.
# Uso: scripts/ci-integration.sh   (precisa de `npm install` feito na raiz)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/api"
export WRANGLER_SEND_METRICS=false NO_UPDATE_NOTIFIER=1
STATE="$(mktemp -d)"; export D1_STATE="$STATE"
node scripts/make-dev-vars.mjs
npx wrangler d1 migrations apply rotininha --local --persist-to "$STATE" >/dev/null
# Em grupo de processos próprio: ao sair, encerra wrangler E o workerd (senão sobra um Worker órfão na porta 8787).
if curl -fsS localhost:8787/v1/plans >/dev/null 2>&1; then echo "Porta 8787 já está em uso: encerre o Worker local antes."; exit 1; fi
setsid npx wrangler dev --local --persist-to "$STATE" --port 8787 --test-scheduled >"$STATE/wrangler.log" 2>&1 &
WPID=$!
trap 'kill -- -$WPID 2>/dev/null || true' EXIT
for i in $(seq 1 60); do curl -fsS localhost:8787/v1/plans >/dev/null 2>&1 && break; sleep 1; done
curl -fsS localhost:8787/v1/plans >/dev/null || { echo "Worker não subiu"; cat "$STATE/wrangler.log"; exit 1; }
# 2ª instância com o pagamento DESLIGADO (como em produção até validar o Pix) — testa a chave de segurança
STATE2="$(mktemp -d)"
npx wrangler d1 migrations apply rotininha --local --persist-to "$STATE2" >/dev/null
setsid npx wrangler dev --local --persist-to "$STATE2" --port 8788 --var PAYMENTS_ENABLED:false >"$STATE2/wrangler.log" 2>&1 &
WPID2=$!
trap 'kill -- -$WPID 2>/dev/null || true; kill -- -$WPID2 2>/dev/null || true' EXIT
for i in $(seq 1 60); do curl -fsS localhost:8788/v1/plans >/dev/null 2>&1 && break; sleep 1; done
export API_OFF_URL=http://localhost:8788
node --test --test-concurrency=1 test/*.test.mjs
