# Ativar o pagamento (só quando estiver de fato funcionando)

O Pix está **construído e testado contra um Mercado Pago simulado**, mas fica **desligado** até você confirmar que funciona de verdade.
Enquanto desligado: o servidor responde `503 payments_disabled` em `/v1/checkout` e `/v1/billing/renew` (nem CPF é coletado), a LP mostra
**"Vendas abrem em breve"** e o app esconde "comprar" e "renovar". Login, sincronização, lembretes e **webhooks (reembolsos de compras já feitas)** seguem funcionando.

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
Faça **uma compra real de R$ 11,90** com você mesma e confira: Pix → acesso liberado → código entregue uma vez → comprovante por e-mail → reembolso pelo painel → acesso encerrado.

## Desligar de novo (se algo der errado)
`PAYMENTS_ENABLED = "false"` + `VITE_PAYMENTS_ENABLED=0` e redeploy. Quem já comprou continua com acesso; webhooks continuam processando (inclusive reembolsos).

## Medição de anúncios (opcional, só com consentimento)
- O Pixel (LP) só carrega se a pessoa aceitar "Medição de anúncios". Eventos: `PageView`, `ViewContent`, `InitiateCheckout` — sem parâmetros.
- O `Purchase` vai **pelo servidor** (API de Conversões) só se a pessoa tiver consentido: e-mail em hash, valor, `event_id` = nº do pagamento, ids do navegador (`_fbp`/`_fbc`). Nunca CPF, idade do bebê, quiz, horários, remédios ou histórico. Os ids de rastreio são **apagados depois do envio**.
- Teste no Gerenciador de Eventos com `META_TEST_EVENT_CODE` antes de produção.
