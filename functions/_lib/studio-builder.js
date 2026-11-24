export const STUDIO_TABLE_PREFIX = 'studio_';
export const STUDIO_PREVIEW_TABLE_PREFIX = 'studio_preview_';
const RESERVED_ROUTES = new Set(['admin','api','app','assets','bantuan','images','store','wiki','fonts','uploads','robots','favicon','sitemap']);
const IDENTIFIER = /^[a-z][a-z0-9_]{0,31}$/;
const FIELD_TYPES = new Set(['text','integer','real']);
const RESERVED_COLUMNS = new Set(['id','created_at','updated_at']);
const ANIMATIONS = new Set(['none','fade','float','pulse']);
const ACTIONS = new Set(['none','navigate','external','scroll','backend-submit','backend-read']);
const color = v => /^#[0-9a-f]{6}$/i.test(String(v ?? '')) ? String(v).toLowerCase() : '';
const clamp = (v,min,max,fallback) => { const n=Number(v); return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback; };
const plain = (v,max=5000) => String(v ?? '').replace(/[<>\u0000-\u001f]/g,' ').trim().slice(0,max);

const SCOPES = {
  production: { environment:'production', tablePrefix:STUDIO_TABLE_PREFIX, pagesTable:'studio_pages', draftsTable:'studio_drafts', backendTablesTable:'studio_backend_tables', rateLimitTable:'studio_data_rate_limits' },
  preview: { environment:'preview', tablePrefix:STUDIO_PREVIEW_TABLE_PREFIX, pagesTable:'studio_preview_pages', draftsTable:'studio_preview_drafts', backendTablesTable:'studio_preview_backend_tables', rateLimitTable:'studio_preview_data_rate_limits' }
};

export function getStudioScope(request) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  if (hostname === 'legacy-frontier.web.id' || hostname === 'www.legacy-frontier.web.id') return SCOPES.production;
  if (hostname === 'slf-website.pages.dev' || hostname.endsWith('.slf-website.pages.dev') || hostname === 'localhost' || hostname === '127.0.0.1') return SCOPES.preview;
  return null;
}

export function normalizeStudioRoute(value) {
  const match=String(value ?? '').trim().match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/i);
  if(!match) throw new Error('Route harus satu segmen sederhana, contoh /event atau /event-musim.');
  const slug=match[1].toLowerCase();
  if(slug.length>48||RESERVED_ROUTES.has(slug)||slug.startsWith('slf-')) throw new Error('Nama route memakai jalur khusus website atau terlalu panjang.');
  return '/'+slug;
}

export function normalizeStudioTableDefinition(input={}, tablePrefix=STUDIO_TABLE_PREFIX) {
  const prefix = tablePrefix === STUDIO_PREVIEW_TABLE_PREFIX ? STUDIO_PREVIEW_TABLE_PREFIX : STUDIO_TABLE_PREFIX;
  const rawTableName=String(input.tableName??'');
  const source=input.slug??input.name??(rawTableName.startsWith(prefix)?rawTableName.slice(prefix.length):rawTableName);
  const slug=String(source).trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  if(!/^[a-z][a-z0-9_]{0,31}$/.test(slug)) throw new Error('Nama tabel harus diawali huruf dan hanya berisi huruf kecil, angka, atau underscore.');
  const columns=Array.isArray(input.columns)?input.columns:[];
  if(columns.length<1||columns.length>12) throw new Error('Tabel harus memiliki 1–12 kolom data.');
  const seen=new Set();
  const normalized=columns.map(column=>{
    const name=String(column?.name??'').trim().toLowerCase(),type=String(column?.type??'text').toLowerCase();
    if(!IDENTIFIER.test(name)||RESERVED_COLUMNS.has(name)) throw new Error('Nama kolom tidak valid: '+(name||'(kosong)')+'.');
    if(seen.has(name)) throw new Error('Nama kolom duplikat: '+name+'.');
    if(!FIELD_TYPES.has(type)) throw new Error('Tipe kolom tidak didukung: '+type+'.');
    seen.add(name);return {name,type,required:column.required===true,unique:column.unique===true};
  });
  return {tableName:prefix+slug,tablePrefix:prefix,displayName:plain(input.displayName??slug,60)||slug,columns:normalized,allowPublicWrite:input.allowPublicWrite===true,allowPublicRead:input.allowPublicRead===true};
}

export function buildStudioCreateTableSql(definition) {
  const safe=normalizeStudioTableDefinition(definition,definition?.tablePrefix);
  const columns=['"id" TEXT PRIMARY KEY NOT NULL','"created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP',...safe.columns.map(column=>{
    let sql='"'+column.name+'" '+column.type.toUpperCase();if(column.required)sql+=' NOT NULL';if(column.unique)sql+=' UNIQUE';return sql;
  })];
  return 'CREATE TABLE "'+safe.tableName+'" ('+columns.join(', ')+')';
}

export function normalizeStudioSubmission(definition,payload) {
  const schema=normalizeStudioTableDefinition(definition,definition?.tablePrefix);
  if(!payload||typeof payload!=='object'||Array.isArray(payload)) throw new Error('Data formulir tidak valid.');
  const allowed=new Map(schema.columns.map(column=>[column.name,column]));
  if(Object.keys(payload).some(key=>!allowed.has(key))) throw new Error('Data berisi kolom yang tidak diizinkan.');
  const names=[],values=[];
  for(const column of schema.columns){
    const value=payload[column.name];
    if(value===undefined||value===null||value===''){if(column.required)throw new Error('Kolom '+column.name+' wajib diisi.');continue;}
    let normalized;
    if(column.type==='text'){if(typeof value!=='string'||value.length>1000)throw new Error('Isi '+column.name+' harus berupa teks maksimal 1000 karakter.');normalized=value.trim();if(column.required&&!normalized)throw new Error('Kolom '+column.name+' wajib diisi.');}
    else if(column.type==='integer'){normalized=Number(value);if(!Number.isSafeInteger(normalized))throw new Error('Isi '+column.name+' harus berupa bilangan bulat.');}
    else {normalized=Number(value);if(!Number.isFinite(normalized))throw new Error('Isi '+column.name+' harus berupa angka.');}
    names.push(column.name);values.push(normalized);
  }
  return {names,values};
}

const EASINGS = new Set(['linear','ease','ease-in','ease-out','ease-in-out']);
const EFFECTS = new Set(['glass','glow','float','pulse','gradient','hover','outline','neon','shine','tilt','soft','border-glow']);
function normalizeKeyframes(input) {
 if(!Array.isArray(input))return [];if(input.length>60)throw new Error('Maksimal 60 keyframe per layer.');let previous=-1;
 return input.map((frame,index)=>{const time=clamp(frame?.time,0,3600000,0);if(time<previous)throw new Error('Urutan waktu keyframe harus berurutan.');previous=time;const values={};
 for(const [key,min,max,fallback] of [['x',-100,200,0],['y',-100,200,0],['rotation',-3600,3600,0],['scaleX',.01,20,1],['scaleY',.01,20,1],['skewX',-85,85,0],['skewY',-85,85,0],['opacity',0,1,1]])if(frame?.[key]!==undefined)values[key]=clamp(frame[key],min,max,fallback);
 return {id:String(frame?.id||'kf-'+index).replace(/[^A-Za-z0-9_-]/g,'').slice(0,40)||'kf-'+index,time,easing:EASINGS.has(frame?.easing)?frame.easing:'linear',values};});
}
function normalizeStudioVisual(input={}) {
 const x=input&&typeof input==='object'?input:{},out={};
 for(const key of ['color','backgroundColor','borderColor','shadowColor'])if(color(x[key]))out[key]=color(x[key]);
 for(const [key,min,max,fallback] of [['rotation',-3600,3600,0],['scaleX',.01,20,1],['scaleY',.01,20,1],['skewX',-85,85,0],['skewY',-85,85,0],['opacity',0,1,1],['borderWidth',0,40,0],['borderRadius',0,500,0],['shadowBlur',0,120,0],['shadowX',-120,120,0],['shadowY',-120,120,0],['fontSize',8,240,16],['fontWeight',100,900,700],['letterSpacing',-10,50,0],['lineHeight',.5,4,1.2]])if(x[key]!==undefined)out[key]=clamp(x[key],min,max,fallback);
 if(['solid','dashed','dotted','double','none'].includes(x.borderStyle))out.borderStyle=x.borderStyle;
 if(['cover','contain','fill'].includes(x.objectFit))out.objectFit=x.objectFit;
 if(['left','center','right','justify'].includes(x.textAlign))out.textAlign=x.textAlign;
 if(x.gradient&&typeof x.gradient==='object'){const stops=Array.isArray(x.gradient.stops)?x.gradient.stops.slice(0,8).map(v=>({color:color(v?.color)||'#000000',position:clamp(v?.position,0,100,0)})):[];if(stops.length>=2)out.gradient={type:x.gradient.type==='radial'?'radial':'linear',angle:clamp(x.gradient.angle,0,360,135),stops};}
 if(Array.isArray(x.effects))out.effects=x.effects.filter(v=>EFFECTS.has(v)).slice(0,12);if(typeof x.shadow==='boolean')out.shadow=x.shadow;
 if(['none','soft','deep','glow','gold'].includes(x.shadowPreset))out.shadowPreset=x.shadowPreset;return out;
}

export function normalizeStudioLayers(input, tablePrefix=STUDIO_TABLE_PREFIX) {
  if(!Array.isArray(input)||input.length>100) throw new Error('Halaman hanya boleh memiliki maksimal 100 layer.');
  const prefix=tablePrefix===STUDIO_PREVIEW_TABLE_PREFIX?STUDIO_PREVIEW_TABLE_PREFIX:STUDIO_TABLE_PREFIX;
  const backendTargetPattern=prefix===STUDIO_PREVIEW_TABLE_PREFIX?new RegExp('^'+prefix+'[a-z][a-z0-9_]{0,31}
  const layerIds=new Set(),fieldNames=new Set();
  return input.map((item,index)=>{
    if(!item||typeof item!=='object') throw new Error('Layer '+(index+1)+' tidak valid.');
    const type=['text','image','video','audio','shape','button','table','card','input'].includes(item.type)?item.type:'';
    if(!type) throw new Error('Jenis layer '+(index+1)+' tidak didukung.');
    const id=String(item.id??'layer-'+index);if(!/^[A-Za-z0-9_-]{1,120}$/.test(id)||layerIds.has(id))throw new Error('ID layer tidak valid atau duplikat.');layerIds.add(id);
    const src=plain(item.src,1000);
    if(type==='image'&&!(/^(https:\/\/[^\s"'<>]+|\/assets\/images\/uploads\/slf-[a-f0-9]{24}\.(?:png|jpe?g|webp|gif|avif))$/i.test(src)))throw new Error('URL gambar harus HTTPS atau aset gambar SLF yang valid.');
    if(type==='video'&&!(/^(https:\/\/[^\s"'<>]+|\/assets\/images\/uploads\/slf-[a-f0-9]{24}\.(?:mp4|webm))$/i.test(src)))throw new Error('URL video harus HTTPS atau aset video SLF.');
    if(type==='audio'&&!(/^(https:\/\/[^\s"'<>]+|\/assets\/images\/uploads\/slf-[a-f0-9]{24}\.(?:mp3|m4a|wav|ogg|webm))$/i.test(src)))throw new Error('URL audio harus HTTPS atau aset audio SLF.');
    const href=plain(item.href,1000);
    if(href&&!(/^(https:\/\/[^\s"'<>]+|\/(?!\/)[A-Za-z0-9/_?&=.%#-]*|#[A-Za-z0-9_.-]+)$/i.test(href)))throw new Error('Tautan tombol harus path internal, anchor, atau HTTPS.');
    const actionType=ACTIONS.has(item.action?.type)?item.action.type:'none',actionTarget=plain(item.action?.target,120);
    if(actionType==='navigate'&&actionTarget&&!/^\/(?!\/)[A-Za-z0-9/_?&=.%#-]*$/.test(actionTarget))throw new Error('Tujuan navigasi tidak valid.');
    if(actionType==='external'&&actionTarget&&!/^https:\/\/[^\s"'<>]+$/i.test(actionTarget))throw new Error('Tujuan eksternal harus HTTPS.');
    if(actionType==='scroll'&&actionTarget&&!/^[A-Za-z0-9_.#-]{1,100}$/.test(actionTarget))throw new Error('Target scroll tidak valid.');
    if(actionType.startsWith('backend-')&&(type!=='button'||!backendTargetPattern.test(actionTarget)))throw new Error('Action backend harus memakai tombol dan target tabel berawalan '+prefix+'.');
    const rows=Array.isArray(item.rows)?item.rows.slice(0,20).map(row=>Array.isArray(row)?row.slice(0,8).map(cell=>plain(cell,300)):[]):[];
    const styles=item.styles&&typeof item.styles==='object'?item.styles:{},safeStyles={};
    for(const key of ['color','backgroundColor','borderColor'])if(color(styles[key]))safeStyles[key]=color(styles[key]);
    for(const [key,min,max] of [['fontSize',8,96],['fontWeight',300,900],['padding',0,80],['borderRadius',0,80],['maxWidth',100,1200],['marginBottom',0,100]])if(styles[key]!==undefined)safeStyles[key]=clamp(styles[key],min,max,min);
    if(['left','center','right'].includes(styles.textAlign))safeStyles.textAlign=styles.textAlign;
    if(['system','serif','sans','mono','rounded'].includes(styles.fontFamily))safeStyles.fontFamily=styles.fontFamily;
    const fieldName=String(item.fieldName??'').trim().toLowerCase();
    if(type==='input'&&(!IDENTIFIER.test(fieldName)||fieldNames.has(fieldName)))throw new Error('Input layer harus memiliki nama field unik, misalnya player_name.');if(type==='input')fieldNames.add(fieldName);
    const visual=normalizeStudioVisual(item.visual||item.styles||{}),keyframes=normalizeKeyframes(item.keyframes);return {id,type,name:plain(item.name,80)||'Layer '+(index+1),content:plain(item.content,5000),src,href,fieldName,rows,action:{type:actionType,target:actionTarget},animation:ANIMATIONS.has(item.animation)?item.animation:'none',clickAnimation:ANIMATIONS.has(item.clickAnimation)?item.clickAnimation:'none',loop:item.loop===true,duration:clamp(item.duration,200,10000,900),x:clamp(item.x,-100,200,0),y:clamp(item.y,-100,200,0),width:clamp(item.width,0,200,100),height:clamp(item.height,0,200,0),z:clamp(item.z,0,100,index+1),visible:item.visible!==false,positioned:['x','y','width','height'].some(key=>item[key]!==undefined),rotation:clamp(item.rotation,-3600,3600,0),scaleX:clamp(item.scaleX,.01,20,1),scaleY:clamp(item.scaleY,.01,20,1),skewX:clamp(item.skewX,-85,85,0),skewY:clamp(item.skewY,-85,85,0),opacity:clamp(item.opacity,0,1,1),easing:EASINGS.has(item.easing)?item.easing:'ease',keyframes,visual,styles:safeStyles};
  });
}

export async function ensureStudioMetaSchema(db, scope='production') {
  const selected=typeof scope==='string'?(scope==='preview'?SCOPES.preview:SCOPES.production):scope;
  const safe=selected?.environment==='preview'?SCOPES.preview:SCOPES.production;
  await db.prepare('CREATE TABLE IF NOT EXISTS "'+safe.pagesTable+'" (id TEXT PRIMARY KEY NOT NULL,route_path TEXT NOT NULL UNIQUE,page_name TEXT NOT NULL,layers_json TEXT NOT NULL,is_published INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS "'+safe.draftsTable+'" (id TEXT PRIMARY KEY NOT NULL,project_name TEXT NOT NULL,page_path TEXT NOT NULL,project_json TEXT NOT NULL,is_template INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS "'+safe.backendTablesTable+'" (table_name TEXT PRIMARY KEY NOT NULL,display_name TEXT NOT NULL,schema_json TEXT NOT NULL,allow_public_write INTEGER NOT NULL DEFAULT 1,allow_public_read INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS "'+safe.rateLimitTable+'" (ip_hash TEXT PRIMARY KEY NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,window_started INTEGER NOT NULL)').run();
  return safe;
}
):new RegExp('^'+prefix+'(?!preview_)[a-z][a-z0-9_]{0,31}
  const layerIds=new Set(),fieldNames=new Set();
  return input.map((item,index)=>{
    if(!item||typeof item!=='object') throw new Error('Layer '+(index+1)+' tidak valid.');
    const type=['text','image','video','audio','shape','button','table','card','input'].includes(item.type)?item.type:'';
    if(!type) throw new Error('Jenis layer '+(index+1)+' tidak didukung.');
    const id=String(item.id??'layer-'+index);if(!/^[A-Za-z0-9_-]{1,120}$/.test(id)||layerIds.has(id))throw new Error('ID layer tidak valid atau duplikat.');layerIds.add(id);
    const src=plain(item.src,1000);
    if(type==='image'&&!(/^(https:\/\/[^\s"'<>]+|\/assets\/images\/uploads\/slf-[a-f0-9]{24}\.(?:png|jpe?g|webp|gif|avif))$/i.test(src)))throw new Error('URL gambar harus HTTPS atau aset gambar SLF yang valid.');
    if(type==='video'&&!(/^(https:\/\/[^\s"'<>]+|\/assets\/images\/uploads\/slf-[a-f0-9]{24}\.(?:mp4|webm))$/i.test(src)))throw new Error('URL video harus HTTPS atau aset video SLF.');
    if(type==='audio'&&!(/^(https:\/\/[^\s"'<>]+|\/assets\/images\/uploads\/slf-[a-f0-9]{24}\.(?:mp3|m4a|wav|ogg|webm))$/i.test(src)))throw new Error('URL audio harus HTTPS atau aset audio SLF.');
    const href=plain(item.href,1000);
    if(href&&!(/^(https:\/\/[^\s"'<>]+|\/(?!\/)[A-Za-z0-9/_?&=.%#-]*|#[A-Za-z0-9_.-]+)$/i.test(href)))throw new Error('Tautan tombol harus path internal, anchor, atau HTTPS.');
    const actionType=ACTIONS.has(item.action?.type)?item.action.type:'none',actionTarget=plain(item.action?.target,120);
    if(actionType==='navigate'&&actionTarget&&!/^\/(?!\/)[A-Za-z0-9/_?&=.%#-]*$/.test(actionTarget))throw new Error('Tujuan navigasi tidak valid.');
    if(actionType==='external'&&actionTarget&&!/^https:\/\/[^\s"'<>]+$/i.test(actionTarget))throw new Error('Tujuan eksternal harus HTTPS.');
    if(actionType==='scroll'&&actionTarget&&!/^[A-Za-z0-9_.#-]{1,100}$/.test(actionTarget))throw new Error('Target scroll tidak valid.');
    if(actionType.startsWith('backend-')&&(type!=='button'||!backendTargetPattern.test(actionTarget)))throw new Error('Action backend harus memakai tombol dan target tabel berawalan '+prefix+'.');
    const rows=Array.isArray(item.rows)?item.rows.slice(0,20).map(row=>Array.isArray(row)?row.slice(0,8).map(cell=>plain(cell,300)):[]):[];
    const styles=item.styles&&typeof item.styles==='object'?item.styles:{},safeStyles={};
    for(const key of ['color','backgroundColor','borderColor'])if(color(styles[key]))safeStyles[key]=color(styles[key]);
    for(const [key,min,max] of [['fontSize',8,96],['fontWeight',300,900],['padding',0,80],['borderRadius',0,80],['maxWidth',100,1200],['marginBottom',0,100]])if(styles[key]!==undefined)safeStyles[key]=clamp(styles[key],min,max,min);
    if(['left','center','right'].includes(styles.textAlign))safeStyles.textAlign=styles.textAlign;
    if(['system','serif','sans','mono','rounded'].includes(styles.fontFamily))safeStyles.fontFamily=styles.fontFamily;
    const fieldName=String(item.fieldName??'').trim().toLowerCase();
    if(type==='input'&&(!IDENTIFIER.test(fieldName)||fieldNames.has(fieldName)))throw new Error('Input layer harus memiliki nama field unik, misalnya player_name.');if(type==='input')fieldNames.add(fieldName);
    const visual=normalizeStudioVisual(item.visual||item.styles||{}),keyframes=normalizeKeyframes(item.keyframes);return {id,type,name:plain(item.name,80)||'Layer '+(index+1),content:plain(item.content,5000),src,href,fieldName,rows,action:{type:actionType,target:actionTarget},animation:ANIMATIONS.has(item.animation)?item.animation:'none',clickAnimation:ANIMATIONS.has(item.clickAnimation)?item.clickAnimation:'none',loop:item.loop===true,duration:clamp(item.duration,200,10000,900),x:clamp(item.x,-100,200,0),y:clamp(item.y,-100,200,0),width:clamp(item.width,0,200,100),height:clamp(item.height,0,200,0),z:clamp(item.z,0,100,index+1),visible:item.visible!==false,positioned:['x','y','width','height'].some(key=>item[key]!==undefined),rotation:clamp(item.rotation,-3600,3600,0),scaleX:clamp(item.scaleX,.01,20,1),scaleY:clamp(item.scaleY,.01,20,1),skewX:clamp(item.skewX,-85,85,0),skewY:clamp(item.skewY,-85,85,0),opacity:clamp(item.opacity,0,1,1),easing:EASINGS.has(item.easing)?item.easing:'ease',keyframes,visual,styles:safeStyles};
  });
}

export async function ensureStudioMetaSchema(db, scope='production') {
  const selected=typeof scope==='string'?(scope==='preview'?SCOPES.preview:SCOPES.production):scope;
  const safe=selected?.environment==='preview'?SCOPES.preview:SCOPES.production;
  await db.prepare('CREATE TABLE IF NOT EXISTS "'+safe.pagesTable+'" (id TEXT PRIMARY KEY NOT NULL,route_path TEXT NOT NULL UNIQUE,page_name TEXT NOT NULL,layers_json TEXT NOT NULL,is_published INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS "'+safe.draftsTable+'" (id TEXT PRIMARY KEY NOT NULL,project_name TEXT NOT NULL,page_path TEXT NOT NULL,project_json TEXT NOT NULL,is_template INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS "'+safe.backendTablesTable+'" (table_name TEXT PRIMARY KEY NOT NULL,display_name TEXT NOT NULL,schema_json TEXT NOT NULL,allow_public_write INTEGER NOT NULL DEFAULT 1,allow_public_read INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS "'+safe.rateLimitTable+'" (ip_hash TEXT PRIMARY KEY NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,window_started INTEGER NOT NULL)').run();
  return safe;
}
);
  const layerIds=new Set(),fieldNames=new Set();
  return input.map((item,index)=>{
    if(!item||typeof item!=='object') throw new Error('Layer '+(index+1)+' tidak valid.');
    const type=['text','image','video','audio','shape','button','table','card','input'].includes(item.type)?item.type:'';
    if(!type) throw new Error('Jenis layer '+(index+1)+' tidak didukung.');
    const id=String(item.id??'layer-'+index);if(!/^[A-Za-z0-9_-]{1,120}$/.test(id)||layerIds.has(id))throw new Error('ID layer tidak valid atau duplikat.');layerIds.add(id);
    const src=plain(item.src,1000);
    if(type==='image'&&!(/^(https:\/\/[^\s"'<>]+|\/assets\/images\/uploads\/slf-[a-f0-9]{24}\.(?:png|jpe?g|webp|gif|avif))$/i.test(src)))throw new Error('URL gambar harus HTTPS atau aset gambar SLF yang valid.');
    if(type==='video'&&!(/^(https:\/\/[^\s"'<>]+|\/assets\/images\/uploads\/slf-[a-f0-9]{24}\.(?:mp4|webm))$/i.test(src)))throw new Error('URL video harus HTTPS atau aset video SLF.');
    if(type==='audio'&&!(/^(https:\/\/[^\s"'<>]+|\/assets\/images\/uploads\/slf-[a-f0-9]{24}\.(?:mp3|m4a|wav|ogg|webm))$/i.test(src)))throw new Error('URL audio harus HTTPS atau aset audio SLF.');
    const href=plain(item.href,1000);
    if(href&&!(/^(https:\/\/[^\s"'<>]+|\/(?!\/)[A-Za-z0-9/_?&=.%#-]*|#[A-Za-z0-9_.-]+)$/i.test(href)))throw new Error('Tautan tombol harus path internal, anchor, atau HTTPS.');
    const actionType=ACTIONS.has(item.action?.type)?item.action.type:'none',actionTarget=plain(item.action?.target,120);
    if(actionType==='navigate'&&actionTarget&&!/^\/(?!\/)[A-Za-z0-9/_?&=.%#-]*$/.test(actionTarget))throw new Error('Tujuan navigasi tidak valid.');
    if(actionType==='external'&&actionTarget&&!/^https:\/\/[^\s"'<>]+$/i.test(actionTarget))throw new Error('Tujuan eksternal harus HTTPS.');
    if(actionType==='scroll'&&actionTarget&&!/^[A-Za-z0-9_.#-]{1,100}$/.test(actionTarget))throw new Error('Target scroll tidak valid.');
    if(actionType.startsWith('backend-')&&(type!=='button'||!backendTargetPattern.test(actionTarget)))throw new Error('Action backend harus memakai tombol dan target tabel berawalan '+prefix+'.');
    const rows=Array.isArray(item.rows)?item.rows.slice(0,20).map(row=>Array.isArray(row)?row.slice(0,8).map(cell=>plain(cell,300)):[]):[];
    const styles=item.styles&&typeof item.styles==='object'?item.styles:{},safeStyles={};
    for(const key of ['color','backgroundColor','borderColor'])if(color(styles[key]))safeStyles[key]=color(styles[key]);
    for(const [key,min,max] of [['fontSize',8,96],['fontWeight',300,900],['padding',0,80],['borderRadius',0,80],['maxWidth',100,1200],['marginBottom',0,100]])if(styles[key]!==undefined)safeStyles[key]=clamp(styles[key],min,max,min);
    if(['left','center','right'].includes(styles.textAlign))safeStyles.textAlign=styles.textAlign;
    if(['system','serif','sans','mono','rounded'].includes(styles.fontFamily))safeStyles.fontFamily=styles.fontFamily;
    const fieldName=String(item.fieldName??'').trim().toLowerCase();
    if(type==='input'&&(!IDENTIFIER.test(fieldName)||fieldNames.has(fieldName)))throw new Error('Input layer harus memiliki nama field unik, misalnya player_name.');if(type==='input')fieldNames.add(fieldName);
    const visual=normalizeStudioVisual(item.visual||item.styles||{}),keyframes=normalizeKeyframes(item.keyframes);return {id,type,name:plain(item.name,80)||'Layer '+(index+1),content:plain(item.content,5000),src,href,fieldName,rows,action:{type:actionType,target:actionTarget},animation:ANIMATIONS.has(item.animation)?item.animation:'none',clickAnimation:ANIMATIONS.has(item.clickAnimation)?item.clickAnimation:'none',loop:item.loop===true,duration:clamp(item.duration,200,10000,900),x:clamp(item.x,-100,200,0),y:clamp(item.y,-100,200,0),width:clamp(item.width,0,200,100),height:clamp(item.height,0,200,0),z:clamp(item.z,0,100,index+1),visible:item.visible!==false,positioned:['x','y','width','height'].some(key=>item[key]!==undefined),rotation:clamp(item.rotation,-3600,3600,0),scaleX:clamp(item.scaleX,.01,20,1),scaleY:clamp(item.scaleY,.01,20,1),skewX:clamp(item.skewX,-85,85,0),skewY:clamp(item.skewY,-85,85,0),opacity:clamp(item.opacity,0,1,1),easing:EASINGS.has(item.easing)?item.easing:'ease',keyframes,visual,styles:safeStyles};
  });
}

export async function ensureStudioMetaSchema(db, scope='production') {
  const selected=typeof scope==='string'?(scope==='preview'?SCOPES.preview:SCOPES.production):scope;
  const safe=selected?.environment==='preview'?SCOPES.preview:SCOPES.production;
  await db.prepare('CREATE TABLE IF NOT EXISTS "'+safe.pagesTable+'" (id TEXT PRIMARY KEY NOT NULL,route_path TEXT NOT NULL UNIQUE,page_name TEXT NOT NULL,layers_json TEXT NOT NULL,is_published INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS "'+safe.draftsTable+'" (id TEXT PRIMARY KEY NOT NULL,project_name TEXT NOT NULL,page_path TEXT NOT NULL,project_json TEXT NOT NULL,is_template INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS "'+safe.backendTablesTable+'" (table_name TEXT PRIMARY KEY NOT NULL,display_name TEXT NOT NULL,schema_json TEXT NOT NULL,allow_public_write INTEGER NOT NULL DEFAULT 1,allow_public_read INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS "'+safe.rateLimitTable+'" (ip_hash TEXT PRIMARY KEY NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,window_started INTEGER NOT NULL)').run();
  return safe;
}
