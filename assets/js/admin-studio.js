(() => {
'use strict';
const $=id=>document.getElementById(id),secretKey='slf_admin_secret_session';
const pages={'/':'home','/store/':'store','/wiki/':'wiki','/bantuan/':'help','/store/order.html':'order','/store/review.html':'review','/store/ticket.html':'ticket'};
const defaults=()=>({version:2,page:'all',accent:'#9b6cff',accent2:'#f3cb82',background:'#100c18',overlayColor:'#100c18',overlayOpacity:0,layers:[],elementEdits:[],insertedElements:[]});
let design=defaults(),selected=null,frameReady=false,dirty=false,mode=true,currentPath='/',history=[],redo=[],suppress=false;
const $id=selector=>document.querySelector(selector);
function api(path,options={}){const headers={...(options.headers||{}),authorization:'Bearer '+(sessionStorage.getItem(secretKey)||'')};if(options.body&&!(options.body instanceof FormData))headers['content-type']='application/json';return fetch(path,{...options,headers,cache:'no-store'}).then(async r=>{const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Permintaan gagal ('+r.status+')');return data;});}
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
 return {color:'studio-style-color',backgroundColor:'studio-style-bg',fontFamily:'studio-style-font',fontStyle:'studio-style-font-style',textDecoration:'studio-style-decoration',fontSize:'studio-style-size',fontWeight:'studio-style-weight',letterSpacing:'studio-style-spacing',lineHeight:'studio-style-line',textAlign:'studio-style-align',textTransform:'studio-style-transform',borderRadius:'studio-style-radius',padding:'studio-style-padding',marginBottom:'studio-style-margin',maxWidth:'studio-style-max',opacity:'studio-style-opacity',boxShadow:'studio-style-shadow',filter:'studio-style-filter',objectFit:'studio-style-fit'};
}
function styleState(edit){return edit&&edit.styles||{};}
function renderSelection(){
 $('studio-selected-label').textContent=selected?selected.label:'Belum ada elemen dipilih';
 $('studio-selected-path').textContent=selected?selected.selector:'Pilih elemen di preview website.';
 const crumbs=$('studio-breadcrumbs');crumbs.replaceChildren();(selected&&selected.ancestors||[]).forEach(item=>{const button=document.createElement('button');button.type='button';button.className='btn btn-quiet';button.textContent=item.tag+' · '+item.label;button.addEventListener('click',()=>msg({type:'slf-studio-select-target',selector:item.selector}));crumbs.append(button);});
 $('studio-selected-note').textContent=selected?(selected.tag.toUpperCase()+' · '+(selected.textEditable?'Teks dapat diedit':'Konten teks bukan elemen tunggal; ubah tampilannya dari properti.')+(selected.created?' · Elemen baru':'')):'Perubahan diterapkan langsung pada preview.';
 const active=getActiveEdit(),styles=styleState(active);
 const styleDefaults={color:selected?.computed?.color||'#ffffff',backgroundColor:selected?.computed?.backgroundColor||'#100c18',fontFamily:selected?.computed?.fontFamily||'system',fontStyle:'normal',textDecoration:'none',fontSize:16,fontWeight:700,letterSpacing:0,lineHeight:1.5,textAlign:'left',textTransform:'none',borderRadius:0,padding:0,marginBottom:0,maxWidth:800,opacity:Math.round((selected?.computed?.opacity??1)*100),boxShadow:'none',filter:'none',objectFit:'cover'};
 $('studio-element-text').disabled=!selected||!selected.textEditable;
 $('studio-element-text').value=selected&&selected.textEditable?(active&&active.text!==undefined?active.text:selected.text):'';
 $('studio-element-src').disabled=!selected;
 $('studio-element-src').value=selected?(active&&active.src!==undefined?active.src:selected.src):'';
 for(const [key,id] of Object.entries(styleFields())){const el=$(id);if(!el)continue;const value=styles[key];el.value=value!==undefined?(key==='opacity'?Math.round(Number(value)*100):value):(selected?.computed?.[key]!==undefined?selected.computed[key]:styleDefaults[key]);}
 const effects=active&&active.effects||[];
 document.querySelectorAll('[data-effect]').forEach(el=>el.checked=effects.includes(el.dataset.effect));
 $('studio-remove-created').disabled=!(selected&&selected.created);
 $('studio-element-hidden').checked=Boolean(active&&active.hidden);
}
function sendEdit(){
 if(!selected)return;
 const active=getActiveEdit();
 if(!active)return;
 msg({type:'slf-studio-edit',edit:{text:active.text,src:active.src,backgroundImage:active.backgroundImage,hidden:active.hidden,styles:active.styles,effects:active.effects}});
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
 $('studio-element-src').addEventListener('focus',()=>{if(selected)snapshot();});$('studio-element-src').addEventListener('change',e=>change(x=>{x.src=e.target.value.trim();x.backgroundImage=selected.tag!=='img';}));
 $('studio-element-hidden').addEventListener('change',e=>change(x=>x.hidden=e.target.checked));
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

async function optimizeMedia(file){
 if(file.type==='image/gif')return file;
 if(typeof createImageBitmap!=='function')return file;
 let bitmap;
 try{bitmap=await createImageBitmap(file);const scale=Math.min(1,1920/Math.max(bitmap.width,bitmap.height));const width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{alpha:true});if(!context)return file;context.drawImage(bitmap,0,0,width,height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.82));if(!blob||blob.size<1||blob.size>=file.size)return file;const name=String(file.name||'gambar').replace(/\.[^.]+$/,'').replace(/[^A-Za-z0-9_-]/g,'-').slice(0,48)||'gambar';return new File([blob],name+'.webp',{type:'image/webp',lastModified:Date.now()});}
 catch(_){return file;}finally{if(bitmap&&typeof bitmap.close==='function')bitmap.close();}
}
async function loadStudioMedia(){
 const root=$('studio-media-library');if(!root)return;
 try{
  const data=await api('/api/admin/media');root.replaceChildren();
  $('studio-media-note').textContent=data.message||'Pilih gambar untuk memasukkannya ke preview.';
  if(!data.storageReady&&!data.assets.length){const note=document.createElement('p');note.className='admin-muted';note.textContent='Upload langsung memerlukan GITHUB_MEDIA_TOKEN. Tanpa token, unggah file manual ke assets/images/ pada GitHub.';root.append(note);return;}
  if(!data.assets.length){const note=document.createElement('p');note.className='admin-muted';note.textContent='Belum ada gambar di pustaka media.';root.append(note);return;}
  data.assets.forEach(asset=>{
   const card=document.createElement('article');card.className='studio-media-card';
   const image=document.createElement('img');image.src=asset.url;image.alt='Media SLF';image.loading='lazy';image.decoding='async';
   const name=document.createElement('small');name.textContent=asset.key+' · '+Math.max(1,Math.round((asset.size||0)/1024))+' KB';
   const use=document.createElement('button');use.type='button';use.className='btn btn-quiet';use.textContent='Gunakan gambar';use.addEventListener('click',()=>{
    if(!selected){alert('Pilih area pada preview terlebih dahulu.');return;}
    if(selected.tag==='img')change(x=>x.src=asset.url);
    else msg({type:'slf-studio-add',kind:'image',src:asset.url});
   });
   card.append(image,name,use);root.append(card);
  });
 }catch(error){root.textContent=error.message||'Pustaka media gagal dimuat.';}
}
async function uploadStudioMedia(){
 const file=$('studio-media-file').files&&$('studio-media-file').files[0];if(!file){$('studio-media-note').textContent='Pilih gambar terlebih dahulu.';return;}
 if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)){$('studio-media-note').textContent='Format: PNG, JPG, WEBP, atau GIF.';return;}
 const button=$('studio-media-upload');button.disabled=true;
 try{
  $('studio-media-note').textContent='Mengoptimalkan gambar…';
  const optimized=await optimizeMedia(file);if(optimized.size>2*1024*1024)throw new Error('Ukuran setelah optimasi harus maksimal 2 MB.');
  const form=new FormData();form.append('file',optimized,optimized.name);
  const result=await api('/api/admin/media',{method:'POST',body:form});
  $('studio-media-file').value='';await loadStudioMedia();
  $('studio-media-note').textContent='Gambar diunggah. Deployment Pages dipicu oleh commit GitHub.';
  if(selected&&selected.tag==='img')change(x=>x.src=result.asset.url);
  else if(selected)msg({type:'slf-studio-add',kind:'image',src:result.asset.url});
 }catch(error){$('studio-media-note').textContent=error.message||'Upload gagal.';}
 finally{button.disabled=false;}
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
  if(m.type==='slf-studio-removed'){design.insertedElements=design.insertedElements.filter(x=>x.id!==m.id);selected=null;renderSelection();setDirty();}
 });
 $('studio-media-upload').addEventListener('click',uploadStudioMedia);
 $('studio-media-reload').addEventListener('click',loadStudioMedia);
 $('studio-preview-page').addEventListener('change',e=>{if(dirty&&!confirm('Ada perubahan belum diterbitkan. Buang perubahan lokal sebelum pindah halaman?')){e.target.value=currentPath;return;}if(dirty)loadDesign(false);selectPreview(e.target.value);});
 $('studio-select-mode').addEventListener('click',()=>{mode=!mode;$('studio-select-mode').textContent='Pilih elemen: '+(mode?'ON':'OFF');msg({type:'slf-studio-mode',enabled:mode});});
 $('studio-preview-reload').addEventListener('click',()=>{if(dirty&&!confirm('Muat ulang akan membuang preview yang belum diterbitkan. Lanjutkan?'))return;if(dirty)loadDesign(false);selectPreview(currentPath);});
 $('studio-view-desktop').addEventListener('click',()=>frame.classList.remove('mobile'));
 $('studio-view-mobile').addEventListener('click',()=>frame.classList.add('mobile'));
 $('studio-add-text').addEventListener('click',()=>{if(!selected){alert('Pilih bagian/area di preview terlebih dahulu.');return;}msg({type:'slf-studio-add',kind:'text'});});
 $('studio-add-image').addEventListener('click',()=>{if(!selected){alert('Pilih bagian/area di preview terlebih dahulu.');return;}const src=prompt('Masukkan URL HTTPS atau path gambar, misalnya /assets/images/uploads/gambar.webp');if(src)msg({type:'slf-studio-add',kind:'image',src:src.trim()});});
 $('studio-remove-created').addEventListener('click',()=>{if(!selected||!selected.created)return;msg({type:'slf-studio-remove'});});
 $('studio-global-accent').addEventListener('focus',snapshot);$('studio-global-accent2').addEventListener('focus',snapshot);$('studio-global-overlay').addEventListener('focus',snapshot);$('studio-global-overlay-opacity').addEventListener('focus',snapshot);
 $('studio-global-accent').addEventListener('input',e=>{design.accent=e.target.value;setDirty();msg({type:'slf-studio-theme',accent:design.accent});});
 $('studio-global-accent2').addEventListener('input',e=>{design.accent2=e.target.value;setDirty();msg({type:'slf-studio-theme',accent2:design.accent2});});
 $('studio-global-overlay').addEventListener('input',e=>{design.overlayColor=e.target.value;setDirty();msg({type:'slf-studio-theme',overlayColor:design.overlayColor,overlayOpacity:design.overlayOpacity});});
 $('studio-global-overlay-opacity').addEventListener('input',e=>{design.overlayOpacity=Number(e.target.value);setDirty();msg({type:'slf-studio-theme',overlayColor:design.overlayColor,overlayOpacity:design.overlayOpacity});});
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
  dirty=false;$('studio-dirty').textContent='';if(showStatus)$('studio-live-status').textContent=data.storageMessage||'Desain dimuat.';await loadStudioMedia();
 }catch(error){$('studio-error').textContent=error.message||'Desain tidak bisa dimuat.';}
}
window.SLFStudioLoad=async()=>{if(!window.__slfStudioBound){window.__slfStudioBound=true;bind();}await loadDesign();selectPreview(currentPath);};
})();