import { json, fail, getAdminRole, resolveAdminSecrets } from '../../_lib/common.js';

export async function onRequestGet({ request, env }) {
  const credentials = resolveAdminSecrets(env);

  if (!credentials.ready) {
    return fail(
      'Login memerlukan kode Owner dan Admin yang berbeda, masing-masing minimal 32 karakter. Source menerima OWNER_SECRET/OWNER_CODE/OWNER_LOGIN_CODE dan ADMIN_SECRET/ADMIN_CODE/ADMIN_LOGIN_CODE. TICKET_LINK_SECRET/TICKET_CODE hanya untuk tiket, bukan login.',
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