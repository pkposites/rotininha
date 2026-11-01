import type { Env } from './types';
import { sha256Hex, randomToken, normalizeCode } from './crypto';

export const ACCESS_TTL = 60 * 60 * 1000;            // 1 h
export const REFRESH_TTL = 30 * 24 * 60 * 60 * 1000; // 30 dias

export const hashCode = (env: Env, code: string) => sha256Hex(env.CODE_PEPPER + ':' + normalizeCode(code));

export async function issueSession(env: Env, householdId: string, deviceId: string, now: number) {
  const access = randomToken(), refresh = randomToken(), id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO sessions (id, household_id, device_id, access_hash, access_expires, refresh_hash, refresh_expires, created_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).bind(id, householdId, deviceId, await sha256Hex(access), now + ACCESS_TTL, await sha256Hex(refresh), now + REFRESH_TTL, now).run();
  return { accessToken: access, refreshToken: refresh, accessExpiresAt: now + ACCESS_TTL };
}
