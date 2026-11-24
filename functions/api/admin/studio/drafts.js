import { json, fail, readJson, requireOwner } from '../../../_lib/common.js';
import { ensureStudioMetaSchema, getStudioScope } from '../../../_lib/studio-builder.js';
const validId=value=>/^[A-Za-z0-9_-]{6,100}$/.test(String(value||''));
const clean=(value,max)=>String(value??'').replace(/[<>\u0000-\u001f]/g,' ').trim().slice(0,max);
export async function onRequestGet({request,env}) {
 const scope=getStudioScope(request);if(!scope)return fail('Host Studio tidak dikenali.',404);
 if(!(await requireOwner(request,env)))return fail('Akses Owner diperlukan.',403);
 try {await ensureStudioMetaSchema(env.DB,scope);const id=new URL(request.url).searchParams.get('id');
  if(id){if(!validId(id))return fail('ID draft tidak valid.');const row=await env.DB.prepare('SELECT id,project_name,page_path,project_json,is_template,created_at,updated_at FROM "'+scope.draftsTable+'" WHERE id=? LIMIT 1').bind(id).first();if(!row)return fail('Draft tidak ditemukan.',404);let project;try{project=JSON.parse(row.project_json);}catch{return fail('Isi draft tidak dapat dibaca.',500);}return json({draft:{...row,project}});}
  const {results=[]}=await env.DB.prepare('SELECT id,project_name,page_path,is_template,created_at,updated_at FROM "'+scope.draftsTable+'" ORDER BY updated_at DESC LIMIT 100').all();return json({drafts:results,environment:scope.environment});
 } catch(error){console.error('[SLF_STUDIO_DRAFTS] read failed:',error?.message||error);return fail('Draft D1 tidak dapat dimuat.',503);}
}
export async function onRequestPost({request,env}) {
 const scope=getStudioScope(request);if(!scope)return fail('Host Studio tidak dikenali.',404);
 if(!(await requireOwner(request,env)))return fail('Penyimpanan Draft D1 hanya dapat dilakukan Owner.',403);
 try {const length=Number(request.headers.get('content-length')||0);if(length>950000)return fail('Draft melebihi batas 950 KB.',413);await ensureStudioMetaSchema(env.DB,scope);
  const data=await readJson(request),id=String(data.id||'');if(!validId(id))return fail('ID project tidak valid.');
  if(!data.project||typeof data.project!=='object'||Array.isArray(data.project))return fail('Data project tidak valid.');
  const projectJson=JSON.stringify(data.project);if(projectJson.length>900000)return fail('Draft melebihi batas 900 KB.',413);
  const projectName=clean(data.name||data.project.name||'Project SLF',80)||'Project SLF',pagePath=clean(data.pagePath||data.project.pagePath||'/',200);
  if(!/^\/(?:[A-Za-z0-9_./-]*)$/.test(pagePath)||pagePath.includes('..'))return fail('Path halaman tidak valid.');
  const isTemplate=data.isTemplate===true?1:0,now=new Date().toISOString();
  await env.DB.prepare('INSERT INTO "'+scope.draftsTable+'"(id,project_name,page_path,project_json,is_template,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET project_name=excluded.project_name,page_path=excluded.page_path,project_json=excluded.project_json,is_template=excluded.is_template,updated_at=excluded.updated_at').bind(id,projectName,pagePath,projectJson,isTemplate,now,now).run();
  return json({ok:true,id,name:projectName,pagePath,isTemplate:Boolean(isTemplate),updatedAt:now,environment:scope.environment});
 } catch(error){console.error('[SLF_STUDIO_DRAFTS] save failed:',error?.message||error);return fail(error?.message||'Draft D1 gagal disimpan.');}
}
export async function onRequestDelete({request,env}) {
 const scope=getStudioScope(request);if(!scope)return fail('Host Studio tidak dikenali.',404);
 if(!(await requireOwner(request,env)))return fail('Penghapusan Draft D1 hanya dapat dilakukan Owner.',403);
 try {await ensureStudioMetaSchema(env.DB,scope);const id=new URL(request.url).searchParams.get('id');if(!validId(id))return fail('ID draft tidak valid.');
  const result=await env.DB.prepare('DELETE FROM "'+scope.draftsTable+'" WHERE id=?').bind(id).run();if(!result.meta?.changes)return fail('Draft tidak ditemukan.',404);return json({ok:true,id});
 } catch(error){console.error('[SLF_STUDIO_DRAFTS] delete failed:',error?.message||error);return fail('Draft D1 gagal dihapus.',503);}
}
