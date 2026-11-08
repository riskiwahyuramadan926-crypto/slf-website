import { json, fail } from '../_lib/common.js';
import { ensureAnnouncementsSchema } from '../_lib/announcement-schema.js';

export async function onRequestGet({ env }) {
  if (!env.DB) return fail('Pengumuman belum tersedia: binding D1 DB tidak ditemukan.',503);
  try { await ensureAnnouncementsSchema(env.DB); } catch(error) { console.error('[SLF_ANNOUNCEMENTS] schema failed:',error?.message||error); return json({error:'Database pengumuman gagal disiapkan.'},503); }
  const now = new Date().toISOString();
  let results=[];
  try { ({results=[]}=await env.DB.prepare(`SELECT id,title,body,starts_at,ends_at,created_at
    FROM announcements WHERE active=1 AND (starts_at IS NULL OR starts_at<=?) AND (ends_at IS NULL OR ends_at>=?)
    ORDER BY created_at DESC LIMIT 10`).bind(now,now).all()); }
  catch(error) { console.error('[SLF_ANNOUNCEMENTS] query failed:',error?.message||error); return json({error:'Pengumuman gagal dibaca dari database.'},503); }
  return json({announcements:results},200,{'cache-control':'no-store'});
}
