# Ativar o pagamento (só quando estiver de fato funcionando)

O Pix está **construído e testado contra um Mercado Pago simulado**, mas fica **desligado** até você confirmar que funciona de verdade.
Enquanto desligado: o servidor responde `503 payments_disabled` em `/v1/checkout` e `/v1/billing/renew` (nem CPF é coletado), o app esconde "comprar" e "renovar" (o **teste grátis** continua funcionando, pois não depende de pagamento). Login, sincronização, lembretes e **webhooks (reembolsos de compras já feitas)** seguem funcionando.

## Antes de ligar — todos os itens
1. **Sandbox do Mercado Pago** — percorrer `docs/TESTE-PAGAMENTO.md` inteiro e anotar o resultado. Ajustar o que a API real exigir (ex.: nome do pagador).
2. **E-mail transacional** — provedor escolhido, domínio verificado (SPF/DKIM), `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`. Teste real: comprovante e "Perdi meu código" chegando na caixa de entrada.
3. **Fornecedor** — `VITE_SUPPLIER_NAME`, `VITE_SUPPLIER_CNPJ`, `VITE_SUPPORT_EMAIL` preenchidos no Netlify.
4. **Textos legais revisados e publicados** — Termos, Privacidade e Reembolso (as páginas atuais são minutas, `noindex`). Remover o aviso de "MINUTA".
5. **Reembolso** — alguém responsável por responder pedidos em até 7 dias e reembolsar **no painel do Mercado Pago** (o webhook encerra o acesso).
6. **Conteúdo do Guia revisado** por profissional (`GUIDE_REVIEWED = true` em `apps/web/src/lib/guide.js`), ou decisão consciente de vender com o aviso "versão preliminar".
7. **Push em aparelho real** — `docs/TESTE-PUSH.md` (lembretes são parte do que o cliente compra).
8. **Segredos de produção** no Worker: `CODE_PEPPER`, `PUSH_SEAL_KEY`, `VAPID_*`, `MP_ACCESS_TOKEN` (de **produção**), `MP_WEBHOOK_SECRET`, `ADMIN_TOKEN`, e — se for medir anúncios — `META_PIXEL_ID` + `META_CAPI_TOKEN`. **Remova** `MP_API_BASE` e `META_API_BASE` (usam as APIs reais) e mantenha `ALLOW_DEV_SIGNUP="false"`.
9. **Webhook** cadastrado no painel de produção do MP apontando para `https://<worker>/v1/webhooks/mercadopago`.
10. **Proteção anti-robô** no checkout (ex.: Cloudflare Turnstile) — hoje só há limite por IP e por e-mail.

## Ligar
```bash
# Worker
npx wrangler secret put ...           # os segredos acima
#   em wrangler.toml [vars]: PAYMENTS_ENABLED = "true"
npx wrangler deploy
# Netlify (variáveis de build)
VITE_PAYMENTS_ENABLED=1   # e VITE_API_BASE_URL, VITE_SUPPLIER_*, VITE_META_PIXEL_ID (opcional)
# redeploy do site
```
Faça **uma compra real de R$ 37,90** com você mesma e confira: Pix → acesso liberado → código entregue uma vez → comprovante por e-mail → reembolso pelo painel → acesso encerrado.

## Desligar de novo (se algo der errado)
`PAYMENTS_ENABLED = "false"` + `VITE_PAYMENTS_ENABLED=0` e redeploy. Quem já comprou continua com acesso; webhooks continuam processando (inclusive reembolsos).

## Medição de anúncios (opcional, só com consentimento)
- O Pixel (LP) só carrega se a pessoa aceitar "Medição de anúncios". Eventos: `PageView`, `ViewContent`, `InitiateCheckout` — sem parâmetros.
- O `Purchase` vai **pelo servidor** (API de Conversões) só se a pessoa tiver consentido: e-mail em hash, valor, `event_id` = nº do pagamento, ids do navegador (`_fbp`/`_fbc`). Nunca CPF, idade do bebê, quiz, horários, remédios ou histórico. Os ids de rastreio são **apagados depois do envio**.
- Teste no Gerenciador de Eventos com `META_TEST_EVENT_CODE` antes de produção.

## Cobrança a partir de 05/11/2026 (decisão do proprietário)
A estrutura está pronta e testada (`e2e/block-e2e.js`, `apps/api/test/disabled.test.mjs`):
- **Teste**: quem cria conta depois do início da cobrança tem 3 dias grátis; quem já usava ganha 3 dias a partir da data de início.
- **Bloqueio** (acesso vencido, depois de 24 h de carência): vira só leitura. Ficam bloqueados registrar cuidados, criar/concluir/adiar lembretes e tocar sons; o servidor também recusa gravações e pára os lembretes por notificação. **Continuam livres**: ver o histórico, baixar e apagar os dados e todas as informações de segurança (Guia, "Quando buscar ajuda").
- **Liberação**: pagar o Pix de R$ 37,90 (pagamento único, vitalício) libera tudo na hora; o que a pessoa registrar depois sincroniza normalmente.
- **Trava de segurança**: enquanto `PAYMENTS_ENABLED` não for `"true"` no Worker, a data de cobrança fica **inerte**: ninguém é bloqueado sem ter como pagar (o painel avisa disso). Para a cobrança valer em 05/11: concluir os itens acima, ligar `PAYMENTS_ENABLED = "true"` no Worker e `VITE_PAYMENTS_ENABLED=1` no Netlify **antes** da data.
- Decisão em aberto: quem usa o app **sem conta** não é bloqueado (não há como medir). Sem conta não há lembretes por notificação nem sincronização. Se quiser exigir conta depois da data, é uma mudança pequena.

### O que falta do lado do Mercado Pago ("ML")
1. Credenciais de **produção**: `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` (painel de desenvolvedores → sua aplicação).
2. Cadastrar o webhook de pagamentos: `https://rotininha-api.robson-oc96.workers.dev/v1/webhooks/mercadopago`.
3. Antes de produção, testar com credenciais de **teste** (sandbox) seguindo `docs/TESTE-PAGAMENTO.md`.
4. Dados do fornecedor (razão social, CNPJ, e-mail de suporte) e provedor de e-mail para o comprovante.
