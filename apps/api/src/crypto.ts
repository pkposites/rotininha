const enc = new TextEncoder();

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Alfabeto sem caracteres ambíguos (sem 0/O/1/I/L/U).
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'; // 30 símbolos
export function randomCode(groups = 4, perGroup = 5): string {
  const out: string[] = [];
  const bytes = new Uint8Array(groups * perGroup * 2);
  crypto.getRandomValues(bytes);
  let i = 0;
  for (let g = 0; g < groups; g++) {
    let part = '';
    while (part.length < perGroup) {
      const b = bytes[i++];
      if (b >= 240) continue; // rejeição: evita viés (240 = 8*30)
      part += ALPHABET[b % 30];
    }
    out.push(part);
  }
  return out.join('-'); // 20 símbolos ≈ 98 bits
}

export const normalizeCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function randomToken(bytes = 32): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
