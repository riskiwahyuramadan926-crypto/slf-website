import { json, fail, readJson, requireOwner, logAdminActivity } from '../../../_lib/common.js';
function productionOnly(request){const host=new URL(request.url).hostname.toLowerCase();return host==='legacy-frontier.web.id'||host==='www.legacy-frontier.web.id';}

import { buildStudioCreateTableSql, ensureStudioMetaSchema, normalizeStudioTableDefinition } from '../../../_lib/studio-builder.js';
export async function onRequestGet({request,env}) {
  if(!productionOnly(request))return fail('Backend Builder dinonaktifkan di Preview karena D1 berbagi database Production.',409);
  if(!(await requireOwner(request,env)))return fail('Backend Builder hanya dapat dibuka Owner.',403);
  try{await ensureStudioMetaSchema(env.DB);const {results=[]}=await env.DB.prepare('SELECT table_name,display_name,schema_json,allow_public_write,allow_public_read,created_at FROM studio_backend_tables ORDER BY created_at DESC LIMIT 100').all();return json({tables:results.map(row=>({...row,columns:JSON.parse(row.schema_json||'[]')}))});}
  catch(error){console.error('[SLF_STUDIO_BACKEND] list failed:',error?.message||error);return fail('Daftar tabel backend tidak dapat dimuat.',503);}
}
export async function onRequestPost({request,env}) {
  if(!productionOnly(request))return fail('Pembuatan tabel D1 dinonaktifkan di Preview untuk melindungi database Production.',409);
  if(!(await requireOwner(request,env)))return fail('Pembuatan tabel D1 hanya dapat dilakukan Owner.',403);
  try{
    await ensureStudioMetaSchema(env.DB);const definition=normalizeStudioTableDefinition(await readJson(request));
    const known=await env.DB.prepare('SELECT table_name FROM studio_backend_tables WHERE table_name=? LIMIT 1').bind(definition.tableName).first();
    if(known)return fail('Tabel tersebut sudah terdaftar di Backend Builder.',409);
    const exists=await env.DB.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name=? LIMIT 1").bind(definition.tableName).first();
    if(exists)return fail('Nama tabel sudah digunakan di D1. Pilih nama lain; tabel lama tidak akan disentuh.',409);
    await env.DB.prepare(buildStudioCreateTableSql(definition)).run();
    const now=new Date().toISOString();
    await env.DB.prepare('INSERT INTO studio_backend_tables(table_name,display_name,schema_json,allow_public_write,allow_public_read,created_at) VALUES(?,?,?,?,?,?)')
      .bind(definition.tableName,definition.displayName,JSON.stringify(definition.columns),definition.allowPublicWrite?1:0,definition.allowPublicRead?1:0,now).run();
    await logAdminActivity(env.DB,'studio_backend_table_created','studio_backend_table',definition.tableName,{columns:definition.columns.length,publicWrite:definition.allowPublicWrite,publicRead:definition.allowPublicRead,role:'owner'});
    return json({ok:true,table:{...definition,createdAt:now}},201);
  }catch(error){console.error('[SLF_STUDIO_BACKEND] create failed:',error?.message||error);return fail(error?.message||'Pembuatan tabel backend gagal.');}
}