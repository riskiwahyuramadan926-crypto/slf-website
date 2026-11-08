(() => {
'use strict';
const $=id=>document.getElementById(id);
let categories=[],articles=[],loaded=false;
const api=()=>window.SLFAdminApi;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slugify=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70);
function error(id,message){const e=$(id);e.textContent=message||'';e.classList.toggle('show',!!message);}
function toast(message){const e=$('toast');if(!e)return;e.textContent=message;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),3000);}
function syncCategorySelect(selected){const s=$('wiki-article-category');s.replaceChildren();categories.filter(c=>c.active||c.id===selected).forEach(c=>s.add(new Option(c.name,c.id)));if(selected)s.value=selected;}
async function load(){
 error('wiki-admin-error','');
 try{
  const d=await api()('/api/admin/wiki');categories=d.categories||[];articles=d.articles||[];
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
  const meta=document.createElement('p');meta.className='admin-muted';meta.textContent='Slug: '+c.slug+' · '+count+' artikel · '+(c.active?'Tampil di publik':'Disembunyikan');
  const desc=document.createElement('p');desc.textContent=c.description||'Tanpa deskripsi';
  const actions=document.createElement('div');actions.className='admin-inline-actions';
  const edit=document.createElement('button');edit.type='button';edit.className='btn';edit.textContent='Edit buku';edit.addEventListener('click',()=>editCategory(c.id));
  const del=document.createElement('button');del.type='button';del.className='btn btn-quiet';del.textContent='Hapus buku';del.disabled=count>0;del.title=count?'Kosongkan artikel dahulu':'Hapus kategori';del.addEventListener('click',()=>deleteItem('category',c.id,c.name));
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
  const edit=document.createElement('button');edit.type='button';edit.className='btn';edit.textContent='Edit artikel';edit.addEventListener('click',()=>editArticle(a.id));
  const del=document.createElement('button');del.type='button';del.className='btn btn-quiet';del.textContent='Hapus artikel';del.addEventListener('click',()=>deleteItem('article',a.id,a.title));
  actions.append(edit,del);card.append(h,meta,desc,actions);root.append(card);
 });
}
function resetCategory(){ $('wiki-category-form').reset();$('wiki-category-id').value='';$('wiki-category-icon').value='📚';$('wiki-category-order').value='10';$('wiki-category-active').value='1';$('wiki-category-form-title').textContent='Tambah buku / kategori';error('wiki-admin-error','');}
function resetArticle(){ $('wiki-article-form').reset();$('wiki-article-id').value='';$('wiki-article-icon').value='📖';$('wiki-article-order').value='10';$('wiki-article-status').value='published';$('wiki-article-form-title').textContent='Tambah artikel';$('wiki-legacy-note').hidden=true;syncCategorySelect(categories.find(c=>c.active)?.id||'');error('wiki-admin-error','');}
function editCategory(id){const c=categories.find(x=>x.id===id);if(!c)return;$('wiki-category-id').value=c.id;$('wiki-category-name').value=c.name;$('wiki-category-slug').value=c.slug;$('wiki-category-icon').value=c.icon||'📚';$('wiki-category-description').value=c.description||'';$('wiki-category-order').value=c.sort_order||0;$('wiki-category-active').value=c.active?'1':'0';$('wiki-category-form-title').textContent='Edit buku: '+c.name;$('wiki-category-form').scrollIntoView({behavior:'smooth',block:'start'});}
function editArticle(id){const a=articles.find(x=>x.id===id);if(!a)return;$('wiki-article-id').value=a.id;syncCategorySelect(a.category_id);$('wiki-article-category').value=a.category_id;$('wiki-article-title').value=a.title;$('wiki-article-slug').value=a.slug;$('wiki-article-icon').value=a.icon||'📖';$('wiki-article-summary').value=a.summary||'';$('wiki-article-order').value=a.sort_order||0;$('wiki-article-content').value=a.content||'';$('wiki-article-status').value=a.status||'published';$('wiki-article-form-title').textContent='Edit artikel: '+a.title;$('wiki-legacy-note').hidden=!a.legacy_url;$('wiki-article-form').scrollIntoView({behavior:'smooth',block:'start'});}
async function deleteItem(type,id,name){if(!confirm('Hapus '+(type==='category'?'buku ':'artikel ')+name+'? Tindakan ini tidak bisa dibatalkan.'))return;try{await api()('/api/admin/wiki?type='+encodeURIComponent(type)+'&id='+encodeURIComponent(id),{method:'DELETE'});await load();resetCategory();resetArticle();toast(type==='category'?'Buku dihapus.':'Artikel dihapus.');}catch(e){error('wiki-admin-error',e.message);}}
async function saveCategory(e){e.preventDefault();error('wiki-admin-error','');const payload={type:'category',id:$('wiki-category-id').value||undefined,name:$('wiki-category-name').value.trim(),slug:$('wiki-category-slug').value.trim(),icon:$('wiki-category-icon').value.trim(),description:$('wiki-category-description').value.trim(),sortOrder:Number($('wiki-category-order').value),active:$('wiki-category-active').value==='1'};const b=$('wiki-category-form').querySelector('[type=submit]');b.disabled=true;try{await api()('/api/admin/wiki',{method:'POST',body:JSON.stringify(payload)});await load();resetCategory();toast('Buku Wiki tersimpan.');}catch(e){error('wiki-admin-error',e.message);}finally{b.disabled=false;}}
async function saveArticle(e){e.preventDefault();error('wiki-admin-error','');const payload={type:'article',id:$('wiki-article-id').value||undefined,categoryId:$('wiki-article-category').value,title:$('wiki-article-title').value.trim(),slug:$('wiki-article-slug').value.trim(),icon:$('wiki-article-icon').value.trim(),summary:$('wiki-article-summary').value.trim(),sortOrder:Number($('wiki-article-order').value),content:$('wiki-article-content').value.trim(),status:$('wiki-article-status').value};const b=$('wiki-article-form').querySelector('[type=submit]');b.disabled=true;try{await api()('/api/admin/wiki',{method:'POST',body:JSON.stringify(payload)});await load();resetArticle();toast('Artikel tersimpan.');}catch(e){error('wiki-admin-error',e.message);}finally{b.disabled=false;}}
$('wiki-category-form').addEventListener('submit',saveCategory);$('wiki-article-form').addEventListener('submit',saveArticle);$('wiki-category-reset').addEventListener('click',resetCategory);$('wiki-article-reset').addEventListener('click',resetArticle);
$('wiki-category-name').addEventListener('input',()=>{if(!$('wiki-category-slug').dataset.manual)$('wiki-category-slug').value=slugify($('wiki-category-name').value);});
$('wiki-article-title').addEventListener('input',()=>{if(!$('wiki-article-slug').dataset.manual)$('wiki-article-slug').value=slugify($('wiki-article-title').value);});
$('wiki-category-slug').addEventListener('input',e=>e.target.dataset.manual='1');$('wiki-article-slug').addEventListener('input',e=>e.target.dataset.manual='1');
window.SLFWikiAdminLoad=load;
})();