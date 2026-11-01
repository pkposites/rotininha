# Ninhora — teste grátis, notificações, painel, uso, saltos e sons

> O app se chama **Ninhora** (antes "Rotininha"). Os identificadores internos (banco local `rotininha`, pacotes, repositório, domínio atual) continuam como estavam para não perder dados já salvos. **A marca "Ninhora" ainda não foi pesquisada no INPI** (`docs/pendencias-lancamento.md`).

## 1. Teste grátis de 3 dias e cobrança com aviso prévio
**Fluxo:** o onboarding leva à criação da conta (WhatsApp + senha, e-mail opcional) → o servidor cria a conta e o aparelho já fica conectado. Contas criadas antes de 01/11/2026 entravam com um *código de acesso* mostrado uma única vez; ele continua valendo como alternativa. Veja a seção "Entrar, recuperar e compartilhar" no fim deste arquivo.

**Pré-lançamento (hoje):** ninguém é cobrado nem bloqueado. O app diz a verdade: *"quando passarmos a cobrar, avisamos com antecedência"*.

**Quando for cobrar** (painel → *Teste e cobrança*, ou `POST /v1/admin/settings`):
1. Escolha a **data de início da cobrança**. O servidor **recusa datas com menos de 7 dias de aviso** (configurável, mínimo 1).
2. Dentro da janela de aviso, **todo o app mostra um aviso** ("a partir de DD/MM… Até lá, nada muda para você") e o servidor pode enviar a automação de aviso.
3. Na data: quem já estava em teste ganha **3 dias a partir do início da cobrança** (nunca perde tempo). Novos cadastros têm 3 dias a partir do cadastro.
4. Fim do teste → **24 h de carência** → depois o app continua **legível**, mas não grava na nuvem nem envia lembretes. Pagando (Pix), tudo volta.
5. A cobrança em vigor **não é desfeita** pelo painel (evita surpresa). Só funciona de verdade com o pagamento ligado e validado (`docs/ATIVAR-PAGAMENTO.md`).

Controle de abuso: 2 testes por aparelho e 6 por IP por dia (leve; quem quiser burlar consegue — o foco é a maioria das pessoas).

## 2. Notificações — o motor de uso
Dois tipos, tratados de formas diferentes:
- **Lembretes** que a pessoa cria: sempre chegam (respeitam silêncio salvo confirmação explícita).
- **Promocionais** (dicas, novidades, ciclo de vida): só para quem **aceitou "dicas e novidades"** (liga/desliga em Ajustes). **Nunca entre 22h e 6h** (fuso da família), **no máximo 1 a cada 20 h** por família, exceto os **avisos do teste/cobrança**, que não entram no limite por serem aviso de conta.

**Automações** (todas nascem **desligadas**; o painel liga, edita texto e destino e mostra envios/cliques): boas-vindas · primeiro registro · primeiro lembrete · dica dos sons · salto chegando (até 3 dias antes, um aviso por salto) · teste termina amanhã · último dia do teste · teste terminou · "sentimos sua falta" (3–30 dias sem abrir, no máx. 1 a cada 7 dias).

**Campanhas manuais** (painel → *Notificações*): título (60) e texto (180) com prévia, destino ao tocar (Hoje/Histórico/Saltos/Sons/Guia/Ajustes), público (todas, em teste, pagantes, vencidas, inativas há N dias, nunca registraram, novas, com data de nascimento, **grupo-piloto por códigos**), estimativa de alcance antes de enviar, **agendamento**, rascunho, cancelamento e **envio de teste a um aparelho**. Variáveis: `{dias}` (dias de teste que faltam) e `{preco}`.

**Rastreio de cliques:** cada envio carrega um id único (`sid`); ao tocar, o service worker avisa o servidor. O id não identifica a pessoa por si só.

## 3. Painel `/admin/`
Página separada, fora dos buscadores, sem manifesto, protegida por `ADMIN_TOKEN` (≥ 24 caracteres; sem ele as rotas ficam desligadas). O token fica **só em `sessionStorage`**. Seções: **Visão geral**, **Notificações**, **Automações**, **Teste e cobrança**.

## 4. Análise de uso (eficiência)
Medido no servidor, por **pseudônimo** (hash do lar; sem dados do bebê e sem conteúdo): só **nomes de eventos e contagens por dia** (`app_open`, `care_logged`, `reminder_created/done/snoozed`, `sound_played`, `leap_viewed/marked`, `guide_lesson_done`, `push_enabled`, `settings_opened`, `paywall_viewed`, `trial_banner_seen`). Quem desliga em Ajustes **tem o histórico apagado**.

| Indicador | Definição |
|---|---|
| DAU / WAU / MAU, adesão | famílias distintas com `app_open` no dia / 7 / 30 dias; adesão = DAU ÷ MAU |
| Ativação | % das cadastradas na janela com 1º registro em ≤ 24 h / ≤ 72 h / alguma vez |
| Retenção D1/D3/D7 | % que abriu o app exatamente N dias após o cadastro (só coortes com N dias) |
| Recursos | % dos ativos nos últimos 7 dias que usaram cada recurso |
| Notificações | ativadas (% das famílias), enviadas, barradas pelo limite, cliques, CTR, e "abriram o app em 24 h" (**correlação, não prova de causa**) |
| Teste → pagou | % dos testes iniciados que têm pagamento aprovado |

## 5. Saltos de desenvolvimento
Aba **Saltos**: data de nascimento (ou **data prevista** para prematuros) → idade em semanas, salto em andamento ou próximo, sinais do dia, marcar início/fim, linha do tempo com 10 fases (semanas ≈ 5, 8, 12, 19, 26, 37, 46, 55, 64, 75) e aviso antes. **É uma referência popular, não ciência consolidada nem diagnóstico** (o app diz isso, e orienta falar com o pediatra). Os textos são originais e genéricos. As marcações ficam **no aparelho**; só a data vai à conta, para avisar antes. *Pendência:* revisão por profissional de saúde.

## 6. Sons para a soneca — por que sintetizados
Pesquisei bancos gratuitos ([Freesound](https://freesound.org/), [Pixabay](https://pixabay.com/service/license-summary/), [Mixkit](https://mixkit.co/license/), [BBC](https://sound-effects.bbcrewind.co.uk/)): 
- **Freesound**: a licença é **por arquivo** (CC0 pode; CC-BY exige crédito; CC-BY-NC não serve para app comercial) e a API exige chave.
- **Pixabay / Mixkit**: uso comercial liberado, mas **proíbem redistribuir o arquivo como está**, o que um app que empacota o áudio estaria fazendo.
- **BBC**: licença **RemArc, só uso pessoal/educacional/pesquisa** → não serve.

Decisão: os **5 sons são gerados dentro do app** (ruído branco, chuva, ondas, batimentos, caixinha de música com melodia original), sem arquivo de terceiros: **zero licença a respeitar, funciona offline, laço sem emenda e ~0 KB extra**. Testado por regras (laço sem emenda, volume, ritmo de 80 bpm, nota certa da caixinha). **Eu não consigo ouvir:** a qualidade percebida precisa da sua audição. Se preferir gravações reais, o caminho é Freesound filtrado por **CC0**, conferindo arquivo por arquivo.
Segurança: volume inicial 35% (teto 80%), temporizador padrão de 30 min com fade de 20 s, aviso "volume baixo, aparelho longe do berço", sem promessa terapêutica. **Com a tela bloqueada** o som depende do navegador (Audio Session/Media Session): **teste em aparelho real**.

## 7. O que está no ar e o que falta
- **No ar (Netlify):** LP, app, painel (`/admin/`), páginas legais. **Sem API**, o app roda **só no aparelho** (registros, sons, saltos, guia, lembretes dentro do app).
- **Falta publicar o servidor (Cloudflare Worker + D1)** — é ele que cria o teste, envia notificações, guarda uso e alimenta o painel. Passos em `docs/TESTE-PUSH.md` (preparação) e variáveis em `apps/api/.dev.vars.example`; depois defina `VITE_API_BASE_URL` no Netlify. **Sem isso o painel não tem o que mostrar.**

## Preço e acesso (decisão do proprietário, 01/11/2026)
- **Teste grátis de 3 dias**, depois **acesso vitalício único de R$ 37,90** via Pix (sem assinatura, sem renovação).
- A cobrança só começa após o aviso prévio (`settings.trial_enforce_from`, mínimo de 7 dias de aviso). Pagamento segue **desligado** (`PAYMENTS_ENABLED=false`) até concluir `docs/ATIVAR-PAGAMENTO.md`.
- Plano único `life` em `apps/api/src/plans.ts` (validade de 100 anos). Quem já é vitalício recebe 409 `already_lifetime` ao tentar comprar de novo.

## Conteúdo trazido do trabalho com o Codex
- Banner "Leve o Ninhora para a tela inicial" (dispensável), cartão "Precisa de uma ajuda agora?" na tela Hoje.
- Guia de cuidado (4 dicas: água, sono, bebê agitado, acolher) + "Quando buscar ajuda" (SAMU 192). **Texto ainda sem revisão profissional.**
- Sons: 3 gravações CC0 do Freesound (`public/audio`, créditos em `/audio/LICENCAS.txt`) + 5 sintetizados; favoritos, filtro, aviso de segurança, volume inicial 15%, temporizador 5/15/30/60 min.
- Links legais sem `.html`; página de reembolso.

## Separação de projetos (importante)
- LP de captação (`ninhoralp.relatoriorda.com.br`, Netlify `calm-arithmetic-e1bbd9`, Forms + CAPI) é **outro projeto** e não deve ser sobrescrita.
- O projeto `dapper-monstera-550394` publica este repositório (LP interna em `/` e app em `/app/`).


## Entrar, recuperar e compartilhar (atualização 01/11/2026)
- **Entrada principal:** WhatsApp + senha (mín. 8 caracteres). Só guardamos hashes. O código de acesso continua só como alternativa para contas antigas ("Tenho um código de acesso (conta antiga)").
- **Recuperação:** só pelo **link enviado ao e-mail cadastrado na conta** (uso único, 30 min): ele cria uma nova senha, mantém os registros, encerra as sessões antigas e invalida o código antigo. Informar WhatsApp ou e-mail, sozinhos, nunca redefine a senha.
  - **Hoje NÃO funciona em produção**, porque o envio de e-mails não está configurado. O app detecta isso (`/v1/plans → emailRecovery`) e mostra a verdade, sem prometer. Falta: escolher um provedor (ex.: Resend), verificar o domínio (SPF/DKIM) e definir no Worker `EMAIL_PROVIDER = "resend"` (var), `EMAIL_FROM` (var) e o segredo `RESEND_API_KEY`.
  - **Alternativa que funciona hoje:** quem ainda está conectada em algum aparelho troca a senha em Ajustes → "Alterar senha de acesso".
  - **Limite conhecido:** o WhatsApp não é verificado (não há canal para enviar código); alguém poderia cadastrar o número de outra pessoa antes dela. Resolver exige verificação por mensagem.
- **Acesso grátis:** a regra implementada é "grátis, sem data para acabar" até a cobrança ser ligada; depois, 3 dias de teste para quem criar conta e R$ 37,90 vitalício. A página, o cadastro e Ajustes dizem a mesma coisa (`lib/ux.js → trialCopy`). A data 05/11/2026 está gravada, mas inerte enquanto o pagamento estiver desligado.
- **Compartilhar:** Ajustes → "Sobre a Ninhora" → "Compartilhar a Ninhora" (menu nativo; sem ele, "Copiar link"). Compartilha só `origem do app + / + utm`, nunca dados da conta. Pode ser trocado por `VITE_SHARE_URL`.
