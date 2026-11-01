# Roteiro: validar o Pix com o Mercado Pago de verdade (Marco 4)

Os testes automáticos usam um **Mercado Pago simulado** (`apps/api/scripts/mock-mp.mjs`), escrito a partir da documentação.
Ele prova a *nossa* lógica (idempotência, valores, entrega única, expiração, reembolso, recuperação) mas **não prova** que a API real aceita exatamente o que enviamos. Confirme no sandbox antes de vender.

## Preparação
1. Painel de desenvolvedores do Mercado Pago → criar aplicação → pegar **credenciais de teste** (`TEST-...`).
2. Webhooks: cadastrar `https://<worker>/v1/webhooks/mercadopago`, evento **Pagamentos**, e copiar a **chave secreta da assinatura**.
3. Segredos do Worker: `npx wrangler secret put MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`.
4. `wrangler.toml` → `[vars]`: **remover** `MP_API_BASE` (usa a API real), definir `PUBLIC_API_URL` (URL do Worker), `APP_URL` (URL do app), `SUPPORT_EMAIL`.
5. E-mail: escolher provedor. O código suporta `EMAIL_PROVIDER=resend` (+ `RESEND_API_KEY`, `EMAIL_FROM` de domínio verificado com SPF/DKIM). Sem isso, comprovante e recuperação **não são enviados**.

## O que conferir (marque o resultado de cada item)
- [ ] `POST /v1/payments` é aceito com o corpo atual? (valor, `payment_method_id: pix`, `external_reference`, `notification_url`, `date_of_expiration` com `-03:00`, `payer.email` + `identification CPF`). Se a API exigir `first_name/last_name`, acrescentar campo de nome.
- [ ] A resposta traz `point_of_interaction.transaction_data.qr_code` e `qr_code_base64`?
- [ ] O QR lê no app do banco e o copia-e-cola funciona?
- [ ] Pagar no sandbox → webhook chega → cabeçalhos `x-signature`/`x-request-id` batem com o manifesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`? (`verifyMpSignature` em `src/mpsig.ts`)
- [ ] O tela do app muda para o código sozinha em até ~5 s?
- [ ] Pagamento aprovado **duas vezes** (reenvio do webhook) não soma período.
- [ ] Pix expirado vira "gerar novo Pix".
- [ ] Reembolso feito **no painel do MP** → webhook `refunded` → acesso encerrado (ver `revoke` em `src/billing.ts`).
- [ ] Renovação: 30 e 90 dias somam a partir do vencimento atual.
- [ ] Recuperação: e-mail chega (inclusive em spam?), link abre o app e gera novo código.

## Reembolso (CDC art. 49 — até 7 dias)
Procedimento operacional: atender o pedido por e-mail → **reembolsar no painel do Mercado Pago** → o webhook retira o período concedido automaticamente. Não há botão de reembolso no app.
