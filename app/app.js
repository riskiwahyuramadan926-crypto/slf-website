(() => {
'use strict';
const $ = id => document.getElementById(id);
const DB_NAME='slf-mobile-local', DB_VERSION=1, STORE='records';
const PROJECTS_KEY='studio-project-list', SECRET_KEY='slf_admin_secret_session';
const TYPE_META={text:{label:'Teks',icon:'T'},image:{label:'Gambar',icon:'▧'},video:{label:'Video',icon:'▷'},button:{label:'Tombol',icon:'▱'},table:{label:'Tabel',icon:'▦'},card:{label:'Kartu info',icon:'▣'},input:{label:'Input data',icon:'⌨'}};
const PAGE_SEEDS=[
 {name:'Beranda',path:'/',group:'Halaman utama'},
 {name:'Store',path:'/store/',group:'Halaman utama'},
 {name:'Wiki',path:'/wiki/',group:'Halaman utama'},
 {name:'Pusat Bantuan',path:'/bantuan/',group:'Halaman utama'},
 {name:'Status pesanan',path:'/store/order.html',group:'Store'},
 {name:'Ulasan',path:'/store/review.html',group:'Store'},
 {name:'Tiket re-entry',path:'/store/ticket.html',group:'Store'},
 ...[
 ['Aturan Komunitas','aturan-komunitas'],['Aturan Server','aturan-server'],['Bantuan & Laporan','bantuan-laporan'],['Benefit VIP+','benefit-vip'],['Claim Tanah','claim-tanah'],['Dunia SLF','dunia-slf'],['Ekonomi & Pasar','ekonomi-pasar'],['FAQ Teknis','faq-teknis'],['Lapar & Haus','lapar-haus'],['Mulai Bermain','mulai-bermain'],['Nyawa & Re-entry','nyawa-reentry'],['Perjalanan Waystone','perjalanan-waystone'],['PvP & Coliseum','pvp-coliseum'],['Ras & Kemampuan','ras-kemampuan'],['Season & Reset','season-reset'],['Store & Donasi','store-donasi'],['Zona Drakmor','zona-drakmor'],['Zona Elarion','zona-elarion'],['Zona Noxveil','zona-noxveil'],['Zona Veyrwood','zona-veyrwood']
 ].map(([name,slug])=>({name:'Wiki · '+name,path:'/wiki/artikel/'+slug+'.html',group:'Artikel Wiki'}))
];
const ADMIN_GROUPS=[
 {label:'Operasional · Admin dan Owner',items:[
  ['Pesanan & Transaksi','orders','◈'],['Tiket Re-entry','tickets','▣'],['Ulasan','reviews','☆'],['Pelanggan','customers','♙'],['Aktivitas','activity','◷'],['Pusat Bantuan','support','?'],['Pengumuman','announcements','▤'],['Catatan Tim','notes','✎']
 ]},
 {label:'Khusus Owner · Tidak tersedia untuk Admin',owner:true,items:[
  ['Produk','products','◇'],['Promo','promos','％'],['Statistik & Laporan','reports','▥'],['Kas & Keuangan','finance','Rp'],['Editor Website','site-content','✧'],['Perpustakaan Wiki','wiki-manager','▤'],['✦ SLF Studio','studio','✦'],['Akses & Role','access','♛']
 ]}
];
let dbPromise, projects=[], project=null, selectedLayerId=null, activeMode='mobile', savedFingerprint='', dirty=false, role='', toastTimer, backendTables=[];
const uid=()=>globalThis.crypto?.randomUUID?.()||('slf-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8));
function createProject(page,name){return {id:uid(),name:name||page.name,pagePath:page.path||'/',pageGroup:page.group||'Project baru',isDefault:Boolean(page.path),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),layers:[],device:{mobile:{},desktop:{}}};}
function openDb(){if(!('indexedDB'in window))return Promise.reject(new Error('IndexedDB tidak tersedia.'));if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'key'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});return dbPromise;}
async function get(key){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result?.value??null);r.onerror=()=>reject(r.error);});}
async function put(key,value){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({key,value,updatedAt:new Date().toISOString()});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
function fingerprint(value){return JSON.stringify(value);}
function notify(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600);}
function setDirty(){dirty=fingerprint(project)!==savedFingerprint;if(project&&!project.isDefault&&dirty)project.needsExport=true;if(project&&!project.isDefault&&dirty)$('pagePreviewFrame').src='about:blank';$('projectStatus').textContent=dirty?'Ada perubahan belum disimpan':'Draft tersimpan';$('saveProject').classList.toggle('needs-save',dirty);}
function setView(view){document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));const target=view==='home'?'homeView':view==='lobby'?'studioLobby':view==='editor'?'studioView':'moduleView';$(target).classList.add('active');if(view==='home')renderHome();if(view==='lobby')renderLobby();if(view==='editor'){renderLayers();renderPreview();updateModeUi();}history.replaceState({view},'',view==='home'?'./':view==='lobby'?'./#studio':'./#'+view);}
function pageLabel(path){return PAGE_SEEDS.find(p=>p.path===path)?.name||path;}
function renderHome(){
 const root=$('menuGroups');root.replaceChildren();
 ADMIN_GROUPS.forEach(group=>{const section=document.createElement('section');section.className='menu-group'+(group.owner?' owner-menu':'');const title=document.createElement('div');title.className='menu-group-title';title.textContent=group.label;section.append(title);const grid=document.createElement('div');grid.className='module-grid';group.items.forEach(([label,key,icon])=>{const b=document.createElement('button');b.type='button';b.className='module-card'+(group.owner?' owner-card':'');b.innerHTML='<span class="module-icon">'+icon+'</span><span class="module-copy"><b></b><small></small></span><span class="arrow">↗</span>';b.querySelector('b').textContent=label;b.querySelector('small').textContent=group.owner?'Khusus Owner':'Menu Admin Tools';if(group.owner&&role!=='owner')b.classList.add('locked');b.addEventListener('click',()=>openAdminMenu(key,label,group.owner));grid.append(b);});section.append(grid);root.append(section);});
 $('roleLabel').textContent=role?('Akses: '+(role==='owner'?'Owner':'Admin')):'Belum terhubung · masuk Admin';
 $('roleAction').textContent=role?'Keluar':'Masuk Admin';
 $('roleAction').onclick=()=>role?logout():openLogin();
}
function openAdminMenu(key,label,ownerOnly){if(!role){openLogin('Masuk Admin untuk membuka '+label+'.');return;}if(ownerOnly&&role!=='owner'){notify('Menu ini khusus Owner.');return;}if(key==='studio'){setView('lobby');return;}$('moduleTitle').textContent=label;$('moduleSubtitle').textContent=ownerOnly?'Menu khusus Owner · Admin Tools asli':'Operasional · Admin Tools asli';const frame=$('adminFrame');frame.onload=()=>{let attempts=0;const timer=setInterval(()=>{attempts++;try{const doc=frame.contentDocument;const dashboard=doc&&doc.getElementById('dashboard');const tab=doc&&doc.querySelector('[data-tab=\"'+key+'\"]');if(dashboard&&!dashboard.hidden&&tab){tab.click();clearInterval(timer);}else if(attempts>50)clearInterval(timer);}catch(e){clearInterval(timer);}},250);};frame.src='/admin/?mobile_app='+encodeURIComponent(key)+'&v='+Date.now();setView('module');}
function openLogin(message){$('loginModal').hidden=false;$('loginMessage').textContent=message||'Masukkan Gmail dan password akun SLF.';$('adminEmail').focus();}
function closeLogin(){$('loginModal').hidden=true;}
async function auth(){const response=await fetch('/api/admin/me',{credentials:'same-origin',cache:'no-store'});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Sesi belum aktif.');return data;}
async function login(){const email=$('adminEmail').value.trim(),password=$('adminPassword').value,accessCode=$('adminAccessCode').value.trim();if(!email||password.length<12){$('loginMessage').textContent='Isi Gmail dan password minimal 12 karakter.';return;}const btn=$('loginSubmit');btn.disabled=true;btn.textContent='Memeriksa…';try{const response=await fetch('/api/admin/account',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'login',email,password,accessCode})});let data;try{data=await response.json();}catch{throw new Error('Endpoint autentikasi mengirim respons tidak valid (HTTP '+response.status+').');}if(!response.ok)throw new Error(data.error||('Login ditolak oleh server (HTTP '+response.status+').'));if(!data.ok||!['owner','admin'].includes(data.role))throw new Error(data.error||'Respons login tidak lengkap: role akun tidak diterima.');sessionStorage.setItem(SECRET_KEY,'cookie-session');role=data.role; $('adminPassword').value='';$('adminAccessCode').value='';closeLogin();renderHome();notify('Login '+(role==='owner'?'Owner':'Admin')+' berhasil.');}catch(e){const reason=String(e&&e.message?e.message:e||'Kesalahan tidak diketahui');$('loginMessage').textContent=reason==='Failed to fetch'?'Tidak dapat terhubung ke endpoint login. Periksa koneksi internet atau status deployment Preview.':reason.slice(0,320);}finally{btn.disabled=false;btn.textContent='Masuk';}}
async function logout(){try{await fetch('/api/admin/account',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'logout'})});}catch{}sessionStorage.removeItem(SECRET_KEY);role='';renderHome();notify('Sesi aplikasi berakhir.');}
async function loadProjects(){projects=await get(PROJECTS_KEY)||[];if(!Array.isArray(projects))projects=[];const byPath=new Map(projects.filter(p=>p.isDefault).map(p=>[p.pagePath,p]));PAGE_SEEDS.forEach(page=>{if(!byPath.has(page.path))projects.push(createProject(page));});await put(PROJECTS_KEY,projects);renderLobby();}
function renderLobby(){
 const root=$('projectGrid');root.replaceChildren();
 const groups=[...new Set(projects.map(p=>p.pageGroup||'Project baru'))];
 groups.forEach(group=>{const heading=document.createElement('h3');heading.className='project-group-heading';heading.textContent=group;root.append(heading);const grid=document.createElement('div');grid.className='project-grid';projects.filter(p=>(p.pageGroup||'Project baru')===group).forEach(p=>{const card=document.createElement('button');card.type='button';card.className='project-tile';const thumb=document.createElement('div');thumb.className='project-thumb';thumb.innerHTML='<span>✦</span><small></small>';thumb.querySelector('small').textContent=p.pagePath;const info=document.createElement('div');info.className='project-info';const title=document.createElement('b');title.textContent=p.name;const meta=document.createElement('small');meta.textContent=(p.layers?.length||0)+' layer · '+(p.updatedAt?new Date(p.updatedAt).toLocaleDateString('id-ID'):'Halaman bawaan');info.append(title,meta);card.append(thumb,info);card.addEventListener('click',()=>openProject(p.id));grid.append(card);});root.append(grid);});
 $('projectCount').textContent=projects.length+' project';
}
async function openProject(id){project=projects.find(p=>p.id===id);if(!project)return;selectedLayerId=null;activeMode='mobile';savedFingerprint=fingerprint(project);dirty=false;$('editorPageName').textContent=project.name;$('projectStatus').textContent='Draft tersimpan';setView('editor');loadPagePreview();}
async function addProject(){
 const name=prompt('Nama halaman / project baru:','Halaman Baru');if(name===null)return;const clean=name.trim();if(!clean){notify('Nama project wajib diisi.');return;}
 const slug=clean.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48).replace(/-+$/g,'');
 const reserved=new Set(['admin','api','app','assets','bantuan','images','store','wiki','fonts','uploads','robots','favicon','sitemap']);
 if(!slug||reserved.has(slug)||slug.startsWith('slf-')){notify('Nama halaman tidak valid atau memakai alamat khusus website.');return;}
 const path='/'+slug;if(projects.some(item=>item.pagePath===path)){notify('Route '+path+' sudah ada di daftar project.');return;}
 const p=createProject({name:clean,path,group:'Project baru'});p.isDefault=false;p.isPublished=false;p.needsExport=false;projects.unshift(p);await put(PROJECTS_KEY,projects);await openProject(p.id);notify('Halaman '+path+' siap diedit. Simpan lalu Export untuk menerbitkan route.');}

function selectPanel(name){document.querySelectorAll('.editor-tab').forEach(b=>b.classList.toggle('active',b.dataset.panel===name));document.querySelectorAll('.editor-panel').forEach(p=>p.classList.toggle('active',p.id==='panel-'+name));if(name==='backend')loadBackendTables();}
async function loadBackendTables(){
 const root=$('backendTableList');if(!root)return;root.replaceChildren();
 if(role!=='owner'){const note=document.createElement('p');note.className='hint';note.textContent='Backend Builder hanya tersedia untuk Owner.';root.append(note);return;}
 try{const response=await fetch('/api/admin/studio/backend',{credentials:'same-origin',cache:'no-store'}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Gagal memuat tabel.');
  backendTables=Array.isArray(data.tables)?data.tables:[];if(!backendTables.length){const empty=document.createElement('p');empty.className='hint';empty.textContent='Belum ada tabel Studio. Buat tabel pertama di atas.';root.append(empty);return;}
  backendTables.forEach(table=>{const item=document.createElement('div');item.className='backend-table-item';const name=document.createElement('b');name.textContent=table.table_name;const meta=document.createElement('small');meta.textContent=(table.display_name||table.table_name)+' · '+(table.columns?.length||0)+' kolom · tulis publik '+(Number(table.allow_public_write)?'aktif':'nonaktif')+' · baca publik '+(Number(table.allow_public_read)?'aktif':'nonaktif');const use=document.createElement('button');use.type='button';use.className='mini-button';use.textContent='Pakai di Action';use.onclick=()=>{const layer=selectedLayer();if(!layer||layer.type!=='button'){notify('Pilih layer Tombol dahulu.');return;}layer.actionTarget=table.table_name;$('layerActionTarget').value=table.table_name;setDirty();selectPanel('actions');};item.append(name,meta,use);root.append(item);});
 }catch(error){const note=document.createElement('p');note.className='hint';note.textContent=error.message;root.append(note);}
}
async function createBackendTable(){
 if(role!=='owner'){notify('Hanya Owner dapat membuat tabel D1.');return;}
 const slug=$('backendTableName').value.trim(),displayName=$('backendDisplayName').value.trim()||slug;
 let columns;
 try{
  columns=String($('backendColumns').value||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{const [name,type='text',...flags]=line.split(':').map(part=>part.trim());if(flags.some(flag=>!['required','unique'].includes(flag)))throw new Error('Flag kolom hanya boleh required atau unique.');return {name,type,required:flags.includes('required'),unique:flags.includes('unique')};});
 }catch(error){notify(error.message);return;}
 if(!slug||!columns.length){notify('Isi nama tabel dan minimal satu kolom.');return;}
 const btn=$('createBackendTable');btn.disabled=true;btn.textContent='Membuat…';
 try{
  const response=await fetch('/api/admin/studio/backend',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({slug,displayName,columns,allowPublicWrite:$('backendAllowSubmit').checked,allowPublicRead:$('backendAllowRead').checked})});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Gagal membuat tabel.');
  $('backendTableName').value='';$('backendDisplayName').value='';notify('Tabel '+data.table.tableName+' berhasil dibuat.');await loadBackendTables();
 }catch(error){notify(error.message||'Backend Builder gagal.');}
 finally{btn.disabled=false;btn.textContent='Buat Tabel D1';}
}
function selectedLayer(){return project?.layers.find(x=>x.id===selectedLayerId)||null;}
function renderLayers(){const root=$('layerList');root.replaceChildren();$('layerCount').textContent=(project.layers.length)+' layer';if(!project.layers.length){const empty=document.createElement('div');empty.className='empty-card';empty.textContent='Belum ada layer. Tekan + untuk menambahkan elemen.';root.append(empty);}project.layers.slice().reverse().forEach(layer=>{const row=document.createElement('button');row.type='button';row.className='layer-row'+(layer.id===selectedLayerId?' active':'');const icon=document.createElement('span');icon.className='layer-type';icon.textContent=TYPE_META[layer.type]?.icon||'◇';const copy=document.createElement('span');copy.className='layer-label';const name=document.createElement('b');name.textContent=layer.name;const meta=document.createElement('small');meta.textContent=TYPE_META[layer.type]?.label||layer.type;copy.append(name,meta);row.append(icon,copy);row.addEventListener('click',()=>{selectedLayerId=layer.id;renderLayers();renderProperties();renderPreview();selectPanel('properties');});root.append(row);});renderProperties();}
function renderProperties(){
 const root=$('propertyFields');root.replaceChildren();const layer=selectedLayer();$('selectedLayerName').textContent=layer?.name||'Pilih layer untuk mengedit';
 $('animationPreset').value=layer?.animation||'none';$('animationLoop').checked=Boolean(layer?.loop);$('clickAnimation').value=layer?.clickAnimation||'none';$('layerActionType').value=layer?.actionType||'none';$('layerActionTarget').value=layer?.actionTarget||'';$('layerActionType').disabled=layer?.type!=='button';$('layerActionTarget').disabled=layer?.type!=='button';
 if(!layer){const p=document.createElement('p');p.className='muted';p.textContent='Pilih layer terlebih dahulu.';root.append(p);return;}
 const addField=(label,kind,value,handler)=>{const wrap=document.createElement('label');wrap.className='field-label';wrap.textContent=label;const input=document.createElement(kind==='textarea'?'textarea':'input');if(kind!=='textarea')input.type=kind;input.value=value||'';input.addEventListener('input',()=>{handler(input.value);setDirty();renderPreview();});wrap.append(input);root.append(wrap);};
 addField('Nama layer','text',layer.name,v=>layer.name=v);
 if(['text','button','card','table','input'].includes(layer.type))addField(layer.type==='input'?'Label / placeholder':'Isi / konten','textarea',layer.content,v=>layer.content=v);
 if(['image','video'].includes(layer.type))addField('URL media','url',layer.src,v=>layer.src=v);
 if(layer.type==='button')addField('URL tujuan tombol (opsional)','url',layer.href,v=>layer.href=v);
 if(layer.type==='input')addField('Nama field backend','text',layer.fieldName,v=>layer.fieldName=v.trim().toLowerCase());
 if(layer.type==='table')addField('Isi tabel (pisahkan kolom dengan |)','textarea',layer.content,v=>{layer.content=v;layer.rows=v.split('\n').filter(Boolean).map(line=>line.split('|').map(cell=>cell.trim()));});
 const del=document.createElement('button');del.className='mini-button';del.textContent='Hapus layer';del.onclick=()=>{project.layers=project.layers.filter(x=>x.id!==layer.id);selectedLayerId=null;setDirty();renderLayers();renderPreview();};root.append(del);
}

function loadPagePreview(){
 const frame=$('pagePreviewFrame');if(!frame||!project)return;
 if(!project.isDefault){
  const root=$('previewOverlay');
  if(project.isPublished&&!project.needsExport&&!dirty){root.replaceChildren();frame.src=project.pagePath+(project.pagePath.includes('?')?'&':'?')+'v='+Date.now();}
  else{frame.src='about:blank';renderPreview();}
  return;
 }
 frame.src=project.pagePath+(project.pagePath.includes('?')?'&':'?')+'slf_app_preview=1&v='+Date.now();renderPreview();
}

function renderPreview(){
 const root=$('previewOverlay');if(!root||!project)return;root.replaceChildren();
 project.layers.forEach((layer,index)=>{
  const node=document.createElement('div');node.className='preview-layer'+(layer.id===selectedLayerId?' selected':'');node.dataset.layerId=layer.id;node.style.position='absolute';node.style.left='8%';node.style.top=(12+index*15)+'%';node.style.width='84%';
  if(layer.type==='image'&&layer.src){const img=document.createElement('img');img.src=layer.src;img.alt=layer.name;img.style.maxWidth='100%';node.append(img);}
  else if(layer.type==='video'){node.textContent='Video: '+(layer.src||layer.name);}
  else if(layer.type==='button'){const button=document.createElement('button');button.type='button';button.textContent=layer.content||layer.name;node.append(button);}
  else if(layer.type==='table'){const table=document.createElement('table');(layer.rows||[]).forEach((row,i)=>{const tr=document.createElement('tr');row.forEach(cell=>{const td=document.createElement(i===0?'th':'td');td.textContent=cell;tr.append(td);});table.append(tr);});node.append(table);}
  else if(layer.type==='input'){const input=document.createElement('input');input.placeholder=layer.content||layer.fieldName;input.disabled=true;node.append(input);}
  else{node.textContent=layer.content||layer.name;}
  if(layer.loop&&layer.animation!=='none')node.classList.add('anim-'+layer.animation);
  node.onclick=()=>{selectedLayerId=layer.id;renderLayers();renderPreview();selectPanel('properties');};root.append(node);
 });
}

function addLayer(type){
 if(!TYPE_META[type])return;
 const layer={id:uid(),type,name:TYPE_META[type].label+' '+(project.layers.length+1),content:type==='text'?'Teks baru':type==='button'?'Klik di sini':type==='card'?'Informasi baru':type==='input'?'Masukkan data':'',src:'',href:'',fieldName:type==='input'?'field_'+(project.layers.length+1):'',rows:[],actionType:'none',actionTarget:'',animation:'none',clickAnimation:'none',loop:false,duration:900};
 project.layers.push(layer);selectedLayerId=layer.id;setDirty();renderLayers();renderPreview();selectPanel('properties');closeSheet();notify('Layer ditambahkan. Simpan project setelah selesai.');
}

async function saveProject(){if(!project)return;project.updatedAt=new Date().toISOString();const index=projects.findIndex(p=>p.id===project.id);if(index>=0)projects[index]=project;else projects.unshift(project);await put(PROJECTS_KEY,projects);savedFingerprint=fingerprint(project);dirty=false;$('projectStatus').textContent='Tersimpan di perangkat';$('saveProject').classList.remove('needs-save');renderLobby();notify('Project berhasil disimpan di perangkat ini.');}
function updateModeUi(){$('previewSize').textContent=activeMode==='mobile'?'Mobile · 390 px':'Desktop · 900 px';$('previewPage').classList.toggle('desktop-preview',activeMode==='desktop');$('modeMobile').classList.toggle('active',activeMode==='mobile');$('modeDesktop').classList.toggle('active',activeMode==='desktop');}
function switchMode(next){if(next===activeMode)return;if(dirty||fingerprint(project)!==savedFingerprint){notify('Simpan Project terlebih dahulu sebelum mengganti mode.');return;}activeMode=next;updateModeUi();}
async function exportProject(){
 if(!project)return;
 if(dirty||fingerprint(project)!==savedFingerprint){notify('Simpan Project terlebih dahulu sebelum Export.');return;}
 if(!role){openLogin('Login Owner diperlukan untuk Export ke website.');return;}
 if(role!=='owner'){notify('Export website hanya dapat dilakukan Owner.');return;}
 const button=$('exportProject');button.disabled=true;button.textContent='Menerbitkan…';
 try{
  const mapped=project.layers.map(layer=>({
   id:'app-'+project.id+'-'+layer.id,type:layer.type,name:layer.name,content:layer.content||'',src:layer.src||'',href:layer.href||'',fieldName:layer.fieldName||'',
   rows:Array.isArray(layer.rows)&&layer.rows.length?layer.rows:(layer.type==='table'?String(layer.content||'').split('\n').filter(Boolean).map(line=>line.split('|').map(x=>x.trim())):[]),
   action:{type:layer.actionType||'none',target:layer.actionTarget||''},animation:layer.animation||'none',clickAnimation:layer.clickAnimation||'none',loop:Boolean(layer.loop),duration:Number(layer.duration)||900
  }));
  if(!project.isDefault){
   const response=await fetch('/api/admin/studio/pages',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:project.id,routePath:project.pagePath,name:project.name,layers:mapped})});
   const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Gagal menerbitkan halaman baru.');
   project.isPublished=true;project.needsExport=false;project.updatedAt=new Date().toISOString();
   const index=projects.findIndex(p=>p.id===project.id);if(index>=0)projects[index]=project;await put(PROJECTS_KEY,projects);savedFingerprint=fingerprint(project);dirty=false;$('projectStatus').textContent='Route aktif · tersimpan';$('saveProject').classList.remove('needs-save');renderLobby();loadPagePreview();
   notify('Berhasil Export! Halaman aktif di '+result.routePath);return;
  }
  const pageKey=project.pagePath==='/'?'home':project.pagePath==='/store/'?'store':project.pagePath==='/wiki/'?'wiki':project.pagePath==='/bantuan/'?'help':project.pagePath==='/store/order.html'?'order':project.pagePath==='/store/review.html'?'review':project.pagePath==='/store/ticket.html'?'ticket':project.pagePath.startsWith('/wiki/artikel/')?'wiki-'+project.pagePath.split('/').pop().replace('.html',''):'';
  if(!pageKey)throw new Error('Halaman bawaan ini belum memiliki pemetaan route publik.');
  const read=await fetch('/api/admin/site-design',{credentials:'same-origin',cache:'no-store'}),data=await read.json().catch(()=>({}));
  if(!read.ok)throw new Error(data.error||'Gagal membaca desain website.');
  const design=data.design||{version:2,page:'all',accent:'#9b6cff',accent2:'#f3cb82',background:'#100c18',globalFont:'system',overlayColor:'#100c18',overlayOpacity:0,layers:[],freeLayers:[],elementEdits:[],insertedElements:[],appLayers:[]};
  design.appLayers=Array.isArray(design.appLayers)?design.appLayers:[];
  const prefix='app-'+project.id+'-';design.appLayers=design.appLayers.filter(l=>!String(l.id||'').startsWith(prefix));
  design.appLayers.push(...mapped.map(layer=>({...layer,page:pageKey})));
  const write=await fetch('/api/admin/site-design',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({design})});
  const result=await write.json().catch(()=>({}));if(!write.ok)throw new Error(result.error||'Gagal menyimpan desain ke website.');
  notify('Export website berhasil. Layer '+mapped.length+' diterbitkan ke '+project.name+'.');
 }catch(error){notify(error.message||'Export gagal.');}
 finally{button.disabled=false;button.textContent='Export';}
}

function openSheet(){$('addSheet').hidden=false;}function closeSheet(){$('addSheet').hidden=true;}
async function start(){
 try{const data=await auth();sessionStorage.setItem(SECRET_KEY,'cookie-session');role=data.role==='owner'?'owner':'admin';}catch{sessionStorage.removeItem(SECRET_KEY);}
 $('loginButton').onclick=()=>openLogin();$('loginClose').onclick=closeLogin;$('loginSubmit').onclick=login;$('adminPassword').addEventListener('keydown',e=>{if(e.key==='Enter')login();});
 $('moduleBack').onclick=()=>setView('home');$('refreshPreview').onclick=()=>loadPagePreview();$('lobbyBack').onclick=()=>setView('home');$('newProject').onclick=addProject;$('editorBack').onclick=()=>{if(dirty&&!confirm('Perubahan belum disimpan. Keluar dan buang perubahan terakhir?'))return;setView('lobby');};$('saveProject').onclick=saveProject;$('exportProject').onclick=exportProject;
 $('modeMobile').onclick=()=>switchMode('mobile');$('modeDesktop').onclick=()=>switchMode('desktop');
 document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>{const name=b.dataset.open;if(name==='studio')setView('lobby');else if(name==='home')setView('home');else openAdminMenu(name,name,false);}));
 document.querySelectorAll('.editor-tab').forEach(b=>b.addEventListener('click',()=>selectPanel(b.dataset.panel)));$('createBackendTable').onclick=createBackendTable;
 $('floatingAdd').onclick=openSheet;$('addLayerInline').onclick=openSheet;$('closeSheet').onclick=closeSheet;$('addSheet').onclick=e=>{if(e.target===$('addSheet'))closeSheet();};
 document.querySelectorAll('[data-create]').forEach(b=>b.addEventListener('click',()=>addLayer(b.dataset.create)));
 $('animationPreset').onchange=e=>{const l=selectedLayer();if(l){l.animation=e.target.value;setDirty();renderPreview();}};$('animationLoop').onchange=e=>{const l=selectedLayer();if(l){l.loop=e.target.checked;setDirty();renderPreview();}};$('clickAnimation').onchange=e=>{const l=selectedLayer();if(l){l.clickAnimation=e.target.value;setDirty();renderPreview();}};$('layerActionType').onchange=e=>{const l=selectedLayer();if(l){l.actionType=e.target.value;setDirty();}};$('layerActionTarget').oninput=e=>{const l=selectedLayer();if(l){l.actionTarget=e.target.value;setDirty();}};
 document.querySelectorAll('input,textarea,select').forEach(el=>{if(!['adminSecret'].includes(el.id)&&el.closest('#propertyFields'))return;});
 window.addEventListener('online',()=>{$('connectionState').textContent='Online';});window.addEventListener('offline',()=>{$('connectionState').textContent='Offline';});
 if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});
 await loadProjects();renderHome();if(location.hash==='#studio')setView('lobby');
}
document.addEventListener('DOMContentLoaded',start);
})();