import { json, fail, readJson, requireAdmin, logAdminActivity, buildWhatsAppUrl, randomHex, sha256Hex, encryptOrderAccessKey, decryptOrderAccessKey } from '../../_lib/common.js';

function safeLinkError(error) {
  return String(error?.message || error || 'Link belum dapat dibuat.').replace(/[\r\n]/g, ' ').slice(0, 240);
}

async function ensureTicketReviewLink(db, ticket, origin, env) {
  let key = await decryptOrderAccessKey(ticket.review_key_encrypted, env);
  if (!key || await sha256Hex(key) !== ticket.review_key_hash) {
    key = randomHex(64);
    const encrypted = await encryptOrderAccessKey(key, env);
    if (!encrypted) throw new Error('ORDER_LINK_SECRET atau OWNER_SECRET belum valid untuk membuat tautan ulasan layanan.');
    await db.prepare('UPDATE reentry_tickets SET review_key_hash=?,review_key_encrypted=?,updated_at=? WHERE id=?')
      .bind(await sha256Hex(key), encrypted, new Date().toISOString(), ticket.id).run();
  }
  const url = new URL('/store/review.html', origin);
  url.searchParams.set('ticket', ticket.id);
  url.searchParams.set('key', key);
  return url.toString();
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak. Periksa ADMIN_SECRET.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const data = await readJson(request);
  const id = typeof data.ticketId === 'string' ? data.ticketId.trim() : '';
  const status = typeof data.status === 'string' ? data.status : '';
  if (!id || !['ACTIVE', 'COMPLETED'].includes(status)) return fail('Data status tiket tidak valid.');

  const row = await env.DB.prepare(
    'SELECT t.id, t.order_id, t.status, t.submitted_at, t.minecraft_name, t.product_name, t.review_key_hash, t.review_key_encrypted, o.status AS order_status, o.whatsapp FROM reentry_tickets t JOIN orders o ON o.id=t.order_id WHERE t.id=?'
  ).bind(id).first();
  if (!row) return fail('Tiket tidak ditemukan.', 404);
  if (row.order_status !== 'COMPLETED') {
    return fail('Pesanan tiket belum selesai diproses. Selesaikan pesanan di panel Admin terlebih dahulu.', 409);
  }

  const now = new Date().toISOString();
  const orderForLinks = {
    id: row.order_id,
    product_id: row.product_id,
    access_key_hash: row.access_key_hash,
    access_key_encrypted: row.access_key_encrypted
  };

  if (status === 'ACTIVE' && (row.status === 'PENDING' || (row.status === 'ACTIVE' && row.submitted_at))) {
    if (row.status === 'PENDING') {
      await env.DB.prepare(
        "UPDATE reentry_tickets SET status='ACTIVE',updated_at=?,completed_at=NULL WHERE id=? AND status='PENDING'"
      ).bind(now, id).run();
      await logAdminActivity(env.DB, 'reentry_ticket_accepted', 'reentry_ticket', id, { status: 'ACTIVE' });
    }

    const links = { ticket_link: '', ticket_links: [], review_link: '' };
    let whatsappUrl = '';
    let linkError = '';
    try {
      const generated = await buildOrderLinks(env.DB, orderForLinks, new URL(request.url).origin, env);
      Object.assign(links, generated);
      const ticketLink = links.ticket_links.find(ticket => ticket.id === String(row.id))?.url || '';
      if (!ticketLink) throw new Error('Link tiket pribadi belum tersedia.');
      const message = 'Halo ' + row.minecraft_name + ', pengajuan tiket ' + row.id + ' kamu sudah kami terima!\nHarap segera login sekarang dan tunggu di lobby, lalu nantikan instruksi selanjutnya dari Admin.\nLink tiket pribadi:\n' + ticketLink;
      whatsappUrl = buildWhatsAppUrl(row.whatsapp, message);
      if (!whatsappUrl) throw new Error('Nomor WhatsApp member tidak valid.');
      links.ticket_link = ticketLink;
    } catch (error) {
      linkError = safeLinkError(error);
      console.error('Ticket acceptance link preparation failed after status update:', linkError);
    }
    return json({ ok: true, status: 'ACTIVE', ...links, whatsappUrl, link_error: linkError });
  }

  if (status === 'COMPLETED' && ((row.status === 'ACTIVE' && row.submitted_at) || row.status === 'COMPLETED')) {
    if (row.status === 'ACTIVE') {
      await env.DB.prepare(
        "UPDATE reentry_tickets SET status='COMPLETED',updated_at=?,completed_at=? WHERE id=? AND status='ACTIVE' AND submitted_at IS NOT NULL"
      ).bind(now, now, id).run();
      await logAdminActivity(env.DB, 'reentry_ticket_completed', 'reentry_ticket', id, { status: 'COMPLETED' });
    }

    let ticketReviewLink = '';
    let whatsappUrl = '';
    let linkError = '';
    try {
      ticketReviewLink = await ensureTicketReviewLink(env.DB, row, new URL(request.url).origin, env);
      const message = 'Halo ' + row.minecraft_name + ', penggunaan tiket ' + row.id +
        ' telah selesai diproses. Selamat bermain kembali!\nMohon nilai layanan pemakaian tiket dan bantuan Admin SLF melalui link terpisah berikut:\n' + ticketReviewLink;
      whatsappUrl = buildWhatsAppUrl(row.whatsapp, message);
      if (!whatsappUrl) throw new Error('Nomor WhatsApp member tidak valid.');
    } catch (error) {
      linkError = safeLinkError(error);
      console.error('Ticket service review link preparation failed after ticket completion:', linkError);
    }
    return json({ ok: true, status: 'COMPLETED', ticket_review_link: ticketReviewLink, whatsappUrl, link_error: linkError });
  }

  // Reopening is an administrative correction, not a member notification.
  if (status === 'ACTIVE' && row.status === 'COMPLETED') {
    await env.DB.prepare(
      "UPDATE reentry_tickets SET status='ACTIVE',submitted_at=NULL,completed_at=NULL,updated_at=? WHERE id=? AND status='COMPLETED'"
    ).bind(now, id).run();
    await logAdminActivity(env.DB, 'reentry_ticket_reactivated', 'reentry_ticket', id, { status: 'ACTIVE' });
    return json({ ok: true, status: 'ACTIVE', restored: true });
  }

  if (row.status === status) return json({ ok: true, status });
  if (status === 'COMPLETED') return fail('Tiket harus diajukan dan diterima Admin sebelum ditandai selesai.', 409);
  return fail('Tiket ini tidak dapat diubah ke status tersebut.', 409);
}
