// Regra do convite de sugestões (PRD §3.9). Pura e testável; os limiares são hipóteses editáveis.
import { localParts } from '../../../../packages/shared/schedule.js';

export const RULES = { minDays: 3, minCare: 5, minDone: 3, hideAfterDismissDays: 7, hideAfterSubmitDays: 30 };
const DAY = 86_400_000;

/** Dias distintos (locais) com uso efetivo: registro de cuidado ou lembrete concluído. */
export function usageDays(events, occs, tz) {
  const days = new Set();
  for (const e of events) if (!e.deleted) days.add(localParts(e.startedAt, tz).date);
  for (const o of occs) if (!o.deleted && o.status === 'done') days.add(localParts(o.updatedAt, tz).date);
  return days;
}

export function engagement(events, occs, tz) {
  return {
    days: usageDays(events, occs, tz).size,
    care: events.filter((e) => !e.deleted).length,
    done: occs.filter((o) => !o.deleted && o.status === 'done').length
  };
}

/** Elegível: ≥3 dias distintos E (≥5 registros OU ≥3 lembretes concluídos). */
export const isEligible = (eng) => eng.days >= RULES.minDays && (eng.care >= RULES.minCare || eng.done >= RULES.minDone);

/**
 * Mostrar o cartão agora? Só na tela Hoje, depois de um cuidado registrado nesta sessão, nunca durante
 * onboarding, pagamento ou modo madrugada; respeita "Agora não" (7 dias) e envio (30 dias).
 */
export function shouldShowCard({ eng, now, dismissedAt, submittedAt, loggedThisSession, tab, night, busy, flag = true }) {
  if (!flag || !isEligible(eng)) return false;
  if (tab !== 'hoje' || night || busy || !loggedThisSession) return false;
  if (dismissedAt && now - dismissedAt < RULES.hideAfterDismissDays * DAY) return false;
  if (submittedAt && now - submittedAt < RULES.hideAfterSubmitDays * DAY) return false;
  return true;
}

export const FEEDBACK_CATEGORIES = [['lembretes', 'Lembretes'], ['registros', 'Registros'], ['compartilhar', 'Compartilhar cuidados'], ['outros', 'Outros']];
