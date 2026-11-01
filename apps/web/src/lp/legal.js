import './lp.css';
const S = { name: import.meta.env.VITE_SUPPLIER_NAME ?? '', cnpj: import.meta.env.VITE_SUPPLIER_CNPJ ?? '', email: import.meta.env.VITE_SUPPORT_EMAIL ?? '' };
document.querySelectorAll('[data-supplier]').forEach((el) => {
  const v = S[el.dataset.supplier]; if (v) el.textContent = v;
});
