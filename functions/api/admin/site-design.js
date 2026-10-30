import { json, fail, readJson, requireOwner, logAdminActivity } from '../../_lib/common.js';

const color=v=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v).toLowerCase():'';
const num=(v,min,max,fallback)=>{const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};
const plain=(v,max)=>String(v==null?'':v).replace(/[<>]/g,'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
const pageOk=v=>['all','home','store','wiki','help','order','review','ticket'].includes(v);
const selectorOk=v=>typeof v==='string'&&v.length<=280&&/^[A-Za-z0-9_#.:>\[\]="\s-]+$/.test(v);
const validImage=v=>/^https:\/\/[^\s"'<>]+$/i.test(v)||/^\/(?:api\/media\/slf-[a-f0-9]{24}\.(?:png|jpe?g|webp|gif|avif)|assets\/images\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:png|jpe?g|webp|gif|avif))$/i.test(v);
const fonts=new Set(['system','serif','sans','rounded','mono','fantasy']);
const shadows=new Set(['none','soft','deep','glow','gold']);
const filters=new Set(['none','softBlur','gray','warm','vivid']);
const effects=new Set(['glass','glow','float','pulse','gradient','hover','outline']);
function normalizeStyles(input){
 const x=input&&typeof input==='object'?input:{},out={};
 if(color(x.color))out.color=color(x.color);
 if(color(x.backgroundColor))out.backgroundColor=color(x.backgroundColor);
 if(fonts.has(x.fontFamily))out.fontFamily=x.fontFamily;
 for(const [key,min,max,fallback] of [['fontSize',8,120,16],['fontWeight',300,900,700],['lineHeight',.8,3,1.5],['letterSpacing',-2,20,0],['borderRadius',0,80,0],['padding',0,80,0],['marginBottom',0,120,0],['opacity',0,1,1],['maxWidth',80,1200,800]])if(x[key]!==undefined)out[key]=num(x[key],min,max,fallback);
 if(['left','center','right','justify'].includes(x.textAlign))out.textAlign=x.textAlign;
 if(['none','uppercase','lowercase','capitalize'].includes(x.textTransform))out.textTransform=x.textTransform;
 if(shadows.has(x.boxShadow))out.boxShadow=x.boxShadow;
 if(filters.has(x.filter))out.filter=x.filter;
 if(['cover','contain','fill'].includes(x.objectFit))out.objectFit=x.objectFit;
 return out;
}
function normalize(input){
 const d=input&&typeof input==='object'?input:{};
 const page=pageOk(d.page)?d.page:'all';
 const layers=(Array.isArray(d.layers)?d.layers:[]).slice(0,16).map((v,i)=>{
  const x=v&&typeof v==='object'?v:{},type=x.type==='image'?'image':'text';
  const layer={id:/^[A-Za-z0-9_-]{1,40}$/.test(String(x.id||''))?String(x.id):'layer-'+i,type,name:plain(x.name,60)||(type==='image'?'Gambar':'Teks'),x:num(x.x,0,100,0),y:num(x.y,0,100,0),width:num(x.width,5,100,40),height:num(x.height,5,100,40),opacity:num(x.opacity,0,100,100),z:num(x.z,0,10,i+1),visible:x.visible!==false};
  if(type==='image'){const src=plain(x.src,500);if(src&&!validImage(src))throw new Error('Sumber gambar tidak valid.');layer.src=src;layer.fit=x.fit==='contain'?'contain':'cover';layer.blur=num(x.blur,0,20,0);}
  else{layer.text=plain(x.text,240);layer.color=color(x.color)||'#fff1d4';layer.fontSize=num(x.fontSize,12,120,32);layer.align=['left','center','right'].includes(x.align)?x.align:'left';layer.weight=num(x.weight,300,900,800);}
  return layer;
 });
 const elementEdits=(Array.isArray(d.elementEdits)?d.elementEdits:[]).slice(0,160).map(x=>{
  if(!x||!pageOk(x.page)||!selectorOk(x.selector))throw new Error('Target elemen tidak valid. Pilih ulang elemen pada preview.');
  const edit={page:x.page,selector:x.selector,tag:plain(x.tag,20),styles:normalizeStyles(x.styles),effects:Array.isArray(x.effects)?x.effects.filter(v=>effects.has(v)).slice(0,7):[],hidden:x.hidden===true};
  if(typeof x.text==='string')edit.text=plain(x.text,4000);
  if(typeof x.src==='string'){const src=plain(x.src,500);if(src&&!validImage(src))throw new Error('URL gambar tidak valid.');edit.src=src;}
  return edit;
 });
 const insertedElements=(Array.isArray(d.insertedElements)?d.insertedElements:[]).slice(0,40).map(x=>{
  if(!x||!pageOk(x.page)||!selectorOk(x.containerSelector)||!/^slf-added-[a-z0-9]{5,12}$/.test(String(x.id||'')))throw new Error('Elemen tambahan tidak valid.');
  const type=x.type==='image'?'image':'text',src=plain(x.src,500);
  if(type==='image'&&(!src||!validImage(src)))throw new Error('Gambar tambahan membutuhkan URL gambar yang valid.');
  return {id:x.id,page:x.page,containerSelector:x.containerSelector,type,text:plain(x.text,1000),src,alt:plain(x.alt,120),styles:normalizeStyles(x.styles),effects:Array.isArray(x.effects)?x.effects.filter(v=>effects.has(v)).slice(0,7):[]};
 });
 return {version:2,page,accent:color(d.accent)||'#9b6cff',accent2:color(d.accent2)||'#f3cb82',background:color(d.background)||'#100c18',overlayColor:color(d.overlayColor)||'#100c18',overlayOpacity:num(d.overlayOpacity,0,100,65),layers,elementEdits,insertedElements};
}
export async function onRequestGet({request,env}){
 if(!(await requireOwner(request,env)))return fail('Akses Owner diperlukan.',403);
 const row=await env.DB.prepare("SELECT config_json,updated_at FROM site_design WHERE id='default'").first();
 let design=null;if(row){try{design=JSON.parse(row.config_json);}catch(_){}}
 return json({design,storageReady:typeof env.GITHUB_MEDIA_TOKEN==='string'&&env.GITHUB_MEDIA_TOKEN.trim().length>20,storageMessage:env.GITHUB_MEDIA_TOKEN?'Penyimpanan media GitHub aktif.':'Secret GITHUB_MEDIA_TOKEN belum dipasang; URL HTTPS dan aset lokal tetap bisa digunakan.'});
}
export async function onRequestPost({request,env}){
 if(!(await requireOwner(request,env)))return fail('Akses Owner diperlukan.',403);
 const d=await readJson(request);let design;
 try{design=normalize(d.design);}catch(error){return fail(error.message||'Konfigurasi desain tidak valid.');}
 const now=new Date().toISOString();
 await env.DB.prepare("INSERT INTO site_design(id,config_json,updated_by,updated_at) VALUES('default',?,'owner',?) ON CONFLICT(id) DO UPDATE SET config_json=excluded.config_json,updated_by='owner',updated_at=excluded.updated_at").bind(JSON.stringify(design),now).run();
 await logAdminActivity(env.DB,'site_design_published','site_design','default',{elements:design.elementEdits.length,inserted:design.insertedElements.length});
 return json({ok:true,design,updatedAt:now});
}