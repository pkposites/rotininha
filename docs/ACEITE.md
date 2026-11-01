# Critérios de aceite da primeira versão (PRD §13) — status real

Legenda: ✅ verificado por teste automático · ⚠️ construído e testado, mas falta validar fora do ambiente de teste · ❌ pendente

| # | Critério | Status | Evidência / o que falta |
|---|---|---|---|
| 1 | Registrar mamada/sono/fralda com no máximo 2 toques | ✅ | `e2e/care-e2e.js` (1 toque) |
| 2 | Editar/excluir reflete no histórico e no último cuidado | ✅ | `e2e/care-e2e.js`, `apps/web/test/events.test.js` |
| 3 | Lembrete chega em iPhone PWA e Android; sem push → aviso honesto | ⚠️ | Servidor, Cron, cifra (RFC 8291) e VAPID ✅ (`apps/api/test/push.test.mjs`, `webpush.test.mjs`); avisos honestos ✅. **Falta o aparelho real:** `docs/TESTE-PUSH.md` |
| 4 | Feito/adiar cancela alertas indevidos | ✅ | `push.test.mjs` |
| 5 | Instalação guiada a partir do navegador do Instagram | ⚠️ | Orientação por ambiente ✅ (`e2e/onb-e2e.js`, `lib/install.js`); **falta testar no app do Instagram em iPhone/Android reais** |
| 6 | Pagamento aprovado libera acesso uma vez; webhook duplicado não duplica | ⚠️ | ✅ contra o Mercado Pago **simulado** (`billing.test.mjs`, 6 webhooks simultâneos); **falta o sandbox real:** `docs/TESTE-PAGAMENTO.md` |
| 7 | Código fora de URL permanente; recuperação; proteção contra força bruta | ✅ | Tokens em cabeçalho, link de recuperação no `#`, limites por IP/aparelho/e-mail (`api.test.mjs`, `billing.test.mjs`) |
| 8 | Vencimento/carência conforme contrato; renovação restaura edição/push | ⚠️ | ✅ no simulador; mesma validação real do item 6 |
| 9 | Offline registra e sincroniza sem duplicar | ✅ | `e2e/sync-e2e.js` |
| 10 | Motion da LP leve, pausável, respeita movimento reduzido, tem fallback | ✅ | `e2e/lp-e2e.js` (12 s/6 cenas, pausa, fora da tela, reduced-motion, sem JS); LP 9,9 KB gzip, CLS < 0,1 |
| 11 | Termos, Privacidade, fornecedor, suporte, arrependimento, cookies | ⚠️ | Páginas, banner de preferências e fluxo de reembolso existem; os textos são **minutas** sem CNPJ/contato. Falta **revisão jurídica** e preencher `VITE_SUPPLIER_*` |
| 12 | Conteúdo de sono validado; sem horários obrigatórios de mamada nem doses | ❌/✅ | Sem horários/doses/promessas ✅ (`onboarding.test.js`). **Revisão por profissional habilitado ❌ pendente** — o app mostra "versão preliminar" até `GUIDE_REVIEWED=true` |
| 13 | Sem dados infantis em ferramentas de marketing | ✅ | Pixel só na LP, só com consentimento, sem parâmetros (`lp-e2e.js`); o app não carrega nenhum rastreador; CSP |
| 14 | Instrumentação não atrapalha desempenho | ✅ | Contadores agregados assíncronos; orçamento de tamanho (`scripts/check-bundle.mjs`) |
| 15 | Sugestões em Ajustes; convite respeita gatilho, adiamento e flag | ✅ | `e2e/fb-e2e.js`, `apps/web/test/feedback.test.js` |
| 16 | Sugestões sem dados infantis, não vão à Meta, com acesso controlado e retenção | ✅ | `feedback.test.mjs` (token de admin, CSV seguro, pseudônimo), purga em 12 meses (`privacy.test.mjs`) |

## Além do PRD (endurecimento)
- ✅ Exportar e apagar meus dados (LGPD) + retenção automática de 12 meses após o vencimento — `privacy.test.mjs`, `e2e/priv-e2e.js`
- ✅ CSP sem `unsafe-inline`, HSTS, nosniff, Permissions-Policy; testado sob a política real — `e2e/csp-a11y-e2e.js`
- ✅ Acessibilidade (axe, WCAG 2.2 AA) em LP, páginas legais e **todas** as telas do app, inclusive modo madrugada; contraste de todos os pares de cores testado
- ✅ Dependências de produção sem vulnerabilidades conhecidas (`npm audit --omit=dev`)
- ✅ Logs sem tokens, CPF, e-mail ou dados do bebê
- ✅ Pagamento **desligado por padrão** (`PAYMENTS_ENABLED`): 503 no checkout/renovação, LP "Vendas abrem em breve", app sem botões de compra — `apps/api/test/disabled.test.mjs`. Como ligar: `docs/ATIVAR-PAGAMENTO.md`
- ✅ API de Conversões (Purchase) só com consentimento, uma vez por pagamento, sem dados do bebê, rastreio apagado após o envio — `apps/api/test/capi.test.mjs`
