export const STUDIO_TABLE_PREFIX = 'studio_';
const RESERVED_ROUTES = new Set(['admin','api','app','assets','bantuan','images','store','wiki','fonts','uploads','robots','favicon','sitemap']);
const IDENTIFIER = /^[a-z][a-z0-9_]{0,31}$/;
const FIELD_TYPES = new Set(['text','integer','real']);
const RESERVED_COLUMNS = new Set(['id','created_at','updated_at']);
const ANIMATIONS = new Set(['none','fade','float','pulse']);
const ACTIONS = new Set(['none','navigate','external','scroll','backend-submit','backend-read']);
const color = v => /^#[0-9a-f]{6}$/i.test(String(v ?? '')) ? String(v).toLowerCase() : '';
const clamp = (v,min,max,fallback) => { const n=Number(v); return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback; };
const plain = (v,max=5000) => String(v ?? '').replace(/[<>\u0000-\u001f]/g,' ').trim().slice(0,max);

export function normalizeStudioRoute(value) {
  const match=String(value ?? '').trim().match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/i);
  if(!match) throw new Error('Route harus satu segmen sederhana, contoh /event atau /event-musim.');
  const slug=match[1].toLowerCase();
  if(slug.length>48||RESERVED_ROUTES.has(slug)||slug.startsWith('slf-')) throw new Error('Nama route memakai jalur khusus website atau terlalu panjang.');
  return '/'+slug;
}
export function normalizeStudioTableDefinition(input={}) {
  const source=input.slug??input.name??(String(input.tableName??'').startsWith(STUDIO_TABLE_PREFIX)?String(input.tableName).slice(STUDIO_TABLE_PREFIX.length):'');
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
  return {tableName:STUDIO_TABLE_PREFIX+slug,displayName:plain(input.displayName??slug,60)||slug,columns:normalized,allowPublicWrite:input.allowPublicWrite!==false,allowPublicRead:input.allowPublicRead===true};
}
export function buildStudioCreateTableSql(definition) {
  const safe=normalizeStudioTableDefinition(definition);
  const columns=['"id" TEXT PRIMARY KEY NOT NULL','"created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP',...safe.columns.map(column=>{
    let sql='"'+column.name+'" '+column.type.toUpperCase();if(column.required)sql+=' NOT NULL';if(column.unique)sql+=' UNIQUE';return sql;
  })];
  return 'CREATE TABLE "'+safe.tableName+'" ('+columns.join(', ')+')';
}
export function normalizeStudioSubmission(definition,payload) {
  const schema=normalizeStudioTableDefinition(definition);
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
export function normalizeStudioLayers(input) {
  if(!Array.isArray(input)||input.length>100) throw new Error('Halaman hanya boleh memiliki maksimal 100 layer.');
  const layerIds=new Set(),fieldNames=new Set();
  return input.map((item,index)=>{
    if(!item||typeof item!=='object') throw new Error('Layer '+(index+1)+' tidak valid.');
    const type=['text','image','video','button','table','card','input'].includes(item.type)?item.type:'';
    if(!type) throw new Error('Jenis layer '+(index+1)+' tidak didukung.');
    const id=String(item.id??'layer-'+index);if(!/^[A-Za-z0-9_-]{1,120}$/.test(id)||layerIds.has(id))throw new Error('ID layer tidak valid atau duplikat.');layerIds.add(id);
    const src=plain(item.src,1000);
    if(type==='image'&&!(/^(https:\/\/[^\s"'<>]+|\/(?:api\/media\/slf-[a-f0-9]{24}\.(?:png|jpe?g|webp|gif|avif)|assets\/images\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp|gif|avif)))$/i.test(src)))throw new Error('URL gambar harus HTTPS atau aset gambar SLF yang valid.');
    if(type==='video'&&!/^https:\/\/[^\s"'<>]+$/i.test(src))throw new Error('URL video harus HTTPS.');
    const href=plain(item.href,1000);
    if(href&&!(/^(https:\/\/[^\s"'<>]+|\/(?!\/)[A-Za-z0-9/_?&=.%#-]*|#[A-Za-z0-9_.-]+)$/i.test(href)))throw new Error('Tautan tombol harus path internal, anchor, atau HTTPS.');
    const actionType=ACTIONS.has(item.action?.type)?item.action.type:'none',actionTarget=plain(item.action?.target,120);
    if(actionType==='navigate'&&actionTarget&&!/^\/(?!\/)[A-Za-z0-9/_?&=.%#-]*$/.test(actionTarget))throw new Error('Tujuan navigasi tidak valid.');
    if(actionType==='external'&&actionTarget&&!/^https:\/\/[^\s"'<>]+$/i.test(actionTarget))throw new Error('Tujuan eksternal harus HTTPS.');
    if(actionType==='scroll'&&actionTarget&&!/^[A-Za-z0-9_.#-]{1,100}$/.test(actionTarget))throw new Error('Target scroll tidak valid.');
    if(actionType.startsWith('backend-')&&(type!=='button'||!/^studio_[a-z][a-z0-9_]{0,31}$/.test(actionTarget)))throw new Error('Action backend harus memakai tombol dan target tabel berawalan studio_.');
    const rows=Array.isArray(item.rows)?item.rows.slice(0,20).map(row=>Array.isArray(row)?row.slice(0,8).map(cell=>plain(cell,300)):[]):[];
    const styles=item.styles&&typeof item.styles==='object'?item.styles:{},safeStyles={};
    for(const key of ['color','backgroundColor','borderColor'])if(color(styles[key]))safeStyles[key]=color(styles[key]);
    for(const [key,min,max] of [['fontSize',8,96],['fontWeight',300,900],['padding',0,80],['borderRadius',0,80],['maxWidth',100,1200],['marginBottom',0,100]])if(styles[key]!==undefined)safeStyles[key]=clamp(styles[key],min,max,min);
    if(['left','center','right'].includes(styles.textAlign))safeStyles.textAlign=styles.textAlign;
    if(['system','serif','sans','mono','rounded'].includes(styles.fontFamily))safeStyles.fontFamily=styles.fontFamily;
    const fieldName=String(item.fieldName??'').trim().toLowerCase();
    if(type==='input'&&(!IDENTIFIER.test(fieldName)||fieldNames.has(fieldName)))throw new Error('Input layer harus memiliki nama field unik, misalnya player_name.');if(type==='input')fieldNames.add(fieldName);
    return {id,type,name:plain(item.name,80)||'Layer '+(index+1),content:plain(item.content,5000),src,href,fieldName,rows,action:{type:actionType,target:actionTarget},animation:ANIMATIONS.has(item.animation)?item.animation:'none',clickAnimation:ANIMATIONS.has(item.clickAnimation)?item.clickAnimation:'none',loop:item.loop===true,duration:clamp(item.duration,200,10000,900),styles:safeStyles};
  });
}
export async function ensureStudioMetaSchema(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS studio_pages (id TEXT PRIMARY KEY NOT NULL,route_path TEXT NOT NULL UNIQUE,page_name TEXT NOT NULL,layers_json TEXT NOT NULL,is_published INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS studio_backend_tables (table_name TEXT PRIMARY KEY NOT NULL,display_name TEXT NOT NULL,schema_json TEXT NOT NULL,allow_public_write INTEGER NOT NULL DEFAULT 1,allow_public_read INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS studio_data_rate_limits (ip_hash TEXT PRIMARY KEY NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,window_started INTEGER NOT NULL)').run();
}