(() => {
'use strict';
const $=id=>document.getElementById(id);
let categories=[],articles=[],loaded=false,articleLoading=false;
const api=()=>window.SLFAdminApi;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slugify=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70);
function error(id,message){const e=$(id);e.textContent=message||'';e.classList.toggle('show',!!message);}
function toast(message){const e=$('toast');if(!e)return;e.textContent=message;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),3000);}
function syncCategorySelect(selected){const s=$('wiki-article-category');s.replaceChildren();categories.filter(c=>c.active||c.id===selected).forEach(c=>s.add(new Option(c.name,c.id)));if(selected)s.value=selected;}
async function load(){
 error('wiki-admin-error','');
 try{
  const d=await api()('/api/admin/wiki');categories=d.books||d.categories||[];articles=d.chapters||d.articles||[];
  syncCategorySelect($('wiki-article-category').value);
  renderCategories();renderArticles();loaded=true;
 }catch(e){error('wiki-admin-error',e.message||'Gagal memuat perpustakaan Wiki.');}
}
function renderCategories(){
 const root=$('wiki-categories-list');root.replaceChildren();
 if(!categories.length){root.innerHTML='<div class="empty">Belum ada kategori buku.</div>';return;}
 categories.forEach(c=>{
  const count=articles.filter(a=>a.category_id===c.id).length;
  const card=document.createElement('article');card.className='admin-list-card';
  const h=document.createElement('h3');h.textContent=(c.icon||'📚')+' '+c.name;
  const meta=document.createElement('p');meta.className='admin-muted';meta.textContent='Slug: '+c.slug+' · '+count+' bab · '+(c.active?'Tampil di publik':'Disembunyikan');
  const desc=document.createElement('p');desc.textContent=c.description||'Tanpa deskripsi';
  const actions=document.createElement('div');actions.className='admin-inline-actions';
  const edit=document.createElement('button');edit.type='button';edit.className='btn';edit.textContent='Edit buku';edit.addEventListener('click',()=>editCategory(c.id));
  const del=document.createElement('button');del.type='button';del.className='btn btn-quiet';del.textContent='Hapus buku';del.disabled=count>0;del.title=count?'Kosongkan artikel dahulu':'Hapus kategori';del.addEventListener('click',()=>deleteItem('book',c.id,c.name));
  actions.append(edit,del);card.append(h,meta,desc,actions);root.append(card);
 });
}
function renderArticles(){
 const root=$('wiki-articles-list');root.replaceChildren();
 if(!articles.length){root.innerHTML='<div class="empty">Belum ada artikel.</div>';return;}
 articles.forEach(a=>{
  const card=document.createElement('article');card.className='admin-list-card';
  const h=document.createElement('h3');h.textContent=(a.icon||'📖')+' '+a.title;
  const cat=categories.find(c=>c.id===a.category_id);
  const meta=document.createElement('p');meta.className='admin-muted';meta.textContent=(cat?.name||'Kategori tidak ada')+' · '+a.slug+' · '+(a.status==='published'?'Diterbitkan':'Draft')+(a.legacy_url?' · Artikel lama':' · Artikel baru');
  const desc=document.createElement('p');desc.textContent=a.summary||'Tanpa ringkasan';
  const actions=document.createElement('div');actions.className='admin-inline-actions';
  const edit=document.createElement('button');edit.type='button';edit.className='btn';edit.textContent='Edit bab';edit.addEventListener('click',()=>editArticle(a.id));
  const del=document.createElement('button');del.type='button';del.className='btn btn-quiet';del.textContent='Hapus bab';del.addEventListener('click',()=>deleteItem('chapter',a.id,a.title));
  actions.append(edit,del);card.append(h,meta,desc,actions);root.append(card);
 });
}
function resetCategory(){ $('wiki-category-form').reset();$('wiki-category-id').value='';$('wiki-category-icon').value='📚';$('wiki-category-order').value='10';$('wiki-category-active').value='1';$('wiki-category-form-title').textContent='Tambah buku / kategori';error('wiki-admin-error','');$('wiki-category-slug').dataset.manual='';}
function resetArticle(){ $('wiki-article-form').reset();$('wiki-article-id').value='';$('wiki-article-icon').value='📖';$('wiki-article-order').value='10';$('wiki-article-status').value='published';$('wiki-article-form-title').textContent='Tambah bab';$('wiki-legacy-note').hidden=true;syncCategorySelect(categories.find(c=>c.active)?.id||'');error('wiki-admin-error','');$('wiki-article-slug').dataset.manual='';}
function editCategory(id){const c=categories.find(x=>x.id===id);if(!c)return;$('wiki-category-id').value=c.id;$('wiki-category-name').value=c.name;$('wiki-category-slug').value=c.slug;$('wiki-category-icon').value=c.icon||'📚';$('wiki-category-description').value=c.description||'';$('wiki-category-order').value=c.sort_order||0;$('wiki-category-active').value=c.active?'1':'0';$('wiki-category-form-title').textContent='Edit buku: '+c.name;$('wiki-category-form').scrollIntoView({behavior:'smooth',block:'start'});}

function legacyInline(node,base){
 if(node.nodeType===3)return node.nodeValue.replace(/\s+/g,' ');
 if(node.nodeType!==1)return '';
 const tag=node.tagName.toLowerCase();
 if(tag==='br')return '\n';
 if(tag==='img'){const alt=node.getAttribute('alt')||'gambar';const src=node.getAttribute('src');return src?'['+alt+']('+new URL(src,base).href+')':'['+alt+']';}
 const inner=Array.from(node.childNodes).map(n=>legacyInline(n,base)).join('');
 if(tag==='strong'||tag==='b')return '**'+inner.trim()+'**';
 if(tag==='em'||tag==='i')return '*'+inner.trim()+'*';
 if(tag==='code')return '`'+inner.trim().replace(/`/g,"'")+'`';
 if(tag==='a'){const href=node.getAttribute('href');if(!href)return inner;try{return '['+inner.trim()+']('+new URL(href,base).href+')';}catch{return inner;}}
 return inner;
}
function legacyList(node,base,depth=0){
 const ordered=node.tagName.toLowerCase()==='ol';
 return Array.from(node.children).filter(x=>x.tagName.toLowerCase()==='li').map((li,index)=>{
  const nested=Array.from(li.children).filter(x=>['ul','ol'].includes(x.tagName.toLowerCase()));
  const text=Array.from(li.childNodes).filter(x=>!(x.nodeType===1&&['ul','ol'].includes(x.tagName.toLowerCase()))).map(x=>legacyInline(x,base)).join('').trim();
  const childLists=nested.map(x=>legacyList(x,base,depth+1)).join('\n');
  return '  '.repeat(depth)+(ordered?(index+1)+'. ':'- ')+text+(childLists?'\n'+childLists:'');
 }).join('\n');
}
function legacyBlocks(root,base){
 const parts=[];
 Array.from(root.childNodes).forEach(node=>{
  if(node.nodeType===3){const t=node.nodeValue.trim();if(t)parts.push(t);return;}
  if(node.nodeType!==1)return;
  const tag=node.tagName.toLowerCase();
  if(tag==='ul'||tag==='ol'){parts.push(legacyList(node,base));return;}
  if(/^h[1-6]$/.test(tag)){const level=Math.min(3,Math.max(1,Number(tag.slice(1))));parts.push('#'.repeat(level)+' '+legacyInline(node,base).trim());return;}
  if(tag==='p'){const t=legacyInline(node,base).trim();if(t)parts.push(t);return;}
  if(tag==='blockquote'){const t=legacyBlocks(node,base).replace(/\n/g,'\n> ');if(t)parts.push('> '+t);return;}
  if(tag==='hr'){parts.push('---');return;}
  if(['div','section','article'].includes(tag)){const t=legacyBlocks(node,base);if(t)parts.push(t);return;}
  const t=legacyInline(node,base).trim();if(t)parts.push(t);
 });
 return parts.join('\n\n').replace(/\n{3,}/g,'\n\n').trim();
}

async function editArticle(id){
 const a=articles.find(x=>x.id===id);if(!a)return;
 articleLoading=true;error('wiki-admin-error','');
 $('wiki-article-id').value=a.id;syncCategorySelect(a.category_id);$('wiki-article-category').value=a.category_id;
 $('wiki-article-title').value=a.title;$('wiki-article-slug').value=a.slug;$('wiki-article-icon').value=a.icon||'📖';
 $('wiki-article-summary').value=a.summary||'';$('wiki-article-order').value=a.sort_order||0;
 $('wiki-article-status').value=a.status||'published';$('wiki-article-form-title').textContent='Edit artikel: '+a.title;
 $('wiki-legacy-note').hidden=!a.legacy_url;
 $('wiki-article-content').value=a.content||'';updateWikiPreview();
 if(a.legacy_url&&!String(a.content||'').trim()){
  $('wiki-legacy-note').textContent='Sedang memuat isi artikel lama ke editor…';
  try{
   const response=await fetch(a.legacy_url,{cache:'no-store',credentials:'same-origin'});
   if(!response.ok)throw new Error('Halaman lama gagal dibuka (HTTP '+response.status+').');
   const html=await response.text();
   const doc=new DOMParser().parseFromString(html,'text/html');
   const body=doc.querySelector('.wiki-article-body');
   if(!body)throw new Error('Bagian isi artikel lama tidak ditemukan.');
   const content=legacyBlocks(body,new URL(a.legacy_url,location.href).href);
   if(content.length<10)throw new Error('Isi artikel lama kosong atau tidak terbaca.');
   $('wiki-article-content').value=content.slice(0,50000);updateWikiPreview();
   $('wiki-legacy-note').textContent='Isi artikel lama sudah dimuat ke editor. Ubah bagian yang diperlukan, lalu tekan “Simpan artikel”. Setelah disimpan, versi yang diedit akan digunakan oleh perpustakaan Wiki.';
  }catch(e){
   $('wiki-legacy-note').textContent='Isi lama belum berhasil dimuat otomatis: '+(e.message||'Kesalahan tidak diketahui')+' Artikel lama tetap aman; jangan simpan isi kosong. Muat ulang editor lalu coba lagi.';
   error('wiki-admin-error','Gagal mengambil isi artikel lama: '+(e.message||'Kesalahan tidak diketahui'));
  }
 }else if(a.legacy_url){
  $('wiki-legacy-note').textContent='Artikel ini masih memiliki halaman lama. Isi yang tersimpan sudah dimuat; setelah disimpan, versi editor akan menjadi sumber utama.';
 }
 articleLoading=false;
 $('wiki-article-form').scrollIntoView({behavior:'smooth',block:'start'});
}
async function deleteItem(type,id,name){if(!confirm('Hapus '+(type==='book'?'buku ':'bab ')+name+'? Tindakan ini tidak bisa dibatalkan.'))return;try{await api()('/api/admin/wiki?type='+encodeURIComponent(type)+'&id='+encodeURIComponent(id),{method:'DELETE'});await load();resetCategory();resetArticle();toast(type==='book'?'Buku dihapus.':'Bab dihapus.');}catch(e){error('wiki-admin-error',e.message);}}
async function saveCategory(e){e.preventDefault();error('wiki-admin-error','');const payload={type:'book',id:$('wiki-category-id').value||undefined,name:$('wiki-category-name').value.trim(),slug:$('wiki-category-slug').value.trim(),icon:$('wiki-category-icon').value.trim(),description:$('wiki-category-description').value.trim(),sortOrder:Number($('wiki-category-order').value),active:$('wiki-category-active').value==='1'};const b=$('wiki-category-form').querySelector('[type=submit]');b.disabled=true;try{await api()('/api/admin/wiki',{method:'POST',body:JSON.stringify(payload)});await load();resetCategory();toast('Buku Wiki tersimpan.');}catch(e){error('wiki-admin-error',e.message);}finally{b.disabled=false;}}
async function saveArticle(e){e.preventDefault();if(articleLoading){error('wiki-admin-error','Tunggu sampai isi artikel lama selesai dimuat.');return;}error('wiki-admin-error','');const payload={type:'chapter',id:$('wiki-article-id').value||undefined,bookId:$('wiki-article-category').value,title:$('wiki-article-title').value.trim(),slug:$('wiki-article-slug').value.trim(),icon:$('wiki-article-icon').value.trim(),summary:$('wiki-article-summary').value.trim(),sortOrder:Number($('wiki-article-order').value),content:$('wiki-article-content').value.trim(),legacyUrl:(articles.find(x=>x.id===$('wiki-article-id').value)?.legacy_url)||undefined,status:$('wiki-article-status').value};const b=$('wiki-article-form').querySelector('[type=submit]');b.disabled=true;try{await api()('/api/admin/wiki',{method:'POST',body:JSON.stringify(payload)});await load();resetArticle();toast('Bab tersimpan.');}catch(e){error('wiki-admin-error',e.message);}finally{b.disabled=false;}}

function updateWikiPreview(){
 const root=$('wiki-article-preview'),source=$('wiki-article-content');
 if(!root||!source)return;
 root.innerHTML=window.SLFWikiMarkdown?window.SLFWikiMarkdown.render(source.value):'<p>Pratinjau belum tersedia.</p>';
}
function insertWikiMarkdown(before,after=''){
 const editor=$('wiki-article-content');
 if(!editor)return;
 const start=editor.selectionStart,end=editor.selectionEnd;
 const selected=editor.value.slice(start,end)||'teks';
 editor.setRangeText(before+selected+after,start,end,'select');
 editor.dispatchEvent(new Event('input',{bubbles:true}));
 editor.focus();
}
document.querySelectorAll('[data-wiki-command]').forEach(button=>button.addEventListener('click',()=>{
 const command=button.dataset.wikiCommand;
 const formats={
  bold:['**','**'],italic:['*','*'],heading2:['## ',''],heading3:['### ',''],
  unordered:['- ',''],ordered:['1. ',''],callout:['> ','']
 };
 if(command==='table'){
  insertWikiMarkdown('', '\n\n| Kolom 1 | Kolom 2 |\n| --- | --- |\n| Isi | Isi |');
 }else if(formats[command]){
  insertWikiMarkdown(formats[command][0],formats[command][1]);
 }
}));
$('wiki-article-content').addEventListener('input',updateWikiPreview);
$('wiki-insert-image-url').addEventListener('click',()=>{
 const entered=window.prompt('Masukkan URL gambar HTTPS atau path gambar dari website SLF:');
 if(!entered)return;
 const safe=window.SLFWikiMarkdown?.safeUrl(entered,true);
 if(!safe){error('wiki-admin-error','URL gambar tidak valid. Gunakan HTTPS atau gambar dari domain SLF.');return;}
 insertWikiMarkdown('!['+((safe.split('/').pop()||'Gambar').replace(/[\]\\]/g,' '))+']('+safe+')');
});
$('wiki-upload-image').addEventListener('click',()=>$('wiki-image-file').click());
$('wiki-image-file').addEventListener('change',async event=>{
 const file=event.target.files?.[0];
 if(!file)return;
 const status=$('wiki-upload-status'),button=$('wiki-upload-image');
 const form=new FormData();form.append('file',file);
 button.disabled=true;status.textContent='Mengunggah gambar ke pustaka media SLF…';
 try{
  const result=await api()('/api/admin/media',{method:'POST',body:form});
  const imageUrl=result.asset?.url;
  if(!imageUrl)throw new Error('Server tidak mengembalikan URL gambar.');
  insertWikiMarkdown('!['+file.name.replace(/[\]\\]/g,' ')+']('+imageUrl+')');
  status.textContent='Gambar berhasil diunggah dan ditambahkan ke isi bab.';
 }catch(uploadError){
  status.textContent=uploadError.message||'Upload gambar gagal.';
 }finally{
  button.disabled=false;event.target.value='';
 }
});

$('wiki-category-form').addEventListener('submit',saveCategory);$('wiki-article-form').addEventListener('submit',saveArticle);$('wiki-category-reset').addEventListener('click',resetCategory);$('wiki-article-reset').addEventListener('click',resetArticle);
$('wiki-category-name').addEventListener('input',()=>{if(!$('wiki-category-slug').dataset.manual)$('wiki-category-slug').value=slugify($('wiki-category-name').value);});
$('wiki-article-title').addEventListener('input',()=>{if(!$('wiki-article-slug').dataset.manual)$('wiki-article-slug').value=slugify($('wiki-article-title').value);});
$('wiki-category-slug').addEventListener('input',e=>e.target.dataset.manual='1');$('wiki-article-slug').addEventListener('input',e=>e.target.dataset.manual='1');
window.SLFWikiAdminLoad=load;
})();