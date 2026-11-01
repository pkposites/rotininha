// Contraste WCAG 2.2 AA (4,5:1 texto normal) dos pares de cores realmente usados — falha o teste se alguém mudar um token.
import test from 'node:test';
import assert from 'node:assert/strict';

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const C = {
  primary: '#6D56A6', lilac: '#F1ECFA', base: '#FBF9F7', card: '#FFFFFF', text: '#25334A', muted: '#6B7380',
  successInk: '#2E716B', successBg: '#E9F5F0', warnInk: '#8A5B00', warnBg: '#FFF2D6', peach: '#F8E5DC',
  nightBg: '#171A2A', nightCard: '#24283B', nightText: '#F5F2FB', nightAccent: '#C2B5F0', mutedOnLilac: '#4F5868'
};
const PAIRS = [
  ['botão primário (branco sobre roxo)', '#FFFFFF', C.primary],
  ['texto principal / fundo', C.text, C.base], ['texto principal / cartão', C.text, C.card], ['texto principal / lilás', C.text, C.lilac],
  ['texto secundário / fundo', C.muted, C.base], ['texto secundário / cartão', C.muted, C.card],
  ['link roxo / fundo', C.primary, C.base], ['link roxo / lilás', C.primary, C.lilac],
  ['sucesso / sucesso-bg', C.successInk, C.successBg], ['aviso / aviso-bg', C.warnInk, C.warnBg],
  ['secundário reforçado / lilás', C.mutedOnLilac, C.lilac],
  ['madrugada: texto / fundo', C.nightText, C.nightBg], ['madrugada: texto / cartão', C.nightText, C.nightCard],
  ['madrugada: destaque / fundo', C.nightAccent, C.nightBg], ['madrugada: destaque / cartão', C.nightAccent, C.nightCard],
  ['madrugada: botão (fundo escuro sobre destaque)', C.nightBg, C.nightAccent]
];
for (const [name, fg, bg] of PAIRS) test(`contraste AA: ${name}`, () => assert.ok(ratio(fg, bg) >= 4.5, `${ratio(fg, bg).toFixed(2)}:1`));

test('o texto secundário padrão NÃO passa sobre o lilás (por isso a oferta usa o reforçado)', () => {
  assert.ok(ratio(C.muted, C.lilac) < 4.5);
});
