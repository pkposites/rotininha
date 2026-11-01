// Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) só com WebCrypto — roda em Workers e em Node.
// Sem imports locais de runtime, para poder ser testado direto no Node.

const enc = new TextEncoder();

export const b64u = {
  enc(bytes: Uint8Array): string {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec(str: string): Uint8Array {
    const p = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
    return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
  }
};

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

function jwkFromRaw(pub: Uint8Array, d?: Uint8Array): JsonWebKey {
  return {
    kty: 'EC', crv: 'P-256', x: b64u.enc(pub.slice(1, 33)), y: b64u.enc(pub.slice(33, 65)),
    ...(d ? { d: b64u.enc(d) } : {}), ext: true
  };
}

export interface EncryptOptions { salt?: Uint8Array; asPrivate?: Uint8Array; asPublic?: Uint8Array }

/** Cifra `plaintext` para a inscrição (p256dh/auth em base64url). Retorna o corpo aes128gcm completo. */
export async function encryptPayload(
  plaintext: Uint8Array, uaPublicB64: string, authB64: string, opts: EncryptOptions = {}
): Promise<Uint8Array> {
  const uaPublic = b64u.dec(uaPublicB64);
  const authSecret = b64u.dec(authB64);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('p256dh inválida');
  if (authSecret.length !== 16) throw new Error('auth inválida');

  let asPublic: Uint8Array, asPrivKey: CryptoKey;
  if (opts.asPrivate && opts.asPublic) {
    asPublic = opts.asPublic;
    asPrivKey = await crypto.subtle.importKey('jwk', jwkFromRaw(asPublic, opts.asPrivate) as any, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  } else {
    const kp = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
    asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', kp.publicKey)) as ArrayBuffer);
    asPrivKey = kp.privateKey;
  }
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as any, asPrivKey, 256));

  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdh, keyInfo, 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const record = concat(plaintext, new Uint8Array([2])); // 0x02 = último registro
  if (record.length > 4096 - 16) throw new Error('payload grande demais');
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, record));

  const header = concat(salt, new Uint8Array([0, 0, 0x10, 0]), new Uint8Array([asPublic.length]), asPublic); // rs = 4096
  return concat(header, ct);
}

/** Cabeçalho Authorization VAPID (RFC 8292) para o endpoint. */
export async function vapidHeader(
  endpoint: string, subject: string, publicB64: string, privateB64: string, now = Date.now()
): Promise<string> {
  const pub = b64u.dec(publicB64);
  const key = await crypto.subtle.importKey('jwk', jwkFromRaw(pub, b64u.dec(privateB64)) as any, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const aud = new URL(endpoint).origin;
  const part = (o: unknown) => b64u.enc(enc.encode(JSON.stringify(o)));
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned)));
  return `vapid t=${unsigned}.${b64u.enc(sig)}, k=${publicB64}`;
}

export interface PushSub { endpoint: string; p256dh: string; auth: string }
export interface VapidConfig { subject: string; publicKey: string; privateKey: string }

/** Envia. Retorna o status HTTP do serviço de push (404/410 = inscrição morta). */
export async function sendWebPush(
  sub: PushSub, payload: unknown, vapid: VapidConfig, opts: { ttl?: number; urgency?: string; now?: number } = {}
): Promise<number> {
  const body = await encryptPayload(enc.encode(JSON.stringify(payload)), sub.p256dh, sub.auth);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(sub.endpoint, vapid.subject, vapid.publicKey, vapid.privateKey, opts.now),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(opts.ttl ?? 1800),
      Urgency: opts.urgency ?? 'normal'
    },
    body
  });
  await res.arrayBuffer().catch(() => {});
  return res.status;
}

export function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  return crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']).then(async (kp) => {
    const k = kp as CryptoKeyPair;
    const jwk = (await crypto.subtle.exportKey('jwk', k.privateKey)) as JsonWebKey;
    const pub = new Uint8Array((await crypto.subtle.exportKey('raw', k.publicKey)) as ArrayBuffer);
    return { publicKey: b64u.enc(pub), privateKey: jwk.d! };
  });
}
