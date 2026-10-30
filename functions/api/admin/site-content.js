import { json, fail, readJson, requireOwner, safeText, randomHex, logAdminActivity } from '../../_lib/common.js';

const slotPages = {
  'home.lead':'home','home.zoneLead':'home','home.storeLead':'home',
  'wiki.lead':'wiki','store.lead':'store'
};
const validDate = value => !value || Number.isFinite(Date.parse(value));
const validImageUrl = value => !value || /^https:\/\/[^\\s<>"']+$/i.test(value) || /^\/(?:api\/media\/slf-[a-f0-9]{24}\\.(?:png|jpe?g|webp|gif|avif)|assets\/images\/[A-Za-z0-9_./-]+)$/i.test(value);

export async function onRequestGet({ request, env }) {
  if (!(await requireOwner(request, env))) return fail('Editor website hanya dapat diakses Owner.',403);
  const {results=[]}=await env.DB.prepare('SELECT id,kind,page,slot_key,title,body,image_url,active,starts_at,ends_at,created_by,created_at,updated_at FROM site_content ORDER BY kind, page, updated_at DESC LIMIT 500').all();
  return json({items:results.map(x=>({...x,active:Boolean(x.active)})),allowedSlots:Object.keys(slotPages)});
}
export async function onRequestPost({ request, env }) {
  if (!(await requireOwner(request, env))) return fail('Editor website hanya dapat diakses Owner.',403);
  const d=await readJson(request);
  const kind=d.kind==='slot'?'slot':d.kind==='card'?'card':'';
  const page=['home','store','wiki'].includes(d.page)?d.page:'';
  const title=safeText(d.title,120);
  const body=safeText(d.body,2500);
  const imageUrl=safeText(d.imageUrl,500);
  if(imageUrl&&!validImageUrl(imageUrl)) return fail('URL gambar harus berupa HTTPS atau aset lokal SLF yang diizinkan.');
  const active=d.active===false||d.active===0||d.active==='0'?0:1;
  const startsAt=safeText(d.startsAt,40)||null;
  const endsAt=safeText(d.endsAt,40)||null;
  if(!kind||!page||body.length<2) return fail('Jenis, halaman, dan isi konten wajib diisi.');
  if(kind==='card'&&title.length<2) return fail('Kartu konten perlu judul minimal 2 karakter.');
  if(startsAt&&!validDate(startsAt)||endsAt&&!validDate(endsAt)) return fail('Jadwal publikasi tidak valid.');
  if(startsAt&&endsAt&&Date.parse(startsAt)>Date.parse(endsAt)) return fail('Waktu selesai harus setelah waktu mulai.');
  const now=new Date().toISOString();
  const role='owner';
  if(kind==='slot'){
    const slotKey=safeText(d.slotKey,50);
    if(!Object.hasOwn(slotPages,slotKey)) return fail('Slot teks tidak diizinkan.');
    if(slotPages[slotKey]!==page) return fail('Slot teks tidak sesuai halaman.');
    const id='SLOT-'+slotKey.replace(/[^A-Za-z0-9_-]/g,'_');
    await env.DB.prepare(`INSERT INTO site_content(id,kind,page,slot_key,title,body,active,starts_at,ends_at,created_by,created_at,updated_at)
      VALUES(?,'slot',?,?, '',?,?,?,?, 'owner',?,?)
      ON CONFLICT(slot_key) DO UPDATE SET page=excluded.page,body=excluded.body,active=excluded.active,starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_at=excluded.updated_at`)
      .bind(id,page,slotKey,body,active,startsAt,endsAt,now,now).run();
    await logAdminActivity(env.DB,'site_slot_updated','site_content',id,{slotKey,page,active:Boolean(active),role});
    return json({ok:true,id,kind,slotKey});
  }
  const id=safeText(d.id,60)||'WEB-'+randomHex(8).toUpperCase();
  const old=await env.DB.prepare('SELECT id FROM site_content WHERE id=?').bind(id).first();
  await env.DB.prepare(`INSERT INTO site_content(id,kind,page,slot_key,title,body,image_url,active,starts_at,ends_at,created_by,created_at,updated_at)
    VALUES(?,'card',?,NULL,?,?,?,?,?,?,'owner',?,?)
    ON CONFLICT(id) DO UPDATE SET page=excluded.page,title=excluded.title,body=excluded.body,image_url=excluded.image_url,active=excluded.active,starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_at=excluded.updated_at`)
    .bind(id,page,title,body,imageUrl||null,active,startsAt,endsAt,now,now).run();
  await logAdminActivity(env.DB,old?'site_card_updated':'site_card_created','site_content',id,{page,title,active:Boolean(active),role});
  return json({ok:true,id,kind,page,title});
}
export async function onRequestDelete({ request, env }) {
  if (!(await requireOwner(request, env))) return fail('Editor website hanya dapat diakses Owner.',403);
  const id=safeText(new URL(request.url).searchParams.get('id'),60);
  if(!id) return fail('ID konten wajib diisi.');
  const item=await env.DB.prepare('SELECT id,kind,slot_key FROM site_content WHERE id=?').bind(id).first();
  if(!item) return fail('Konten tidak ditemukan.',404);
  if(item.kind==='slot') return fail('Slot teks tetap tidak dapat dihapus; ubah isinya atau nonaktifkan.',409);
  await env.DB.prepare('DELETE FROM site_content WHERE id=?').bind(id).run();
  await logAdminActivity(env.DB,'site_card_deleted','site_content',id,{role:'owner'});
  return json({ok:true,id});
}