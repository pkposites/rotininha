// Fonte única de preços e períodos. O cliente nunca informa valor: só o id do plano.
export const DAY_MS = 86_400_000;
export const GRACE_MS = 24 * 3_600_000; // carência de 24 h após o vencimento (benefício comercial planejado)
export const PIX_TTL_MS = 30 * 60_000;
export const DELIVERY_TTL_MS = 24 * 3_600_000;

export interface Plan { id: string; days: number; cents: number; label: string }
// Preço único e vitalício (pagamento único via Pix). "Vitalício" = 100 anos de validade, sem renovação.
export const LIFETIME_DAYS = 36_500;
export const PLANS: Record<string, Plan> = {
  life: { id: 'life', days: LIFETIME_DAYS, cents: 3790, label: 'Acesso vitalício' }
};
export const ENTRY_PLANS = ['life'];
export const RENEWAL_PLANS = ['life']; // quem está no teste grátis compra com a conta já conectada
