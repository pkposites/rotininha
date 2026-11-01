export interface Env {
  DB: D1Database;
  CODE_PEPPER: string;
  ALLOWED_ORIGIN: string;
  ALLOW_DEV_SIGNUP?: string;
  PUSH_SEAL_KEY: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  PAYMENTS_ENABLED?: string;      // 'true' liga checkout/renovação. Padrão: desligado até o pagamento estar validado
  MP_ACCESS_TOKEN: string;
  MP_WEBHOOK_SECRET: string;
  MP_API_BASE?: string;           // padrão https://api.mercadopago.com (testes apontam para um simulador)
  PUBLIC_API_URL: string;         // URL pública do Worker (notification_url do Mercado Pago)
  APP_URL: string;                // URL do app (link de recuperação)
  EMAIL_PROVIDER?: string;        // 'dev' (caixa de saída local) | 'resend'
  EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
  SUPPORT_EMAIL?: string;
}

export type Kind = 'event' | 'task' | 'occ';

// Formato de rede: sempre tem kind, id, updatedAt, deleted.
export interface WireRecord { kind: Kind; id: string; updatedAt: number; deleted: boolean; [k: string]: any }

export interface Auth { householdId: string; sessionId: string; deviceId: string; graceUntil: number | null }
