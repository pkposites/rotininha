import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicKey, verify } from 'node:crypto';
import { encryptPayload, vapidHeader, b64u, generateVapidKeys } from '../src/webpush.ts';

const td = new TextDecoder();

test('RFC 8291 Apêndice A: saída idêntica ao vetor oficial', async () => {
  const plaintext = b64u.dec('V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24');
  const out = await encryptPayload(
    plaintext,
    'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    'BTBZMqHH6r4Tts7J_aSIgg',
    {
      salt: b64u.dec('DGv6ra1nlYgDCS1FRnbzlw'),
      asPrivate: b64u.dec('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'),
      asPublic: b64u.dec('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8')
    }
  );
  // O RFC lista cabeçalho (86 bytes) e texto cifrado separados: comparar os BYTES concatenados.
  const header = b64u.dec('DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
  const cipher = b64u.dec('8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ');
  assert.equal(header.length, 86);
  const expected = b64u.enc(new Uint8Array([...header, ...cipher]));
  assert.equal(b64u.enc(out), expected);
});

test('payload cifrado aleatório muda a cada envio (chave efêmera + salt)', async () => {
  const ua = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';
  const a = await encryptPayload(new Uint8Array([1, 2, 3]), ua, 'BTBZMqHH6r4Tts7J_aSIgg');
  const b = await encryptPayload(new Uint8Array([1, 2, 3]), ua, 'BTBZMqHH6r4Tts7J_aSIgg');
  assert.notEqual(b64u.enc(a), b64u.enc(b));
});

test('rejeita chave/auth malformadas', async () => {
  await assert.rejects(() => encryptPayload(new Uint8Array(1), 'AAAA', 'BTBZMqHH6r4Tts7J_aSIgg'));
  await assert.rejects(() => encryptPayload(new Uint8Array(1), 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', 'curto'));
});

test('VAPID: JWT ES256 com aud/exp/sub corretos e assinatura verificável', async () => {
  const { publicKey, privateKey } = await generateVapidKeys();
  const now = 1_800_000_000_000;
  const h = await vapidHeader('https://push.example.com/abc/def', 'mailto:suporte@exemplo.com', publicKey, privateKey, now);
  const m = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(h);
  assert.ok(m, 'formato do cabeçalho');
  const [, hd, cl, sg, k] = m;
  assert.equal(k, publicKey);
  assert.deepEqual(JSON.parse(td.decode(b64u.dec(hd))), { typ: 'JWT', alg: 'ES256' });
  const claims = JSON.parse(td.decode(b64u.dec(cl)));
  assert.equal(claims.aud, 'https://push.example.com');
  assert.equal(claims.sub, 'mailto:suporte@exemplo.com');
  assert.equal(claims.exp, Math.floor(now / 1000) + 12 * 3600);
  const pub = b64u.dec(publicKey);
  const keyObj = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u.enc(pub.slice(1, 33)), y: b64u.enc(pub.slice(33, 65)) }, format: 'jwk' });
  const ok = verify('sha256', Buffer.from(`${hd}.${cl}`), { key: keyObj, dsaEncoding: 'ieee-p1363' }, Buffer.from(b64u.dec(sg)));
  assert.equal(ok, true);
});
