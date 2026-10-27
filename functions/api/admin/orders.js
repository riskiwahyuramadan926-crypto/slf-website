import { json, fail, requireAdmin } from '../../_lib/common.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak. Periksa ADMIN_SECRET.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const { results = [] } = await env.DB.prepare(
    'SELECT id, minecraft_name, platform, whatsapp, email, product_id, product_name, details_json, subtotal, discount, total, status, promo_code, created_at, paid_at, completed_at FROM orders ORDER BY created_at DESC LIMIT 500'
  ).all();
  const orders = results.map(r => ({ ...r, details: (() => { try { return JSON.parse(r.details_json || '{}'); } catch { return {}; } })() }));
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'PENDING_PAYMENT').length,
    paid: orders.filter(o => o.status === 'PAID').length,
    processing: orders.filter(o => o.status === 'PROCESSING').length,
    completed: orders.filter(o => o.status === 'COMPLETED').length,
    cancelled: orders.filter(o => ['CANCELLED','EXPIRED'].includes(o.status)).length,
    revenue: orders.filter(o => ['PAID','PROCESSING','COMPLETED'].includes(o.status)).reduce((sum,o) => sum + Number(o.total || 0),0),
    today: orders.filter(o => o.created_at?.slice(0,10) === new Date().toISOString().slice(0,10)).length
  };
  return json({ orders, stats, generatedAt: new Date().toISOString() });
}
