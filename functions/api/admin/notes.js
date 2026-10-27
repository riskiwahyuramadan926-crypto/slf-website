import { json, fail, readJson, requireAdmin, getAdminRole, safeText, randomHex, logAdminActivity } from '../../_lib/common.js';

export async function onRequestGet({ request, env }) {
  const role = await getAdminRole(request, env);
  if (!role) return fail('Akses admin ditolak.', 401);
  const { results = [] } = await env.DB.prepare(
    'SELECT id,title,body,category,priority,status,created_by,created_at,updated_at FROM admin_notes ORDER BY CASE status WHEN \'OPEN\' THEN 0 ELSE 1 END, CASE priority WHEN \'HIGH\' THEN 0 WHEN \'MEDIUM\' THEN 1 ELSE 2 END, updated_at DESC LIMIT 300'
  ).all();
  return json({ notes: results, role });
}

export async function onRequestPost({ request, env }) {
  const role = await getAdminRole(request, env);
  if (!role) return fail('Akses admin ditolak.', 401);
  const d = await readJson(request);
  const id = safeText(d.id, 60);
  const status = ['OPEN','DONE'].includes(d.status) ? d.status : '';
  const now = new Date().toISOString();

  if (id && status) {
    const row = await env.DB.prepare('SELECT id,created_by FROM admin_notes WHERE id=?').bind(id).first();
    if (!row) return fail('Catatan tidak ditemukan.', 404);
    if (role !== 'owner' && row.created_by !== 'admin') return fail('Admin hanya boleh memperbarui catatan yang dibuat oleh Admin.', 403);
    await env.DB.prepare('UPDATE admin_notes SET status=?,updated_at=? WHERE id=?').bind(status,now,id).run();
    await logAdminActivity(env.DB, 'admin_note_status_changed', 'admin_note', id, { status, role });
    return json({ ok:true, id, status });
  }

  const title = safeText(d.title,120);
  const body = safeText(d.body,2000);
  const category = safeText(d.category,40) || 'Operasional';
  const priority = ['LOW','MEDIUM','HIGH'].includes(d.priority) ? d.priority : 'MEDIUM';
  if (title.length < 3 || body.length < 3) return fail('Judul dan isi catatan minimal 3 karakter.');
  const noteId = 'NOTE-' + randomHex(8).toUpperCase();
  const actor = role === 'owner' ? 'owner' : 'admin';
  await env.DB.prepare('INSERT INTO admin_notes (id,title,body,category,priority,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,\'OPEN\',?,?,?)')
    .bind(noteId,title,body,category,priority,actor,now,now).run();
  await logAdminActivity(env.DB, 'admin_note_created', 'admin_note', noteId, { title, category, priority, role });
  return json({ ok:true, id:noteId, status:'OPEN' });
}