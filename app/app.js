(() => {
'use strict';
const $ = id => document.getElementById(id);
const DB_NAME='slf-mobile-local', DB_VERSION=1, STORE='records';
const PROJECTS_KEY='studio-project-list', SECRET_KEY='slf_admin_secret_session';
const TYPE_META={text:{label:'Teks',icon:'T'},image:{label:'Gambar',icon:'▧'},video:{label:'Video',icon:'▷'},audio:{label:'Audio',icon:'♫'},shape:{label:'Bentuk',icon:'◯'},rect:{label:'Persegi',icon:'▭'},button:{label:'Tombol',icon:'▱'},table:{label:'Tabel',icon:'▦'},card:{label:'Kartu info',icon:'▣'},input:{label:'Input data',icon:'⌨'}};
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
let dbPromise, projects=[], project=null, selectedLayerId=null, selectedLayerIds=new Set(), activeMode='mobile', savedFingerprint='', dirty=false, role='', toastTimer, backendTables=[], outlineItems=[], selectedElement=null, siteDesign=null, layerClipboard=null, elementUndo=[], elementRedo=[], editorZoom=100, editorGrid=false, editorLocked=false, addTab='shape', currentTimeMs=0, timelinePlaying=false, timelineFrame=0,mobileEditorPanel='',mobileTransformTab='position',mobileBorderTab='stroke';
const uid=()=>globalThis.crypto?.randomUUID?.()||('slf-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8));
function createProject(page,name){return {id:uid(),name:name||page.name,pagePath:page.path||'/',pageGroup:page.group||'Project baru',isDefault:Boolean(page.path),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),aspectRatio:page.ratio||'9:16',resolution:page.resolution||'1080p',fps:Number(page.fps)||30,background:page.background||'black',wallpaper:'',layers:[],device:{mobile:{},desktop:{}}};}
function openDb(){if(!('indexedDB'in window))return Promise.reject(new Error('IndexedDB tidak tersedia.'));if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'key'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});return dbPromise;}
async function get(key){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result?.value??null);r.onerror=()=>reject(r.error);});}
async function put(key,value){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({key,value,updatedAt:new Date().toISOString()});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
function fingerprint(value){return JSON.stringify(value);}
function notify(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600);}
function setDirty(){dirty=fingerprint(project)!==savedFingerprint;if(project&&!project.isDefault&&dirty)project.needsExport=true;if(project&&!project.isDefault&&dirty)$('pagePreviewFrame').src='about:blank';$('projectStatus').textContent=dirty?'Ada perubahan belum disimpan':'Draft tersimpan';$('saveProject').classList.toggle('needs-save',dirty);}
function setView(view){document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));const target=view==='home'?'homeView':view==='lobby'?'studioLobby':view==='editor'?'studioView':'moduleView';$(target).classList.add('active');const appHeader=document.querySelector('.app-shell>.topbar');if(appHeader)appHeader.hidden=view!=='home';if(view==='home')renderHome();if(view==='lobby')renderLobby();if(view==='editor'){renderLayers();renderPreview();updateModeUi();}history.replaceState({view},'',view==='home'?'./':view==='lobby'?'./#studio':'./#'+view);}
function pageLabel(path){return PAGE_SEEDS.find(p=>p.path===path)?.name||path;}
function renderHome(){
 const root=$('menuGroups');root.replaceChildren();
 ADMIN_GROUPS.forEach(group=>{const section=document.createElement('section');section.className='menu-group'+(group.owner?' owner-menu':'');const title=document.createElement('div');title.className='menu-group-title';title.textContent=group.label;section.append(title);const grid=document.createElement('div');grid.className='module-grid';group.items.forEach(([label,key,icon])=>{const b=document.createElement('button');b.type='button';b.className='module-card'+(group.owner?' owner-card':'');b.innerHTML='<span class="module-icon">'+icon+'</span><span class="module-copy"><b></b><small></small></span><span class="arrow">↗</span>';b.querySelector('b').textContent=label;b.querySelector('small').textContent=group.owner?'Khusus Owner':'Menu Admin Tools';if(group.owner&&role!=='owner')b.classList.add('locked');b.addEventListener('click',()=>openAdminMenu(key,label,group.owner));grid.append(b);});section.append(grid);root.append(section);});
 $('roleLabel').textContent=role?('Akses: '+(role==='owner'?'Owner':'Admin')):'Belum terhubung · masuk Admin';
 $('roleAction').textContent=role?'Keluar':'Masuk Admin';
 $('roleAction').onclick=()=>role?logout():openLogin();
}
function openAdminMenu(key,label,ownerOnly){if(!role){openLogin('Masuk Admin untuk membuka '+label+'.');return;}if(ownerOnly&&role!=='owner'){notify('Menu ini khusus Owner.');return;}if(key==='studio'){setView('lobby');return;}$('moduleTitle').textContent=label;$('moduleSubtitle').textContent=ownerOnly?'Menu khusus Owner':'Panel '+label;$('adminFrame').onload=null;$('adminFrame').src='/admin/?mobile_app='+encodeURIComponent(key)+'&v='+Date.now();setView('module');}
function openLogin(message){$('loginModal').hidden=false;$('loginMessage').textContent=message||'Masukkan Gmail dan password akun SLF.';$('adminEmail').focus();}
function closeLogin(){$('loginModal').hidden=true;}
async function auth(){const response=await fetch('/api/admin/me',{credentials:'same-origin',cache:'no-store'});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Sesi belum aktif.');return data;}
const normalizeLoginEmail = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
const validLoginEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
async function login(){
 const emailField=$('adminEmail');
 if(!emailField){$('loginMessage').textContent='Kolom email tidak ditemukan. Periksa elemen #adminEmail pada app/index.html.';return;}
 const email=normalizeLoginEmail(emailField.value),password=$('adminPassword').value,accessCode=$('adminAccessCode').value.trim();
 if(!validLoginEmail(email)){$('loginMessage').textContent='Format email tidak valid. Periksa alamat email yang dimasukkan.';return;}
 if(password.length<12){$('loginMessage').textContent='Password harus minimal 12 karakter.';return;}
 emailField.value=email;
 const btn=$('loginSubmit');btn.disabled=true;btn.textContent='Memeriksa…';
 try{
  const response=await fetch('/api/admin/account',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'login',email,password,accessCode})});
  let data;
  try{data=await response.json();}catch{throw new Error('Endpoint autentikasi mengirim respons tidak valid (HTTP '+response.status+').');}
  if(!response.ok)throw new Error(data.error||('Login ditolak oleh server (HTTP '+response.status+').'));
  if(!data.ok||!['owner','admin'].includes(data.role))throw new Error(data.error||'Respons login tidak lengkap: role akun tidak diterima.');
  sessionStorage.setItem(SECRET_KEY,'cookie-session');role=data.role;$('adminPassword').value='';$('adminAccessCode').value='';closeLogin();renderHome();notify('Login '+(role==='owner'?'Owner':'Admin')+' berhasil.');
 }catch(e){
  const reason=String(e&&e.message?e.message:e||'Kesalahan tidak diketahui');
  $('loginMessage').textContent=reason==='Failed to fetch'?'Tidak dapat terhubung ke endpoint login. Periksa koneksi internet atau status deployment Preview.':reason.slice(0,320);
 }finally{btn.disabled=false;btn.textContent='Masuk';}
}
async function logout(){try{await fetch('/api/admin/account',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'logout'})});}catch{}sessionStorage.removeItem(SECRET_KEY);role='';renderHome();notify('Sesi aplikasi berakhir.');}
async function loadProjects(){projects=await get(PROJECTS_KEY)||[];if(!Array.isArray(projects))projects=[];const byPath=new Map(projects.filter(p=>p.isDefault).map(p=>[p.pagePath,p]));PAGE_SEEDS.forEach(page=>{if(!byPath.has(page.path))projects.push(createProject(page));});await put(PROJECTS_KEY,projects);renderLobby();}
function renderLobby(){
 const root=$('projectGrid');root.replaceChildren();
 const create=document.createElement('button');create.type='button';create.className='project-create-card';create.innerHTML='<span>＋</span><b>Buat Proyek Baru</b>';create.addEventListener('click',()=>openProjectModal('create'));root.append(create);
 const groups=[...new Set(projects.map(p=>p.pageGroup||'Proyek Baru'))];
 groups.forEach(group=>{const heading=document.createElement('h3');heading.className='project-group-heading';heading.textContent=group;root.append(heading);const grid=document.createElement('div');grid.className='project-grid';
  projects.filter(p=>(p.pageGroup||'Proyek Baru')===group).forEach(p=>{const card=document.createElement('button');card.type='button';card.className='project-tile';const thumb=document.createElement('div');thumb.className='project-thumb';thumb.style.background=p.background==='light'?'linear-gradient(145deg,#dce5ef,#fff)':p.background==='transparent'?'repeating-conic-gradient(#30384c 0 25%,#202638 0 50%) 0/16px 16px':'linear-gradient(145deg,#18243a,#080d17)';const preview=document.createElement('span');preview.textContent=p.isDefault?'SLF':(p.name||'SLF').slice(0,18);thumb.append(preview);const ratio=document.createElement('small');ratio.className='project-ratio';ratio.textContent=p.aspectRatio||'9:16';thumb.append(ratio);const info=document.createElement('div');info.className='project-info';const title=document.createElement('b');title.textContent=p.name;const meta=document.createElement('small');meta.textContent=(p.aspectRatio||'9:16')+' · '+(p.resolution||'1080p')+' · '+(p.fps||30)+' fps · '+(p.layers?.length||0)+' layer';info.append(title,meta);card.append(thumb,info);card.addEventListener('click',()=>openProject(p.id));grid.append(card);});root.append(grid);
 });$('projectCount').textContent=projects.length+' proyek';
}
async function openProject(id){project=projects.find(p=>p.id===id);if(!project)return;selectedLayerId=null;selectedLayerIds.clear();selectedElement=null;outlineItems=[];activeMode='mobile';currentTimeMs=0;await loadDraftFromD1(id);savedFingerprint=fingerprint(project);dirty=false;$('editorPageName').textContent=project.name;$('projectStatus').textContent='Draft tersimpan';$('projectModal').hidden=true;siteDesign=project.designDraft||null;setView('editor');applyCanvasSettings();await loadSiteDesign();loadPagePreview();}
function openProjectModal(mode='create'){
 $('projectModalTitle').textContent=mode==='settings'?'Pengaturan Proyek':'Buat Proyek Baru';$('projectModalCreate').textContent=mode==='settings'?'Simpan Pengaturan':'Buat Proyek';$('projectModalError').textContent='';$('projectModal').dataset.mode=mode;
 if(mode==='settings'&&project){$('projectName').value=project.name;$('projectRatio').value=project.aspectRatio||'9:16';$('projectResolution').value=project.resolution||'1080p';$('projectFps').value=String(project.fps||30);$('projectBackground').value=project.background||'black';}
 else{$('projectName').value='Proyek Baru';$('projectRatio').value='9:16';$('projectResolution').value='1080p';$('projectFps').value='30';$('projectBackground').value='black';$('projectCreateD1').checked=false;$('projectD1Fields').hidden=true;}
 $('projectWallpaperField').hidden=$('projectBackground').value!=='image';$('projectModal').hidden=false;
}
function closeProjectModal(){$('projectModal').hidden=true;}
async function uploadAsset(file){if(!file)throw new Error('Pilih file dari perangkat.');const form=new FormData();form.append('file',file,file.name);const response=await fetch('/api/admin/media',{method:'POST',credentials:'same-origin',body:form});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Upload media gagal.');return result.asset;}
async function addProject(){openProjectModal('create');}
async function submitProjectModal(){
 const error=$('projectModalError'),button=$('projectModalCreate'),mode=$('projectModal').dataset.mode||'create',name=$('projectName').value.trim();if(name.length<2){error.textContent='Nama proyek minimal 2 karakter.';return;}
 button.disabled=true;button.textContent=mode==='settings'?'Menyimpan…':'Membuat…';error.textContent='';
 try{
  const ratio=$('projectRatio').value,resolution=$('projectResolution').value,fps=Number($('projectFps').value),background=$('projectBackground').value;
  if(mode==='settings'&&project){project.name=name;project.aspectRatio=ratio;project.resolution=resolution;project.fps=fps;project.background=background;const file=$('projectWallpaper').files?.[0];if(background==='image'&&file)project.wallpaper=(await uploadAsset(file)).url;project.updatedAt=new Date().toISOString();applyCanvasSettings();setDirty();await saveProject();closeProjectModal();return;}
  const slug=name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48).replace(/-+$/g,'');const reserved=new Set(['admin','api','app','assets','bantuan','images','store','wiki','fonts','uploads','robots','favicon','sitemap']);if(!slug||reserved.has(slug)||slug.startsWith('slf-'))throw new Error('Nama proyek tidak valid atau memakai alamat khusus website.');const path='/'+slug;if(projects.some(x=>x.pagePath===path))throw new Error('Route '+path+' sudah ada.');
  const p=createProject({name,path,group:'Proyek Baru',ratio,resolution,fps,background});p.isDefault=false;p.isPublished=false;p.needsExport=false;if(background==='image'){const file=$('projectWallpaper').files?.[0];if(!file)throw new Error('Pilih gambar untuk wallpaper proyek.');p.wallpaper=(await uploadAsset(file)).url;}projects.unshift(p);await put(PROJECTS_KEY,projects);await openProject(p.id);
  if($('projectCreateD1').checked){if(role!=='owner')throw new Error('Pembuatan tabel D1 hanya tersedia untuk Owner.');const slugTable=$('projectD1Name').value.trim()||('project_'+slug.replace(/-/g,'_')).slice(0,32);const columns=String($('projectD1Columns').value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(line=>{const [n,type='text',...flags]=line.split(':').map(x=>x.trim());if(flags.some(x=>!['required','unique'].includes(x)))throw new Error('Flag kolom hanya boleh required atau unique.');return {name:n,type,required:flags.includes('required'),unique:flags.includes('unique')};});const res=await fetch('/api/admin/studio/backend',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({slug:slugTable,displayName:name+' · Backend',columns,allowPublicWrite:false,allowPublicRead:false})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error('Proyek dibuat, tetapi tabel D1 gagal dibuat: '+(data.error||'permintaan gagal'));notify('Proyek dan tabel '+data.table.tableName+' berhasil dibuat.');}else notify('Proyek '+name+' dibuat. Gunakan tombol + untuk menambah elemen.');closeProjectModal();
 }catch(err){error.textContent=err.message||'Proyek tidak dapat dibuat.';}
 finally{button.disabled=false;button.textContent=mode==='settings'?'Simpan Pengaturan':'Buat Proyek';}
}

function selectPanel(name){const view=$('studioView');const hasSelection=Boolean(selectedLayer()||selectedElement);if(name==='layers'||(name!=='backend'&&!hasSelection)){view.classList.remove('has-selection');name='layers';}else view.classList.add('has-selection');document.querySelectorAll('.editor-tab').forEach(b=>b.classList.toggle('active',b.dataset.panel===name));document.querySelectorAll('.editor-panel').forEach(p=>p.classList.toggle('active',p.id==='panel-'+name));if(name==='backend')loadBackendTables();}
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
function getActiveProjectLayers(){return project?.isDefault?(outlineItems||[]):(project?.layers||[]);}
function renderLayers(){
 const root=$('layerList');root.replaceChildren();const layers=getActiveProjectLayers();$('layerCount').textContent=layers.length+' layer';
 if(!layers.length){const empty=document.createElement('div');empty.className='empty-card';empty.textContent=project?.isDefault?'Memuat elemen halaman…':'Belum ada layer. Tekan + untuk menambahkan elemen.';root.append(empty);}
 layers.forEach((layer,index)=>{const row=document.createElement('button');row.type='button';const id=layer.id||layer.selector;row.className='layer-row'+((project?.isDefault?selectedElement?.selector===layer.selector:selectedLayerId===id)?' active':'')+(!project?.isDefault&&selectedLayerIds.has(id)?' multi-selected':'');const icon=document.createElement('span');icon.className='layer-type';icon.textContent=project?.isDefault?(layer.tag==='img'?'▧':layer.tag==='button'?'▱':'T'):(TYPE_META[layer.type]?.icon||'◇');const copy=document.createElement('span');copy.className='layer-label';const name=document.createElement('b');name.textContent=layer.name||layer.label||layer.tag||'Layer';const meta=document.createElement('small');meta.textContent=project?.isDefault?String(layer.tag||'elemen').toUpperCase():(TYPE_META[layer.type]?.label||layer.type);copy.append(name,meta);row.append(icon,copy);row.addEventListener('click',event=>{if(project?.isDefault)sendStudioMessage({type:'slf-studio-select-target',selector:layer.selector});else{if(event.shiftKey){if(selectedLayerIds.has(id))selectedLayerIds.delete(id);else selectedLayerIds.add(id);}else{selectedLayerIds.clear();selectedLayerIds.add(id);}selectedLayerId=id;renderLayers();renderProperties();renderPreview();selectPanel('properties');}});root.append(row);});renderTimeline();renderProperties();
}
function advancedValue(activeElement,selected,key,fallback=0){if(activeElement){const edit=getElementEdit()||{};return edit.styles?.[key]??fallback;}return selected?.[key]??selected?.visual?.[key]??selected?.styles?.[key]??fallback;}
function appendAdvancedControls(root,addField,activeElement,selected){const setStyle=(key,value)=>{if(activeElement)changeElement(x=>{x.styles={...(x.styles||{}),[key]:value};});else{selected[key]=value;setDirty();renderPreview();}};const setVisual=(key,value)=>{if(activeElement)changeElement(x=>{x.styles={...(x.styles||{}),[key]:value};});else{selected.visual={...(selected.visual||{}),[key]:value};setDirty();renderPreview();}};const group=name=>{const box=document.createElement('section');box.className='property-group';const title=document.createElement('b');title.className='property-group-title';title.textContent=name;box.append(title);root.append(box);return box;};const field=(container,...args)=>{const input=addField(...args);container.append(root.lastElementChild);if(args[1]==='range'){const bounds={'Rotasi (°)':[-180,180,1],'Skala X':[.1,4,.05],'Skala Y':[.1,4,.05],'Skew X (°)':[-45,45,1],'Skew Y (°)':[-45,45,1],'Opacity (%)':[0,100,1],'Blur shadow':[0,120,1],'Shadow X':[-120,120,1],'Shadow Y':[-120,120,1]}[args[0]]||[0,100,1];input.min=bounds[0];input.max=bounds[1];input.step=bounds[2];}};let target=group('TRANSFORMASI');for(const [key,label] of [['rotation','Rotasi (°)'],['scaleX','Skala X'],['scaleY','Skala Y'],['skewX','Skew X (°)'],['skewY','Skew Y (°)']])field(target,label,'range',advancedValue(activeElement,selected,key,key.startsWith('scale')?1:0),v=>setStyle(key,Number(v)));field(target,'Opacity (%)','range',advancedValue(activeElement,selected,'opacity',1)*100,v=>setStyle('opacity',Number(v)/100));target=group('FILL / GRADIENT');const grad=activeElement?(getElementEdit()?.styles?.gradient||{}):(selected.visual?.gradient||{});field(target,'Warna isi','color',advancedValue(activeElement,selected,'backgroundColor','#182236'),v=>setVisual('backgroundColor',v));field(target,'Gradient awal','color',grad.stops?.[0]?.color||'#4dd0c8',v=>setVisual('gradient',{type:'linear',angle:Number(grad.angle??135),stops:[{color:v,position:0},{color:grad.stops?.[1]?.color||'#7558d6',position:100}]}));field(target,'Gradient akhir','color',grad.stops?.[1]?.color||'#7558d6',v=>setVisual('gradient',{type:'linear',angle:Number(grad.angle??135),stops:[{color:grad.stops?.[0]?.color||'#4dd0c8',position:0},{color:v,position:100}]}));field(target,'Sudut gradient','number',grad.angle??135,v=>setVisual('gradient',{type:'linear',angle:Math.max(0,Math.min(360,Number(v)||0)),stops:grad.stops||[{color:'#4dd0c8',position:0},{color:'#7558d6',position:100}]}));target=group('BORDER / SHADOW');field(target,'Warna border','color',advancedValue(activeElement,selected,'borderColor','#4dd0c8'),v=>setVisual('borderColor',v));field(target,'Tebal border (px)','number',advancedValue(activeElement,selected,'borderWidth',0),v=>setVisual('borderWidth',Number(v)));field(target,'Radius (px)','number',advancedValue(activeElement,selected,'borderRadius',8),v=>setVisual('borderRadius',Number(v)));field(target,'Warna shadow','color',advancedValue(activeElement,selected,'shadowColor','#000000'),v=>setVisual('shadowColor',v));field(target,'Blur shadow','range',advancedValue(activeElement,selected,'shadowBlur',0),v=>setVisual('shadowBlur',Number(v)));field(target,'Shadow X','range',advancedValue(activeElement,selected,'shadowX',0),v=>setVisual('shadowX',Number(v)));field(target,'Shadow Y','range',advancedValue(activeElement,selected,'shadowY',6),v=>setVisual('shadowY',Number(v)));target=group('EFFECTS');const effects=['glass','glow','float','pulse','gradient','hover','outline','neon','shine','tilt','soft','border-glow'],activeEffects=activeElement?(getElementEdit()?.effects||[]):(selected.visual?.effects||[]);effects.forEach(effect=>{const label=document.createElement('label');label.className='switch-row';const span=document.createElement('span');span.textContent=effect;const input=document.createElement('input');input.type='checkbox';input.checked=activeEffects.includes(effect);input.onchange=()=>{const next=input.checked?[...new Set([...activeEffects,effect])]:activeEffects.filter(x=>x!==effect);if(activeElement)changeElement(x=>x.effects=next);else{selected.visual={...(selected.visual||{}),effects:next};setDirty();renderPreview();}};label.append(span,input);target.append(label);});target=group('KEYFRAME / EASING');const easing=document.createElement('select');['linear','ease','ease-in','ease-out','ease-in-out'].forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;easing.append(o);});easing.value=activeElement?(getElementEdit()?.easing||'ease'):(selected.easing||'ease');easing.onchange=()=>{if(activeElement)changeElement(x=>x.easing=easing.value);else{selected.easing=easing.value;setDirty();}};const label=document.createElement('label');label.className='field-label';label.textContent='Kurva easing';label.append(easing);target.append(label);const addKey=document.createElement('button');addKey.type='button';addKey.className='mini-button';addKey.textContent='◇ Tambah Keyframe · '+Math.round(currentTimeMs)+' ms';addKey.onclick=()=>{pushEditorHistory();const frame={id:uid(),time:currentTimeMs,easing:easing.value,x:Number(selected?.x||0),y:Number(selected?.y||0),rotation:Number(advancedValue(activeElement,selected,'rotation',0)),scaleX:Number(advancedValue(activeElement,selected,'scaleX',1)),scaleY:Number(advancedValue(activeElement,selected,'scaleY',1)),skewX:Number(advancedValue(activeElement,selected,'skewX',0)),skewY:Number(advancedValue(activeElement,selected,'skewY',0)),opacity:Number(advancedValue(activeElement,selected,'opacity',1))};if(activeElement)changeElement(x=>{x.keyframes=[...(x.keyframes||[]).filter(k=>k.time!==currentTimeMs),frame].sort((x,y)=>x.time-y.time);});else{selected.keyframes=[...(selected.keyframes||[]).filter(k=>k.time!==currentTimeMs),frame].sort((x,y)=>x.time-y.time);setDirty();renderPreview();}renderTimeline();};target.append(addKey);const list=document.createElement('div');list.className='keyframe-list';const frames=activeElement?(getElementEdit()?.keyframes||[]):(selected.keyframes||[]);frames.forEach(frame=>{const b=document.createElement('button');b.type='button';b.className='keyframe-chip';b.textContent='◆ '+Math.round(frame.time)+'ms';b.onclick=()=>{currentTimeMs=frame.time;updateTimecode();};list.append(b);});target.append(list);}
function updateTimecode(){const seconds=Math.floor(currentTimeMs/1000),ms=Math.floor((currentTimeMs%1000)/10),value=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0')+':'+String(ms).padStart(2,'0');if($('actionTimecode'))$('actionTimecode').textContent=value;if($('timelineScrubber'))$('timelineScrubber').value=String(currentTimeMs);const viewport=$('timelineTrackViewport'),playhead=viewport?.querySelector('.timeline-playhead');if(viewport&&playhead)playhead.style.left=(92+Math.max(0,Math.min(1,currentTimeMs/10000))*Math.max(0,viewport.clientWidth-105))+'px';}
function selectedLayers(){return (project?.layers||[]).filter(layer=>selectedLayerIds.has(layer.id)||layer.id===selectedLayerId);}
function runTimelineAction(action){const layers=selectedLayers();if(!layers.length){notify('Pilih layer terlebih dahulu.');return;}if(action==='mask'&&layers.length<2){notify('Pilih dua layer: sumber mask dan layer target.');return;}pushEditorHistory();if(action==='group'){const id='group-'+uid();layers.forEach(layer=>layer.groupId=id);notify('Layer dikelompokkan.');}else if(action==='mask'){layers.slice(1).forEach(layer=>layer.maskWith=layers[0].id);notify('Mask diterapkan dari layer pertama.');}else if(action==='delete'){const ids=new Set(layers.map(x=>x.id));project.layers=project.layers.filter(x=>!ids.has(x.id));selectedLayerId=null;selectedLayerIds.clear();notify('Layer terpilih dihapus.');}else if(action==='trim'){layers.forEach(layer=>{const end=Number(layer.startTime||0)+Number(layer.duration||9000);layer.startTime=currentTimeMs;layer.duration=Math.max(100,end-currentTimeMs);});notify('Layer dipangkas dari playhead.');}else if(action==='split'){layers.forEach(layer=>{const start=Number(layer.startTime||0),end=start+Number(layer.duration||9000);if(currentTimeMs<=start||currentTimeMs>=end)return;const copy=JSON.parse(JSON.stringify(layer));copy.id=uid();copy.name=(copy.name||'Layer')+' · Split';copy.startTime=currentTimeMs;copy.duration=end-currentTimeMs;layer.duration=currentTimeMs-start;project.layers.push(copy);});notify('Layer dipisah pada playhead.');}else if(action==='align'){const x=Math.min(...layers.map(x=>Number(x.x||0)));layers.forEach(layer=>layer.x=x);notify('Layer disejajarkan ke kiri.');}setDirty();renderLayers();renderPreview();}

function renderTimeline(){const root=$('timelineTracks');if(!root)return;root.replaceChildren();getActiveProjectLayers().slice(0,24).forEach(layer=>{const id=layer.id||layer.selector,active=project?.isDefault?selectedElement?.selector===layer.selector:selectedLayerIds.has(id)||selectedLayerId===id,b=document.createElement('button');b.type='button';b.dataset.id=id;b.dataset.type=layer.type||layer.tag||'text';b.className='timeline-track'+(active?' active':'');b.draggable=!project?.isDefault;const eye=document.createElement('span');eye.className='track-eye';eye.textContent='◉';eye.title='Tampilkan / sembunyikan';if(!project?.isDefault)eye.onclick=e=>{e.stopPropagation();layer.visible=layer.visible===false;setDirty();renderPreview();renderTimeline();};const name=document.createElement('span');name.className='track-name';name.textContent=String(layer.name||layer.label||layer.type||layer.tag||'Layer').slice(0,36);const diamonds=document.createElement('span');diamonds.className='track-diamonds';const frames=project?.isDefault?(getElementEdit()?.keyframes||[]):(layer.keyframes||[]);diamonds.textContent=frames.length?'◆'.repeat(Math.min(8,frames.length)):'';const handle=document.createElement('span');handle.className='track-handle';handle.textContent='⠿';b.append(eye,name,diamonds,handle);b.onclick=e=>{if(project?.isDefault)sendStudioMessage({type:'slf-studio-select-target',selector:layer.selector});else{if(e.shiftKey){if(selectedLayerIds.has(id))selectedLayerIds.delete(id);else selectedLayerIds.add(id);}else{selectedLayerIds.clear();selectedLayerIds.add(id);}selectedLayerId=id;renderLayers();renderPreview();selectPanel('properties');}};b.ondragstart=e=>e.dataTransfer.setData('text/plain',id);b.ondragover=e=>e.preventDefault();b.ondrop=e=>{e.preventDefault();const from=e.dataTransfer.getData('text/plain'),arr=project.layers,fi=arr.findIndex(x=>x.id===from),ti=arr.findIndex(x=>x.id===id);if(fi<0||ti<0||fi===ti)return;const [item]=arr.splice(fi,1);arr.splice(ti,0,item);setDirty();renderLayers();renderPreview();};root.append(b);});updateTimecode();}
function renderProperties(){
 const root=$('propertyFields');root.replaceChildren();$('selectedLayerName').textContent=selectedElement?.label||selectedLayer()?.name||'Pilih layer untuk mengedit';const activeElement=Boolean(project?.isDefault&&selectedElement);
 const selected=selectedLayer();$('animationPreset').value=selected?.animation||'none';$('animationLoop').checked=Boolean(selected?.loop);$('clickAnimation').value=selected?.clickAnimation||'none';$('layerActionType').value=selected?.actionType||'none';$('layerActionTarget').value=selected?.actionTarget||'';$('layerActionType').disabled=activeElement||selected?.type!=='button';$('layerActionTarget').disabled=activeElement||selected?.type!=='button';
 const addField=(label,kind,value,handler)=>{const wrap=document.createElement('label');wrap.className='field-label';wrap.textContent=label;const input=document.createElement(kind==='textarea'?'textarea':'input');if(kind!=='textarea')input.type=kind;input.value=value??'';input.addEventListener('focus',pushEditorHistory);input.addEventListener('input',()=>{handler(input.value);if(!activeElement){setDirty();renderPreview();}});wrap.append(input);root.append(wrap);return input;};
 if(activeElement){const edit=getElementEdit()||{};if(selectedElement.textEditable)addField('Isi teks','textarea',edit.text??selectedElement.text,v=>changeElement(x=>x.text=v));if(['img','video','audio'].includes(selectedElement.tag)||selectedElement.backgroundImage)addField('Sumber media / Wallpaper','url',edit.src??selectedElement.src,v=>changeElement(x=>{x.src=v;x.backgroundImage=selectedElement.tag!=='img'&&selectedElement.tag!=='video'&&selectedElement.tag!=='audio';}));if(selectedElement.tag==='a')addField('Tautan','url',edit.href??selectedElement.href,v=>changeElement(x=>x.href=v));
 if(['img','video','audio'].includes(selectedElement.tag)||selectedElement.backgroundImage||['main','body'].includes(selectedElement.tag)){const upload=document.createElement('button');upload.type='button';upload.className='mini-button';upload.textContent='Upload dari Galeri / Penyimpanan';upload.addEventListener('click',()=>selectedElement.tag==='audio'?$('studioAudioFile').click():$('studioMediaFile').click());root.append(upload);}addField('Warna teks','color',edit.styles?.color||selectedElement.computed?.color||'#ffffff',v=>changeElement(x=>{x.styles={...(x.styles||{}),color:v};}));addField('Warna latar','color',edit.styles?.backgroundColor||selectedElement.computed?.backgroundColor||'#101827',v=>changeElement(x=>{x.styles={...(x.styles||{}),backgroundColor:v};}));addField('Ukuran teks (px)','number',edit.styles?.fontSize||selectedElement.computed?.fontSize||16,v=>changeElement(x=>{x.styles={...(x.styles||{}),fontSize:Number(v)};}));addField('Geser X (px)','range',edit.styles?.translateX??selectedElement.computed?.translateX??0,v=>changeElement(x=>{x.styles={...(x.styles||{}),translateX:Number(v)};}));addField('Geser Y (px)','range',edit.styles?.translateY??selectedElement.computed?.translateY??0,v=>changeElement(x=>{x.styles={...(x.styles||{}),translateY:Number(v)};}));appendAdvancedControls(root,addField,true,null);const hide=document.createElement('button');hide.type='button';hide.className='mini-button';hide.textContent=selectedElement.created?'Hapus elemen':edit.hidden?'Tampilkan elemen':'Sembunyikan elemen';hide.addEventListener('click',()=>{pushEditorHistory();if(selectedElement.created&&selectedElement.id){sendStudioMessage({type:'slf-studio-remove',id:selectedElement.id});selectedElement=null;}else changeElement(x=>x.hidden=!x.hidden);setDirty();renderLayers();});root.append(hide);const note=document.createElement('p');note.className='muted';note.textContent='Elemen dipilih langsung dari halaman asli. Perubahan tersimpan sebagai draft hingga tombol Export ditekan.';root.append(note);return;}
 if(!selected){const p=document.createElement('p');p.className='muted';p.textContent='Sentuh elemen langsung di kanvas atau pilih layer pada daftar.';root.append(p);return;}
 addField('Nama layer','text',selected.name,v=>selected.name=v);if(['image','video','audio'].includes(selected.type)){const upload=document.createElement('button');upload.type='button';upload.className='mini-button';upload.textContent='Ganti file dari Galeri';upload.addEventListener('click',()=>selected.type==='audio'?$('studioAudioFile').click():$('studioMediaFile').click());root.append(upload);}if(['text','button','card','table','input','shape','rect'].includes(selected.type))addField('Isi / konten','textarea',selected.content,v=>selected.content=v);if(['image','video','audio'].includes(selected.type))addField('Sumber media','url',selected.src,v=>selected.src=v);if(selected.type==='button')addField('URL tujuan tombol','url',selected.href,v=>selected.href=v);if(selected.type==='input')addField('Nama field backend','text',selected.fieldName,v=>selected.fieldName=v.trim().toLowerCase());if(selected.type==='table')addField('Isi tabel (kolom dipisah |)','textarea',selected.content,v=>{selected.content=v;selected.rows=v.split('\n').filter(Boolean).map(line=>line.split('|').map(cell=>cell.trim()));});for(const [key,label] of [['x','Posisi X (%)'],['y','Posisi Y (%)'],['width','Lebar (%)'],['height','Tinggi (%)']])addField(label,'number',selected[key]??(key==='width'?84:key==='height'?20:8),v=>selected[key]=Math.max(0,Math.min(100,Number(v)||0)));addField('Warna bentuk','color',selected.color||'#18e6b0',v=>selected.color=v);appendAdvancedControls(root,addField,false,selected);const del=document.createElement('button');del.type='button';del.className='mini-button';del.textContent='Hapus layer';del.onclick=()=>{pushEditorHistory();project.layers=project.layers.filter(x=>x.id!==selected.id);selectedLayerId=null;setDirty();renderLayers();renderPreview();};root.append(del);
}
function applyCanvasSettings(){if(!project)return;const stage=$('previewPage');stage.style.aspectRatio=String(project.aspectRatio||'9:16').replace(':',' / ');stage.style.background=project.background==='light'?'#f5f7fb':project.background==='transparent'?'repeating-conic-gradient(#30384c 0 25%,#202638 0 50%) 0/16px 16px':'#05060b';stage.style.backgroundImage=project.background==='image'&&project.wallpaper?'url("'+project.wallpaper+'")':'none';updateModeUi();}
async function loadSiteDesign(){if(!project?.isDefault||role!=='owner')return;try{const res=await fetch('/api/admin/site-design',{credentials:'same-origin',cache:'no-store'});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'Desain website tidak dapat dimuat.');siteDesign=project.designDraft||data.design||{version:2,page:'all',accent:'#86e7ef',accent2:'#ac9dff',background:'#080f1d',globalFont:'system',overlayColor:'#080f1d',overlayOpacity:0,layers:[],freeLayers:[],elementEdits:[],insertedElements:[],appLayers:[]};for(const key of ['elementEdits','insertedElements','freeLayers','appLayers'])siteDesign[key]=Array.isArray(siteDesign[key])?siteDesign[key]:[];}catch(err){notify(err.message||'Studio tidak dapat memuat desain.');}}
function sendStudioMessage(payload){const frame=$('pagePreviewFrame');if(frame?.contentWindow)frame.contentWindow.postMessage(payload,location.origin);}
function currentStudioPage(){return project?.pagePath==='/'?'home':project?.pagePath==='/store/'?'store':project?.pagePath==='/wiki/'?'wiki':project?.pagePath==='/bantuan/'?'help':project?.pagePath==='/store/order.html'?'order':project?.pagePath==='/store/review.html'?'review':project?.pagePath==='/store/ticket.html'?'ticket':project?.pagePath?.startsWith('/wiki/artikel/')?'wiki-'+project.pagePath.split('/').pop().replace('.html',''):'home';}
function getElementEdit(){if(!selectedElement||!siteDesign)return null;const page=currentStudioPage();return siteDesign.elementEdits.find(x=>x.selector===selectedElement.selector&&x.page===page)||(page.startsWith('wiki-')?siteDesign.elementEdits.find(x=>x.selector===selectedElement.selector&&x.page==='wiki'):null)||siteDesign.elementEdits.find(x=>x.selector===selectedElement.selector&&x.page==='all')||null;}
function ensureElementEdit(){if(!selectedElement||!siteDesign)return null;let item=getElementEdit();if(!item){item={page:currentStudioPage(),selector:selectedElement.selector,tag:selectedElement.tag,styles:{},effects:[],hidden:false};siteDesign.elementEdits.push(item);}return item;}
function sendElementEdit(){const edit=getElementEdit();if(edit)sendStudioMessage({type:'slf-studio-edit',edit:{text:edit.text,src:edit.src,href:edit.href,backgroundImage:edit.backgroundImage,hidden:edit.hidden,styles:edit.styles,effects:edit.effects,keyframes:edit.keyframes,duration:edit.duration,easing:edit.easing}});}
function changeElement(mutator){const item=ensureElementEdit();if(!item)return;mutator(item);if(project)project.designDraft=siteDesign;setDirty();sendElementEdit();}
function pushEditorHistory(){if(!project)return;elementUndo.push(JSON.stringify({project,siteDesign}));if(elementUndo.length>30)elementUndo.shift();elementRedo=[];}
function undoEditor(){if(!elementUndo.length)return;elementRedo.push(JSON.stringify({project,siteDesign}));const old=JSON.parse(elementUndo.pop());project=old.project;siteDesign=old.siteDesign;selectedElement=null;setDirty();applyCanvasSettings();loadPagePreview();renderLayers();}
function redoEditor(){if(!elementRedo.length)return;elementUndo.push(JSON.stringify({project,siteDesign}));const old=JSON.parse(elementRedo.pop());project=old.project;siteDesign=old.siteDesign;selectedElement=null;setDirty();applyCanvasSettings();loadPagePreview();renderLayers();}
function loadPagePreview(){const frame=$('pagePreviewFrame');if(!frame||!project)return;selectedElement=null;outlineItems=[];renderLayers();applyCanvasSettings();if(!project.isDefault){const root=$('previewOverlay');if(project.isPublished&&!project.needsExport&&!dirty){root.replaceChildren();frame.src=project.pagePath+(project.pagePath.includes('?')?'&':'?')+'slf_studio=1&v='+Date.now();}else{frame.src='about:blank';renderPreview();}return;}frame.src=project.pagePath+(project.pagePath.includes('?')?'&':'?')+'slf_studio=1&v='+Date.now();renderPreview();}
function applyPreviewKeyframes(node,layer){const frames=Array.isArray(layer.keyframes)?layer.keyframes:[];if(!frames.length)return;const id=String(layer.id||'kf').replace(/[^A-Za-z0-9_-]/g,''),name='slf-preview-kf-'+id;let style=document.getElementById('slf-preview-keyframes');if(!style){style=document.createElement('style');style.id='slf-preview-keyframes';document.head.append(style);}const duration=Math.max(200,Number(layer.duration)||900),css=frames.map(f=>{const pct=Math.max(0,Math.min(100,Number(f.time)/duration*100)),x=Number(f.x||0),y=Number(f.y||0),r=Number(f.rotation||0),sx=Number(f.scaleX||1),sy=Number(f.scaleY||1),kx=Number(f.skewX||0),ky=Number(f.skewY||0),o=Number(f.opacity??1);return pct+'%{transform:translate('+x+'%,'+y+'%) rotate('+r+'deg) scale('+sx+','+sy+') skew('+kx+'deg,'+ky+'deg);opacity:'+o+';}';}).join('');style.textContent+='@keyframes '+name+'{'+css+'}';node.style.animation=name+' '+duration+'ms '+(layer.easing||'ease')+' both';}
function renderPreviewLegacy(){const root=$('previewOverlay');if(!root||!project)return;root.replaceChildren();if(project.isDefault)return;project.layers.filter(layer=>layer.visible!==false&&currentTimeMs>=(layer.startTime||0)&&currentTimeMs<=(layer.startTime||0)+(layer.duration||10000)).forEach((layer,index)=>{const node=document.createElement('div');node.className='preview-layer'+(layer.id===selectedLayerId?' selected':'');node.dataset.layerId=layer.id;node.style.position='absolute';node.style.left=(layer.x??8)+'%';node.style.top=(layer.y??(12+index*15))+'%';node.style.width=(layer.width??84)+'%';node.style.minHeight=(layer.height??20)+'%';node.style.background=layer.color||layer.visual?.backgroundColor||'rgba(24,38,56,.85)';node.style.opacity=String(layer.opacity??1);node.style.mixBlendMode=layer.blendMode==='contrast'?'difference':(layer.blendMode||'normal');if(layer.fontSize)node.style.fontSize=layer.fontSize+'px';if(layer.fontFamily)node.style.fontFamily=layer.fontFamily;if(layer.textAlign)node.style.textAlign=layer.textAlign;if(layer.visual?.borderRadius)node.style.borderRadius=layer.visual.borderRadius+'px';node.style.zIndex=String(layer.z??index+1);node.style.transform='rotate('+(layer.rotation||0)+'deg) scale('+(layer.scaleX||1)+','+(layer.scaleY||1)+') skew('+(layer.skewX||0)+'deg,'+(layer.skewY||0)+'deg)';if(layer.visual?.gradient?.stops?.length>=2){const st=layer.visual.gradient.stops;node.style.backgroundImage='linear-gradient('+(layer.visual.gradient.angle||135)+'deg,'+st[0].color+' 0%,'+st[1].color+' 100%)';}if(layer.visual?.borderColor)node.style.border=(layer.visual.borderWidth||1)+'px '+(layer.visual.borderStyle||'solid')+' '+layer.visual.borderColor;if(layer.visual?.shadowBlur)node.style.boxShadow=(layer.visual.shadowX||0)+'px '+(layer.visual.shadowY||6)+'px '+layer.visual.shadowBlur+'px '+(layer.visual.shadowColor||'#000000');if(layer.maskWith)node.style.clipPath='inset(0 round 50%)';(layer.visual?.effects||[]).forEach(effect=>node.classList.add('slf-effect-'+effect));applyPreviewKeyframes(node,layer);if(layer.type==='image'&&layer.src){const img=document.createElement('img');img.src=layer.src;img.alt=layer.name;img.style.width='100%';img.style.height='100%';img.style.objectFit='cover';node.append(img);}else if(layer.type==='video'||layer.type==='audio'){const media=document.createElement(layer.type);media.src=layer.src;media.controls=true;media.style.width='100%';node.append(media);}else if(layer.type==='button'){const button=document.createElement('button');button.type='button';button.textContent=layer.content||layer.name;node.append(button);}else if(layer.type==='table'){const table=document.createElement('table');(layer.rows||[]).forEach((row,i)=>{const tr=document.createElement('tr');row.forEach(cell=>{const td=document.createElement(i===0?'th':'td');td.textContent=cell;tr.append(td);});table.append(tr);});node.append(table);}else if(layer.type==='input'){const input=document.createElement('input');input.placeholder=layer.content||layer.fieldName;input.disabled=true;node.append(input);}else{node.textContent=layer.content||layer.name;}if(layer.type==='shape')node.style.borderRadius='50%';if(layer.animation&&layer.animation!=='none'){node.classList.add('anim-'+layer.animation);node.style.animationPlayState='paused';node.style.animationIterationCount=layer.loop?'infinite':'1';}node.addEventListener('pointerdown',event=>{if(editorLocked||event.button>0||event.target.classList.contains('resize-handle'))return;pushEditorHistory();event.preventDefault();selectedLayerId=layer.id;if(!selectedLayerIds.has(layer.id)){selectedLayerIds.clear();selectedLayerIds.add(layer.id);}renderLayers();selectPanel('properties');const pageRect=$('previewPage').getBoundingClientRect(),startX=event.clientX,startY=event.clientY,group=layer.groupId?project.layers.filter(x=>x.groupId===layer.groupId):selectedLayers(),starts=group.map(x=>({layer:x,x:Number(x.x??8),y:Number(x.y??12)}));let moved=false;const move=e=>{const dx=(e.clientX-startX)/Math.max(1,pageRect.width)*100,dy=(e.clientY-startY)/Math.max(1,pageRect.height)*100;if(Math.abs(dx)+Math.abs(dy)>.1)moved=true;starts.forEach(item=>{item.layer.x=Math.max(0,Math.min(100-(item.layer.width||84),item.x+dx));item.layer.y=Math.max(0,Math.min(100-(item.layer.height||20),item.y+dy));});node.style.left=layer.x+'%';node.style.top=layer.y+'%';};const finish=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',finish);document.removeEventListener('pointercancel',finish);if(moved){setDirty();renderLayers();}};document.addEventListener('pointermove',move);document.addEventListener('pointerup',finish,{once:true});document.addEventListener('pointercancel',finish,{once:true});});const resize=document.createElement('span');resize.className='resize-handle';resize.title='Ubah ukuran';resize.addEventListener('pointerdown',event=>{event.stopPropagation();event.preventDefault();pushEditorHistory();const rect=$('previewPage').getBoundingClientRect(),sx=event.clientX,sy=event.clientY,sw=Number(layer.width||84),sh=Number(layer.height||20);const move=e=>{layer.width=Math.max(2,Math.min(200,sw+(e.clientX-sx)/Math.max(1,rect.width)*100));layer.height=Math.max(2,Math.min(200,sh+(e.clientY-sy)/Math.max(1,rect.height)*100));node.style.width=layer.width+'%';node.style.minHeight=layer.height+'%';};const end=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',end);setDirty();renderLayers();};document.addEventListener('pointermove',move);document.addEventListener('pointerup',end,{once:true});});node.append(resize);node.addEventListener('dblclick',event=>{if(['text','card','button'].includes(layer.type)){event.preventDefault();node.contentEditable='true';node.focus();const finish=()=>{layer.content=node.textContent||'';node.contentEditable='false';setDirty();renderLayers();};node.addEventListener('blur',finish,{once:true});}});node.addEventListener('click',()=>{selectedLayerId=layer.id;renderLayers();selectPanel('properties');});root.append(node);});}
function addLayer(type){
 if(!TYPE_META[type])return;
 const layer={id:uid(),type,name:TYPE_META[type].label+' '+(project.layers.length+1),content:type==='text'?'Teks baru':type==='button'?'Klik di sini':type==='card'?'Informasi baru':type==='input'?'Masukkan data':'',src:'',href:'',fieldName:type==='input'?'field_'+(project.layers.length+1):'',rows:[],x:8,y:12+project.layers.length*12,width:84,height:20,z:project.layers.length+1,rotation:0,scaleX:1,scaleY:1,skewX:0,skewY:0,opacity:1,visible:true,visual:{},keyframes:[],easing:'ease',color:'#18e6b0',actionType:'none',actionTarget:'',animation:'none',clickAnimation:'none',loop:false,duration:900};
 pushEditorHistory();project.layers.push(layer);selectedLayerId=layer.id;setDirty();renderLayers();renderPreview();selectPanel('properties');closeSheet();notify('Layer ditambahkan. Simpan project setelah selesai.');
}

async function saveProject(){if(!project)return;project.designDraft=siteDesign||project.designDraft||null;project.updatedAt=new Date().toISOString();const index=projects.findIndex(p=>p.id===project.id);if(index>=0)projects[index]=project;else projects.unshift(project);await put(PROJECTS_KEY,projects);savedFingerprint=fingerprint(project);dirty=false;$('projectStatus').textContent='Tersimpan di perangkat';$('saveProject').classList.remove('needs-save');renderLobby();notify('Draft proyek disimpan di perangkat ini. Tekan Export untuk menerbitkan ke website.');}
function updateModeUi(){const page=$('previewPage'),stage=$('previewStage');const width=activeMode==='mobile'?390:1280,height=activeMode==='mobile'?844:720;page.classList.toggle('desktop-preview',activeMode==='desktop');page.style.width=width+'px';page.style.height=height+'px';const availableWidth=Math.max(1,stage.clientWidth-16),availableHeight=Math.max(1,stage.clientHeight-16);const scale=Math.min(availableWidth/width,availableHeight/height)*(editorZoom/100);page.style.setProperty('--preview-scale',String(scale));$('modeMobile').classList.toggle('active',activeMode==='mobile');$('modeDesktop').classList.toggle('active',activeMode==='desktop');}
function switchMode(next){if(next===activeMode)return;activeMode=next;updateModeUi();}
async function publishWebsite(){
 if(!project)return;
 const hostname=location.hostname.toLowerCase(),isProductionHost=hostname==='legacy-frontier.web.id'||hostname==='www.legacy-frontier.web.id',isPreviewHost=hostname==='slf-website.pages.dev'||hostname.endsWith('.slf-website.pages.dev');
 if(!isProductionHost&&!isPreviewHost){notify('Export hanya tersedia dari domain SLF atau preview Pages resmi.');return;}
 if(project.isDefault&&!isProductionHost){notify('Export halaman bawaan tetap dilakukan dari domain Production. Halaman baru dapat diuji dan diterbitkan di Preview.');return;}
 if(dirty||fingerprint(project)!==savedFingerprint){notify('Simpan Project terlebih dahulu sebelum Export.');return;}
 if(!role){openLogin('Login Owner diperlukan untuk Export ke website.');return;}
 if(role!=='owner'){notify('Export website hanya dapat dilakukan Owner.');return;}
 const button=$('exportProject');button.disabled=true;button.textContent='Menerbitkan…';
 try{
  const mapped=project.layers.map(layer=>({
   id:'app-'+project.id+'-'+layer.id,type:layer.type==='rect'?'shape':layer.type,name:layer.name,content:layer.content||'',src:layer.src||'',href:layer.href||'',fieldName:layer.fieldName||'',x:layer.x,y:layer.y,width:layer.width,height:layer.height,z:layer.z,rotation:layer.rotation||0,scaleX:layer.scaleX||1,scaleY:layer.scaleY||1,skewX:layer.skewX||0,skewY:layer.skewY||0,opacity:layer.opacity??1,visible:layer.visible!==false,positioned:true,visual:layer.visual||{},keyframes:layer.keyframes||[],easing:layer.easing||'ease',styles:layer.styles&&typeof layer.styles==='object'?layer.styles:{color:layer.color||'',backgroundColor:layer.color||'',fontSize:layer.fontSize||0},
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
  const design=siteDesign||data.design||{version:2,page:'all',accent:'#86e7ef',accent2:'#ac9dff',background:'#080f1d',globalFont:'system',overlayColor:'#080f1d',overlayOpacity:0,layers:[],freeLayers:[],elementEdits:[],insertedElements:[],appLayers:[]};design.elementEdits=Array.isArray(design.elementEdits)?design.elementEdits:[];design.insertedElements=Array.isArray(design.insertedElements)?design.insertedElements:[];design.freeLayers=Array.isArray(design.freeLayers)?design.freeLayers:[];if(project.background==='light')design.background='#f5f7fb';else if(project.background==='black')design.background='#080f1d';
  design.appLayers=Array.isArray(design.appLayers)?design.appLayers:[];
  const prefix='app-'+project.id+'-';design.appLayers=design.appLayers.filter(l=>!String(l.id||'').startsWith(prefix));
  design.appLayers.push(...mapped.map(layer=>({...layer,page:pageKey})));
  const write=await fetch('/api/admin/site-design',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({design})});
  const result=await write.json().catch(()=>({}));if(!write.ok)throw new Error(result.error||'Gagal menyimpan desain ke website.');siteDesign=result.design||design;project.designDraft=siteDesign;
  notify('Export website berhasil. Layer '+mapped.length+' dan edit halaman diterbitkan ke '+project.name+'.');
 }catch(error){notify(error.message||'Export gagal.');}
 finally{button.disabled=false;button.textContent='Export';}
}


function openExportSheet(){if(!project)return;$('templateToggle').checked=Boolean(project.isTemplate);$('exportStatus').textContent='Pilih format ekspor atau simpan draft.';$('exportSheet').hidden=false;}
function closeExportSheet(){$('exportSheet').hidden=true;}
async function loadDraftFromD1(id){if(role!=='owner')return;try{const response=await fetch('/api/admin/studio/drafts?id='+encodeURIComponent(id),{credentials:'same-origin',cache:'no-store'});if(!response.ok)return;const data=await response.json(),remote=data.draft?.project;if(remote&&new Date(remote.updatedAt||0)>new Date(project?.updatedAt||0)){project=remote;const index=projects.findIndex(p=>p.id===id);if(index>=0)projects[index]=remote;}}catch(_){}}
async function saveDraftToD1(){if(!project)return;if(role!=='owner'){openLogin('Login Owner diperlukan untuk menyimpan Draft D1.');return;}project.designDraft=siteDesign||project.designDraft||null;project.updatedAt=new Date().toISOString();const button=$('saveDraftD1');button.disabled=true;button.textContent='Menyimpan…';try{const response=await fetch('/api/admin/studio/drafts',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({id:project.id,name:project.name,pagePath:project.pagePath,project,isTemplate:Boolean(project.isTemplate)})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Draft D1 gagal disimpan.');await put(PROJECTS_KEY,projects);$('exportStatus').textContent='Draft D1 tersimpan · '+data.updatedAt;notify('Draft project berhasil disimpan ke D1.');}catch(error){$('exportStatus').textContent=error.message;notify(error.message);}finally{button.disabled=false;button.textContent='▣ Simpan Draft D1';}}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function downloadProjectJson(){if(!project)return;project.designDraft=siteDesign||project.designDraft||null;const assets=[...new Set((project.layers||[]).map(x=>x.src).filter(Boolean))],pkg={format:'slf-studio-project',schemaVersion:3,exportedAt:new Date().toISOString(),project,assets};downloadBlob(new Blob([JSON.stringify(pkg,null,2)],{type:'application/json'}),(project.name||'slf-project').replace(/[^a-z0-9_-]/gi,'-')+'.slf-project.json');$('exportStatus').textContent='Project JSON berhasil dibuat.';}
function canvasRoundRect(ctx,x,y,w,h,r){const q=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+q,y);ctx.arcTo(x+w,y,x+w,y+h,q);ctx.arcTo(x+w,y+h,x,y+h,q);ctx.arcTo(x,y+h,x,y,q);ctx.arcTo(x,y,x+w,y,q);ctx.closePath();}
function wrapCanvasText(ctx,text,maxWidth,lineHeight){const words=String(text||'').split(/\s+/),lines=[];let line='';for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;}if(line)lines.push(line);return lines.slice(0,30).map((text,i)=>({text,y:i*lineHeight}));}
function loadCanvasImage(src){return new Promise((resolve,reject)=>{const img=new Image();if(/^https:\/\//i.test(src))img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Aset media tidak dapat dirender ke PNG: '+src));img.src=src;});}
async function drawProjectPng(){const parts=String(project.aspectRatio||'9:16').split(':').map(Number),ratio=parts.length===2&&parts[0]>0&&parts[1]>0?parts[0]/parts[1]:9/16,height=project.resolution==='1440p'?1440:project.resolution==='720p'?720:1080,width=Math.round(height*ratio),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.fillStyle=project.background==='light'?'#f5f7fb':'#080b12';ctx.fillRect(0,0,width,height);if(project.background==='image'&&project.wallpaper){const bg=await loadCanvasImage(project.wallpaper);ctx.drawImage(bg,0,0,width,height);}const layers=[...(project.layers||[])].filter(x=>x.visible!==false&&currentTimeMs>=(x.startTime||0)&&currentTimeMs<=(x.startTime||0)+(x.duration||10000)).sort((a,b)=>(a.z||0)-(b.z||0));for(const layer of layers){const x=width*(Number(layer.x??8)/100),y=height*(Number(layer.y??12)/100),w=width*(Number(layer.width??84)/100),h=height*(Number(layer.height??20)/100),v=layer.visual||{};ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate((Number(layer.rotation)||0)*Math.PI/180);ctx.scale(Number(layer.scaleX)||1,Number(layer.scaleY)||1);ctx.transform(1,Math.tan((Number(layer.skewY)||0)*Math.PI/180),Math.tan((Number(layer.skewX)||0)*Math.PI/180),1,0,0);ctx.globalAlpha=Number(layer.opacity??1);if(v.shadowBlur){ctx.shadowBlur=Number(v.shadowBlur);ctx.shadowColor=v.shadowColor||'#000';ctx.shadowOffsetX=Number(v.shadowX)||0;ctx.shadowOffsetY=Number(v.shadowY)||6;}let fill=v.backgroundColor||layer.color||'#182236';if(v.gradient?.stops?.length>=2){const g=ctx.createLinearGradient(-w/2,-h/2,w/2,h/2);v.gradient.stops.forEach(stop=>g.addColorStop(Math.max(0,Math.min(1,Number(stop.position)/100)),stop.color));fill=g;}ctx.fillStyle=fill;if(layer.maskWith){ctx.beginPath();ctx.ellipse(0,0,w/2,h/2,0,0,Math.PI*2);ctx.clip();}if(layer.type==='image'&&layer.src){const img=await loadCanvasImage(layer.src);ctx.drawImage(img,-w/2,-h/2,w,h);}else if(layer.type==='text'){ctx.fillStyle=v.color||layer.color||'#fff';ctx.font=(v.fontWeight||700)+' '+(v.fontSize||Math.max(24,height*.035))+'px system-ui';ctx.textBaseline='top';wrapCanvasText(ctx,layer.content||layer.name,w,Number(v.lineHeight||1.25)*(v.fontSize||36)).forEach(line=>ctx.fillText(line.text,-w/2,-h/2+line.y));}else{canvasRoundRect(ctx,-w/2,-h/2,w,h,Number(v.borderRadius??12));ctx.fill();if(['button','card'].includes(layer.type)){ctx.fillStyle=v.color||'#fff';ctx.font='700 '+Math.max(18,height*.025)+'px system-ui';ctx.textBaseline='middle';ctx.fillText(layer.content||layer.name,-w/2+16,0,Math.max(0,w-32));}}if(Number(v.borderWidth)>0){ctx.shadowBlur=0;ctx.lineWidth=Number(v.borderWidth);ctx.strokeStyle=v.borderColor||'#fff';canvasRoundRect(ctx,-w/2,-h/2,w,h,Number(v.borderRadius??12));ctx.stroke();}ctx.restore();}return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Browser gagal merender PNG.')),'image/png'));}
async function exportIframePng(){const doc=$('pagePreviewFrame').contentDocument;if(!doc)throw new Error('Preview halaman belum siap.');const clone=doc.documentElement.cloneNode(true),base=doc.createElement('base');base.href=doc.location.href;clone.querySelector('head')?.prepend(base);const xhtml=new XMLSerializer().serializeToString(clone),svg='<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;overflow:hidden">'+xhtml+'</div></foreignObject></svg>',blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);try{const img=await loadCanvasImage(url),canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;canvas.getContext('2d').drawImage(img,0,0,1080,1920);return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Gagal membuat PNG halaman.')),'image/png'));}finally{URL.revokeObjectURL(url);}}
async function exportCurrentPng(){if(!project)return;const button=$('exportCurrentPng');button.disabled=true;button.textContent='Merender…';try{const blob=project.isDefault?await exportIframePng():await drawProjectPng();downloadBlob(blob,(project.name||'slf-frame').replace(/[^a-z0-9_-]/gi,'-')+'.png');$('exportStatus').textContent='PNG berhasil dirender.';}catch(error){$('exportStatus').textContent=error.message;notify(error.message);}finally{button.disabled=false;button.textContent='▧ Render PNG';}}
function addTemplate(kind){if(!project||project.isDefault)return;pushEditorHistory();const base=project.layers.length*3,defs=kind==='banner'?[['shape','Banner background',0,10,100,28,'#263b52'],['text','Banner title',7,15,86,9,'#ffffff'],['text','Banner subtitle',7,24,86,8,'#c8d6e8']]:kind==='cta'?[['card','CTA panel',8,58,84,30,'#24364b'],['text','CTA title',13,62,74,8,'#ffffff'],['button','CTA button',13,76,45,8,'#4dd0c8']]:[['text','Hero title',7,25,86,12,'#ffffff'],['text','Hero subtitle',7,39,86,10,'#c6d2e4'],['button','Hero button',7,54,48,9,'#4dd0c8']];defs.forEach(([type,name,x,y,width,height,color],i)=>project.layers.push({id:uid(),type,name,content:name,x,y,width,height,z:base+i+1,color,opacity:1,rotation:0,scaleX:1,scaleY:1,skewX:0,skewY:0,visible:true,visual:{backgroundColor:color,borderRadius:12},keyframes:[],easing:'ease',duration:900,actionType:'none',actionTarget:'',rows:[]}));selectedLayerIds.clear();selectedLayerId=project.layers[project.layers.length-1].id;setDirty();renderLayers();renderPreview();closeSheet();notify('Template '+kind+' ditambahkan dan bisa diedit.');}

function switchAddTab(name){document.querySelectorAll('[data-add-tab]').forEach(b=>b.classList.toggle('active',b.dataset.addTab===name));document.querySelector('.add-sheet')?.setAttribute('data-tab',name);document.querySelectorAll('[data-create]').forEach(b=>{const type=b.dataset.create;b.hidden=name==='shape'?!['shape','rect'].includes(type):name==='object'?!['button','table','card','input'].includes(type):name==='template'?true:name==='text'?type!=='text':true;});document.querySelectorAll('[data-template]').forEach(b=>b.hidden=name!=='template');$('pickMediaFile').hidden=name!=='media';$('pickAudioFile').hidden=name!=='audio';}
async function handleStudioUpload(file,mediaType){if(!file)return;const isAudio=mediaType==='audio';if(isAudio?!/^audio\//.test(file.type):!/^image\//.test(file.type)&&!/^video\//.test(file.type))throw new Error('Jenis file tidak didukung.');if(file.size>15*1024*1024)throw new Error('Ukuran file maksimal 15 MB.');const asset=await uploadAsset(file),type=isAudio?'audio':file.type.startsWith('video/')?'video':'image';
 if(project?.isDefault){const canReplace=selectedElement&&((type==='image'&&selectedElement.tag==='img')||(type==='video'&&selectedElement.tag==='video')||(type==='audio'&&selectedElement.tag==='audio')||(type==='image'&&(selectedElement.backgroundImage||['main','body','section','header','footer'].includes(selectedElement.tag))));if(canReplace){pushEditorHistory();changeElement(x=>{x.src=asset.url;x.backgroundImage=type==='image'&&!['img','video','audio'].includes(selectedElement.tag);});}else{pushEditorHistory();sendStudioMessage({type:'slf-studio-add',kind:type,text:file.name.replace(/\.[^.]+$/,'').slice(0,80),src:asset.url});}}
 else{const current=selectedLayer(),canReplace=current&&current.type===type;if(canReplace){pushEditorHistory();current.src=asset.url;setDirty();renderLayers();renderPreview();}else{pushEditorHistory();const layer={id:uid(),type,name:file.name.replace(/\.[^.]+$/,'').slice(0,70)||TYPE_META[type].label,src:asset.url,content:'',x:8,y:12+project.layers.length*12,width:84,height:22,color:'#18e6b0',actionType:'none',actionTarget:'',rows:[],styles:{}};project.layers.push(layer);selectedLayerId=layer.id;setDirty();renderLayers();renderPreview();}}
 closeSheet();notify('File berhasil diunggah.');}
function addBuiltinElement(kind){sendStudioMessage({type:'slf-studio-add',kind:kind==='rect'||kind==='shape'?'shape':kind,text:kind==='text'?'Teks baru SLF':kind==='button'?'Tombol baru':'Elemen baru'});closeSheet();}
function runLayerAction(action){const layer=selectedLayer();if(action==='select-all'){if(project?.isDefault){sendStudioMessage({type:'slf-studio-select-all'});notify('Semua elemen halaman ditandai di kanvas.');}else{document.querySelectorAll('.layer-row').forEach(row=>row.classList.add('active'));notify(project.layers.length+' layer ditandai.');}return;}if(action==='copy'){layerClipboard=project?.isDefault?(selectedElement?{type:'dom',text:selectedElement.text,src:selectedElement.src,styles:getElementEdit()?.styles||{}}:null):layer?JSON.parse(JSON.stringify(layer)):null;notify(layerClipboard?'Layer disalin.':'Pilih layer dahulu.');return;}if(action==='duplicate'&&layer&&!project?.isDefault){pushEditorHistory();const copy=JSON.parse(JSON.stringify(layer));copy.id=uid();copy.name=copy.name+' · Salinan';copy.x=Math.min(90,(copy.x||8)+3);copy.y=Math.min(90,(copy.y||8)+3);project.layers.push(copy);selectedLayerId=copy.id;setDirty();renderLayers();renderPreview();return;}if(action==='paste'&&layerClipboard&&!project?.isDefault){pushEditorHistory();const copy=JSON.parse(JSON.stringify(layerClipboard));copy.id=uid();copy.name=(copy.name||'Layer')+' · Salinan';project.layers.push(copy);selectedLayerId=copy.id;setDirty();renderLayers();renderPreview();return;}if(action==='paste-style'&&layerClipboard?.styles&&selectedElement){pushEditorHistory();changeElement(x=>{x.styles={...(x.styles||{}),...layerClipboard.styles};});notify('Gaya ditempelkan.');return;}if(action==='duplicate'&&project?.isDefault&&selectedElement){sendStudioMessage({type:'slf-studio-add',kind:selectedElement.tag==='img'?'image':selectedElement.tag==='button'?'button':'text',text:selectedElement.text||'Salinan elemen',src:selectedElement.src||''});return;}if(action==='paste'&&layerClipboard?.type==='dom'){sendStudioMessage({type:'slf-studio-add',kind:'text',text:layerClipboard.text||'Elemen salinan'});return;}notify('Aksi layer ini perlu layer yang dipilih.');}
function openSheet(){$('addSheet').hidden=false;}function closeSheet(){$('addSheet').hidden=true;}
async function initStudio(){
 $('moduleBack').onclick=()=>setView('home');$('refreshPreview').onclick=()=>loadPagePreview();$('lobbyBack').onclick=()=>setView('home');$('newProject').onclick=addProject;$('editorBack').onclick=()=>{if(dirty&&!confirm('Perubahan belum disimpan. Keluar dan buang perubahan terakhir?'))return;setView('lobby');};$('saveProject').onclick=saveProject;$('exportProject').onclick=openExportSheet;$('publishWebsite').onclick=async()=>{closeExportSheet();await publishWebsite();};$('closeExportSheet').onclick=closeExportSheet;$('saveDraftD1').onclick=saveDraftToD1;$('downloadProjectJson').onclick=downloadProjectJson;$('exportCurrentPng').onclick=exportCurrentPng;$('templateToggle').onchange=async e=>{if(!project)return;project.isTemplate=e.target.checked;setDirty();await saveDraftToD1();};
 $('modeMobile').onclick=()=>switchMode('mobile');$('modeDesktop').onclick=()=>switchMode('desktop');$('pageSettingsButton').onclick=()=>openProjectModal('settings');$('projectModalClose').onclick=closeProjectModal;$('projectModalCancel').onclick=closeProjectModal;$('projectModalCreate').onclick=submitProjectModal;$('projectTabProject').onclick=()=>{document.querySelectorAll('[data-project-modal-tab]').forEach(x=>x.classList.toggle('active',x.id==='projectTabProject'));};$('projectTabElement').onclick=()=>{closeProjectModal();openSheet();switchAddTab('object');};$('projectBackground').onchange=e=>$('projectWallpaperField').hidden=e.target.value!=='image';$('projectCreateD1').onchange=e=>$('projectD1Fields').hidden=!e.target.checked;$('projectCreateD1').disabled=false;
 document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>{const name=b.dataset.open;if(name==='studio')setView('lobby');else if(name==='home')setView('home');else openAdminMenu(name,name,false);}));
 document.querySelectorAll('.editor-tab').forEach(b=>b.addEventListener('click',()=>selectPanel(b.dataset.panel)));$('createBackendTable').onclick=createBackendTable;
 $('floatingAdd').onclick=openSheet;$('addLayerInline').onclick=openSheet;$('closeSheet').onclick=closeSheet;$('addSheet').onclick=e=>{if(e.target===$('addSheet'))closeSheet();};document.querySelectorAll('[data-add-tab]').forEach(b=>b.addEventListener('click',()=>switchAddTab(b.dataset.addTab)));document.querySelectorAll('[data-template]').forEach(b=>b.addEventListener('click',()=>addTemplate(b.dataset.template)));$('pickMediaFile').onclick=()=> $('studioMediaFile').click();$('pickAudioFile').onclick=()=> $('studioAudioFile').click();$('studioMediaFile').onchange=async e=>{try{await handleStudioUpload(e.target.files?.[0],'media');}catch(err){notify(err.message||'Upload gagal.');}finally{e.target.value='';}};$('studioAudioFile').onchange=async e=>{try{await handleStudioUpload(e.target.files?.[0],'audio');}catch(err){notify(err.message||'Upload gagal.');}finally{e.target.value='';}};document.querySelectorAll('[data-create]').forEach(b=>b.addEventListener('click',()=>{if(project?.isDefault&&['shape','rect','text','button','card'].includes(b.dataset.create))addBuiltinElement(b.dataset.create);else addLayer(b.dataset.create);}));$('studioUndo').onclick=undoEditor;$('studioRedo').onclick=redoEditor;$('layerMenuButton').onclick=()=>$('layerMenu').hidden=!$('layerMenu').hidden;document.querySelectorAll('[data-layer-action]').forEach(b=>b.addEventListener('click',()=>{runLayerAction(b.dataset.layerAction);$('layerMenu').hidden=true;}));$('editorSidebarButton').onclick=()=>$('editorSidebar').hidden=!$('editorSidebar').hidden;$('inlineEditToggle').onclick=()=>{const button=$('inlineEditToggle');button.classList.toggle('active');sendStudioMessage({type:'slf-studio-inline-mode',enabled:button.classList.contains('active')});notify(button.classList.contains('active')?'Mode edit teks aktif · ketuk dua kali teks.':'Mode edit teks dimatikan.');};$('backendPanelButton').onclick=()=>selectPanel('backend');document.querySelectorAll('[data-close-panel]').forEach(b=>b.addEventListener('click',()=>selectPanel('layers')));$('gridToggle').onclick=()=>{editorGrid=!editorGrid;$('previewPage').classList.toggle('show-grid',editorGrid);};$('lockToggle').onclick=()=>{editorLocked=!editorLocked;$('lockToggle').classList.toggle('active',editorLocked);if(project?.isDefault)sendStudioMessage({type:'slf-studio-mode',enabled:!editorLocked});notify(editorLocked?'Layer dikunci sementara.':'Kunci layer dilepas.');};$('zoomIn').onclick=()=>{editorZoom=Math.min(200,editorZoom+10);$('zoomLabel').textContent=editorZoom+'%';updateModeUi();};$('zoomOut').onclick=()=>{editorZoom=Math.max(50,editorZoom-10);$('zoomLabel').textContent=editorZoom+'%';updateModeUi();};window.addEventListener('resize',()=>{if(project&&$('studioView').classList.contains('active'))updateModeUi();});$('studioUndo').onclick=undoEditor;$('studioRedo').onclick=redoEditor;function moveTimelineSelection(delta){const rows=[...document.querySelectorAll('.layer-row')];if(!rows.length)return;const index=rows.findIndex(row=>row.classList.contains('active'));const next=index<0?(delta>0?0:rows.length-1):(index+delta+rows.length)%rows.length;rows[next]?.click();}$('timelinePrevious').onclick=()=>moveTimelineSelection(-1);$('timelineNext').onclick=()=>moveTimelineSelection(1);$('timelinePlay').onclick=()=>{timelinePlaying=!timelinePlaying;$('timelinePlay').textContent=timelinePlaying?'Ⅱ':'▷';if(timelinePlaying){const start=performance.now()-currentTimeMs;const tick=now=>{if(!timelinePlaying)return;currentTimeMs=(now-start)%10000;updateTimecode();renderPreview();timelineFrame=requestAnimationFrame(tick);};timelineFrame=requestAnimationFrame(tick);}else cancelAnimationFrame(timelineFrame);};$('timelineScrubber').oninput=e=>{currentTimeMs=Number(e.target.value)||0;updateTimecode();renderPreview();};['group','mask','trim','split','align','delete'].forEach(action=>{const id={group:'groupLayers',mask:'maskLayer',trim:'trimLayer',split:'splitLayer',align:'alignLayers',delete:'deleteLayers'}[action];$(id).onclick=()=>runTimelineAction(action);});
 $('animationPreset').onchange=e=>{const l=selectedLayer();if(l){l.animation=e.target.value;setDirty();renderPreview();}};$('animationLoop').onchange=e=>{const l=selectedLayer();if(l){l.loop=e.target.checked;setDirty();renderPreview();}};$('clickAnimation').onchange=e=>{const l=selectedLayer();if(l){l.clickAnimation=e.target.value;setDirty();renderPreview();}};$('layerActionType').onchange=e=>{const l=selectedLayer();if(l){l.actionType=e.target.value;setDirty();}};$('layerActionTarget').oninput=e=>{const l=selectedLayer();if(l){l.actionTarget=e.target.value;setDirty();}};
 document.querySelectorAll('input,textarea,select').forEach(el=>{if(!['adminSecret'].includes(el.id)&&el.closest('#propertyFields'))return;});
 if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js?v=cc39c93-fix1',{scope:'./',updateViaCache:'none'}).catch(()=>{});$('pagePreviewFrame').addEventListener('load',()=>{try{const doc=$('pagePreviewFrame').contentDocument;if(doc){const style=doc.createElement('style');style.textContent='[aria-label*="CS SLF 24 Jam" i],[title*="CS SLF 24 Jam" i]{display:none!important}';doc.head?.append(style);for(const el of doc.querySelectorAll('body *')){if(el.children.length===0&&/CS SLF 24 Jam/i.test(el.textContent||'')){let target=el;for(let n=0;n<3&&target.parentElement&&target.parentElement!==doc.body;n++)target=target.parentElement;target.style.setProperty('display','none','important');}}}}catch(_){}if(project?.isDefault){sendStudioMessage({type:'slf-studio-mode',enabled:true});sendStudioMessage({type:'slf-studio-free-layers',layers:siteDesign?.freeLayers||[]});}});window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==$('pagePreviewFrame').contentWindow||!event.data)return;const m=event.data;if(m.type==='slf-studio-ready'){sendStudioMessage({type:'slf-studio-mode',enabled:true});sendStudioMessage({type:'slf-studio-free-layers',layers:siteDesign?.freeLayers||[]});}if(m.type==='slf-studio-outline'){outlineItems=Array.isArray(m.items)?m.items:[];renderLayers();}if(m.type==='slf-studio-selected'){selectedElement=m;selectedLayerId=null;renderLayers();selectPanel('properties');}if(m.type==='slf-studio-created'){siteDesign=siteDesign||{};siteDesign.insertedElements=siteDesign.insertedElements||[];if(!siteDesign.insertedElements.some(x=>x.id===m.id))siteDesign.insertedElements.push({id:m.id,page:currentStudioPage(),containerSelector:m.containerSelector,type:['image','video','audio','button','card','shape','divider'].includes(m.kind)?m.kind:'text',text:m.text||'',src:m.src||'',href:m.href||'',styles:{},effects:[]});selectedElement=m.selected||selectedElement;setDirty();renderLayers();}if(m.type==='slf-studio-removed'){if(siteDesign)siteDesign.insertedElements=(siteDesign.insertedElements||[]).filter(x=>x.id!==m.id);selectedElement=null;setDirty();renderLayers();}if(m.type==='slf-studio-element-moved'&&selectedElement?.selector===m.selector){pushEditorHistory();changeElement(x=>{x.styles={...(x.styles||{}),translateX:m.translateX,translateY:m.translateY};});}});await loadProjects();renderHome();switchAddTab('shape');initMobileEditorUI();if(location.hash==='#studio')setView('lobby');
}
function bindHomeAuth(){
 const loginButton=$('loginButton');if(loginButton)loginButton.addEventListener('click',()=>openLogin());
 const loginClose=$('loginClose');if(loginClose)loginClose.addEventListener('click',closeLogin);
 const loginSubmit=$('loginSubmit');if(loginSubmit)loginSubmit.addEventListener('click',login);
 const password=$('adminPassword');if(password)password.addEventListener('keydown',e=>{if(e.key==='Enter')login();});
}
async function checkSession(){
 const status=$('connectionState');if(status)status.textContent='Memeriksa';
 let timer;
 try{
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Pemeriksaan sesi melewati batas waktu.')),7000);});
  const data=await Promise.race([auth(),timeout]);
  role=data.role==='owner'?'owner':data.role==='admin'?'admin':'';
  if(!role)throw new Error('Server tidak mengembalikan role admin yang valid.');
  sessionStorage.setItem(SECRET_KEY,'cookie-session');
  if(status)status.textContent='Terhubung';
 }catch(err){
  role='';sessionStorage.removeItem(SECRET_KEY);
  if(status)status.textContent=navigator.onLine?'Sesi tidak aktif':'Offline';
  console.warn('[SLF Mobile] Pemeriksaan sesi gagal:',err);
 }finally{if(timer)clearTimeout(timer);try{renderHome();}catch(err){console.error('[SLF Mobile] Render menu gagal:',err);}}
}
function start(){
 try{renderHome();bindHomeAuth();window.__SLF_APP_READY=true;}catch(err){console.error('[SLF Mobile] Bootstrap beranda/login gagal:',err);}
 window.addEventListener('online',()=>{const el=$('connectionState');if(el)el.textContent='Online';});
 window.addEventListener('offline',()=>{const el=$('connectionState');if(el)el.textContent='Offline';});
 void checkSession();
 Promise.resolve().then(()=>initStudio()).catch(err=>{console.error('[SLF Studio] Inisialisasi gagal:',err);const status=$('connectionState');if(status&&status.textContent==='Memeriksa')status.textContent='Online · Studio bermasalah';});
}
document.addEventListener('DOMContentLoaded',start);
function mobileEscape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function mobileSelectedItem(){return selectedLayer()||selectedElement||null;}
function mobileSelectedName(){const item=mobileSelectedItem();return item?.name||item?.label||item?.tag||item?.type||'Layer';}
function mobileValue(key,fallback=0){
 const layer=selectedLayer();
 if(layer){if(key.startsWith('visual.'))return layer.visual?.[key.slice(7)]??fallback;return layer[key]??fallback;}
 const item=selectedElement;
 if(item){if(key==='content')return item.text??'';if(key==='x')return item.computed?.translateX??0;if(key==='y')return item.computed?.translateY??0;return item.computed?.[key]??fallback;}
 return fallback;
}
function updateMobileHeader(){
 const selected=Boolean(mobileSelectedItem()),projectActions=$('projectTopActions'),selectionActions=$('selectionTopActions');
 if(projectActions)projectActions.hidden=selected;if(selectionActions)selectionActions.hidden=!selected;
 const title=$('editorPageName');if(title)title.textContent=selected?mobileSelectedName():(project?.name||pageLabel(project?.pagePath||'/'));
 const back=$('editorBack');if(back){back.textContent='←';back.title=selected?'Kembali ke timeline':'Kembali ke project';}
 const zoom=$('canvasZoomLabel');if(zoom)zoom.textContent=editorZoom+'%';
}
function updateSelectedProperty(key,value,visual=false){
 const layer=selectedLayer();
 if(layer){if(visual){layer.visual={...(layer.visual||{}),[key]:value};if(key==='backgroundColor')layer.color=value;}else layer[key]=value;setDirty();}
 else if(selectedElement){changeElement(edit=>{edit.styles={...(edit.styles||{})};if(key==='content')edit.text=String(value);else if(key==='color')edit.styles.color=value;else edit.styles[key]=value;});}
 renderPreview();renderTimeline();renderMobileSelectionBounds();updateMobileHeader();
}
function clearMobileSelection(){selectedLayerId=null;selectedLayerIds.clear();selectedElement=null;mobileEditorPanel='';renderLayers();renderPreview();renderMobileWorkbench();updateMobileHeader();}
function renderMobileTimeline(){
 const root=$('timelineTracks');if(!root)return;root.replaceChildren();const items=getActiveProjectLayers();
 if(!items.length){const empty=document.createElement('div');empty.className='timeline-empty';empty.textContent=project?.isDefault?'Mengambil daftar elemen halaman…':'Belum ada layer. Tekan + untuk menambahkan.';root.append(empty);return;}
 items.forEach(item=>{
  const id=item.id||item.selector,isText=item.type==='text'||/^h[1-6]$/.test(item.tag||'')||item.tag==='p'||item.textEditable;
  const active=project?.isDefault?selectedElement?.selector===item.selector:selectedLayerId===id;
  const row=document.createElement('div');row.className='timeline-row';row.dataset.id=id;
  const label=document.createElement('button');label.type='button';label.className='track-label';label.title='Tampilkan / sembunyikan';
  const eye=document.createElement('span');eye.className='track-eye';eye.textContent=item.visible===false?'◌':'◉';
  const type=document.createElement('span');type.className='track-type-icon';type.textContent=project?.isDefault?(item.tag==='img'?'▧':item.tag==='button'?'▱':isText?'T':'◇'):(TYPE_META[item.type]?.icon||'◇');
  label.append(eye,type);label.addEventListener('click',event=>{event.stopPropagation();if(!project?.isDefault){item.visible=item.visible===false;eye.textContent=item.visible?'◉':'◌';setDirty();renderPreview();}});
  const lane=document.createElement('div');lane.className='track-lane';
  const clip=document.createElement('button');clip.type='button';clip.className='track-clip'+(active?' active':'');clip.dataset.type=isText?'text':(item.type||item.tag||'media');
  const duration=Math.max(0,Number(item.duration)||10000),width=Math.max(25,Math.min(100,Number(item.timelineWidth)||Math.round(duration/10000*88)));clip.style.width=width+'%';
  const name=document.createElement('b');name.textContent=String(item.name||item.label||item.tag||TYPE_META[item.type]?.label||'Layer').slice(0,38);
  const handle=document.createElement('span');handle.className='track-handle';handle.textContent='≡';clip.append(name,handle);
  clip.addEventListener('click',()=>chooseMobileTimelineItem(item,id));clip.addEventListener('dragover',event=>event.preventDefault());clip.draggable=!project?.isDefault;
  clip.addEventListener('dragstart',event=>event.dataTransfer.setData('text/plain',id));
  clip.addEventListener('drop',event=>{event.preventDefault();const from=event.dataTransfer.getData('text/plain');if(!project||project.isDefault||from===id)return;const a=project.layers.findIndex(x=>x.id===from),b=project.layers.findIndex(x=>x.id===id);if(a<0||b<0)return;const [moving]=project.layers.splice(a,1);project.layers.splice(b,0,moving);setDirty();renderLayers();renderPreview();});
  lane.append(clip);row.append(label,lane);root.append(row);
 });
}
function chooseMobileTimelineItem(item,id){
 if(project?.isDefault){sendStudioMessage({type:'slf-studio-select-target',selector:item.selector});return;}
 selectedLayerId=id;selectedLayerIds.clear();selectedLayerIds.add(id);mobileEditorPanel='';renderLayers();renderPreview();renderMobileWorkbench();updateMobileHeader();
}
function renderTimeline(){renderMobileTimeline();updateTimecode();}
function renderLayers(){const legacy=$('layerList');if(legacy)legacy.replaceChildren();const count=$('layerCount');if(count)count.textContent=getActiveProjectLayers().length+' layer';renderTimeline();renderMobileWorkbench();updateMobileHeader();}
function renderProperties(){const root=$('propertyFields');if(root)root.replaceChildren();renderMobileWorkbench();}
function selectPanel(name){if(name==='layers'||name==='properties')mobileEditorPanel='';else if(name==='backend')mobileEditorPanel='presets';else if(name==='animation')mobileEditorPanel='effects';else if(name==='actions')mobileEditorPanel='presets';else mobileEditorPanel=name;renderMobileWorkbench();}
function renderMobileWorkbench(){
 const area=$('selectionTools'),grid=$('toolGrid'),panel=$('toolPanel');if(!area||!grid||!panel)return;
 const selected=Boolean(mobileSelectedItem());area.hidden=!selected;
 if(!selected){mobileEditorPanel='';grid.hidden=false;panel.hidden=true;panel.replaceChildren();return;}
 grid.hidden=Boolean(mobileEditorPanel);panel.hidden=!mobileEditorPanel;if(mobileEditorPanel)renderMobileSubpanel();updateMobileHeader();
}
function panelLayout(title,body){return '<div class="subpanel-layout"><nav class="subpanel-sidebar"><button type="button" data-panel-back title="Kembali">←</button><button type="button" data-sidebar-action="keyframe" title="Tambah Keyframe">♦+</button><button type="button" data-sidebar-action="easing" title="Kurva Easing">📈</button><button type="button" data-sidebar-action="options" title="Opsi">⋯</button></nav><div class="subpanel-content"><h3 class="subpanel-title">'+title+'<span>'+mobileEscape(mobileSelectedName())+'</span></h3>'+body+'</div></div>';}
function renderMobileSubpanel(){
 const root=$('toolPanel');if(!root||!mobileEditorPanel)return;const type=selectedLayer()?.type||selectedElement?.tag||'text',value=(key,fallback=0)=>mobileValue(key,fallback);
 let title='Pengaturan Layer',body='';
 if(mobileEditorPanel==='transform'){
  const tab=mobileTransformTab;let controls='';
  if(tab==='position')controls='<p class="subpanel-hint">Geser area sentuh untuk memindahkan layer.</p><div class="move-pad" id="movePad">Geser ke sini untuk memindahkan layer</div><div class="coordinate-grid"><label>X<input type="number" data-field="x" value="'+value('x',8)+'"></label><label>Y<input type="number" data-field="y" value="'+value('y',12)+'"></label><label>Z<input type="number" data-field="z" value="'+value('z',1)+'"></label></div>';
  if(tab==='rotation')controls='<div class="degree-wheel"><span id="degreeValue">'+value('rotation',0)+'°</span></div><label>Rotasi<input type="range" data-field="rotation" min="-180" max="180" step="1" value="'+value('rotation',0)+'"></label>';
  if(tab==='scale')controls='<div class="coordinate-grid"><label>Lebar<input type="range" data-field="scaleX" min="0.1" max="4" step="0.05" value="'+value('scaleX',1)+'"></label><label>Tinggi<input type="range" data-field="scaleY" min="0.1" max="4" step="0.05" value="'+value('scaleY',1)+'"></label></div><p class="subpanel-hint">Nilai 1.0 adalah ukuran asli. Ubah lebar dan tinggi secara terpisah.</p>';
  if(tab==='skew')controls='<label>Skew X<input type="range" data-field="skewX" min="-45" max="45" value="'+value('skewX',0)+'"></label><label>Skew Y<input type="range" data-field="skewY" min="-45" max="45" value="'+value('skewY',0)+'"></label>';
  title='Move & Transform';body='<div class="transform-layout"><div>'+controls+'</div><div class="transform-tabs"><button class="'+(tab==='position'?'active':'')+'" data-transform-tab="position">✥</button><button class="'+(tab==='rotation'?'active':'')+'" data-transform-tab="rotation">↻</button><button class="'+(tab==='scale'?'active':'')+'" data-transform-tab="scale">↗</button><button class="'+(tab==='skew'?'active':'')+'" data-transform-tab="skew">⌁</button></div></div>';
 }else if(mobileEditorPanel==='fill'){
  title='Color & Fill';const color=value('color',value('visual.backgroundColor','#4dd0c8'));
  body='<div class="color-tabs"><button class="active" data-fill-tab="none">Tanpa Warna</button><button data-fill-tab="solid">Solid</button><button data-fill-tab="gradient">Gradien</button><button data-fill-tab="media">Galeri HP</button></div><p class="subpanel-hint">Pilih warna layer, gradien, atau media dari galeri perangkat.</p><div class="color-swatches"><button data-swatch="#4dd0c8" style="background:#4dd0c8"></button><button data-swatch="#f4c542" style="background:#f4c542"></button><button data-swatch="#8b5cf6" style="background:#8b5cf6"></button><button data-swatch="#f43f5e" style="background:#f43f5e"></button><button data-swatch="#3b82f6" style="background:#3b82f6"></button><button data-swatch="#22c55e" style="background:#22c55e"></button><button data-swatch="#f8fafc" style="background:#f8fafc"></button><button data-swatch="#111827" style="background:#111827"></button></div><div class="color-wheel-row"><div class="color-wheel" aria-label="Roda warna HSV"></div><label>Warna aktif<input id="toolColor" type="color" value="'+color+'"></label><button class="subpanel-chip" id="eyeDropper" type="button">◎ Eyedropper</button></div><label>Warna kedua (gradien)<input id="toolGradientColor" type="color" value="#8b5cf6"></label><button class="tool-action-button" id="applyGradient" type="button">Terapkan Gradien</button>';
 }else if(mobileEditorPanel==='border'){
  title='Border & Shadow';const extra=mobileBorderTab==='shadow'?'<label>Ukuran bayangan<input type="range" data-field="shadowBlur" min="0" max="60" value="'+value('visual.shadowBlur',0)+'"></label><label>Alpha bayangan<input type="range" data-field="shadowAlpha" min="0" max="100" value="'+value('visual.shadowAlpha',55)+'"></label>':'<label>Ketebalan garis<input type="range" data-field="borderWidth" min="0" max="20" value="'+value('visual.borderWidth',mobileBorderTab==='add'?2:0)+'"></label><label>Warna garis<input type="color" data-field="borderColor" value="'+value('visual.borderColor','#4dd0c8')+'"></label><label>Radius sudut<input type="range" data-field="borderRadius" min="0" max="80" value="'+value('visual.borderRadius',8)+'"></label>';
  body='<div class="transform-layout"><div>'+extra+'</div><div class="transform-tabs"><button class="'+(mobileBorderTab==='stroke'?'active':'')+'" data-border-tab="stroke" title="Stroke">▱</button><button class="'+(mobileBorderTab==='add'?'active':'')+'" data-border-tab="add" title="Tambah Border">＋</button><button class="'+(mobileBorderTab==='shadow'?'active':'')+'" data-border-tab="shadow" title="Bayangan">◒</button></div></div>';
 }else if(mobileEditorPanel==='blend'){
  title='Blending & Opacity';const blend=value('blendMode','normal');
  body='<label>Opacity · <b id="opacityValue">'+Math.round(Number(value('opacity',1))*100)+'%</b><input type="range" data-field="opacity" min="0" max="100" value="'+Math.round(Number(value('opacity',1))*100)+'"></label><div class="blend-list"><button data-blend="normal" class="'+(blend==='normal'?'active':'')+'" type="button">Normal</button><button data-blend="darken" class="'+(blend==='darken'?'active':'')+'" type="button">Gelapkan</button><button data-blend="lighten" class="'+(blend==='lighten'?'active':'')+'" type="button">Cerah­kan</button><button data-blend="contrast" class="'+(blend==='contrast'?'active':'')+'" type="button">Kontras</button></div>';
 }else if(mobileEditorPanel==='edit'){
  title=type==='text'||selectedElement?.textEditable?'Edit Teks':type==='image'||type==='img'?'Edit Media':'Edit Bentuk';
  body='<div class="edit-text-bar"><button type="button" data-align="left">≡</button><select id="toolFont"><option>Inter</option><option>Arial</option><option>Georgia</option><option>Roboto</option></select><select id="toolFontSize"><option>12</option><option>14</option><option selected>18</option><option>24</option><option>32</option><option>48</option></select><input id="toolTextColor" type="color" value="'+value('color','#ffffff')+'"><button id="confirmEdit" type="button">✓</button></div><textarea id="toolText" placeholder="Isi teks layer..."></textarea><p class="subpanel-hint">Perubahan diterapkan ke layer atau elemen terpilih.</p><button class="tool-action-button" id="editMediaButton" type="button">Pilih media dari galeri</button>';
 }else if(mobileEditorPanel==='presets'){
  title='Presets / Action D1';
  body='<p class="subpanel-hint">Atur aksi elemen atau simpan data melalui tabel D1 yang diizinkan.</p><div class="blend-list"><button type="button" data-preset="fade">Fade</button><button type="button" data-preset="float">Float</button><button type="button" data-preset="pulse">Pulse</button><button type="button" data-preset="none">Reset efek</button></div><label>Jenis Action<select id="toolActionType"><option value="none">Tidak ada</option><option value="navigate">Buka halaman</option><option value="external">Tautan eksternal</option><option value="scroll">Scroll ke elemen</option><option value="backend-submit">Simpan ke D1</option><option value="backend-read">Baca dari D1</option></select></label><label>Target Action / Nama tabel<input id="toolActionTarget" type="text" placeholder="studio_event_signups"></label><button class="tool-action-button" id="openBackendTables" type="button">Kelola Backend D1</button>';
 }else if(mobileEditorPanel==='effects'){
  title='Efek';const activeEffects=selectedLayer()?.visual?.effects||[];
  body='<p class="subpanel-hint">Tambahkan efek visual pada layer yang sedang dipilih.</p><button class="tool-action-button" id="openEffectBrowser" type="button">＋ Tambahkan Efek</button><div class="color-swatches">'+activeEffects.map(effect=>'<button type="button" title="'+mobileEscape(effect)+'" data-remove-effect="'+mobileEscape(effect)+'" style="background:#4dd0c8;color:#071b20">'+mobileEscape(String(effect).slice(0,2).toUpperCase())+'</button>').join('')+'</div>';
 }else if(mobileEditorPanel==='speed'){
  title='Speed / Durasi';body='<p class="subpanel-hint">Atur kecepatan playback klip.</p><label>Kecepatan · <b id="speedValue">'+value('speed',1)+'×</b><input type="range" min="0.25" max="4" step="0.25" data-field="speed" value="'+value('speed',1)+'"></label><div class="blend-list"><button data-speed="0.5">0.5×</button><button data-speed="1">1×</button><button data-speed="1.5">1.5×</button><button data-speed="2">2×</button></div>';
 }else{title='Opsi Layer';body='<p class="subpanel-hint">Pilih salah satu pengaturan layer.</p><button class="tool-action-button" data-panel-back type="button">Kembali ke menu</button>';}
 root.innerHTML=panelLayout(title,body);
 const content=root.querySelector('.subpanel-content'),textArea=content.querySelector('#toolText');
 if(textArea)textArea.value=selectedLayer()?.content??selectedElement?.text??'';
 const actionType=content.querySelector('#toolActionType');if(actionType)actionType.value=mobileValue('actionType','none');
 const actionTarget=content.querySelector('#toolActionTarget');if(actionTarget)actionTarget.value=mobileValue('actionTarget','');
 const listen=(el,event,fn)=>{if(el)el.addEventListener(event,fn);};
 listen(root.querySelector('[data-panel-back]'),'click',()=>{mobileEditorPanel='';renderMobileWorkbench();});
 root.querySelectorAll('[data-transform-tab]').forEach(btn=>btn.addEventListener('click',()=>{mobileTransformTab=btn.dataset.transformTab;renderMobileSubpanel();}));
 root.querySelectorAll('[data-border-tab]').forEach(btn=>btn.addEventListener('click',()=>{mobileBorderTab=btn.dataset.borderTab;renderMobileSubpanel();}));
 root.querySelectorAll('[data-fill-tab]').forEach(btn=>btn.addEventListener('click',()=>{
  root.querySelectorAll('[data-fill-tab]').forEach(x=>x.classList.toggle('active',x===btn));
  if(btn.dataset.fillTab==='none')updateSelectedProperty('color','transparent');
  if(btn.dataset.fillTab==='gradient')applySelectedGradient();
  if(btn.dataset.fillTab==='media')$('studioMediaFile').click();
 }));
 root.querySelectorAll('[data-swatch]').forEach(btn=>btn.addEventListener('click',()=>{const color=btn.dataset.swatch;if($('toolColor'))$('toolColor').value=color;updateSelectedProperty('color',color);}));
 listen(content.querySelector('#toolColor'),'input',e=>updateSelectedProperty('color',e.target.value));
 listen(content.querySelector('#applyGradient'),'click',applySelectedGradient);
 listen(content.querySelector('#eyeDropper'),'click',async()=>{if(!window.EyeDropper){notify('Eyedropper tidak didukung browser ini.');return;}try{const result=await new EyeDropper().open();updateSelectedProperty('color',result.sRGBHex);}catch(_){}});
 listen(content.querySelector('#toolGradientColor'),'input',e=>{const layer=selectedLayer();if(layer){layer.visual={...(layer.visual||{}),gradient:{type:'linear',angle:135,stops:[{color:mobileValue('color','#4dd0c8'),position:0},{color:e.target.value,position:100}]}};setDirty();renderPreview();}});
 root.querySelectorAll('[data-field]').forEach(el=>el.addEventListener('input',e=>{
  const key=e.target.dataset.field;let v=(e.target.type==='range'||e.target.type==='number')?Number(e.target.value):e.target.value;
  if(key==='opacity')v=v/100;
  if(['x','y','z','rotation','scaleX','scaleY','skewX','skewY'].includes(key))v=Number(v);
  if(['borderWidth','borderRadius','shadowBlur'].includes(key))updateSelectedProperty(key,v,true);else if(key==='shadowAlpha')updateSelectedProperty(key,v,true);else updateSelectedProperty(key,v);
  if(key==='rotation'&&content.querySelector('#degreeValue'))content.querySelector('#degreeValue').textContent=v+'°';
  if(key==='opacity'&&content.querySelector('#opacityValue'))content.querySelector('#opacityValue').textContent=Math.round(v*100)+'%';
  if(key==='speed'&&content.querySelector('#speedValue'))content.querySelector('#speedValue').textContent=v+'×';
 }));
 root.querySelectorAll('[data-blend]').forEach(btn=>btn.addEventListener('click',()=>{updateSelectedProperty('blendMode',btn.dataset.blend);root.querySelectorAll('[data-blend]').forEach(x=>x.classList.toggle('active',x===btn));}));
 root.querySelectorAll('[data-speed]').forEach(btn=>btn.addEventListener('click',()=>{updateSelectedProperty('speed',Number(btn.dataset.speed));renderMobileSubpanel();}));
 root.querySelectorAll('[data-preset]').forEach(btn=>btn.addEventListener('click',()=>{const layer=selectedLayer();if(layer){layer.animation=btn.dataset.preset;setDirty();renderPreview();notify('Preset '+btn.dataset.preset+' diterapkan.');}}));
 listen(content.querySelector('#toolActionType'),'change',e=>updateSelectedProperty('actionType',e.target.value));
 listen(content.querySelector('#toolActionTarget'),'input',e=>updateSelectedProperty('actionTarget',e.target.value));
 listen(content.querySelector('#openBackendTables'),'click',()=>{if(role!=='owner'){openLogin('Login Owner diperlukan untuk mengelola Backend D1.');return;}loadBackendTables();notify('Daftar tabel Backend D1 sedang dimuat.');});
 listen(content.querySelector('#openEffectBrowser'),'click',()=>{$('effectBrowser').hidden=false;});
 listen(content.querySelector('#editMediaButton'),'click',()=> $('studioMediaFile').click());
 listen(content.querySelector('#confirmEdit'),'click',()=>{const text=$('toolText')?.value??'';updateSelectedProperty('content',text);mobileEditorPanel='';renderMobileWorkbench();});
 listen(content.querySelector('#toolText'),'input',e=>updateSelectedProperty('content',e.target.value));
 listen(content.querySelector('#toolFontSize'),'change',e=>updateSelectedProperty('fontSize',Number(e.target.value)));
 listen(content.querySelector('#toolFont'),'change',e=>updateSelectedProperty('fontFamily',e.target.value));
 listen(content.querySelector('#toolTextColor'),'input',e=>updateSelectedProperty('color',e.target.value));
 root.querySelectorAll('[data-align]').forEach(btn=>btn.addEventListener('click',()=>updateSelectedProperty('textAlign',btn.dataset.align)));
 root.querySelectorAll('[data-remove-effect]').forEach(btn=>btn.addEventListener('click',()=>{const layer=selectedLayer();if(layer){layer.visual.effects=(layer.visual.effects||[]).filter(x=>x!==btn.dataset.removeEffect);setDirty();renderPreview();renderMobileSubpanel();}}));
 root.querySelectorAll('[data-sidebar-action]').forEach(btn=>btn.addEventListener('click',()=>handleSubpanelSidebar(btn.dataset.sidebarAction)));
 listen(content.querySelector('#movePad'),'pointerdown',startMovePad);
}
function applySelectedGradient(){
 const color2=$('toolGradientColor')?.value||'#8b5cf6',color1=mobileValue('color','#4dd0c8'),layer=selectedLayer();
 if(layer){layer.visual={...(layer.visual||{}),gradient:{type:'linear',angle:135,stops:[{color:color1,position:0},{color:color2,position:100}]}};layer.color='transparent';setDirty();renderPreview();}
 else if(selectedElement)changeElement(x=>{x.styles={...(x.styles||{}),backgroundImage:'linear-gradient(135deg,'+color1+','+color2+')'};});
}
function startMovePad(event){
 const pad=event.currentTarget;if(!selectedLayer())return;event.preventDefault();pad.setPointerCapture?.(event.pointerId);
 const layer=selectedLayer(),startX=event.clientX,startY=event.clientY,origX=Number(layer.x||0),origY=Number(layer.y||0);
 const move=e=>{const r=pad.getBoundingClientRect();layer.x=Math.max(-100,Math.min(200,origX+(e.clientX-startX)/Math.max(1,r.width)*20));layer.y=Math.max(-100,Math.min(200,origY+(e.clientY-startY)/Math.max(1,r.height)*20));renderPreview();};
 const done=()=>{pad.removeEventListener('pointermove',move);pad.removeEventListener('pointerup',done);pad.removeEventListener('pointercancel',done);setDirty();renderTimeline();};
 pad.addEventListener('pointermove',move);pad.addEventListener('pointerup',done);pad.addEventListener('pointercancel',done);
}
function handleSubpanelSidebar(action){
 const item=mobileSelectedItem();if(!item)return;
 if(action==='keyframe'){
  if(selectedLayer()){const layer=selectedLayer();layer.keyframes=Array.isArray(layer.keyframes)?layer.keyframes:[];layer.keyframes.push({time:currentTimeMs,x:layer.x||0,y:layer.y||0,rotation:layer.rotation||0,opacity:layer.opacity??1});setDirty();renderTimeline();notify('Keyframe ditambahkan.');}
  else notify('Keyframe untuk elemen website belum tersedia.');
 }else if(action==='easing'){const layer=selectedLayer();if(layer){layer.easing=layer.easing==='ease'?'ease-in-out':'ease';setDirty();notify('Kurva easing: '+layer.easing);}else notify('Kurva easing hanya tersedia untuk layer project.');}
 else if(action==='options'){const menu=$('layerMenu');if(menu)menu.hidden=!menu.hidden;}
}
function renderMobileSelectionBounds(){
 const bounds=$('selectionBounds');if(!bounds)return;bounds.hidden=true;bounds.replaceChildren();bounds.className='selection-bounds';
 const layer=selectedLayer();
 if(layer){const node=[...document.querySelectorAll('#previewOverlay .preview-layer')].find(el=>el.dataset.layerId===layer.id);if(node){node.querySelectorAll('.selection-handle').forEach(x=>x.remove());['nw','n','ne','e','se','s','sw','w'].forEach(pos=>{const dot=document.createElement('span');dot.className='selection-handle '+pos;node.append(dot);});}return;}
 if(project?.isDefault&&selectedElement?.selector){
  try{const doc=$('pagePreviewFrame').contentDocument,target=doc?.querySelector(selectedElement.selector),frame=$('pagePreviewFrame');if(!target||!frame)return;const r=target.getBoundingClientRect(),fr=frame.getBoundingClientRect();if(!fr.width||!fr.height)return;
   bounds.style.left=((r.left-fr.left)/fr.width*100)+'%';bounds.style.top=((r.top-fr.top)/fr.height*100)+'%';bounds.style.width=(r.width/fr.width*100)+'%';bounds.style.height=(r.height/fr.height*100)+'%';
   ['nw','n','ne','e','se','s','sw','w'].forEach(pos=>{const dot=document.createElement('span');dot.className='selection-handle '+pos;bounds.append(dot);});bounds.hidden=false;
  }catch(_){}
 }
}
function renderPreview(){renderPreviewLegacy();renderMobileSelectionBounds();}
function quickLayerAction(action){
 const layer=selectedLayer();if(action==='speed'){mobileEditorPanel='speed';renderMobileWorkbench();return;}if(action==='action'){mobileEditorPanel='presets';renderMobileWorkbench();return;}
 if(!layer){notify('Pilih layer project terlebih dahulu.');return;}
 const start=Number(layer.startTime||0),end=start+Number(layer.duration||10000);
 if(action==='trim-left'){if(currentTimeMs>=end){notify('Playhead berada di luar klip.');return;}layer.startTime=currentTimeMs;layer.duration=Math.max(100,end-currentTimeMs);}
 else if(action==='trim-right'){if(currentTimeMs<=start){notify('Geser playhead ke dalam klip untuk Trim Kanan.');return;}layer.duration=Math.max(100,currentTimeMs-start);}
 else if(action==='split'){
  if(currentTimeMs<=start||currentTimeMs>=end){notify('Playhead harus berada di tengah klip untuk Split.');return;}
  const clone=JSON.parse(JSON.stringify(layer));clone.id=uid();clone.name=(clone.name||'Layer')+' · Split';clone.startTime=currentTimeMs;clone.duration=end-currentTimeMs;layer.duration=currentTimeMs-start;
  const index=project.layers.findIndex(x=>x.id===layer.id);project.layers.splice(index+1,0,clone);selectedLayerId=clone.id;
 }
 setDirty();renderLayers();renderPreview();renderMobileWorkbench();
}
function duplicateMobileLayer(){
 const layer=selectedLayer();
 if(layer){pushEditorHistory();const copy=JSON.parse(JSON.stringify(layer));copy.id=uid();copy.name=(copy.name||'Layer')+' · Salinan';copy.x=Math.min(95,(Number(copy.x)||8)+3);copy.y=Math.min(95,(Number(copy.y)||8)+3);project.layers.push(copy);selectedLayerId=copy.id;selectedLayerIds.clear();selectedLayerIds.add(copy.id);setDirty();renderLayers();renderPreview();return;}
 if(selectedElement)runLayerAction('duplicate');
}
function deleteMobileLayer(){
 const layer=selectedLayer();
 if(layer){pushEditorHistory();project.layers=project.layers.filter(x=>x.id!==layer.id);selectedLayerId=null;selectedLayerIds.clear();setDirty();renderLayers();renderPreview();return;}
 if(selectedElement){if(selectedElement.created&&selectedElement.id)sendStudioMessage({type:'slf-studio-remove',id:selectedElement.id});else changeElement(x=>x.hidden=true);selectedElement=null;renderLayers();renderPreview();}
}
function initMobileEditorUI(){
 const back=$('editorBack');
 if(back)back.onclick=()=>{if(mobileSelectedItem()||mobileEditorPanel){clearMobileSelection();return;}if(dirty&&!confirm('Perubahan belum disimpan. Keluar dan buang perubahan terakhir?'))return;setView('lobby');};
 $('duplicateLayer').onclick=duplicateMobileLayer;$('deleteLayer').onclick=deleteMobileLayer;
 $('layerOptionsButton').onclick=()=>$('layerMenu').hidden=!$('layerMenu').hidden;
 $('addLayerInline').onclick=openSheet;$('layerMenuButton').onclick=()=>$('layerMenu').hidden=!$('layerMenu').hidden;
 $('editorSidebarButton').onclick=()=>{$('mobileEditorDock').classList.toggle('sidebar-expanded');};
 $('timelinePrevious').onclick=()=>{currentTimeMs=0;updateTimecode();};
 $('timelineNext').onclick=()=>{currentTimeMs=10000;updateTimecode();};
 $('timelinePlay').onclick=()=>{
  timelinePlaying=!timelinePlaying;
  $('timelinePlay').innerHTML=timelinePlaying?'<svg viewBox="0 0 24 24"><path d="M7 5v14M17 5v14"/></svg>':'<svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7z"/></svg>';
  if(timelinePlaying){const start=performance.now()-currentTimeMs;const tick=now=>{if(!timelinePlaying)return;currentTimeMs=(now-start)%10000;updateTimecode();timelineFrame=requestAnimationFrame(tick);};timelineFrame=requestAnimationFrame(tick);}else cancelAnimationFrame(timelineFrame);
 };
 document.querySelectorAll('[data-tool-panel]').forEach(btn=>btn.addEventListener('click',()=>{mobileEditorPanel=btn.dataset.toolPanel;mobileTransformTab='position';mobileBorderTab='stroke';renderMobileWorkbench();}));
 document.querySelectorAll('[data-quick-action]').forEach(btn=>btn.addEventListener('click',()=>quickLayerAction(btn.dataset.quickAction)));
 document.querySelectorAll('[data-canvas-zoom]').forEach(btn=>btn.addEventListener('click',()=>{editorZoom=Math.max(50,Math.min(200,editorZoom+Number(btn.dataset.canvasZoom)));updateModeUi();updateMobileHeader();}));
 $('effectBrowserClose').onclick=()=>{$('effectBrowser').hidden=true;};
 document.querySelectorAll('[data-effect]').forEach(btn=>btn.addEventListener('click',()=>{
  const effect=btn.dataset.effect,layer=selectedLayer();
  if(layer){layer.visual={...(layer.visual||{}),effects:[...new Set([...(layer.visual?.effects||[]),effect])]};setDirty();renderPreview();notify('Efek '+effect+' ditambahkan.');}
  else if(selectedElement)changeElement(x=>{x.effects=[...new Set([...(x.effects||[]),effect])];});
  $('effectBrowser').hidden=true;mobileEditorPanel='effects';renderMobileWorkbench();
 }));
 $('effectSearch').addEventListener('input',e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('[data-effect]').forEach(btn=>btn.hidden=!btn.textContent.toLowerCase().includes(q));});
 const ruler=$('timelineRuler');if(ruler)ruler.addEventListener('click',event=>{const rect=ruler.getBoundingClientRect();currentTimeMs=Math.round(Math.max(0,Math.min(1,(event.clientX-rect.left)/Math.max(1,rect.width)))*10000);updateTimecode();});
 $('exportAction').onclick=()=>{const choice=document.querySelector('input[name="exportChoice"]:checked')?.value||'publish';const id={publish:'publishWebsite',draft:'saveDraftD1',json:'downloadProjectJson',png:'exportCurrentPng'}[choice];$(id)?.click();};
 $('exportProject').onclick=openExportSheet;
 renderLayers();renderMobileWorkbench();updateMobileHeader();
}


let mediaUploadBusy=false;
function switchAddTab(name){
 addTab=name;document.querySelectorAll('[data-add-tab]').forEach(button=>button.classList.toggle('active',button.dataset.addTab===name));
 const panels={shape:'geometryGrid',media:'mediaLibraryPanel',audio:'audioLibraryPanel',object:'objectGrid',template:'motionTemplateGrid'};
 Object.values(panels).forEach(id=>{const el=$(id);if(el)el.hidden=true;});
 const active=$(panels[name]||panels.shape);if(active)active.hidden=false;
 if(name==='media')renderProjectMediaGallery('image');if(name==='audio')renderProjectMediaGallery('audio');
}
function mediaAssetList(kind){
 const list=[],seen=new Set();
 (project?.mediaAssets||[]).forEach(asset=>{if(asset&&asset.url&&asset.type===kind&&!seen.has(asset.url)){seen.add(asset.url);list.push(asset);}});
 (project?.layers||[]).forEach(layer=>{if(layer.src&&layer.type===kind&&!seen.has(layer.src)){seen.add(layer.src);list.push({id:layer.id,url:layer.src,name:layer.name,type:kind});}});
 return list;
}
function renderProjectMediaGallery(kind){
 const root=$(kind==='audio'?'audioGallery':'mediaGallery');if(!root)return;root.replaceChildren();const assets=mediaAssetList(kind);
 if(!assets.length){const empty=document.createElement('p');empty.className='media-empty';empty.textContent='Belum ada '+(kind==='audio'?'audio':'foto/video')+' tersimpan di proyek ini.';root.append(empty);return;}
 assets.forEach(asset=>{
  const button=document.createElement('button');button.type='button';button.className='media-library-item';
  if(kind==='image'||kind==='video'){const thumb=document.createElement(kind==='video'?'video':'img');thumb.src=asset.url;if(kind==='video'){thumb.muted=true;thumb.playsInline=true;}else thumb.alt=asset.name||'Media proyek';button.append(thumb);}
  else{const icon=document.createElement('span');icon.className='media-audio-icon';icon.textContent='♫';button.append(icon);}
  const name=document.createElement('b');name.textContent=asset.name||'Media';button.append(name);button.addEventListener('click',()=>insertExistingMedia(asset));root.append(button);
 });
}
function mediaLayerFromAsset(asset){
 const type=asset.type||'image';return {id:uid(),type,name:asset.name||'Media',src:asset.url,previewSrc:asset.url,content:'',x:type==='audio'?0:10,y:type==='audio'?0:12,width:type==='audio'?0:80,height:type==='audio'?0:72,z:Math.max(1,...(project.layers||[]).map(x=>Number(x.z)||0))+1,rotation:0,scaleX:1,scaleY:1,skewX:0,skewY:0,opacity:1,visible:true,visual:{},keyframes:[],easing:'ease',color:'transparent',actionType:'none',actionTarget:'',duration:10000,mediaFit:'contain'};
}
function insertExistingMedia(asset){
 if(!project||project.isDefault){notify('Galeri media proyek tersedia pada proyek baru.');return;}
 pushEditorHistory();const layer=mediaLayerFromAsset(asset);project.layers.unshift(layer);selectedLayerId=layer.id;selectedLayerIds.clear();selectedLayerIds.add(layer.id);setDirty();closeSheet();renderLayers();renderPreview();renderMobileWorkbench();updateMobileHeader();notify('Media ditambahkan ke kanvas.');
}
async function handleStudioUpload(file,mediaType){
 if(!file)return;const isAudio=mediaType==='audio';
 if(isAudio?!/^audio\//.test(file.type):!/^image\//.test(file.type)&&!/^video\//.test(file.type))throw new Error('Jenis file tidak didukung.');
 if(file.size>15*1024*1024)throw new Error('Ukuran file maksimal 15 MB.');
 const type=isAudio?'audio':file.type.startsWith('video/')?'video':'image',localUrl=URL.createObjectURL(file),name=file.name.replace(/\.[^.]+$/,'').slice(0,70)||TYPE_META[type].label;
 if(project?.isDefault){sendStudioMessage({type:'slf-studio-add',kind:type,text:name,src:localUrl});closeSheet();notify('Preview media ditampilkan. Mengunggah ke pustaka…');try{const asset=await uploadAsset(file);let tries=0;while(tries<12&&(!selectedElement||selectedElement.src!==localUrl)){await new Promise(resolve=>setTimeout(resolve,120));tries++;}if(selectedElement&&selectedElement.src===localUrl){pushEditorHistory();changeElement(edit=>{edit.src=asset.url;edit.backgroundImage=type==='image'&&!['img','video','audio'].includes(selectedElement.tag);});}else{siteDesign=siteDesign||{elementEdits:[],insertedElements:[],freeLayers:[]};siteDesign.freeLayers=siteDesign.freeLayers||[];siteDesign.freeLayers.push({id:uid(),type,src:asset.url,name});sendStudioMessage({type:'slf-studio-free-layers',layers:siteDesign.freeLayers});}try{URL.revokeObjectURL(localUrl);}catch(_){}notify('Media berhasil diunggah.');}catch(err){notify('Preview tampil, tetapi upload gagal: '+(err.message||'periksa sesi Admin'));}return;}
 if(!project){URL.revokeObjectURL(localUrl);throw new Error('Buka proyek terlebih dahulu.');}
 pushEditorHistory();
 const layer={id:uid(),type,name,src:localUrl,previewSrc:localUrl,localPreviewUrl:localUrl,uploading:true,content:'',x:type==='audio'?0:10,y:type==='audio'?0:12,width:type==='audio'?0:80,height:type==='audio'?0:72,z:Math.max(1,...(project.layers||[]).map(x=>Number(x.z)||0))+1,rotation:0,scaleX:1,scaleY:1,skewX:0,skewY:0,opacity:1,visible:true,visual:{},keyframes:[],easing:'ease',color:'transparent',actionType:'none',actionTarget:'',duration:10000,mediaFit:'contain'};
 project.layers.unshift(layer);selectedLayerId=layer.id;selectedLayerIds.clear();selectedLayerIds.add(layer.id);setDirty();closeSheet();renderLayers();renderPreview();renderMobileWorkbench();updateMobileHeader();notify('Preview media ditampilkan. Mengunggah file…');
 try{
  const asset=await uploadAsset(file);layer.src=asset.url;layer.previewSrc=asset.url;layer.uploading=false;layer.assetId=asset.id||'';
  project.mediaAssets=Array.isArray(project.mediaAssets)?project.mediaAssets:[];
  if(!project.mediaAssets.some(x=>x.url===asset.url))project.mediaAssets.unshift({id:asset.id||uid(),url:asset.url,name,type,createdAt:new Date().toISOString()});
  setDirty();renderLayers();renderPreview();renderMobileWorkbench();await put(PROJECTS_KEY,projects);try{URL.revokeObjectURL(localUrl);}catch(_){}notify('Media berhasil diunggah dan ditambahkan ke project.');
 }catch(err){layer.uploading=false;layer.uploadError=true;setDirty();renderLayers();renderPreview();notify('Preview tetap tersedia, tetapi upload gagal: '+(err.message||'periksa koneksi dan sesi Admin.'));}
}
function addGeometryLayer(geometry){
 const names={circle:'Lingkaran',square:'Persegi','round-rect':'Persegi Bulat',plus:'Plus',arc:'Busur',triangle:'Segitiga',pie:'Pie',hexagon:'Segi Enam',star:'Bintang',arrow:'Panah',trapezoid:'Trapesium',pentagon:'Pentagon',line:'Garis',ellipse:'Elips',diamond:'Belah Ketupat',cross:'Silang'};
 if(project?.isDefault){addBuiltinElement('shape');return;}if(!project)return;pushEditorHistory();
 const layer={id:uid(),type:'shape',geometry,name:names[geometry]||'Bentuk',content:'',src:'',x:28,y:30,width:44,height:36,z:Math.max(1,...(project.layers||[]).map(x=>Number(x.z)||0))+1,rotation:0,scaleX:1,scaleY:1,skewX:0,skewY:0,opacity:1,visible:true,visual:{},color:'#4dd0c8',keyframes:[],duration:10000};
 project.layers.unshift(layer);selectedLayerId=layer.id;selectedLayerIds.clear();selectedLayerIds.add(layer.id);setDirty();renderLayers();renderPreview();renderMobileWorkbench();updateMobileHeader();closeSheet();
}
function addLayer(type){
 if(type==='text'&&project?.isDefault){addBuiltinElement('text');return;}if(!TYPE_META[type]||!project)return;
 const layer={id:uid(),type,name:TYPE_META[type].label+' '+(project.layers.length+1),content:type==='text'?'Teks baru':type==='button'?'Klik di sini':type==='card'?'Informasi baru':type==='input'?'Masukkan data':'',src:'',href:'',fieldName:type==='input'?'field_'+(project.layers.length+1):'',rows:[],x:25,y:35,width:50,height:22,z:Math.max(1,...project.layers.map(x=>Number(x.z)||0))+1,rotation:0,scaleX:1,scaleY:1,skewX:0,skewY:0,opacity:1,visible:true,visual:{},keyframes:[],easing:'ease',color:'#18e6b0',actionType:'none',actionTarget:'',animation:'none',clickAnimation:'none',loop:false,duration:10000};
 pushEditorHistory();project.layers.unshift(layer);selectedLayerId=layer.id;selectedLayerIds.clear();selectedLayerIds.add(layer.id);setDirty();renderLayers();renderPreview();renderMobileWorkbench();closeSheet();
}


function drumRulerMarkup(key,label,min,max,step,value,suffix){
 const ticks=Array.from({length:17},(_,i)=>'<i class="'+(i%4===0?'major':'')+'"></i>').join('');
 const v=Number(value)||0;
 return '<div class="drum-control"><div><div class="drum-control-label">'+label+'</div><div class="drum-ruler" role="slider" tabindex="0" aria-label="'+label+'" data-ruler-key="'+key+'" data-min="'+min+'" data-max="'+max+'" data-step="'+step+'" data-value="'+v+'"><span class="ruler-center"></span><span class="ruler-ticks">'+ticks+'</span><span class="ruler-major"></span></div></div><output data-ruler-output="'+key+'">'+v+(suffix||'')+'</output></div>';
}
function panelLayout(title,body){
 return '<div class="subpanel-layout"><nav class="subpanel-sidebar"><button type="button" data-panel-back title="Kembali">←</button><button type="button" data-sidebar-action="keyframe" title="Tambah Keyframe">♦+</button><button type="button" data-sidebar-action="easing" title="Kurva Easing">⌁</button><button type="button" data-sidebar-action="options" title="Opsi">⋯</button></nav><div class="subpanel-content">'+body+'</div></div>';
}
function renderMobileSubpanel(){
 const root=$('toolPanel');if(!root||!mobileEditorPanel)return;
 const type=selectedLayer()?.type||selectedElement?.tag||'text',value=(key,fallback=0)=>mobileValue(key,fallback);
 let body='';
 if(mobileEditorPanel==='transform'){
  const tab=mobileTransformTab;let controls='';
  if(tab==='position')controls='<p class="subpanel-hint">Geser touchpad untuk memindahkan layer.</p><div class="move-pad" id="movePad">Geser ke sini untuk memindahkan layer</div><div class="coordinate-grid"><label>X<input type="number" data-field="x" value="'+value('x',8)+'"></label><label>Y<input type="number" data-field="y" value="'+value('y',12)+'"></label><label>Z<input type="number" data-field="z" value="'+value('z',1)+'"></label></div>';
  if(tab==='rotation')controls='<div class="degree-wheel" id="degreeWheel" role="slider" aria-label="Putar layer" tabindex="0"><span id="degreeValue">'+value('rotation',0)+'°</span></div><p class="subpanel-hint" style="text-align:center">Sentuh dan putar cincin derajat</p>';
  if(tab==='scale')controls=drumRulerMarkup('scaleX','Lebar',0.1,4,0.05,value('scaleX',1),'×')+drumRulerMarkup('scaleY','Tinggi',0.1,4,0.05,value('scaleY',1),'×');
  if(tab==='skew')controls=drumRulerMarkup('skewX','Skew X',-45,45,1,value('skewX',0),'°')+drumRulerMarkup('skewY','Skew Y',-45,45,1,value('skewY',0),'°');
  body='<div class="transform-layout"><div>'+controls+'</div><div class="transform-tabs"><button class="'+(tab==='position'?'active':'')+'" data-transform-tab="position" title="Posisi">✥</button><button class="'+(tab==='rotation'?'active':'')+'" data-transform-tab="rotation" title="Rotasi">↻</button><button class="'+(tab==='scale'?'active':'')+'" data-transform-tab="scale" title="Skala">↗</button><button class="'+(tab==='skew'?'active':'')+'" data-transform-tab="skew" title="Skew">⌁</button></div></div>';
 }else if(mobileEditorPanel==='fill'){
  const color=value('color',value('visual.backgroundColor','#4dd0c8'));
  body='<div class="color-tabs"><button class="active" data-fill-tab="none">Tanpa Warna</button><button data-fill-tab="solid">Solid</button><button data-fill-tab="gradient">Gradien</button><button data-fill-tab="media">Galeri HP</button></div><p class="subpanel-hint">Pilih warna atau gradien untuk layer aktif.</p><div class="color-swatches"><button data-swatch="#4dd0c8" style="background:#4dd0c8"></button><button data-swatch="#f4c542" style="background:#f4c542"></button><button data-swatch="#8b5cf6" style="background:#8b5cf6"></button><button data-swatch="#f43f5e" style="background:#f43f5e"></button><button data-swatch="#3b82f6" style="background:#3b82f6"></button><button data-swatch="#22c55e" style="background:#22c55e"></button><button data-swatch="#f8fafc" style="background:#f8fafc"></button><button data-swatch="#111827" style="background:#111827"></button></div><div class="color-wheel-row"><div class="color-wheel" aria-label="Roda warna HSV"></div><label>Warna aktif<input id="toolColor" type="color" value="'+color+'"></label><button class="subpanel-chip" id="eyeDropper" type="button">◎ Eyedropper</button></div><label>Warna kedua<input id="toolGradientColor" type="color" value="#8b5cf6"></label><button class="tool-action-button" id="applyGradient" type="button">Terapkan Gradien</button>';
 }else if(mobileEditorPanel==='border'){
  const stroke=value('visual.strokeEnabled',false),shadow=value('visual.shadowEnabled',false);
  let detail='';
  if(mobileBorderTab==='stroke')detail='<div class="subpanel-toggle"><span>Stroke</span><button type="button" data-visual-toggle="strokeEnabled" class="'+(stroke?'on':'')+'">'+(stroke?'ON':'OFF')+'</button></div><label>Warna Stroke<input type="color" data-visual-field="strokeColor" value="'+value('visual.strokeColor','#4dd0c8')+'"></label>'+drumRulerMarkup('visual.strokeWidth','Ketebalan Stroke',0,40,0.5,value('visual.strokeWidth',4),' px')+'<label>Sambungan Sudut<select data-visual-field="strokeJoin"><option value="round">Round</option><option value="bevel">Bevel</option><option value="miter">Miter</option></select></label><div class="coordinate-grid"><label>Mulai (%)<input type="number" data-visual-field="strokeStart" value="'+value('visual.strokeStart',0)+'"></label><label>End (%)<input type="number" data-visual-field="strokeEnd" value="'+value('visual.strokeEnd',100)+'"></label></div>';
  if(mobileBorderTab==='border')detail='<p class="subpanel-hint">Posisi border pada tepi layer.</p><div class="blend-list"><button data-border-position="inside" class="'+(value('visual.borderPosition','center')==='inside'?'active':'')+'">DI DALAM</button><button data-border-position="center" class="'+(value('visual.borderPosition','center')==='center'?'active':'')+'">TENGAH</button><button data-border-position="outside" class="'+(value('visual.borderPosition','center')==='outside'?'active':'')+'">DI LUAR</button></div><label>Warna Border<input type="color" data-visual-field="borderColor" value="'+value('visual.borderColor','#4dd0c8')+'"></label>'+drumRulerMarkup('visual.borderWidth','Ukuran Border',0,40,0.5,value('visual.borderWidth',2),' px')+drumRulerMarkup('visual.borderRadius','Radius Sudut',0,100,1,value('visual.borderRadius',8),' px');
  if(mobileBorderTab==='shadow')detail='<div class="subpanel-toggle"><span>Shadow</span><button type="button" data-visual-toggle="shadowEnabled" class="'+(shadow?'on':'')+'">'+(shadow?'ON':'OFF')+'</button></div><label>Warna Bayangan<input type="color" data-visual-field="shadowColor" value="'+value('visual.shadowColor','#000000')+'"></label>'+drumRulerMarkup('visual.shadowBlur','Ukuran Shadow',0,100,1,value('visual.shadowBlur',12),' px')+drumRulerMarkup('visual.shadowAlpha','Alpha Shadow',0,100,1,value('visual.shadowAlpha',55),'%')+'<p class="subpanel-hint">Geser touchpad untuk posisi bayangan (X/Y).</p><div class="shadow-position-pad" id="shadowPositionPad">✥</div><div class="coordinate-grid"><label>X<input type="number" data-field="shadowX" value="'+value('visual.shadowX',0)+'"></label><label>Y<input type="number" data-field="shadowY" value="'+value('visual.shadowY',6)+'"></label></div>';
  body='<div class="border-transform-layout"><div>'+detail+'</div><nav class="border-transform-tabs"><button class="'+(mobileBorderTab==='stroke'?'active':'')+'" data-border-tab="stroke" title="Stroke">▱</button><button class="'+(mobileBorderTab==='border'?'active':'')+'" data-border-tab="border" title="Border">▣</button><button class="'+(mobileBorderTab==='shadow'?'active':'')+'" data-border-tab="shadow" title="Bayangan">◒</button></nav></div>';
 }else if(mobileEditorPanel==='blend'){
  const blend=value('blendMode','normal');
  body='<label>Opacity · <b id="opacityValue">'+Math.round(Number(value('opacity',1))*100)+'%</b><input type="range" data-field="opacity" min="0" max="100" value="'+Math.round(Number(value('opacity',1))*100)+'"></label><div class="blend-list"><button data-blend="normal" class="'+(blend==='normal'?'active':'')+'" type="button">Normal</button><button data-blend="darken" class="'+(blend==='darken'?'active':'')+'" type="button">Gelapkan</button><button data-blend="lighten" class="'+(blend==='lighten'?'active':'')+'" type="button">Cerah­kan</button><button data-blend="contrast" class="'+(blend==='contrast'?'active':'')+'" type="button">Kontras</button></div>';
 }else if(mobileEditorPanel==='edit'){
  const text=selectedLayer()?.content??selectedElement?.text??'';
  body='<div class="edit-text-bar"><button type="button" data-align="left">≡</button><select id="toolFont"><option>Inter</option><option>Arial</option><option>Georgia</option><option>Roboto</option></select><select id="toolFontSize"><option>12</option><option>14</option><option selected>18</option><option>24</option><option>32</option><option>48</option></select><input id="toolTextColor" type="color" value="'+value('color','#ffffff')+'"><button id="confirmEdit" type="button">✓</button></div><textarea id="toolText" placeholder="Isi teks layer...">'+mobileEscape(text)+'</textarea><button class="tool-action-button" id="editMediaButton" type="button">Pilih media dari galeri</button>';
 }else if(mobileEditorPanel==='presets'){
  body='<p class="subpanel-hint">Presets dan action untuk layer aktif.</p><div class="blend-list"><button data-preset="fade">Fade</button><button data-preset="float">Float</button><button data-preset="pulse">Pulse</button><button data-preset="none">Reset</button></div><label>Jenis Action<select id="toolActionType"><option value="none">Tidak ada</option><option value="navigate">Buka halaman</option><option value="external">Tautan eksternal</option><option value="scroll">Scroll ke elemen</option><option value="backend-submit">Simpan ke D1</option><option value="backend-read">Baca dari D1</option></select></label><label>Target Action<input id="toolActionTarget" type="text" placeholder="studio_event_signups"></label><button class="tool-action-button" id="openBackendTables" type="button">Kelola Backend D1</button>';
 }else if(mobileEditorPanel==='effects'){
  const effects=selectedLayer()?.visual?.effects||[];
  body='<button class="tool-action-button" id="openEffectBrowser" type="button">＋ Tambahkan Efek</button><div class="color-swatches">'+effects.map(effect=>'<button type="button" data-remove-effect="'+mobileEscape(effect)+'">'+mobileEscape(String(effect).slice(0,2).toUpperCase())+'</button>').join('')+'</div>';
 }else if(mobileEditorPanel==='speed'){
  body='<label>Kecepatan · <b id="speedValue">'+value('speed',1)+'×</b><input type="range" min="0.25" max="4" step="0.25" data-field="speed" value="'+value('speed',1)+'"></label><div class="blend-list"><button data-speed="0.5">0.5×</button><button data-speed="1">1×</button><button data-speed="1.5">1.5×</button><button data-speed="2">2×</button></div>';
 }else{body='<button class="tool-action-button" type="button" data-panel-back>Kembali</button>';}
 root.innerHTML=panelLayout(mobileEditorPanel,body);
 const content=root.querySelector('.subpanel-content'),listen=(el,event,fn)=>{if(el)el.addEventListener(event,fn);};
 const actionType=content.querySelector('#toolActionType');if(actionType)actionType.value=mobileValue('actionType','none');
 const actionTarget=content.querySelector('#toolActionTarget');if(actionTarget)actionTarget.value=mobileValue('actionTarget','');
 listen(root.querySelector('[data-panel-back]'),'click',()=>{mobileEditorPanel='';renderMobileWorkbench();});
 root.querySelectorAll('[data-transform-tab]').forEach(btn=>btn.addEventListener('click',()=>{mobileTransformTab=btn.dataset.transformTab;renderMobileSubpanel();}));
 root.querySelectorAll('[data-border-tab]').forEach(btn=>btn.addEventListener('click',()=>{mobileBorderTab=btn.dataset.borderTab;renderMobileSubpanel();}));
 root.querySelectorAll('[data-fill-tab]').forEach(btn=>btn.addEventListener('click',()=>{root.querySelectorAll('[data-fill-tab]').forEach(x=>x.classList.toggle('active',x===btn));if(btn.dataset.fillTab==='none')updateSelectedProperty('color','transparent');if(btn.dataset.fillTab==='gradient')applySelectedGradient();if(btn.dataset.fillTab==='media')$('studioMediaFile').click();}));
 root.querySelectorAll('[data-swatch]').forEach(btn=>btn.addEventListener('click',()=>{if($('toolColor'))$('toolColor').value=btn.dataset.swatch;updateSelectedProperty('color',btn.dataset.swatch);}));
 listen(content.querySelector('#toolColor'),'input',e=>updateSelectedProperty('color',e.target.value));
 listen(content.querySelector('#applyGradient'),'click',applySelectedGradient);
 listen(content.querySelector('#eyeDropper'),'click',async()=>{if(!window.EyeDropper){notify('Eyedropper tidak didukung browser ini.');return;}try{const result=await new EyeDropper().open();updateSelectedProperty('color',result.sRGBHex);}catch(_){}});
 listen(content.querySelector('#toolGradientColor'),'input',e=>{const layer=selectedLayer();if(layer){layer.visual={...(layer.visual||{}),gradient:{type:'linear',angle:135,stops:[{color:mobileValue('color','#4dd0c8'),position:0},{color:e.target.value,position:100}]}};setDirty();renderPreview();}});
 root.querySelectorAll('[data-field]').forEach(el=>el.addEventListener('input',e=>{const key=e.target.dataset.field;let val=(e.target.type==='number'||e.target.type==='range')?Number(e.target.value):e.target.value;if(key==='opacity')val/=100;if(key.startsWith('visual.'))updateSelectedProperty(key.slice(7),val,true);else updateSelectedProperty(key,val);}));
 root.querySelectorAll('[data-visual-field]').forEach(el=>el.addEventListener('input',e=>updateSelectedProperty(e.target.dataset.visualField,e.target.type==='color'?e.target.value:(Number(e.target.value)||e.target.value),true)));
 root.querySelectorAll('[data-visual-toggle]').forEach(btn=>btn.addEventListener('click',()=>{const key=btn.dataset.visualToggle,val=!(selectedLayer()?.visual?.[key]);updateSelectedProperty(key,val,true);renderMobileSubpanel();}));
 root.querySelectorAll('[data-border-position]').forEach(btn=>btn.addEventListener('click',()=>{updateSelectedProperty('borderPosition',btn.dataset.borderPosition,true);renderMobileSubpanel();}));
 root.querySelectorAll('[data-blend]').forEach(btn=>btn.addEventListener('click',()=>{updateSelectedProperty('blendMode',btn.dataset.blend);root.querySelectorAll('[data-blend]').forEach(x=>x.classList.toggle('active',x===btn));}));
 root.querySelectorAll('[data-speed]').forEach(btn=>btn.addEventListener('click',()=>{updateSelectedProperty('speed',Number(btn.dataset.speed));renderMobileSubpanel();}));
 root.querySelectorAll('[data-preset]').forEach(btn=>btn.addEventListener('click',()=>{const layer=selectedLayer();if(layer){layer.animation=btn.dataset.preset;setDirty();renderPreview();notify('Preset '+btn.dataset.preset+' diterapkan.');}}));
 listen(content.querySelector('#toolActionType'),'change',e=>updateSelectedProperty('actionType',e.target.value));
 listen(content.querySelector('#toolActionTarget'),'input',e=>updateSelectedProperty('actionTarget',e.target.value));
 listen(content.querySelector('#openBackendTables'),'click',()=>{if(role!=='owner'){openLogin('Login Owner diperlukan untuk mengelola Backend D1.');return;}loadBackendTables();});
 listen(content.querySelector('#openEffectBrowser'),'click',()=>{$('effectBrowser').hidden=false;});
 listen(content.querySelector('#editMediaButton'),'click',()=> $('studioMediaFile').click());
 listen(content.querySelector('#confirmEdit'),'click',()=>{const text=$('toolText')?.value??'';updateSelectedProperty('content',text);mobileEditorPanel='';renderMobileWorkbench();});
 listen(content.querySelector('#toolText'),'input',e=>updateSelectedProperty('content',e.target.value));
 listen(content.querySelector('#toolFontSize'),'change',e=>updateSelectedProperty('fontSize',Number(e.target.value)));
 listen(content.querySelector('#toolFont'),'change',e=>updateSelectedProperty('fontFamily',e.target.value));
 listen(content.querySelector('#toolTextColor'),'input',e=>updateSelectedProperty('color',e.target.value));
 root.querySelectorAll('[data-align]').forEach(btn=>btn.addEventListener('click',()=>updateSelectedProperty('textAlign',btn.dataset.align)));
 root.querySelectorAll('[data-remove-effect]').forEach(btn=>btn.addEventListener('click',()=>{const layer=selectedLayer();if(layer){layer.visual.effects=(layer.visual.effects||[]).filter(x=>x!==btn.dataset.removeEffect);setDirty();renderPreview();renderMobileSubpanel();}}));
 root.querySelectorAll('[data-sidebar-action]').forEach(btn=>btn.addEventListener('click',()=>handleSubpanelSidebar(btn.dataset.sidebarAction)));
 root.querySelectorAll('[data-ruler-key]').forEach(el=>el.addEventListener('pointerdown',startDrumRuler));
 listen(content.querySelector('#movePad'),'pointerdown',startMovePad);
 listen(content.querySelector('#degreeWheel'),'pointerdown',startDegreeWheel);
 listen(content.querySelector('#shadowPositionPad'),'pointerdown',startShadowPad);
}
function applyFastLayerField(layer,key,value){
 if(key.startsWith('visual.'))layer.visual={...(layer.visual||{}),[key.slice(7)]:value};else layer[key]=value;
 const node=document.querySelector('#previewOverlay .preview-layer[data-layer-id="'+layer.id+'"]');if(!node)return;
 if(key==='x')node.style.left=value+'%';else if(key==='y')node.style.top=value+'%';else if(key==='opacity')node.style.opacity=String(value);
 else if(key==='rotation'||key==='scaleX'||key==='scaleY'||key==='skewX'||key==='skewY')node.style.transform='rotate('+(layer.rotation||0)+'deg) scale('+(layer.scaleX||1)+','+(layer.scaleY||1)+') skew('+(layer.skewX||0)+'deg,'+(layer.skewY||0)+'deg)';
 else if(key==='visual.borderWidth'||key==='visual.borderColor')node.style.border=(layer.visual?.borderWidth||0)+'px solid '+(layer.visual?.borderColor||'#4dd0c8');
 else if(key==='visual.shadowBlur'||key==='visual.shadowX'||key==='visual.shadowY'||key==='visual.shadowColor')node.style.boxShadow=(layer.visual?.shadowX||0)+'px '+(layer.visual?.shadowY||6)+'px '+(layer.visual?.shadowBlur||0)+'px '+(layer.visual?.shadowColor||'#000000');
 else if(key==='visual.borderRadius')node.style.borderRadius=value+'px';
 else if(key==='visual.strokeWidth'||key==='visual.strokeColor')node.style.outline=(layer.visual?.strokeEnabled?'':'')+'';
}
function startDrumRuler(event){
 const ruler=event.currentTarget,layer=selectedLayer();if(!layer)return;event.preventDefault();ruler.setPointerCapture?.(event.pointerId);
 const key=ruler.dataset.rulerKey,min=Number(ruler.dataset.min),max=Number(ruler.dataset.max),step=Number(ruler.dataset.step)||1,rect=ruler.getBoundingClientRect(),output=ruler.parentElement.parentElement.querySelector('output');
 let pending=null,raf=0,done=false;
 const apply=clientX=>{
  const ratio=Math.max(0,Math.min(1,(clientX-rect.left)/Math.max(1,rect.width))),raw=min+ratio*(max-min),value=Math.max(min,Math.min(max,Math.round(raw/step)*step));
  pending=value;ruler.dataset.value=String(value);if(output)output.textContent=value+(key==='opacity'?'%':key.includes('scale')?'×':key.includes('Width')||key.includes('Blur')?' px':key.includes('Alpha')?'%':'');
  if(!raf)raf=requestAnimationFrame(()=>{raf=0;if(pending!==null){applyFastLayerField(layer,key,pending);pending=null;}});
 };
 const move=e=>apply(e.clientX);
 const finish=e=>{if(done)return;done=true;if(raf)cancelAnimationFrame(raf);apply(e.clientX);if(raf)cancelAnimationFrame(raf);if(pending!==null)applyFastLayerField(layer,key,pending);ruler.removeEventListener('pointermove',move);ruler.removeEventListener('pointerup',finish);ruler.removeEventListener('pointercancel',finish);setDirty();renderTimeline();};
 apply(event.clientX);ruler.addEventListener('pointermove',move);ruler.addEventListener('pointerup',finish);ruler.addEventListener('pointercancel',finish);
}
function startDegreeWheel(event){
 const wheel=event.currentTarget,layer=selectedLayer();if(!layer)return;event.preventDefault();wheel.setPointerCapture?.(event.pointerId);
 const rect=wheel.getBoundingClientRect(),centerX=rect.left+rect.width/2,centerY=rect.top+rect.height/2;let raf=0,next=layer.rotation||0;
 const update=e=>{const angle=Math.atan2(e.clientY-centerY,e.clientX-centerX)*180/Math.PI+90;next=Math.round((angle+360)%360);if(next>180)next-=360;if(!raf)raf=requestAnimationFrame(()=>{raf=0;layer.rotation=next;const node=document.querySelector('#previewOverlay .preview-layer[data-layer-id="'+layer.id+'"]');if(node)node.style.transform='rotate('+next+'deg) scale('+(layer.scaleX||1)+','+(layer.scaleY||1)+') skew('+(layer.skewX||0)+'deg,'+(layer.skewY||0)+'deg)';const out=$('degreeValue');if(out)out.textContent=next+'°';});};
 const end=e=>{if(raf)cancelAnimationFrame(raf);update(e);layer.rotation=next;wheel.removeEventListener('pointermove',update);wheel.removeEventListener('pointerup',end);wheel.removeEventListener('pointercancel',end);setDirty();renderPreview();renderMobileSubpanel();};
 update(event);wheel.addEventListener('pointermove',update);wheel.addEventListener('pointerup',end);wheel.addEventListener('pointercancel',end);
}
function startMovePad(event){
 const pad=event.currentTarget,layer=selectedLayer();if(!layer)return;event.preventDefault();pad.setPointerCapture?.(event.pointerId);
 const rect=pad.getBoundingClientRect(),sx=event.clientX,sy=event.clientY,ox=Number(layer.x||0),oy=Number(layer.y||0);let raf=0,px=sx,py=sy;
 const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;layer.x=Math.max(0,Math.min(100-(layer.width||0),ox+(px-sx)/Math.max(1,rect.width)*30));layer.y=Math.max(0,Math.min(100-(layer.height||0),oy+(py-sy)/Math.max(1,rect.height)*30));applyFastLayerField(layer,'x',layer.x);applyFastLayerField(layer,'y',layer.y);showCenterSnapGuides(layer);});};
 const end=()=>{if(raf)cancelAnimationFrame(raf);pad.removeEventListener('pointermove',move);pad.removeEventListener('pointerup',end);pad.removeEventListener('pointercancel',end);setDirty();renderTimeline();renderMobileSelectionBounds();};
 pad.addEventListener('pointermove',move);pad.addEventListener('pointerup',end);pad.addEventListener('pointercancel',end);
}
function startShadowPad(event){
 const pad=event.currentTarget,layer=selectedLayer();if(!layer)return;event.preventDefault();pad.setPointerCapture?.(event.pointerId);
 const r=pad.getBoundingClientRect(),sx=event.clientX,sy=event.clientY,ox=Number(layer.visual?.shadowX||0),oy=Number(layer.visual?.shadowY||0);let raf=0,px=sx,py=sy;
 const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;layer.visual=layer.visual||{};layer.visual.shadowX=Math.round(ox+(px-sx)/Math.max(1,r.width)*80);layer.visual.shadowY=Math.round(oy+(py-sy)/Math.max(1,r.height)*80);applyFastLayerField(layer,'visual.shadowX',layer.visual.shadowX);applyFastLayerField(layer,'visual.shadowY',layer.visual.shadowY);});};
 const end=()=>{if(raf)cancelAnimationFrame(raf);pad.removeEventListener('pointermove',move);pad.removeEventListener('pointerup',end);pad.removeEventListener('pointercancel',end);setDirty();renderPreview();renderMobileSubpanel();};
 pad.addEventListener('pointermove',move);pad.addEventListener('pointerup',end);pad.addEventListener('pointercancel',end);
}
function renderMobileTimeline(){
 const root=$('timelineTracks');if(!root)return;root.replaceChildren();
 let items=getActiveProjectLayers();const chosen=project?.isDefault?selectedElement?.selector:selectedLayerId;
 if(chosen)items=items.filter(item=>(item.id||item.selector)===chosen);
 if(!items.length){const empty=document.createElement('div');empty.className='timeline-empty';empty.textContent=project?.isDefault?'Mengambil daftar elemen halaman…':'Belum ada layer. Tekan + untuk menambahkan.';root.append(empty);return;}
 items.forEach(item=>{
  const id=item.id||item.selector,isText=item.type==='text'||/^h[1-6]$/.test(item.tag||'')||item.tag==='p'||item.textEditable,media=['image','video'].includes(item.type);
  const row=document.createElement('div');row.className='timeline-row'+(id===chosen?' selected':'');row.dataset.id=id;
  const label=document.createElement('button');label.type='button';label.className='track-label';label.title='Tampilkan / sembunyikan';
  const eye=document.createElement('span');eye.className='track-eye';eye.textContent=item.visible===false?'◌':'◉';
  label.append(eye);
  if(media&&(item.src||item.computed?.src)){const isVideo=item.type==='video'||item.tag==='video';const thumb=document.createElement(isVideo?'video':'img');thumb.className='track-thumbnail';thumb.src=item.previewSrc||item.src||item.computed?.src||'';if(isVideo){thumb.muted=true;thumb.playsInline=true;thumb.preload='metadata';}else thumb.alt='';label.append(thumb);}
  else{const chip=document.createElement('span');chip.className='track-color-chip';chip.style.background=item.color||item.visual?.backgroundColor||'#4dd0c8';if(isText)chip.style.background='#f4c542';label.append(chip);}
  label.addEventListener('click',event=>{event.stopPropagation();if(project?.isDefault){try{const target=$('pagePreviewFrame').contentDocument.querySelector(item.selector);if(target){target.hidden=!target.hidden;item.visible=!target.hidden;eye.textContent=item.visible?'◉':'◌';}}catch(_){}}else{item.visible=item.visible===false;eye.textContent=item.visible?'◉':'◌';setDirty();renderPreview();}});
  const lane=document.createElement('div');lane.className='track-lane';
  const clip=document.createElement('button');clip.type='button';clip.className='track-clip'+(media?' media-clip':'')+(id===chosen?' active':'');clip.dataset.type=isText?'text':(item.type||item.tag||'media');
  if(media&&(item.src||item.computed?.src)){if(item.type!=='video'&&item.tag!=='video')clip.style.backgroundImage='linear-gradient(90deg,#4dd0c855,#10203077),url('+JSON.stringify(item.previewSrc||item.src||item.computed?.src)+')';else clip.style.backgroundImage='linear-gradient(90deg,#e5b83f77,#10203077)';}
  if(media)clip.style.backgroundSize='auto 100%';else if(isText)clip.style.backgroundColor='#f4c542';else clip.style.backgroundColor='#4dd0c8';
  clip.style.width=Math.max(35,Math.min(100,Number(item.timelineWidth)||88))+'%';
  const name=document.createElement('b');name.textContent=String(item.name||item.label||item.tag||TYPE_META[item.type]?.label||'Layer').slice(0,38);
  const handle=document.createElement('span');handle.className='track-handle';handle.textContent='≡';clip.append(name,handle);
  clip.addEventListener('click',()=>chooseMobileTimelineItem(item,id));
  lane.append(clip);row.append(label,lane);root.append(row);
 });
}
function renderMobileWorkbench(){
 const area=$('selectionTools'),grid=$('toolGrid'),panel=$('toolPanel'),dock=$('mobileEditorDock'),floating=$('floatingAdd');
 if(!area||!grid||!panel)return;
 const selected=Boolean(mobileSelectedItem()),inEditor=$('studioView')?.classList.contains('active');
 if(dock){dock.classList.toggle('has-selected-layer',selected);dock.classList.toggle('is-subpanel',selected&&Boolean(mobileEditorPanel));}
 if(floating)floating.hidden=!inEditor||selected;
 area.hidden=!selected;
 if(!selected){mobileEditorPanel='';grid.hidden=false;panel.hidden=true;panel.replaceChildren();}
 else{grid.hidden=Boolean(mobileEditorPanel);panel.hidden=!mobileEditorPanel;if(mobileEditorPanel)renderMobileSubpanel();}
 updateMobileHeader();
}
function updateModeUi(){
 const page=$('previewPage'),stage=$('previewStage');if(!page||!stage)return;
 const desktop=activeMode==='desktop',width=desktop?1280:390,height=desktop?720:844;
 page.classList.toggle('desktop-preview',desktop);stage.classList.toggle('desktop-mode',desktop);
 page.style.width=width+'px';page.style.height=height+'px';page.style.aspectRatio=desktop?'16 / 9':'9 / 16';
 const rect=stage.getBoundingClientRect(),availableWidth=Math.max(1,rect.width-4),availableHeight=Math.max(1,rect.height-4);
 const scale=Math.min(availableWidth/width,availableHeight/height)*(editorZoom/100);
 page.style.setProperty('--preview-scale',String(scale));
 $('modeMobile')?.classList.toggle('active',!desktop);$('modeDesktop')?.classList.toggle('active',desktop);
}
function showCenterSnapGuides(layer){
 const root=$('previewOverlay');if(!root)return;
 let v=root.querySelector('.center-snap-guide.vertical'),h=root.querySelector('.center-snap-guide.horizontal');
 if(!v){v=document.createElement('span');v.className='center-snap-guide vertical';root.append(v);}
 if(!h){h=document.createElement('span');h.className='center-snap-guide horizontal';root.append(h);}
 const sx=Math.abs((Number(layer.x)||0)+(Number(layer.width)||0)/2-50)<1.5,sy=Math.abs((Number(layer.y)||0)+(Number(layer.height)||0)/2-50)<1.5;
 v.hidden=!sx;h.hidden=!sy;
}
function hideCenterSnapGuides(){document.querySelectorAll('.center-snap-guide').forEach(x=>x.hidden=true);}
function applyLayerTransformStyle(node,layer){
 node.style.transform='rotate('+(layer.rotation||0)+'deg) scale('+(layer.scaleX||1)+','+(layer.scaleY||1)+') skew('+(layer.skewX||0)+'deg,'+(layer.skewY||0)+'deg)';
}
function startLayerResizeGesture(event,node,layer,position){
 event.preventDefault();event.stopPropagation();pushEditorHistory();node.setPointerCapture?.(event.pointerId);
 const rect=$('previewPage').getBoundingClientRect(),sx=event.clientX,sy=event.clientY,initial={x:Number(layer.x||0),y:Number(layer.y||0),width:Number(layer.width||30),height:Number(layer.height||30)};
 let raf=0,px=sx,py=sy;
 const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;const dx=(px-sx)/Math.max(1,rect.width)*100,dy=(py-sy)/Math.max(1,rect.height)*100;let x=initial.x,y=initial.y,w=initial.width,h=initial.height;
  if(position.includes('e'))w=initial.width+dx;if(position.includes('w')){w=initial.width-dx;x=initial.x+dx;}
  if(position.includes('s'))h=initial.height+dy;if(position.includes('n')){h=initial.height-dy;y=initial.y+dy;}
  layer.x=Math.max(0,x);layer.y=Math.max(0,y);layer.width=Math.max(2,w);layer.height=Math.max(2,h);
  node.style.left=layer.x+'%';node.style.top=layer.y+'%';node.style.width=layer.width+'%';node.style.height=layer.height+'%';showCenterSnapGuides(layer);
 });};
 const end=()=>{if(raf)cancelAnimationFrame(raf);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);hideCenterSnapGuides();setDirty();renderLayers();renderMobileSelectionBounds();};
 node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
}
function startLayerDragGesture(event,node,layer){
 if(editorLocked||event.button>0||event.target.closest?.('.selection-handle'))return;
 event.preventDefault();event.stopPropagation();pushEditorHistory();node.setPointerCapture?.(event.pointerId);
 selectedLayerId=layer.id;selectedLayerIds.clear();selectedLayerIds.add(layer.id);renderLayers();renderMobileWorkbench();updateMobileHeader();
 const rect=$('previewPage').getBoundingClientRect(),sx=event.clientX,sy=event.clientY,ox=Number(layer.x||0),oy=Number(layer.y||0);
 let raf=0,px=sx,py=sy,moved=false;
 const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;const dx=(px-sx)/Math.max(1,rect.width)*100,dy=(py-sy)/Math.max(1,rect.height)*100;let x=Math.max(0,Math.min(100-(layer.width||0),ox+dx)),y=Math.max(0,Math.min(100-(layer.height||0),oy+dy));
  if(Math.abs(dx)+Math.abs(dy)>.1)moved=true;
  if(Math.abs(x+(layer.width||0)/2-50)<1.5)x=50-(layer.width||0)/2;
  if(Math.abs(y+(layer.height||0)/2-50)<1.5)y=50-(layer.height||0)/2;
  layer.x=x;layer.y=y;node.style.left=x+'%';node.style.top=y+'%';showCenterSnapGuides(layer);
 });};
 const end=()=>{if(raf)cancelAnimationFrame(raf);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);hideCenterSnapGuides();if(moved){setDirty();renderTimeline();}};
 node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
}
function geometryClipPath(geometry){
 return ({triangle:'polygon(50% 0, 0 100%, 100% 100%)',hexagon:'polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%)',star:'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 95%,50% 72%,21% 95%,32% 57%,2% 35%,39% 35%)',arrow:'polygon(0 35%,65% 35%,65% 5%,100% 50%,65% 95%,65% 65%,0 65%)',trapezoid:'polygon(20% 0,80% 0,100% 100%,0 100%)',pentagon:'polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%)',diamond:'polygon(50% 0,100% 50%,50% 100%,0 50%)',plus:'polygon(35% 0,65% 0,65% 35%,100% 35%,100% 65%,65% 65%,65% 100%,35% 100%,35% 65%,0 65%,0 35%,35% 35%)',cross:'polygon(35% 0,65% 0,65% 35%,100% 35%,100% 65%,65% 65%,65% 100%,35% 100%,35% 65%,0 65%,0 35%,35% 35%)',pie:'polygon(50% 50%,50% 0,100% 0,100% 100%,50% 100%)',arc:'polygon(0 100%,0 50%,8% 25%,25% 8%,50% 0,75% 8%,92% 25%,100% 50%,100% 100%,80% 100%,80% 50%,70% 30%,50% 20%,30% 30%,20% 50%,20% 100%)',line:'polygon(0 45%,100% 45%,100% 55%,0 55%)'})[geometry]||'none';
}
function renderPreviewLegacy(){
 const root=$('previewOverlay');if(!root||!project)return;root.replaceChildren();if(project.isDefault)return;
 (project.layers||[]).filter(layer=>layer.visible!==false&&currentTimeMs>=(layer.startTime||0)&&currentTimeMs<=(layer.startTime||0)+(layer.duration||10000)).forEach((layer,index)=>{
  const node=document.createElement('div');node.className='preview-layer'+(layer.id===selectedLayerId?' selected':'');node.dataset.layerId=layer.id;
  node.style.position='absolute';node.style.left=(layer.x??8)+'%';node.style.top=(layer.y??(12+index*15))+'%';node.style.width=(layer.width??84)+'%';node.style.height=(layer.height??((layer.type==='image'||layer.type==='video')?65:20))+'%';node.style.minHeight='0';node.style.background=(layer.type==='image'||layer.type==='video'||layer.type==='audio')?'transparent':(layer.color||layer.visual?.backgroundColor||'#4dd0c8');node.style.opacity=String(layer.opacity??1);node.style.mixBlendMode=layer.blendMode==='contrast'?'difference':(layer.blendMode||'normal');node.style.willChange='transform,left,top,width,height';node.style.touchAction='none';node.style.userSelect='none';
  if(layer.fontSize)node.style.fontSize=layer.fontSize+'px';if(layer.fontFamily)node.style.fontFamily=layer.fontFamily;if(layer.textAlign)node.style.textAlign=layer.textAlign;if(layer.visual?.borderRadius)node.style.borderRadius=layer.visual.borderRadius+'px';node.style.zIndex=String(layer.z??(100-index));applyLayerTransformStyle(node,layer);
  if(layer.visual?.gradient?.stops?.length>=2){const st=layer.visual.gradient.stops;node.style.backgroundImage='linear-gradient('+(layer.visual.gradient.angle||135)+'deg,'+st[0].color+' 0%,'+st[1].color+' 100%)';}
  if(layer.visual?.borderWidth||layer.visual?.strokeEnabled)node.style.border=(Number(layer.visual?.borderWidth||layer.visual?.strokeWidth||1))+'px solid '+(layer.visual?.borderColor||layer.visual?.strokeColor||'#4dd0c8');
  if(layer.visual?.shadowEnabled||layer.visual?.shadowBlur)node.style.boxShadow=(layer.visual?.shadowX||0)+'px '+(layer.visual?.shadowY||6)+'px '+(layer.visual?.shadowBlur||0)+'px '+(layer.visual?.shadowColor||'#000000');
  if(layer.geometry){const clip=geometryClipPath(layer.geometry);if(clip!=='none')node.style.clipPath=clip;if(layer.geometry==='circle'||layer.geometry==='ellipse')node.style.borderRadius='50%';if(layer.geometry==='square')node.style.borderRadius='0';if(layer.geometry==='round-rect')node.style.borderRadius='16%';if(layer.geometry==='arc')node.style.border='8px solid '+(layer.color||'#4dd0c8');}
  else if(layer.type==='shape')node.style.borderRadius='50%';
  (layer.visual?.effects||[]).forEach(effect=>node.classList.add('slf-effect-'+effect));applyPreviewKeyframes(node,layer);
  if(layer.type==='image'&&layer.src){const img=document.createElement('img');img.src=layer.previewSrc||layer.src;img.alt=layer.name;img.style.width='100%';img.style.height='100%';img.style.objectFit=layer.mediaFit||'contain';img.draggable=false;node.append(img);}
  else if(layer.type==='video'&&layer.src){const media=document.createElement('video');media.src=layer.previewSrc||layer.src;media.controls=true;media.muted=true;media.playsInline=true;media.style.width='100%';media.style.height='100%';media.style.objectFit='contain';node.append(media);}
  else if(layer.type==='audio'&&layer.src){const media=document.createElement('audio');media.src=layer.previewSrc||layer.src;media.controls=true;media.style.width='100%';node.append(media);}
  else if(layer.type==='button'){const button=document.createElement('button');button.type='button';button.textContent=layer.content||layer.name;node.append(button);}
  else if(layer.type==='table'){const table=document.createElement('table');(layer.rows||[]).forEach((row,i)=>{const tr=document.createElement('tr');row.forEach(cell=>{const td=document.createElement(i===0?'th':'td');td.textContent=cell;tr.append(td);});table.append(tr);});node.append(table);}
  else if(layer.type==='input'){const input=document.createElement('input');input.placeholder=layer.content||layer.fieldName;input.disabled=true;node.append(input);}
  else if(layer.type!=='shape')node.textContent=layer.content||layer.name;
  if(layer.animation&&layer.animation!=='none'){node.classList.add('anim-'+layer.animation);node.style.animationPlayState='paused';node.style.animationIterationCount=layer.loop?'infinite':'1';}
  const handles=['nw','n','ne','e','se','s','sw','w'];if(layer.id===selectedLayerId)handles.forEach(pos=>{const handle=document.createElement('span');handle.className='selection-handle '+pos;handle.addEventListener('pointerdown',e=>startLayerResizeGesture(e,node,layer,pos));node.append(handle);});
  node.addEventListener('pointerdown',event=>startLayerDragGesture(event,node,layer));
  node.addEventListener('dblclick',event=>{if(['text','card','button'].includes(layer.type)){event.preventDefault();selectedLayerId=layer.id;mobileEditorPanel='edit';renderMobileWorkbench();}});
  node.addEventListener('click',()=>{selectedLayerId=layer.id;selectedLayerIds.clear();selectedLayerIds.add(layer.id);renderLayers();renderMobileWorkbench();});
  root.append(node);
 });
 const vertical=document.createElement('span');vertical.className='center-snap-guide vertical';vertical.hidden=true;root.append(vertical);
 const horizontal=document.createElement('span');horizontal.className='center-snap-guide horizontal';horizontal.hidden=true;root.append(horizontal);
}
function renderMobileSelectionBounds(){
 const bounds=$('selectionBounds');if(!bounds)return;bounds.hidden=true;bounds.replaceChildren();
 const layer=selectedLayer();if(layer)return;
 if(project?.isDefault&&selectedElement?.selector){
  try{
   const frame=$('pagePreviewFrame'),doc=frame.contentDocument,target=doc?.querySelector(selectedElement.selector);if(!target)return;
   target.style.touchAction='none';target.style.willChange='transform';target.style.userSelect='none';
   const r=target.getBoundingClientRect(),fr=frame.getBoundingClientRect();if(!fr.width||!fr.height)return;
   bounds.style.left=((r.left-fr.left)/fr.width*100)+'%';bounds.style.top=((r.top-fr.top)/fr.height*100)+'%';bounds.style.width=(r.width/fr.width*100)+'%';bounds.style.height=(r.height/fr.height*100)+'%';
   ['nw','n','ne','e','se','s','sw','w'].forEach(pos=>{const dot=document.createElement('span');dot.className='selection-handle '+pos;dot.dataset.frameResize=pos;dot.addEventListener('pointerdown',event=>startIframeResize(event,target,pos));bounds.append(dot);});
   bounds.hidden=false;
  }catch(_){}
 }
}
function startIframeResize(event,target,position){
 event.preventDefault();event.stopPropagation();const sx=event.clientX,sy=event.clientY,r=target.getBoundingClientRect(),sw=r.width,sh=r.height;let raf=0,px=sx,py=sy;
 const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;let w=sw,h=sh;if(position.includes('e'))w=Math.max(12,sw+px-sx);if(position.includes('w'))w=Math.max(12,sw-(px-sx));if(position.includes('s'))h=Math.max(12,sh+py-sy);if(position.includes('n'))h=Math.max(12,sh-(py-sy));target.style.width=w+'px';target.style.height=h+'px';});};
 const end=()=>{if(raf)cancelAnimationFrame(raf);document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',end);document.removeEventListener('pointercancel',end);changeElement(x=>{x.styles={...(x.styles||{}),width:target.style.width,height:target.style.height};});renderMobileSelectionBounds();};
 document.addEventListener('pointermove',move);document.addEventListener('pointerup',end,{once:true});document.addEventListener('pointercancel',end,{once:true});
}
function renderPreview(){renderPreviewLegacy();renderMobileSelectionBounds();}
function renderMobileWorkbench(){
 const area=$('selectionTools'),grid=$('toolGrid'),panel=$('toolPanel'),dock=$('mobileEditorDock'),floating=$('floatingAdd');if(!area||!grid||!panel)return;
 const selected=Boolean(mobileSelectedItem()),inEditor=$('studioView')?.classList.contains('active');
 if(dock){dock.classList.toggle('has-selected-layer',selected);dock.classList.toggle('is-subpanel',selected&&Boolean(mobileEditorPanel));}
 if(floating)floating.hidden=!inEditor||selected;
 area.hidden=!selected;
 if(!selected){mobileEditorPanel='';grid.hidden=true;panel.hidden=true;panel.replaceChildren();}
 else{grid.hidden=Boolean(mobileEditorPanel);panel.hidden=!mobileEditorPanel;if(mobileEditorPanel)renderMobileSubpanel();}
 updateMobileHeader();
}
function updateModeUi(){
 const page=$('previewPage'),stage=$('previewStage');if(!page||!stage)return;
 const desktop=activeMode==='desktop',width=desktop?1280:390,height=desktop?720:844;page.classList.toggle('desktop-preview',desktop);stage.classList.toggle('desktop-mode',desktop);page.style.width=width+'px';page.style.height=height+'px';page.style.aspectRatio=desktop?'16 / 9':'9 / 16';
 const rect=stage.getBoundingClientRect(),availableWidth=Math.max(1,rect.width-4),availableHeight=Math.max(1,rect.height-4),scale=Math.min(availableWidth/width,availableHeight/height)*(editorZoom/100);page.style.setProperty('--preview-scale',String(scale));
 $('modeMobile')?.classList.toggle('active',!desktop);$('modeDesktop')?.classList.toggle('active',desktop);
}
function showCenterSnapGuides(layer){
 const root=$('previewOverlay');if(!root)return;let v=root.querySelector('.center-snap-guide.vertical'),h=root.querySelector('.center-snap-guide.horizontal');
 if(!v){v=document.createElement('span');v.className='center-snap-guide vertical';root.append(v);}if(!h){h=document.createElement('span');h.className='center-snap-guide horizontal';root.append(h);}
 v.hidden=Math.abs((Number(layer.x)||0)+(Number(layer.width)||0)/2-50)>=1.5;h.hidden=Math.abs((Number(layer.y)||0)+(Number(layer.height)||0)/2-50)>=1.5;
}
function hideCenterSnapGuides(){document.querySelectorAll('.center-snap-guide').forEach(x=>x.hidden=true);}
function applyLayerTransformStyle(node,layer){node.style.transform='rotate('+(layer.rotation||0)+'deg) scale('+(layer.scaleX||1)+','+(layer.scaleY||1)+') skew('+(layer.skewX||0)+'deg,'+(layer.skewY||0)+'deg)';}
function startLayerResizeGesture(event,node,layer,position){
 event.preventDefault();event.stopPropagation();pushEditorHistory();node.setPointerCapture?.(event.pointerId);const rect=$('previewPage').getBoundingClientRect(),sx=event.clientX,sy=event.clientY,initial={x:Number(layer.x||0),y:Number(layer.y||0),width:Number(layer.width||30),height:Number(layer.height||30)};let raf=0,px=sx,py=sy;
 const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;const dx=(px-sx)/Math.max(1,rect.width)*100,dy=(py-sy)/Math.max(1,rect.height)*100;let x=initial.x,y=initial.y,w=initial.width,h=initial.height;if(position.includes('e'))w=initial.width+dx;if(position.includes('w')){w=initial.width-dx;x=initial.x+dx;}if(position.includes('s'))h=initial.height+dy;if(position.includes('n')){h=initial.height-dy;y=initial.y+dy;}layer.x=Math.max(0,x);layer.y=Math.max(0,y);layer.width=Math.max(2,w);layer.height=Math.max(2,h);node.style.left=layer.x+'%';node.style.top=layer.y+'%';node.style.width=layer.width+'%';node.style.height=layer.height+'%';showCenterSnapGuides(layer);});};
 const end=()=>{if(raf)cancelAnimationFrame(raf);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);hideCenterSnapGuides();setDirty();renderLayers();};
 node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
}
function startLayerDragGesture(event,node,layer){
 if(editorLocked||event.button>0||event.target.closest?.('.selection-handle'))return;event.preventDefault();event.stopPropagation();pushEditorHistory();node.setPointerCapture?.(event.pointerId);selectedLayerId=layer.id;selectedLayerIds.clear();selectedLayerIds.add(layer.id);renderLayers();renderMobileWorkbench();updateMobileHeader();
 const rect=$('previewPage').getBoundingClientRect(),sx=event.clientX,sy=event.clientY,ox=Number(layer.x||0),oy=Number(layer.y||0);let raf=0,px=sx,py=sy,moved=false;
 const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;const dx=(px-sx)/Math.max(1,rect.width)*100,dy=(py-sy)/Math.max(1,rect.height)*100;let x=Math.max(0,Math.min(100-(layer.width||0),ox+dx)),y=Math.max(0,Math.min(100-(layer.height||0),oy+dy));if(Math.abs(dx)+Math.abs(dy)>.1)moved=true;if(Math.abs(x+(layer.width||0)/2-50)<1.5)x=50-(layer.width||0)/2;if(Math.abs(y+(layer.height||0)/2-50)<1.5)y=50-(layer.height||0)/2;layer.x=x;layer.y=y;node.style.left=x+'%';node.style.top=y+'%';showCenterSnapGuides(layer);});};
 const end=()=>{if(raf)cancelAnimationFrame(raf);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);hideCenterSnapGuides();if(moved){setDirty();renderTimeline();}};
 node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
}
function geometryClipPath(geometry){return ({triangle:'polygon(50% 0,0 100%,100% 100%)',hexagon:'polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%)',star:'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 95%,50% 72%,21% 95%,32% 57%,2% 35%,39% 35%)',arrow:'polygon(0 35%,65% 35%,65% 5%,100% 50%,65% 95%,65% 65%,0 65%)',trapezoid:'polygon(20% 0,80% 0,100% 100%,0 100%)',pentagon:'polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%)',diamond:'polygon(50% 0,100% 50%,50% 100%,0 50%)',plus:'polygon(35% 0,65% 0,65% 35%,100% 35%,100% 65%,65% 65%,65% 100%,35% 100%,35% 65%,0 65%,0 35%,35% 35%)',cross:'polygon(35% 0,65% 0,65% 35%,100% 35%,100% 65%,65% 65%,65% 100%,35% 100%,35% 65%,0 65%,0 35%,35% 35%)',pie:'polygon(50% 50%,50% 0,100% 0,100% 100%,50% 100%)',line:'polygon(0 45%,100% 45%,100% 55%,0 55%)'})[geometry]||'none';}
function renderPreviewLegacy(){
 const root=$('previewOverlay');if(!root||!project)return;root.replaceChildren();if(project.isDefault)return;
 (project.layers||[]).filter(layer=>layer.visible!==false&&currentTimeMs>=(layer.startTime||0)&&currentTimeMs<=(layer.startTime||0)+(layer.duration||10000)).forEach((layer,index)=>{
  const node=document.createElement('div');node.className='preview-layer'+(layer.id===selectedLayerId?' selected':'');node.dataset.layerId=layer.id;node.style.position='absolute';node.style.left=(layer.x??8)+'%';node.style.top=(layer.y??(12+index*15))+'%';node.style.width=(layer.width??84)+'%';node.style.height=(layer.height??((layer.type==='image'||layer.type==='video')?65:20))+'%';node.style.minHeight='0';node.style.background=(layer.type==='image'||layer.type==='video'||layer.type==='audio')?'transparent':(layer.color||layer.visual?.backgroundColor||'#4dd0c8');node.style.opacity=String(layer.opacity??1);node.style.mixBlendMode=layer.blendMode==='contrast'?'difference':(layer.blendMode||'normal');node.style.willChange='transform,left,top,width,height';node.style.touchAction='none';node.style.userSelect='none';
  if(layer.fontSize)node.style.fontSize=layer.fontSize+'px';if(layer.fontFamily)node.style.fontFamily=layer.fontFamily;if(layer.textAlign)node.style.textAlign=layer.textAlign;if(layer.visual?.borderRadius)node.style.borderRadius=layer.visual.borderRadius+'px';node.style.zIndex=String(layer.z??(100-index));applyLayerTransformStyle(node,layer);
  if(layer.visual?.gradient?.stops?.length>=2){const st=layer.visual.gradient.stops;node.style.backgroundImage='linear-gradient('+(layer.visual.gradient.angle||135)+'deg,'+st[0].color+' 0%,'+st[1].color+' 100%)';}
  if(layer.visual?.borderWidth||layer.visual?.strokeEnabled)node.style.border=(Number(layer.visual?.borderWidth||layer.visual?.strokeWidth||1))+'px solid '+(layer.visual?.borderColor||layer.visual?.strokeColor||'#4dd0c8');
  if(layer.visual?.shadowEnabled||layer.visual?.shadowBlur)node.style.boxShadow=(layer.visual?.shadowX||0)+'px '+(layer.visual?.shadowY||6)+'px '+(layer.visual?.shadowBlur||0)+'px '+(layer.visual?.shadowColor||'#000000');
  if(layer.geometry){const clip=geometryClipPath(layer.geometry);if(clip!=='none')node.style.clipPath=clip;if(layer.geometry==='circle'||layer.geometry==='ellipse')node.style.borderRadius='50%';if(layer.geometry==='square')node.style.borderRadius='0';if(layer.geometry==='round-rect')node.style.borderRadius='16%';if(layer.geometry==='arc')node.style.border='8px solid '+(layer.color||'#4dd0c8');}else if(layer.type==='shape')node.style.borderRadius='50%';
  (layer.visual?.effects||[]).forEach(effect=>node.classList.add('slf-effect-'+effect));applyPreviewKeyframes(node,layer);
  if(layer.type==='image'&&layer.src){const img=document.createElement('img');img.src=layer.previewSrc||layer.src;img.alt=layer.name;img.style.width='100%';img.style.height='100%';img.style.objectFit=layer.mediaFit||'contain';img.draggable=false;node.append(img);}
  else if(layer.type==='video'&&layer.src){const media=document.createElement('video');media.src=layer.previewSrc||layer.src;media.controls=true;media.muted=true;media.playsInline=true;media.style.width='100%';media.style.height='100%';media.style.objectFit='contain';node.append(media);}
  else if(layer.type==='audio'&&layer.src){const media=document.createElement('audio');media.src=layer.previewSrc||layer.src;media.controls=true;media.style.width='100%';node.append(media);}
  else if(layer.type==='button'){const button=document.createElement('button');button.type='button';button.textContent=layer.content||layer.name;node.append(button);}
  else if(layer.type==='table'){const table=document.createElement('table');(layer.rows||[]).forEach((row,i)=>{const tr=document.createElement('tr');row.forEach(cell=>{const td=document.createElement(i===0?'th':'td');td.textContent=cell;tr.append(td);});table.append(tr);});node.append(table);}
  else if(layer.type==='input'){const input=document.createElement('input');input.placeholder=layer.content||layer.fieldName;input.disabled=true;node.append(input);}
  else if(layer.type!=='shape')node.textContent=layer.content||layer.name;
  if(layer.animation&&layer.animation!=='none'){node.classList.add('anim-'+layer.animation);node.style.animationPlayState='paused';node.style.animationIterationCount=layer.loop?'infinite':'1';}
  if(layer.id===selectedLayerId)['nw','n','ne','e','se','s','sw','w'].forEach(pos=>{const handle=document.createElement('span');handle.className='selection-handle '+pos;handle.addEventListener('pointerdown',e=>startLayerResizeGesture(e,node,layer,pos));node.append(handle);});
  node.addEventListener('pointerdown',event=>startLayerDragGesture(event,node,layer));node.addEventListener('dblclick',event=>{if(['text','card','button'].includes(layer.type)){event.preventDefault();selectedLayerId=layer.id;mobileEditorPanel='edit';renderMobileWorkbench();}});node.addEventListener('click',()=>{selectedLayerId=layer.id;selectedLayerIds.clear();selectedLayerIds.add(layer.id);renderLayers();renderMobileWorkbench();});root.append(node);
 });
 const vertical=document.createElement('span');vertical.className='center-snap-guide vertical';vertical.hidden=true;root.append(vertical);const horizontal=document.createElement('span');horizontal.className='center-snap-guide horizontal';horizontal.hidden=true;root.append(horizontal);
}
function renderMobileSelectionBounds(){
 const bounds=$('selectionBounds');if(!bounds)return;bounds.hidden=true;bounds.replaceChildren();const layer=selectedLayer();if(layer)return;
 if(project?.isDefault&&selectedElement?.selector){
  try{const frame=$('pagePreviewFrame'),doc=frame.contentDocument,target=doc?.querySelector(selectedElement.selector);if(!target)return;target.style.touchAction='none';target.style.willChange='transform';target.style.userSelect='none';
   const r=target.getBoundingClientRect(),fr=frame.getBoundingClientRect();if(!fr.width||!fr.height)return;bounds.style.left=((r.left-fr.left)/fr.width*100)+'%';bounds.style.top=((r.top-fr.top)/fr.height*100)+'%';bounds.style.width=(r.width/fr.width*100)+'%';bounds.style.height=(r.height/fr.height*100)+'%';
   ['nw','n','ne','e','se','s','sw','w'].forEach(pos=>{const dot=document.createElement('span');dot.className='selection-handle '+pos;dot.dataset.frameResize=pos;dot.addEventListener('pointerdown',event=>startIframeResize(event,target,pos));bounds.append(dot);});bounds.hidden=false;
  }catch(_){}
 }
}
function startIframeResize(event,target,position){
 event.preventDefault();event.stopPropagation();const sx=event.clientX,sy=event.clientY,r=target.getBoundingClientRect(),sw=r.width,sh=r.height;let raf=0,px=sx,py=sy;
 const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;let w=sw,h=sh;if(position.includes('e'))w=Math.max(12,sw+px-sx);if(position.includes('w'))w=Math.max(12,sw-(px-sx));if(position.includes('s'))h=Math.max(12,sh+py-sy);if(position.includes('n'))h=Math.max(12,sh-(py-sy));target.style.width=w+'px';target.style.height=h+'px';});};
 const end=()=>{if(raf)cancelAnimationFrame(raf);document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',end);document.removeEventListener('pointercancel',end);changeElement(x=>{x.styles={...(x.styles||{}),width:target.style.width,height:target.style.height};});renderMobileSelectionBounds();};
 document.addEventListener('pointermove',move);document.addEventListener('pointerup',end,{once:true});document.addEventListener('pointercancel',end,{once:true});
}
function renderPreview(){renderPreviewLegacy();renderMobileSelectionBounds();}
function renderMobileWorkbench(){
 const area=$('selectionTools'),grid=$('toolGrid'),panel=$('toolPanel'),dock=$('mobileEditorDock'),floating=$('floatingAdd');if(!area||!grid||!panel)return;
 const selected=Boolean(mobileSelectedItem()),inEditor=$('studioView')?.classList.contains('active');
 if(dock){dock.classList.toggle('has-selected-layer',selected);dock.classList.toggle('is-subpanel',selected&&Boolean(mobileEditorPanel));}
 if(floating)floating.hidden=!inEditor||selected;area.hidden=!selected;
 if(!selected){mobileEditorPanel='';grid.hidden=true;panel.hidden=true;panel.replaceChildren();}
 else{grid.hidden=Boolean(mobileEditorPanel);panel.hidden=!mobileEditorPanel;if(mobileEditorPanel)renderMobileSubpanel();}
 updateMobileHeader();
}
function updateModeUi(){
 const page=$('previewPage'),stage=$('previewStage');if(!page||!stage)return;const desktop=activeMode==='desktop',width=desktop?1280:390,height=desktop?720:844;
 page.classList.toggle('desktop-preview',desktop);stage.classList.toggle('desktop-mode',desktop);page.style.width=width+'px';page.style.height=height+'px';page.style.aspectRatio=desktop?'16 / 9':'9 / 16';
 const rect=stage.getBoundingClientRect(),availableWidth=Math.max(1,rect.width-4),availableHeight=Math.max(1,rect.height-4),scale=Math.min(availableWidth/width,availableHeight/height)*(editorZoom/100);page.style.setProperty('--preview-scale',String(scale));
 $('modeMobile')?.classList.toggle('active',!desktop);$('modeDesktop')?.classList.toggle('active',desktop);
}
function showCenterSnapGuides(layer){
 const root=$('previewOverlay');if(!root)return;let v=root.querySelector('.center-snap-guide.vertical'),h=root.querySelector('.center-snap-guide.horizontal');
 if(!v){v=document.createElement('span');v.className='center-snap-guide vertical';root.append(v);}if(!h){h=document.createElement('span');h.className='center-snap-guide horizontal';root.append(h);}
 v.hidden=Math.abs((Number(layer.x)||0)+(Number(layer.width)||0)/2-50)>=1.5;h.hidden=Math.abs((Number(layer.y)||0)+(Number(layer.height)||0)/2-50)>=1.5;
}
function hideCenterSnapGuides(){document.querySelectorAll('.center-snap-guide').forEach(x=>x.hidden=true);}
function applyLayerTransformStyle(node,layer){node.style.transform='rotate('+(layer.rotation||0)+'deg) scale('+(layer.scaleX||1)+','+(layer.scaleY||1)+') skew('+(layer.skewX||0)+'deg,'+(layer.skewY||0)+'deg)';}
function startLayerResizeGesture(event,node,layer,position){
 event.preventDefault();event.stopPropagation();pushEditorHistory();node.setPointerCapture?.(event.pointerId);const rect=$('previewPage').getBoundingClientRect(),sx=event.clientX,sy=event.clientY,initial={x:Number(layer.x||0),y:Number(layer.y||0),width:Number(layer.width||30),height:Number(layer.height||30)};let raf=0,px=sx,py=sy;
 const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;const dx=(px-sx)/Math.max(1,rect.width)*100,dy=(py-sy)/Math.max(1,rect.height)*100;let x=initial.x,y=initial.y,w=initial.width,h=initial.height;if(position.includes('e'))w=initial.width+dx;if(position.includes('w')){w=initial.width-dx;x=initial.x+dx;}if(position.includes('s'))h=initial.height+dy;if(position.includes('n')){h=initial.height-dy;y=initial.y+dy;}layer.x=Math.max(0,x);layer.y=Math.max(0,y);layer.width=Math.max(2,w);layer.height=Math.max(2,h);node.style.left=layer.x+'%';node.style.top=layer.y+'%';node.style.width=layer.width+'%';node.style.height=layer.height+'%';showCenterSnapGuides(layer);});};
 const end=()=>{if(raf)cancelAnimationFrame(raf);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);hideCenterSnapGuides();setDirty();renderLayers();};
 node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
}
function startLayerDragGesture(event,node,layer){
 if(editorLocked||event.button>0||event.target.closest?.('.selection-handle'))return;event.preventDefault();event.stopPropagation();pushEditorHistory();node.setPointerCapture?.(event.pointerId);selectedLayerId=layer.id;selectedLayerIds.clear();selectedLayerIds.add(layer.id);renderLayers();renderMobileWorkbench();updateMobileHeader();
 const rect=$('previewPage').getBoundingClientRect(),sx=event.clientX,sy=event.clientY,ox=Number(layer.x||0),oy=Number(layer.y||0);let raf=0,px=sx,py=sy,moved=false;
 const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;const dx=(px-sx)/Math.max(1,rect.width)*100,dy=(py-sy)/Math.max(1,rect.height)*100;let x=Math.max(0,Math.min(100-(layer.width||0),ox+dx)),y=Math.max(0,Math.min(100-(layer.height||0),oy+dy));if(Math.abs(dx)+Math.abs(dy)>.1)moved=true;if(Math.abs(x+(layer.width||0)/2-50)<1.5)x=50-(layer.width||0)/2;if(Math.abs(y+(layer.height||0)/2-50)<1.5)y=50-(layer.height||0)/2;layer.x=x;layer.y=y;node.style.left=x+'%';node.style.top=y+'%';showCenterSnapGuides(layer);});};
 const end=()=>{if(raf)cancelAnimationFrame(raf);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);hideCenterSnapGuides();if(moved){setDirty();renderTimeline();}};
 node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
}
function geometryClipPath(geometry){return ({triangle:'polygon(50% 0,0 100%,100% 100%)',hexagon:'polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%)',star:'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 95%,50% 72%,21% 95%,32% 57%,2% 35%,39% 35%)',arrow:'polygon(0 35%,65% 35%,65% 5%,100% 50%,65% 95%,65% 65%,0 65%)',trapezoid:'polygon(20% 0,80% 0,100% 100%,0 100%)',pentagon:'polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%)',diamond:'polygon(50% 0,100% 50%,50% 100%,0 50%)',plus:'polygon(35% 0,65% 0,65% 35%,100% 35%,100% 65%,65% 65%,65% 100%,35% 100%,35% 65%,0 65%,0 35%,35% 35%)',cross:'polygon(35% 0,65% 0,65% 35%,100% 35%,100% 65%,65% 65%,65% 100%,35% 100%,35% 65%,0 65%,0 35%,35% 35%)',pie:'polygon(50% 50%,50% 0,100% 0,100% 100%,50% 100%)',line:'polygon(0 45%,100% 45%,100% 55%,0 55%)'})[geometry]||'none';}
function renderPreviewLegacy(){
 const root=$('previewOverlay');if(!root||!project)return;root.replaceChildren();if(project.isDefault)return;
 (project.layers||[]).filter(layer=>layer.visible!==false&&currentTimeMs>=(layer.startTime||0)&&currentTimeMs<=(layer.startTime||0)+(layer.duration||10000)).forEach((layer,index)=>{
  const node=document.createElement('div');node.className='preview-layer'+(layer.id===selectedLayerId?' selected':'');node.dataset.layerId=layer.id;node.style.position='absolute';node.style.left=(layer.x??8)+'%';node.style.top=(layer.y??(12+index*15))+'%';node.style.width=(layer.width??84)+'%';node.style.height=(layer.height??((layer.type==='image'||layer.type==='video')?65:20))+'%';node.style.minHeight='0';node.style.background=(layer.type==='image'||layer.type==='video'||layer.type==='audio')?'transparent':(layer.color||layer.visual?.backgroundColor||'#4dd0c8');node.style.opacity=String(layer.opacity??1);node.style.mixBlendMode=layer.blendMode==='contrast'?'difference':(layer.blendMode||'normal');node.style.willChange='transform,left,top,width,height';node.style.touchAction='none';node.style.userSelect='none';
  if(layer.fontSize)node.style.fontSize=layer.fontSize+'px';if(layer.fontFamily)node.style.fontFamily=layer.fontFamily;if(layer.textAlign)node.style.textAlign=layer.textAlign;if(layer.visual?.borderRadius)node.style.borderRadius=layer.visual.borderRadius+'px';node.style.zIndex=String(layer.z??(100-index));applyLayerTransformStyle(node,layer);
  if(layer.visual?.gradient?.stops?.length>=2){const st=layer.visual.gradient.stops;node.style.backgroundImage='linear-gradient('+(layer.visual.gradient.angle||135)+'deg,'+st[0].color+' 0%,'+st[1].color+' 100%)';}
  if(layer.visual?.borderWidth||layer.visual?.strokeEnabled)node.style.border=(Number(layer.visual?.borderWidth||layer.visual?.strokeWidth||1))+'px solid '+(layer.visual?.borderColor||layer.visual?.strokeColor||'#4dd0c8');
  if(layer.visual?.shadowEnabled||layer.visual?.shadowBlur)node.style.boxShadow=(layer.visual?.shadowX||0)+'px '+(layer.visual?.shadowY||6)+'px '+(layer.visual?.shadowBlur||0)+'px '+(layer.visual?.shadowColor||'#000000');
  if(layer.geometry){const clip=geometryClipPath(layer.geometry);if(clip!=='none')node.style.clipPath=clip;if(layer.geometry==='circle'||layer.geometry==='ellipse')node.style.borderRadius='50%';if(layer.geometry==='square')node.style.borderRadius='0';if(layer.geometry==='round-rect')node.style.borderRadius='16%';if(layer.geometry==='arc')node.style.border='8px solid '+(layer.color||'#4dd0c8');}else if(layer.type==='shape')node.style.borderRadius='50%';
  (layer.visual?.effects||[]).forEach(effect=>node.classList.add('slf-effect-'+effect));applyPreviewKeyframes(node,layer);
  if(layer.type==='image'&&layer.src){const img=document.createElement('img');img.src=layer.previewSrc||layer.src;img.alt=layer.name;img.style.width='100%';img.style.height='100%';img.style.objectFit=layer.mediaFit||'contain';img.draggable=false;node.append(img);}
  else if(layer.type==='video'&&layer.src){const media=document.createElement('video');media.src=layer.previewSrc||layer.src;media.controls=true;media.muted=true;media.playsInline=true;media.style.width='100%';media.style.height='100%';media.style.objectFit='contain';node.append(media);}
  else if(layer.type==='audio'&&layer.src){const media=document.createElement('audio');media.src=layer.previewSrc||layer.src;media.controls=true;media.style.width='100%';node.append(media);}
  else if(layer.type==='button'){const button=document.createElement('button');button.type='button';button.textContent=layer.content||layer.name;node.append(button);}
  else if(layer.type==='table'){const table=document.createElement('table');(layer.rows||[]).forEach((row,i)=>{const tr=document.createElement('tr');row.forEach(cell=>{const td=document.createElement(i===0?'th':'td');td.textContent=cell;tr.append(td);});table.append(tr);});node.append(table);}
  else if(layer.type==='input'){const input=document.createElement('input');input.placeholder=layer.content||layer.fieldName;input.disabled=true;node.append(input);}
  else if(layer.type!=='shape')node.textContent=layer.content||layer.name;
  if(layer.animation&&layer.animation!=='none'){node.classList.add('anim-'+layer.animation);node.style.animationPlayState='paused';node.style.animationIterationCount=layer.loop?'infinite':'1';}
  if(layer.id===selectedLayerId)['nw','n','ne','e','se','s','sw','w'].forEach(pos=>{const handle=document.createElement('span');handle.className='selection-handle '+pos;handle.addEventListener('pointerdown',e=>startLayerResizeGesture(e,node,layer,pos));node.append(handle);});
  node.addEventListener('pointerdown',event=>startLayerDragGesture(event,node,layer));node.addEventListener('dblclick',event=>{if(['text','card','button'].includes(layer.type)){event.preventDefault();selectedLayerId=layer.id;mobileEditorPanel='edit';renderMobileWorkbench();}});node.addEventListener('click',()=>{selectedLayerId=layer.id;selectedLayerIds.clear();selectedLayerIds.add(layer.id);renderLayers();renderMobileWorkbench();});root.append(node);
 });
 const vertical=document.createElement('span');vertical.className='center-snap-guide vertical';vertical.hidden=true;root.append(vertical);const horizontal=document.createElement('span');horizontal.className='center-snap-guide horizontal';horizontal.hidden=true;root.append(horizontal);
}
function renderMobileSelectionBounds(){
 const bounds=$('selectionBounds');if(!bounds)return;bounds.hidden=true;bounds.replaceChildren();const layer=selectedLayer();if(layer)return;
 if(project?.isDefault&&selectedElement?.selector){
  try{const frame=$('pagePreviewFrame'),doc=frame.contentDocument,target=doc?.querySelector(selectedElement.selector);if(!target)return;target.style.touchAction='none';target.style.willChange='transform';target.style.userSelect='none';
   const r=target.getBoundingClientRect(),fr=frame.getBoundingClientRect();if(!fr.width||!fr.height)return;bounds.style.left=((r.left-fr.left)/fr.width*100)+'%';bounds.style.top=((r.top-fr.top)/fr.height*100)+'%';bounds.style.width=(r.width/fr.width*100)+'%';bounds.style.height=(r.height/fr.height*100)+'%';
   ['nw','n','ne','e','se','s','sw','w'].forEach(pos=>{const dot=document.createElement('span');dot.className='selection-handle '+pos;dot.dataset.frameResize=pos;dot.addEventListener('pointerdown',event=>startIframeResize(event,target,pos));bounds.append(dot);});bounds.hidden=false;
  }catch(_){}
 }
}
function startIframeResize(event,target,position){
 event.preventDefault();event.stopPropagation();const sx=event.clientX,sy=event.clientY,r=target.getBoundingClientRect(),sw=r.width,sh=r.height;let raf=0,px=sx,py=sy;
 const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;let w=sw,h=sh;if(position.includes('e'))w=Math.max(12,sw+px-sx);if(position.includes('w'))w=Math.max(12,sw-(px-sx));if(position.includes('s'))h=Math.max(12,sh+py-sy);if(position.includes('n'))h=Math.max(12,sh-(py-sy));target.style.width=w+'px';target.style.height=h+'px';});};
 const end=()=>{if(raf)cancelAnimationFrame(raf);document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',end);document.removeEventListener('pointercancel',end);changeElement(x=>{x.styles={...(x.styles||{}),width:target.style.width,height:target.style.height};});renderMobileSelectionBounds();};
 document.addEventListener('pointermove',move);document.addEventListener('pointerup',end,{once:true});document.addEventListener('pointercancel',end,{once:true});
}
function renderPreview(){renderPreviewLegacy();renderMobileSelectionBounds();}
function renderMobileWorkbench(){
 const area=$('selectionTools'),grid=$('toolGrid'),panel=$('toolPanel'),dock=$('mobileEditorDock'),floating=$('floatingAdd');if(!area||!grid||!panel)return;
 const selected=Boolean(mobileSelectedItem()),inEditor=$('studioView')?.classList.contains('active');
 if(dock){dock.classList.toggle('has-selected-layer',selected);dock.classList.toggle('is-subpanel',selected&&Boolean(mobileEditorPanel));}
 if(floating)floating.hidden=!inEditor||selected;area.hidden=!selected;
 if(!selected){mobileEditorPanel='';grid.hidden=true;panel.hidden=true;panel.replaceChildren();}
 else{grid.hidden=Boolean(mobileEditorPanel);panel.hidden=!mobileEditorPanel;if(mobileEditorPanel)renderMobileSubpanel();}
 updateMobileHeader();
}
function updateModeUi(){
 const page=$('previewPage'),stage=$('previewStage');if(!page||!stage)return;const desktop=activeMode==='desktop',width=desktop?1280:390,height=desktop?720:844;
 page.classList.toggle('desktop-preview',desktop);stage.classList.toggle('desktop-mode',desktop);page.style.width=width+'px';page.style.height=height+'px';page.style.aspectRatio=desktop?'16 / 9':'9 / 16';
 const rect=stage.getBoundingClientRect(),availableWidth=Math.max(1,rect.width-4),availableHeight=Math.max(1,rect.height-4),scale=Math.min(availableWidth/width,availableHeight/height)*(editorZoom/100);page.style.setProperty('--preview-scale',String(scale));
 $('modeMobile')?.classList.toggle('active',!desktop);$('modeDesktop')?.classList.toggle('active',desktop);
}
function showCenterSnapGuides(layer){
 const root=$('previewOverlay');if(!root)return;let v=root.querySelector('.center-snap-guide.vertical'),h=root.querySelector('.center-snap-guide.horizontal');
 if(!v){v=document.createElement('span');v.className='center-snap-guide vertical';root.append(v);}if(!h){h=document.createElement('span');h.className='center-snap-guide horizontal';root.append(h);}
 v.hidden=Math.abs((Number(layer.x)||0)+(Number(layer.width)||0)/2-50)>=1.5;h.hidden=Math.abs((Number(layer.y)||0)+(Number(layer.height)||0)/2-50)>=1.5;
}
function hideCenterSnapGuides(){document.querySelectorAll('.center-snap-guide').forEach(x=>x.hidden=true);}
function applyLayerTransformStyle(node,layer){node.style.transform='rotate('+(layer.rotation||0)+'deg) scale('+(layer.scaleX||1)+','+(layer.scaleY||1)+') skew('+(layer.skewX||0)+'deg,'+(layer.skewY||0)+'deg)';}
function startLayerResizeGesture(event,node,layer,position){
 event.preventDefault();event.stopPropagation();pushEditorHistory();node.setPointerCapture?.(event.pointerId);const rect=$('previewPage').getBoundingClientRect(),sx=event.clientX,sy=event.clientY,initial={x:Number(layer.x||0),y:Number(layer.y||0),width:Number(layer.width||30),height:Number(layer.height||30)};let raf=0,px=sx,py=sy;
 const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;const dx=(px-sx)/Math.max(1,rect.width)*100,dy=(py-sy)/Math.max(1,rect.height)*100;let x=initial.x,y=initial.y,w=initial.width,h=initial.height;if(position.includes('e'))w=initial.width+dx;if(position.includes('w')){w=initial.width-dx;x=initial.x+dx;}if(position.includes('s'))h=initial.height+dy;if(position.includes('n')){h=initial.height-dy;y=initial.y+dy;}layer.x=Math.max(0,x);layer.y=Math.max(0,y);layer.width=Math.max(2,w);layer.height=Math.max(2,h);node.style.left=layer.x+'%';node.style.top=layer.y+'%';node.style.width=layer.width+'%';node.style.height=layer.height+'%';showCenterSnapGuides(layer);});};
 const end=()=>{if(raf)cancelAnimationFrame(raf);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);hideCenterSnapGuides();setDirty();renderLayers();};
 node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
}
function startLayerDragGesture(event,node,layer){
 if(editorLocked||event.button>0||event.target.closest?.('.selection-handle'))return;event.preventDefault();event.stopPropagation();pushEditorHistory();node.setPointerCapture?.(event.pointerId);selectedLayerId=layer.id;selectedLayerIds.clear();selectedLayerIds.add(layer.id);renderLayers();renderMobileWorkbench();updateMobileHeader();
 const rect=$('previewPage').getBoundingClientRect(),sx=event.clientX,sy=event.clientY,ox=Number(layer.x||0),oy=Number(layer.y||0);let raf=0,px=sx,py=sy,moved=false;
 const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;const dx=(px-sx)/Math.max(1,rect.width)*100,dy=(py-sy)/Math.max(1,rect.height)*100;let x=Math.max(0,Math.min(100-(layer.width||0),ox+dx)),y=Math.max(0,Math.min(100-(layer.height||0),oy+dy));if(Math.abs(dx)+Math.abs(dy)>.1)moved=true;if(Math.abs(x+(layer.width||0)/2-50)<1.5)x=50-(layer.width||0)/2;if(Math.abs(y+(layer.height||0)/2-50)<1.5)y=50-(layer.height||0)/2;layer.x=x;layer.y=y;node.style.left=x+'%';node.style.top=y+'%';showCenterSnapGuides(layer);});};
 const end=()=>{if(raf)cancelAnimationFrame(raf);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);hideCenterSnapGuides();if(moved){setDirty();renderTimeline();}};
 node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
}
function geometryClipPath(geometry){return ({triangle:'polygon(50% 0,0 100%,100% 100%)',hexagon:'polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%)',star:'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 95%,50% 72%,21% 95%,32% 57%,2% 35%,39% 35%)',arrow:'polygon(0 35%,65% 35%,65% 5%,100% 50%,65% 95%,65% 65%,0 65%)',trapezoid:'polygon(20% 0,80% 0,100% 100%,0 100%)',pentagon:'polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%)',diamond:'polygon(50% 0,100% 50%,50% 100%,0 50%)',plus:'polygon(35% 0,65% 0,65% 35%,100% 35%,100% 65%,65% 65%,65% 100%,35% 100%,35% 65%,0 65%,0 35%,35% 35%)',cross:'polygon(35% 0,65% 0,65% 35%,100% 35%,100% 65%,65% 65%,65% 100%,35% 100%,35% 65%,0 65%,0 35%,35% 35%)',pie:'polygon(50% 50%,50% 0,100% 0,100% 100%,50% 100%)',line:'polygon(0 45%,100% 45%,100% 55%,0 55%)'})[geometry]||'none';}
function renderPreviewLegacy(){
 const root=$('previewOverlay');if(!root||!project)return;root.replaceChildren();if(project.isDefault)return;
 (project.layers||[]).filter(layer=>layer.visible!==false&&currentTimeMs>=(layer.startTime||0)&&currentTimeMs<=(layer.startTime||0)+(layer.duration||10000)).forEach((layer,index)=>{
  const node=document.createElement('div');node.className='preview-layer'+(layer.id===selectedLayerId?' selected':'');node.dataset.layerId=layer.id;node.style.position='absolute';node.style.left=(layer.x??8)+'%';node.style.top=(layer.y??(12+index*15))+'%';node.style.width=(layer.width??84)+'%';node.style.height=(layer.height??((layer.type==='image'||layer.type==='video')?65:20))+'%';node.style.minHeight='0';node.style.background=(layer.type==='image'||layer.type==='video'||layer.type==='audio')?'transparent':(layer.color||layer.visual?.backgroundColor||'#4dd0c8');node.style.opacity=String(layer.opacity??1);node.style.mixBlendMode=layer.blendMode==='contrast'?'difference':(layer.blendMode||'normal');node.style.willChange='transform,left,top,width,height';node.style.touchAction='none';node.style.userSelect='none';
  if(layer.fontSize)node.style.fontSize=layer.fontSize+'px';if(layer.fontFamily)node.style.fontFamily=layer.fontFamily;if(layer.textAlign)node.style.textAlign=layer.textAlign;if(layer.visual?.borderRadius)node.style.borderRadius=layer.visual.borderRadius+'px';node.style.zIndex=String(layer.z??(100-index));applyLayerTransformStyle(node,layer);
  if(layer.visual?.gradient?.stops?.length>=2){const st=layer.visual.gradient.stops;node.style.backgroundImage='linear-gradient('+(layer.visual.gradient.angle||135)+'deg,'+st[0].color+' 0%,'+st[1].color+' 100%)';}
  if(layer.visual?.borderWidth||layer.visual?.strokeEnabled)node.style.border=(Number(layer.visual?.borderWidth||layer.visual?.strokeWidth||1))+'px solid '+(layer.visual?.borderColor||layer.visual?.strokeColor||'#4dd0c8');
  if(layer.visual?.shadowEnabled||layer.visual?.shadowBlur)node.style.boxShadow=(layer.visual?.shadowX||0)+'px '+(layer.visual?.shadowY||6)+'px '+(layer.visual?.shadowBlur||0)+'px '+(layer.visual?.shadowColor||'#000000');
  if(layer.geometry){const clip=geometryClipPath(layer.geometry);if(clip!=='none')node.style.clipPath=clip;if(layer.geometry==='circle'||layer.geometry==='ellipse')node.style.borderRadius='50%';if(layer.geometry==='square')node.style.borderRadius='0';if(layer.geometry==='round-rect')node.style.borderRadius='16%';if(layer.geometry==='arc')node.style.border='8px solid '+(layer.color||'#4dd0c8');}else if(layer.type==='shape')node.style.borderRadius='50%';
  (layer.visual?.effects||[]).forEach(effect=>node.classList.add('slf-effect-'+effect));applyPreviewKeyframes(node,layer);
  if(layer.type==='image'&&layer.src){const img=document.createElement('img');img.src=layer.previewSrc||layer.src;img.alt=layer.name;img.style.width='100%';img.style.height='100%';img.style.objectFit=layer.mediaFit||'contain';img.draggable=false;node.append(img);}
  else if(layer.type==='video'&&layer.src){const media=document.createElement('video');media.src=layer.previewSrc||layer.src;media.controls=true;media.muted=true;media.playsInline=true;media.style.width='100%';media.style.height='100%';media.style.objectFit='contain';node.append(media);}
  else if(layer.type==='audio'&&layer.src){const media=document.createElement('audio');media.src=layer.previewSrc||layer.src;media.controls=true;media.style.width='100%';node.append(media);}
  else if(layer.type==='button'){const button=document.createElement('button');button.type='button';button.textContent=layer.content||layer.name;node.append(button);}
  else if(layer.type==='table'){const table=document.createElement('table');(layer.rows||[]).forEach((row,i)=>{const tr=document.createElement('tr');row.forEach(cell=>{const td=document.createElement(i===0?'th':'td');td.textContent=cell;tr.append(td);});table.append(tr);});node.append(table);}
  else if(layer.type==='input'){const input=document.createElement('input');input.placeholder=layer.content||layer.fieldName;input.disabled=true;node.append(input);}
  else if(layer.type!=='shape')node.textContent=layer.content||layer.name;
  if(layer.animation&&layer.animation!=='none'){node.classList.add('anim-'+layer.animation);node.style.animationPlayState='paused';node.style.animationIterationCount=layer.loop?'infinite':'1';}
  if(layer.id===selectedLayerId)['nw','n','ne','e','se','s','sw','w'].forEach(pos=>{const handle=document.createElement('span');handle.className='selection-handle '+pos;handle.addEventListener('pointerdown',e=>startLayerResizeGesture(e,node,layer,pos));node.append(handle);});
  node.addEventListener('pointerdown',event=>startLayerDragGesture(event,node,layer));node.addEventListener('dblclick',event=>{if(['text','card','button'].includes(layer.type)){event.preventDefault();selectedLayerId=layer.id;mobileEditorPanel='edit';renderMobileWorkbench();}});node.addEventListener('click',()=>{selectedLayerId=layer.id;selectedLayerIds.clear();selectedLayerIds.add(layer.id);renderLayers();renderMobileWorkbench();});root.append(node);
 });
 const vertical=document.createElement('span');vertical.className='center-snap-guide vertical';vertical.hidden=true;root.append(vertical);const horizontal=document.createElement('span');horizontal.className='center-snap-guide horizontal';horizontal.hidden=true;root.append(horizontal);
}
function renderMobileSelectionBounds(){
 const bounds=$('selectionBounds');if(!bounds)return;bounds.hidden=true;bounds.replaceChildren();const layer=selectedLayer();if(layer)return;
 if(project?.isDefault&&selectedElement?.selector){
  try{const frame=$('pagePreviewFrame'),doc=frame.contentDocument,target=doc?.querySelector(selectedElement.selector);if(!target)return;target.style.touchAction='none';target.style.willChange='transform';target.style.userSelect='none';
   const r=target.getBoundingClientRect(),fr=frame.getBoundingClientRect();if(!fr.width||!fr.height)return;bounds.style.left=((r.left-fr.left)/fr.width*100)+'%';bounds.style.top=((r.top-fr.top)/fr.height*100)+'%';bounds.style.width=(r.width/fr.width*100)+'%';bounds.style.height=(r.height/fr.height*100)+'%';
   ['nw','n','ne','e','se','s','sw','w'].forEach(pos=>{const dot=document.createElement('span');dot.className='selection-handle '+pos;dot.dataset.frameResize=pos;dot.addEventListener('pointerdown',event=>startIframeResize(event,target,pos));bounds.append(dot);});bounds.hidden=false;
  }catch(_){}
 }
}
function startIframeResize(event,target,position){
 event.preventDefault();event.stopPropagation();const sx=event.clientX,sy=event.clientY,r=target.getBoundingClientRect(),sw=r.width,sh=r.height;let raf=0,px=sx,py=sy;
 const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;let w=sw,h=sh;if(position.includes('e'))w=Math.max(12,sw+px-sx);if(position.includes('w'))w=Math.max(12,sw-(px-sx));if(position.includes('s'))h=Math.max(12,sh+py-sy);if(position.includes('n'))h=Math.max(12,sh-(py-sy));target.style.width=w+'px';target.style.height=h+'px';});};
 const end=()=>{if(raf)cancelAnimationFrame(raf);document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',end);document.removeEventListener('pointercancel',end);changeElement(x=>{x.styles={...(x.styles||{}),width:target.style.width,height:target.style.height};});renderMobileSelectionBounds();};
 document.addEventListener('pointermove',move);document.addEventListener('pointerup',end,{once:true});document.addEventListener('pointercancel',end,{once:true});
}
function renderPreview(){renderPreviewLegacy();renderMobileSelectionBounds();}
function renderMobileWorkbench(){
 const area=$('selectionTools'),grid=$('toolGrid'),panel=$('toolPanel'),dock=$('mobileEditorDock'),floating=$('floatingAdd');if(!area||!grid||!panel)return;
 const selected=Boolean(mobileSelectedItem()),inEditor=$('studioView')?.classList.contains('active');
 if(dock){dock.classList.toggle('has-selected-layer',selected);dock.classList.toggle('is-subpanel',selected&&Boolean(mobileEditorPanel));}
 if(floating)floating.hidden=!inEditor||selected;area.hidden=!selected;
 if(!selected){mobileEditorPanel='';grid.hidden=true;panel.hidden=true;panel.replaceChildren();}
 else{grid.hidden=Boolean(mobileEditorPanel);panel.hidden=!mobileEditorPanel;if(mobileEditorPanel)renderMobileSubpanel();}
 updateMobileHeader();
}
function updateModeUi(){
 const page=$('previewPage'),stage=$('previewStage');if(!page||!stage)return;const desktop=activeMode==='desktop',width=desktop?1280:390,height=desktop?720:844;
 page.classList.toggle('desktop-preview',desktop);stage.classList.toggle('desktop-mode',desktop);page.style.width=width+'px';page.style.height=height+'px';page.style.aspectRatio=desktop?'16 / 9':'9 / 16';
 const rect=stage.getBoundingClientRect(),availableWidth=Math.max(1,rect.width-4),availableHeight=Math.max(1,rect.height-4),scale=Math.min(availableWidth/width,availableHeight/height)*(editorZoom/100);page.style.setProperty('--preview-scale',String(scale));
 $('modeMobile')?.classList.toggle('active',!desktop);$('modeDesktop')?.classList.toggle('active',desktop);
}
function showCenterSnapGuides(layer){
 const root=$('previewOverlay');if(!root)return;let v=root.querySelector('.center-snap-guide.vertical'),h=root.querySelector('.center-snap-guide.horizontal');
 if(!v){v=document.createElement('span');v.className='center-snap-guide vertical';root.append(v);}if(!h){h=document.createElement('span');h.className='center-snap-guide horizontal';root.append(h);}
 v.hidden=Math.abs((Number(layer.x)||0)+(Number(layer.width)||0)/2-50)>=1.5;h.hidden=Math.abs((Number(layer.y)||0)+(Number(layer.height)||0)/2-50)>=1.5;
}
function hideCenterSnapGuides(){document.querySelectorAll('.center-snap-guide').forEach(x=>x.hidden=true);}
function applyLayerTransformStyle(node,layer){node.style.transform='rotate('+(layer.rotation||0)+'deg) scale('+(layer.scaleX||1)+','+(layer.scaleY||1)+') skew('+(layer.skewX||0)+'deg,'+(layer.skewY||0)+'deg)';}
function startLayerResizeGesture(event,node,layer,position){
 event.preventDefault();event.stopPropagation();pushEditorHistory();node.setPointerCapture?.(event.pointerId);const rect=$('previewPage').getBoundingClientRect(),sx=event.clientX,sy=event.clientY,initial={x:Number(layer.x||0),y:Number(layer.y||0),width:Number(layer.width||30),height:Number(layer.height||30)};let raf=0,px=sx,py=sy;
 const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;const dx=(px-sx)/Math.max(1,rect.width)*100,dy=(py-sy)/Math.max(1,rect.height)*100;let x=initial.x,y=initial.y,w=initial.width,h=initial.height;if(position.includes('e'))w=initial.width+dx;if(position.includes('w')){w=initial.width-dx;x=initial.x+dx;}if(position.includes('s'))h=initial.height+dy;if(position.includes('n')){h=initial.height-dy;y=initial.y+dy;}layer.x=Math.max(0,x);layer.y=Math.max(0,y);layer.width=Math.max(2,w);layer.height=Math.max(2,h);node.style.left=layer.x+'%';node.style.top=layer.y+'%';node.style.width=layer.width+'%';node.style.height=layer.height+'%';showCenterSnapGuides(layer);});};
 const end=()=>{if(raf)cancelAnimationFrame(raf);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);hideCenterSnapGuides();setDirty();renderLayers();};
 node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
}
function startLayerDragGesture(event,node,layer){
 if(editorLocked||event.button>0||event.target.closest?.('.selection-handle'))return;event.preventDefault();event.stopPropagation();pushEditorHistory();node.setPointerCapture?.(event.pointerId);selectedLayerId=layer.id;selectedLayerIds.clear();selectedLayerIds.add(layer.id);renderLayers();renderMobileWorkbench();updateMobileHeader();
 const rect=$('previewPage').getBoundingClientRect(),sx=event.clientX,sy=event.clientY,ox=Number(layer.x||0),oy=Number(layer.y||0);let raf=0,px=sx,py=sy,moved=false;
 const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;const dx=(px-sx)/Math.max(1,rect.width)*100,dy=(py-sy)/Math.max(1,rect.height)*100;let x=Math.max(0,Math.min(100-(layer.width||0),ox+dx)),y=Math.max(0,Math.min(100-(layer.height||0),oy+dy));if(Math.abs(dx)+Math.abs(dy)>.1)moved=true;if(Math.abs(x+(layer.width||0)/2-50)<1.5)x=50-(layer.width||0)/2;if(Math.abs(y+(layer.height||0)/2-50)<1.5)y=50-(layer.height||0)/2;layer.x=x;layer.y=y;node.style.left=x+'%';node.style.top=y+'%';showCenterSnapGuides(layer);});};
 const end=()=>{if(raf)cancelAnimationFrame(raf);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);hideCenterSnapGuides();if(moved){setDirty();renderTimeline();}};
 node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
}
function geometryClipPath(geometry){return ({triangle:'polygon(50% 0,0 100%,100% 100%)',hexagon:'polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%)',star:'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 95%,50% 72%,21% 95%,32% 57%,2% 35%,39% 35%)',arrow:'polygon(0 35%,65% 35%,65% 5%,100% 50%,65% 95%,65% 65%,0 65%)',trapezoid:'polygon(20% 0,80% 0,100% 100%,0 100%)',pentagon:'polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%)',diamond:'polygon(50% 0,100% 50%,50% 100%,0 50%)',plus:'polygon(35% 0,65% 0,65% 35%,100% 35%,100% 65%,65% 65%,65% 100%,35% 100%,35% 65%,0 65%,0 35%,35% 35%)',cross:'polygon(35% 0,65% 0,65% 35%,100% 35%,100% 65%,65% 65%,65% 100%,35% 100%,35% 65%,0 65%,0 35%,35% 35%)',pie:'polygon(50% 50%,50% 0,100% 0,100% 100%,50% 100%)',line:'polygon(0 45%,100% 45%,100% 55%,0 55%)'})[geometry]||'none';}
function renderPreviewLegacy(){
 const root=$('previewOverlay');if(!root||!project)return;root.replaceChildren();if(project.isDefault)return;
 (project.layers||[]).filter(layer=>layer.visible!==false&&currentTimeMs>=(layer.startTime||0)&&currentTimeMs<=(layer.startTime||0)+(layer.duration||10000)).forEach((layer,index)=>{
  const node=document.createElement('div');node.className='preview-layer'+(layer.id===selectedLayerId?' selected':'');node.dataset.layerId=layer.id;node.style.position='absolute';node.style.left=(layer.x??8)+'%';node.style.top=(layer.y??(12+index*15))+'%';node.style.width=(layer.width??84)+'%';node.style.height=(layer.height??((layer.type==='image'||layer.type==='video')?65:20))+'%';node.style.minHeight='0';node.style.background=(layer.type==='image'||layer.type==='video'||layer.type==='audio')?'transparent':(layer.color||layer.visual?.backgroundColor||'#4dd0c8');node.style.opacity=String(layer.opacity??1);node.style.mixBlendMode=layer.blendMode==='contrast'?'difference':(layer.blendMode||'normal');node.style.willChange='transform,left,top,width,height';node.style.touchAction='none';node.style.userSelect='none';
  if(layer.fontSize)node.style.fontSize=layer.fontSize+'px';if(layer.fontFamily)node.style.fontFamily=layer.fontFamily;if(layer.textAlign)node.style.textAlign=layer.textAlign;if(layer.visual?.borderRadius)node.style.borderRadius=layer.visual.borderRadius+'px';node.style.zIndex=String(layer.z??(100-index));applyLayerTransformStyle(node,layer);
  if(layer.visual?.gradient?.stops?.length>=2){const st=layer.visual.gradient.stops;node.style.backgroundImage='linear-gradient('+(layer.visual.gradient.angle||135)+'deg,'+st[0].color+' 0%,'+st[1].color+' 100%)';}
  if(layer.visual?.borderWidth||layer.visual?.strokeEnabled)node.style.border=(Number(layer.visual?.borderWidth||layer.visual?.strokeWidth||1))+'px solid '+(layer.visual?.borderColor||layer.visual?.strokeColor||'#4dd0c8');
  if(layer.visual?.shadowEnabled||layer.visual?.shadowBlur)node.style.boxShadow=(layer.visual?.shadowX||0)+'px '+(layer.visual?.shadowY||6)+'px '+(layer.visual?.shadowBlur||0)+'px '+(layer.visual?.shadowColor||'#000000');
  if(layer.geometry){const clip=geometryClipPath(layer.geometry);if(clip!=='none')node.style.clipPath=clip;if(layer.geometry==='circle'||layer.geometry==='ellipse')node.style.borderRadius='50%';if(layer.geometry==='square')node.style.borderRadius='0';if(layer.geometry==='round-rect')node.style.borderRadius='16%';if(layer.geometry==='arc')node.style.border='8px solid '+(layer.color||'#4dd0c8');}else if(layer.type==='shape')node.style.borderRadius='50%';
  (layer.visual?.effects||[]).forEach(effect=>node.classList.add('slf-effect-'+effect));applyPreviewKeyframes(node,layer);
  if(layer.type==='image'&&layer.src){const img=document.createElement('img');img.src=layer.previewSrc||layer.src;img.alt=layer.name;img.style.width='100%';img.style.height='100%';img.style.objectFit=layer.mediaFit||'contain';img.draggable=false;node.append(img);}
  else if(layer.type==='video'&&layer.src){const media=document.createElement('video');media.src=layer.previewSrc||layer.src;media.controls=true;media.muted=true;media.playsInline=true;media.style.width='100%';media.style.height='100%';media.style.objectFit='contain';node.append(media);}
  else if(layer.type==='audio'&&layer.src){const media=document.createElement('audio');media.src=layer.previewSrc||layer.src;media.controls=true;media.style.width='100%';node.append(media);}
  else if(layer.type==='button'){const button=document.createElement('button');button.type='button';button.textContent=layer.content||layer.name;node.append(button);}
  else if(layer.type==='table'){const table=document.createElement('table');(layer.rows||[]).forEach((row,i)=>{const tr=document.createElement('tr');row.forEach(cell=>{const td=document.createElement(i===0?'th':'td');td.textContent=cell;tr.append(td);});table.append(tr);});node.append(table);}
  else if(layer.type==='input'){const input=document.createElement('input');input.placeholder=layer.content||layer.fieldName;input.disabled=true;node.append(input);}
  else if(layer.type!=='shape')node.textContent=layer.content||layer.name;
  if(layer.animation&&layer.animation!=='none'){node.classList.add('anim-'+layer.animation);node.style.animationPlayState='paused';node.style.animationIterationCount=layer.loop?'infinite':'1';}
  if(layer.id===selectedLayerId)['nw','n','ne','e','se','s','sw','w'].forEach(pos=>{const handle=document.createElement('span');handle.className='selection-handle '+pos;handle.addEventListener('pointerdown',e=>startLayerResizeGesture(e,node,layer,pos));node.append(handle);});
  node.addEventListener('pointerdown',event=>startLayerDragGesture(event,node,layer));node.addEventListener('dblclick',event=>{if(['text','card','button'].includes(layer.type)){event.preventDefault();selectedLayerId=layer.id;mobileEditorPanel='edit';renderMobileWorkbench();}});node.addEventListener('click',()=>{selectedLayerId=layer.id;selectedLayerIds.clear();selectedLayerIds.add(layer.id);renderLayers();renderMobileWorkbench();});root.append(node);
 });
 const vertical=document.createElement('span');vertical.className='center-snap-guide vertical';vertical.hidden=true;root.append(vertical);const horizontal=document.createElement('span');horizontal.className='center-snap-guide horizontal';horizontal.hidden=true;root.append(horizontal);
}
function renderMobileSelectionBounds(){
 const bounds=$('selectionBounds');if(!bounds)return;bounds.hidden=true;bounds.replaceChildren();const layer=selectedLayer();if(layer)return;
 if(project?.isDefault&&selectedElement?.selector){
  try{const frame=$('pagePreviewFrame'),doc=frame.contentDocument,target=doc?.querySelector(selectedElement.selector);if(!target)return;target.style.touchAction='none';target.style.willChange='transform';target.style.userSelect='none';
   const r=target.getBoundingClientRect(),fr=frame.getBoundingClientRect();if(!fr.width||!fr.height)return;bounds.style.left=((r.left-fr.left)/fr.width*100)+'%';bounds.style.top=((r.top-fr.top)/fr.height*100)+'%';bounds.style.width=(r.width/fr.width*100)+'%';bounds.style.height=(r.height/fr.height*100)+'%';
   ['nw','n','ne','e','se','s','sw','w'].forEach(pos=>{const dot=document.createElement('span');dot.className='selection-handle '+pos;dot.dataset.frameResize=pos;dot.addEventListener('pointerdown',event=>startIframeResize(event,target,pos));bounds.append(dot);});bounds.hidden=false;
  }catch(_){}
 }
}
function startIframeResize(event,target,position){
 event.preventDefault();event.stopPropagation();const sx=event.clientX,sy=event.clientY,r=target.getBoundingClientRect(),sw=r.width,sh=r.height;let raf=0,px=sx,py=sy;
 const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;let w=sw,h=sh;if(position.includes('e'))w=Math.max(12,sw+px-sx);if(position.includes('w'))w=Math.max(12,sw-(px-sx));if(position.includes('s'))h=Math.max(12,sh+py-sy);if(position.includes('n'))h=Math.max(12,sh-(py-sy));target.style.width=w+'px';target.style.height=h+'px';});};
 const end=()=>{if(raf)cancelAnimationFrame(raf);document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',end);document.removeEventListener('pointercancel',end);changeElement(x=>{x.styles={...(x.styles||{}),width:target.style.width,height:target.style.height};});renderMobileSelectionBounds();};
 document.addEventListener('pointermove',move);document.addEventListener('pointerup',end,{once:true});document.addEventListener('pointercancel',end,{once:true});
}
function renderPreview(){renderPreviewLegacy();renderMobileSelectionBounds();}
function renderMobileWorkbench(){
 const area=$('selectionTools'),grid=$('toolGrid'),panel=$('toolPanel'),dock=$('mobileEditorDock'),floating=$('floatingAdd');if(!area||!grid||!panel)return;
 const selected=Boolean(mobileSelectedItem()),inEditor=$('studioView')?.classList.contains('active');
 if(dock){dock.classList.toggle('has-selected-layer',selected);dock.classList.toggle('is-subpanel',selected&&Boolean(mobileEditorPanel));}
 if(floating)floating.hidden=!inEditor||selected;area.hidden=!selected;
 if(!selected){mobileEditorPanel='';grid.hidden=true;panel.hidden=true;panel.replaceChildren();}
 else{grid.hidden=Boolean(mobileEditorPanel);panel.hidden=!mobileEditorPanel;if(mobileEditorPanel)renderMobileSubpanel();}
 updateMobileHeader();
}
function updateModeUi(){
 const page=$('previewPage'),stage=$('previewStage');if(!page||!stage)return;const desktop=activeMode==='desktop',width=desktop?1280:390,height=desktop?720:844;
 page.classList.toggle('desktop-preview',desktop);stage.classList.toggle('desktop-mode',desktop);page.style.width=width+'px';page.style.height=height+'px';page.style.aspectRatio=desktop?'16 / 9':'9 / 16';
 const rect=stage.getBoundingClientRect(),availableWidth=Math.max(1,rect.width-4),availableHeight=Math.max(1,rect.height-4),scale=Math.min(availableWidth/width,availableHeight/height)*(editorZoom/100);page.style.setProperty('--preview-scale',String(scale));
 $('modeMobile')?.classList.toggle('active',!desktop);$('modeDesktop')?.classList.toggle('active',desktop);
}
function showCenterSnapGuides(layer){
 const root=$('previewOverlay');if(!root)return;let v=root.querySelector('.center-snap-guide.vertical'),h=root.querySelector('.center-snap-guide.horizontal');
 if(!v){v=document.createElement('span');v.className='center-snap-guide vertical';root.append(v);}if(!h){h=document.createElement('span');h.className='center-snap-guide horizontal';root.append(h);}
 v.hidden=Math.abs((Number(layer.x)||0)+(Number(layer.width)||0)/2-50)>=1.5;h.hidden=Math.abs((Number(layer.y)||0)+(Number(layer.height)||0)/2-50)>=1.5;
}
function hideCenterSnapGuides(){document.querySelectorAll('.center-snap-guide').forEach(x=>x.hidden=true);}
function applyLayerTransformStyle(node,layer){node.style.transform='rotate('+(layer.rotation||0)+'deg) scale('+(layer.scaleX||1)+','+(layer.scaleY||1)+') skew('+(layer.skewX||0)+'deg,'+(layer.skewY||0)+'deg)';}
function startLayerResizeGesture(event,node,layer,position){
 event.preventDefault();event.stopPropagation();pushEditorHistory();node.setPointerCapture?.(event.pointerId);const rect=$('previewPage').getBoundingClientRect(),sx=event.clientX,sy=event.clientY,initial={x:Number(layer.x||0),y:Number(layer.y||0),width:Number(layer.width||30),height:Number(layer.height||30)};let raf=0,px=sx,py=sy;
 const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;const dx=(px-sx)/Math.max(1,rect.width)*100,dy=(py-sy)/Math.max(1,rect.height)*100;let x=initial.x,y=initial.y,w=initial.width,h=initial.height;if(position.includes('e'))w=initial.width+dx;if(position.includes('w')){w=initial.width-dx;x=initial.x+dx;}if(position.includes('s'))h=initial.height+dy;if(position.includes('n')){h=initial.height-dy;y=initial.y+dy;}layer.x=Math.max(0,x);layer.y=Math.max(0,y);layer.width=Math.max(2,w);layer.height=Math.max(2,h);node.style.left=layer.x+'%';node.style.top=layer.y+'%';node.style.width=layer.width+'%';node.style.height=layer.height+'%';showCenterSnapGuides(layer);});};
 const end=()=>{if(raf)cancelAnimationFrame(raf);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);hideCenterSnapGuides();setDirty();renderLayers();};
 node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
}
function startLayerDragGesture(event,node,layer){
 if(editorLocked||event.button>0||event.target.closest?.('.selection-handle'))return;event.preventDefault();event.stopPropagation();pushEditorHistory();node.setPointerCapture?.(event.pointerId);selectedLayerId=layer.id;selectedLayerIds.clear();selectedLayerIds.add(layer.id);renderLayers();renderMobileWorkbench();updateMobileHeader();
 const rect=$('previewPage').getBoundingClientRect(),sx=event.clientX,sy=event.clientY,ox=Number(layer.x||0),oy=Number(layer.y||0);let raf=0,px=sx,py=sy,moved=false;
 const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;const dx=(px-sx)/Math.max(1,rect.width)*100,dy=(py-sy)/Math.max(1,rect.height)*100;let x=Math.max(0,Math.min(100-(layer.width||0),ox+dx)),y=Math.max(0,Math.min(100-(layer.height||0),oy+dy));if(Math.abs(dx)+Math.abs(dy)>.1)moved=true;if(Math.abs(x+(layer.width||0)/2-50)<1.5)x=50-(layer.width||0)/2;if(Math.abs(y+(layer.height||0)/2-50)<1.5)y=50-(layer.height||0)/2;layer.x=x;layer.y=y;node.style.left=x+'%';node.style.top=y+'%';showCenterSnapGuides(layer);});};
 const end=()=>{if(raf)cancelAnimationFrame(raf);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);hideCenterSnapGuides();if(moved){setDirty();renderTimeline();}};
 node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
}
function initMobileEditorUI(){
 const back=$('editorBack');if(back)back.onclick=()=>{if(mobileSelectedItem()||mobileEditorPanel){clearMobileSelection();return;}if(dirty&&!confirm('Perubahan belum disimpan. Keluar dan buang perubahan terakhir?'))return;setView('lobby');};
 if($('duplicateLayer'))$('duplicateLayer').onclick=duplicateMobileLayer;if($('deleteLayer'))$('deleteLayer').onclick=deleteMobileLayer;
 if($('layerOptionsButton'))$('layerOptionsButton').onclick=()=>$('layerMenu').hidden=!$('layerMenu').hidden;
 if($('addLayerInline'))$('addLayerInline').onclick=openSheet;if($('floatingAdd'))$('floatingAdd').onclick=openSheet;
 if($('layerMenuButton'))$('layerMenuButton').onclick=()=>$('layerMenu').hidden=!$('layerMenu').hidden;
 if($('editorSidebarButton'))$('editorSidebarButton').onclick=()=>$('editorSidebar').hidden=!$('editorSidebar').hidden;
 if($('canvasMagnifier'))$('canvasMagnifier').onclick=()=>$('editorSidebar').hidden=!$('editorSidebar').hidden;
 if($('addSheet'))$('addSheet').onclick=e=>{if(e.target===$('addSheet'))closeSheet();};
 document.querySelectorAll('[data-tool-panel]').forEach(btn=>btn.addEventListener('click',()=>{mobileEditorPanel=btn.dataset.toolPanel;mobileTransformTab='position';mobileBorderTab='stroke';renderMobileWorkbench();}));
 document.querySelectorAll('[data-quick-action]').forEach(btn=>btn.addEventListener('click',()=>quickLayerAction(btn.dataset.quickAction)));
 document.querySelectorAll('[data-geometry]').forEach(btn=>btn.addEventListener('click',()=>addGeometryLayer(btn.dataset.geometry)));
 document.querySelectorAll('[data-add-text]').forEach(btn=>btn.addEventListener('click',()=>{closeSheet();addLayer('text');}));
 document.querySelectorAll('[data-draw-mode]').forEach(btn=>btn.addEventListener('click',()=>{const mode=btn.dataset.drawMode;closeSheet();if(mode==='freehand'||mode==='vector'){addGeometryLayer(mode==='freehand'?'line':'diamond');notify('Mode '+(mode==='freehand'?'Freehand':'Vektor')+' dibuat sebagai layer yang dapat diedit.');}}));
 if($('studioUndo'))$('studioUndo').onclick=undoEditor;if($('studioRedo'))$('studioRedo').onclick=redoEditor;
 if($('timelinePrevious'))$('timelinePrevious').onclick=()=>{currentTimeMs=0;updateTimecode();};
 if($('timelineNext'))$('timelineNext').onclick=()=>{currentTimeMs=10000;updateTimecode();};
 if($('timelinePlay'))$('timelinePlay').onclick=()=>{timelinePlaying=!timelinePlaying;$('timelinePlay').innerHTML=timelinePlaying?'<svg viewBox="0 0 24 24"><path d="M7 5v14M17 5v14"/></svg>':'<svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7z"/></svg>';if(timelinePlaying){const start=performance.now()-currentTimeMs;const tick=now=>{if(!timelinePlaying)return;currentTimeMs=(now-start)%10000;updateTimecode();timelineFrame=requestAnimationFrame(tick);};timelineFrame=requestAnimationFrame(tick);}else cancelAnimationFrame(timelineFrame);};
 document.querySelectorAll('[data-canvas-zoom]').forEach(btn=>btn.addEventListener('click',()=>{editorZoom=Math.max(50,Math.min(200,editorZoom+Number(btn.dataset.canvasZoom)));updateModeUi();updateMobileHeader();}));
 if($('effectBrowserClose'))$('effectBrowserClose').onclick=()=>{$('effectBrowser').hidden=true;};
 document.querySelectorAll('[data-effect]').forEach(btn=>btn.addEventListener('click',()=>{const effect=btn.dataset.effect,layer=selectedLayer();if(layer){layer.visual={...(layer.visual||{}),effects:[...new Set([...(layer.visual?.effects||[]),effect])]};setDirty();renderPreview();}else if(selectedElement)changeElement(x=>{x.effects=[...new Set([...(x.effects||[]),effect])];});$('effectBrowser').hidden=true;mobileEditorPanel='effects';renderMobileWorkbench();}));
 if($('effectSearch'))$('effectSearch').addEventListener('input',e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('[data-effect]').forEach(btn=>btn.hidden=!btn.textContent.toLowerCase().includes(q));});
 const ruler=$('timelineRuler');if(ruler)ruler.addEventListener('click',event=>{const rect=ruler.getBoundingClientRect();currentTimeMs=Math.round(Math.max(0,Math.min(1,(event.clientX-rect.left)/Math.max(1,rect.width)))*10000);updateTimecode();});
 if($('exportAction'))$('exportAction').onclick=()=>{const choice=document.querySelector('input[name="exportChoice"]:checked')?.value||'publish',id={publish:'publishWebsite',draft:'saveDraftD1',json:'downloadProjectJson',png:'exportCurrentPng'}[choice];$(id)?.click();};
 if($('exportProject'))$('exportProject').onclick=openExportSheet;
 renderLayers();renderMobileWorkbench();updateMobileHeader();
}


let studioFrameMessage=null,studioFrameMessageRaf=0,iframeDragState=null;
function sendStudioMessageFrame(payload){
 studioFrameMessage=payload;
 if(studioFrameMessageRaf)return;
 studioFrameMessageRaf=requestAnimationFrame(()=>{studioFrameMessageRaf=0;const message=studioFrameMessage;studioFrameMessage=null;if(message)sendStudioMessage(message);});
}
function showIframeSnapGuides(target){
 const frame=$('pagePreviewFrame'),root=$('previewOverlay');if(!frame||!root||!target)return;
 let v=root.querySelector('.center-snap-guide.vertical'),h=root.querySelector('.center-snap-guide.horizontal');
 if(!v){v=document.createElement('span');v.className='center-snap-guide vertical';root.append(v);}
 if(!h){h=document.createElement('span');h.className='center-snap-guide horizontal';root.append(h);}
 const rect=target.getBoundingClientRect(),fr=frame.getBoundingClientRect(),cx=(rect.left+rect.width/2-fr.left)/Math.max(1,fr.width),cy=(rect.top+rect.height/2-fr.top)/Math.max(1,fr.height);
 v.hidden=Math.abs(cx-.5)>.015;h.hidden=Math.abs(cy-.5)>.015;
}
function attachIframePointerEditing(){
 if(!project?.isDefault||!selectedElement?.selector)return;
 try{
  const frame=$('pagePreviewFrame'),doc=frame?.contentDocument,target=doc?.querySelector(selectedElement.selector);if(!doc||!target)return;
  target.style.touchAction='none';target.style.willChange='transform,translate,width,height';target.style.userSelect='none';target.style.webkitUserSelect='none';
  if(target.dataset.slfPointerEditor==='1')return;
  target.dataset.slfPointerEditor='1';
  target.addEventListener('pointerdown',event=>{
   if(editorLocked||event.button>0)return;event.preventDefault();event.stopPropagation();
   target.setPointerCapture?.(event.pointerId);
   const tx=parseFloat(target.style.translate?.split(' ')[0])||Number(selectedElement.computed?.translateX)||0;
   const ty=parseFloat(target.style.translate?.split(' ')[1])||Number(selectedElement.computed?.translateY)||0;
   const sx=event.clientX,sy=event.clientY;let raf=0,px=sx,py=sy,nx=tx,ny=ty,moved=false;
   doc.documentElement.style.overscrollBehavior='none';doc.body.style.overscrollBehavior='none';doc.documentElement.style.touchAction='none';
   const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;nx=tx+(px-sx);ny=ty+(py-sy);if(Math.abs(nx-tx)+Math.abs(ny-ty)>1)moved=true;const frameRect=frame.getBoundingClientRect(),rect=target.getBoundingClientRect(),cx=(rect.left+rect.width/2-frameRect.left)/Math.max(1,frameRect.width),cy=(rect.top+rect.height/2-frameRect.top)/Math.max(1,frameRect.height);if(Math.abs(cx-.5)<.015)nx-=((cx-.5)*frameRect.width);if(Math.abs(cy-.5)<.015)ny-=((cy-.5)*frameRect.height);target.style.translate=nx+'px '+ny+'px';showIframeSnapGuides(target);});};
   const end=()=>{if(raf)cancelAnimationFrame(raf);target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',end);target.removeEventListener('pointercancel',end);doc.documentElement.style.overscrollBehavior='';doc.body.style.overscrollBehavior='';doc.documentElement.style.touchAction='';hideCenterSnapGuides();if(moved){pushEditorHistory();changeElement(edit=>{edit.styles={...(edit.styles||{}),translateX:nx,translateY:ny};});renderMobileSelectionBounds();}};
   target.addEventListener('pointermove',move);target.addEventListener('pointerup',end);target.addEventListener('pointercancel',end);
  },{capture:true});
  target.addEventListener('dblclick',event=>{if(selectedElement.textEditable||/^(H[1-6]|P|SPAN|DIV)$/i.test(selectedElement.tag||'')){event.preventDefault();mobileEditorPanel='edit';renderMobileWorkbench();}});
 }catch(error){console.warn('[SLF Studio] Touch editing iframe tidak dapat dipasang:',error);}
}
function selectPanel(name){
 if(name==='layers'||name==='properties')mobileEditorPanel='';
 else if(name==='backend')mobileEditorPanel='presets';
 else if(name==='animation')mobileEditorPanel='effects';
 else if(name==='actions')mobileEditorPanel='presets';
 else mobileEditorPanel=name;
 renderMobileWorkbench();if(selectedElement)attachIframePointerEditing();
}
function openSheet(){if($('addSheet'))$('addSheet').hidden=false;switchAddTab(addTab||'shape');}
function closeSheet(){if($('addSheet'))$('addSheet').hidden=true;}
function startMovePad(event){
 const pad=event.currentTarget,layer=selectedLayer();if(!layer)return;event.preventDefault();pad.setPointerCapture?.(event.pointerId);
 const rect=pad.getBoundingClientRect(),sx=event.clientX,sy=event.clientY,ox=Number(layer.x||0),oy=Number(layer.y||0);let raf=0,px=sx,py=sy;
 const move=e=>{px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;layer.x=Math.max(0,Math.min(100-(layer.width||0),ox+(px-sx)/Math.max(1,rect.width)*28));layer.y=Math.max(0,Math.min(100-(layer.height||0),oy+(py-sy)/Math.max(1,rect.height)*28));applyFastLayerField(layer,'x',layer.x);applyFastLayerField(layer,'y',layer.y);showCenterSnapGuides(layer);});};
 const end=()=>{if(raf)cancelAnimationFrame(raf);pad.removeEventListener('pointermove',move);pad.removeEventListener('pointerup',end);pad.removeEventListener('pointercancel',end);hideCenterSnapGuides();setDirty();renderTimeline();};
 pad.addEventListener('pointermove',move);pad.addEventListener('pointerup',end);pad.addEventListener('pointercancel',end);
}
function applyFastLayerField(layer,key,value){
 if(key.startsWith('visual.'))layer.visual={...(layer.visual||{}),[key.slice(7)]:value};else layer[key]=value;
 const node=document.querySelector('#previewOverlay .preview-layer[data-layer-id="'+layer.id+'"]');if(!node)return;
 if(key==='x')node.style.left=value+'%';else if(key==='y')node.style.top=value+'%';else if(key==='opacity')node.style.opacity=String(value);
 else if(['rotation','scaleX','scaleY','skewX','skewY'].includes(key))applyLayerTransformStyle(node,layer);
 else if(['visual.borderWidth','visual.borderColor','visual.strokeWidth','visual.strokeColor','visual.strokeEnabled'].includes(key)){
  const width=layer.visual?.strokeEnabled?Number(layer.visual?.strokeWidth||1):Number(layer.visual?.borderWidth||0),color=layer.visual?.strokeColor||layer.visual?.borderColor||'#4dd0c8';
  node.style.border=width>0?width+'px solid '+color:'none';
 }
 else if(['visual.shadowBlur','visual.shadowX','visual.shadowY','visual.shadowColor','visual.shadowEnabled','visual.shadowAlpha'].includes(key)){
  const alpha=Math.max(0,Math.min(100,Number(layer.visual?.shadowAlpha??55)))/100,hex=String(layer.visual?.shadowColor||'#000000').replace('#','');
  const rgb=hex.length===6?[parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)]:[0,0,0];
  node.style.boxShadow=layer.visual?.shadowEnabled===false?'none':(layer.visual?.shadowX||0)+'px '+(layer.visual?.shadowY||6)+'px '+(layer.visual?.shadowBlur||0)+'px rgba('+rgb.join(',')+','+alpha+')';
 }
 else if(key==='visual.borderRadius')node.style.borderRadius=value+'px';
}
function initMobileEditorUI(){
 const back=$('editorBack');if(back)back.onclick=()=>{if(mobileSelectedItem()||mobileEditorPanel){clearMobileSelection();return;}if(dirty&&!confirm('Perubahan belum disimpan. Keluar dan buang perubahan terakhir?'))return;setView('lobby');};
 if($('duplicateLayer'))$('duplicateLayer').onclick=duplicateMobileLayer;if($('deleteLayer'))$('deleteLayer').onclick=deleteMobileLayer;
 if($('layerOptionsButton'))$('layerOptionsButton').onclick=()=>$('layerMenu').hidden=!$('layerMenu').hidden;
 if($('addLayerInline'))$('addLayerInline').onclick=openSheet;if($('floatingAdd'))$('floatingAdd').onclick=openSheet;
 if($('layerMenuButton'))$('layerMenuButton').onclick=()=>$('layerMenu').hidden=!$('layerMenu').hidden;
 if($('editorSidebarButton'))$('editorSidebarButton').onclick=()=>$('editorSidebar').hidden=!$('editorSidebar').hidden;
 if($('canvasMagnifier'))$('canvasMagnifier').onclick=()=>$('editorSidebar').hidden=!$('editorSidebar').hidden;
 if($('addSheet'))$('addSheet').onclick=e=>{if(e.target===$('addSheet'))closeSheet();};
 document.querySelectorAll('[data-tool-panel]').forEach(btn=>btn.addEventListener('click',()=>{mobileEditorPanel=btn.dataset.toolPanel;mobileTransformTab='position';mobileBorderTab='stroke';renderMobileWorkbench();}));
 document.querySelectorAll('[data-quick-action]').forEach(btn=>btn.addEventListener('click',()=>quickLayerAction(btn.dataset.quickAction)));
 document.querySelectorAll('[data-geometry]').forEach(btn=>btn.addEventListener('click',()=>addGeometryLayer(btn.dataset.geometry)));
 document.querySelectorAll('[data-add-text]').forEach(btn=>btn.addEventListener('click',()=>{closeSheet();addLayer('text');}));
 document.querySelectorAll('[data-draw-mode]').forEach(btn=>btn.addEventListener('click',()=>{const mode=btn.dataset.drawMode;closeSheet();addGeometryLayer(mode==='freehand'?'line':'diamond');notify(mode==='freehand'?'Layer freehand siap diedit.':'Layer vektor siap diedit.');}));
 if($('studioUndo'))$('studioUndo').onclick=undoEditor;if($('studioRedo'))$('studioRedo').onclick=redoEditor;
 if($('timelinePrevious'))$('timelinePrevious').onclick=()=>{currentTimeMs=0;updateTimecode();};
 if($('timelineNext'))$('timelineNext').onclick=()=>{currentTimeMs=10000;updateTimecode();};
 if($('timelinePlay'))$('timelinePlay').onclick=()=>{timelinePlaying=!timelinePlaying;$('timelinePlay').innerHTML=timelinePlaying?'<svg viewBox="0 0 24 24"><path d="M7 5v14M17 5v14"/></svg>':'<svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7z"/></svg>';if(timelinePlaying){const start=performance.now()-currentTimeMs;const tick=now=>{if(!timelinePlaying)return;currentTimeMs=(now-start)%10000;updateTimecode();timelineFrame=requestAnimationFrame(tick);};timelineFrame=requestAnimationFrame(tick);}else cancelAnimationFrame(timelineFrame);};
 if($('effectBrowserClose'))$('effectBrowserClose').onclick=()=>{$('effectBrowser').hidden=true;};
 document.querySelectorAll('[data-effect]').forEach(btn=>btn.addEventListener('click',()=>{const effect=btn.dataset.effect,layer=selectedLayer();if(layer){layer.visual={...(layer.visual||{}),effects:[...new Set([...(layer.visual?.effects||[]),effect])]};setDirty();renderPreview();}else if(selectedElement)changeElement(x=>{x.effects=[...new Set([...(x.effects||[]),effect])];});$('effectBrowser').hidden=true;mobileEditorPanel='effects';renderMobileWorkbench();}));
 if($('effectSearch'))$('effectSearch').addEventListener('input',e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('[data-effect]').forEach(btn=>btn.hidden=!btn.textContent.toLowerCase().includes(q));});
 const ruler=$('timelineRuler');if(ruler)ruler.addEventListener('click',event=>{const rect=ruler.getBoundingClientRect();currentTimeMs=Math.round(Math.max(0,Math.min(1,(event.clientX-rect.left)/Math.max(1,rect.width)))*10000);updateTimecode();});
 if($('exportAction'))$('exportAction').onclick=()=>{const choice=document.querySelector('input[name="exportChoice"]:checked')?.value||'publish',id={publish:'publishWebsite',draft:'saveDraftD1',json:'downloadProjectJson',png:'exportCurrentPng'}[choice];$(id)?.click();};
 if($('exportProject'))$('exportProject').onclick=openExportSheet;
 renderLayers();renderMobileWorkbench();updateMobileHeader();
}

})();
