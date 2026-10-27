import { json, fail, readJson, requireAdmin, safeText, logAdminActivity } from '../../_lib/common.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const { results = [] } = await env.DB.prepare(`SELECT p.code,p.type,p.value,p.active,p.expires_at,p.max_uses,p.created_at,p.updated_at,
    (SELECT COUNT(*) FROM orders o WHERE o.promo_code=p.code AND o.status IN ('PAID','PROCESSING','COMPLETED')) AS uses
    FROM promo_codes p ORDER BY p.created_at DESC`).all();
  return json({ promos: results.map(p => ({ ...p, value: Number(p.value), active: Boolean(p.active), uses: Number(p.uses) })) });
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const d = await readJson(request);
  const code = safeText(d.code, 32).toUpperCase();
  const type = d.type === 'fixed' ? 'fixed' : d.type === 'percent' ? 'percent' : '';
  const value = Number(d.value);
  const active = d.active === false || d.active === 0 || d.active === '0' ? 0 : 1;
  const expiresAt = safeText(d.expiresAt, 40) || null;
  const maxUses = d.maxUses === '' || d.maxUses === null || d.maxUses === undefined ? null : Number(d.maxUses);
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return fail('Kode promo harus 3–32 karakter: huruf, angka, _ atau -.');
  if (!type || !Number.isFinite(value) || value <= 0 || (type === 'percent' && value > 100)) return fail('Jenis atau nilai promo tidak valid.');
  if (maxUses !== null && (!Number.isSafeInteger(maxUses) || maxUses < 1 || maxUses > 1000000)) return fail('Batas penggunaan harus bilangan bulat positif.');
  if (expiresAt && !Number.isFinite(Date.parse(expiresAt))) return fail('Tanggal kedaluwarsa tidak valid.');
  const now = new Date().toISOString();
  const previous = await env.DB.prepare('SELECT code FROM promo_codes WHERE code=?').bind(code).first();
  await env.DB.prepare(`INSERT INTO promo_codes (code,type,value,active,expires_at,max_uses,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET type=excluded.type,value=excluded.value,active=excluded.active,expires_at=excluded.expires_at,max_uses=excluded.max_uses,updated_at=excluded.updated_at`)
    .bind(code,type,value,active,expiresAt,maxUses,now,now).run();
  await logAdminActivity(env.DB, previous ? 'promo_updated' : 'promo_created', 'promo', code, { type,value,active: Boolean(active),maxUses });
  return json({ ok: true, code, type, value, active: Boolean(active), expires_at: expiresAt, max_uses: maxUses, updated_at: now });
}
