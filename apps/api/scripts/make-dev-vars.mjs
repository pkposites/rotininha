// Gera apps/api/.dev.vars para desenvolvimento/testes locais (segredos aleatórios; NUNCA use em produção).
//   node scripts/make-dev-vars.mjs [--force]
import { existsSync, writeFileSync } from 'node:fs';
import { generateVapidKeys, b64u } from '../src/webpush.ts';

const file = new URL('../.dev.vars', import.meta.url);
if (existsSync(file) && !process.argv.includes('--force')) { console.log('.dev.vars já existe (use --force para recriar)'); process.exit(0); }
const { publicKey, privateKey } = await generateVapidKeys();
const rand = () => b64u.enc(crypto.getRandomValues(new Uint8Array(32)));
writeFileSync(file, `CODE_PEPPER=${rand()}
PUSH_SEAL_KEY=${rand()}
VAPID_PUBLIC_KEY=${publicKey}
VAPID_PRIVATE_KEY=${privateKey}
VAPID_SUBJECT=mailto:dev@example.com
ALLOW_DEV_SIGNUP=true
ALLOWED_ORIGIN=http://localhost:4173
PAYMENTS_ENABLED=true
MP_ACCESS_TOKEN=TEST-token-local
MP_WEBHOOK_SECRET=whsec_test
MP_API_BASE=http://localhost:19877
PUBLIC_API_URL=http://localhost:8787
APP_URL=http://localhost:4173
EMAIL_PROVIDER=dev
SUPPORT_EMAIL=suporte@exemplo.com.br
ADMIN_TOKEN=admin-token-local-de-teste-1234567890
`);
console.log('.dev.vars criado');
