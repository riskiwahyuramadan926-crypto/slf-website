import { json, fail, readJson, requireOwner, logAdminActivity } from '../../_lib/common.js';

function productionOnly(request){const host=new URL(request.url).hostname.toLowerCase();return host==='legacy-frontier.web.id'||host==='www.legacy-frontier.web.id';}
const color=v=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v).toLowerCase():'';
const num=(v,min,max,fallback)=>{const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};
const plain=(v,max)=>String(v==null?'':v).replace(/[<>]/g,'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
const pageOk=v=>['all','home','store','wiki','help','order','review','ticket'].includes(v)||(/^wiki-[a-z0-9-]{1,48}$/.test(String(v||'')));
const selectorOk=v=>typeof v==='string'&&v.length<=280&&/^[A-Za-z0-9_#.:>()\[\]="\s-]+$/.test(v);
const validImage=v=>/^https:\/\/[^\s"'<>]+$/i.test(v)||/^\/(?:api\/media\/slf-[a-f0-9]{24}\.(?:png|jpe?g|webp|gif|avif)|assets\/images\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:png|jpe?g|webp|gif|avif))$/i.test(v);
const fonts=new Set(['system','serif','sans','rounded','mono','fantasy','display','book']);
const shadows=new Set(['none','soft','deep','glow','gold']);
const filters=new Set(['none','softBlur','gray','warm','vivid']);
const effects=new Set(['glass','glow','float','pulse','gradient','hover','outline','neon','shine','tilt','soft','border-glow']);
const easingValues=new Set(['linear','ease','ease-in','ease-out','ease-in-out']);
function normalizeKeyframes(input){if(!Array.isArray(input))return [];if(input.length>60)throw new Error('Maksimal 60 keyframe per layer.');let previous=-1;return input.map((frame,index)=>{const time=num(frame?.time,0,3600000,0);if(time<previous)throw new Error('Urutan waktu keyframe harus berurutan.');previous=time;const values={};for(const [key,min,max,fallback] of [['x',-100,200,0],['y',-100,200,0],['translateX',-100,100,0],['translateY',-100,100,0],['rotation',-3600,3600,0],['scaleX',.01,20,1],['scaleY',.01,20,1],['skewX',-85,85,0],['skewY',-85,85,0],['opacity',0,1,1]])if(frame?.[key]!==undefined)values[key]=num(frame[key],min,max,fallback);return {id:String(frame?.id||'kf-'+index).replace(/[^A-Za-z0-9_-]/g,'').slice(0,40)||'kf-'+index,time,easing:easingValues.has(frame?.easing)?frame.easing:'linear',values};});}

function normalizeStyles(input){
 const x=input&&typeof input==='object'?input:{},out={};
 if(color(x.color))out.color=color(x.color);
 if(color(x.backgroundColor))out.backgroundColor=color(x.backgroundColor);
 if(color(x.borderColor))out.borderColor=color(x.borderColor);
 if(['solid','dashed','dotted','none'].includes(x.borderStyle))out.borderStyle=x.borderStyle;
 if(['none','soft','glow','gold'].includes(x.textShadow))out.textShadow=x.textShadow;
 if(fonts.has(x.fontFamily))out.fontFamily=x.fontFamily;
 if(['normal','italic'].includes(x.fontStyle))out.fontStyle=x.fontStyle;
 if(['none','underline','line-through'].includes(x.textDecoration))out.textDecoration=x.textDecoration;
 for(const [key,min,max,fallback] of [['fontSize',8,120,16],['fontWeight',300,900,700],['lineHeight',.8,3,1.5],['letterSpacing',-2,20,0],['borderRadius',0,80,0],['padding',0,80,0],['marginBottom',0,120,0],['opacity',0,1,1],['maxWidth',80,1200,800],['widthPct',0,100,100],['minHeight',0,900,0],['borderWidth',0,40,0],['translateX',-100,100,0],['translateY',-100,100,0],['rotation',-3600,3600,0],['scaleX',.01,20,1],['scaleY',.01,20,1],['skewX',-85,85,0],['skewY',-85,85,0],['shadowBlur',0,120,0],['shadowX',-120,120,0],['shadowY',-120,120,0]])if(x[key]!==undefined)out[key]=num(x[key],min,max,fallback);
 if(['left','center','right','justify'].includes(x.textAlign))out.textAlign=x.textAlign;
 if(['none','uppercase','lowercase','capitalize'].includes(x.textTransform))out.textTransform=x.textTransform;
 if(shadows.has(x.boxShadow))out.boxShadow=x.boxShadow;
 if(x.gradient&&typeof x.gradient==='object'){const stops=Array.isArray(x.gradient.stops)?x.gradient.stops.slice(0,8).map(v=>({color:color(v?.color)||'#000000',position:num(v?.position,0,100,0)})):[];if(stops.length>=2)out.gradient={type:x.gradient.type==='radial'?'radial':'linear',angle:num(x.gradient.angle,0,360,135),stops};}
 if(typeof x.shadow==='boolean')out.shadow=x.shadow;if(color(x.shadowColor))out.shadowColor=color(x.shadowColor);
 if(['solid','dashed','dotted','double','none'].includes(x.borderStyle))out.borderStyle=x.borderStyle;
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
  const edit={page:x.page,selector:x.selector,tag:plain(x.tag,20),styles:normalizeStyles(x.styles),effects:Array.isArray(x.effects)?x.effects.filter(v=>effects.has(v)).slice(0,12):[],keyframes:normalizeKeyframes(x.keyframes),duration:num(x.duration,200,10000,900),easing:easingValues.has(x.easing)?x.easing:'ease',hidden:x.hidden===true};
  if(typeof x.text==='string')edit.text=plain(x.text,4000);if(typeof x.href==='string'){const href=plain(x.href,500);if(href&&!(/^(https:\/\/|\/(?!\/)|#)/i.test(href)))throw new Error('Tautan harus berupa path lokal atau HTTPS.');edit.href=href;}
  if(typeof x.src==='string'){const src=plain(x.src,500);const valid=x.tag==='video'?/^\/assets\/images\/uploads\/slf-[a-f0-9]{24}\.(?:mp4|webm)$/i.test(src):x.tag==='audio'?/^\/assets\/images\/uploads\/slf-[a-f0-9]{24}\.(?:mp3|m4a|wav|ogg|webm)$/i.test(src):!src||validImage(src);if(src&&!valid)throw new Error('URL media tidak valid.');edit.src=src;edit.backgroundImage=x.backgroundImage===true;}
  return edit;
 });
 const freeLayers=(Array.isArray(d.freeLayers)?d.freeLayers:[]).slice(0,100).map((x,i)=>{
  if(!x||!pageOk(x.page)||!selectorOk(x.containerSelector)||!/^free-[a-z0-9]{5,12}$/.test(String(x.id||'')))throw new Error('Layer gambar tidak valid. Muat ulang editor lalu coba lagi.');
  const src=plain(x.src,500);if(!src||!validImage(src))throw new Error('Sumber layer gambar tidak valid.');
  return {id:x.id,page:x.page,containerSelector:x.containerSelector,src,x:num(x.x,0,100,35),y:num(x.y,0,100,24),width:num(x.width,5,100,30),height:num(x.height,5,100,32),fit:['contain','cover','fill'].includes(x.fit)?x.fit:'contain',opacity:num(x.opacity,0,100,100),z:num(x.z,0,10,4),background:x.background===true,visible:x.visible!==false};
 });
 const insertedElements=(Array.isArray(d.insertedElements)?d.insertedElements:[]).slice(0,40).map(x=>{
  if(!x||!pageOk(x.page)||!selectorOk(x.containerSelector)||!/^slf-added-[a-z0-9]{5,12}$/.test(String(x.id||'')))throw new Error('Elemen tambahan tidak valid.');
  const type=['image','video','audio','button','divider','card','shape'].includes(x.type)?x.type:'text',src=plain(x.src,500);
  if(type==='image'&&(!src||!validImage(src)))throw new Error('Gambar tambahan membutuhkan URL gambar yang valid.');
  if(type==='video'&&!/^\/assets\/images\/uploads\/slf-[a-f0-9]{24}\.(?:mp4|webm)$/i.test(src))throw new Error('Video tambahan harus berasal dari pustaka media SLF.');
  if(type==='audio'&&!/^\/assets\/images\/uploads\/slf-[a-f0-9]{24}\.(?:mp3|m4a|wav|ogg|webm)$/i.test(src))throw new Error('Audio tambahan harus berasal dari pustaka media SLF.');
  const href=plain(x.href,500);if(type==='button'&&href&&!(/^(https:\/\/|\/(?!\/)|#)/i.test(href)))throw new Error('Tujuan tombol harus berupa path lokal atau HTTPS.');return {id:x.id,page:x.page,containerSelector:x.containerSelector,type,text:plain(x.text,1000),src,href,alt:plain(x.alt,120),styles:normalizeStyles(x.styles),effects:Array.isArray(x.effects)?x.effects.filter(v=>effects.has(v)).slice(0,12):[]};
 });

 const appLayers=(Array.isArray(d.appLayers)?d.appLayers:[]).slice(0,100).map((x,i)=>{
  if(!x||!pageOk(x.page)||!/^app-[A-Za-z0-9_-]{1,100}$/.test(String(x.id||'')))throw new Error('Project layer tidak valid.');
  const type=['text','image','video','audio','shape','button','table','card','input'].includes(x.type)?x.type:'text';
  const src=plain(x.src,500),href=plain(x.href,500);
  if(['image','video','audio'].includes(type)&&!src)throw new Error('Layer media memerlukan URL sumber.');
  if(type==='image'&&!validImage(src))throw new Error('URL gambar tidak valid.');
  if(type==='video'&&!(/^(https:\/\/[A-Za-z0-9.-]+\/[^\s"'<>]+|\/assets\/images\/uploads\/slf-[a-f0-9]{24}\.(?:mp4|webm))$/i.test(src)))throw new Error('URL video harus HTTPS atau aset video SLF.');
  if(type==='audio'&&!(/^(https:\/\/[A-Za-z0-9.-]+\/[^\s"'<>]+|\/assets\/images\/uploads\/slf-[a-f0-9]{24}\.(?:mp3|m4a|wav|ogg|webm))$/i.test(src)))throw new Error('URL audio harus HTTPS atau aset audio SLF.');
  if(type==='button'&&href&&!(/^(https:\/\/|\/(?!\/)|#)/i.test(href)))throw new Error('Tujuan tombol tidak valid.');
  const actionType=['none','navigate','external','scroll','backend-submit','backend-read'].includes(x.action?.type)?x.action.type:'none';
  const actionTarget=plain(x.action?.target,120);
  if(actionType==='navigate'&&actionTarget&&!/^\/[A-Za-z0-9/_?&=.-]*$/.test(actionTarget))throw new Error('Perintah navigasi harus berupa path internal.');
  if(actionType==='external'&&actionTarget&&!/^https:\/\/[^\s"'<>]+$/i.test(actionTarget))throw new Error('Perintah eksternal harus HTTPS.');
  if(actionType==='scroll'&&actionTarget&&!/^[A-Za-z0-9_.#-]{1,100}$/.test(actionTarget))throw new Error('Target scroll tidak valid.');
  if(actionType.startsWith('backend-')&&(type!=='button'||!/^studio_[a-z][a-z0-9_]{0,31}$/.test(actionTarget)))throw new Error('Action backend harus memakai tombol dan target tabel studio_ yang valid.');
  const fieldName=plain(x.fieldName,32).toLowerCase();if(type==='input'&&!/^[a-z][a-z0-9_]{0,31}$/.test(fieldName))throw new Error('Nama field input tidak valid.');
  const animation=['fade','float','pulse'].includes(x.animation)?x.animation:'none';
  const clickAnimation=['fade','float','pulse'].includes(x.clickAnimation)?x.clickAnimation:'none';
  return {id:String(x.id),page:x.page,type,name:plain(x.name,80),content:plain(x.content,5000),src,href,fieldName,rows:Array.isArray(x.rows)?x.rows.slice(0,20).map(row=>Array.isArray(row)?row.slice(0,8).map(cell=>plain(cell,300)):[]):[],action:{type:actionType,target:actionTarget},animation,clickAnimation,loop:x.loop===true,duration:num(x.duration,200,10000,900),x:num(x.x,-100,200,0),y:num(x.y,-100,200,0),width:num(x.width,0,200,100),height:num(x.height,0,200,0),z:num(x.z,0,100,i+1),visible:x.visible!==false,positioned:['x','y','width','height'].some(key=>x[key]!==undefined),rotation:num(x.rotation,-3600,3600,0),scaleX:num(x.scaleX,.01,20,1),scaleY:num(x.scaleY,.01,20,1),skewX:num(x.skewX,-85,85,0),skewY:num(x.skewY,-85,85,0),opacity:num(x.opacity,0,1,1),easing:easingValues.has(x.easing)?x.easing:'ease',keyframes:normalizeKeyframes(x.keyframes),visual:normalizeStyles(x.visual),styles:normalizeStyles(x.styles)};
 });

 return {version:2,page,accent:color(d.accent)||'#9b6cff',accent2:color(d.accent2)||'#f3cb82',background:color(d.background)||'#100c18',globalFont:fonts.has(d.globalFont)?d.globalFont:'system',overlayColor:color(d.overlayColor)||'#100c18',overlayOpacity:num(d.overlayOpacity,0,100,65),layers,freeLayers,elementEdits,insertedElements,appLayers};
}
export async function onRequestGet({request,env}){
 if(!(await requireOwner(request,env)))return fail('Akses Owner diperlukan.',403);
 const row=await env.DB.prepare("SELECT config_json,updated_at FROM site_design WHERE id='default'").first();
 let design=null;if(row){try{design=JSON.parse(row.config_json);}catch(_){}}
 return json({design,storageReady:typeof env.GITHUB_MEDIA_TOKEN==='string'&&env.GITHUB_MEDIA_TOKEN.trim().length>20,storageMessage:env.GITHUB_MEDIA_TOKEN?'Penyimpanan media GitHub aktif.':'Secret GITHUB_MEDIA_TOKEN belum dipasang; URL HTTPS dan aset lokal tetap bisa digunakan.'});
}
export async function onRequestPost({request,env}){
 if(!productionOnly(request))return fail('Export desain dinonaktifkan di Preview untuk melindungi database Production.',409);
 if(!(await requireOwner(request,env)))return fail('Akses Owner diperlukan.',403);
 const d=await readJson(request);let design;
 try{design=normalize(d.design);}catch(error){return fail(error.message||'Konfigurasi desain tidak valid.');}
 const now=new Date().toISOString();
 await env.DB.prepare("INSERT INTO site_design(id,config_json,updated_by,updated_at) VALUES('default',?,'owner',?) ON CONFLICT(id) DO UPDATE SET config_json=excluded.config_json,updated_by='owner',updated_at=excluded.updated_at").bind(JSON.stringify(design),now).run();
 await logAdminActivity(env.DB,'site_design_published','site_design','default',{elements:design.elementEdits.length,inserted:design.insertedElements.length});
 return json({ok:true,design,updatedAt:now});
}