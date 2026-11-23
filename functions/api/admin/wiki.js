import { json, fail, readJson, requireOwner, safeText, randomHex, logAdminActivity } from '../../_lib/common.js';
import { ensureWikiSchema } from '../../_lib/wiki-schema.js';

const slugify = value => String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70);
const slugValid = value => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const orderValue = value => Number.isFinite(Number(value)) ? Math.max(-1000,Math.min(1000,Math.trunc(Number(value)))) : 0;
const boolValue = value => !(value===false || value===0 || value==='0');

async function prepareWiki(env) {
  if (!env.DB || typeof env.DB.prepare !== 'function') throw new Error('Binding D1 tidak tersedia.');
  await ensureWikiSchema(env.DB);
}

export async function onRequestGet({ request, env }) {
  if (!(await requireOwner(request,env))) return fail('Pengelolaan Wiki hanya dapat diakses Owner.',403);
  try { await prepareWiki(env); } catch (error) {
    console.error('[SLF_WIKI_ADMIN] schema initialization failed:',error?.message||error);
    return json({error:'Database Wiki gagal disiapkan.',diagnostic:String(error?.message||error).slice(0,220)},503);
  }
  const {results:books=[]}=await env.DB.prepare('SELECT id,name,slug,description,icon,sort_order,active,created_at,updated_at FROM wiki_books ORDER BY sort_order,name').all();
  const {results:chapters=[]}=await env.DB.prepare('SELECT c.*,b.name AS book_name FROM wiki_chapters c LEFT JOIN wiki_books b ON b.id=c.book_id ORDER BY b.sort_order,c.sort_order,c.title LIMIT 2000').all();
  const categories=books.map(b=>({...b,active:Boolean(b.active)}));
  const articles=chapters.map(c=>({...c,category_id:c.book_id,category_name:c.book_name}));
  return json({books:categories,chapters,categories,articles});
}

export async function onRequestPost({ request, env }) {
  if (!(await requireOwner(request,env))) return fail('Pengelolaan Wiki hanya dapat diakses Owner.',403);
  try { await prepareWiki(env); } catch (error) {
    console.error('[SLF_WIKI_ADMIN] schema initialization failed:',error?.message||error);
    return json({error:'Database Wiki gagal disiapkan.',diagnostic:String(error?.message||error).slice(0,220)},503);
  }
  const d=await readJson(request);
  const now=new Date().toISOString();
  const type=d.type==='category'?'book':d.type==='article'?'chapter':d.type;

  if (type==='book') {
    const id=safeText(d.id,80)||'WKB-'+randomHex(8).toUpperCase();
    const name=safeText(d.name,80);
    const slug=slugify(d.slug||name);
    const description=safeText(d.description,300);
    const icon=safeText(d.icon,12)||'📚';
    const sort=orderValue(d.sortOrder);
    const active=boolValue(d.active)?1:0;
    if(name.length<2) return fail('Nama buku minimal 2 karakter.');
    if(!slugValid(slug)) return fail('Slug buku hanya boleh huruf kecil, angka, dan tanda hubung.');
    const previous=await env.DB.prepare('SELECT id FROM wiki_books WHERE id=?').bind(id).first();
    const collision=await env.DB.prepare('SELECT id FROM wiki_books WHERE slug=? AND id<>?').bind(slug,id).first();
    if(collision)return fail('Slug buku sudah digunakan.');
    await env.DB.prepare(`INSERT INTO wiki_books (id,name,slug,description,icon,sort_order,active,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,description=excluded.description,icon=excluded.icon,sort_order=excluded.sort_order,active=excluded.active,updated_at=excluded.updated_at`)
      .bind(id,name,slug,description,icon,sort,active,now,now).run();
    await logAdminActivity(env.DB,previous?'wiki_book_updated':'wiki_book_created','wiki_book',id,{role:'owner',name,slug});
    return json({ok:true,type:'book',id});
  }

  if (type==='chapter') {
    const id=safeText(d.id,80)||'WKC-'+randomHex(8).toUpperCase();
    const bookId=safeText(d.bookId||d.categoryId,80);
    const title=safeText(d.title,140);
    const slug=slugify(d.slug||title);
    const summary=safeText(d.summary,320);
    const content=safeText(d.content,50000);
    const icon=safeText(d.icon,12)||'📖';
    const sort=orderValue(d.sortOrder);
    const status=d.status==='draft'?'draft':'published';
    let legacyUrl=safeText(d.legacyUrl,120);
    if (legacyUrl && !/^\/wiki\/artikel\/[a-z0-9-]+\.html$/.test(legacyUrl)) return fail('Path bab lama tidak valid.');
    const book=await env.DB.prepare('SELECT id FROM wiki_books WHERE id=?').bind(bookId).first();
    if(!book)return fail('Buku tidak ditemukan.');
    if(title.length<3)return fail('Judul bab minimal 3 karakter.');
    if(!slugValid(slug))return fail('Slug bab hanya boleh huruf kecil, angka, dan tanda hubung.');
    if(status==='published' && content.length<10 && !legacyUrl)return fail('Isi bab minimal 10 karakter sebelum diterbitkan.');
    const previous=await env.DB.prepare('SELECT id FROM wiki_chapters WHERE id=?').bind(id).first();
    const collision=await env.DB.prepare('SELECT id FROM wiki_chapters WHERE slug=? AND id<>?').bind(slug,id).first();
    if(collision)return fail('Slug bab sudah digunakan.');
    if(content.length>=10)legacyUrl=null;
    await env.DB.prepare(`INSERT INTO wiki_chapters (id,book_id,title,slug,summary,content,legacy_url,icon,sort_order,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET book_id=excluded.book_id,title=excluded.title,slug=excluded.slug,summary=excluded.summary,content=excluded.content,legacy_url=excluded.legacy_url,icon=excluded.icon,sort_order=excluded.sort_order,status=excluded.status,updated_at=excluded.updated_at`)
      .bind(id,bookId,title,slug,summary,content,legacyUrl,icon,sort,status,now,now).run();
    await logAdminActivity(env.DB,previous?'wiki_chapter_updated':'wiki_chapter_created','wiki_chapter',id,{role:'owner',title,slug,status,bookId});
    return json({ok:true,type:'chapter',id});
  }
  return fail('Jenis konten Wiki tidak dikenal.');
}

export async function onRequestDelete({ request, env }) {
  if (!(await requireOwner(request,env))) return fail('Pengelolaan Wiki hanya dapat diakses Owner.',403);
  try { await prepareWiki(env); } catch (error) {
    console.error('[SLF_WIKI_ADMIN] schema initialization failed:',error?.message||error);
    return json({error:'Database Wiki gagal disiapkan.',diagnostic:String(error?.message||error).slice(0,220)},503);
  }
  const url=new URL(request.url);
  const requestedType=safeText(url.searchParams.get('type'),20);
  const type=requestedType==='category'?'book':requestedType==='article'?'chapter':requestedType;
  const id=safeText(url.searchParams.get('id'),80);
  if(!id || !['book','chapter'].includes(type))return fail('Jenis dan ID wajib diisi.');
  if(type==='book'){
    const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM wiki_chapters WHERE book_id=?').bind(id).first();
    if(Number(count?.total||0)>0)return fail('Buku masih berisi bab. Pindahkan atau hapus babnya terlebih dahulu.',409);
    const result=await env.DB.prepare('DELETE FROM wiki_books WHERE id=?').bind(id).run();
    if(!result.meta?.changes)return fail('Buku tidak ditemukan.',404);
    await logAdminActivity(env.DB,'wiki_book_deleted','wiki_book',id,{role:'owner'});
  }else{
    const result=await env.DB.prepare('DELETE FROM wiki_chapters WHERE id=?').bind(id).run();
    if(!result.meta?.changes)return fail('Bab tidak ditemukan.',404);
    await logAdminActivity(env.DB,'wiki_chapter_deleted','wiki_chapter',id,{role:'owner'});
  }
  return json({ok:true,id,type});
}
