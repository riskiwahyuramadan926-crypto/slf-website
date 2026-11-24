import { json, fail, readJson, requireOwner, logAdminActivity } from '../../../_lib/common.js';
import { buildStudioCreateTableSql, ensureStudioMetaSchema, getStudioScope, normalizeStudioTableDefinition } from '../../../_lib/studio-builder.js';

export async function onRequestGet({request,env}) {
  const scope=getStudioScope(request);
  if(!scope)return fail('Host Studio tidak dikenali.',404);
  if(!(await requireOwner(request,env)))return fail('Backend Builder hanya dapat dibuka Owner.',403);
  try {
    await ensureStudioMetaSchema(env.DB,scope);
    const {results=[]}=await env.DB.prepare('SELECT table_name,display_name,schema_json,allow_public_write,allow_public_read,created_at FROM "'+scope.backendTablesTable+'" ORDER BY created_at DESC LIMIT 100').all();
    return json({tables:results.map(row=>({...row,columns:JSON.parse(row.schema_json||'[]')})),environment:scope.environment});
  } catch(error) {
    console.error('[SLF_STUDIO_BACKEND] list failed:',error?.message||error);
    return fail('Daftar tabel backend tidak dapat dimuat.',503);
  }
}

export async function onRequestPost({request,env}) {
  const scope=getStudioScope(request);
  if(!scope)return fail('Host Studio tidak dikenali.',404);
  if(!(await requireOwner(request,env)))return fail('Pembuatan tabel D1 hanya dapat dilakukan Owner.',403);
  try {
    if(Number(request.headers.get('content-length')||0)>32768)return fail('Definisi tabel terlalu besar.',413);
    await ensureStudioMetaSchema(env.DB,scope);
    const definition=normalizeStudioTableDefinition(await readJson(request),scope.tablePrefix);
    const known=await env.DB.prepare('SELECT table_name FROM "'+scope.backendTablesTable+'" WHERE table_name=? LIMIT 1').bind(definition.tableName).first();
    if(known)return fail('Tabel tersebut sudah terdaftar di Backend Builder.',409);
    const exists=await env.DB.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name=? LIMIT 1").bind(definition.tableName).first();
    if(exists)return fail('Nama tabel sudah digunakan di D1. Tabel lama tidak akan disentuh; pilih nama lain.',409);
    await env.DB.prepare(buildStudioCreateTableSql(definition)).run();
    const now=new Date().toISOString();
    await env.DB.prepare('INSERT INTO "'+scope.backendTablesTable+'"(table_name,display_name,schema_json,allow_public_write,allow_public_read,created_at) VALUES(?,?,?,?,?,?)')
      .bind(definition.tableName,definition.displayName,JSON.stringify(definition.columns),definition.allowPublicWrite?1:0,definition.allowPublicRead?1:0,now).run();
    if(scope.environment==='production')await logAdminActivity(env.DB,'studio_backend_table_created','studio_backend_table',definition.tableName,{columns:definition.columns.length,publicWrite:definition.allowPublicWrite,publicRead:definition.allowPublicRead,role:'owner'});
    return json({ok:true,table:{...definition,createdAt:now},environment:scope.environment},201);
  } catch(error) {
    console.error('[SLF_STUDIO_BACKEND] create failed:',error?.message||error);
    return fail(error?.message||'Pembuatan tabel backend gagal.');
  }
}
