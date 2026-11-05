import './lp.css';
import './lp-premium.css';

const API = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID ?? '';
const SUPPLIER = {
  name: import.meta.env.VITE_SUPPLIER_NAME ?? '', cnpj: import.meta.env.VITE_SUPPLIER_CNPJ ?? '', email: import.meta.env.VITE_SUPPORT_EMAIL ?? ''
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- métricas agregadas (sem identificador; ver política de privacidade) ---------- */
const sent = new Set();
function track(event, once = true) {
  if (!API || (once && sent.has(event))) return;
  sent.add(event);
  try { fetch(API + '/v1/analytics', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event }) }).catch(() => {}); } catch {}
}

/* ---------- consentimento (cookies de marketing só com permissão) ---------- */
const KEY = 'rotininha:consent';
const readConsent = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const writeConsent = (marketing) => { try { localStorage.setItem(KEY, JSON.stringify({ v: 1, marketing, ts: Date.now() })); } catch {} };

let pixelLoaded = false;
function loadPixel() {
  if (pixelLoaded || !PIXEL_ID) return;
  pixelLoaded = true;
  // Snippet padrão da Meta. Eventos NUNCA levam idade do bebê, respostas do quiz, horários ou dados de saúde.
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = true; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');
}
const pixel = (name) => { if (pixelLoaded && window.fbq) window.fbq('track', name); };
function applyConsent() { const c = readConsent(); if (c?.marketing) loadPixel(); }
function unloadMarketing() { /* sem consentimento nada é carregado; se retirado, o próximo carregamento já não inicia o Pixel */ }

const box = $('#consent');
function showConsent() { $('#consent-mkt').checked = !!readConsent()?.marketing; $('#consent-prefs').hidden = true; $('#consent-more').setAttribute('aria-expanded', 'false'); box.hidden = false; }
function choose(marketing) { writeConsent(marketing); box.hidden = true; marketing ? applyConsent() : unloadMarketing(); }
$('#consent-all').addEventListener('click', () => choose(true));
$('#consent-ess').addEventListener('click', () => choose(false));
$('#consent-more').addEventListener('click', (e) => { const p = $('#consent-prefs'); p.hidden = !p.hidden; e.currentTarget.setAttribute('aria-expanded', String(!p.hidden)); });
$('#consent-save').addEventListener('click', () => choose($('#consent-mkt').checked));
$('#open-consent').addEventListener('click', showConsent);
if (!readConsent()) showConsent(); else applyConsent();

/* ---------- identificação do fornecedor no rodapé ---------- */
$$('[data-supplier]').forEach((el) => {
  const k = el.dataset.supplier;
  const v = SUPPLIER[k];
  if (v) el.textContent = k === 'cnpj' ? `· CNPJ ${v}` : k === 'email' ? `· ${v}` : v;
});

/* ---------- oferta: o teste grátis não depende de pagamento ---------- */
const buy = $('#buy');
buy.addEventListener('click', () => { track('lp_cta_click', false); pixel('InitiateCheckout'); });
$$('[data-cta]').forEach((a) => { if (a !== buy) a.addEventListener('click', () => track('lp_cta_click', false)); });

track('lp_visit');

/* ---------- demonstração animada: 12 s em loop, pausável, respeita movimento reduzido ---------- */
(() => {
  const phone = $('#phone'), cap = $('#demo-cap'), btn = $('#demo-pause');
  const CAPTIONS = [
    'Tudo à mão, sem complicar',
    'Lembretes no momento escolhido',
    'Você abre com um toque',
    'Registra em segundos',
    'Sua rotina segue organizada',
    'Uma ajudinha na sua rotina de mãe'
  ];
  const STATIC_CAP = 'Lembretes no momento escolhido, registro em segundos e a rotina sempre organizada.';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) { phone.dataset.scene = 'static'; cap.textContent = STATIC_CAP; return; } // quadro estático completo

  let scene = 0, timer = null, userPaused = false, visible = false, seen = false, seenTimer = null;
  const draw = () => { phone.dataset.scene = String(scene); cap.textContent = CAPTIONS[scene]; };
  const tick = () => { scene = (scene + 1) % 6; draw(); };
  const run = () => { if (!timer && !userPaused && visible && !document.hidden) timer = setInterval(tick, 2000); };
  const stop = () => { clearInterval(timer); timer = null; };

  btn.hidden = false;
  btn.addEventListener('click', () => {
    userPaused = !userPaused; btn.setAttribute('aria-pressed', String(userPaused));
    btn.textContent = userPaused ? 'Retomar demonstração' : 'Pausar demonstração';
    userPaused ? stop() : run();
  });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) {
      if (!seenTimer && !seen) seenTimer = setTimeout(() => { seen = true; track('lp_motion_viewed'); }, 2000);
      scene = 0; draw(); run();
    } else { stop(); clearTimeout(seenTimer); seenTimer = null; }
  }, { threshold: 0.25 }).observe(phone);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : run()));
  reduce.addEventListener?.('change', () => { if (reduce.matches) { stop(); phone.dataset.scene = 'static'; cap.textContent = STATIC_CAP; btn.hidden = true; } });
})();

/* ---------- prévia interativa (nada é salvo nem enviado) ---------- */
(() => {
  const DATA = {
    banho: ['🛁 Banho', '18:30', 'O banho aparece em “Próximos lembretes” e, no horário que você escolher, chega uma notificação (se o aparelho permitir).', null],
    agua: ['💧 Beber água', '10:00', 'Cuidado da mãe também entra na rotina — e você pode ocultar essa categoria quando quiser.', null],
    remedio: ['💊 Remédio', '08:00', 'Registre somente horários conforme orientação de profissional de saúde. O Ninhora não calcula nem sugere doses. Na tela de bloqueio, o aviso fica genérico para proteger sua privacidade.', null],
    mamada: ['🍼 Mamada', '', 'Com um toque em “Mamou”, a mamada vira o último cuidado, com hora e tempo desde então.', '16:40 · há 20 min']
  };
  const chips = $$('#pv-chips .chip');
  chips.forEach((c) => c.addEventListener('click', () => {
    chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
    const [title, time, text, last] = DATA[c.dataset.pv];
    $('#pv-title').textContent = c.dataset.pv === 'mamada' ? 'Nenhum lembrete — o registro vai direto para o histórico' : title;
    $('#pv-time').textContent = time;
    $('#pv-mamada').textContent = last ?? 'Ainda não registrado';
    $('#pv-row').classList.toggle('hl', true);
    $('#pv-text').textContent = text;
    track('lp_preview_used'); pixel('ViewContent');
  }));
})();

/* ---------- mini-quiz opcional (só local; sem dados do bebê) ---------- */
(() => {
  const form = $('#quiz'), out = $('#quiz-out'), ans = {};
  const MSG = {
    lembrar: 'Lembretes que você mesma edita, com notificação quando o aparelho permitir, ajudam a tirar isso da cabeça.',
    registrar: 'Registrar mamada, sono e fralda leva 1 ou 2 toques — dá para fazer com uma mão só.',
    organizar: 'A tela Hoje mostra o último cuidado, há quanto tempo foi e o que vem a seguir.',
    dividir: 'Hoje o Ninhora é pensado para uma pessoa por aparelho; o compartilhamento entre cuidadores está nos planos, e só anunciaremos quando existir.'
  };
  $$('.chips', form).forEach((g) => g.addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    track('lp_quiz_started');
    $$('.chip', g).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    ans[g.dataset.q] = b.dataset.v ?? b.textContent;
    if (ans.age && ans.pain && ans.other) {
      out.hidden = false;
      out.textContent = `Entendi! ${MSG[ans.pain]}${ans.other === 'Sim' && ans.pain !== 'dividir' ? ' E, como outra pessoa também cuida, vale combinar juntos o que cada um registra.' : ''}`;
      track('lp_quiz_done');
    }
  }));
})();

/* ---------- botão fixo: aparece depois do CTA do topo e some quando a oferta está na tela ---------- */
(() => {
  const bar = $('#sticky-cta'), hero = $('.hero-cta .btn'), offer = $('#oferta');
  if (!bar || !hero || !offer || !('IntersectionObserver' in window)) return;
  let heroOut = false, offerIn = false;
  const sync = () => {
    const show = heroOut && !offerIn;
    bar.classList.toggle('show', show);
    bar.setAttribute('aria-hidden', String(!show));
    bar.querySelector('a').tabIndex = show ? 0 : -1;
  };
  document.body.classList.add('has-sticky');
  new IntersectionObserver(([e]) => { heroOut = !e.isIntersecting && e.boundingClientRect.top < 0; sync(); }).observe(hero);
  new IntersectionObserver(([e]) => { offerIn = e.isIntersecting; sync(); }, { threshold: 0.2 }).observe(offer);
})();
