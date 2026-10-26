/* ============================================================
   SLF WIKI — INTERAKSI
   Edit fungsi pencarian dan filter di file ini.
   ============================================================ */
(function(){
  "use strict";
  const search=document.getElementById('wikiSearch');
  const clear=document.getElementById('wikiClear');
  const cards=Array.from(document.querySelectorAll('.wiki-topic-card'));
  const categories=Array.from(document.querySelectorAll('.wiki-category'));
  const count=document.getElementById('wikiCount');
  const empty=document.getElementById('wikiNoResults');
  const year=document.getElementById('wikiYear');
  if(year) year.textContent=new Date().getFullYear();
  const menu=document.getElementById('wikiMenuToggle');
  const nav=document.getElementById('wikiNav');
  if(menu&&nav){menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.textContent=open?'✕ Tutup':'☰ Menu';});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.textContent='☰ Menu';}));}
  let activeFilter='Semua';
  const filterButtons=Array.from(document.querySelectorAll('.wiki-filter'));
  function applyFilter(){
    const q=(search?.value||'').trim().toLocaleLowerCase('id');let visible=0;
    cards.forEach(card=>{const text=(card.innerText+' '+(card.dataset.search||'')).toLocaleLowerCase('id');const matchText=text.includes(q);const matchCat=activeFilter==='Semua'||card.dataset.category===activeFilter;const show=matchText&&matchCat;card.hidden=!show;if(show)visible++;});
    document.querySelectorAll('[data-category-section]').forEach(section=>{const hasVisible=Array.from(section.querySelectorAll('.wiki-topic-card')).some(c=>!c.hidden);section.hidden=!!q&&!hasVisible;});
    if(count)count.textContent=(q||activeFilter!=='Semua')?`${visible} artikel ditemukan`:`${cards.length} artikel tersedia`;
    if(empty)empty.hidden=visible!==0;
    filterButtons.forEach(b=>b.classList.toggle('active',b.dataset.filter===activeFilter));
  }
  if(search)search.addEventListener('input',applyFilter);
  if(clear)clear.addEventListener('click',()=>{if(search){search.value='';search.focus();}activeFilter='Semua';applyFilter();});
  filterButtons.forEach(b=>b.addEventListener('click',()=>{activeFilter=b.dataset.filter||'Semua';applyFilter();}));
})();
