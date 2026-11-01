// Identificação do fornecedor (CDC / Decreto 7.962). PREENCHER antes do lançamento — ver docs/pendencias-lancamento.md.
export const SUPPLIER = {
  name: import.meta.env?.VITE_SUPPLIER_NAME ?? '',
  cnpj: import.meta.env?.VITE_SUPPLIER_CNPJ ?? '',
  email: import.meta.env?.VITE_SUPPORT_EMAIL ?? ''
};
