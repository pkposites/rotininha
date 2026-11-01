// Bloqueio por falta de pagamento: só vale para conta conectada com acesso vencido (depois da carência).
// Vencido = só leitura: ver, baixar e apagar os dados continuam livres; registrar, criar lembretes e tocar sons pedem o acesso.
export const isBlocked = (account) => !!account && account.state === 'expired';

export function paywallText(account, paymentsOn) {
  const base = account?.plan === 'trial' ? 'Seu acesso grátis terminou.' : 'Seu acesso venceu.';
  return paymentsOn
    ? `${base} Seus registros continuam guardados: você pode vê-los e baixá-los quando quiser. Para voltar a registrar cuidados, criar lembretes e receber avisos, garanta o acesso vitalício por R$ 37,90 (pagamento único via Pix, sem assinatura).`
    : `${base} Seus registros continuam guardados e você pode vê-los e baixá-los. O pagamento ainda não está disponível neste momento; assim que estiver, você poderá liberar o acesso aqui.`;
}
