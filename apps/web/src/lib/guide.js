// Guia "Rotina e Sono em 7 Dias" — lógica de liberação e progresso (pura).
import { localParts } from '../../../../packages/shared/schedule.js';

/** Conteúdo ainda NÃO revisado por profissional de saúde: não comercializar antes (PRD §3.7). */
export const GUIDE_REVIEWED = false;

const dayNumber = (d) => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd) / 86_400_000; };

/** Dia do guia (1..) na data local de `now`, contando dias corridos desde `startDate` (YYYY-MM-DD). */
export function guideDay(startDate, now, tz) {
  const today = localParts(now, tz).date;
  return Math.max(1, dayNumber(today) - dayNumber(startDate) + 1);
}

/** Lição 1 liberada na hora; as próximas em dias corridos; todas ficam acessíveis enquanto o acesso estiver ativo. */
export function unlockedLessons(startDate, now, tz, total = 7) {
  return Math.min(total, guideDay(startDate, now, tz));
}

/** Acesso ao conteúdo: ativo ou em carência. Vencido → bloqueado (dados continuam visíveis em outras telas). */
export const guideAccessible = (account) => !account || account.state === 'active' || account.state === 'grace';

export const SAFE_SLEEP_ITEMS = [
  'O bebê dorme de barriga para cima (menores de 1 ano).',
  'O colchão é firme, plano e sem inclinação.',
  'O berço está sem travesseiros, protetores, mantas soltas ou bichos de pelúcia.',
  'O bebê dorme em superfície própria para ele, e não em sofás ou poltronas.',
  'Dúvidas sobre o sono do seu bebê? Anotei para conversar com o pediatra.'
];

export const RITUAL_DEFAULTS = ['Banho morno', 'Luz baixa', 'Uma canção ou história curta', 'Colo e boa-noite'];

export const LESSONS = [
  {
    day: 1, minutes: 2, title: 'O valor de uma rotina flexível',
    body: [
      'Rotina não é relógio. É uma sequência de momentos que se repetem — banho, colo, ninar — e que ajudam o bebê (e você) a saber o que vem depois.',
      'Cada família tem o seu ritmo, e ele muda conforme o bebê cresce. Uma rotina flexível acompanha essas mudanças em vez de cobrar perfeição.',
      'Hoje, escolha só um marco do seu dia: algo que costuma acontecer quase sempre, como o banho ou o boa-noite. Um é suficiente.'
    ],
    action: { type: 'task', label: 'Escolher meu marco do dia', task: { title: 'Meu marco do dia', category: 'outro', time: '19:00' } }
  },
  {
    day: 2, minutes: 2, title: 'Observar sinais de cansaço',
    body: [
      'Bebês dão pistas de que estão cansados: ficam mais quietos, esfregam os olhos, bocejam, ficam mais irritados ou desviam o olhar.',
      'Esses sinais variam de bebê para bebê. Observar com carinho, sem pressa de “acertar”, ajuda você a conhecer o seu.',
      'Que tal um lembrete discreto para reparar nesses sinais ao longo do dia?'
    ],
    action: { type: 'task', label: 'Criar lembrete de observação', task: { title: 'Observar sinais de cansaço', category: 'estimulo', time: '15:00' } }
  },
  {
    day: 3, minutes: 2, title: 'Sonecas variam entre bebês e idades',
    body: [
      'Não existe um número de sonecas ou de horas de sono que valha para todo bebê. Isso muda de bebê para bebê e de fase para fase.',
      'Em vez de buscar um número, registre o que acontece. Com alguns dias de registro, você enxerga o padrão do seu bebê — e pode mostrá-lo ao pediatra, se quiser.',
      'Hoje, use o botão “Dormiu / Acordou” quando puder. Sem meta e sem cobrança.'
    ],
    action: { type: 'go-today', label: 'Ir para a tela Hoje' }
  },
  {
    day: 4, minutes: 2, title: 'Sono seguro',
    body: [
      'Para dormir com segurança, a Sociedade Brasileira de Pediatria orienta: bebê de barriga para cima (menores de um ano), em superfície firme, plana e não inclinada, com o berço livre de objetos soltos.',
      'Evite travesseiros, protetores de berço, mantas soltas e bichos de pelúcia no berço. Dormir em sofá ou poltrona também não é seguro.',
      'Siga sempre a orientação do pediatra do seu bebê. Use a lista abaixo para conferir o ambiente.'
    ],
    action: { type: 'checklist', key: 'safe-sleep', label: 'Checklist de ambiente seguro' }
  },
  {
    day: 5, minutes: 2, title: 'Um ritual de noite acolhedor',
    body: [
      'Um ritual curto e repetido todas as noites avisa ao bebê que o dia está terminando. Pode ser simples: banho, luz baixa, uma canção.',
      'O melhor ritual é o que cabe na sua vida. Monte o seu abaixo — você pode editar, tirar e acrescentar passos.',
      'Quando estiver pronto, crie um lembrete para o ritual da noite.'
    ],
    action: { type: 'ritual', key: 'ritual', label: 'Criar checklist do ritual', task: { title: 'Ritual da noite', category: 'outro', time: '19:30' } }
  },
  {
    day: 6, minutes: 2, title: 'Despertares fazem parte do desenvolvimento',
    body: [
      'Acordar durante a noite é comum nos primeiros meses e acontece por vários motivos. Faz parte do desenvolvimento.',
      'Se algo parecer fora do comum ou preocupar você, converse com o pediatra — o Ninhora não faz diagnóstico nem substitui essa conversa.',
      'Para ajudar a manter o seu ritmo, você pode deixar um lembrete de rotina para a noite.'
    ],
    action: { type: 'task', label: 'Criar lembrete de rotina', task: { title: 'Rotina da noite', category: 'outro', time: '20:00' } }
  },
  {
    day: 7, minutes: 2, title: 'Rever e adaptar o que funcionou',
    body: [
      'Você chegou ao fim da primeira semana. Olhe seus registros e lembretes: o que ajudou? O que não fez sentido? Ajuste, apague, troque horários.',
      'Uma rotina boa é a que você consegue manter sem culpa. Mudou a fase do bebê? Mude a rotina também.',
      'Parabéns pelo cuidado! Agora é só continuar do seu jeito.'
    ],
    action: { type: 'finish', label: 'Concluir o guia' }
  }
];

export const lessonByDay = (d) => LESSONS.find((l) => l.day === d);
