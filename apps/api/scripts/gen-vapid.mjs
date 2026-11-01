// Gera chaves VAPID e a chave de selagem das inscrições. Rode uma vez por ambiente.
//   node scripts/gen-vapid.mjs            → imprime
// Produção: wrangler secret put VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / PUSH_SEAL_KEY / CODE_PEPPER
import { generateVapidKeys, b64u } from '../src/webpush.ts';
const { publicKey, privateKey } = await generateVapidKeys();
const rand = () => b64u.enc(crypto.getRandomValues(new Uint8Array(32)));
console.log(`VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\nPUSH_SEAL_KEY=${rand()}\nCODE_PEPPER=${rand()}`);
