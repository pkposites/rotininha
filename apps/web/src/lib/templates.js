// Modelos EDITÁVEIS de rotina. Genéricos de propósito: sem horários/quantidade de sonecas por idade
// e sem intervalos de mamada ou remédio (isso exige revisão de pediatra — ver docs/pendencias-lancamento.md).
import { makeTask } from './tasks.js';

export const TEMPLATES = [
  {
    id: 'noite', title: 'Ritual da noite', icon: '🌙',
    desc: 'Um fim de dia tranquilo, do jeito da sua família.',
    items: [
      { title: 'Banho', category: 'banho', time: '19:00' },
      { title: 'Ritual da noite (luz baixa, canção ou história)', category: 'outro', time: '19:30' }
    ]
  },
  {
    id: 'sinais', title: 'Observar sinais de cansaço', icon: '👀',
    desc: 'Um lembrete para reparar nos sinais do seu bebê ao longo do dia.',
    items: [{ title: 'Observar sinais de cansaço', category: 'estimulo', time: '15:00' }]
  },
  {
    id: 'mae', title: 'Cuidado da mãe', icon: '💜',
    desc: 'Água e pausas para você. Pode ocultar quando quiser.',
    items: [
      { title: 'Beber água', category: 'mae', time: '10:00' },
      { title: 'Beber água', category: 'mae', time: '16:00' }
    ]
  }
];

/** Cria as tarefas dos modelos escolhidos. `times` permite o usuário ajustar o horário de cada item. */
export function tasksFromTemplates(ids, times = {}) {
  const out = [];
  for (const t of TEMPLATES) {
    if (!ids.includes(t.id)) continue;
    t.items.forEach((it, i) => out.push(makeTask({ ...it, time: times[`${t.id}:${i}`] ?? it.time, repeat: 'daily' })));
  }
  return out;
}

export const AGE_BANDS = [
  ['0-3m', '0 a 3 meses'], ['4-6m', '4 a 6 meses'], ['7-9m', '7 a 9 meses'], ['10-12m', '10 a 12 meses'], ['1-2a', '1 a 2 anos']
];
