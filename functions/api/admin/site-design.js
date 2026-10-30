import { json, fail, readJson, requireOwner, logAdminActivity } from '../../_lib/common.js';
const color = (v, fallback) => /^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v).toLowerCase() : fallback;
const num = (v, min, max, fallback) => { const n=Number(v); return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback; };
const plain = (v,max) => String(v==null?'':v).replace(/[<>]/g,'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
const validImage = value => /^https:\/\/[^\s"'<>]+$/i.test(value) || /^\/api\/media\/slf-[a-f0-9]{24}\.(?:png|jpe?g|webp|gif|avif)$/i.test(value) || /^\/assets\/images\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:png|jpe?g|webp|gif|avif)$/i.test(value);
function normalize(input) {
  const d=input&&typeof input==='object'?input:{};
  const page=['home','all','store','wiki'].includes(d.page)?d.page:'home';
  const layers=(Array.isArray(d.layers)?d.layers:[]).slice(0,16).map((v,i)=>{
    const x=v&&typeof v==='object'?v:{}, type=x.type==='image'?'image':'text';
    const layer={id:/^[A-Za-z0-9_-]{1,40}$/.test(String(x.id||''))?String(x.id):'layer-'+i,type,
      name:plain(x.name,60)||(type==='image'?'Gambar':'Teks'),x:num(x.x,0,100,0),y:num(x.y,0,100,0),
      width:num(x.width,5,100,40),height:num(x.height,5,100,40),opacity:num(x.opacity,0,100,100),
      z:num(x.z,0,10,i+1),visible:x.visible!==false};
    if(type==='image'){
      const src=plain(x.src,500); if(src&&!validImage(src))throw new Error('Sumber gambar '+layer.name+' tidak valid. Gunakan HTTPS atau aset SLF.');
      layer.src=src;layer.fit=x.fit==='contain'?'contain':'cover';layer.blur=num(x.blur,0,20,0);
    } else {
      layer.text=plain(x.text,240);layer.color=color(x.color,'#fff1d4');layer.fontSize=num(x.fontSize,12,120,32);
      layer.align=['left','center','right'].includes(x.align)?x.align:'left';layer.weight=num(x.weight,300,900,800);
    }
    return layer;
  });
  return {version:1,page,accent:color(d.accent,'#9b6cff'),accent2:color(d.accent2,'#f3cb82'),
    background:color(d.background,'#100c18'),overlayColor:color(d.overlayColor,'#100c18'),
    overlayOpacity:num(d.overlayOpacity,0,100,65),layers};
}
export async function onRequestGet({ request, env }) {
  if(!(await requireOwner(request,env)))return fail('Akses Owner diperlukan.',403);
  const row=await env.DB.prepare("SELECT config_json,updated_at FROM site_design WHERE id='default'").first();
  let design=null;if(row){try{design=JSON.parse(row.config_json);}catch(_){}}
  return json({design,storageReady:Boolean(env.MEDIA),storageMessage:env.MEDIA?'Penyimpanan R2 terhubung.':'Binding R2 MEDIA belum dipasang; URL gambar masih bisa digunakan.'});
}
export async function onRequestPost({ request, env }) {
  if(!(await requireOwner(request,env)))return fail('Akses Owner diperlukan.',403);
  const d=await readJson(request);let design;
  try{design=normalize(d.design);}catch(error){return fail(error.message||'Konfigurasi desain tidak valid.');}
  const now=new Date().toISOString();
  await env.DB.prepare("INSERT INTO site_design(id,config_json,updated_by,updated_at) VALUES('default',?,'owner',?) ON CONFLICT(id) DO UPDATE SET config_json=excluded.config_json,updated_by='owner',updated_at=excluded.updated_at")
    .bind(JSON.stringify(design),now).run();
  await logAdminActivity(env.DB,'site_design_published','site_design','default',{page:design.page,layers:design.layers.length});
  return json({ok:true,design,updatedAt:now});
}