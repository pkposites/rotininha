# Ninhora

Uma ajudinha na sua rotina de mãe. PWA + Cloudflare Worker + Pix. Veja `docs/PRD.md`.

## Estado
- [x] Marco 0 — fundação (tokens, shell PWA, manifest)
- [x] Marco 1 — registro local (IndexedDB, 1 toque, editar/excluir, histórico)
- [x] Marco 2 — API (Worker + D1), sessão e sincronização offline-first
- [x] Marco 3 — lembretes e Web Push (RFC 8291 + VAPID), Cron, Feito/Adiar (**falta aparelho real:** `docs/TESTE-PUSH.md`)
- [x] Marco 4 — Pix (Mercado Pago) + API de Conversões: **construído, mas desligado** (`PAYMENTS_ENABLED`) até validar no sandbox real — `docs/TESTE-PAGAMENTO.md` e `docs/ATIVAR-PAGAMENTO.md`
- [x] Marco 5 — onboarding, modelos editáveis, orientação de instalação e Guia de 7 dias (conteúdo **pendente de revisão profissional**)
- [x] Marco 6 — landing page com demonstração animada, consentimento, minutas legais
- [x] Marco 7 — caixa de sugestões e métricas agregadas
- [x] Marco 8 — endurecimento: LGPD (exportar/apagar/retenção), CSP, acessibilidade, CI, orçamento de tamanho

Status de cada critério do PRD: `docs/ACEITE.md` · pendências fora do código: `docs/pendencias-lancamento.md` · como rodar: `docs/DEV.md`.

## Estrutura
```
apps/web      LP estática (/) + PWA (/app/)       — Preact + Vite, sem framework pesado
apps/api      Cloudflare Worker + D1 + Cron       — TypeScript
packages/shared  cálculo de lembretes (usado nos dois lados)
e2e           testes de navegador (Playwright + axe)
scripts       integração do zero, orçamento de tamanho
docs          PRD, roteiros de teste, aceite, pendências
```

## Comandos
```bash
npm install
npm run build        # gera apps/web/dist
npm test             # testes do app
scripts/ci-integration.sh   # API do zero
```
Deploy do web: Netlify (`netlify.toml`; os cabeçalhos de segurança são gerados em `dist/_headers`).
