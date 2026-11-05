// Ícones de traço (24×24, currentColor) — próprios, sem biblioteca.
const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' };
const I = (children) => (props) => <svg {...base} {...props}>{children}</svg>;

export const HomeIcon = I(<><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" /></>);
export const ClockIcon = I(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const BookIcon = I(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>);
export const MoonIcon = I(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />);
export const SunIcon = I(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);
export const GearIcon = I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>);
export const LeafIcon = I(<><path d="M12 21v-8" /><path d="M12 13C12 8 8 5 3 5c0 5 3 8 9 8Z" /><path d="M12 15c0-4 3-7 9-7 0 5-3 7-9 7Z" /></>);
export const MusicIcon = I(<><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>);
export const PlusIcon = I(<path d="M12 5v14M5 12h14" />);
export const CheckIcon = I(<path d="M5 12.5 10 17.5 19 7" />);
export const ChevronIcon = I(<path d="m9 6 6 6-6 6" />);

/** Marca do app (mesmo desenho do ícone instalado). */
export const BrandMark = (props) => (
  <svg viewBox="0 0 512 512" width="30" height="30" aria-hidden="true" focusable="false" {...props}>
    <defs>
      <linearGradient id="bm-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7B5CF5" /><stop offset="1" stop-color="#2A1766" /></linearGradient>
      <linearGradient id="bm-m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF1C9" /><stop offset=".6" stop-color="#FFD0B0" /><stop offset="1" stop-color="#F0A9D6" /></linearGradient>
      <mask id="bm-c"><rect width="512" height="512" fill="#fff" /><circle cx="318" cy="200" r="150" fill="#000" /></mask>
    </defs>
    <rect width="512" height="512" rx="112" fill="url(#bm-bg)" />
    <circle cx="236" cy="262" r="168" fill="url(#bm-m)" mask="url(#bm-c)" />
    <path d="M372 112l9 26 26 9-26 9-9 26-9-26-26-9 26-9z" fill="#fff" />
  </svg>
);
export const ShareIcon = I(<><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></>);
