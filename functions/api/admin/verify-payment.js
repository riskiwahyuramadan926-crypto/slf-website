import { json, fail, readJson, requireAdmin, notifyAdmin, logAdminActivity, buildOrderLinks } from '../../_lib/common.js';

function safeLinkError(error) {
  return String(error?.message || error || 'Link belum dapat dibuat.').replace(/[\r\n]/g, ' ').slice(0, 240);
}

export function buildPaidTicketWhatsAppMessage(order, ticketLinks) {
  const playerName = String(order?.minecraft_name || 'pemain');
  const productName = String(order?.product_name || order?.product_id || 'pesanan SLF');
  const ticketSections = (Array.isArray(ticketLinks) ? ticketLinks : []).map((ticket, index) => [
    '🎫 Tiket ' + (index + 1) + ' (' + String(ticket?.id || '') + '):',
    String(ticket?.url || '')
  ].join('\n'));

  return [
    'Halo ' + playerName + ', pembayaran untuk pesanan ' + String(order?.id || '') + ' (' + productName + ') telah berhasil!',
    '',
    'Berikut adalah link tiket pribadi kamu (1 link berlaku untuk 1 kali pemakaian tiket):',
    '',
    ticketSections.join('\n\n'),
    '',
    'Gunakan salah satu link di atas saat kamu ingin mengajukan pemakaian tiket.'
  ].join('\n');
}

export async function onRequestPost({ request, env }) {
  // Admin authentication remains mandatory. Ticket/product/link validation is
  // intentionally not allowed to block the payment-state write.
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak. Periksa ADMIN_SECRET.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);

  const data = await readJson(request);
  const id = typeof data.orderId === 'string' ? data.orderId.trim() : '';
  if (!id) return fail('Nomor pesanan wajib diisi.');

  let order = await env.DB.prepare(
    'SELECT id, access_key_hash, access_key_encrypted, minecraft_name, product_id, product_name, whatsapp, platform, total, status, paid_at FROM orders WHERE id = ?'
  ).bind(id).first();
  if (!order) return fail('Pesanan tidak ditemukan.', 404);

  if (order.status === 'PENDING_PAYMENT') {
    // The only required business operation for confirmation is persisting PAID.
    // Legacy/missing ticket rows, season counts, product metadata, and secrets
    // are handled after this write and cannot veto an already-received payment.
    const now = new Date().toISOString();
    const result = await env.DB.prepare(
      "UPDATE orders SET status='PAID',paid_at=?,updated_at=? WHERE id=? AND status='PENDING_PAYMENT'"
    ).bind(now, now, id).run();

    if (Number(result.meta?.changes || 0) > 0) {
      order = { ...order, status: 'PAID', paid_at: now };
      await logAdminActivity(env.DB, 'payment_verified', 'order', id, { status: 'PAID' });
    } else {
      order = await env.DB.prepare(
        'SELECT id, access_key_hash, access_key_encrypted, minecraft_name, product_id, product_name, whatsapp, platform, total, status, paid_at FROM orders WHERE id=?'
      ).bind(id).first();
      if (!order || !['PAID', 'PROCESSING', 'COMPLETED'].includes(order.status)) {
        return fail('Status pembayaran tidak berubah di D1. Muat ulang pesanan dan coba kembali.', 409);
      }
    }
  } else if (!['PAID', 'PROCESSING', 'COMPLETED'].includes(order.status)) {
    return fail('Pesanan tidak menunggu pembayaran atau sudah tidak dapat diverifikasi.', 409);
  }

  // Keep the three-ticket-per-season rule, but evaluate it only after PAID is
  // durable. An over-limit order remains paid while ticket fulfillment is held
  // for an Admin review; missing ticket rows never veto the payment update.
  const isTicketProduct = String(order.product_id || '').startsWith('REENTRY_');
  let ticketEligibilityError = '';
  if (isTicketProduct) {
    try {
      const { results: groups = [] } = await env.DB.prepare(
        'SELECT season_id, COUNT(*) AS total FROM reentry_tickets WHERE order_id = ? GROUP BY season_id'
      ).bind(id).all();
      for (const group of groups) {
        const existing = await env.DB.prepare(
          `SELECT COUNT(*) AS total FROM reentry_tickets t JOIN orders o ON o.id=t.order_id
           WHERE LOWER(TRIM(t.minecraft_name))=LOWER(TRIM(?)) AND t.season_id=? AND o.id<>?
           AND o.status NOT IN ('CANCELLED','EXPIRED')`
        ).bind(order.minecraft_name, group.season_id, id).first();
        if (Number(existing?.total || 0) + Number(group.total || 0) > 3) {
          ticketEligibilityError = 'Batas 3 tiket re-entry per pemain per season terlampaui. Pembayaran sudah tercatat; tautan tiket ditahan untuk pemeriksaan Admin SLF.';
          break;
        }
      }
    } catch (error) {
      ticketEligibilityError = 'Pemeriksaan batas tiket tidak berhasil: ' + safeLinkError(error);
    }
  }

  // Secure ticket/review links are best-effort. Their errors are reported but
  // must never change a successfully persisted PAID status into an API failure.
  const links = { ticket_link: '', ticket_links: [], review_link: '' };
  let linkError = ticketEligibilityError;
  if (ticketEligibilityError) {
    console.warn('Payment is PAID but ticket fulfillment requires review:', ticketEligibilityError);
  } else {
    try {
      const generated = await buildOrderLinks(env.DB, order, new URL(request.url).origin, env);
      Object.assign(links, generated);
    } catch (error) {
      linkError = safeLinkError(error);
      console.error('Payment link preparation failed after status update:', linkError);
    }
  }

  // WhatsApp confirmation does not depend on an access key or the ticket table.
  // A blank/legacy phone uses wa.me/?text= so the admin can choose the recipient
  // in WhatsApp instead of losing the confirmation flow entirely.
  const playerName = String(order.minecraft_name || 'pemain');
  const productName = String(order.product_name || order.product_id || 'pesanan SLF');
  let message;
  if (isTicketProduct && links.ticket_links.length) {
    message = buildPaidTicketWhatsAppMessage(order, links.ticket_links);
  } else if (isTicketProduct) {
    message = 'Halo ' + playerName + ', pembayaran untuk pesanan ' + order.id + ' (' + productName + ') telah berhasil kami terima. Status pesanan sudah tercatat. Link tiket pribadi akan dikirimkan secara terpisah setelah data tiket selesai diperiksa Admin SLF.';
  } else {
    message = 'Halo ' + playerName + ', pembayaran untuk pesanan ' + order.id + ' (' + productName + ') telah berhasil kami terima!\nProduk kamu saat ini sedang diproses. Harap segera login ke dalam server sekarang untuk proses penyerahan produk.';
  }
  const phone = String(order.whatsapp || '').replace(/\D/g, '');
  const normalizedMessage = String(message ?? '').replace(/\\n/g, '\n');
  const encodedMessage = encodeURIComponent(normalizedMessage);
  const whatsappUrl = phone
    ? 'https://wa.me/' + phone + '?text=' + encodedMessage
    : 'https://wa.me/?text=' + encodedMessage;

  await notifyAdmin(env, order, new URL('/admin/?order=' + encodeURIComponent(id), request.url).toString())
    .catch(error => console.error('Admin notification failed:', error?.message || error));

  return json({
    ok: true,
    status: order.status,
    paid_at: order.paid_at || null,
    ...links,
    whatsapp_url: whatsappUrl,
    whatsappUrl,
    link_error: linkError
  });
}
