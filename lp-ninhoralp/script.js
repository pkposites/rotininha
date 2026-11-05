(()=>{
  const names={mamada:['Mamada registrada!','Apareceria no histórico com o horário em que você tocou.'],sono:['Sono registrado!','O cuidado entrou para o histórico ilustrativo do dia.'],fralda:['Fralda registrada!','Mais um cuidado acompanhado sem precisar lembrar depois.']};
  document.querySelectorAll('[data-care]').forEach(btn=>btn.addEventListener('click',()=>{
    const [title,desc]=names[btn.dataset.care]||names.mamada;
    document.getElementById('demo-title').textContent=title;
    document.getElementById('demo-subtitle').textContent=desc;
    document.querySelectorAll('[data-care]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
  }));
  const params=new URLSearchParams(window.location.search);
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid','gbraid','wbraid'].forEach(k=>{const el=document.getElementById(k);if(el)el.value=(params.get(k)||'').slice(0,180)});
  const phone=document.getElementById('lead-whatsapp');
  phone?.addEventListener('input',()=>{
    const v=phone.value.replace(/\D/g,'').replace(/^55(?=\d{10,11}$)/,'').slice(0,11);
    if(!v){phone.value='';return}
    const ddd=v.slice(0,2),first=v.length>10?v.slice(2,7):v.slice(2,6),last=v.length>10?v.slice(7):v.slice(6);
    phone.value=`(${ddd}${ddd.length===2?') ':''}${first}${last?'-'+last:''}`;
  });
  if('IntersectionObserver' in window){
    const lead=document.getElementById('quero-conhecer');
    if(lead){const obs=new IntersectionObserver(entries=>{document.body.classList.toggle('lead-visible',entries[0].isIntersecting)},{threshold:0.08});obs.observe(lead)}
  }
  const form=document.getElementById('ninhora-leads');
  window.addEventListener('pageshow',()=>{const b=form?.querySelector('button[type=submit]');if(b){b.disabled=false;if(b.dataset.originalHtml){b.innerHTML=b.dataset.originalHtml}}});
  const readCookie=(name)=>document.cookie.split('; ').find(v=>v.startsWith(name+'='))?.split('=').slice(1).join('=')||'';
  form?.addEventListener('submit',()=>{
    if(!form.checkValidity())return;
    const accepted=window.NinhoraAdsConsent===true;
    const eventId='ninhora-lead-'+(crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const set=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val};
    set('meta_event_id',eventId);
    set('meta_consent',accepted?'sim':'nao');
    set('meta_source_url',location.origin+location.pathname); // não envia dados pessoais ou query completa
    set('meta_fbp',accepted?decodeURIComponent(readCookie('_fbp')):'');
    const fbclid=params.get('fbclid');
    set('meta_fbc',accepted?(decodeURIComponent(readCookie('_fbc'))||(fbclid?'fb.1.'+Date.now()+'.'+fbclid:'')):'');
    if(accepted){
      try{sessionStorage.setItem('ninhora_lead_pixel_pending',JSON.stringify({eventId,created:Date.now()}))}catch(_e){}
    }
    // O CAPI será disparado somente depois de o Netlify confirmar o recebimento.
    // Cadê o Lead não recebe envio duplicado; a coleta do formulário é Netlify Forms.
    const url=new URL('/obrigada/',location.origin);
    for(const [k,v] of params.entries()){
      if((/^utm_[a-z0-9_]+$/i.test(k)||['fbclid','gclid','gbraid','wbraid'].includes(k))&&v.length<500)url.searchParams.append(k,v);
    }
    form.action=url.pathname+url.search;
    const button=form.querySelector('button[type=submit]');
    if(button){button.dataset.originalHtml=button.innerHTML;button.disabled=true;button.textContent='Enviando cadastro…'}
  });
})();
