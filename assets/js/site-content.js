(() => {
  'use strict';
  const escapeText = value => String(value ?? '');
  const slotTargets = {
    'home.lead':'[data-cms-slot="home.lead"]',
    'home.zoneLead':'[data-cms-slot="home.zoneLead"]',
    'home.storeLead':'[data-cms-slot="home.storeLead"]',
    'wiki.lead':'[data-cms-slot="wiki.lead"]',
    'store.lead':'[data-cms-slot="store.lead"]'
  };
  function renderCard(item, page) {
    const card=document.createElement('article');
    card.className='cms-content-card';
    const label=document.createElement('span');
    label.className='cms-content-label';
    label.textContent='INFO SLF';
    let image=null;if(item.image_url){image=document.createElement('img');image.className='cms-content-image';image.src=escapeText(item.image_url);image.alt=escapeText(item.title||'Gambar SLF');image.loading='lazy';image.decoding='async';}
    const title=document.createElement('h3');
    title.textContent=escapeText(item.title);
    const body=document.createElement('p');
    body.textContent=escapeText(item.body);
    if(image)card.append(image);card.append(label,title,body);
    return card;
  }
  async function init(){
    try{
      const response=await fetch('/api/site-content',{cache:'no-store'});
      if(!response.ok)return;
      const data=await response.json();
      (data.slots||[]).forEach(slot=>{
        const selector=slotTargets[slot.key];
        if(!selector)return;
        const target=document.querySelector(selector);
        if(target && typeof slot.body==='string')target.textContent=slot.body;
      });
      ['home','store','wiki'].forEach(page=>{
        const root=document.querySelector('[data-cms-list="'+page+'"]');
        if(!root)return;
        const cards=(data.cards||[]).filter(item=>item.page===page);
        if(!cards.length)return;
        root.replaceChildren(...cards.map(item=>renderCard(item,page)));
        const section=root.closest('[data-cms-wrap]');
        if(section)section.hidden=false;
      });
    }catch(_){
      // Website still renders its normal static content if the CMS endpoint is unavailable.
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();