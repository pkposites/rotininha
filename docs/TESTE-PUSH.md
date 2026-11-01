# Roteiro de teste de push em aparelho real (Marco 3)

Isto **não** pode ser validado só com testes automáticos: depende do iPhone/Android real e do serviço de push da Apple/Google.
Já validado em ambiente local: criptografia (vetor oficial RFC 8291), VAPID, Cron, deduplicação, "Feito/Adiar" cancelando alertas, silêncio 22h–6h.

## Preparação (uma vez)
1. `cd apps/api && node scripts/gen-vapid.mjs` → guarde os 4 valores.
2. `npx wrangler d1 create rotininha` → copie o `database_id` para `wrangler.toml`.
3. `npx wrangler d1 migrations apply rotininha --remote`
4. Segredos: `npx wrangler secret put CODE_PEPPER`, `PUSH_SEAL_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
5. Em `wrangler.toml`: `VAPID_SUBJECT` (e-mail real de suporte) e `ALLOWED_ORIGIN` (URL do Netlify). Para criar uma família de teste em staging, use `ALLOW_DEV_SIGNUP="true"` **apenas em staging**.
6. `npx wrangler deploy`; no Netlify defina `VITE_API_BASE_URL` com a URL do Worker e publique.
7. Crie uma família de teste: `curl -X POST https://<worker>/v1/dev/households` → anote o código.

## iPhone (iOS 16.4+)
- [ ] Abrir no Safari → Compartilhar → **Adicionar à Tela de Início** → abrir **pelo ícone**.
- [ ] Ajustes → Conectar com o código. 
- [ ] Ajustes → **Ativar lembretes** (toque explícito) → permitir.
- [ ] **Enviar notificação de teste** → chega com o app aberto, em segundo plano e com a tela bloqueada?
- [ ] Criar lembrete para daqui a 3 min → toca no horário (±1 min)?
- [ ] Tocar na notificação → abre o lembrete **sem** marcar como feito.
- [ ] Criar outro lembrete, marcar **Feito** antes do horário → não toca.
- [ ] Adiar 10 min → toca no novo horário, não no original.
- [ ] Remédio → notificação com texto genérico ("Você tem um lembrete do Rotininha").
- [ ] "Esconder detalhes na tela de bloqueio" → texto genérico.
- [ ] Safari **sem** instalar: Ajustes mostra orientação para instalar (e não promete lembrete).
- [ ] Modo avião: registrar cuidado → volta a conexão → sincroniza sem duplicar.
- [ ] Aviso aparece ao abrir pelo navegador do Instagram? (instalação guiada é do Marco 5)

## Android (Chrome)
- [ ] Mesmos itens acima (a instalação é opcional no Android, mas teste ambos).
- [ ] Economia de bateria agressiva (Xiaomi/Samsung): lembrete ainda toca? Registre o resultado por marca.

## Dois aparelhos
- [ ] Lembrete criado em A aparece em B; "Feito" em B cancela o alerta em A.
- [ ] Mesmo lembrete não toca duas vezes no mesmo aparelho.

## Registrar resultado
Anote em `docs/pendencias-lancamento.md`: modelo/versão do aparelho, o que funcionou, atraso médio observado.
