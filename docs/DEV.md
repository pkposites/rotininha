# Desenvolvimento e testes

Requisitos: Node 22+. Sem Docker.

```bash
npm install
```

## Testes rápidos (sem servidor)
```bash
npm test                                   # app web (lógica, regras, contraste)
(cd packages/shared && node --test test/*.test.js)   # horários/lembretes
npx tsc --noEmit -p apps/api               # tipos do Worker
(cd apps/api && node --test test/webpush.test.mjs)   # cifra RFC 8291 + VAPID
```

## Integração da API (do zero, com banco temporário)
```bash
scripts/ci-integration.sh
```
Sobe o Worker local (wrangler + D1 simulado), cria `.dev.vars` com segredos aleatórios e roda a suíte inteira
(`apps/api/test`). Os testes de pagamento usam um **Mercado Pago simulado** e os de push um serviço de push falso.

## Rodar o app localmente
```bash
cd apps/api && node scripts/make-dev-vars.mjs
npx wrangler d1 migrations apply rotininha --local --persist-to /tmp/rotininha-d1
npx wrangler dev --local --persist-to /tmp/rotininha-d1 --port 8787 --test-scheduled
node scripts/mock-mp.mjs                    # Mercado Pago simulado (porta 19877), se for testar o Pix
# em outro terminal:
cd apps/web
VITE_API_BASE_URL=http://localhost:8787 VITE_PAYMENTS_ENABLED=1 npm run build && npx vite preview --port 4173
```
LP em `http://localhost:4173/`, app em `http://localhost:4173/app/`.
`POST /v1/dev/households` cria uma família de teste (só com `ALLOW_DEV_SIGNUP=true`).

## Testes de navegador (Playwright + axe)
```bash
cd e2e && npm install && npx playwright install chromium   # uma vez
D1_STATE=/tmp/rotininha-d1 node care-e2e.js /tmp            # 2º argumento: pasta das capturas de tela
```
| Script | Cobre | Build do web |
|---|---|---|
| `care-e2e.js` | registro rápido, editar, excluir, offline | qualquer |
| `sync-e2e.js` | dois aparelhos, exclusão, offline | com API |
| `rem-e2e.js` | lembretes, silêncio, adiar, deep link | com API |
| `onb-e2e.js` | onboarding, instalação (Instagram/iPhone), guia | com API |
| `fb-e2e.js` | caixa de sugestões | com API |
| `priv-e2e.js` | exportar/apagar dados | com API |
| `pay-e2e.js` | compra Pix, entrega do código, recuperação, renovação, vencimento | `VITE_PAYMENTS_ENABLED=1` + `mock-mp.mjs` |
| `lp-e2e.js <pasta> off\|on` | LP: demo, consentimento, quiz, axe, desempenho | `off` ou `on` conforme o modo; com `VITE_META_PIXEL_ID` de teste |
| `csp-a11y-e2e.js` | CSP real + axe em todas as telas | qualquer (usa `dist/_headers`) |

Limpe `rate_limits` entre execuções longas (`DELETE FROM rate_limits`): os limites de login/checkout são por IP e todos os testes usam 127.0.0.1.

## Variáveis de build do web
`VITE_API_BASE_URL` · `VITE_PAYMENTS_ENABLED` (`1` liga a compra; padrão desligado) · `VITE_META_PIXEL_ID` · `VITE_SUPPLIER_NAME` / `VITE_SUPPLIER_CNPJ` / `VITE_SUPPORT_EMAIL` · `VITE_LP_INDEX=1` (libera indexação da LP) · `VITE_FEEDBACK_CARD=0` (desliga o cartão de sugestões)
