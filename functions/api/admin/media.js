import { json, fail, requireOwner, randomHex, logAdminActivity } from '../../_lib/common.js';
const allowed={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/avif':'avif'};
const validKey=key=>/^slf-[a-f0-9]{24}\.(?:png|jpg|webp|gif|avif)$/.test(String(key||''));
export async function onRequestGet({ request, env }) {
  if(!(await requireOwner(request,env)))return fail('Akses Owner diperlukan.',403);
  if(!env.MEDIA)return json({storageReady:false,assets:[],message:'Binding R2 MEDIA belum dipasang.'});
  const listed=await env.MEDIA.list({prefix:'slf-',limit:100});
  return json({storageReady:true,assets:(listed.objects||[]).filter(x=>validKey(x.key)).map(x=>({key:x.key,url:'/api/media/'+x.key,size:x.size,uploaded:x.uploaded}))});
}
export async function onRequestPost({ request, env }) {
  if(!(await requireOwner(request,env)))return fail('Akses Owner diperlukan.',403);
  if(!env.MEDIA)return fail('Penyimpanan gambar belum aktif. Buat bucket R2 dan hubungkan binding bernama MEDIA.',503);
  let form;try{form=await request.formData();}catch(_){return fail('Form upload tidak dapat dibaca.');}
  const file=form.get('file');
  if(!file||typeof file.arrayBuffer!=='function')return fail('Pilih file gambar terlebih dahulu.');
  if(!Object.prototype.hasOwnProperty.call(allowed,file.type))return fail('Format didukung: PNG, JPG, WEBP, GIF, dan AVIF.');
  if(file.size<1||file.size>5*1024*1024)return fail('Ukuran gambar maksimal 5 MB.');
  const key='slf-'+randomHex(24)+'.'+allowed[file.type];
  await env.MEDIA.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type,cacheControl:'public, max-age=31536000, immutable'},customMetadata:{originalName:String(file.name||'image').slice(0,100),uploadedBy:'owner'}});
  await logAdminActivity(env.DB,'media_uploaded','media',key,{size:file.size,type:file.type});
  return json({ok:true,asset:{key,url:'/api/media/'+key,size:file.size}},201);
}
export async function onRequestDelete({ request, env }) {
  if(!(await requireOwner(request,env)))return fail('Akses Owner diperlukan.',403);
  if(!env.MEDIA)return fail('Penyimpanan gambar belum aktif.',503);
  const key=new URL(request.url).searchParams.get('key')||'';
  if(!validKey(key))return fail('Kunci media tidak valid.');
  const publicUrl='/api/media/'+key;
  const design=await env.DB.prepare("SELECT config_json FROM site_design WHERE id='default'").first();
  if(design&&String(design.config_json||'').includes(publicUrl))return fail('Gambar masih dipakai oleh desain website. Lepaskan dari layer aktif sebelum menghapus.');
  const usedCard=await env.DB.prepare('SELECT id FROM site_content WHERE image_url=? LIMIT 1').bind(publicUrl).first();
  if(usedCard)return fail('Gambar masih dipakai oleh kartu informasi website. Ganti atau lepaskan gambarnya sebelum menghapus.');
  await env.MEDIA.delete(key);
  await logAdminActivity(env.DB,'media_deleted','media',key,{});
  return json({ok:true,key});
}