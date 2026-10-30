import { json, fail, requireOwner, randomHex, logAdminActivity } from '../../_lib/common.js';

const REPO='riskiwahyuramadan926-crypto/slf-website';
const BRANCH='main';
const DIR='assets/images/uploads';
const MAX_BYTES=2*1024*1024;
const allowed={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'};
const validName=name=>/^slf-[a-f0-9]{24}\.(?:png|jpg|webp|gif)$/.test(String(name||''));
const publicUrl=name=>'/assets/images/uploads/'+name;
const apiUrl=path=>'https://api.github.com/repos/'+REPO+'/contents/'+path;

function tokenReady(env){return typeof env.GITHUB_MEDIA_TOKEN==='string'&&env.GITHUB_MEDIA_TOKEN.trim().length>20;}
async function github(env,path,options={}){
  const headers={
    accept:'application/vnd.github+json',
    authorization:'Bearer '+env.GITHUB_MEDIA_TOKEN.trim(),
    'x-github-api-version':'2022-11-28',
    'content-type':'application/json'
  };
  const response=await fetch(apiUrl(path),{...options,headers:{...headers,...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  return {response,data};
}
function githubFailure(status,data){
  if(status===401||status===403)return 'Token GitHub tidak valid, kedaluwarsa, atau tidak memiliki izin Contents.';
  if(status===404)return 'Folder media belum tersedia atau file tidak ditemukan.';
  if(status===409||status===422)return 'GitHub menolak perubahan. Muat ulang pustaka media lalu coba lagi.';
  return String(data?.message||('GitHub merespons '+status+'.')).slice(0,220);
}
function encodeBase64(bytes){
  let binary='';
  for(let offset=0;offset<bytes.length;offset+=0x8000){
    binary+=String.fromCharCode(...bytes.subarray(offset,Math.min(offset+0x8000,bytes.length)));
  }
  return btoa(binary);
}

export async function onRequestGet({request,env}){
  if(!(await requireOwner(request,env)))return fail('Akses Owner diperlukan.',403);
  if(!tokenReady(env))return json({storageReady:false,assets:[],message:'Tambahkan secret GITHUB_MEDIA_TOKEN di Cloudflare Pages untuk mengaktifkan upload.'});
  const {response,data}=await github(env,DIR+'?ref='+BRANCH);
  if(response.status===404)return json({storageReady:true,assets:[],message:'Pustaka media masih kosong.'});
  if(!response.ok)return fail(githubFailure(response.status,data),response.status===403?503:502);
  const assets=(Array.isArray(data)?data:[])
    .filter(item=>item&&item.type==='file'&&validName(item.name))
    .map(item=>({key:item.name,url:publicUrl(item.name),size:Number(item.size)||0,uploaded:item.git_url||''}));
  return json({storageReady:true,assets,message:'Media tersimpan sebagai aset statis website.'});
}

export async function onRequestPost({request,env}){
  if(!(await requireOwner(request,env)))return fail('Akses Owner diperlukan.',403);
  if(!tokenReady(env))return fail('Upload belum aktif. Secret GITHUB_MEDIA_TOKEN belum dipasang di Cloudflare Pages.',503);
  let form;try{form=await request.formData();}catch(_){return fail('Form upload tidak dapat dibaca.');}
  const file=form.get('file');
  if(!file||typeof file.arrayBuffer!=='function')return fail('Pilih file gambar terlebih dahulu.');
  if(!Object.prototype.hasOwnProperty.call(allowed,file.type))return fail('Format didukung: PNG, JPG, WEBP, dan GIF.');
  if(file.size<1||file.size>MAX_BYTES)return fail('Ukuran file setelah optimasi maksimal 2 MB.');
  const name='slf-'+randomHex(24)+'.'+allowed[file.type];
  const bytes=new Uint8Array(await file.arrayBuffer());
  const content=encodeBase64(bytes);
  const {response,data}=await github(env,DIR+'/'+name,{
    method:'PUT',
    body:JSON.stringify({message:'Upload media SLF Studio: '+name,branch:BRANCH,content})
  });
  if(!response.ok)return fail(githubFailure(response.status,data),response.status===403?503:502);
  await logAdminActivity(env.DB,'media_uploaded','media',name,{size:file.size,type:file.type,storage:'github-static'});
  return json({ok:true,asset:{key:name,url:publicUrl(name),size:file.size},commit:data.commit?.sha||null,deploymentTriggered:true},201);
}

export async function onRequestDelete({request,env}){
  if(!(await requireOwner(request,env)))return fail('Akses Owner diperlukan.',403);
  if(!tokenReady(env))return fail('Penyimpanan GitHub belum dikonfigurasi.',503);
  const key=new URL(request.url).searchParams.get('key')||'';
  if(!validName(key))return fail('Kunci media tidak valid.');
  const url=publicUrl(key);
  const design=await env.DB.prepare("SELECT config_json FROM site_design WHERE id='default'").first();
  if(design&&String(design.config_json||'').includes(url))return fail('Gambar masih dipakai oleh desain website. Lepaskan dari layer aktif sebelum menghapus.');
  const usedCard=await env.DB.prepare('SELECT id FROM site_content WHERE image_url=? LIMIT 1').bind(url).first();
  if(usedCard)return fail('Gambar masih dipakai oleh kartu informasi website. Ganti atau lepaskan gambarnya sebelum menghapus.');
  const {response:readResponse,data:current}=await github(env,DIR+'/'+key+'?ref='+BRANCH);
  if(!readResponse.ok)return fail(githubFailure(readResponse.status,current),readResponse.status===404?404:502);
  const {response,data}=await github(env,DIR+'/'+key,{
    method:'DELETE',
    body:JSON.stringify({message:'Hapus media SLF Studio: '+key,branch:BRANCH,sha:current.sha})
  });
  if(!response.ok)return fail(githubFailure(response.status,data),response.status===403?503:502);
  await logAdminActivity(env.DB,'media_deleted','media',key,{storage:'github-static'});
  return json({ok:true,key,deploymentTriggered:true});
}
