# LP Ninhora — nova versão (pronta, NÃO publicada)

Pasta completa para substituir a LP `ninhoralp.relatoriorda.com.br` (projeto Netlify `calm-arithmetic-e1bbd9`).

## O que mudou
- **Sem lista de espera / "em preparação" / "lista de interesse"** em lugar nenhum (página, obrigada e privacidade).
- Botão principal **"Começar grátis"** (topo, passos, preço e botão fixo do celular) → `https://rotininha.relatoriorda.com.br/app/?src=lp`. O app conta quem chega por esse link no painel (`Chegaram da LP ao app`).
- Mesma estrutura da LP do app: hero, **6 vantagens** (registros, lembretes, saltos, sons, guia), **3 passos** (criar conta com WhatsApp e senha, instalar, usar), demonstração interativa, **preço** (grátis hoje; aviso antes de cobrar; 3 dias de teste; previsão de R$ 37,90 vitalício, via Pix), **FAQ** igual ao do app, rodapé com Termos e Reembolso.
- O formulário continua, reposicionado como **"Receba dicas e novidades"** (opcional). **Todos os campos, nomes e ids foram mantidos** (Netlify Forms `ninhora-leads`, UTMs, campos da Meta, `bot-field`), então o Cadê o Lead, o Pixel e a função `ninhora-form-capi` seguem iguais.
- Página `/obrigada/` e `/privacidade` atualizadas (sem "lista", com o app e o Clarity).
- **Clarity** (`z6vtf1eenb`) incluído no `consent.js`: só carrega depois de "Aceitar medição"; formulário mascarado.

## Arquivos
`index.html`, `styles.css` (novo trecho no final), `script.js` (igual ao atual), `consent.js` (com o Clarity), `obrigada/index.html`, `privacidade.html` (o nome do arquivo no site pode ser `privacidade/index.html`: mantenha o que a LP já usa), `assets/mae-bebe.webp`.

## Antes de publicar
- **Não use o snippet de injeção do Netlify do Clarity junto com este `consent.js`**: o Clarity carregaria duas vezes. Use um ou outro.
- Publique a **pasta inteira da LP** (com a pasta de funções `netlify/functions`, onde está `ninhora-form-capi`). Publicar só estes arquivos soltos pode derrubar o envio do evento Lead.
- Depois de publicar: abra em janela anônima, confira que o botão leva ao app e envie **um cadastro de teste com dados fictícios** (avise antes, para apagarmos o lead).

## Testado (localmente)
Sem menção a lista/preparação; botões com `?src=lp`; campos do formulário completos; demonstração; Clarity só após aceite; obrigada com UTMs; privacidade atualizada; sem erros de JS.

## Prompt para o Claude conectado ao projeto da LP (cole lá)
```text
Atualize a LP de captação da Ninhora (https://ninhoralp.relatoriorda.com.br/, projeto Netlify "calm-arithmetic-e1bbd9") usando os arquivos da pasta `lp-ninhoralp/` do repositório pkposites/rotininha, branch `claude/new-session-64jni6` (leia o LEIA-ME.md dessa pasta antes).
Regras: não mexa na função "ninhora-form-capi", no formulário Netlify "ninhora-leads" (campos e ids), no tracker Cadê o Lead, no Meta Pixel, no Worker "ninhora-capi-leads", em variáveis de ambiente nem em domínios. Não publique arquivos soltos: publique a pasta inteira da LP, incluindo as funções. Se houver snippet de injeção do Clarity no Netlify, REMOVA-O (o consent.js novo já carrega o Clarity depois do aceite; os dois juntos carregariam duas vezes).
Passos: 1) copie index.html, styles.css, script.js, consent.js, obrigada/index.html, privacidade (o arquivo de privacidade que a LP já usa) e assets/ para a pasta da LP; 2) rode a LP localmente e confira: nenhuma menção a "lista de espera/interesse/em preparação"; os botões "Começar grátis" levam a https://rotininha.relatoriorda.com.br/app/?src=lp; o formulário tem todos os campos originais; 3) só então publique; 4) abra em janela anônima, confirme que o Clarity só carrega depois de "Aceitar medição" e envie UM cadastro de teste com dados fictícios (me avise antes, para apagarmos o lead).
Ao terminar, diga o que alterou, o que testou e o que ficou pendente.
```
