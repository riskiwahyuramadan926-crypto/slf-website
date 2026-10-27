import { json, fail } from '../_lib/common.js';

export async function onRequestGet({ env }) {
  if (!env.DB) return fail('Pengumuman belum tersedia.',503);
  const now = new Date().toISOString();
  const { results = [] } = await env.DB.prepare(`SELECT id,title,body,starts_at,ends_at,created_at
    FROM announcements WHERE active=1 AND (starts_at IS NULL OR starts_at<=?) AND (ends_at IS NULL OR ends_at>=?)
    ORDER BY created_at DESC LIMIT 10`).bind(now,now).all();
  return json({announcements:results},200,{'cache-control':'public, max-age=60'});
}
