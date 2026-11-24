import { json, fail, readJson, sha256Hex } from '../../_lib/common.js';
import { ensureStudioMetaSchema, getStudioScope, normalizeStudioSubmission, normalizeStudioTableDefinition } from '../../_lib/studio-builder.js';

async function rateLimit(db,tableName,request) {
  const hash=await sha256Hex(request.headers.get('cf-connecting-ip')||'unknown'),now=Date.now();
  const old=await db.prepare('SELECT attempts,window_started FROM "'+tableName+'" WHERE ip_hash=?').bind(hash).first();
  const active=old&&now-Number(old.window_started)<600000;
  if(active&&Number(old.attempts)>=20)return false;
  await db.prepare('INSERT INTO "'+tableName+'"(ip_hash,attempts,window_started) VALUES(?,?,?) ON CONFLICT(ip_hash) DO UPDATE SET attempts=excluded.attempts,window_started=excluded.window_started')
    .bind(hash,active?Number(old.attempts)+1:1,active?old.window_started:now).run();
  return true;
}

export async function onRequestPost({request,env}) {
  if(!env.DB)return fail('Database backend belum tersedia.',503);
  const scope=getStudioScope(request);
  if(!scope)return fail('Host Studio tidak dikenali.',404);
  if(Number(request.headers.get('content-length')||0)>16000)return fail('Permintaan terlalu besar.',413);
  try {
    await ensureStudioMetaSchema(env.DB,scope);
    if(!(await rateLimit(env.DB,scope.rateLimitTable,request)))return fail('Terlalu banyak permintaan. Coba lagi dalam beberapa menit.',429);
    const data=await readJson(request),action=String(data.action||''),table=String(data.table||'');
    const validTable=new RegExp('^'+scope.tablePrefix+'[a-z][a-z0-9_]{0,31}$');
    if(!validTable.test(table)||!['submit','read','schema'].includes(action))return fail('Perintah atau target backend tidak valid.');
    const row=await env.DB.prepare('SELECT table_name,display_name,schema_json,allow_public_write,allow_public_read FROM "'+scope.backendTablesTable+'" WHERE table_name=? LIMIT 1').bind(table).first();
    if(!row)return fail('Tabel backend tidak ditemukan.',404);
    const definition=normalizeStudioTableDefinition({tableName:row.table_name,displayName:row.display_name,columns:JSON.parse(row.schema_json||'[]'),allowPublicWrite:Number(row.allow_public_write)===1,allowPublicRead:Number(row.allow_public_read)===1},scope.tablePrefix);
    if(action==='schema') {
      if(!definition.allowPublicWrite)return fail('Formulir publik tidak diaktifkan Owner untuk tabel ini.',403);
      return json({ok:true,columns:definition.columns.map(column=>column.name)});
    }
    if(action==='submit') {
      if(!definition.allowPublicWrite)return fail('Pengiriman data publik tidak diaktifkan Owner untuk tabel ini.',403);
      const parsed=normalizeStudioSubmission(definition,data.values);
      if(!parsed.names.length)return fail('Tidak ada data untuk disimpan.');
      const columns=['id',...parsed.names],sqlColumns=columns.map(name=>'"'+name+'"').join(','),marks=columns.map(()=>'?').join(',');
      const id=crypto.randomUUID();
      await env.DB.prepare('INSERT INTO "'+table+'" ('+sqlColumns+') VALUES ('+marks+')').bind(id,...parsed.values).run();
      return json({ok:true,id,message:'Data berhasil disimpan.'},201);
    }
    if(!definition.allowPublicRead)return fail('Pembacaan data publik tidak diaktifkan Owner untuk tabel ini.',403);
    const projection=['id','created_at',...definition.columns.map(column=>column.name)].map(name=>'"'+name+'"').join(',');
    const {results=[]}=await env.DB.prepare('SELECT '+projection+' FROM "'+table+'" ORDER BY created_at DESC LIMIT 50').all();
    return json({ok:true,rows:results});
  } catch(error) {
    console.error('[SLF_STUDIO_DATA] request failed:',error?.message||error);
    return fail(error?.message||'Permintaan backend gagal.');
  }
}
