import { json, fail, requireAdmin } from '../../_lib/common.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);
  const { results = [] } = await env.DB.prepare('SELECT id,actor,action,entity_type,entity_id,details_json,created_at FROM admin_activity ORDER BY id DESC LIMIT 300').all();
  return json({ activities: results.map(a => { let details={}; try { details=JSON.parse(a.details_json||'{}'); } catch {} return {...a,details}; }) });
}
