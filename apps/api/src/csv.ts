/** Neutraliza fórmulas de planilha (CSV injection) e aspas. Sem imports: testável direto no Node. */
export function csvCell(v: unknown): string {
  let s = String(v ?? '').replace(/\r?\n/g, ' ');
  if (/^[=+\-@\t]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}
