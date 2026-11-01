// Dicas práticas de cuidado ("Guia de cuidado") — texto educativo e conservador; não substitui o pediatra.
export const TIPS = [
  {
    id: 'agua', icon: '💧', title: 'Água e uma pausa para a mamãe',
    why: 'A água ajuda o corpo a funcionar e repõe as perdas de líquidos. Durante a amamentação, é comum sentir mais sede. Cuidar de você também faz parte da rotina.',
    do: ['Deixe água ao alcance onde você costuma alimentar ou acolher o bebê.', 'Beba ao longo do dia, respeitando a sede e a orientação da sua equipe de saúde.', 'Aproveite uma pausa para perceber se precisa comer, descansar ou pedir ajuda.'],
    care: 'Beber água em excesso não aumenta, por si só, a produção de leite. Se você tem orientação de restringir líquidos, siga sua equipe de saúde. Esta dica é para a mãe: não ofereça água a bebês menores de 6 meses sem orientação profissional.',
    action: { label: 'Preparar lembrete de água', task: { title: 'Beber água', category: 'outro', time: '10:00' } }
  },
  {
    id: 'sono', icon: '🌙', title: 'Sono: previsibilidade, sem rigidez',
    why: 'Uma sequência tranquila e repetida ajuda a sinalizar a transição para o descanso. A rotina também ajuda quem cuida a organizar o dia; ela não garante noites inteiras de sono.',
    do: ['Observe sinais como bocejo, desviar o olhar ou irritação; eles variam entre bebês.', 'Reduza luz e estímulos e repita uma sequência curta: colo, uma canção e boa-noite.', 'Toque em Dormiu quando o sono começar e em Acordou quando terminar. Depois, consulte o Histórico para observar o que aconteceu.'],
    care: 'Nos primeiros meses, despertares e horários variáveis são comuns. Não adie mamadas nem ignore sinais de fome para cumprir um horário. Para menores de 1 ano: barriga para cima, colchão firme e plano, superfície própria e sem objetos soltos. Sofás e poltronas não são lugares seguros para dormir.',
    action: { label: 'Preparar lembrete do ritual', task: { title: 'Ritual da noite', category: 'outro', time: '20:00' } }
  },
  {
    id: 'agitado', icon: '🤲', title: 'O bebê está agitado. Por onde começar?',
    why: 'Chorar é uma forma de comunicação. Fome, fralda, cansaço, calor, frio ou excesso de estímulos podem incomodar. Nem sempre é possível saber o motivo de imediato.',
    do: ['Observe o bebê: há sinais de fome, fralda suja, roupa apertada ou desconforto com a temperatura? Atenda às necessidades sem seguir apenas o relógio do app.', 'Tente uma coisa de cada vez: acolher no colo com a cabeça apoiada, falar baixo ou ir para um ambiente mais tranquilo.', 'Veja como ele responde. Se a agitação continuar, for diferente do habitual ou preocupar você, procure orientação de saúde.'],
    care: 'Nunca sacuda o bebê. Se estiver no limite, coloque-o de barriga para cima em um berço seguro, afaste-se por alguns minutos e peça ajuda a alguém de confiança. Não use remédios, chás ou óleos para acalmar sem orientação profissional.'
  },
  {
    id: 'acolher', icon: '🎵', title: 'Ideias para acolher e relaxar',
    why: 'Contato e menos estímulos podem trazer conforto. Cada bebê responde de um jeito: observe se a tentativa ajuda e pare se ele demonstrar incômodo.',
    do: ['Diminua televisão, conversas altas e luz forte. Fale ou cante suavemente.', 'Com você acordada e atenta, ofereça colo e movimentos suaves, apoiando a cabeça e o pescoço.', 'Se adormecer, coloque o bebê em uma superfície própria, firme e plana, de barriga para cima e sem objetos soltos. Se você estiver sonolenta, evite segurá-lo em sofá ou poltrona.'],
    care: 'Não há técnica que funcione sempre. Acolher não exige fazer o choro parar imediatamente. Dividir o cuidado e descansar também importa.',
    sounds: true
  }
];

export const WHEN_HELP = 'Procure atendimento imediato se houver dificuldade para respirar, lábios azulados, convulsão ou se o bebê estiver muito mole ou difícil de acordar. Febre em bebê com menos de 3 meses precisa de avaliação médica urgente. Recusa persistente de alimentação, muito menos fraldas molhadas ou choro diferente e inconsolável também precisam de avaliação. Em emergência no Brasil, ligue 192 (SAMU).';
export const WHEN_HELP_NOTE = 'O app não identifica doenças nem monitora sinais de urgência.';
