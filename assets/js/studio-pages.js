(() => {
'use strict';
const dataNode=document.getElementById('slf-page-data');
const root=document.getElementById('slf-page-layers');
if(!dataNode||!root)return;
let page;
try { page=JSON.parse(dataNode.textContent||'{}'); }
catch { root.textContent='Konten halaman tidak dapat dibaca.'; return; }

const fontMap={system:'system-ui,sans-serif',serif:'Georgia,serif',sans:'Arial,sans-serif',mono:'ui-monospace,monospace',rounded:'Trebuchet MS,Arial,sans-serif'};
const clamp=(v,min,max,fallback)=>{const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};
const safeUrl=(value,external=false)=>{
 const url=String(value||'');
 if(external)return /^https:\/\//i.test(url)?url:'';
 return /^https:\/\//i.test(url)||/^\/(?!\/)[A-Za-z0-9/_?&=.%#-]*$/.test(url)||/^#[A-Za-z0-9_.-]+$/.test(url)?url:'';
};
function applyStyles(node,styles={}) {
 if(!styles||typeof styles!=='object')return;
 for(const key of ['color','backgroundColor','borderColor'])if(/^#[0-9a-f]{6}$/i.test(String(styles[key]||'')))node.style[key]=styles[key];
 if(styles.fontFamily&&fontMap[styles.fontFamily])node.style.fontFamily=fontMap[styles.fontFamily];
 if(['left','center','right'].includes(styles.textAlign))node.style.textAlign=styles.textAlign;
 for(const [key,min,max,unit] of [['fontSize',8,240,'px'],['fontWeight',100,900,''],['padding',0,80,'px'],['borderRadius',0,500,'px'],['maxWidth',100,1200,'px'],['marginBottom',0,100,'px'],['borderWidth',0,40,'px']])if(styles[key]!==undefined)node.style[key]=String(clamp(styles[key],min,max,min))+unit;
 if(['solid','dashed','dotted','double','none'].includes(styles.borderStyle))node.style.borderStyle=styles.borderStyle;
 const tx=clamp(styles.translateX,-100,100,0),ty=clamp(styles.translateY,-100,100,0),r=clamp(styles.rotation,-3600,3600,0),sx=clamp(styles.scaleX,.01,20,1),sy=clamp(styles.scaleY,.01,20,1),kx=clamp(styles.skewX,-85,85,0),ky=clamp(styles.skewY,-85,85,0);if(['translateX','translateY','rotation','scaleX','scaleY','skewX','skewY'].some(k=>styles[k]!==undefined))node.style.transform='translate('+tx+'%,'+ty+'%) rotate('+r+'deg) scale('+sx+','+sy+') skew('+kx+'deg,'+ky+'deg)';
 if(styles.opacity!==undefined)node.style.opacity=String(clamp(styles.opacity,0,1,1));if(styles.gradient?.stops?.length>=2){const stops=styles.gradient.stops.map(s=>(/^#[0-9a-f]{6}$/i.test(s.color)?s.color:'#000000')+' '+clamp(s.position,0,100,0)+'%').join(',');node.style.backgroundImage=styles.gradient.type==='radial'?'radial-gradient(circle,'+stops+')':'linear-gradient('+clamp(styles.gradient.angle,0,360,135)+'deg,'+stops+')';}
 if(styles.shadowBlur!==undefined||styles.shadowX!==undefined||styles.shadowY!==undefined){const blur=clamp(styles.shadowBlur,0,120,0),x=clamp(styles.shadowX,-120,120,0),y=clamp(styles.shadowY,-120,120,0);node.style.boxShadow=x+'px '+y+'px '+blur+'px '+(/^#[0-9a-f]{6}$/i.test(styles.shadowColor||'')?styles.shadowColor:'rgba(0,0,0,.35)');}
}
function applyLayerMotion(node,layer){const frames=Array.isArray(layer.keyframes)?layer.keyframes:[],duration=clamp(layer.duration,200,10000,900);if(frames.length){const id=String(layer.id||'layer').replace(/[^A-Za-z0-9_-]/g,''),name='slf-page-kf-'+id;let style=document.getElementById('slf-page-keyframes');if(!style){style=document.createElement('style');style.id='slf-page-keyframes';document.head.append(style);}const css=frames.map(frame=>{const v=frame.values||frame,pct=clamp(frame.time,0,duration,0)/duration*100,x=clamp(v.x??v.translateX,-100,200,0),y=clamp(v.y??v.translateY,-100,200,0),r=clamp(v.rotation,-3600,3600,0),sx=clamp(v.scaleX,.01,20,1),sy=clamp(v.scaleY,.01,20,1),kx=clamp(v.skewX,-85,85,0),ky=clamp(v.skewY,-85,85,0),o=clamp(v.opacity,0,1,1);return pct+'%{transform:translate('+x+'%,'+y+'%) rotate('+r+'deg) scale('+sx+','+sy+') skew('+kx+'deg,'+ky+'deg);opacity:'+o+';}';}).join('');style.textContent+='@keyframes '+name+'{'+css+'}';node.style.animation=name+' '+duration+'ms '+(['linear','ease','ease-in','ease-out','ease-in-out'].includes(layer.easing)?layer.easing:'ease')+' both';}}
function createOutput() {
 const output=document.createElement('pre');
 output.className='slf-backend-output';
 output.setAttribute('aria-live','polite');
 output.hidden=true;
 return output;
}
async function executeBackend(action,button,output) {
 const table=String(action.target||'');
 if(!/^studio_(?:preview_)?[a-z][a-z0-9_]{0,31}$/.test(table)){output.textContent='Target tabel tidak valid.';output.hidden=false;return;}
 button.disabled=true;
 output.hidden=false;
 output.textContent=action.type==='backend-submit'?'Memuat skema dan menyimpan data…':'Mengambil data…';
 try {
  let values={};
  if(action.type==='backend-submit') {
   const schemaResponse=await fetch('/api/studio/data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'schema',table}),cache:'no-store',credentials:'same-origin'});
   const schema=await schemaResponse.json().catch(()=>({}));
   if(!schemaResponse.ok)throw new Error(schema.error||'Skema formulir tidak dapat dimuat.');
   const allowed=new Set(Array.isArray(schema.columns)?schema.columns:[]);
   document.querySelectorAll('[data-slf-backend-field]').forEach(field=>{
    const name=field.getAttribute('data-slf-backend-field');
    if(name&&allowed.has(name))values[name]=field.value;
   });
  }
  const response=await fetch('/api/studio/data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:action.type==='backend-submit'?'submit':'read',table,values}),cache:'no-store',credentials:'same-origin'});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||'Permintaan backend gagal.');
  output.textContent=action.type==='backend-submit'?(result.message||'Data berhasil disimpan.'):JSON.stringify(result.rows||[],null,2);
  if(action.type==='backend-submit')document.querySelectorAll('[data-slf-backend-field]').forEach(field=>{const name=field.getAttribute('data-slf-backend-field');if(name&&Object.prototype.hasOwnProperty.call(values,name))field.value='';});
 } catch(error) {
  output.textContent=error.message||'Koneksi backend gagal.';
 } finally {
  button.disabled=false;
 }
}

(Array.isArray(page.layers)?page.layers:[]).forEach(layer=>{
 if(layer.visible===false)return;
 const wrap=document.createElement('article');
 wrap.className='slf-page-layer';
 wrap.dataset.layerId=layer.id||'';
 let node;
 if(layer.type==='image') {
  node=document.createElement('img');node.src=safeUrl(layer.src);node.alt=layer.name||'Gambar SLF';node.loading='lazy';node.decoding='async';
 } else if(layer.type==='video') {
  node=document.createElement('video');node.src=safeUrl(layer.src);node.controls=true;node.preload='metadata';node.playsInline=true;
 } else if(layer.type==='audio') {
  node=document.createElement('audio');node.src=safeUrl(layer.src);node.controls=true;node.preload='metadata';
 } else if(layer.type==='shape') {
  node=document.createElement('div');node.className='slf-page-shape';node.textContent=layer.content||'';node.style.cssText='min-width:90px;min-height:90px;border-radius:18px;background:#19e6b0';
 } else if(layer.type==='button') {
  node=document.createElement('button');node.type='button';node.className='slf-page-button';node.textContent=layer.content||layer.name||'Tombol';
 } else if(layer.type==='table') {
  node=document.createElement('div');node.className='slf-page-table-wrap';
  const table=document.createElement('table'),body=document.createElement('tbody');
  (Array.isArray(layer.rows)?layer.rows:[]).forEach((row,index)=>{
   const tr=document.createElement('tr');
   (Array.isArray(row)?row:[]).forEach(cell=>{const td=document.createElement(index===0?'th':'td');td.textContent=String(cell??'');tr.append(td);});
   body.append(tr);
  });
  table.append(body);node.append(table);
 } else if(layer.type==='card') {
  node=document.createElement('div');node.className='slf-page-card';node.textContent=layer.content||layer.name||'Kartu informasi';
 } else if(layer.type==='input') {
  node=document.createElement('label');node.className='slf-page-input-label';
  const label=document.createElement('span');label.textContent=layer.name||layer.fieldName;
  const input=document.createElement('input');input.type='text';input.name=layer.fieldName;input.placeholder=layer.content||layer.fieldName;input.maxLength=1000;input.autocomplete='off';input.setAttribute('data-slf-backend-field',layer.fieldName);
  node.append(label,input);
 } else {
  node=document.createElement('p');node.className='slf-page-text';node.textContent=layer.content||layer.name||'Teks baru';
 }
 wrap.append(node);
 applyStyles(node,layer.styles||{});
 const v=layer.visual||{};(v.effects||[]).forEach(effect=>{if(['glass','glow','float','pulse','outline','neon','shine','soft','border-glow','tilt','hover'].includes(effect))wrap.classList.add('slf-effect-'+effect);});if(/^#[0-9a-f]{6}$/i.test(v.backgroundColor||''))node.style.backgroundColor=v.backgroundColor;if(/^#[0-9a-f]{6}$/i.test(v.borderColor||''))node.style.borderColor=v.borderColor;if(v.borderStyle)node.style.borderStyle=v.borderStyle;if(v.borderWidth!==undefined)node.style.borderWidth=clamp(v.borderWidth,0,40,0)+'px';if(v.borderRadius!==undefined)node.style.borderRadius=clamp(v.borderRadius,0,500,0)+'px';if(v.gradient?.stops?.length>=2){const stops=v.gradient.stops.map(s=>(/^#[0-9a-f]{6}$/i.test(s.color)?s.color:'#000000')+' '+clamp(s.position,0,100,0)+'%').join(',');node.style.backgroundImage=v.gradient.type==='radial'?'radial-gradient(circle,'+stops+')':'linear-gradient('+clamp(v.gradient.angle,0,360,135)+'deg,'+stops+')';}if(v.shadow===true||v.shadowBlur!==undefined){const blur=clamp(v.shadowBlur,0,120,12),x=clamp(v.shadowX,-120,120,0),y=clamp(v.shadowY,-120,120,6);node.style.boxShadow=x+'px '+y+'px '+blur+'px '+(/^#[0-9a-f]{6}$/i.test(v.shadowColor||'')?v.shadowColor:'rgba(0,0,0,.35)');}
 if(layer.positioned){root.style.position='relative';wrap.style.position='absolute';wrap.style.left=clamp(layer.x,-100,200,0)+'%';wrap.style.top=clamp(layer.y,-100,200,0)+'%';wrap.style.width=clamp(layer.width,0,200,100)+'%';if(layer.height>0)wrap.style.height=clamp(layer.height,0,200,0)+'%';wrap.style.zIndex=String(clamp(layer.z,0,100,1));}node.style.transform='rotate('+clamp(layer.rotation,-3600,3600,0)+'deg) scale('+clamp(layer.scaleX,.01,20,1)+','+clamp(layer.scaleY,.01,20,1)+') skew('+clamp(layer.skewX,-85,85,0)+'deg,'+clamp(layer.skewY,-85,85,0)+'deg)';node.style.opacity=String(clamp(layer.opacity,0,1,1));applyLayerMotion(wrap,layer);
 const animation=['fade','float','pulse'].includes(layer.animation)?layer.animation:'none';
 if(animation!=='none') {
  wrap.classList.add('slf-motion-'+animation);
  if(layer.loop)wrap.classList.add('slf-motion-loop');
  wrap.style.setProperty('--slf-duration',clamp(layer.duration,200,10000,900)+'ms');
 }
 if(layer.type==='button') {
  const output=createOutput();wrap.append(output);
  node.addEventListener('click',()=>{
   const action=layer.action||{type:'none'};
   if(['fade','float','pulse'].includes(layer.clickAnimation)) {
    wrap.classList.remove('slf-click-'+layer.clickAnimation);void wrap.offsetWidth;wrap.classList.add('slf-click-'+layer.clickAnimation);
   }
   if(action.type==='navigate') {
    const target=safeUrl(action.target);if(target)location.assign(target);
   } else if(action.type==='external') {
    const target=safeUrl(action.target,true);if(target)window.open(target,'_blank','noopener,noreferrer');
   } else if(action.type==='scroll') {
    const id=String(action.target||'').replace(/^#/,'').replace(/[^A-Za-z0-9_-]/g,'');
    const target=id?document.getElementById(id):null;if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
   } else if(action.type==='backend-submit'||action.type==='backend-read') {
    executeBackend(action,node,output);
   } else if(layer.href) {
    const target=safeUrl(layer.href);if(target)location.assign(target);
   }
  });
 }
 root.append(wrap);
});
})();
