import { json, fail } from '../_lib/common.js';

export async function onRequestGet({ env }) {
  if (!env.DB) return fail('Database Store belum tersambung.', 503);
  const { results = [] } = await env.DB.prepare(
    'SELECT id, name, price, description, icon, tag, note FROM store_products WHERE active = 1 ORDER BY created_at, id'
  ).all();
  return json({ products: results.map(p => ({ ...p, price: Number(p.price) })) }, 200, { 'cache-control': 'public, max-age=60' });
}
