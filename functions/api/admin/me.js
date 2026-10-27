import { json, fail, getAdminRole } from '../../_lib/common.js';

export async function onRequestGet({ request, env }) {
  const role = await getAdminRole(request, env);
  if (!role) return fail('Akses admin ditolak. Periksa rahasia Owner/Admin.', 401);
  const ownerSecretConfigured = typeof env.OWNER_SECRET === 'string' && env.OWNER_SECRET.length > 0;
  return json({
    role,
    ownerSecretConfigured,
    legacyMode: !ownerSecretConfigured,
    access: role === 'owner'
      ? ['orders','tickets','reviews','products','promos','customers','reports','activity','support','announcements','finance','notes','site-content','investment','access']
      : ['orders','tickets','reviews','customers','activity','support','announcements','notes']
  });
}