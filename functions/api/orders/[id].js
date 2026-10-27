import { json, fail, sha256Hex } from '../../_lib/common.js';
export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const url = new URL(request.url), key = url.searchParams.get('key') || '', id = params.id;
  if (key.length < 32) return fail('Tautan pesanan tidak valid.', 403);
  const row = await env.DB.prepare('SELECT id,access_key_hash,minecraft_name,platform,product_id,product_name,details_json,subtotal,discount,total,status,expires_at,created_at,paid_at,completed_at,rated_at FROM orders WHERE id = ?').bind(id).first();
  if (!row || await sha256Hex(key) !== row.access_key_hash) return fail('Pesanan tidak ditemukan atau tautan akses tidak valid.', 404);
  let details = {}; try { details = JSON.parse(row.details_json || '{}'); } catch {}
  const order = {id:row.id,minecraftName:row.minecraft_name,platform:row.platform,productId:row.product_id,productName:row.product_name,details,subtotal:row.subtotal,discount:row.discount,total:row.total,status:row.status,expiresAt:row.expires_at,createdAt:row.created_at,paidAt:row.paid_at,completedAt:row.completed_at,rated:Boolean(row.rated_at)};
  if (row.status === 'COMPLETED' && !row.rated_at) {
    const reviewUrl = new URL('/store/review.html', url.origin);
    reviewUrl.searchParams.set('id', id); reviewUrl.searchParams.set('key', key);
    order.reviewUrl = reviewUrl.toString();
  }
  return json({order});
}
