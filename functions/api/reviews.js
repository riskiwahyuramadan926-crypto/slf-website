import { json, fail, readJson, sha256Hex, safeText } from '../_lib/common.js';
export async function onRequestGet({ env }) {
  if (!env.DB) return json({ average: 0, count: 0, reviews: [] });
  const summary = await env.DB.prepare('SELECT COUNT(*) AS count, COALESCE(AVG(rating),0) AS average FROM reviews').first();
  const { results = [] } = await env.DB.prepare('SELECT r.player_name, r.rating, r.comment, r.created_at, rr.reply, rr.admin_name, rr.updated_at AS replied_at FROM reviews r LEFT JOIN review_replies rr ON rr.review_order_id = r.order_id ORDER BY r.created_at DESC LIMIT 12').all();
  return json({ average: Number(summary?.average || 0), count: Number(summary?.count || 0), reviews: results.map(r => ({ playerName: r.player_name, rating: r.rating, comment: r.comment, createdAt: r.created_at, adminReply: r.reply || null, adminName: r.admin_name || null, repliedAt: r.replied_at || null })) });
}
export async function onRequestPost({ request, env }) {
  if (!env.DB) return fail('Database ulasan belum tersambung.', 503);
  const d = await readJson(request); const orderId = safeText(d.orderId, 40); const key = safeText(d.key, 128); const rating = Number(d.rating); const comment = safeText(d.comment, 500);
  if (!orderId || key.length < 32 || !Number.isInteger(rating) || rating < 1 || rating > 5) return fail('Data rating tidak valid.');
  const order = await env.DB.prepare('SELECT id, access_key_hash, status, minecraft_name, rated_at FROM orders WHERE id = ?').bind(orderId).first();
  if (!order || (await sha256Hex(key)) !== order.access_key_hash) return fail('Akses rating tidak valid.', 403);
  if (order.status !== 'COMPLETED') return fail('Rating baru terbuka setelah pesanan selesai.', 409);
  if (order.rated_at) return fail('Rating untuk pesanan ini sudah dikirim.', 409);
  const now = new Date().toISOString();
  try {
    await env.DB.prepare('INSERT INTO reviews (order_id, player_name, rating, comment, created_at) VALUES (?, ?, ?, ?, ?)').bind(orderId, order.minecraft_name, rating, comment || null, now).run();
    await env.DB.prepare('UPDATE orders SET rated_at = ?, updated_at = ? WHERE id = ? AND rated_at IS NULL').bind(now, now, orderId).run();
  } catch (e) { return fail('Rating ini sudah pernah dikirim atau belum dapat disimpan.', 409); }
  return json({ ok: true });
}
