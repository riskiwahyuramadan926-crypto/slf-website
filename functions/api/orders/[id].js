import { json, fail, sha256Hex, hmacSha256Hex } from '../../_lib/common.js';
export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const url = new URL(request.url), key = url.searchParams.get('key') || '', id = params.id;
  if (key.length < 32) return fail('Tautan pesanan tidak valid.', 403);
  const row = await env.DB.prepare('SELECT id,access_key_hash,minecraft_name,platform,product_id,product_name,details_json,subtotal,discount,total,status,expires_at,created_at,paid_at,completed_at,rated_at FROM orders WHERE id = ?').bind(id).first();
  if (!row || await sha256Hex(key) !== row.access_key_hash) return fail('Pesanan tidak ditemukan atau tautan akses tidak valid.', 404);
  let details = {}; try { details = JSON.parse(row.details_json || '{}'); } catch {}
  const order = {id:row.id,minecraftName:row.minecraft_name,platform:row.platform,productId:row.product_id,productName:row.product_name,details,subtotal:row.subtotal,discount:row.discount,total:row.total,status:row.status,expiresAt:row.expires_at,createdAt:row.created_at,paidAt:row.paid_at,completedAt:row.completed_at,rated:Boolean(row.rated_at)};
  if (String(row.product_id || '').startsWith('REENTRY_')) {
    const { results: ticketRows = [] } = await env.DB.prepare(
      'SELECT id, access_key_hash, status, created_at, updated_at, submitted_at, completed_at FROM reentry_tickets WHERE order_id = ? ORDER BY created_at, id'
    ).bind(id).all();
    order.tickets = await Promise.all(ticketRows.map(async ticket => {
      let ticketKey = '';
      const ticketSecret = typeof env.TICKET_LINK_SECRET === 'string' ? env.TICKET_LINK_SECRET : '';
      if (ticketSecret.length >= 32 && ticketSecret !== env.OWNER_SECRET && ticketSecret !== env.ADMIN_SECRET) {
        try {
          const candidate = await hmacSha256Hex(ticketSecret, row.id + ':' + ticket.id + ':' + key);
          if (await sha256Hex(candidate) === ticket.access_key_hash) ticketKey = candidate;
        } catch {}
      }
      // Legacy tickets used the order key; keep those existing links valid during migration.
      if (!ticketKey && ticket.access_key_hash === row.access_key_hash) ticketKey = key;
      if (!ticketKey) {
        return { id: ticket.id, status: ticket.status, createdAt: ticket.created_at, updatedAt: ticket.updated_at, submittedAt: ticket.submitted_at, completedAt: ticket.completed_at, url: null, linkUnavailable: true };
      }
      const ticketUrl = new URL('/store/ticket.html', url.origin);
      ticketUrl.searchParams.set('id', ticket.id);
      ticketUrl.searchParams.set('key', ticketKey);
      return { id: ticket.id, status: ticket.status, createdAt: ticket.created_at, updatedAt: ticket.updated_at, submittedAt: ticket.submitted_at, completedAt: ticket.completed_at, url: ticketUrl.toString() };
    }));
  }
  if (row.status === 'COMPLETED' && !row.rated_at) {
    const reviewUrl = new URL('/store/review.html', url.origin);
    reviewUrl.searchParams.set('id', id); reviewUrl.searchParams.set('key', key);
    order.reviewUrl = reviewUrl.toString();
  }
  return json({order});
}
