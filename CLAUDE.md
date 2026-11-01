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
