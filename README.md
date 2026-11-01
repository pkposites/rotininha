# Rotininha

Uma ajudinha na sua rotina de mãe. PWA + Cloudflare Worker + Pix. Veja `docs/PRD.md`.

## Estado
- [x] Marco 0 — fundação (tokens, shell PWA Hoje/Histórico/Guia, manifest, service worker)
- [x] Marco 1 — registro local (IndexedDB, 1 toque, editar/excluir, histórico, resumo, sono com duração)
- [x] Marco 2 — API (Worker + D1), sessão e sincronização offline-first
- [x] Marco 3 — lembretes, Web Push (RFC 8291 + VAPID), Cron, "Feito/Adiar" cancelam alertas (**falta validar em aparelho real:** `docs/TESTE-PUSH.md`)
- [x] Marco 4 — Pix (Mercado Pago), entrega única do código, renovação, reembolso e recuperação (**falta validar no sandbox real:** `docs/TESTE-PAGAMENTO.md`)
- [ ] Marcos 5–8 — onboarding+guia, landing page, sugestões, endurecimento (PRD §12)

## Comandos
```bash
npm install
npm run dev      # desenvolvimento
npm run build    # gera apps/web/dist
```
Deploy: Netlify (`netlify.toml` já configurado).

## API (Marco 2)
`apps/api` — Cloudflare Worker + D1. Código de acesso (≈98 bits, guardado só como hash), sessão com access (1h) + refresh rotativo (30d), sincronização por cursor com último-que-escreve-vence, limite de tentativas.
```bash
cd apps/api && cp .dev.vars.example .dev.vars
npm run migrate:local && npm run dev      # http://localhost:8787
npm test                                   # integração (Worker rodando)
```
Web: `VITE_API_BASE_URL=http://localhost:8787 npm run build`. Sem essa variável, o app funciona só local.
`POST /v1/dev/households` cria uma família de teste e só existe com `ALLOW_DEV_SIGNUP=true` (nunca em produção; o Pix cria o acesso no Marco 4).
