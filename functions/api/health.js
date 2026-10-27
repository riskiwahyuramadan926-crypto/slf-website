import { json, fail } from '../_lib/common.js';
export async function onRequestGet({env}) {
  if (!env.DB) return fail('D1 belum terhubung dengan binding DB.',503);
  try {
    const {results=[]}=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('orders','reviews','review_replies','store_products','promo_codes','admin_activity','support_tickets','announcements') ORDER BY name").all();
    const tables=results.map(r=>r.name), missing=['orders','reviews'].filter(n=>!tables.includes(n));
    if (missing.length) return json({ok:false,database:'connected',tables,missing},503);
    return json({ok:true,database:'connected',tables});
  } catch { return fail('Tabel Store belum tersedia. Jalankan schema.sql.',503); }
}
