import { json, fail, requireAdmin, buildOrderLinks } from '../../_lib/common.js';

function safeLinkError(error) {
  return String(error?.message || error || 'Link belum dapat dibuat.').replace(/[\r\n]/g, ' ').slice(0, 240);
}

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak. Periksa ADMIN_SECRET.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);

  try {
    const [{ results = [] }, statsRow] = await Promise.all([
      env.DB.prepare(
        'SELECT id, minecraft_name, platform, whatsapp, email, product_id, product_name, details_json, subtotal, discount, total, status, promo_code, created_at, paid_at, completed_at, access_key_hash, access_key_encrypted FROM orders ORDER BY created_at DESC LIMIT 500'
      ).all(),
      env.DB.prepare(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN status='PENDING_PAYMENT' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status='PAID' THEN 1 ELSE 0 END) AS paid,
        SUM(CASE WHEN status='PROCESSING' THEN 1 ELSE 0 END) AS processing,
        SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status IN ('CANCELLED','EXPIRED') THEN 1 ELSE 0 END) AS cancelled,
        SUM(CASE WHEN status IN ('PAID','PROCESSING','COMPLETED') THEN total ELSE 0 END) AS revenue,
        SUM(CASE WHEN date(created_at)=date('now') THEN 1 ELSE 0 END) AS today
        FROM orders`).first()
    ]);

    const origin = new URL(request.url).origin;
    const orders = await Promise.all(results.map(async row => {
      const { details_json, access_key_hash, access_key_encrypted, ...safeOrder } = row;
      let details = {};
      try { details = JSON.parse(details_json || '{}'); } catch { details = {}; }

      // Link generation is best-effort per order. One legacy row or missing
      // ticket secret must never make the complete Admin order list unavailable.
      try {
        const links = await buildOrderLinks(env.DB, row, origin, env);
        return { ...safeOrder, details, ...links, link_error: '' };
      } catch (error) {
        console.error('Admin order link generation failed for ' + row.id + ':', error?.message || error);
        return {
          ...safeOrder,
          details,
          ticket_link: '',
          ticket_links: [],
          review_link: '',
          link_error: safeLinkError(error)
        };
      }
    }));

    const stats = Object.fromEntries(Object.entries(statsRow || {}).map(([key, value]) => [key, Number(value || 0)]));
    return json({ orders, stats, generatedAt: new Date().toISOString(), ordersLimit: 500 });
  } catch (error) {
    console.error('Admin orders query failed:', error?.message || error);
    return fail('Data pesanan gagal dimuat dari D1: ' + safeLinkError(error), 503);
  }
}
