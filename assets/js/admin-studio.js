(() => {
'use strict';
const $=id=>document.getElementById(id),secretKey='slf_admin_secret_session';
const clamp=(v,min,max,def)=>{const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):def;};
const validColor=(v,def)=>/^#[0-9a-f]{6}$/i.test(String(v||''))?v:def;
const defaults=()=>({version:1,page:'home',accent:'#9b6cff',accent2:'#f3cb82',background:'#100c18',overlayColor:'#100c18',overlayOpacity:65,layers:[
{id:'wallpaper',type:'image',name:'Wallpaper utama',src:'',x:50,y:50,width:100,height:100,fit:'cover',opacity:100,blur:0,visible:true,z:0},
{id:'title-main',type:'text',name:'Judul utama',text:'Warisan lama.',x:7,y:31,width:82,fontSize:64,color:'#fff1d4',align:'left',weight:850,opacity:100,visible:true,z:2},
{id:'title-accent',type:'text',name:'Judul aksen',text:'Petualangan baru.',x:7,y:45,width:88,fontSize:58,color:'#c6a6ff',align:'left',weight:850,opacity:100,visible:true,z:3},
{id:'subtitle',type:'text',name:'Deskripsi',text:'Masuki dunia tempat ras, perjalanan, perdagangan, dan keputusanmu membentuk cerita.',x:7,y:64,width:62,fontSize:22,color:'#f0e8fa',align:'left',weight:450,opacity:100,visible:true,z:4}
]});
let project=defaults(),selectedId='title-main',isReady=false,assets=[];
async function api(path,options){
 options=options||{};
 const headers=Object.assign({},options.headers||{},{authorization:'Bearer '+(sessionStorage.getItem(secretKey)||'')});
 if(options.body&&!(options.body instanceof FormData))headers['content-type']='application/json';
 const response=await fetch(path,Object.assign({},options,{headers,cache:'no-store'}));
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||('Permintaan gagal ('+response.status+').'));
 return data;
}
function status(text,isError){
 $('studio-error').textContent=text||'';
 $('studio-error').classList.toggle('show',Boolean(isError&&text));
 if(text&&!isError)$('studio-save-state').textContent=text;
}
function currentLayer(){return project.layers.find(layer=>layer.id===selectedId)||null;}
function renderLayerList(){
 const root=$('studio-layers');root.replaceChildren();
 project.layers.slice().sort((a,b)=>(a.z||0)-(b.z||0)).forEach(layer=>{
  const button=document.createElement('button');button.type='button';
  button.className='studio-layer-item'+(layer.id===selectedId?' active':'');
  const icon=document.createElement('span');icon.className='studio-layer-icon';icon.textContent=layer.type==='image'?'▧':'T';
  const name=document.createElement('span');name.className='studio-layer-label';name.textContent=layer.name||'Layer';
  const meta=document.createElement('small');meta.textContent=layer.visible===false?'Disembunyikan':(layer.type==='image'?'Gambar':'Teks');
  button.append(icon,name,meta);button.addEventListener('click',()=>selectLayer(layer.id));root.append(button);
 });
 $('studio-delete-layer').disabled=!currentLayer()||selectedId==='wallpaper';
}
function renderStage(){
 const stage=$('studio-stage');stage.replaceChildren();stage.style.backgroundColor=validColor(project.background,'#100c18');
 const wallpaper=project.layers.find(layer=>layer.id==='wallpaper'&&layer.type==='image'&&layer.visible!==false&&layer.src);
 if(wallpaper){
  const image=document.createElement('img');image.className='studio-stage-wallpaper';image.src=wallpaper.src;image.alt='';image.draggable=false;
  image.style.objectFit=wallpaper.fit==='contain'?'contain':'cover';
  image.style.objectPosition=clamp(wallpaper.x,0,100,50)+'% '+clamp(wallpaper.y,0,100,50)+'%';
  image.style.opacity=String(clamp(wallpaper.opacity,0,100,100)/100);
  image.style.filter='blur('+clamp(wallpaper.blur,0,20,0)+'px)';stage.append(image);
 }
 const overlay=document.createElement('div');overlay.className='studio-stage-overlay';
 overlay.style.backgroundColor=validColor(project.overlayColor,'#100c18');
 overlay.style.opacity=String(clamp(project.overlayOpacity,0,100,65)/100);stage.append(overlay);
 project.layers.filter(layer=>layer.type==='image'&&layer.id!=='wallpaper'&&layer.visible!==false&&layer.src).forEach(layer=>{
  const image=document.createElement('img');image.className='studio-canvas-layer'+(layer.id===selectedId?' selected':'');
  image.dataset.layerId=layer.id;image.src=layer.src;image.alt='';image.draggable=false;
  image.style.left=layer.x+'%';image.style.top=layer.y+'%';image.style.width=layer.width+'%';image.style.height=layer.height+'%';
  image.style.objectFit=layer.fit==='contain'?'contain':'cover';image.style.opacity=String(layer.opacity/100);
  image.style.filter='blur('+layer.blur+'px)';image.style.zIndex=String(layer.z);stage.append(image);
 });
 project.layers.filter(layer=>layer.type==='text'&&layer.visible!==false).forEach(layer=>{
  const node=document.createElement('div');node.className='studio-canvas-text'+(layer.id===selectedId?' selected':'');
  node.dataset.layerId=layer.id;node.textContent=layer.text||'';
  node.style.left=layer.x+'%';node.style.top=layer.y+'%';node.style.width=layer.width+'%';
  node.style.fontSize=(layer.fontSize/1440*100)+'cqw';node.style.color=validColor(layer.color,'#fff1d4');
  node.style.textAlign=layer.align||'left';node.style.fontWeight=String(layer.weight||800);
  node.style.opacity=String(layer.opacity/100);node.style.zIndex=String(layer.z);stage.append(node);
 });
}
function updateControls(){
 const layer=currentLayer();
 $('studio-properties').hidden=!layer;
 $('studio-text-properties').hidden=!layer||layer.type!=='text';
 $('studio-image-properties').hidden=!layer||layer.type!=='image';
 $('studio-delete-layer').disabled=!layer||layer.id==='wallpaper';
 if(layer){
  $('studio-layer-name').value=layer.name||'';$('studio-layer-x').value=layer.x;$('studio-layer-y').value=layer.y;
  $('studio-layer-width').value=layer.width;$('studio-layer-height').value=layer.height||40;$('studio-layer-weight').value=layer.weight||800;$('studio-layer-opacity').value=layer.opacity;
  $('studio-layer-opacity-value').textContent=layer.opacity+'%';$('studio-layer-visible').checked=layer.visible!==false;
  if(layer.type==='text'){
   $('studio-layer-text').value=layer.text||'';$('studio-layer-color').value=validColor(layer.color,'#fff1d4');
   $('studio-layer-size').value=layer.fontSize;$('studio-layer-size-value').textContent=layer.fontSize+' px';
   $('studio-layer-align').value=layer.align||'left';
  }else{
   $('studio-layer-source').value=layer.src||'';$('studio-layer-fit').value=layer.fit||'cover';
   $('studio-layer-blur').value=layer.blur||0;$('studio-layer-blur-value').textContent=(layer.blur||0)+' px';
  }
 }
 $('studio-page').value=project.page||'home';$('studio-accent').value=validColor(project.accent,'#9b6cff');
 $('studio-accent2').value=validColor(project.accent2,'#f3cb82');$('studio-background').value=validColor(project.background,'#100c18');
 $('studio-overlay-color').value=validColor(project.overlayColor,'#100c18');$('studio-overlay-opacity').value=project.overlayOpacity;
 $('studio-overlay-value').textContent=project.overlayOpacity+'%';
}
function selectLayer(id){selectedId=id;renderLayerList();updateControls();renderStage();}
function updateLayer(key,value){
 const layer=currentLayer();if(!layer)return;
 const ranges={x:[0,100],y:[0,100],width:[5,100],height:[5,100],opacity:[0,100],blur:[0,20],fontSize:[12,120],weight:[300,900]};
 if(ranges[key])layer[key]=clamp(value,ranges[key][0],ranges[key][1],layer[key]||0);
 else if(key==='visible')layer.visible=Boolean(value);
 else if(key==='color')layer.color=validColor(value,'#fff1d4');
 else if(key==='fit')layer.fit=value==='contain'?'contain':'cover';
 else if(key==='align')layer.align=['left','center','right'].includes(value)?value:'left';
 else if(key==='name')layer.name=String(value).slice(0,60);
 else if(key==='text')layer.text=String(value).slice(0,240);
 else if(key==='src')layer.src=String(value).slice(0,500);
 renderStage();renderLayerList();
}
function addLayer(type,src){
 const id=(type==='image'?'image-':'text-')+Math.random().toString(36).slice(2,9),z=5+project.layers.length;
 const layer=type==='image'
  ?{id,type,name:'Gambar baru',src:src||'',x:48,y:18,width:34,height:52,fit:'contain',opacity:100,blur:0,visible:true,z}
  :{id,type,name:'Teks baru',text:'Teks baru',x:12,y:76,width:70,fontSize:34,color:'#fff1d4',align:'left',weight:750,opacity:100,visible:true,z};
 project.layers.push(layer);selectLayer(id);
}
function bind(){
 const on=(id,event,fn)=>$(id).addEventListener(event,fn);
 on('studio-page','change',e=>project.page=e.target.value);
 on('studio-layer-name','input',e=>updateLayer('name',e.target.value));
 on('studio-layer-text','input',e=>updateLayer('text',e.target.value));
 on('studio-layer-color','input',e=>updateLayer('color',e.target.value));
 on('studio-layer-size','input',e=>{updateLayer('fontSize',e.target.value);$('studio-layer-size-value').textContent=e.target.value+' px';});
 on('studio-layer-align','change',e=>updateLayer('align',e.target.value));
 on('studio-layer-source','change',e=>updateLayer('src',e.target.value));
 on('studio-layer-fit','change',e=>updateLayer('fit',e.target.value));
 on('studio-layer-blur','input',e=>{updateLayer('blur',e.target.value);$('studio-layer-blur-value').textContent=e.target.value+' px';});
 [['x','studio-layer-x'],['y','studio-layer-y'],['width','studio-layer-width'],['height','studio-layer-height']].forEach(pair=>on(pair[1],'change',e=>updateLayer(pair[0],e.target.value)));on('studio-layer-weight','input',e=>updateLayer('weight',e.target.value));
 on('studio-layer-opacity','input',e=>{updateLayer('opacity',e.target.value);$('studio-layer-opacity-value').textContent=e.target.value+'%';});
 on('studio-layer-visible','change',e=>updateLayer('visible',e.target.checked));
 on('studio-accent','input',e=>{project.accent=e.target.value;const accent=project.layers.find(x=>x.id==='title-accent');if(accent)accent.color=e.target.value;renderStage();});on('studio-accent2','input',e=>{project.accent2=e.target.value;renderStage();});
 on('studio-background','input',e=>{project.background=e.target.value;renderStage();});
 on('studio-overlay-color','input',e=>{project.overlayColor=e.target.value;renderStage();});
 on('studio-overlay-opacity','input',e=>{project.overlayOpacity=Number(e.target.value);$('studio-overlay-value').textContent=e.target.value+'%';renderStage();});
 on('studio-add-text','click',()=>addLayer('text'));
 on('studio-add-image','click',()=>{const source=prompt('Masukkan URL gambar HTTPS atau path /assets/images/ yang sudah tersedia:');if(source!==null)addLayer('image',source.trim());});
 on('studio-delete-layer','click',()=>{if(!currentLayer()||selectedId==='wallpaper')return;project.layers=project.layers.filter(x=>x.id!==selectedId);selectedId='title-main';renderLayerList();updateControls();renderStage();});
on('studio-duplicate-layer','click',()=>{const layer=currentLayer();if(!layer||project.layers.length>=16)return;const copy=JSON.parse(JSON.stringify(layer));copy.id='copy-'+Math.random().toString(36).slice(2,9);copy.name=(layer.name||'Layer')+' copy';copy.x=clamp(copy.x+3,0,100,copy.x);copy.y=clamp(copy.y+3,0,100,copy.y);copy.z=clamp(copy.z+1,1,10,copy.z);project.layers.push(copy);selectLayer(copy.id);});
const moveLayer=step=>{const items=project.layers.filter(x=>x.id!=='wallpaper').sort((a,b)=>(a.z||0)-(b.z||0));const index=items.findIndex(x=>x.id===selectedId);if(index<0)return;const next=clamp(index+step,0,items.length-1,index);if(next===index)return;const [item]=items.splice(index,1);items.splice(next,0,item);items.forEach((x,i)=>x.z=i+1);renderLayerList();renderStage();};on('studio-layer-up','click',()=>moveLayer(-1));on('studio-layer-down','click',()=>moveLayer(1));
 on('studio-reset','click',()=>{if(!confirm('Reset desain lokal ke pengaturan awal?'))return;project=defaults();selectedId='title-main';renderLayerList();updateControls();renderStage();status('Desain lokal direset. Belum diterbitkan.',false);});
 on('studio-save','click',saveDesign);on('studio-upload','click',uploadImage);on('studio-reload-media','click',loadMedia);
 const stage=$('studio-stage');let movement=null;
 stage.addEventListener('pointerdown',event=>{
  const node=event.target.closest('[data-layer-id]');if(!node)return;
  const layer=project.layers.find(x=>x.id===node.dataset.layerId);if(!layer)return;
  selectLayer(layer.id);movement={id:layer.id,pointerId:event.pointerId,rect:stage.getBoundingClientRect()};
  node.setPointerCapture(event.pointerId);event.preventDefault();
 });
 stage.addEventListener('pointermove',event=>{
  if(!movement||movement.pointerId!==event.pointerId)return;
  const layer=project.layers.find(x=>x.id===movement.id),node=stage.querySelector('[data-layer-id="'+movement.id+'"]');if(!layer||!node)return;
  layer.x=clamp((event.clientX-movement.rect.left)/movement.rect.width*100,0,100,layer.x);
  layer.y=clamp((event.clientY-movement.rect.top)/movement.rect.height*100,0,100,layer.y);
  node.style.left=layer.x+'%';node.style.top=layer.y+'%';
 });
 stage.addEventListener('pointerup',()=>{if(!movement)return;movement=null;updateControls();renderLayerList();});
 stage.addEventListener('pointercancel',()=>movement=null);
}
async function saveDesign(){
 const button=$('studio-save');button.disabled=true;status('',true);
 try{const result=await api('/api/admin/site-design',{method:'POST',body:JSON.stringify({design:project})});project=result.design;renderLayerList();updateControls();renderStage();status('Desain tersimpan dan diterbitkan. Muat ulang website untuk melihat hasilnya.',false);}
 catch(error){status(error.message||'Desain gagal disimpan.',true);}finally{button.disabled=false;}
}
async function uploadImage(){
 const file=$('studio-file').files&&$('studio-file').files[0];if(!file){status('Pilih file gambar terlebih dahulu.',true);return;}
 if(file.size>5*1024*1024){status('Ukuran gambar maksimal 5 MB.',true);return;}
 const button=$('studio-upload');button.disabled=true;
 try{const form=new FormData();form.append('file',file);const result=await api('/api/admin/media',{method:'POST',body:form});await loadMedia();const wallpaper=project.layers.find(x=>x.id==='wallpaper');if(wallpaper&&!wallpaper.src){wallpaper.src=result.asset.url;selectLayer('wallpaper');}else addLayer('image',result.asset.url);$('studio-file').value='';status('Gambar berhasil diunggah dan ditambahkan ke kanvas.',false);}
 catch(error){status(error.message||'Upload gambar gagal.',true);}finally{button.disabled=false;}
}
async function loadMedia(){
 const root=$('studio-media-library');
 try{
  const result=await api('/api/admin/media');assets=result.assets||[];
  $('studio-storage-note').textContent=result.storageReady?'R2 aktif. PNG/JPG/WEBP/GIF/AVIF · maksimal 5 MB.':'Upload menunggu binding Cloudflare R2 bernama MEDIA. URL HTTPS tetap bisa digunakan.';
  root.replaceChildren();
  if(!assets.length){const p=document.createElement('p');p.className='admin-muted';p.textContent=result.storageReady?'Belum ada gambar di pustaka media.':'Pustaka media menunggu koneksi R2.';root.append(p);return;}
  assets.forEach(asset=>{
   const card=document.createElement('article');card.className='studio-media-card';
   const image=document.createElement('img');image.src=asset.url;image.alt='Aset media SLF';image.loading='lazy';
   const meta=document.createElement('small');meta.textContent=asset.key+' · '+Math.max(1,Math.round((asset.size||0)/1024))+' KB';
   const use=document.createElement('button');use.type='button';use.className='btn btn-quiet';use.textContent='Pakai di kanvas';use.addEventListener('click',()=>addLayer('image',asset.url));
   const remove=document.createElement('button');remove.type='button';remove.className='btn btn-quiet';remove.textContent='Hapus';
   remove.addEventListener('click',async()=>{if(!confirm('Hapus gambar dari media? Desain yang memakai file ini akan kehilangan gambar.'))return;remove.disabled=true;try{await api('/api/admin/media?key='+encodeURIComponent(asset.key),{method:'DELETE'});await loadMedia();}catch(error){status(error.message,true);remove.disabled=false;}});
   const wall=document.createElement('button');wall.type='button';wall.className='btn btn-quiet';wall.textContent='Jadikan wallpaper';wall.addEventListener('click',()=>{const layer=project.layers.find(x=>x.id==='wallpaper');if(layer){layer.src=asset.url;selectLayer(layer.id);}else addLayer('image',asset.url);});
   card.append(image,meta,use,wall,remove);root.append(card);
  });
 }catch(error){root.textContent=error.message||'Pustaka media tidak dapat dimuat.';}
}
async function loadStudio(){
 try{
  const result=await api('/api/admin/site-design');project=result.design||defaults();
  selectedId=project.layers.some(x=>x.id==='title-main')?'title-main':(project.layers[0]&&project.layers[0].id);
  renderLayerList();updateControls();renderStage();await loadMedia();
  status('Editor siap. Perubahan masih berupa preview sampai diterbitkan.',false);
 }catch(error){status(error.message,true);}
}
window.SLFStudioLoad=async()=>{if(!isReady){isReady=true;bind();}await loadStudio();};
})();