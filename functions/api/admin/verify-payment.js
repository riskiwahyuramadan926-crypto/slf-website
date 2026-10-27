import { json, fail, readJson, requireAdmin, notifyAdmin, logAdminActivity } from '../../_lib/common.js';
export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak. Periksa ADMIN_SECRET.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const data = await readJson(request), id = typeof data.orderId === 'string' ? data.orderId.trim() : '';
  if (!id) return fail('Nomor pesanan wajib diisi.');
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
