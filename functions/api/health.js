import { json, resolveAdminSecrets, resolveTicketLinkSecret } from '../_lib/common.js';
import { ensureStoreSchema } from '../_lib/store-schema.js';

const requiredTables = [
  'orders', 'reviews', 'review_replies', 'store_products', 'promo_codes',
  'admin_activity', 'support_tickets', 'announcements', 'reentry_tickets',
  'finance_entries', 'admin_notes', 'site_content', 'admin_auth_attempts'
];

function secretDiagnostics(env) {
  const adminInfo = resolveAdminSecrets(env);
  const ticketInfo = resolveTicketLinkSecret(env);
  return {
    ownerSecretConfigured: adminInfo.ownerConfigured,
    ownerSecretFormatValid: adminInfo.ownerSecretFormatValid,
    ownerSecretSource: adminInfo.ownerSource,
    adminSecretConfigured: adminInfo.adminConfigured,
    adminSecretFormatValid: adminInfo.adminSecretFormatValid,
    adminSecretSource: adminInfo.adminSource,
    secretsDistinct: adminInfo.secretsDistinct,
    ticketLinkSecretConfigured: ticketInfo.configured,
    ticketLinkSecretFormatValid: ticketInfo.formatValid,
    ticketLinkSecretDistinct: ticketInfo.distinct,
    ticketLinkSecretSource: ticketInfo.source,
    adminReady: adminInfo.ready,
    reentryReady: ticketInfo.ready
  };
}
export async function onRequestGet({ env }) {
  const secrets = secretDiagnostics(env);
  if (!env.DB || typeof env.DB.prepare !== 'function') {
    return json({
      ok: false,
      database: 'not_bound',
      schema: 'not_checked',
      ...secrets,
      error: 'Binding D1 DB tidak tersedia pada environment ini. Periksa binding Production/Preview di Cloudflare Pages.'
    }, 503);
  }

  let connected = false;
  try {
    await env.DB.prepare('SELECT 1 AS connected').first();
    connected = true;
  } catch (error) {
    console.error('SLF D1 connection probe failed:', error?.message || error);
    return json({
      ok: false,
      database: 'query_failed',
      schema: 'not_checked',
      ...secrets,
      error: 'Binding DB ada, tetapi query koneksi gagal. Cocokkan database ID dengan D1 yang benar dan periksa Logs deployment.'
    }, 503);
  }

  try {
    // Health is intentionally independent of the global API middleware so schema
    // initialization failures can be reported here instead of hidden by its generic 503.
    await ensureStoreSchema(env.DB);
    const { results = [] } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('orders','reviews','review_replies','store_products','promo_codes','admin_activity','support_tickets','announcements','reentry_tickets','finance_entries','admin_notes','site_content','admin_auth_attempts') ORDER BY name"
    ).all();
    const tables = results.map(row => row.name);
    const missing = requiredTables.filter(name => !tables.includes(name));
    const schema = missing.length ? 'incomplete' : 'ready';

    return json({
      ok: missing.length === 0,
      database: 'connected',
      schema,
      tables,
      requiredTables,
      missing,
      adminAuthTablePresent: tables.includes('admin_auth_attempts'),
      ...secrets
    }, missing.length ? 503 : 200);
  } catch (error) {
    const diagnostic = String(error?.message || error || 'unknown schema error').replace(/[\\r\\n]/g, ' ').slice(0, 240);
    const match = diagnostic.match(/^SLF_SCHEMA_STEP:([^:]+):(.*)$/);
    const schemaStep = match ? match[1] : (diagnostic.startsWith('column-migration:') ? 'legacy-column-migration' : 'migration-or-seed');
    console.error('SLF D1 schema health check failed [' + schemaStep + ']:', diagnostic);
    return json({
      ok: false,
      database: connected ? 'connected' : 'query_failed',
      schema: 'initialization_failed',
      schemaStep,
      schemaDiagnostic: diagnostic,
      ...secrets,
      error: 'D1 terhubung, tetapi inisialisasi tabel gagal pada tahap ' + schemaStep + '. Buka detail pemeriksaan untuk melihat diagnosis aman.'
    }, 503);
  }
}
