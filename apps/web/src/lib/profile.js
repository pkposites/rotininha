// Personalização (nome da mãe/cuidadora e do bebê). Ficam SÓ no aparelho (IndexedDB): não vão para o servidor.
import { useState, useEffect } from 'preact/hooks';
import { getPref, setPref } from './prefs.js';
import { cleanName } from './ux.js';

const subs = new Set();
export async function getProfile() { return { mom: cleanName(await getPref('profileMom', '')), baby: cleanName(await getPref('profileBaby', '')) }; }
export async function saveProfile({ mom, baby }) {
  await setPref('profileMom', cleanName(mom)); await setPref('profileBaby', cleanName(baby));
  subs.forEach((f) => f());
}
export function useProfile() {
  const [p, setP] = useState({ mom: '', baby: '' });
  useEffect(() => { const load = () => getProfile().then(setP); load(); subs.add(load); return () => subs.delete(load); }, []);
  return p;
}
