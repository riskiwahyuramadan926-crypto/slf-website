import { json, fail, readJson, requireAdmin, safeText, randomHex, logAdminActivity } from '../../_lib/common.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak.',401);
  if (!env.DB) return fail('Database belum tersambung.',503);
  const {results=[]}=await env.DB.prepare('SELECT id,title,body,active,starts_at,ends_at,created_at,updated_at FROM announcements ORDER BY created_at DESC LIMIT 200').all();
  return json({announcements:results.map(a=>({...a,active:Boolean(a.active)}))});
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak.',401);
  if (!env.DB) return fail('Database belum tersambung.',503);
  const d=await readJson(request);
  const title=safeText(d.title,100), body=safeText(d.body,1500);
  const id=safeText(d.id,60) || 'ANN-'+randomHex(8).toUpperCase();
  const active=d.active===false || d.active===0 || d.active==='0' ? 0 : 1;
  const startsAt=safeText(d.startsAt,40)||null, endsAt=safeText(d.endsAt,40)||null;
  if(title.length<3 || body.length<5) return fail('Judul minimal 3 karakter dan isi minimal 5 karakter.');
  if(startsAt && !Number.isFinite(Date.parse(startsAt))) return fail('Waktu mulai tidak valid.');
  if(endsAt && !Number.isFinite(Date.parse(endsAt))) return fail('Waktu berakhir tidak valid.');
  if(startsAt && endsAt && startsAt>endsAt) return fail('Waktu berakhir harus setelah waktu mulai.');
  const now=new Date().toISOString();
  const previous=await env.DB.prepare('SELECT id FROM announcements WHERE id=?').bind(id).first();
  await env.DB.prepare(`INSERT INTO announcements (id,title,body,active,starts_at,ends_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,active=excluded.active,starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_at=excluded.updated_at`)
    .bind(id,title,body,active,startsAt,endsAt,now,now).run();
  await logAdminActivity(env.DB,previous?'announcement_updated':'announcement_created','announcement',id,{title,active:Boolean(active)});
  return json({ok:true,id,title,body,active:Boolean(active),starts_at:startsAt,ends_at:endsAt,updated_at:now});
}
