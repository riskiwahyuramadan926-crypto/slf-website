import { json, fail, requireAdmin } from '../../_lib/common.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const { results = [] } = await env.DB.prepare(`SELECT minecraft_name, platform, whatsapp, email,
    COUNT(*) AS order_count,
    SUM(CASE WHEN status IN ('PAID','PROCESSING','COMPLETED') THEN total ELSE 0 END) AS verified_spend,
    SUM(CASE WHEN status IN ('PAID','PROCESSING','COMPLETED') THEN 1 ELSE 0 END) AS paid_orders,
    MAX(created_at) AS last_order
    FROM orders GROUP BY minecraft_name, platform, whatsapp, email ORDER BY last_order DESC LIMIT 500`).all();
  return json({ customers: results.map(c => ({ ...c, order_count:Number(c.order_count), verified_spend:Number(c.verified_spend||0), paid_orders:Number(c.paid_orders) })) });
}
