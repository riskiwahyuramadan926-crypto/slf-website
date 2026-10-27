import { json, fail, readJson, requireAdmin, logAdminActivity } from '../../_lib/common.js';

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak. Periksa ADMIN_SECRET.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const data = await readJson(request);
  const id = typeof data.orderId === 'string' ? data.orderId.trim() : '';
  if (!id) return fail('Nomor pesanan wajib diisi.');
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    "UPDATE orders SET status = 'CANCELLED', updated_at = ? WHERE id = ? AND status = 'PENDING_PAYMENT'"
  ).bind(now, id).run();
  if (!result.meta?.changes) {
    const row = await env.DB.prepare('SELECT status FROM orders WHERE id = ?').bind(id).first();
    if (!row) return fail('Pesanan tidak ditemukan.', 404);
    if (row.status === 'CANCELLED') return json({ ok: true, status: 'CANCELLED' });
    return fail('Hanya transaksi yang belum dibayar yang bisa dibatalkan. Periksa pembayaran dulu bila statusnya sudah berubah.', 409);
  }
  await env.DB.prepare("UPDATE reentry_tickets SET status = 'CANCELLED', updated_at = ? WHERE order_id = ? AND status = 'WAITING_PAYMENT'").bind(now, id).run();
  await logAdminActivity(env.DB, 'order_cancelled', 'order', id, { status: 'CANCELLED' });
  return json({ ok: true, status: 'CANCELLED' });
}
