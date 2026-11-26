import { json, fail, readJson, requireAdmin, notifyAdmin, logAdminActivity, decryptOrderAccessKey, hmacSha256Hex, sha256Hex, resolveTicketLinkSecret, currency } from '../../_lib/common.js';
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
    let whatsappUrl = null;
    try {
      const paidOrder = await env.DB.prepare('SELECT id, access_key_hash, access_key_encrypted, whatsapp, minecraft_name, platform, product_id, product_name, total, status FROM orders WHERE id = ?').bind(id).first();
      if (paidOrder) {
        await notifyAdmin(env, paidOrder, new URL('/admin/?order='+encodeURIComponent(id), request.url).toString());
        const orderKey = await decryptOrderAccessKey(paidOrder.access_key_encrypted, env);
        if (orderKey && await sha256Hex(orderKey) === paidOrder.access_key_hash) {
          const orderUrl = new URL('/store/order.html', request.url); orderUrl.searchParams.set('id', id); orderUrl.searchParams.set('key', orderKey);
          const ticketLinks = [];
          if (String(paidOrder.product_id || '').startsWith('REENTRY_')) {
            const { results: rows = [] } = await env.DB.prepare('SELECT id, access_key_hash FROM reentry_tickets WHERE order_id = ? ORDER BY created_at, id').bind(id).all();
            const secrets = resolveTicketLinkSecret(env).secrets;
            for (const ticket of rows) {
              let ticketKey = '';
              for (const secret of secrets) {
                try { const candidate = await hmacSha256Hex(secret, id + ':' + ticket.id + ':' + orderKey); if (await sha256Hex(candidate) === ticket.access_key_hash) { ticketKey = candidate; break; } } catch {}
              }
              if (!ticketKey && ticket.access_key_hash === paidOrder.access_key_hash) ticketKey = orderKey;
              if (ticketKey) { const u = new URL('/store/ticket.html', request.url); u.searchParams.set('id', ticket.id); u.searchParams.set('key', ticketKey); ticketLinks.push(u.toString()); }
            }
          }
          const phone = String(paidOrder.whatsapp || '').replace(/\D/g, '');
          if (phone) {
            const lines = ['✦ *SLF STORE — PEMBAYARAN BERHASIL*', '', 'Halo ' + paidOrder.minecraft_name + ', pembayaran pesananmu sudah berhasil diverifikasi oleh Admin SLF.', '', '*ID PESANAN*', paidOrder.id, '', '*DATA PEMBELI*', 'Nama Minecraft: ' + paidOrder.minecraft_name, 'Platform: ' + paidOrder.platform, '', '*NAMA PRODUK*', paidOrder.product_name, '*TOTAL DONASI* ' + currency(paidOrder.total), '', '*STATUS PEMBAYARAN* BERHASIL · PAID', '', ticketLinks.length ? '*LINK TIKET PRIBADI*' : '*INFORMASI PESANAN*', ...(ticketLinks.length ? ticketLinks.map((u,i)=>'Tiket ' + (i+1) + ': ' + u) : [orderUrl.toString()]), '', 'Simpan tautan pribadi ini dan jangan bagikan kepada orang lain.', '', 'Terima kasih telah mendukung Survival Legacy Frontier.'].join('\n');
            whatsappUrl = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(lines);
          }
        }
      }
    } catch (notificationError) { console.error('Admin payment notification failed:', notificationError?.message || notificationError); }
    return json({ok:true,status:'PAID',whatsappUrl});
  }
  const row = await env.DB.prepare('SELECT status FROM orders WHERE id=?').bind(id).first();
  if (!row) return fail('Pesanan tidak ditemukan.', 404);
  if (['PAID','PROCESSING','COMPLETED'].includes(row.status)) return json({ok:true,status:row.status});
  return fail('Pesanan tidak menunggu pembayaran.', 409);
}
