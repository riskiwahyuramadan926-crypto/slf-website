import { json, fail, readJson, requireAdmin, logAdminActivity, decryptOrderAccessKey, sha256Hex } from '../../_lib/common.js';
export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak. Periksa ADMIN_SECRET.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const data = await readJson(request); const id = typeof data.orderId === 'string' ? data.orderId : '';
  if (!id) return fail('Nomor pesanan wajib diisi.');
  const row = await env.DB.prepare('SELECT id, status, access_key_hash, access_key_encrypted, whatsapp, minecraft_name, platform, product_name, total FROM orders WHERE id = ?').bind(id).first();
  if (!row) return fail('Pesanan tidak ditemukan.', 404);
  if (row.status === 'COMPLETED') return json({ ok: true, status: 'COMPLETED', message: 'Pesanan ini sudah selesai.' });
  if (!['PAID','PROCESSING'].includes(row.status)) return fail('Pesanan hanya boleh diselesaikan setelah pembayaran terverifikasi.', 409);
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE orders SET status = 'COMPLETED', completed_at = ?, updated_at = ? WHERE id = ? AND status IN ('PAID','PROCESSING')").bind(now, now, id).run();
  await env.DB.prepare("UPDATE reentry_tickets SET status = 'ACTIVE', updated_at = ? WHERE order_id = ? AND status = 'WAITING_PAYMENT'").bind(now, id).run();
  await logAdminActivity(env.DB, 'order_completed', 'order', id, { status: 'COMPLETED' });
  let whatsappUrl = null;
  try {
    const orderKey = await decryptOrderAccessKey(row.access_key_encrypted, env);
    if (orderKey && await sha256Hex(orderKey) === row.access_key_hash) {
      const reviewUrl = new URL('/store/review.html', request.url); reviewUrl.searchParams.set('id', id); reviewUrl.searchParams.set('key', orderKey);
      const phone = String(row.whatsapp || '').replace(/\D/g, '');
      if (phone) {
        const lines = ['✦ *SLF STORE — PESANAN SELESAI*', '', 'Halo ' + row.minecraft_name + ', produk pesananmu sudah diserahkan dan pesanan telah ditandai selesai oleh Admin SLF.', '', '*ID PESANAN*', row.id, '', '*DATA PEMBELI*', 'Nama Minecraft: ' + row.minecraft_name, 'Platform: ' + row.platform, '', '*NAMA PRODUK*', row.product_name, '*TOTAL DONASI* Rp' + new Intl.NumberFormat('id-ID').format(row.total || 0), '', '*STATUS PEMBAYARAN* BERHASIL · COMPLETED', '', '*LINK REVIEW*', reviewUrl.toString(), '', 'Ulasan hanya dapat dikirim satu kali. Terima kasih telah mendukung SLF.'].join('\n');
        whatsappUrl = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(lines);
      }
    }
  } catch (error) { console.error('Customer completion WhatsApp link preparation failed:', error?.message || error); }
  return json({ ok: true, status: 'COMPLETED', whatsappUrl });
}
