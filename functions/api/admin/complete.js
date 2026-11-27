import { json, fail, readJson, requireAdmin, logAdminActivity, buildOrderReviewLink, buildWhatsAppUrl } from '../../_lib/common.js';

const TICKET_PRODUCTS = new Set(['REENTRY_1','REENTRY_2','REENTRY_3']);

function safeLinkError(error) {
  return String(error?.message || error || 'Link belum dapat dibuat.').replace(/[\r\n]/g, ' ').slice(0, 240);
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak. Periksa ADMIN_SECRET.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const data = await readJson(request);
  const id = typeof data.orderId === 'string' ? data.orderId.trim() : '';
  if (!id) return fail('Nomor pesanan wajib diisi.');

  let order = await env.DB.prepare(
    'SELECT id,status,access_key_hash,access_key_encrypted,whatsapp,minecraft_name,platform,product_id,product_name,total,paid_at,completed_at FROM orders WHERE id=?'
  ).bind(id).first();
  if (!order) return fail('Pesanan tidak ditemukan.', 404);
  if (!['PAID', 'PROCESSING', 'COMPLETED'].includes(order.status)) {
    return fail('Pesanan hanya boleh diselesaikan setelah pembayaran terverifikasi.', 409);
  }

  if (order.status !== 'COMPLETED') {
    const now = new Date().toISOString();
    const changed = await env.DB.prepare(
      "UPDATE orders SET status='COMPLETED',completed_at=?,updated_at=? WHERE id=? AND status IN ('PAID','PROCESSING')"
    ).bind(now, now, id).run();

    if (changed.meta?.changes) {
      order = { ...order, status: 'COMPLETED', completed_at: now };
      await logAdminActivity(env.DB, 'order_completed', 'order', id, { status: 'COMPLETED' });

      // Synchronize ticket state only after the order status has been persisted.
      // A ticket-row issue must not change the successful order update into HTTP 500.
      if (TICKET_PRODUCTS.has(order.product_id)) {
        try {
          await env.DB.prepare(
            "UPDATE reentry_tickets SET status='ACTIVE',updated_at=? WHERE order_id=? AND status='WAITING_PAYMENT'"
          ).bind(now, id).run();
        } catch (error) {
          console.error('Re-entry ticket activation failed after order completion:', error?.message || error);
        }
      }
    } else {
      order = await env.DB.prepare(
        'SELECT id,status,access_key_hash,access_key_encrypted,whatsapp,minecraft_name,platform,product_id,product_name,total,paid_at,completed_at FROM orders WHERE id=?'
      ).bind(id).first();
      if (!order || order.status !== 'COMPLETED') {
        return fail('Status pesanan tidak berubah di D1. Muat ulang pesanan dan coba kembali.', 409);
      }
    }
  }

  let reviewLink = '';
  let whatsappUrl = '';
  let linkError = '';
  try {
    reviewLink = await buildOrderReviewLink(env.DB, order, new URL(request.url).origin, env);
    const message = 'Halo ' + order.minecraft_name + ', pembelian ' + (order.product_name || 'produk SLF') +
      ' kamu sudah selesai diproses.\nMohon nilai pengalaman pembelian dan produk melalui link ulasan berikut:\n' + reviewLink;
    whatsappUrl = buildWhatsAppUrl(order.whatsapp, message);
    if (!whatsappUrl) throw new Error('Nomor WhatsApp pembeli tidak valid.');
  } catch (error) {
    linkError = safeLinkError(error);
    console.error('Purchase review link preparation failed after order completion:', linkError);
  }

  return json({
    ok: true,
    status: 'COMPLETED',
    completed_at: order.completed_at || null,
    review_link: reviewLink,
    whatsappUrl,
    ticketFlow: TICKET_PRODUCTS.has(order.product_id),
    link_error: linkError
  });
}
