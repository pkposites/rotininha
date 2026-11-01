// Fonte única de preços e períodos. O cliente nunca informa valor: só o id do plano.
export const DAY_MS = 86_400_000;
export const GRACE_MS = 24 * 3_600_000; // carência de 24 h após o vencimento (benefício comercial planejado)
export const PIX_TTL_MS = 30 * 60_000;
export const DELIVERY_TTL_MS = 24 * 3_600_000;

export interface Plan { id: string; days: number; cents: number; label: string }
export const PLANS: Record<string, Plan> = {
  '7d': { id: '7d', days: 7, cents: 1190, label: '7 dias' },
  '30d': { id: '30d', days: 30, cents: 1990, label: '30 dias' },
  '90d': { id: '90d', days: 90, cents: 3990, label: '90 dias' }
};
export const ENTRY_PLANS = ['7d'];            // oferta de entrada (PRD §4); 30/90 dias são renovações
export const RENEWAL_PLANS = ['7d', '30d', '90d'];
