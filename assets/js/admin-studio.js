(() => {
'use strict';
const $=id=>document.getElementById(id),secretKey='slf_admin_secret_session';
const pages={'/':'home','/store/':'store','/wiki/':'wiki','/bantuan/':'help','/store/order.html':'order','/store/review.html':'review','/store/ticket.html':'ticket'};
const defaults=()=>({version:2,page:'all',accent:'#9b6cff',accent2:'#f3cb82',background:'#100c18',overlayColor:'#100c18',overlayOpacity:0,layers:[],elementEdits:[],insertedElements:[]});
let design=defaults(),selected=null,frameReady=false,dirty=false,mode=true,currentPath='/',history=[],redo=[],suppress=false;
const $id=selector=>document.querySelector(selector);
function api(path,options={}){const headers={...(options.headers||{}),authorization:'Bearer '+(sessionStorage.getItem(secretKey)||'')};if(options.body)headers['content-type']='application/json';return fetch(path,{...options,headers,cache:'no-store'}).then(async r=>{const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Permintaan gagal ('+r.status+')');return data;});}
function clone(v){return JSON.parse(JSON.stringify(v));}
function snapshot(){history.push(clone(design));if(history.length>35)history.shift();redo=[];}
function setDirty(){dirty=true;$('studio-dirty').textContent='● Ada perubahan belum diterbitkan';$('studio-live-status').textContent='Preview lokal aktif';}
function msg(payload){if(frameReady&&$('studio-preview-frame').contentWindow)$('studio-preview-frame').contentWindow.postMessage(payload,location.origin);}
function currentPage(){return pages[currentPath]||'home';}
function entryFor(selector,page=currentPage()){return design.elementEdits.find(x=>x.selector===selector&&(x.page===page||x.page==='all'));}
function insertedFor(id){return design.insertedElements.find(x=>x.id===id);}
function getActiveEdit(){if(!selected)return null;if(selected.created)return insertedFor(selected.id);return entryFor(selected.selector);}
function selectPreview(path){currentPath=path;$('studio-preview-frame-wrap').classList.add('is-loading');frameReady=false;$('studio-preview-frame').src=path+(path.includes('?')?'&':'?')+'slf_studio=1&v='+Date.now();$('studio-preview-page').value=path;selected=null;renderSelection();}
function styleFields(){
 return {color:'studio-style-color',backgroundColor:'studio-style-bg',fontFamily:'studio-style-font',fontSize:'studio-style-size',fontWeight:'studio-style-weight',letterSpacing:'studio-style-spacing',lineHeight:'studio-style-line',textAlign:'studio-style-align',textTransform:'studio-style-transform',borderRadius:'studio-style-radius',padding:'studio-style-padding',marginBottom:'studio-style-margin',maxWidth:'studio-style-max',opacity:'studio-style-opacity',boxShadow:'studio-style-shadow',filter:'studio-style-filter',objectFit:'studio-style-fit'};
}
function styleState(edit){return edit&&edit.styles||{};}
function renderSelection(){
 $('studio-selected-label').textContent=selected?selected.label:'Belum ada elemen dipilih';
 $('studio-selected-path').textContent=selected?selected.selector:'Pilih elemen di preview website.';
 $('studio-selected-note').textContent=selected?(selected.tag.toUpperCase()+' · '+(selected.textEditable?'Teks dapat diedit':'Konten teks bukan elemen tunggal; ubah tampilannya dari properti.')+(selected.created?' · Elemen baru':'')):'Perubahan diterapkan langsung pada preview.';
 const active=getActiveEdit(),styles=styleState(active);
 const styleDefaults={color:'#ffffff',backgroundColor:'#100c18',fontFamily:'system',fontSize:16,fontWeight:700,letterSpacing:0,lineHeight:1.5,textAlign:'left',textTransform:'none',borderRadius:0,padding:0,marginBottom:0,maxWidth:800,opacity:100,boxShadow:'none',filter:'none',objectFit:'cover'};
 $('studio-element-text').disabled=!selected||!selected.textEditable;
 $('studio-element-text').value=selected&&selected.textEditable?(active&&active.text!==undefined?active.text:selected.text):'';
 $('studio-element-src').disabled=!selected||selected.tag!=='img';
 $('studio-element-src').value=selected?(active&&active.src!==undefined?active.src:selected.src):'';
 for(const [key,id] of Object.entries(styleFields())){const el=$(id);if(!el)continue;const value=styles[key];el.value=value!==undefined?(key==='opacity'?Math.round(Number(value)*100):value):styleDefaults[key];}
 const effects=active&&active.effects||[];
 document.querySelectorAll('[data-effect]').forEach(el=>el.checked=effects.includes(el.dataset.effect));
 $('studio-remove-created').disabled=!(selected&&selected.created);
}
function sendEdit(){
 if(!selected)return;
 const active=getActiveEdit();
 if(!active)return;
 msg({type:'slf-studio-edit',edit:{text:active.text,src:active.src,hidden:active.hidden,styles:active.styles,effects:active.effects}});
}
function ensureEntry(){
 if(!selected)return null;
 if(selected.created)return insertedFor(selected.id);
 let entry=entryFor(selected.selector);
 if(!entry){entry={page:currentPage(),selector:selected.selector,tag:selected.tag,styles:{},effects:[],hidden:false};design.elementEdits.push(entry);}
 return entry;
}
function change(mutator){
 if(!selected)return;
 const entry=ensureEntry();if(!entry)return;
 mutator(entry);setDirty();renderSelection();sendEdit();
}
function bindFields(){
 $('studio-element-text').addEventListener('focus',()=>{if(selected)snapshot();});$('studio-element-text').addEventListener('input',e=>change(x=>x.text=e.target.value));
 $('studio-element-src').addEventListener('focus',()=>{if(selected)snapshot();});$('studio-element-src').addEventListener('change',e=>change(x=>x.src=e.target.value.trim()));
 for(const [key,id] of Object.entries(styleFields())){
  const el=$(id);if(!el)continue;
  el.addEventListener('focus',()=>{if(selected)snapshot();});
  el.addEventListener(key==='fontFamily'||key==='textAlign'||key==='textTransform'||key==='boxShadow'||key==='filter'||key==='objectFit'?'change':'input',e=>{
   let value=e.target.value;if(['fontSize','fontWeight','letterSpacing','lineHeight','borderRadius','padding','marginBottom','maxWidth','opacity'].includes(key))value=Number(value);
   if(key==='opacity')value=value/100;
   change(x=>{x.styles=x.styles||{};x.styles[key]=value;});
  });
 }
 document.querySelectorAll('[data-effect]').forEach(el=>el.addEventListener('change',()=>{
  if(!selected)return;snapshot();const entry=ensureEntry();if(!entry)return;
  entry.effects=entry.effects||[];
  entry.effects=el.checked?[...new Set([...entry.effects,el.dataset.effect])]:entry.effects.filter(x=>x!==el.dataset.effect);
  setDirty();sendEdit();
 }));
}
function saveCreated(data){
 if(!design.insertedElements.some(x=>x.id===data.id)){
  snapshot();design.insertedElements.push({id:data.id,page:currentPage(),containerSelector:data.containerSelector,type:data.kind==='image'?'image':'text',text:data.kind==='image'?'': 'Teks baru',src:data.src||'',alt:'Elemen tambahan SLF',styles:{},effects:[]});setDirty();
 }
}
function bind(){
 const frame=$('studio-preview-frame');
 frame.addEventListener('load',()=>{frameReady=true;$('studio-preview-frame-wrap').classList.remove('is-loading');msg({type:'slf-studio-mode',enabled:mode});$('studio-live-status').textContent='Preview siap · klik elemen untuk memilih';});
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow||!event.data)return;
  const m=event.data;
  if(m.type==='slf-studio-ready'){$('studio-live-status').textContent='Halaman '+m.page+' siap diedit';}
  if(m.type==='slf-studio-selected'){selected=m;renderSelection();}
  if(m.type==='slf-studio-created'){saveCreated(m);}
  if(m.type==='slf-studio-removed'){design.insertedElements=design.insertedElements.filter(x=>x.id!==m.id);setDirty();}
 });
 $('studio-preview-page').addEventListener('change',e=>{if(dirty&&!confirm('Ada perubahan belum diterbitkan. Buang perubahan lokal sebelum pindah halaman?')){e.target.value=currentPath;return;}if(dirty)loadDesign(false);selectPreview(e.target.value);});
 $('studio-select-mode').addEventListener('click',()=>{mode=!mode;$('studio-select-mode').textContent='Pilih elemen: '+(mode?'ON':'OFF');msg({type:'slf-studio-mode',enabled:mode});});
 $('studio-preview-reload').addEventListener('click',()=>{if(dirty&&!confirm('Muat ulang akan membuang preview yang belum diterbitkan. Lanjutkan?'))return;if(dirty)loadDesign(false);selectPreview(currentPath);});
 $('studio-view-desktop').addEventListener('click',()=>frame.classList.remove('mobile'));
 $('studio-view-mobile').addEventListener('click',()=>frame.classList.add('mobile'));
 $('studio-add-text').addEventListener('click',()=>{if(!selected){alert('Pilih bagian/area di preview terlebih dahulu.');return;}msg({type:'slf-studio-add',kind:'text'});});
 $('studio-add-image').addEventListener('click',()=>{if(!selected){alert('Pilih bagian/area di preview terlebih dahulu.');return;}const src=prompt('Masukkan URL HTTPS atau path gambar, misalnya /assets/images/uploads/gambar.webp');if(src)msg({type:'slf-studio-add',kind:'image',src:src.trim()});});
 $('studio-remove-created').addEventListener('click',()=>{if(!selected||!selected.created)return;msg({type:'slf-studio-remove'});});
 $('studio-global-accent').addEventListener('input',e=>{design.accent=e.target.value;setDirty();msg({type:'slf-studio-theme',accent:design.accent});});
 $('studio-global-accent2').addEventListener('input',e=>{design.accent2=e.target.value;setDirty();msg({type:'slf-studio-theme',accent2:design.accent2});});
 $('studio-global-overlay').addEventListener('input',e=>{design.overlayColor=e.target.value;setDirty();msg({type:'slf-studio-theme',overlayColor:design.overlayColor});});
 $('studio-global-overlay-opacity').addEventListener('input',e=>{design.overlayOpacity=Number(e.target.value);setDirty();msg({type:'slf-studio-theme',overlayOpacity:design.overlayOpacity});});
 $('studio-reset-selected').addEventListener('click',()=>{if(!selected)return;if(!confirm('Reset perubahan pada elemen terpilih?'))return;snapshot();if(selected.created){design.insertedElements=design.insertedElements.filter(x=>x.id!==selected.id);msg({type:'slf-studio-remove'});}else design.elementEdits=design.elementEdits.filter(x=>x.selector!==selected.selector||x.page!==currentPage());setDirty();selectPreview(currentPath);});
 $('studio-discard').addEventListener('click',()=>{if(!confirm('Buang semua perubahan preview yang belum diterbitkan?'))return;loadDesign(false);selectPreview(currentPath);});
 $('studio-publish').addEventListener('click',async()=>{
  const button=$('studio-publish');button.disabled=true;
  try{const data=await api('/api/admin/site-design',{method:'POST',body:JSON.stringify({design})});design=data.design;dirty=false;$('studio-dirty').textContent='';$('studio-live-status').textContent='Perubahan diterbitkan. Memuat ulang preview…';selectPreview(currentPath);}
  catch(error){$('studio-error').textContent=error.message||'Gagal menerbitkan perubahan.';}
  finally{button.disabled=false;}
 });
 $('studio-undo').addEventListener('click',()=>{if(!history.length)return;redo.push(clone(design));design=history.pop();setDirty();selectPreview(currentPath);});
 $('studio-redo').addEventListener('click',()=>{if(!redo.length)return;history.push(clone(design));design=redo.pop();setDirty();selectPreview(currentPath);});
 bindFields();
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
}
async function loadDesign(showStatus=true){
 try{
  const data=await api('/api/admin/site-design');design=data.design||defaults();design.elementEdits=Array.isArray(design.elementEdits)?design.elementEdits:[];design.insertedElements=Array.isArray(design.insertedElements)?design.insertedElements:[];
  $('studio-global-accent').value=design.accent||'#9b6cff';$('studio-global-accent2').value=design.accent2||'#f3cb82';$('studio-global-overlay').value=design.overlayColor||'#100c18';$('studio-global-overlay-opacity').value=design.overlayOpacity||0;
  dirty=false;$('studio-dirty').textContent='';if(showStatus)$('studio-live-status').textContent=data.storageMessage||'Desain dimuat.';
 }catch(error){$('studio-error').textContent=error.message||'Desain tidak bisa dimuat.';}
}
window.SLFStudioLoad=async()=>{if(!window.__slfStudioBound){window.__slfStudioBound=true;bind();}await loadDesign();selectPreview(currentPath);};
})();