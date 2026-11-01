# ROTININHA — PRD DO MVP + GUIA VISUAL + MOTION DA LANDING PAGE

**Versão:** 1.2 — 31/10/2026  
**Status:** Documento de execução para Claude Code — sujeito a validação de produto, conteúdo clínico e revisão jurídica  
**Stack prevista:** Claude Code · Netlify · Cloudflare Workers/D1/Cron · Mercado Pago Pix  
**Nome:** Rotininha (provisório; verificar marca e domínio antes de publicidade)

> **Ideia central:** criar um ajudante prático e acolhedor para a rotina de mães e cuidadores de bebês de 0 a 2 anos, sobretudo de primeira viagem. O produto deve aliviar a carga mental, não impor regras rígidas à família.

## 1. Posicionamento e comunicação

**Marca:** Rotininha  
**Slogan:** **“Uma ajudinha na sua rotina de mãe.”**  
**Gancho de anúncio/hero:** **“Que tal ter uma ajudinha na sua rotina de mãe?”**  
**Promessa funcional:** “Registre os cuidados do bebê em segundos, organize os próximos lembretes e acompanhe a rotina em um só lugar.”  
**Assinatura alternativa curta:** “Você cuida do seu bebê. O Rotininha ajuda a lembrar do resto.”

### Três pilares da comunicação
1. **Registre com facilidade:** mamadas, sono, fraldas e cuidados sem preencher formulários longos.
2. **Organize e lembre:** tarefas e lembretes editáveis, com notificações quando possível e autorizadas.
3. **Aprenda no seu tempo:** guia breve de rotina e sono seguro, com ações práticas e sem promessas médicas.

**Tom:** afetuoso, tranquilo, brasileiro, simples e respeitoso. Falar com a mãe sem presumir que só ela cuida; pai, avós e outros cuidadores também podem utilizar. Evitar culpa por metas não cumpridas.

**Não comunicar:** “dorme a noite toda”, “cura cólica”, “acaba com o choro”, “resultado garantido”, “seu bebê precisa mamar de X em X horas”. Não dar dicas de diagnóstico, dose ou medicamento.

**Aviso de saúde em rodapé do app, conteúdo pertinente e telas de remédio:** “O Rotininha ajuda a organizar os cuidados e não substitui a orientação do pediatra.”

### 1.1 Pesquisa de nome comercial — alerta de anterioridade (31/10/2026)

- **“Mapa da Mamãe” já é utilizado comercialmente** no Brasil por um curso online sobre gestação, maternidade e cuidados do bebê, com site próprio: https://mapadamamae.com.br/ . A oferta inclui sono e rotina e se dirige a mães de primeira viagem — sobreposição relevante de público, mensagem e categoria com este aplicativo.
- **Decisão de produto:** **não adotar “O Mapa da Mamãe” como nome nem como nome principal de campanha** nesta etapa. **Rotininha permanece provisório** e este achado não comprova que Rotininha esteja disponível para registro.
- **Limite da verificação:** encontrou-se uso comercial público; **não foi confirmada a situação registral de “Mapa da Mamãe” no INPI**, nem a existência de oposição, exclusividade ou eventual conflito jurídico. Não afirmar “marca registrada” ou “nome livre” sem consulta apropriada.
- **Antes de investir em domínio, identidade definitiva ou anúncios:** pesquisar no INPI as grafias exatas e semelhantes, radicais e semelhanças fonéticas, nas classes pertinentes; analisar titulares/status, marcas afins, domínio e perfis sociais. Em caso de dúvida, consultar profissional de propriedade intelectual. Orientação oficial: https://www.gov.br/inpi/pt-br/servicos/marcas/guia-basico ; busca pública: https://servicos.busca.inpi.gov.br/marcas .

## 2. Objetivo do MVP e princípio do produto

A primeira versão já deve permitir **comprar, instalar, ativar lembretes, registrar cuidados, consultar os últimos registros e renovar**. Deve ser confiável em iPhone e Android. Evitar a armadilha de construir uma plataforma enorme antes de confirmar a adesão.

**A regra de UX:** um cuidado pode ser registrado em 1 ou 2 toques, com uma mão e com sono. A tela principal responde: “Qual foi o último cuidado?”, “Há quanto tempo?” e “O que vem a seguir?”.

**Fora do MVP:** IA preditiva, diagnósticos, análise de desenvolvimento, integração com smartwatches, grupos/comunidade, muitas trilhas novas, sons extensos, gamificação de performance e acompanhamento de múltiplos bebês. Esses itens entram no backlog conforme uso real.

## 3. Escopo funcional: MVP realista

### 3.1 Tela Hoje — centro de tudo
- Saudação acolhedora e data.
- Três cartões configuráveis: **última mamada, último sono/acordou e última fralda**; mostrar hora exata e tempo transcorrido.
- Botões grandes **“Mamou”**, **“Dormiu/Acordou”** e **“Fralda”**. Salvar agora automaticamente; permitir corrigir horário e excluir registro.
- Lista **“Próximos lembretes”** em ordem cronológica, com concluir, adiar e editar.
- Não transformar o dia em uma nota escolar: sem percentual geral de “mãe eficiente”. Contadores de checklist podem existir em rituais opcionais.
- Mostrar estado vazio útil para quem ainda não criou tarefas.
- Navegação enxuta: **Hoje · Histórico · Guia**; Ajustes acessíveis no topo.

### 3.2 Registro rápido e memória
- Evento: categoria, horário inicial, horário final opcional, observação opcional, quem registrou (se compartilhado).
- Sono: botão **Iniciar sono / Acordou**, com duração calculada; não fazer previsões de “janela perfeita”.
- Mamada: registro simples; cronômetro/peito esquerdo-direito opcionais e recolhidos, nunca obrigatórios.
- Fralda: opção simples; detalhes (xixi/cocô) opcionais.
- Os registros são editáveis. Exibir “último cuidado” e histórico diário.
- Modo madrugada: tema escuro acionável, controles grandes, sem animações intrusivas.

### 3.3 Lembretes e rotina flexível
- Categorias: Mamada (opcional), Soneca, Banho, Remédio, Fralda, Estímulo, Consulta/Vacina, Cuidado da mãe, Outro.
- Campos: título livre, horário, dias da semana/diário/uma vez, antecedência opcional, notificação ligada/desligada.
- Frequência “a cada X horas”: **configuração explícita pelo responsável**, nunca sugerir intervalos de amamentação ou medicação. Para medicação, texto “Registre somente horários conforme orientação de profissional de saúde”; sem dose automática.
- Concluir, adiar 10/15/30 min ou pular sem julgamento. Adiar deve atualizar lembrete em todos os dispositivos.
- Silêncio-padrão 22h–6h para comunicações do sistema; lembretes criados explicitamente nesse intervalo podem tocar, após confirmação clara.
- Tarefas concluídas não geram alertas posteriores de atraso. Deduplicar notificações por ocorrência; reprocessamentos do Cron não enviam duas vezes.
- Se push não estiver disponível/permitido, mostrar claramente a limitação; o app ainda funciona para registro e consultas, mas **não prometer alertas garantidos**.

### 3.4 Rotinas sugeridas no onboarding
- Perguntar faixa etária (0–3m, 4–6m, 7–9m, 10–12m, 1–2a) **ou permitir pular**. Não exigir data de nascimento completa.
- Oferecer **“Usar um modelo editável”** ou **“Começar do zero”**.
- Modelos: ritual de noite, observação de sinais, banho e outros cuidados genéricos; **horários e quantidade de sonecas precisam de revisão por especialista/pediatra** antes de ser publicados como sugestões por idade.
- Amamentação em livre demanda; horários personalizados devem ser inseridos pela família e não apresentados como orientação clínica.

### 3.5 Compartilhamento com outro cuidador — versão simples
- Um responsável pode convidar 1 cuidador por **código de convite temporário de uso único**, distinto do código principal de acesso.
- Histórico, lembretes e registros sincronizados entre dispositivos; “registrado por [apelido do cuidador]”.
- Responsável pode revogar convite/dispositivo. Não usar o código principal como senha compartilhada.
- Se implementar compartilhamento comprometer o prazo de validar push+pagamento, liberar primeira versão com um responsável e manter este módulo como **primeira atualização**, sem prometer na LP antes de estar funcional.

### 3.6 Histórico e resumo
- Linha do tempo por dia, com horário real e autoria opcional. Filtro simples por tipo.
- Resumo básico (quantidade de mamadas, trocas, períodos de sono) sem interpretação clínica.
- Exportação amigável/compartilhável para pediatra é **prioridade da atualização 1.1**, não bloquear lançamento.
- Os dados devem continuar acessíveis em modo leitura durante período expirado, com política clara de retenção e exclusão.

### 3.7 Guia “Rotina e Sono em 7 Dias”
Cada lição deve caber em 1–2 minutos e gerar uma ação facultativa na rotina. Não dizer que ao final o bebê “dormirá melhor” ou “terá sono ajustado”.

| Dia | Conteúdo | Ação opcional |
|---|---|---|
| 1 | O valor de uma rotina flexível | Escolher um marco do dia |
| 2 | Observar sinais de cansaço | Criar lembrete de observação |
| 3 | Sonecas variam entre bebês e idades | Registrar sono sem impor número |
| 4 | Sono seguro | Checklist de ambiente seguro |
| 5 | Um ritual de noite acolhedor | Criar checklist editável |
| 6 | Despertares fazem parte do desenvolvimento | Lembrete de rotina, sem conduta clínica |
| 7 | Rever e adaptar o que funcionou | Tela de conclusão + opções para continuar |

- O conteúdo de **sono seguro** deve mencionar bebê de barriga para cima (menores de um ano), superfície firme, plana e não inclinada, berço sem objetos soltos e respeito às orientações do pediatra, conforme SBP.
- Liberação diária em horário local conveniente; não perder uma lição por causa do momento da compra. Lição 1 disponível imediatamente, próximas em dias corridos e acessíveis até o fim do período pago.
- Notificação do guia: opt-in e desligável; não tomar prioridade sobre cuidados.
- **Revisão técnica de todo conteúdo de sono por profissional habilitado antes de comercializar.** Não criar depoimentos ou selos profissionais fictícios.

### 3.8 Cuidado da mãe (opcional)
Permitir lembretes personalizados de beber água, fazer refeições ou compromissos; sem prescrever metas, e com opção de ocultar completamente a categoria.

### 3.9 Caixa de sugestões — evolução guiada pelas próprias mães (requisito leve)

**Objetivo:** descobrir dificuldades reais depois que a usuária já experimentou o valor básico do app, sem impor pesquisa na entrada e sem atrapalhar o cuidado com o bebê. A primeira versão é **um formulário curto e discreto, não uma comunidade ou central de atendimento**.

**Gatilho sugerido (hipótese editável):** a primeira exibição acontece **após pelo menos 3 dias distintos com uso efetivo E (5 registros de cuidado OU 3 lembretes concluídos)**. Exibir só numa visita à tela **Hoje** durante interação normal, de preferência após um cuidado registrado; não mostrar durante onboarding, pagamento, primeiro uso ou modo madrugada. Não enviar push para pedir opinião.

**Interface e texto propostos:** um cartão pequeno, com opção de fechar, na tela Hoje: **“Mamãe, o que deixaria sua rotina mais leve? 💜”** / “Conta para a gente o que você gostaria de ter no Rotininha.” CTA **“Dar uma sugestão”** e **“Agora não”**. Na abertura, apresentar uma pergunta opcional de escolha simples (**Lembretes / Registros / Compartilhar cuidados / Outros**) e um campo aberto de até 500 caracteres, com botão **“Enviar sugestão”**. Não exigir nota, comentário nem indicação de pessoas.

**Regras antirruído e respeito à usuária:**
- Nunca mostrar como modal obrigatório; permitir dispensar em um toque e manter acesso voluntário em **Ajustes → Enviar sugestão** desde o início.
- Após **“Agora não”**, ocultar por pelo menos 7 dias; após enviar, **não reapresentar convite automático por 30 dias** (parâmetros configuráveis). Uma campanha de sugestão por usuária a cada período; não prejudicar funcionalidades se ignorar.
- Ao concluir, mostrar apenas “Obrigada! Sua ideia ajuda a melhorar o Rotininha 💜”. **Não prometer implementação, resposta pessoal ou prazo.**
- Se houver uso por mais de um cuidador, exibir no máximo uma vez por perfil/sessão de cuidador; evitar convites repetidos na família.

**Dados e segurança:** não pedir nome completo, e-mail nem dados do bebê; aviso curto **“Não envie nomes, informações médicas ou dados pessoais do bebê.”**. Tratar texto livre como potencialmente pessoal, limitar tamanho e frequência, proteger acesso administrativo e excluir mediante solicitação; não enviar opiniões ao Pixel/CAPI. Evitar campos que incentivem relatos de saúde. Para análise, armazenar categoria, texto opcional, data, status e um identificador pseudonimizado opcional em tabela `feedback_suggestions` do D1; retenção definida na Política de Privacidade. **Não exibir sugestões publicamente**.

**Gestão operacional mínima:** visão administrativa simples (ou exportação CSV segura) para ler, agrupar temas, marcar `novo / avaliado / planejado / entregue` e observar frequência por tema. Medir **convites elegíveis, convites visualizados, respostas e temas**, apenas de forma agregada. Nunca associar a desempenho de maternidade, saúde infantil ou públicos personalizados de anúncio.

**Priorização:** incluir o cartão e endpoint simples no MVP **se não atrasar notificações, registro rápido, segurança e Pix**. Se ameaçar o lançamento, manter o formulário em Ajustes na v1 e ativar automaticamente o convite de engajamento na atualização imediata (feature flag). O compromisso de ouvir as usuárias permanece obrigatório; não construir dashboard complexo agora.

## 4. Fluxo completo da usuária

**Anúncio → LP → prévia animada → mini-quiz opcional → Pix → confirmação → instalação → ativar push → primeiro registro → 7 dias → renovação manual.**

1. A landing page apresenta ganho concreto, mockup animado do app e oferta **“7 dias de acesso por R$ 11,90”**, nunca “teste grátis”.
2. Mini-quiz máximo três perguntas, opcional: faixa do bebê, maior dificuldade e participação de outro cuidador. **Não coletar dados íntimos ou clínicos no quiz de aquisição.**
3. Prévia da rotina apenas demonstrativa, editável, sem indicar rotina médica obrigatória.
4. Checkout Mercado Pago Pix: informar preços, período, identidade do fornecedor e canais de suporte; o provedor pode exigir **e-mail e documento do pagador**, ainda que a aplicação dispense login por e-mail.
5. Pagamento confirmado exclusivamente via API após validar webhook; criar acesso e registrar validade.
6. Entrega: código de acesso forte, botão copiar, comprovante e tutorial de instalação. **Não colocar credencial duradoura em URL/query string.** Pode usar token de reivindicação descartável e curto, seguido por sessão segura.
7. Onboarding: perfil mínimo → rotina do zero ou modelo → primeiro registro → instalar PWA → ativar lembretes com toque explícito. A ordem instalação/permissão se adapta ao dispositivo.
8. Expiração: exibir aviso claro; após 24h de carência configurada, suspender push e edição, mantendo visualização e caminho de suporte/exclusão.
9. Renovação: Pix de 30/90 dias, confirmado por webhook, extensão da validade a partir do maior entre vencimento atual e data de pagamento. Sem cobrança automática.
10. Recuperação: prever recuperação com comprovante/identificador da compra e suporte (ou e-mail opcional verificado). **Não depender apenas de o usuário ter anotado um código.**

**Oferta inicial (hipótese, sujeita a testes):** 7 dias R$ 11,90; 30 dias R$ 19,90; 90 dias R$ 39,90. O plano de 90 dias não pode ostentar “mais escolhido” sem dados reais. Testar order bump somente após estabilizar o funil, descrevendo exatamente período adicional, valor final e vigência.

## 5. Landing page com motion demonstrativo — requisito do MVP

### 5.1 Estrutura mobile-first
1. **Hero:** “Que tal ter uma ajudinha na sua rotina de mãe?” / “Uma ajudinha na sua rotina de mãe.” + promessa funcional + CTA “Quero minha ajudinha por R$ 11,90”.
2. **Motion no primeiro ou segundo bloco:** celular ilustrando a experiência real (ver storyboard abaixo).
3. **Três benefícios** com ícones: registrar, lembrar, compartilhar (este último só quando implementado).
4. **Prévia interativa leve:** selecione um exemplo de cuidado e veja onde aparece no app; não precisa fazer login.
5. **Como funciona:** paga via Pix → instala → personaliza → usa.
6. **Guia de sono**, com aviso de conteúdo educativo.
7. **Oferta e FAQ:** preço, sete dias, renovação manual, push em iPhone, privacidade, suporte e reembolso.
8. **Rodapé:** identificação da empresa, contato, Termos, Privacidade e direitos do consumidor.

### 5.2 Storyboard do motion (10 a 12 segundos, loop)

| Tempo | Cena no mockup do telefone | Mensagem próxima ao mockup |
|---|---|---|
| 0–2s | Tela “Hoje”: últimos cuidados e botão de registro | “Tudo à mão, sem complicar” |
| 2–4s | Surge uma **simulação visual** de notificação: “🛁 Hora do banho” | “Lembretes no momento escolhido” |
| 4–6s | Toque ilustrado na notificação → abre a tarefa | “Você abre com um toque” |
| 6–8s | Toque no ✓ “Feito”; item muda para concluído | “Registra em segundos” |
| 8–10s | “Banho registrado às 18h30”; próximo lembrete visível | “Sua rotina segue organizada” |
| 10–12s | Logo Rotininha + CTA e volta suave ao começo | “Uma ajudinha na sua rotina de mãe” |

**Regras de implementação:**
- Motion **produzido com HTML/CSS/JS/SVG usando componentes reais ou visualmente fiéis ao app**; evitar vídeo pesado e biblioteca grande por estética apenas.
- Reprodução sem áudio, sem flash, sem scroll-jacking, com opção “Pausar demonstração”; pausar quando fora de tela. Respeitar `prefers-reduced-motion` com quadro estático completo e legível.
- Ter pôster/screenshot estático para conexões lentas ou scripts bloqueados. Não atrapalhar o carregamento do CTA. Usar lazy-load e evitar layout shift.
- O elemento que parece notificação deve estar identificado como **“Demonstração ilustrativa”**. Não sugerir que está chegando um push real ao visitante, nem imitar identidade visual protegida de sistemas de forma enganosa.
- Microtexto claro abaixo: **“Notificações dependem da instalação, permissão e configurações do dispositivo.”**
- O motion da LP não precisa acessar notificações reais: ele **simula** a UX; push real é testado separadamente no PWA.
- Desenvolver primeiro um storyboard estático com estados e depois animar. Capturar imagens/screen recording do app real para atualização futura da LP.

### 5.3 CTA e textos de exemplo
- Botão primário: **“Quero organizar minha rotina”**.
- Prova de produto: **“Veja como funciona em poucos segundos”** (junto do motion).
- Complemento: **“Registre os cuidados, receba seus lembretes e acompanhe o dia com mais tranquilidade.”**
- Aviso antes do Pix: **“Acesso por 7 dias. Renovação opcional, feita manualmente por Pix. Não é assinatura.”**

## 6. Mini guia de identidade visual (design tokens)

### Direção criativa
**Acolhedor, sereno, moderno e funcional.** Inspirado em padrões observáveis em apps de rotina parental (cartões claros, tipografia simples, hierarquia de registros, ícones reconhecíveis), sem reproduzir identidade ou telas de concorrentes. Público principal é adulto; evitar visual excessivamente infantil, rosa de gênero obrigatório e excesso de ilustrações de bebês. Mistura de lilás com verde-sálvia e superfícies creme.

### Paleta oficial sugerida

| Papel | Token | HEX | Uso |
|---|---|---|---|
| Primária/CTA | `--brand-primary` | **#6D56A6** | Botões, links importantes e foco |
| Primária suave | `--brand-lilac-100` | **#F1ECFA** | Cards de destaque e fundos leves |
| Fundo quente | `--surface-base` | **#FBF9F7** | Fundo de LP e tela diurna |
| Superfície | `--surface-card` | **#FFFFFF** | Cartões e formulários |
| Texto principal | `--text-main` | **#25334A** | Corpo e títulos |
| Texto secundário | `--text-muted` | **#6B7380** | Legendas, informações auxiliares |
| Ação de sucesso | `--success-ink` | **#2E716B** | Texto/ícones de conclusão, nunca única indicação |
| Sucesso suave | `--success-bg` | **#E9F5F0** | Tarefas feitas |
| Âmbar texto | `--warning-ink` | **#8A5B00** | Lembretes atrasados |
| Âmbar fundo | `--warning-bg` | **#FFF2D6** | Atrasos sem tom alarmista |
| Rosa pêssego | `--peach-soft` | **#F8E5DC** | Detalhes afetivos discretos |
| Borda | `--border-subtle` | **#E8E4EB** | Divisórias, inputs |
| Noturno fundo | `--night-bg` | **#171A2A** | Modo madrugada |
| Noturno cartão | `--night-card` | **#24283B** | Componentes do modo madrugada |
| Noturno texto | `--night-text` | **#F5F2FB** | Leitura escura |
| Noturno destaque | `--night-accent` | **#C2B5F0** | Controles e foco no modo escuro |

**Regra:** usar os tons claros como plano de fundo, não como texto principal. Botões primários usam `#6D56A6` com texto branco; o contraste estimado supera 4,5:1. Verde `#2E716B` e âmbar `#8A5B00` são cores de texto sobre fundos claros, não tons decorativos para letras pequenas sem teste.

### Tipografia
- **Títulos e marca:** `Nunito Sans` (700/800), arredondada sem parecer infantil.
- **Corpo, botões e dados:** `Inter` (400/500/600), legibilidade alta em horário, números e registros.
- Fallback: `system-ui, -apple-system, BlinkMacSystemFont, sans-serif`.
- **Mobile:** H1 30/36 px; H2 24/30; H3 20/26; corpo 16/24; texto auxiliar 14/20 (não usar abaixo de 13 px para informações importantes); botão 16/20 peso 600.
- Números de horário: `font-variant-numeric: tabular-nums`.
- Botões grandes com área de toque desejável **44 × 44 px ou mais**; cantos 14–18 px; cards 18–22 px; espaçamentos 8/12/16/24/32 px.
- Ícones contornados, linhas consistentes (ex.: Lucide), no máximo uma ilustração suave por seção; evitar animações constantes no app.
- Acessibilidade: mirar **WCAG 2.2 AA**, contraste normal 4,5:1 e texto grande 3:1; foco visível, rótulos de ícones e status por texto além de cor.

### Experiência emocional
- Nunca usar vermelho para tarefa “não feita” ou mensagens culpabilizantes.
- Texto padrão: “Ainda não registrado” (não “Você esqueceu”), “Você pode ajustar este horário” (não “Seu bebê está atrasado”).
- Modo madrugada reduz brilho, contraste confortável e não dispara transições chamativas.

### CSS base de referência
```css
:root {
  --brand-primary: #6D56A6; --brand-lilac-100: #F1ECFA;
  --surface-base: #FBF9F7; --surface-card: #FFFFFF;
  --text-main: #25334A; --text-muted: #6B7380;
  --success-ink: #2E716B; --success-bg: #E9F5F0;
  --warning-ink: #8A5B00; --warning-bg: #FFF2D6;
  --peach-soft: #F8E5DC; --border-subtle: #E8E4EB;
  --night-bg: #171A2A; --night-card: #24283B;
  --night-text: #F5F2FB; --night-accent: #C2B5F0;
}
```

## 7. Arquitetura técnica — proposta enxuta e coerente

```text
Netlify PWA (HTML/CSS/JS ou framework leve)
  - LP / checkout UI / tela entrega / PWA
  - manifest.webmanifest + service worker + IndexedDB local
  - estados offline, sessão, fila de sincronização e recepção de push
         |
Cloudflare Worker API (HTTPS, secrets no servidor)
  - checkout Pix + webhook verificado + renovação
  - sessão com token, regras e registros de cuidados
  - assinatura de push por dispositivo
  - envio com VAPID + Cron agendado por minuto (UTC)
  - controle de acesso por responsável/cuidadores
         |
Cloudflare D1
  - households/acessos (código armazenado por hash, validade, status)
  - sessions + caregiver_invites + caregiver_memberships
  - payments (id_mp único, idempotência, tipo, status, valores, timestamps)
  - care_events (id UUID, categoria, timestamps, autoria, sync_version)
  - tasks (regra, fuso IANA, horário, repetição, flags)
  - occurrences/sent_notifications (deduplicação por tarefa/ocorrência)
  - push_subscriptions (device id, endpoint e keys protegidas)
  - consent_preferences / privacy_requests (minimização e trilha essencial)
  - feedback_suggestions (categoria, texto opcional, data, status, vínculo mínimo/pseudonimizado)
```

**Separação correta:** IndexedDB = cache offline e fila de alterações; D1 = fonte central de sincronização necessária ao compartilhamento e supressão de alertas após “Feito”. Nome do bebê e data exata de nascimento não são exigidos. Mesmo horários, categorias e registros vinculados a um identificador **podem ser dados pessoais**, e alguns podem revelar informações de saúde, exigindo avaliação jurídica da base legal e proteção reforçada.

**Segurança mínima implementável:**
- Código de acesso aleatório e longo (ex.: formato legível com 12+ caracteres aleatórios), guardado no banco por hash; sessão de curta duração + renovação segura; limite de tentativas por IP/identificador; convite de cuidador com expiração e revogação.
- API autentica todas as leituras e mutações; não aceitar só `codigo` na URL como autorização; HTTPS/CORS correto; segredo Mercado Pago e VAPID no Worker; logs sem tokens, CPF ou detalhes infantis.
- Operações de registros com UUID/idempotência, relógio UTC e timezone `America/Sao_Paulo` por padrão ajustável. Fuso configurável por família. Tratar mudança de horário de verão/fuso quando aplicável.
- Fila offline com confirmação e reenvio; conflitos básicos por evento e `updated_at`, sem duplicar os cuidados.
- Cron a cada minuto busca ocorrências pendentes, verifica vencimento, carência, silêncio, opt-in, tarefa já concluída e chave de envio idempotente.
- Para push iPhone, validar **PWA instalado na Tela de Início (iOS 16.4+)**, permissão ativada em interação explícita e comportamento em aparelhos reais. Notificações são **best effort**: não garantir entrega exata ao minuto por restrições de sistema/conexão.
- Ao tocar no push, abrir tarefa para **confirmar “Feito”**; não marcá-la automaticamente apenas por abrir a notificação.
- Dados sensíveis de conteúdo de notificação: no modo privacidade usar “Você tem um lembrete do Rotininha” sem título do medicamento no bloqueio da tela.

## 8. Monetização, pagamento, acesso e políticas comerciais

- **Períodos:** 7 dias R$ 11,90; 30 dias R$ 19,90; 90 dias R$ 39,90, valores iniciais de experimento.
- **Sem assinatura nem renovação automática**; compra renovada por novo Pix, com preço e período apresentados novamente.
- 24h de carência após a expiração é **benefício comercial planejado**, a ser descrito corretamente (não deve prometer acesso extra se não estiver implementado).
- Direito de arrependimento de compra on-line: prever canal e procedimento para exercer o **art. 49 do CDC, em até sete dias**, e regras de reembolso legalmente corretas. Não inserir cláusula “sem reembolso por ser produto digital” ou condicionantes incompatíveis.
- Identificação do fornecedor, CNPJ, endereço/meios de contato, oferta clara, suporte e confirmação da contratação: cumprir CDC e Decreto 7.962/2013.
- Pix: usar `X-Idempotency-Key` na criação, assinatura verificada do webhook, confirmação na API do Mercado Pago, status `approved`/equivalente e atualização transacional para evitar dupla concessão de acesso.
- **Não expirar dados nem excluir histórico automaticamente no dia do vencimento**; definir período de retenção e direito de exclusão/portabilidade conforme leis aplicáveis.
- Métrica financeira: no preço R$ 11,90, CAC correspondente a ROAS bruto de 1,8 ≈ **R$ 6,61**, antes de taxa Mercado Pago, tributos, suporte e reembolsos. Validar economics reais; renovação não é garantida.

## 9. Privacidade, segurança infantil e parte jurídica — sem burocracia desnecessária

**Este bloco é requisito de lançamento, não substitui revisão por profissional jurídico.** A intenção é proteger famílias e operação com processos simples.

### 9.1 Documentos publicáveis necessários
- **Termos de Uso:** empresa responsável; escopo informativo; funcionalidades; limitações do PWA/push; preços, início/fim, carência e renovação manual; direito de arrependimento; regras para cuidadores; suspensão por abuso; suporte; tratamento de falhas; aviso que app não presta atendimento médico.
- **Política de Privacidade:** controlador/contato; dados de pagador processados no checkout; dados infantis indiretos como faixa etária e registros de cuidados; finalidade de cada dado; base legal definida com assessoria; compartilhamento com Netlify/Cloudflare/Mercado Pago/Meta se aplicável; armazenamento e transferências internacionais; prazo de conservação; medidas de proteção; direitos de titulares; canal de exclusão/correção e segurança.
- **Preferências de privacidade/cookies (LP):** separar o essencial do marketing; Pixel/CAPI e outros rastreadores de publicidade só conforme base legal definida e mecanismo de consentimento apropriado; possibilidade clara de recusar/alterar preferências sem bloquear compra.
- **Política de reembolso e contato:** canal visível e resposta facilitada; não tentar reduzir o direito do CDC.
- **Aviso médico fixo:** “O Rotininha ajuda a organizar os cuidados e não substitui a orientação do pediatra.”

### 9.2 LGPD e melhor interesse da criança
- Tratar os dados coletados sobre bebês como potencialmente **dados pessoais da criança**, mesmo sem nome, quando associados a código/dispositivo/família. Alguns registros podem revelar aspectos de saúde. Mapear classificação e hipóteses legais (arts. 7º/11 e 14 LGPD); o Enunciado ANPD 1/2023 exige prevalência do melhor interesse, não determina consentimento como única hipótese em todo caso.
- Coletar o mínimo; não exigir foto, nome completo, endereço, data de nascimento exata, dados clínicos ou CPF da criança.
- O app é **operado por pais e cuidadores adultos**, não desenhado para uso autônomo por crianças. **Avaliar com jurídico se e como o ECA Digital (Lei 15.211/2025, em vigor desde 17/03/2026) incide no produto**; não presumir exclusão nem aplicação automática de todas as obrigações destinadas a apps acessados por crianças.
- Retenção documentada, exclusão facilitada, revogação de cuidadores e medidas de proteção por padrão.
- Criptografar comunicações em trânsito, proteger backups e usar permissões mínimas; documentar incidentes e contato responsável.

### 9.3 Precauções clínicas e de comunicação
- Amamentação em livre demanda; configurações personalizadas não equivalem a orientações clínicas.
- Jamais calcular dose, sugerir medicamento ou tratar lembretes como prescrição.
- Conteúdo de sono seguro baseado na SBP e revisado antes do lançamento. Não recomendar objetos soltos no berço, colchões inclinados nem posição lateral como alternativa rotineira de sono para menores de um ano.
- Sons de dormir são **pós-MVP**; se incluídos, usar áudio com direitos comprovados, volume moderado e aparelho longe do berço, sem promessas terapêuticas.
- Não coletar foto/áudio do bebê para aumentar engajamento. Não vender/ceder dados infantis para segmentação publicitária.

## 10. Meta Pixel e CAPI (somente aquisição e venda)

| Evento | Ambiente | Regra |
|---|---|---|
| PageView | LP | Só conforme preferências/hipótese legal de tracking |
| ViewContent | LP | Prévia realmente exibida |
| InitiateCheckout | LP | Checkout iniciado ou Pix gerado, definição consistente |
| Purchase entrada | LP + webhook/CAPI | Pix confirmado, mesmo `event_id` quando ambos forem enviados |
| Purchase renovação | Backend/CAPI, se permitido | Pix da renovação confirmado; evitar dados infantis |

- Não enviar idade de bebê, títulos, horários, medicamentos, histórico, sintomas ou conteúdo do quiz em Pixel/CAPI.
- `fbp`, `fbc`, identificadores e cookies são dados de rastreamento: coletar/usar apenas conforme configuração jurídica válida e preferências registradas; deduplicação usando `event_id` estável por pagamento.
- Se não houver base legal ou consentimento apropriado, **não enviar** eventos pessoais à Meta; medir compra e funil em analytics internos agregados.

## 11. Métricas e experimentos

**Funil:** visita → visualizou motion → iniciou Pix → Pix pago → primeiro acesso → instalou PWA → ativou push → fez 1º registro → retorno no D2/D7 → conclusão do guia → renovação.  
**Indicadores essenciais:** taxa de ativação real; % que registrou algo no primeiro dia; % de usuários elegíveis com push autorizado; tarefas/registro por usuário ativo (não comparar famílias entre si); retenção em D3 e D7; taxa de renovação (meta de hipótese inicial 25%, sem promessa); taxa de reembolso; tickets de suporte; erro/atraso de push.  
**Feedback de produto:** % de contas elegíveis, visualizações do cartão, envio de sugestões, temas frequentes e pedidos mais recorrentes; analisar apenas agregados.
**Decisões guiadas por dados:** motion melhora geração de Pix? A instalação causa perda? As mães usam mais registro do que tarefas agendadas? O compartilhamento influencia retenção?

## 12. Ordem de construção para Claude Code

**Fase A — Prova técnica (antes do funil):**
1. Definir design tokens, componentes de interface e navegação “Hoje”.
2. Implementar IndexedDB, registro rápido, cronômetro, histórico e rotina simples.
3. PWA instalável; validar iPhone/Android, serviço de notificação (Web Push com VAPID compatível Workers), Cron e deduplicação.
4. Criar D1, API, sessões e sincronização; testar concluiu → não recebe push de atraso.

**Fase B — MVP vendável:**
5. Mercado Pago Pix, webhook seguro, acesso, entrega, instalação guiada, recuperação e reembolso operacional.
6. Onboarding flexível; guia de 7 dias com revisão profissional; renovação manual/expiração.
7. Landing page com motion demonstrativo, quiz opcional, preço, FAQ, documentos e rastreamento compatível com preferências.
8. Compartilhamento básico entre dois cuidadores **se couber sem prejudicar qualidade**; caso contrário, entregar na primeira atualização e não anunciá-lo ainda.

**Fase C — Melhoria pós-validação:** ativar convite automático da caixa de sugestões (se ficou atrás de feature flag), revisar feedback recebido, exportar resumo para pediatra, perfil de múltiplos bebês, sons de dormir, mais trilhas, dados agregados, testes de order bump e melhoria do compartilhamento.

## 13. Critérios de aceite da primeira versão

- [ ] No celular, registrar mamada/sono/fralda com no máximo dois toques.
- [ ] Editar e excluir registro, refletindo no histórico e no último cuidado.
- [ ] Lembrete criado chega em iPhone PWA instalado e em Android com permissão; cenários sem push têm aviso honesto.
- [ ] Marcar feito/adiar cancela futuros alertas indevidos da ocorrência.
- [ ] Instalação guiada a partir do navegador do Instagram para navegador compatível.
- [ ] Pagamento aprovado libera acesso **uma vez**; webhook duplicado não altera validade duas vezes.
- [ ] Código não aparece em URL permanente; há recuperação de compra e proteção contra brute force.
- [ ] Vencimento e carência funcionam conforme preço e contrato; Pix de renovação restaura edição/push.
- [ ] Funciona offline para registrar e sincroniza depois sem duplicação.
- [ ] Motion da LP roda de forma leve, pode pausar, respeita movimento reduzido e tem fallback estático.
- [ ] Termos, privacidade, identificação do fornecedor, suporte, direito de arrependimento e preferências de cookies estão disponíveis.
- [ ] Conteúdo de sono validado; mensagens não sugerem horários obrigatórios de amamentação ou doses.
- [ ] Não há dados infantis em ferramentas de marketing.
- [ ] Instrumentação de eventos e métricas não atrapalha performance do app.
- [ ] Caixa de sugestões em Ajustes funciona com mensagem de envio; exibição por engajamento respeita o gatilho, o adiamento e a feature flag escolhida.
- [ ] Sugestões não capturam dados infantis por solicitação, não são enviadas à Meta e possuem controle de acesso e retenção definida.

## 14. Prompt inicial para o Claude Code

> Você vai desenvolver o projeto **Rotininha**, conforme o PRD anexo. Primeiro, leia integralmente e identifique pontos de risco ou inconsistência. Entregue um plano curto de implementação por marcos, a arquitetura mínima e a estrutura de diretórios. **Não implemente o projeto todo em uma única etapa.** Priorize prova de instalação e Web Push real em iPhone, registro rápido, segurança do acesso e integração Pix confiável. Use design tokens exatamente como especificados, crie uma LP mobile-first com motion CSS/JS leve simulando notificações e marcação de tarefas e preserve acessibilidade, privacidade infantil e transparência comercial. Inclua uma caixa discreta de sugestões acessível por Ajustes e, quando houver engajamento real, um convite não intrusivo na tela Hoje; use feature flag se necessário. Evite abstrações e funcionalidades futuras. Para cada marco, apresente arquivos alterados, variáveis de ambiente, comandos de execução, testes e critérios de aceite. Não publique credenciais nem dados pessoais. Se uma decisão depender de parecer médico/jurídico ou de dispositivo real, sinalize claramente como pendência de lançamento.

---

## Referências oficiais de validação e benchmarking

**Marca e nome:**
- Produto comercial existente com nome “Mapa da Mamãe”: https://mapadamamae.com.br/
- INPI, guia de busca prévia: https://www.gov.br/inpi/pt-br/servicos/marcas/guia-basico
- INPI, consulta pública: https://servicos.busca.inpi.gov.br/marcas

**Legislação e proteção:**
- CDC, art. 49 (direito de arrependimento): https://consumidor.gov.br/pages/conteudo/publico/102
- Decreto 7.962/2013 (comércio eletrônico): https://legis.senado.gov.br/norma/413161/publicacao/15762397
- ANPD, Enunciado 1/2023 (melhor interesse da criança): https://bibliotecadigital.mj.gov.br/bitstream/1/10215/2/Enunciado_ANPD_2023_1.html
- ANPD, guia de cookies: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais
- ECA Digital, portal da ANPD: https://www.gov.br/anpd/pt-br/assuntos/eca-digital/

**Criança e produto:**
- SBP, recomendações de sono seguro: https://www.sbp.com.br/bebe-deve-dormir-de-barriga-para-cima-ou-de-lado-pediatras-reforcam-recomendacoes-para-o-sono-seguro/
- Ministério da Saúde, amamentação em livre demanda: https://linhasdecuidado.saude.gov.br/portal/puericultura/unidade-de-atencao-primaria/crianca/
- Apple/WebKit, Web Push em apps na tela inicial: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Mercado Pago Pix: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix
- Mercado Pago Webhooks: https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/notifications/webhooks
- W3C WCAG 2.2: https://www.w3.org/TR/wcag/

**Mercado/experiência (benchmark, não copiar):**
- Huckleberry, tracking e sincronização: https://huckleberrycare.com/product/free
- Nara Baby, estudos de UX: https://www.ninetwothree.co/case-studies/nara-baby-tracker

**Importante:** Esta pesquisa aponta anterioridade comercial, mas não constitui parecer de disponibilidade de marca. Documento de produto, arquitetura e conformidade preliminar. O texto final dos Termos/Privacidade, modelo de dados e conteúdo de sono requerem revisão especializada antes de publicar e vender.
