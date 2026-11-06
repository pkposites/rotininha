# Acordos de trabalho com a proprietária (Ninhora)

Estas preferências valem para qualquer sessão que trabalhe neste repositório.

## Como a proprietária prefere trabalhar
- **Sem terminal.** Ela não mexe com terminal e prefere resolver tudo pela conversa e pelos conectores (Netlify, Cloudflare, GitHub). Antes de pedir um comando, tente fazer pelas ferramentas disponíveis (por exemplo, consultas ao D1 e ajustes no Netlify pelos conectores).
- Quando o terminal for inevitável (hoje: `wrangler deploy` e `wrangler secret put`), dar **um passo por vez, com o caminho exato e o que deve aparecer na tela** ("terminal zerado": abrir o Terminal, `cd ~/rotininha/apps/api`, conferir `api %`). Nunca pedir que cole segredos no chat.
- **Objetivo futuro:** eliminar a necessidade do terminal (ver `docs/pendencias-lancamento.md`, tarefa "Publicar a API sem terminal").

## Publicação
- "Pode subir" dado uma vez vale para o que já estiver **pronto e testado**: commit e push no branch `claude/new-session-64jni6`. O que ainda não foi validado não sobe.
- Não criar Pull Request sem pedido.

## Segurança e produto
- **Pagamento fica desligado** (`PAYMENTS_ENABLED=false`) até o Mercado Pago ser validado de verdade. Não usar chaves de produção em testes.
- Não enviar mensagens reais, cobranças nem notificações em massa durante testes. Usar dados fictícios identificados como teste e limpar o que criar em produção.
- Segredos nunca passam pelo chat nem ficam no repositório.
- Não mexer na LP de captação (`ninhoralp.relatoriorda.com.br`, projeto Netlify separado) sem pedido expresso.
- Honestidade nos textos: não prometer recuperação por e-mail enquanto o envio de e-mails não estiver configurado.

## Visual (Ninhora "Entardecer")
- Identidade premium escura: violeta profundo com estrelas (`apps/web/src/sky.css`), vidro translúcido no lugar de caixas brancas, botões em pílula com gradiente, ilustrações da mãe e do bebê em `apps/web/public/art/`. Tokens em `tokens.css`; camada do app em `premium.css`; LP em `lp/lp-premium.css`; pacote da LP de captação em `lp-ninhoralp/premium.css`.
- "Modo madrugada" é a variante ainda mais escura e calma. O painel (`/admin/`) fica claro e sóbrio de propósito.
- Evitar o visual "ferramenta feita por IA": nada de caixas brancas, emojis dentro de quadrados, formulário em lista. Uma pergunta por tela no onboarding.

## Métricas: contas de teste e aparelhos internos
- Contas de teste/internas (`households.is_test = 1`) ficam fora de TODAS as métricas do painel. Marcar: painel → aba Contas (por WhatsApp), ou aparelho interno (`?interno=1`; contas criadas nele nascem marcadas). "Contar a partir de" descarta o período de testes sem apagar dados.
- Ao criar contas de teste em produção, marcar `is_test = 1` (D1) e apagar depois. Testes automatizados rodam só no ambiente local.
- Funil de notificações no painel (Visão geral): convite visto, ligou, "agora não", bloqueou, iPhone sem instalar.

