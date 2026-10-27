import { json, fail, requireAdmin } from '../../_lib/common.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak. Periksa ADMIN_SECRET.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const [{ results = [] }, statsRow] = await Promise.all([
    env.DB.prepare(
      'SELECT id, minecraft_name, platform, whatsapp, email, product_id, product_name, details_json, subtotal, discount, total, status, promo_code, created_at, paid_at, completed_at FROM orders ORDER BY created_at DESC LIMIT 500'
    ).all(),
    env.DB.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN status='PENDING_PAYMENT' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status='PAID' THEN 1 ELSE 0 END) AS paid,
      SUM(CASE WHEN status='PROCESSING' THEN 1 ELSE 0 END) AS processing,
      SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status IN ('CANCELLED','EXPIRED') THEN 1 ELSE 0 END) AS cancelled,
      SUM(CASE WHEN status IN ('PAID','PROCESSING','COMPLETED') THEN total ELSE 0 END) AS revenue,
      SUM(CASE WHEN date(created_at)=date('now') THEN 1 ELSE 0 END) AS today
      FROM orders`).first()
  ]);
  const orders = results.map(r => ({ ...r, details: (() => { try { return JSON.parse(r.details_json || '{}'); } catch { return {}; } })() }));
  const stats = Object.fromEntries(Object.entries(statsRow || {}).map(([key, value]) => [key, Number(value || 0)]));
  return json({ orders, stats, generatedAt: new Date().toISOString(), ordersLimit: 500 });
}
