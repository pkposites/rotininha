// Contadores AGREGADOS do funil (sem identificador, sem conteúdo). Falha em silêncio: nunca atrapalha o app.
import { publicCall, syncAvailable } from './sync.js';
import { getPref, setPref } from './prefs.js';
import { isInternal } from './internal.js';

/** `once`: só uma vez por aparelho (ex.: primeiro registro). */
export async function track(event, { once = false } = {}) {
  try {
    if (!syncAvailable || isInternal()) return;
    if (once) {
      if (await getPref('tracked:' + event)) return;
      await setPref('tracked:' + event, true);
    }
    publicCall('/v1/analytics', { event }).catch(() => {});
  } catch { /* ignora */ }
}
