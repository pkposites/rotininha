// Regras de apoio à usabilidade (puras, testáveis em Node).
import { occursOn, occurrenceTime, occId, localParts } from '../../../../packages/shared/schedule.js';

const hhmm = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** Mensagem do aviso depois de um registro rápido (concordância correta por tipo). */
export function registeredMessage(type, event, woke) {
  if (woke) return `Acordou às ${hhmm(event.endedAt)}`;
  if (type === 'sono') return `Soneca iniciada às ${hhmm(event.startedAt)}`;
  return `${type === 'mamada' ? 'Mamada' : 'Fralda'} registrada às ${hhmm(event.startedAt)}`;
}

/** Segundo toque no mesmo botão em menos de `ms` = toque duplo acidental (dois cuidados reais ficam a mais de 1,5 s). */
export const DOUBLE_TAP_MS = 1500;
export const isDoubleTap = (last, type, now, ms = DOUBLE_TAP_MS) => !!last && last.type === type && now - last.at < ms;

/**
 * Separa os lembretes de hoje e diz qual é o próximo de verdade.
 * pending = ainda por fazer (inclui adiados e atrasados); handled = feitos ou pulados;
 * next = próxima ocorrência futura quando não resta nada pendente hoje (olha até 14 dias).
 */
export function reminderView(items, tasks, occs, now, tz) {
  const pending = items.filter((i) => i.status === 'pending' || i.status === 'snoozed');
  const handled = items.filter((i) => i.status === 'done' || i.status === 'skipped');
  let next = null;
  if (!pending.length && tasks.some((t) => !t.deleted)) {
    const today = localParts(now, tz).date;
    const byId = new Map(occs.map((o) => [o.id, o]));
    outer: for (let d = 1; d <= 14; d++) {
      const date = new Date(Date.parse(today + 'T12:00:00Z') + d * 86_400_000).toISOString().slice(0, 10);
      const found = [];
      for (const task of tasks) {
        if (task.deleted || !occursOn(task, date, tz)) continue;
        const o = byId.get(occId(task.id, date));
        if (o && !o.deleted && (o.status === 'done' || o.status === 'skipped')) continue;
        found.push({ task, at: occurrenceTime(task, date, tz), date });
      }
      if (found.length) { found.sort((a, b) => a.at - b.at); next = { ...found[0], days: d }; break outer; }
    }
  }
  return { pending, handled, next };
}

export const nextLabel = (next) => next ? `${next.days === 1 ? 'amanhã' : new Date(next.at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })} às ${hhmm(next.at)}` : '';

const fmtDay = (ts) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

/**
 * Texto do acesso grátis a partir da regra real do servidor (/v1/plans → trial):
 *  - sem data de cobrança: acesso grátis de lançamento, sem prazo, aviso prévio garantido;
 *  - cobrança agendada: informa a data e até quando vai o acesso grátis de quem entra agora;
 *  - cobrança ativa: teste de N dias com data de término.
 */
export function trialCopy(t, now = Date.now()) {
  const days = t?.days ?? 3, notice = t?.noticeDays ?? 7;
  const price = 'R$ 37,90 (pagamento único, vitalício — valor previsto)';
  if (t?.active) {
    return { kind: 'active', title: `Teste grátis de ${days} dias`, lead: `Seu teste grátis dura ${days} dias a partir do cadastro e termina em uma data que mostramos em Ajustes. Depois disso, para continuar, o acesso custa ${price}. Sem cartão e sem cobrança automática.`, endsAt: (n) => n + days * 86_400_000 };
  }
  if (t?.enforceFrom) {
    const until = t.enforceFrom + days * 86_400_000;
    return { kind: 'scheduled', title: 'Acesso grátis até ' + fmtDay(until), lead: `A cobrança começa em ${fmtDay(t.enforceFrom)}. Quem usa agora tem acesso grátis até ${fmtDay(until)} (inclui ${days} dias de teste depois do início). Depois disso, o acesso custa ${price}. Sem cartão e sem cobrança automática.`, until };
  }
  return { kind: 'launch', title: 'Acesso grátis no lançamento', lead: `Hoje o Ninhora é grátis e não tem data para acabar. Antes de começar a cobrar, avisamos com pelo menos ${notice} dias de antecedência, e você ainda terá ${days} dias de teste antes de qualquer pagamento. Previsão: ${price}. Sem cartão e sem cobrança automática.` };
}

/** Nome para personalização: sem controle/HTML, espaços normalizados, até 30 caracteres. Fica só no aparelho. */
export const cleanName = (v) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);
