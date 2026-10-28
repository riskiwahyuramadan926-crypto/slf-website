import { json, fail, getAdminRole } from '../../_lib/common.js';

export async function onRequestGet({ request, env }) {
  const ownerSecret = typeof env.OWNER_SECRET === 'string' ? env.OWNER_SECRET : '';
  const adminSecret = typeof env.ADMIN_SECRET === 'string' ? env.ADMIN_SECRET : '';
  const strongSecret = value => typeof value === 'string' && value.length >= 32;

  if (!strongSecret(ownerSecret) || !strongSecret(adminSecret) || ownerSecret === adminSecret) {
    return fail(
      'Login Admin memerlukan OWNER_SECRET dan ADMIN_SECRET yang berbeda, masing-masing minimal 32 karakter acak, di Cloudflare Pages → Settings → Variables and Secrets. TICKET_LINK_SECRET bukan sandi login.',
      503
    );
  }

  const role = await getAdminRole(request, env);
  if (!role) return fail('Akses ditolak. Gunakan OWNER_SECRET untuk Owner atau ADMIN_SECRET untuk staf. TICKET_LINK_SECRET hanya untuk tautan tiket member, bukan untuk login; percobaan salah dibatasi sementara.', 401);

  return json({
    role,
    ownerSecretConfigured: true,
    adminSecretConfigured: true,
    secretsDistinct: true,
    legacyMode: false,
    access: role === 'owner'
      ? ['orders','tickets','reviews','products','promos','customers','reports','activity','support','announcements','finance','notes','site-content','investment','access']
      : ['orders','tickets','reviews','customers','activity','support','announcements','notes']
  });
}