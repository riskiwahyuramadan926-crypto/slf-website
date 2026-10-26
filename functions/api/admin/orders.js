import { json, fail, requireAdmin } from '../../_lib/common.js';
export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak. Periksa ADMIN_SECRET.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const { results = [] } = await env.DB.prepare('SELECT id, minecraft_name, platform, whatsapp, email, product_id, product_name, details_json, subtotal, discount, total, status, promo_code, created_at, paid_at, completed_at FROM orders ORDER BY created_at DESC LIMIT 100').all();
  return json({ orders: results.map(r => ({ ...r, details: (() => { try { return JSON.parse(r.details_json || '{}'); } catch { return {}; } })() })) });
}
