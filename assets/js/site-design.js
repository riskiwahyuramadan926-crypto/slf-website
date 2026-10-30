(() => {
'use strict';
const isColor=v=>/^#[0-9a-f]{6}$/i.test(String(v||''));
const rgba=(hex,alpha)=>{const n=parseInt((isColor(hex)?hex:'#100c18').slice(1),16);return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+(Math.max(0,Math.min(100,Number(alpha)||0))/100)+')';};
const pageName=()=>{const p=location.pathname.toLowerCase();return p.startsWith('/store')?'store':p.startsWith('/wiki')?'wiki':'home';};
function apply(d){
 if(!d||typeof d!=='object')return;
 const page=pageName();if(d.page&&d.page!=='all'&&d.page!==page)return;
 const root=document.documentElement;
 if(isColor(d.accent)){root.style.setProperty('--purple',d.accent);root.style.setProperty('--purple2',d.accent);root.style.setProperty('--accent',d.accent);}
 if(isColor(d.accent2)){root.style.setProperty('--gold',d.accent2);root.style.setProperty('--gold2',d.accent2);}
 const hero=page==='home'?(document.querySelector('#beranda.hero')||document.querySelector('.hero')):page==='wiki'?(document.querySelector('.wiki-hero')||document.querySelector('main .hero')):(document.querySelector('main .hero')||document.querySelector('.hero'));
 if(!hero)return;
 const layers=Array.isArray(d.layers)?d.layers:[];
 const wall=layers.find(x=>x.id==='wallpaper'&&x.type==='image'&&x.visible!==false&&x.src);
 const overlay=rgba(d.overlayColor||'#100c18',d.overlayOpacity==null?65:d.overlayOpacity);
 if(wall){const src=String(wall.src).replace(/["\\]/g,'');hero.style.setProperty('background-image','linear-gradient('+overlay+','+overlay+'),url("'+src+'")','important');hero.style.setProperty('background-size','cover','important');hero.style.setProperty('background-position',Math.max(0,Math.min(100,Number(wall.x)||50))+'% '+Math.max(0,Math.min(100,Number(wall.y)||50))+'%','important');hero.style.setProperty('background-repeat','no-repeat','important');}
 else hero.style.setProperty('background-image','linear-gradient('+overlay+','+overlay+')','important');
 if(isColor(d.background))hero.style.setProperty('background-color',d.background,'important');
 const texts=layers.filter(x=>x.type==='text'&&x.visible!==false&&String(x.text||'').trim());
 const images=layers.filter(x=>x.type==='image'&&x.id!=='wallpaper'&&x.visible!==false&&x.src);
 if(!wall&&!texts.length&&!images.length)return;
 hero.style.position='relative';hero.style.isolation='isolate';
 let canvas=hero.querySelector('.slf-published-layers');
 if(!canvas){canvas=document.createElement('div');canvas.className='slf-published-layers';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;z-index:4;pointer-events:none;overflow:hidden;container-type:inline-size';hero.prepend(canvas);}
 canvas.replaceChildren();
 images.forEach(layer=>{const img=document.createElement('img');img.src=layer.src;img.alt='';img.loading='eager';img.style.position='absolute';img.style.left=Math.max(0,Math.min(100,Number(layer.x)||0))+'%';img.style.top=Math.max(0,Math.min(100,Number(layer.y)||0))+'%';img.style.width=Math.max(5,Math.min(100,Number(layer.width)||30))+'%';img.style.height=Math.max(5,Math.min(100,Number(layer.height)||40))+'%';img.style.objectFit=layer.fit==='contain'?'contain':'cover';img.style.opacity=String(Math.max(0,Math.min(100,Number(layer.opacity)==null?100:layer.opacity))/100);img.style.filter='blur('+Math.max(0,Math.min(20,Number(layer.blur)||0))+'px)';img.style.zIndex=String(Math.max(1,Math.min(10,Number(layer.z)||2)));canvas.append(img);});
 texts.forEach(layer=>{const node=document.createElement('div');node.className='slf-published-text';node.textContent=layer.text;node.style.position='absolute';node.style.left=Math.max(0,Math.min(100,Number(layer.x)||0))+'%';node.style.top=Math.max(0,Math.min(100,Number(layer.y)||0))+'%';node.style.width=Math.max(5,Math.min(100,Number(layer.width)||50))+'%';node.style.fontSize=Math.max(12,Math.min(120,Number(layer.fontSize)||32))/1440*100+'cqw';node.style.color=isColor(layer.color)?layer.color:'#fff1d4';node.style.textAlign=['left','center','right'].includes(layer.align)?layer.align:'left';node.style.fontWeight=String(Math.max(300,Math.min(900,Number(layer.weight)||800)));node.style.opacity=String(Math.max(0,Math.min(100,Number(layer.opacity)==null?100:layer.opacity))/100);node.style.lineHeight='1.08';node.style.whiteSpace='pre-wrap';node.style.overflowWrap='anywhere';node.style.textShadow='0 2px 14px rgba(0,0,0,.4)';node.style.zIndex=String(Math.max(1,Math.min(10,Number(layer.z)||3)));canvas.append(node);});
 if(texts.length){const heading=hero.querySelector('h1'),paragraph=hero.querySelector('.hero-copy p, p');if(heading)heading.style.visibility='hidden';if(paragraph)paragraph.style.visibility='hidden';}
 const content=hero.querySelector('.wrap');if(content){content.style.position='relative';content.style.zIndex='5';}
}
async function init(){try{const response=await fetch('/api/site-design',{cache:'no-store'});if(!response.ok)return;const data=await response.json();if(data.design)apply(data.design);}catch(_){}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();