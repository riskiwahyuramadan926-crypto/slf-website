import { json } from '../_lib/common.js';

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ slots:[], cards:[] });
  const now = new Date().toISOString();
  const { results=[] } = await env.DB.prepare(`SELECT id,kind,page,slot_key,title,body,image_url,active,starts_at,ends_at
    FROM site_content WHERE active=1 AND (starts_at IS NULL OR starts_at<=?) AND (ends_at IS NULL OR ends_at>=?)
    ORDER BY created_at DESC LIMIT 300`).bind(now,now).all();
  return json({
    slots:results.filter(x=>x.kind==='slot').map(x=>({key:x.slot_key,body:x.body})),
    cards:results.filter(x=>x.kind==='card').map(x=>({id:x.id,page:x.page,title:x.title,body:x.body,image_url:x.image_url||'',starts_at:x.starts_at,ends_at:x.ends_at}))
  });
}