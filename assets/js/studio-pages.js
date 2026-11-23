(() => {
'use strict';
const dataNode=document.getElementById('slf-page-data'),root=document.getElementById('slf-page-layers');if(!dataNode||!root)return;
let page;try{page=JSON.parse(dataNode.textContent||'{}');}catch{root.textContent='Konten halaman tidak dapat dibaca.';return;}
const fontMap={system:'system-ui,sans-serif',serif:'Georgia,serif',sans:'Arial,sans-serif',mono:'ui-monospace,monospace',rounded:'Trebuchet MS,Arial,sans-serif'};
const clamp=(v,min,max,fallback)=>{const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};
const safeUrl=(value,external=false)=>{const url=String(value||'');if(external)return /^https:\/\//i.test(url)?url:'';return /^https:\/\//i.test(url)||/^\/(?!\/)[A-Za-z0-9/_?&=.%#-]*$/.test(url)||/^#[A-Za-z0-9_.-]+$/.test(url)?url:'';};
function applyStyles(node,styles={}){if(!styles||typeof styles!=='object')return;for(const key of ['color','backgroundColor','borderColor'])if(/^#[0-9a-f]{6}$/i.test(String(styles[key]||'')))node.style[key]=styles[key];if(styles.fontFamily&&fontMap[styles.fontFamily])node.style.fontFamily=fontMap[styles.fontFamily];if(['left','center','right'].includes(styles.textAlign))node.style.textAlign=styles.textAlign;for(const [key,min,max,unit] of [['fontSize',8,96,'px'],['fontWeight',300,900,''],['padding',0,80,'px'],['borderRadius',0,80,'px'],['maxWidth',100,1200,'px'],['marginBottom',0,100,'px']])if(styles[key]!==undefined)node.style[key]=String(clamp(styles[key],min,max,min))+unit;}
function outputNode(){const output=document.createElement('pre');output.className='slf-backend-output';output.setAttribute('aria-live','polite');output.hidden=true;return output;}
async function executeBackend(action,button,output){
 const table=String(action.target||'');if(!/^studio_[a-z][a-z0-9_]{0,31}$/.test(table)){output.textContent='Target tabel tidak valid.';output.hidden=false;return;}
 button.disabled=true;output.hidden=false;output.textContent=action.type==='backend-submit'?'Menyimpan data…':'Mengambil data…';
 try{
  const values={};if(action.type==='backend-submit')document.querySelectorAll('[data-slf-backend-field]').forEach(field=>{const name=field.getAttribute('data-slf-backend-field');if(name)values[name]=field.value;});
  const response=await fetch('/api/studio/data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:action.type==='backend-submit'?'submit':'read',table,values}),cache:'no-store',credentials:'same-origin'});
  const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Permintaan backend gagal.');
  output.textContent=action.type==='backend-submit'?(result.message||'Data berhasil disimpan.'):JSON.stringify(result.rows||[],null,2);
  if(action.type==='backend-submit')document.querySelectorAll('[data-slf-backend-field]').forEach(field=>{field.value='';});
 }catch(error){output.textContent=error.message||'Koneksi backend gagal.';}finally{button.disabled=false;}
}
(Array.isArray(page.layers)?page.layers:[]).forEach(layer=>{
 const wrap=document.createElement('article');wrap.className='slf-page-layer';wrap.dataset.layerId=layer.id;let node;
 if(layer.type==='image'){node=document.createElement('img');node.src=safeUrl(layer.src);node.alt=layer.name||'Gambar SLF';node.loading='lazy';node.decoding='async';}
 else if(layer.type==='video'){node=document.createElement('video');node.src=safeUrl(layer.src);node.controls=true;node.preload='metadata';node.playsInline=true;}
 else if(layer.type==='button'){node=document.createElement('button');node.type='button';node.className='slf-page-button';node.textContent=layer.content||layer.name||'Tombol';}
 else if(layer.type==='table'){node=document.createElement('div');node.className='slf-page-table-wrap';const table=document.createElement('table'),body=document.createElement('tbody');(Array.isArray(layer.rows)?layer.rows:[]).forEach((row,index)=>{const tr=document.createElement('tr');(Array.isArray(row)?row:[]).forEach(cell=>{const td=document.createElement(index===0?'th':'td');td.textContent=String(cell??'');tr.append(td);});body.append(tr);});table.append(body);node.append(table);}
 else if(layer.type==='card'){node=document.createElement('div');node.className='slf-page-card';node.textContent=layer.content||layer.name||'Kartu informasi';}
 else if(layer.type==='input'){node=document.createElement('label');node.className='slf-page-input-label';const label=document.createElement('span');label.textContent=layer.name||layer.fieldName;const input=document.createElement('input');input.type='text';input.name=layer.fieldName;input.placeholder=layer.content||layer.fieldName;input.maxLength=1000;input.autocomplete='off';input.setAttribute('data-slf-backend-field',layer.fieldName);node.append(label,input);}
 else{node=document.createElement('p');node.className='slf-page-text';node.textContent=layer.content||layer.name||'Teks baru';}
 wrap.append(node);applyStyles(node,layer.styles||{});
 const animation=['fade','float','pulse'].includes(layer.animation)?layer.animation:'none';if(animation!=='none'){wrap.classList.add('slf-motion-'+animation);if(layer.loop)wrap.classList.add('slf-motion-loop');wrap.style.setProperty('--slf-duration',clamp(layer.duration,200,10000,900)+'ms');}
 if(layer.type==='button'){
  const output=outputNode();wrap.append(output);
  node.addEventListener('click',()=>{
   const action=layer.action||{type:'none'};if(['fade','float','pulse'].includes(layer.clickAnimation)){wrap.classList.remove('slf-click-'+layer.clickAnimation);void wrap.offsetWidth;wrap.classList.add('slf-click-'+layer.clickAnimation);}
   if(action.type==='navigate'){const target=safeUrl(action.target);if(target)location.assign(target);}
   else if(action.type==='external'){const target=safeUrl(action.target,true);if(target)window.open(target,'_blank','noopener,noreferrer');}
   else if(action.type==='scroll'){const id=String(action.target||'').replace(/^#/,'').replace(/[^A-Za-z0-9_-]/g,'');const target=id?document.getElementById(id):null;if(target)target.scrollIntoView({behavior:'smooth',block:'start'});}
   else if(action.type==='backend-submit'||action.type==='backend-read')executeBackend(action,node,output);
   else if(layer.href){const target=safeUrl(layer.href);if(target)location.assign(target);}
  });
 }
 root.append(wrap);
});
})();