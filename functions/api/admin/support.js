import { json, fail, readJson, requireAdmin, safeText, logAdminActivity } from '../../_lib/common.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const { results = [] } = await env.DB.prepare('SELECT id,player_name,contact,category,subject,message,status,admin_reply,created_at,updated_at,resolved_at FROM support_tickets ORDER BY CASE status WHEN \'OPEN\' THEN 0 WHEN \'IN_PROGRESS\' THEN 1 ELSE 2 END, created_at DESC LIMIT 300').all();
  return json({ tickets:results });
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const d = await readJson(request);
  const id = safeText(d.id, 50);
  const status = ['OPEN','IN_PROGRESS','WAITING_PLAYER','RESOLVED','CLOSED'].includes(d.status) ? d.status : '';
  const reply = safeText(d.reply, 1500);
  if (!id || !status) return fail('Tiket atau status tidak valid.');
  const now = new Date().toISOString();
  const result = await env.DB.prepare('UPDATE support_tickets SET status=?,admin_reply=?,updated_at=?,resolved_at=? WHERE id=?')
    .bind(status,reply || null,now,['RESOLVED','CLOSED'].includes(status)?now:null,id).run();
  if (!result.meta?.changes) return fail('Tiket tidak ditemukan.',404);
  await logAdminActivity(env.DB,'support_ticket_updated','ticket',id,{status,hasReply:Boolean(reply)});
  return json({ok:true,id,status,updated_at:now});
}
