import type { Env } from './types';
import { sha256Hex, randomToken } from './crypto';

const ITER = 100_000; // máximo aceito pelo WebCrypto do Workers
const enc = new TextEncoder();

export { normalizePhone, checkPassword } from './phone';

export const hashPhone = (env: Env, phone: string) => sha256Hex(`${env.CODE_PEPPER}:wa:${phone}`);

async function derive(env: Env, pw: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: ITER, salt: enc.encode(`${salt}:${env.CODE_PEPPER}`) }, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function makePassword(env: Env, pw: string) {
  const salt = randomToken(16);
  return { pw_salt: salt, pw_hash: await derive(env, pw, salt) };
}

const eq = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

/** Confere a senha. Sem conta, faz o mesmo trabalho (tempo parecido) e responde igual: ninguém descobre quais números têm conta. */
export async function verifyLogin(env: Env, phone: string, pw: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT id, pw_hash, pw_salt FROM households WHERE phone_hash = ?').bind(await hashPhone(env, phone)).first<{ id: string; pw_hash: string | null; pw_salt: string | null }>();
  const got = await derive(env, pw, row?.pw_salt ?? 'sem-conta');
  return row?.pw_hash && eq(got, row.pw_hash) ? row.id : null;
}
