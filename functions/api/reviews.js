import { json, fail, readJson, sha256Hex, safeText } from '../_lib/common.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ average: 0, count: 0, distribution: {}, reviews: [], hasMore: false });

  const url = new URL(request.url);
  const ticketId = safeText(url.searchParams.get('ticketId'), 80);
  if (ticketId) {
    const key = url.searchParams.get('key') || '';
    if (key.length < 32) return fail('Tautan ulasan layanan tiket tidak valid.', 403);
    const ticket = await env.DB.prepare(
      'SELECT t.id,t.review_key_hash,t.status,t.minecraft_name,t.product_name,t.reviewed_at FROM reentry_tickets t WHERE t.id=?'
    ).bind(ticketId).first();
    if (!ticket || !ticket.review_key_hash || await sha256Hex(key) !== ticket.review_key_hash) {
      return fail('Akses ulasan layanan tiket tidak valid.', 403);
    }
    if (ticket.status !== 'COMPLETED') return fail('Ulasan layanan baru aktif setelah Admin menyelesaikan penggunaan tiket.', 409);
    const existing = await env.DB.prepare('SELECT id FROM ticket_reviews WHERE ticket_id=?').bind(ticketId).first();
    return json({ ticket: {
      id: ticket.id,
      playerName: ticket.minecraft_name,
      productName: ticket.product_name,
      completed: true,
      rated: Boolean(existing || ticket.reviewed_at)
    }});
  }

  const limit = Math.max(1, Math.min(24, Number(url.searchParams.get('limit')) || 6));
  const offset = Math.max(0, Math.min(10000, Number(url.searchParams.get('offset')) || 0));
  const summary = await env.DB.prepare(`
    SELECT COUNT(*) AS count, COALESCE(AVG(rating),0) AS average
    FROM (
      SELECT rating FROM reviews
      UNION ALL
      SELECT rating FROM ticket_reviews
    )
  `).first();
  const { results: distributionRows = [] } = await env.DB.prepare(`
    SELECT rating, COUNT(*) AS total FROM (
      SELECT rating FROM reviews
      UNION ALL
      SELECT rating FROM ticket_reviews
    ) GROUP BY rating
  `).all();
  const distribution = Object.fromEntries([1,2,3,4,5].map(star => [star, 0]));
  for (const row of distributionRows) distribution[Number(row.rating)] = Number(row.total || 0);

  const { results = [] } = await env.DB.prepare(`
    SELECT * FROM (
      SELECT r.player_name AS player_name, r.rating AS rating, r.comment AS comment,
             r.created_at AS created_at, rr.reply AS reply, rr.admin_name AS admin_name,
             'purchase' AS review_type, o.product_name AS product_name, NULL AS ticket_id
      FROM reviews r
      JOIN orders o ON o.id = r.order_id
      LEFT JOIN review_replies rr ON rr.review_order_id = r.order_id
      UNION ALL
      SELECT tr.player_name AS player_name, tr.rating AS rating, tr.comment AS comment,
             tr.created_at AS created_at, NULL AS reply, NULL AS admin_name,
             'ticket_service' AS review_type, t.product_name AS product_name, tr.ticket_id AS ticket_id
      FROM ticket_reviews tr
      JOIN reentry_tickets t ON t.id = tr.ticket_id
    ) ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  const count = Number(summary?.count || 0);
  return json({
    average: Number(summary?.average || 0),
    count,
    distribution,
    reviews: results.map(r => ({
      playerName: r.player_name,
      rating: Number(r.rating),
      comment: r.comment || '',
      createdAt: r.created_at,
      adminReply: r.reply || null,
      adminName: r.admin_name || null,
      reviewType: r.review_type,
      productName: r.product_name || 'Produk SLF',
      ticketId: r.ticket_id || null
    })),
    hasMore: offset + results.length < count,
    nextOffset: offset + results.length
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return fail('Database ulasan belum tersambung.', 503);
  const data = await readJson(request);
  const orderId = safeText(data.orderId, 40);
  const ticketId = safeText(data.ticketId, 80);
  const key = safeText(data.key, 128);
  const rating = Number(data.rating);
  const comment = safeText(data.comment, 4000);
  if (Boolean(orderId) === Boolean(ticketId) || key.length < 32 || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return fail('Data ulasan tidak valid.');
  }

  const now = new Date().toISOString();
  if (ticketId) {
    const ticket = await env.DB.prepare(
      'SELECT id,review_key_hash,status,minecraft_name,reviewed_at FROM reentry_tickets WHERE id=?'
    ).bind(ticketId).first();
    if (!ticket || !ticket.review_key_hash || await sha256Hex(key) !== ticket.review_key_hash) {
      return fail('Akses ulasan layanan tiket tidak valid.', 403);
    }
    if (ticket.status !== 'COMPLETED') return fail('Ulasan layanan baru terbuka setelah penggunaan tiket selesai.', 409);
    if (ticket.reviewed_at) return fail('Ulasan layanan untuk tiket ini sudah dikirim.', 409);
    try {
      await env.DB.prepare(
        'INSERT INTO ticket_reviews (ticket_id,player_name,rating,comment,created_at) VALUES (?,?,?,?,?)'
      ).bind(ticketId, ticket.minecraft_name, rating, comment || null, now).run();
      await env.DB.prepare('UPDATE reentry_tickets SET reviewed_at=? WHERE id=? AND reviewed_at IS NULL')
        .bind(now, ticketId).run();
    } catch {
      return fail('Ulasan layanan untuk tiket ini sudah pernah dikirim atau belum dapat disimpan.', 409);
    }
    return json({ ok: true, reviewType: 'ticket_service' });
  }

  const order = await env.DB.prepare(
    'SELECT id,access_key_hash,status,minecraft_name,rated_at FROM orders WHERE id=?'
  ).bind(orderId).first();
  if (!order || await sha256Hex(key) !== order.access_key_hash) return fail('Akses ulasan pembelian tidak valid.', 403);
  if (order.status !== 'COMPLETED') return fail('Ulasan pembelian baru terbuka setelah pesanan selesai.', 409);
  if (order.rated_at) return fail('Ulasan pembelian untuk pesanan ini sudah dikirim.', 409);
  try {
    await env.DB.prepare(
      'INSERT INTO reviews (order_id,player_name,rating,comment,created_at) VALUES (?,?,?,?,?)'
    ).bind(orderId, order.minecraft_name, rating, comment || null, now).run();
    await env.DB.prepare('UPDATE orders SET rated_at=?,updated_at=? WHERE id=? AND rated_at IS NULL')
      .bind(now, now, orderId).run();
  } catch {
    return fail('Ulasan pembelian ini sudah pernah dikirim atau belum dapat disimpan.', 409);
  }
  return json({ ok: true, reviewType: 'purchase' });
}
