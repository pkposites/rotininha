// Cifra chaves de inscrição push em repouso (AES-GCM, chave derivada de um segredo do Worker).
import { b64u } from './webpush';

async function key(secret: string) {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('rotininha-push-seal:' + secret));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function seal(secret: string, data: { p256dh: string; auth: string }): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(secret), new TextEncoder().encode(JSON.stringify(data))));
  return b64u.enc(iv) + '.' + b64u.enc(ct);
}

export async function unseal(secret: string, sealed: string): Promise<{ p256dh: string; auth: string }> {
  const [iv, ct] = sealed.split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64u.dec(iv) }, await key(secret), b64u.dec(ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
