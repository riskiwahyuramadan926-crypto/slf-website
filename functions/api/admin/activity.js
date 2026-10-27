import { json, fail, getAdminRole } from '../../_lib/common.js';

export async function onRequestGet({ request, env }) {
  const role = await getAdminRole(request, env);
  if (!role) return fail('Akses admin ditolak.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);

  // Owner audit detail can include financial amounts and plan parameters; keep it out of the Admin view.
  const query = role === 'owner'
    ? 'SELECT id,actor,action,entity_type,entity_id,details_json,created_at FROM admin_activity ORDER BY id DESC LIMIT 300'
    : "SELECT id,actor,action,entity_type,entity_id,details_json,created_at FROM admin_activity WHERE entity_type NOT IN ('finance_entry','investment_plan','product','promo','site_content') ORDER BY id DESC LIMIT 300";
  const { results = [] } = await env.DB.prepare(query).all();
  return json({ activities: results.map(a => { let details={}; try { details=JSON.parse(a.details_json||'{}'); } catch {} return {...a,details}; }) });
}