import { json, fail, readJson, requireOwner, safeText, randomHex, logAdminActivity } from '../../_lib/common.js';

const slugify = value => String(value||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70);
const slugValid = value => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const orderValue = value => Number.isFinite(Number(value)) ? Math.max(-1000,Math.min(1000,Math.trunc(Number(value)))) : 0;
const boolValue = value => !(value===false || value===0 || value==='0');

export async function onRequestGet({ request, env }) {
  if (!(await requireOwner(request,env))) return fail('Pengelolaan Wiki hanya dapat diakses Owner.',403);
  const {results:categories=[]}=await env.DB.prepare('SELECT id,name,slug,description,icon,sort_order,active,created_at,updated_at FROM wiki_categories ORDER BY sort_order,name').all();
  const {results:articles=[]}=await env.DB.prepare('SELECT a.*,c.name AS category_name FROM wiki_articles a LEFT JOIN wiki_categories c ON c.id=a.category_id ORDER BY c.sort_order,a.sort_order,a.title LIMIT 1000').all();
  return json({categories:categories.map(x=>({...x,active:Boolean(x.active)})),articles});
}

export async function onRequestPost({ request, env }) {
  if (!(await requireOwner(request,env))) return fail('Pengelolaan Wiki hanya dapat diakses Owner.',403);
  const d=await readJson(request);
  const now=new Date().toISOString();

  if (d.type==='category') {
    const id=safeText(d.id,80)||'WKC-'+randomHex(8).toUpperCase();
    const name=safeText(d.name,80);
    const slug=slugify(d.slug||name);
    const description=safeText(d.description,300);
    const icon=safeText(d.icon,12)||'📚';
    const sort=orderValue(d.sortOrder);
    const active=boolValue(d.active)?1:0;
    if(name.length<2) return fail('Nama kategori minimal 2 karakter.');
    if(!slugValid(slug)) return fail('Slug kategori hanya boleh huruf kecil, angka, dan tanda hubung.');
    const previous=await env.DB.prepare('SELECT id FROM wiki_categories WHERE id=?').bind(id).first();
    const collision=await env.DB.prepare('SELECT id FROM wiki_categories WHERE slug=? AND id<>?').bind(slug,id).first();
    if(collision)return fail('Slug kategori sudah digunakan.');
    await env.DB.prepare(`INSERT INTO wiki_categories (id,name,slug,description,icon,sort_order,active,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,description=excluded.description,icon=excluded.icon,sort_order=excluded.sort_order,active=excluded.active,updated_at=excluded.updated_at`)
      .bind(id,name,slug,description,icon,sort,active,now,now).run();
    await logAdminActivity(env.DB,previous?'wiki_category_updated':'wiki_category_created','wiki_category',id,{role:'owner',name,slug});
    return json({ok:true,type:'category',id});
  }

  if (d.type==='article') {
    const id=safeText(d.id,80)||'WKA-'+randomHex(8).toUpperCase();
    const categoryId=safeText(d.categoryId,80);
    const title=safeText(d.title,140);
    const slug=slugify(d.slug||title);
    const summary=safeText(d.summary,320);
    const content=safeText(d.content,20000);
    const icon=safeText(d.icon,12)||'📖';
    const sort=orderValue(d.sortOrder);
    const status=d.status==='draft'?'draft':'published';
    let legacyUrl=safeText(d.legacyUrl,120);
    if (legacyUrl && !/^\/wiki\/artikel\/[a-z0-9-]+\.html$/.test(legacyUrl)) return fail('Path artikel lama tidak valid.');
    const cat=await env.DB.prepare('SELECT id FROM wiki_categories WHERE id=?').bind(categoryId).first();
    if(!cat)return fail('Kategori buku tidak ditemukan.');
    if(title.length<3)return fail('Judul artikel minimal 3 karakter.');
    if(!slugValid(slug))return fail('Slug artikel hanya boleh huruf kecil, angka, dan tanda hubung.');
    if(status==='published' && content.length<10 && !legacyUrl)return fail('Isi artikel minimal 10 karakter sebelum diterbitkan.');
    const previous=await env.DB.prepare('SELECT id FROM wiki_articles WHERE id=?').bind(id).first();
    const collision=await env.DB.prepare('SELECT id FROM wiki_articles WHERE slug=? AND id<>?').bind(slug,id).first();
    if(collision)return fail('Slug artikel sudah digunakan.');
    if(content.length>=10)legacyUrl=null;
    await env.DB.prepare(`INSERT INTO wiki_articles (id,category_id,title,slug,summary,content,legacy_url,icon,sort_order,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET category_id=excluded.category_id,title=excluded.title,slug=excluded.slug,summary=excluded.summary,content=excluded.content,legacy_url=excluded.legacy_url,icon=excluded.icon,sort_order=excluded.sort_order,status=excluded.status,updated_at=excluded.updated_at`)
      .bind(id,categoryId,title,slug,summary,content,legacyUrl,icon,sort,status,now,now).run();
    await logAdminActivity(env.DB,previous?'wiki_article_updated':'wiki_article_created','wiki_article',id,{role:'owner',title,slug,status});
    return json({ok:true,type:'article',id});
  }
  return fail('Jenis konten Wiki tidak dikenal.');
}

export async function onRequestDelete({ request, env }) {
  if (!(await requireOwner(request,env))) return fail('Pengelolaan Wiki hanya dapat diakses Owner.',403);
  const url=new URL(request.url);
  const type=safeText(url.searchParams.get('type'),20);
  const id=safeText(url.searchParams.get('id'),80);
  if(!id || !['category','article'].includes(type))return fail('Jenis dan ID wajib diisi.');
  if(type==='category'){
    const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM wiki_articles WHERE category_id=?').bind(id).first();
    if(Number(count?.total||0)>0)return fail('Kategori masih berisi artikel. Pindahkan atau hapus artikelnya terlebih dahulu.',409);
    const result=await env.DB.prepare('DELETE FROM wiki_categories WHERE id=?').bind(id).run();
    if(!result.meta?.changes)return fail('Kategori tidak ditemukan.',404);
    await logAdminActivity(env.DB,'wiki_category_deleted','wiki_category',id,{role:'owner'});
  }else{
    const result=await env.DB.prepare('DELETE FROM wiki_articles WHERE id=?').bind(id).run();
    if(!result.meta?.changes)return fail('Artikel tidak ditemukan.',404);
    await logAdminActivity(env.DB,'wiki_article_deleted','wiki_article',id,{role:'owner'});
  }
  return json({ok:true,id,type});
}
