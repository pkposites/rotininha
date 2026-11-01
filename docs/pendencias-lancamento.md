# Pendências de lançamento (fora do código)
- [ ] Busca de marca "Ninhora" no INPI + domínio + perfis sociais
- [ ] Revisão profissional do conteúdo de sono e modelos por faixa etária
- [ ] Revisão jurídica: Termos, Privacidade, base legal LGPD, ECA Digital, arrependimento (CDC art. 49)
- [ ] Validação de Web Push em iPhone real (PWA instalado, iOS 16.4+) e Android — roteiro em `docs/TESTE-PUSH.md`
- [ ] Credenciais de teste do Mercado Pago; contas Cloudflare e Netlify
- [ ] CNPJ/identificação do fornecedor e canal de suporte
- [ ] Lembrete "a cada X horas" (PRD §3.3) — não implementado no Marco 3; hoje há horário fixo (diário, dias da semana, uma vez)
- [ ] Revisar com jurídico o texto das notificações e o modo privacidade
- [ ] Validar o Pix no sandbox real do Mercado Pago — roteiro em `docs/TESTE-PAGAMENTO.md`
- [ ] Escolher e configurar provedor de e-mail (comprovante e recuperação dependem disso); domínio com SPF/DKIM
- [ ] Preencher identificação do fornecedor (razão social, CNPJ, e-mail de suporte): `VITE_SUPPLIER_NAME`, `VITE_SUPPLIER_CNPJ`, `VITE_SUPPORT_EMAIL`
- [ ] Termos de Uso, Política de Privacidade e de reembolso publicados e linkados no checkout
- [ ] Definir retenção do e-mail do pagador (tabela `payments`) e do histórico de pagamentos (LGPD)
- [ ] Proteção anti-robô no checkout (ex.: Cloudflare Turnstile) — hoje só limite de tentativas por IP e por e-mail
- [ ] Decidir se a carência de 24 h entra na divulgação comercial (hoje o app a aplica)
- [ ] Revisão profissional do conteúdo do Guia (hoje `GUIDE_REVIEWED=false` em `apps/web/src/lib/guide.js`: o app mostra "versão preliminar"). Trocar para `true` só depois da revisão
- [ ] Definir domínio e `VITE_LP_INDEX=1` (a LP sai com `noindex` por padrão)
- [ ] Configurar `ADMIN_TOKEN` (≥ 24 caracteres) no Worker para exportar sugestões; sem ele as rotas `/v1/admin/*` ficam desligadas
- [ ] Definir o prazo de retenção definitivo (hoje 12 meses após o vencimento: `RETENTION_DAYS_AFTER_EXPIRY` em `apps/api/src/privacy.ts`) e alinhar a Política
- [ ] Gerar ícones definitivos do app (os atuais são provisórios)
- [ ] **Ligar o pagamento** só depois de cumprir `docs/ATIVAR-PAGAMENTO.md` (chaves `PAYMENTS_ENABLED` / `VITE_PAYMENTS_ENABLED`, hoje desligadas)
- [ ] **Publicar o servidor (Cloudflare Worker + D1)**: sem ele não há teste grátis na nuvem, notificações, painel nem estatísticas (ver `docs/NINHORA.md` §7)
- [ ] **Pesquisar a marca "Ninhora" no INPI** (e domínio) antes de anunciar
- [ ] Ouvir os 5 sons e testar a reprodução **com a tela bloqueada** em iPhone e Android reais
- [ ] Revisão por profissional de saúde dos textos dos **Saltos** (referência popular)
- [ ] Revisar com jurídico: teste grátis (CDC: informação clara do que ocorre depois), coleta de estatísticas de uso (base legal/opt-out), notificações promocionais, data de nascimento do bebê
- [ ] Definir o texto/valores finais do aviso prévio da cobrança e a data de início
- [ ] Reintegrar o trabalho do Codex (ver conversa): ele não está neste repositório

## Atualização 01/11/2026
- [ ] Publicar o Worker `rotininha-api` + D1 (hoje só existe `ninhora-capi-leads` na conta Cloudflare); trocar placeholders do `wrangler.toml` (database_id, ALLOWED_ORIGIN, VAPID_SUBJECT) e definir `VITE_API_BASE_URL` no Netlify.
- [ ] Decidir o papel da LP interna (`/`) frente à LP de captação separada; não sobrescrever a de captação.
- [ ] Revisão profissional das dicas de cuidado, saltos e guia; ouvir os 8 sons em aparelhos reais.
- [ ] Teste real de push (iPhone/Android) e Mercado Pago sandbox antes de ligar pagamentos.

## Pendências de acesso e recuperação (01/11/2026)
- [ ] **E-mail transacional (decisão: Resend, DEPOIS de o pagamento estar rodando)** para a recuperação de senha funcionar em produção: conta no Resend + domínio verificado (SPF/DKIM) + `EMAIL_PROVIDER=resend`, `EMAIL_FROM`, `RESEND_API_KEY`. Até lá o app avisa que a recuperação por e-mail não está disponível. O mesmo e-mail enviará o comprovante do pagamento.
- [ ] **Verificação do WhatsApp** (código por mensagem) para impedir cadastro com número de terceiros. Exige canal de envio.
- [ ] **Decisão comercial:** a data 05/11/2026 (4 dias à frente) é menor que o aviso prévio de 7 dias prometido nos textos. Como ninguém usa ainda, não afeta ninguém, mas defina se o aviso muda para o prazo real ou se a data se move.
- [ ] **Página pública a compartilhar:** hoje é a raiz do app (`/`). Se preferir a LP de captação, defina `VITE_SHARE_URL`.

## ❓ Decisões em aberto do proprietário (registradas em 01/11/2026)
1. **Data de cobrança 05/11 x aviso prévio de 7 dias.** A data (4 dias à frente) é menor que o aviso prometido nos textos. Ninguém usa ainda, então não prejudica ninguém. Definir qual muda: o aviso (para o prazo real) ou a data (para ≥ 7 dias à frente). Depois, alinhar `lib/ux.js → trialCopy`, `index.html`, `termos.html` e o painel (Teste e cobrança).
2. **Uso sem conta depois da data de cobrança.** Hoje não é bloqueado (o servidor não mede o uso local; sem conta também não há lembretes por notificação nem sincronização). Definir se passa a exigir conta (3 dias de teste e depois pagar).
3. **Página compartilhada.** Hoje é a raiz do app; definir se deve ser a LP de captação (`VITE_SHARE_URL`).
