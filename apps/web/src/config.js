// Identificação do fornecedor (CDC / Decreto 7.962). PREENCHER antes do lançamento — ver docs/pendencias-lancamento.md.
export const SUPPLIER = {
  name: import.meta.env?.VITE_SUPPLIER_NAME ?? '',
  cnpj: import.meta.env?.VITE_SUPPLIER_CNPJ ?? '',
  email: import.meta.env?.VITE_SUPPORT_EMAIL ?? ''
};

// Chaves de funcionalidade (build). Pagamento fica DESLIGADO até estar validado de ponta a ponta.
export const FLAGS = {
  payments: import.meta.env?.VITE_PAYMENTS_ENABLED === '1',
  feedbackCard: import.meta.env?.VITE_FEEDBACK_CARD !== '0'
};
