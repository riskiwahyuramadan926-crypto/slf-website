import { json, fail, readJson, requireAdmin, safeText, logAdminActivity } from '../../_lib/common.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const { results = [] } = await env.DB.prepare('SELECT id,name,price,description,icon,tag,note,active,created_at,updated_at FROM store_products ORDER BY created_at,id').all();
  return json({ products: results.map(p => ({ ...p, price: Number(p.price), active: Boolean(p.active) })) });
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const d = await readJson(request);
  const id = safeText(d.id, 32).toUpperCase();
  const name = safeText(d.name, 100);
  const price = Number(d.price);
  const description = safeText(d.description, 500);
  const icon = safeText(d.icon, 12) || '✦';
  const tag = safeText(d.tag, 40) || 'Store';
  const note = safeText(d.note, 300);
  const active = d.active === false || d.active === 0 || d.active === '0' ? 0 : 1;
  if (!/^[A-Z0-9_]{2,32}$/.test(id)) return fail('ID produk hanya boleh huruf besar, angka, dan garis bawah.');
  if (!name || !Number.isSafeInteger(price) || price < 0 || price > 2000000000) return fail('Nama atau harga produk tidak valid.');
  const now = new Date().toISOString();
  const previous = await env.DB.prepare('SELECT id FROM store_products WHERE id = ?').bind(id).first();
  await env.DB.prepare(`INSERT INTO store_products (id,name,price,description,icon,tag,note,active,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,price=excluded.price,description=excluded.description,icon=excluded.icon,tag=excluded.tag,note=excluded.note,active=excluded.active,updated_at=excluded.updated_at`)
    .bind(id,name,price,description,icon,tag,note,active,now,now).run();
  await logAdminActivity(env.DB, previous ? 'product_updated' : 'product_created', 'product', id, { name, price, active: Boolean(active) });
  return json({ ok: true, product: { id,name,price,description,icon,tag,note,active: Boolean(active),updated_at: now } });
}
