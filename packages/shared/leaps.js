// Saltos de desenvolvimento — REFERÊNCIA POPULAR, não ciência consolidada nem diagnóstico.
// Semanas de idade (contadas desde o nascimento; em bebês prematuros, desde a data prevista do parto).
// Textos originais, genéricos e cuidadosos: cada bebê tem o seu ritmo.

export const LEAPS = [
  { n: 1, week: 5, title: 'Sentidos mais atentos', skill: 'Cores, sons e texturas chamam mais atenção.',
    signs: ['Mais choro ou irritação', 'Quer mais colo', 'Sono mais agitado'], tips: ['Colo e contato pele a pele', 'Ambiente calmo, com pouca estimulação', 'Paciência: costuma passar'] },
  { n: 2, week: 8, title: 'Padrões e repetições', skill: 'Começa a notar o que se repete: rostos, brinquedos, movimentos.',
    signs: ['Mais manhoso', 'Mamadas mais frequentes ou mais curtas', 'Estranha o ambiente'], tips: ['Repita pequenas brincadeiras', 'Mantenha a rotina simples', 'Ofereça colo sem culpa'] },
  { n: 3, week: 12, title: 'Movimentos mais suaves', skill: 'Controla melhor mãos e cabeça; os movimentos ficam mais fluidos.',
    signs: ['Irritação ao fim do dia', 'Sono mais curto', 'Mais atenção às mãos'], tips: ['Tempo de barriga para baixo com você por perto', 'Brinquedos fáceis de segurar', 'Respeite os sinais de cansaço'] },
  { n: 4, week: 19, title: 'Causa e efeito', skill: 'Descobre que as ações têm resultado: bater, sacudir, soltar.',
    signs: ['Mais choro', 'Sono agitado', 'Menos interesse em mamar em alguns momentos'], tips: ['Chocalhos e objetos seguros', 'Brincadeiras de “achou!”', 'Rotina previsível ajuda'] },
  { n: 5, week: 26, title: 'Distância e relações', skill: 'Percebe que você pode se afastar e voltar; estranha pessoas novas.',
    signs: ['Chora quando você sai de vista', 'Grudado no colo', 'Acorda mais à noite'], tips: ['Despedidas curtas e carinhosas', 'Brincadeiras de esconder e voltar', 'Avise quando for sair do cômodo'] },
  { n: 6, week: 37, title: 'Agrupar e comparar', skill: 'Começa a comparar e agrupar coisas parecidas.',
    signs: ['Mais exigente', 'Sono irregular', 'Mudanças no apetite'], tips: ['Potes e brinquedos para encaixar e empilhar', 'Nomeie o que ele observa', 'Mantenha os rituais do dia'] },
  { n: 7, week: 46, title: 'Sequências do dia a dia', skill: 'Entende pequenas sequências: banho, mamadeira, hora de dormir.',
    signs: ['Teimosia', 'Protesta nas trocas e no banho', 'Sono mais curto'], tips: ['Avise o que vem a seguir', 'Ofereça pequenas escolhas', 'Rituais curtos e repetidos'] },
  { n: 8, week: 55, title: 'Imitar e planejar', skill: 'Imita gestos e começa a “planejar” o que quer fazer.',
    signs: ['Frustração fácil', 'Quer fazer sozinho', 'Mais colo à noite'], tips: ['Deixe tentar com segurança', 'Elogie o esforço', 'Calma nas birras: elas fazem parte'] },
  { n: 9, week: 64, title: 'Regras e limites', skill: 'Percebe regras e testa limites com mais frequência.',
    signs: ['Birras', 'Diz “não” com o corpo', 'Sono agitado'], tips: ['Limites simples e consistentes', 'Valide o sentimento antes de redirecionar', 'Rotina estável'] },
  { n: 10, week: 75, title: 'Autonomia e “eu quero”', skill: 'Quer decidir e se ver como alguém separado de você.',
    signs: ['Teimosia', 'Mais birras', 'Alterações no sono e no apetite'], tips: ['Escolhas entre duas opções', 'Paciência e consistência', 'Peça ajuda do pediatra se algo preocupar'] }
].map((l) => ({ ...l, from: l.week - 1, to: l.week + (l.week >= 37 ? 2 : 1) }));

const DAY_MS = 86_400_000;
const toUtcDay = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / DAY_MS; };

/** Dias de idade em uma data local (YYYY-MM-DD). Negativo = ainda não nasceu (data futura). */
export const ageInDays = (birthDate, today) => toUtcDay(today) - toUtcDay(birthDate);

export const weeksOf = (days) => Math.floor(days / 7);

const startDay = (l) => l.from * 7;
const endDay = (l) => l.to * 7 + 6;

/** Situação de cada salto para a idade dada: 'past' | 'now' | 'next' | 'future'. */
export function leapStatus(ageDays) {
  const nextIdx = LEAPS.findIndex((l) => startDay(l) > ageDays);
  return LEAPS.map((l, i) => ({
    ...l,
    status: ageDays > endDay(l) ? 'past' : ageDays >= startDay(l) ? 'now' : i === nextIdx ? 'next' : 'future',
    daysToStart: startDay(l) - ageDays
  }));
}

export function currentAndNext(ageDays) {
  const st = leapStatus(ageDays);
  return { current: st.find((l) => l.status === 'now') ?? null, next: st.find((l) => l.status === 'next') ?? null, all: st };
}

/** Salto que começa dentro de `withinDays` dias (para avisar antes). */
export function leapStartingSoon(ageDays, withinDays = 3) {
  return leapStatus(ageDays).find((l) => l.daysToStart > 0 && l.daysToStart <= withinDays) ?? null;
}

export const validBirthDate = (s, today) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '') && ageInDays(s, today) >= -60 && ageInDays(s, today) <= 3 * 365;
