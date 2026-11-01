// Verificação da assinatura do webhook do Mercado Pago (cabeçalho x-signature). Sem imports: testável em Node.
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

export function parseSignature(h: string | null): { ts: string; v1: string } | null {
  if (!h) return null;
  const parts = Object.fromEntries(h.split(',').map((p) => p.trim().split('=', 2) as [string, string]));
  return parts.ts && parts.v1 ? { ts: parts.ts, v1: parts.v1 } : null;
}

/** Manifesto: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" (id em minúsculas se alfanumérico). */
export function manifest(dataId: string, requestId: string, ts: string): string {
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  return `id:${id};request-id:${requestId};ts:${ts};`;
}

export async function signManifest(secret: string, m: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(m)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function verifyMpSignature(
  secret: string, xSignature: string | null, xRequestId: string | null, dataId: string | null
): Promise<boolean> {
  if (!secret || !xRequestId || !dataId) return false;
  const sig = parseSignature(xSignature);
  if (!sig) return false;
  return timingSafeEqual(await signManifest(secret, manifest(dataId, xRequestId, sig.ts)), sig.v1.toLowerCase());
}
