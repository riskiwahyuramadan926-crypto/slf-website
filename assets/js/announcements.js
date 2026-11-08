(() => {
'use strict';
function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
async function loadAnnouncements(){
 const targets=[
  {section:document.getElementById('home-announcements'),root:document.getElementById('home-announcement-list'),home:true},
  {section:document.getElementById('store-announcements'),root:document.getElementById('announcement-list'),home:false}
 ].filter(x=>x.section&&x.root);
 if(!targets.length)return;
 try{
  const response=await fetch('/api/announcements',{cache:'no-store'});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error((data.error||'API pengumuman gagal')+' (HTTP '+response.status+')');
  const items=Array.isArray(data.announcements)?data.announcements:[];
  targets.forEach(target=>{
   target.root.replaceChildren();
   if(!items.length){
    const empty=node('article',target.home?'shop-card':'product');
    empty.append(node('h3','','Belum ada pengumuman aktif'),node('p','','Belum ada pengumuman yang aktif pada waktu sekarang. Periksa status dan jadwal di Admin → Pengumuman.'));
    target.root.append(empty);
   }else{
    items.forEach(item=>{
     const card=node('article',target.home?'shop-card':'product');
     const label=node('span',target.home?'status':'pill','PENGUMUMAN SLF');
     const title=node('h3','',item.title||'Pengumuman SLF');
     const body=node('p','',item.body||'');
     const date=node('small','subtle',item.created_at?new Date(item.created_at).toLocaleDateString('id-ID'):'');
     card.append(label,title,body,date);target.root.append(card);
    });
   }
   target.section.hidden=false;
  });
 }catch(error){
  targets.forEach(target=>{
   target.root.replaceChildren();
   const message=node('article',target.home?'shop-card':'product');
   message.append(node('h3','','Pengumuman sementara tidak dapat dimuat'),node('p','',error?.message||'Periksa koneksi lalu muat ulang halaman.'));
   target.root.append(message);target.section.hidden=false;
  });
  console.warn('[SLF] Pengumuman tidak dapat dimuat:',error?.message||error);
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadAnnouncements,{once:true});else loadAnnouncements();
})();