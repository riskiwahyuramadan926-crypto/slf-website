import { json, fail, requireAdmin } from '../../_lib/common.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak. Periksa ADMIN_SECRET.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const { results = [] } = await env.DB.prepare(
    'SELECT t.id, t.order_id, t.minecraft_name, t.product_name, t.status, t.created_at, t.updated_at, t.submitted_at, t.completed_at, o.status AS order_status, o.whatsapp, o.total FROM reentry_tickets t JOIN orders o ON o.id = t.order_id ORDER BY t.created_at DESC LIMIT 1000'
  ).all();
  return json({ tickets: results, generatedAt: new Date().toISOString() });
}
