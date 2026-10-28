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

  let role;
  try {
    role = await getAdminRole(request, env);
  } catch (error) {
    console.error('Admin login verification failed:', error?.message || error);
    if (error?.code === 'ADMIN_AUTH_STORAGE_UNAVAILABLE') {
      return fail('Database terdeteksi, tetapi penyimpanan autentikasi Admin gagal dibaca. Ini bukan indikasi kode akses salah; periksa Logs deployment dan tabel admin_auth_attempts.', 503);
    }
    return fail('Verifikasi login Admin gagal karena masalah penyimpanan database. Periksa koneksi D1 dan Logs deployment.', 503);
  }
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