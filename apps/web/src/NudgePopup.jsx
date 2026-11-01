import { setPref, getPref } from './lib/prefs.js';
import { nextDelay } from './lib/nudge.js';

// "Falta pouco": convida a criar a conta e/ou instalar o app, com intervalos crescentes e saída respeitosa.
export function NudgePopup({ plan, dismissals, onAccount, onInstall, onClose }) {
  const later = async () => { await setPref('nudgeDismissals', dismissals + 1); await setPref('nudgeNextAt', Date.now() + nextDelay(dismissals + 1)); onClose(); };
  const never = async () => { await setPref('nudgeOptOut', true); onClose(); };
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && later()}>
      <div class="sheet stack" role="dialog" aria-modal="true" aria-label="Falta pouco">
        <h2>Falta pouco 💜</h2>
        {plan.needAccount && (
          <section class="card stack">
            <strong>Crie a sua conta grátis</strong>
            <p>Sem conta, seus registros ficam só neste aparelho e <strong>o Ninhora não consegue te avisar quando um lembrete chegar</strong>. Com a conta, eles ficam guardados e você abre em outro aparelho.</p>
            <button class="btn" onClick={onAccount}>Criar conta</button>
          </section>
        )}
        {plan.needInstall && (
          <section class="card stack">
            <strong>Instale o app na tela inicial</strong>
            <p>Abre como um app, sem procurar o link. {plan.needAccount ? 'No iPhone, é preciso instalar para os lembretes chegarem.' : 'No iPhone, os lembretes só chegam com o app instalado.'}</p>
            <button class="btn ghost" onClick={onInstall}>Ver como instalar</button>
          </section>
        )}
        <div class="row">
          <button class="link" onClick={later}>Agora não</button>
          {dismissals >= 3 && <button class="link" onClick={never}>Não mostrar mais</button>}
        </div>
      </div>
    </div>
  );
}
