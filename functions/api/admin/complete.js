import { json, fail, readJson, requireAdmin } from '../../_lib/common.js';
export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak. Periksa ADMIN_SECRET.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const data = await readJson(request); const id = typeof data.orderId === 'string' ? data.orderId : '';
  if (!id) return fail('Nomor pesanan wajib diisi.');
  const row = await env.DB.prepare('SELECT id, status FROM orders WHERE id = ?').bind(id).first();
  if (!row) return fail('Pesanan tidak ditemukan.', 404);
  if (row.status === 'COMPLETED') return json({ ok: true, status: 'COMPLETED', message: 'Pesanan ini sudah selesai.' });
  if (!['PAID','PROCESSING'].includes(row.status)) return fail('Pesanan hanya boleh diselesaikan setelah pembayaran terverifikasi.', 409);
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE orders SET status = 'COMPLETED', completed_at = ?, updated_at = ? WHERE id = ? AND status IN ('PAID','PROCESSING')").bind(now, now, id).run();
  return json({ ok: true, status: 'COMPLETED' });
}
