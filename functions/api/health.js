import { json, fail } from '../_lib/common.js';

export async function onRequestGet({env}) {
  const secret = typeof env.ADMIN_SECRET === 'string' ? env.ADMIN_SECRET : '';
  const adminSecretConfigured = secret.length > 0;
  const adminSecretFormatValid = secret.length >= 32 || /^\\d{6}$/.test(secret);

  if (!env.DB) {
    return json({
      ok: false,
      database: 'not_bound',
      adminSecretConfigured,
      adminSecretFormatValid,
      error: 'D1 belum terhubung dengan binding DB.'
    }, 503);
  }

  try {
    const {results=[]}=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('orders','reviews','review_replies','store_products','promo_codes','admin_activity','support_tickets','announcements','admin_auth_attempts') ORDER BY name").all();
    const tables=results.map(r=>r.name);
    const required=['orders','reviews','review_replies','store_products','promo_codes','admin_activity','support_tickets','announcements'];
    const missing=required.filter(n=>!tables.includes(n));
    const result = {
      ok: missing.length === 0,
      database: 'connected',
      tables,
      missing,
      adminSecretConfigured,
      adminSecretFormatValid,
      adminAuthTablePresent: tables.includes('admin_auth_attempts')
    };
    return json(result, missing.length ? 503 : 200);
  } catch {
    return json({
      ok: false,
      database: 'query_failed',
      adminSecretConfigured,
      adminSecretFormatValid,
      error: 'D1 terikat, tetapi query gagal. Periksa database_id di wrangler.toml dan log deployment.'
    }, 503);
  }
}
