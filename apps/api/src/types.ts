export interface Env {
  DB: D1Database;
  CODE_PEPPER: string;
  ALLOWED_ORIGIN: string;
  ALLOW_DEV_SIGNUP?: string;
}

export interface ClientEvent {
  id: string;
  type: 'mamada' | 'sono' | 'fralda';
  startedAt: number;
  endedAt: number | null;
  note: string;
  detail: string;
  updatedAt: number;
  deleted: boolean;
}

export interface Auth { householdId: string; sessionId: string; deviceId: string; graceUntil: number | null }
