import { json, fail, readJson, sha256Hex } from '../../_lib/common.js';

export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';
  if (key.length < 32) return fail('Tautan tiket tidak valid.', 403);
  const row = await env.DB.prepare(
    'SELECT t.id, t.order_id, t.access_key_hash, t.minecraft_name, t.product_name, t.status, t.created_at, t.updated_at, t.submitted_at, t.completed_at, o.status AS order_status FROM reentry_tickets t JOIN orders o ON o.id = t.order_id WHERE t.id = ?'
  ).bind(params.id).first();
  if (!row || await sha256Hex(key) !== row.access_key_hash) return fail('Tiket tidak ditemukan atau tautan akses tidak valid.', 404);
  return json({ ticket: {
    id: row.id, orderId: row.order_id, minecraftName: row.minecraft_name, productName: row.product_name,
    status: row.status, orderStatus: row.order_status, createdAt: row.created_at, updatedAt: row.updated_at,
    submittedAt: row.submitted_at, completedAt: row.completed_at
  }});
}

export async function onRequestPost({ request, env, params }) {
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const data = await readJson(request);
  const key = typeof data.key === 'string' ? data.key : '';
  if (key.length < 32) return fail('Tautan tiket tidak valid.', 403);
  const row = await env.DB.prepare(
    'SELECT t.id, t.access_key_hash, t.status, o.status AS order_status FROM reentry_tickets t JOIN orders o ON o.id = t.order_id WHERE t.id = ?'
  ).bind(params.id).first();
  if (!row || await sha256Hex(key) !== row.access_key_hash) return fail('Tiket tidak ditemukan atau tautan akses tidak valid.', 404);
  if (row.status !== 'ACTIVE' || row.order_status !== 'COMPLETED') {
    if (row.status === 'PENDING') return json({ ok: true, status: 'PENDING' });
    return fail('Tiket belum aktif atau sudah digunakan. Tiket hanya bisa diajukan saat statusnya Aktif.', 409);
  }
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    "UPDATE reentry_tickets SET status = 'PENDING', submitted_at = ?, updated_at = ? WHERE id = ? AND status = 'ACTIVE'"
  ).bind(now, now, params.id).run();
  if (!result.meta?.changes) return fail('Tiket baru saja berubah status. Muat ulang halaman.', 409);
  return json({ ok: true, status: 'PENDING' });
}
