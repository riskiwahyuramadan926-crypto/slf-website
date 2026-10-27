import { json, fail, getAdminRole } from '../../_lib/common.js';

export async function onRequestGet({ request, env }) {
  const ownerSecret = typeof env.OWNER_SECRET === 'string' ? env.OWNER_SECRET : '';
  const adminSecret = typeof env.ADMIN_SECRET === 'string' ? env.ADMIN_SECRET : '';
  if (ownerSecret && adminSecret && ownerSecret === adminSecret) return fail('Konfigurasi akses salah: OWNER_SECRET dan ADMIN_SECRET harus berbeda. Perbaiki di Cloudflare agar akses Owner/Admin bisa dipisah.', 503);
  const role = await getAdminRole(request, env);
  if (!role) return fail('Akses admin ditolak. Periksa rahasia Owner/Admin.', 401);
  const ownerSecretConfigured = typeof env.OWNER_SECRET === 'string' && env.OWNER_SECRET.length > 0;
  const adminSecretConfigured = typeof env.ADMIN_SECRET === 'string' && env.ADMIN_SECRET.length > 0;
  const secretsDistinct = !ownerSecretConfigured || !adminSecretConfigured || env.OWNER_SECRET !== env.ADMIN_SECRET;
  return json({
    role,
    ownerSecretConfigured,
    adminSecretConfigured,
    secretsDistinct,
    legacyMode: !ownerSecretConfigured,
    access: role === 'owner'
      ? ['orders','tickets','reviews','products','promos','customers','reports','activity','support','announcements','finance','notes','site-content','investment','access']
      : ['orders','tickets','reviews','customers','activity','support','announcements','notes']
  });
}