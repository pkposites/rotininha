import { paywallText } from './lib/gate.js';
import { FLAGS } from './config.js';

// Aparece quando alguém com acesso vencido tenta registrar, criar lembrete ou tocar som.
export function PaywallSheet({ account, onPay, onClose }) {
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet stack" role="dialog" aria-modal="true" aria-label="Acesso vencido">
        <h2>Para continuar, garanta o acesso 💜</h2>
        <p>{paywallText(account, FLAGS.payments)}</p>
        <p class="muted">Sem cobrança automática e sem renovação: você paga uma vez. Em caso de dúvida, o direito de arrependimento de 7 dias vale para a compra.</p>
        {FLAGS.payments && <button class="btn" onClick={onPay}>Garantir acesso vitalício · R$ 37,90</button>}
        <button class="btn ghost" onClick={onClose}>{FLAGS.payments ? 'Agora não' : 'Entendi'}</button>
      </div>
    </div>
  );
}
