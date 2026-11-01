// Regras puras (sem dependências): testáveis direto no Node.
/** WhatsApp brasileiro → "55" + DDD + número. Aceita máscara, +55 e espaços. null = inválido. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 30) return null;
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (!/^[1-9]{2}9?\d{8}$/.test(d) || (d.length === 11 && d[2] !== '9')) return null;
  return '55' + d;
}

const COMMON = new Set(['12345678', '123456789', '1234567890', '11111111', '00000000', 'senha123', 'password', 'qwertyui', '87654321', 'abcd1234', 'ninhora123', 'ninhora1']);
/** Mínimo 8 caracteres, sem senhas óbvias e sem ser o próprio número. */
export function checkPassword(pw: unknown, phone: string | null): 'ok' | 'weak' {
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 128) return 'weak';
  const low = pw.toLowerCase();
  if (COMMON.has(low) || /^(.)\1+$/.test(pw)) return 'weak';
  const d = pw.replace(/\D/g, '');
  if (phone && d.length >= 8 && (phone.endsWith(d) || d.endsWith(phone.slice(2)))) return 'weak';
  return 'ok';
}

