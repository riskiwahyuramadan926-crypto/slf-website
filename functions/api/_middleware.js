import { ensureStoreSchema } from '../_lib/store-schema.js';

export async function onRequest(context) {
  const { env, request } = context;
  // Static FAQ chat must remain available even while D1 is unavailable.
  const pathname = new URL(request.url).pathname;
  // Keep diagnostics reachable even when the shared schema bootstrap fails.
  // The health handler performs its own connection + schema checks and returns the actual failure stage.
  // Keep health and credential verification reachable during D1/schema incidents.
  // Store data endpoints remain protected by the normal database/schema gate.
  if (pathname === '/api/support/chat' || pathname === '/api/health' || pathname === '/api/admin/me') return context.next();
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
    const diagnostic = String(error?.message || error || 'unknown schema error').replace(/[\r\n]/g, ' ').slice(0, 240);
    const match = diagnostic.match(/^SLF_SCHEMA_STEP:([^:]+):(.*)$/);
    const stage = match ? match[1] : (diagnostic.startsWith('column-migration:') ? 'legacy-column-migration' : 'migration-or-seed');
    console.error('SLF Store database initialization failed [' + stage + ']:', diagnostic);

    // If an optional/legacy schema migration fails, keep the password-protected
    // order dashboard usable when its existing orders table is still readable.
    // The handler still checks the supplied Admin/Owner credential itself.
    if (pathname === '/api/admin/orders') {
      return context.next();
    }

    return new Response(JSON.stringify({
      error: 'Database terhubung tetapi persiapan skema Store gagal.',
      schemaStep: stage,
      schemaDiagnostic: diagnostic
    }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  return context.next();
}
