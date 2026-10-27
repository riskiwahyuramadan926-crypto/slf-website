import { ensureStoreSchema } from '../_lib/store-schema.js';

export async function onRequest(context) {
  const { env, request } = context;
  // Static FAQ chat must remain available even while D1 is unavailable.
  if (new URL(request.url).pathname === '/api/support/chat') return context.next();
  if (!env.DB) {
    return new Response(JSON.stringify({
      error: 'Database Store belum terikat. Binding Cloudflare D1 harus bernama DB.'
    }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  try {
    await ensureStoreSchema(env.DB);
  } catch (error) {
    console.error('SLF Store database initialization failed:', error?.message || error);
    return new Response(JSON.stringify({
      error: 'Database terdeteksi tetapi tabel Store gagal disiapkan. Periksa binding dan hak akses D1.'
    }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  return context.next();
}
