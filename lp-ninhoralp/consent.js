/* Ninhora: banner único para Meta + Cadê o Lead + Microsoft Clarity. Consentimento para WhatsApp é separado. */
(()=>{
  const KEY='ninhora_ads_consent_v1';
  let accepted=false;
  try { accepted=localStorage.getItem(KEY)==='granted'; }catch(_e){}
  /* Microsoft Clarity (mapas de calor e gravações de sessão): só carrega DEPOIS do aceite. */
  const CLARITY_ID='z6vtf1eenb';
  function clarityOn(){
    if(window.__clarityLoaded) return;
    window.__clarityLoaded=true;
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window,document,"clarity","script",CLARITY_ID);
  }
  function clarityOff(){
    try{ if(window.__clarityLoaded && typeof window.clarity==='function') window.clarity('stop'); }catch(_e){}
  }
  function apply(granted){
    if(granted) clarityOn(); else clarityOff();
    window.NinhoraAdsConsent = Boolean(granted);
    if(typeof window.fbq==='function') window.fbq('consent', granted?'grant':'revoke');
    if(window.LeadHub?.consent) window.LeadHub.consent(Boolean(granted));
  }
  function show(){const banner=document.getElementById('privacy-banner'); if(banner)banner.hidden=false;}
  function hide(){const banner=document.getElementById('privacy-banner'); if(banner)banner.hidden=true;}
  document.addEventListener('DOMContentLoaded',()=>{
    apply(accepted);
    if(!accepted)show();
    document.getElementById('consent-accept')?.addEventListener('click',()=>{
      accepted=true;
      try{localStorage.setItem(KEY,'granted')}catch(_e){}
      apply(true);hide();
    });
    document.getElementById('consent-reject')?.addEventListener('click',()=>{
      accepted=false;
      /* Não persiste recusas; visitantes sem aceite não têm escolha salva. */
      try{localStorage.removeItem(KEY)}catch(_e){}
      apply(false);hide();
    });
    document.getElementById('privacy-choices')?.addEventListener('click',(event)=>{
      event.preventDefault();show();
    });
  });
  document.getElementById('cadeolead-tracker')?.addEventListener('load',()=>apply(accepted));
  apply(accepted);
})();
