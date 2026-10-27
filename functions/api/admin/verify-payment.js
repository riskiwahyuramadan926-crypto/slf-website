import { json, fail, readJson, requireAdmin, notifyAdmin, logAdminActivity } from '../../_lib/common.js';
export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak. Periksa ADMIN_SECRET.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const data = await readJson(request), id = typeof data.orderId === 'string' ? data.orderId.trim() : '';
  if (!id) return fail('Nomor pesanan wajib diisi.');
  const order = await env.DB.prepare('SELECT id, minecraft_name, product_id, status FROM orders WHERE id = ?').bind(id).first();
  if (!order) return fail('Pesanan tidak ditemukan.', 404);
  if (['PAID','PROCESSING','COMPLETED'].includes(order.status)) return json({ok:true,status:order.status});
  if (order.status !== 'PENDING_PAYMENT') return fail('Pesanan tidak menunggu pembayaran.', 409);

  const reentryProducts = new Set(['REENTRY_1','REENTRY_2','REENTRY_3']);
  if (reentryProducts.has(order.product_id)) {
    const { results: ticketGroups = [] } = await env.DB.prepare(
      'SELECT season_id, COUNT(*) AS total FROM reentry_tickets WHERE order_id = ? GROUP BY season_id'
    ).bind(id).all();
    if (!ticketGroups.length) return fail('Data tiket re-entry untuk pesanan ini tidak ditemukan. Jangan verifikasi sebelum diperiksa.', 409);
    for (const group of ticketGroups) {
      const existing = await env.DB.prepare(
        `SELECT COUNT(*) AS total
         FROM reentry_tickets t JOIN orders o ON o.id = t.order_id
         WHERE LOWER(TRIM(t.minecraft_name)) = LOWER(TRIM(?))
           AND t.season_id = ?
           AND o.id <> ?
           AND o.status NOT IN ('CANCELLED','EXPIRED')`
      ).bind(order.minecraft_name, group.season_id, id).first();
      const reserved = Number(existing?.total || 0);
      if (reserved + Number(group.total || 0) > 3) {
        return fail('Verifikasi ditolak: batas 3 tiket re-entry per pemain per season akan terlampaui. Periksa pesanan tiket lain pada nama Minecraft ini; batalkan pesanan yang tidak dibayar atau selesaikan sesuai aturan sebelum mencoba lagi.', 409);
      }
    }
  }

  const now = new Date().toISOString();
  const result = await env.DB.prepare("UPDATE orders SET status='PAID',paid_at=?,updated_at=? WHERE id=? AND status='PENDING_PAYMENT'").bind(now,now,id).run();
  if (result.meta?.changes) {
    await logAdminActivity(env.DB, 'payment_verified', 'order', id, { status: 'PAID' });
    try {
      const order = await env.DB.prepare('SELECT id, minecraft_name, platform, product_name, total, status FROM orders WHERE id = ?').bind(id).first();
      if (order) await notifyAdmin(env, order, new URL('/admin/?order='+encodeURIComponent(id), request.url).toString());
    } catch (notificationError) { console.error('Admin payment notification failed:', notificationError?.message || notificationError); }
    return json({ok:true,status:'PAID'});
  }
  const row = await env.DB.prepare('SELECT status FROM orders WHERE id=?').bind(id).first();
  if (!row) return fail('Pesanan tidak ditemukan.', 404);
  if (['PAID','PROCESSING','COMPLETED'].includes(row.status)) return json({ok:true,status:row.status});
  return fail('Pesanan tidak menunggu pembayaran.', 409);
}
