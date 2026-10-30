(() => {
'use strict';
const isColor=v=>/^#[0-9a-f]{6}$/i.test(String(v||''));
const toRgba=(hex,alpha)=>{const n=parseInt((isColor(hex)?hex:'#100c18').slice(1),16);return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+(Math.max(0,Math.min(100,Number(alpha)||0))/100)+')';};
const pageName=()=>{const p=location.pathname.toLowerCase();return p.startsWith('/store')?'store':p.startsWith('/wiki')?'wiki':'home';};
function apply(d){
 if(!d||typeof d!=='object')return;
 const page=pageName();if(d.page&&d.page!=='all'&&d.page!==page)return;
 const root=document.documentElement;
 if(isColor(d.accent)){root.style.setProperty('--purple',d.accent);root.style.setProperty('--purple2',d.accent);root.style.setProperty('--accent',d.accent);}
 if(isColor(d.accent2)){root.style.setProperty('--gold',d.accent2);root.style.setProperty('--gold2',d.accent2);}
 const hero=page==='home'?(document.querySelector('#beranda.hero')||document.querySelector('.hero')):(document.querySelector('main .hero')||document.querySelector('.hero'));
 if(!hero)return;
 const layers=Array.isArray(d.layers)?d.layers:[];
 const wall=layers.find(x=>x.id==='wallpaper'&&x.type==='image'&&x.visible!==false&&x.src);
 const overlay=toRgba(d.overlayColor||'#100c18',d.overlayOpacity==null?65:d.overlayOpacity);
 if(wall){
  const src=String(wall.src).replace(/["\\]/g,'');
  hero.style.setProperty('background-image','linear-gradient('+overlay+','+overlay+'),url("'+src+'")','important');
  hero.style.setProperty('background-size','cover','important');
  hero.style.setProperty('background-position',Math.max(0,Math.min(100,Number(wall.x)||50))+'% '+Math.max(0,Math.min(100,Number(wall.y)||50))+'%','important');
  hero.style.setProperty('background-repeat','no-repeat','important');
 }else hero.style.setProperty('background-image','linear-gradient('+overlay+','+overlay+')','important');
 hero.style.setProperty('background-color',isColor(d.background)?d.background:'#100c18','important');
 if(d.page!=='all'){
  const main=layers.find(x=>x.id==='title-main'&&x.visible!==false);
  const accent=layers.find(x=>x.id==='title-accent'&&x.visible!==false);
  const sub=layers.find(x=>x.id==='subtitle'&&x.visible!==false);
  const heading=hero.querySelector('h1'),paragraph=hero.querySelector('.hero-copy p, p');
  if(heading&&(main||accent)){
   heading.replaceChildren();
   if(main)heading.append(document.createTextNode(main.text||''));
   if(accent){const span=document.createElement('span');span.textContent=accent.text||'';span.style.color=accent.color||'';heading.append(span);}
   if(main){heading.style.color=main.color||'';heading.style.fontSize='clamp(2rem, '+Math.max(2,Math.min(7,Number(main.fontSize||60)/16))+'vw, '+Number(main.fontSize||60)+'px)';}
  }
  if(paragraph&&sub){paragraph.textContent=sub.text||'';paragraph.style.color=sub.color||'';}
 }
 const images=layers.filter(x=>x.type==='image'&&x.id!=='wallpaper'&&x.visible!==false&&x.src);
 if(images.length){
  hero.style.position='relative';hero.style.overflow='hidden';
  let canvas=hero.querySelector('.slf-published-layers');
  if(!canvas){canvas=document.createElement('div');canvas.className='slf-published-layers';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden';hero.prepend(canvas);}
  canvas.replaceChildren();
  images.forEach(layer=>{const img=document.createElement('img');img.src=layer.src;img.alt='';img.style.position='absolute';img.style.left=Math.max(0,Math.min(100,Number(layer.x)||0))+'%';img.style.top=Math.max(0,Math.min(100,Number(layer.y)||0))+'%';img.style.width=Math.max(5,Math.min(100,Number(layer.width)||30))+'%';img.style.height=Math.max(5,Math.min(100,Number(layer.height)||40))+'%';img.style.objectFit=layer.fit==='contain'?'contain':'cover';img.style.opacity=String(Math.max(0,Math.min(100,Number(layer.opacity)||0))/100);img.style.filter='blur('+Math.max(0,Math.min(20,Number(layer.blur)||0))+'px)';canvas.append(img);});
  hero.querySelectorAll('.wrap,.hero-grid,.hero-copy').forEach(el=>{el.style.position='relative';el.style.zIndex='2';});
 }
}
async function init(){try{const r=await fetch('/api/site-design',{cache:'no-store'});if(!r.ok)return;const data=await r.json();if(data.design)apply(data.design);}catch(_){}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();