export interface Env {
  DB: D1Database;
  CODE_PEPPER: string;
  ALLOWED_ORIGIN: string;
  ALLOW_DEV_SIGNUP?: string;
  PUSH_SEAL_KEY: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
}

export type Kind = 'event' | 'task' | 'occ';

// Formato de rede: sempre tem kind, id, updatedAt, deleted.
export interface WireRecord { kind: Kind; id: string; updatedAt: number; deleted: boolean; [k: string]: any }

export interface Auth { householdId: string; sessionId: string; deviceId: string; graceUntil: number | null }
