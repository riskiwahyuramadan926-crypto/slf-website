import { json, fail, readJson, requireAdmin, safeText, logAdminActivity } from '../../_lib/common.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const { results = [] } = await env.DB.prepare(`
    SELECT r.order_id, r.player_name, r.rating, r.comment, r.created_at,
           rr.reply, rr.admin_name, rr.updated_at AS replied_at
    FROM reviews r LEFT JOIN review_replies rr ON rr.review_order_id = r.order_id
    ORDER BY r.created_at DESC LIMIT 200
  `).all();
  return json({ reviews: results });
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const data = await readJson(request);
  const orderId = safeText(data.orderId, 40);
  const reply = safeText(data.reply, 1000);
  const adminName = safeText(data.adminName, 40) || 'Tim SLF';
  if (!orderId || !reply) return fail('Pilih ulasan dan isi balasan.');
  const review = await env.DB.prepare('SELECT order_id FROM reviews WHERE order_id = ?').bind(orderId).first();
  if (!review) return fail('Ulasan tidak ditemukan.', 404);
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO review_replies (review_order_id, admin_name, reply, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(review_order_id) DO UPDATE SET admin_name=excluded.admin_name, reply=excluded.reply, updated_at=excluded.updated_at
  `).bind(orderId, adminName, reply, now, now).run();
  await logAdminActivity(env.DB, 'review_reply_saved', 'review', orderId, { adminName });
  return json({ ok: true, orderId, reply, adminName, updatedAt: now });
}
