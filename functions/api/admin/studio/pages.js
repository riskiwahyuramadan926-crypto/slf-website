import { json, fail, readJson, requireOwner, logAdminActivity } from '../../../_lib/common.js';
import { ensureStudioMetaSchema, normalizeStudioLayers, normalizeStudioRoute } from '../../../_lib/studio-builder.js';
export async function onRequestGet({request,env}) {
  if(!(await requireOwner(request,env)))return fail('Akses Owner diperlukan.',403);
  try{await ensureStudioMetaSchema(env.DB);const {results=[]}=await env.DB.prepare('SELECT id,route_path,page_name,is_published,created_at,updated_at FROM studio_pages ORDER BY updated_at DESC LIMIT 100').all();return json({pages:results});}
  catch(error){console.error('[SLF_STUDIO_PAGES] list failed:',error?.message||error);return fail('Daftar halaman Studio tidak dapat dimuat.',503);}
}
export async function onRequestPost({request,env}) {
  if(!(await requireOwner(request,env)))return fail('Publikasi halaman hanya dapat dilakukan Owner.',403);
  try{
    if(Number(request.headers.get('content-length')||0)>524288)return fail('Project halaman terlalu besar.',413);
    await ensureStudioMetaSchema(env.DB);const data=await readJson(request),routePath=normalizeStudioRoute(data.routePath);
    const pageName=String(data.name??'').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,80),id=String(data.projectId??'');
    if(!pageName||!/^[A-Za-z0-9_-]{6,100}$/.test(id))return fail('Nama halaman atau ID project tidak valid.');
    const layers=normalizeStudioLayers(data.layers),existing=await env.DB.prepare('SELECT id FROM studio_pages WHERE route_path=? LIMIT 1').bind(routePath).first();
    if(existing&&existing.id!==id)return fail('Route sudah digunakan halaman Studio lain.',409);
    const now=new Date().toISOString();
    await env.DB.prepare('INSERT INTO studio_pages(id,route_path,page_name,layers_json,is_published,created_at,updated_at) VALUES(?,?,?,?,1,?,?) ON CONFLICT(route_path) DO UPDATE SET page_name=excluded.page_name,layers_json=excluded.layers_json,is_published=1,updated_at=excluded.updated_at')
      .bind(id,routePath,pageName,JSON.stringify(layers),now,now).run();
    await logAdminActivity(env.DB,'studio_page_published','studio_page',routePath,{layers:layers.length,role:'owner'});
    return json({ok:true,routePath,pageName,layerCount:layers.length,updatedAt:now});
  }catch(error){console.error('[SLF_STUDIO_PAGES] publish failed:',error?.message||error);return fail(error?.message||'Publikasi halaman gagal.');}
}