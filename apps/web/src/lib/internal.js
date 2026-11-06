// Aparelho "interno" (dono/equipe/testes): o que ele faz não entra nas métricas.
// Liga com ?interno=1 (ou pelo painel) e desliga com ?interno=0. Contas marcadas como teste no servidor ligam isto sozinhas.
const KEY = 'ninhora-internal';
export const isInternal = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
export const setInternal = (on) => { try { on ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch { /* sem armazenamento */ } };
export function applyInternalParam() {
  try {
    const u = new URL(location.href), p = u.searchParams.get('interno');
    if (p !== '1' && p !== '0') return;
    setInternal(p === '1');
    u.searchParams.delete('interno');
    history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
  } catch { /* ignora */ }
}
