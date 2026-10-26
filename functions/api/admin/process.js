import { json, fail, readJson, requireAdmin } from '../../_lib/common.js';
export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak. Periksa ADMIN_SECRET.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const data = await readJson(request); const id = typeof data.orderId === 'string' ? data.orderId : '';
  if (!id) return fail('Nomor pesanan wajib diisi.');
  const now = new Date().toISOString();
  const result = await env.DB.prepare("UPDATE orders SET status = 'PROCESSING', updated_at = ? WHERE id = ? AND status = 'PAID'").bind(now, id).run();
  if (!result.meta?.changes) {
    const row = await env.DB.prepare('SELECT status FROM orders WHERE id = ?').bind(id).first();
    if (!row) return fail('Pesanan tidak ditemukan.', 404);
    if (row.status === 'PROCESSING') return json({ ok: true, status: 'PROCESSING' });
    return fail('Pesanan hanya dapat mulai diproses setelah pembayaran terverifikasi.', 409);
  }
  return json({ ok: true, status: 'PROCESSING' });
}
