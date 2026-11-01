// Lembrete dentro do app para quem está sem conta e/ou sem o app instalado (sem conta não há notificação: este é o canal).
export const DAY = 86_400_000;
const BACKOFF = [1, 2, 4, 7]; // dias até a próxima vez, depois de cada "Agora não"; depois disso, a cada 7 dias
export const nextDelay = (dismissals) => (BACKOFF[Math.min(dismissals, BACKOFF.length - 1)]) * DAY;

/**
 * Decide se mostra o lembrete e quais itens.
 * Só aparece quando a pessoa já usou o app (tem algum registro/lembrete), nunca durante o onboarding,
 * respeita o intervalo, e some sozinho quando conta e instalação estão resolvidas.
 */
export function nudgePlan({ now, syncAvailable, signedOut, standalone, installDismissed, optOut, hasData, nextAt }) {
  const needAccount = !!syncAvailable && !!signedOut;
  const needInstall = !standalone && !installDismissed;
  if (optOut || !hasData || (!needAccount && !needInstall)) return { show: false, needAccount, needInstall };
  return { show: now >= (nextAt ?? 0), needAccount, needInstall };
}
