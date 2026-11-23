import { json, fail, requireAdmin, requireOwner, readJson, safeText, logAdminActivity } from '../../_lib/common.js';

async function ensureSoftDeleteColumn(db){try{await db.prepare('ALTER TABLE orders ADD COLUMN deleted_at TEXT').run();}catch(error){if(!/duplicate column/i.test(String(error?.message||error)))throw error;}}

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak. Periksa ADMIN_SECRET.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  try { await ensureSoftDeleteColumn(env.DB); } catch (error) { console.error('[SLF_ORDERS] deleted_at migration failed:',error?.message||error); return fail('Pembaruan skema soft delete pesanan gagal.',503); }
  const [{ results = [] }, statsRow] = await Promise.all([
    env.DB.prepare(
      'SELECT id, minecraft_name, platform, whatsapp, email, product_id, product_name, details_json, subtotal, discount, total, status, promo_code, created_at, paid_at, completed_at FROM orders WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 500'
    ).all(),
    env.DB.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN status='PENDING_PAYMENT' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status='PAID' THEN 1 ELSE 0 END) AS paid,
      SUM(CASE WHEN status='PROCESSING' THEN 1 ELSE 0 END) AS processing,
      SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status IN ('CANCELLED','EXPIRED') THEN 1 ELSE 0 END) AS cancelled,
      SUM(CASE WHEN status IN ('PAID','PROCESSING','COMPLETED') THEN total ELSE 0 END) AS revenue,
      SUM(CASE WHEN date(created_at)=date('now') THEN 1 ELSE 0 END) AS today
      FROM orders WHERE deleted_at IS NULL`).first()
  ]);
  const orders = results.map(r => ({ ...r, details: (() => { try { return JSON.parse(r.details_json || '{}'); } catch { return {}; } })() }));
  const stats = Object.fromEntries(Object.entries(statsRow || {}).map(([key, value]) => [key, Number(value || 0)]));
  return json({ orders, stats, generatedAt: new Date().toISOString(), ordersLimit: 500 });
}


export async function onRequestPost({request,env}) {
  if(!(await requireOwner(request,env)))return fail('Hapus transaksi hanya dapat dilakukan Owner.',403);
  if(!env.DB)return fail('Database belum tersambung.',503);
  try{await ensureSoftDeleteColumn(env.DB);}catch(error){return fail('Pembaruan skema soft delete gagal.',503);}
  const d=await readJson(request),id=safeText(d.id,80);
  if(!id||d.action!=='soft-delete')return fail('ID dan aksi soft-delete wajib diisi.');
  const existing=await env.DB.prepare('SELECT id,status,deleted_at FROM orders WHERE id=?').bind(id).first();
  if(!existing)return fail('Transaksi tidak ditemukan.',404);
  if(existing.deleted_at)return json({ok:true,id,deleted:true});
  const now=new Date().toISOString();
  await env.DB.prepare('UPDATE orders SET deleted_at=?,updated_at=? WHERE id=? AND deleted_at IS NULL').bind(now,now,id).run();
  await logAdminActivity(env.DB,'order_soft_deleted','order',id,{role:'owner',status:existing.status});
  return json({ok:true,id,deleted:true,deletedAt:now});
}
