import { json, fail, readJson, requireAdmin, logAdminActivity } from '../../_lib/common.js';

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak. Periksa ADMIN_SECRET.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const data = await readJson(request);
  const id = typeof data.ticketId === 'string' ? data.ticketId.trim() : '';
  const status = typeof data.status === 'string' ? data.status : '';
  if (!id || !['ACTIVE', 'COMPLETED'].includes(status)) return fail('Data status tiket tidak valid.');
  const row = await env.DB.prepare('SELECT id, status FROM reentry_tickets WHERE id = ?').bind(id).first();
  if (!row) return fail('Tiket tidak ditemukan.', 404);
  const allowed = status === 'COMPLETED'
    ? ['PENDING'].includes(row.status)
    : ['PENDING', 'COMPLETED'].includes(row.status);
  if (!allowed) {
    if (row.status === status) return json({ ok: true, status });
    return fail(status === 'COMPLETED' ? 'Tiket harus diajukan member sebelum ditandai selesai.' : 'Tiket ini tidak dapat dikembalikan ke status aktif.', 409);
  }
  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE reentry_tickets SET status = ?, updated_at = ?, completed_at = ? WHERE id = ?')
    .bind(status, now, status === 'COMPLETED' ? now : null, id).run();
  await logAdminActivity(env.DB, status === 'COMPLETED' ? 'reentry_ticket_completed' : 'reentry_ticket_reactivated', 'reentry_ticket', id, { status });
  return json({ ok: true, status });
}
