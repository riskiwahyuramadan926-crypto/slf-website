import { json, fail, readJson, requireAdmin, notifyAdmin, logAdminActivity, ensureOrderAccessKey, hmacSha256Hex, sha256Hex, resolveTicketLinkSecret } from '../../_lib/common.js';

const TICKET_PRODUCTS = new Set(['REENTRY_1','REENTRY_2','REENTRY_3']);

async function buildTicketLinks(db, order, orderKey, origin, env) {
  if (!TICKET_PRODUCTS.has(order.product_id)) return [];
  const secretInfo = resolveTicketLinkSecret(env);
  if (!secretInfo.ready) throw new Error('TICKET_LINK_SECRET belum valid; tautan tiket tidak dapat dibuat.');
  const { results = [] } = await db.prepare('SELECT id, access_key_hash FROM reentry_tickets WHERE order_id = ? ORDER BY created_at, id').bind(order.id).all();
  if (!results.length) throw new Error('Data tiket re-entry tidak ditemukan untuk pesanan ini.');
  const links = [];
  for (const ticket of results) {
    let ticketKey = '';
    for (const secret of secretInfo.secrets) {
      const candidate = await hmacSha256Hex(secret, order.id + ':' + ticket.id + ':' + orderKey);
      if (await sha256Hex(candidate) === ticket.access_key_hash) { ticketKey = candidate; break; }
    }
    if (!ticketKey) {
      ticketKey = await hmacSha256Hex(secretInfo.secret, order.id + ':' + ticket.id + ':' + orderKey);
      await db.prepare('UPDATE reentry_tickets SET access_key_hash = ?, updated_at = ? WHERE id = ? AND order_id = ?')
        .bind(await sha256Hex(ticketKey), new Date().toISOString(), ticket.id, order.id).run();
    }
    const url = new URL('/store/ticket.html', origin);
    url.searchParams.set('id', ticket.id);
    url.searchParams.set('key', ticketKey);
    links.push(url.toString());
  }
  return links;
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak. Periksa ADMIN_SECRET.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const data = await readJson(request), id = typeof data.orderId === 'string' ? data.orderId.trim() : '';
  if (!id) return fail('Nomor pesanan wajib diisi.');
  const order = await env.DB.prepare('SELECT id, access_key_hash, access_key_encrypted, minecraft_name, product_id, product_name, whatsapp, platform, total, status FROM orders WHERE id = ?').bind(id).first();
  if (!order) return fail('Pesanan tidak ditemukan.', 404);

  if (order.status === 'PENDING_PAYMENT') {
    if (TICKET_PRODUCTS.has(order.product_id)) {
      const { results: groups = [] } = await env.DB.prepare('SELECT season_id, COUNT(*) AS total FROM reentry_tickets WHERE order_id = ? GROUP BY season_id').bind(id).all();
      if (!groups.length) return fail('Data tiket re-entry tidak ditemukan. Jangan verifikasi sebelum diperiksa.', 409);
      for (const group of groups) {
        const existing = await env.DB.prepare(`SELECT COUNT(*) AS total FROM reentry_tickets t JOIN orders o ON o.id=t.order_id WHERE LOWER(TRIM(t.minecraft_name))=LOWER(TRIM(?)) AND t.season_id=? AND o.id<>? AND o.status NOT IN ('CANCELLED','EXPIRED')`).bind(order.minecraft_name,group.season_id,id).first();
        if (Number(existing?.total||0)+Number(group.total||0)>3) return fail('Verifikasi ditolak: batas 3 tiket re-entry per pemain per season akan terlampaui.',409);
      }
    }
    const now = new Date().toISOString();
    const result = await env.DB.prepare("UPDATE orders SET status='PAID',paid_at=?,updated_at=? WHERE id=? AND status='PENDING_PAYMENT'").bind(now,now,id).run();
    if (result.meta?.changes) await logAdminActivity(env.DB,'payment_verified','order',id,{status:'PAID'});
  } else if (!['PAID','PROCESSING','COMPLETED'].includes(order.status)) {
    return fail('Pesanan tidak menunggu pembayaran atau sudah tidak dapat diverifikasi.',409);
  }

  try {
    const paidOrder = await env.DB.prepare('SELECT id, access_key_hash, access_key_encrypted, whatsapp, minecraft_name, platform, product_id, product_name, total, status FROM orders WHERE id=?').bind(id).first();
    const orderKey = await ensureOrderAccessKey(env.DB,paidOrder,env);
    const phone = String(paidOrder.whatsapp||'').replace(/\D/g,'');
    if (!phone) return fail('Pembayaran sudah tercatat, tetapi nomor WhatsApp pembeli tidak valid.',422);
    let message = '';
    if (TICKET_PRODUCTS.has(paidOrder.product_id)) {
      const ticketLinks = await buildTicketLinks(env.DB,paidOrder,orderKey,new URL(request.url).origin,env);
      message = 'Halo ' + paidOrder.minecraft_name + ', pembayaran untuk pesanan ' + paidOrder.id + ' (' + paidOrder.product_name + ') telah berhasil!\nGunakan link tiket pribadi di bawah ini saat kamu ingin mengajukan pemakaian tiket:\n' + ticketLinks.join('\n');
    } else {
      message = 'Halo ' + paidOrder.minecraft_name + ', pembayaran untuk pesanan ' + paidOrder.id + ' (' + paidOrder.product_name + ') telah berhasil kami terima!\nProduk kamu saat ini sedang diproses. Harap segera login ke dalam server sekarang untuk proses penyerahan produk.';
    }
    await notifyAdmin(env,paidOrder,new URL('/admin/?order='+encodeURIComponent(id),request.url).toString()).catch(error=>console.error('Admin notification failed:',error?.message||error));
    const whatsappUrl='https://wa.me/'+phone+'?text='+encodeURIComponent(message);
    return json({ok:true,status:paidOrder.status,whatsappUrl});
  } catch (error) {
    console.error('Payment WhatsApp preparation failed:',error?.message||error);
    return fail('Pembayaran sudah tercatat, tetapi tautan WhatsApp belum dapat dibuat: '+String(error?.message||error),503);
  }
}
