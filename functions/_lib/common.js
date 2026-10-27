export const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
export const fail = (message, status = 400) => json({ error: message }, status);
export async function readJson(request) {
  try { return await request.json(); } catch { throw new Error('Format permintaan tidak valid.'); }
}
export async function sha256Hex(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function hmacSha256Hex(secret, value) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('TICKET_LINK_SECRET belum dikonfigurasi dengan benar.');
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
  return [...signature].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function randomHex(length = 16) {
  const bytes = new Uint8Array(Math.ceil(length / 2)); crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, length);
}
export function danaTimestamp() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, '+07:00');
}
function pemBytes(pem) {
  const base64 = pem.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '').replace(/\s/g, '');
  const binary = atob(base64); return Uint8Array.from(binary, c => c.charCodeAt(0));
}
export async function rsaSign(privatePem, message) {
  const key = await crypto.subtle.importKey('pkcs8', pemBytes(privatePem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(message)));
  let bin = ''; for (const b of sig) bin += String.fromCharCode(b); return btoa(bin);
}
export async function rsaVerify(publicPem, message, signatureBase64) {
  if (!publicPem || !signatureBase64) return false;
  try {
    const key = await crypto.subtle.importKey('spki', pemBytes(publicPem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const raw = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, raw, new TextEncoder().encode(message));
  } catch { return false; }
}
export function safeText(value, max = 200) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
export function currency(n) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0); }
let adminAuthSchemaPromise;
async function ensureAdminAuthTable(db) {
  if (!adminAuthSchemaPromise) {
    adminAuthSchemaPromise = db.prepare(`CREATE TABLE IF NOT EXISTS admin_auth_attempts (
      ip_hash TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL DEFAULT 0,
      window_started INTEGER NOT NULL,
      blocked_until INTEGER NOT NULL DEFAULT 0
    )`).run().catch(error => { adminAuthSchemaPromise = null; throw error; });
  }
  return adminAuthSchemaPromise;
}
function constantTimeHexEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function adminAuthState(db, request, env) {
  const ownerSecret = typeof env.OWNER_SECRET === 'string' ? env.OWNER_SECRET : '';
  const adminSecret = typeof env.ADMIN_SECRET === 'string' ? env.ADMIN_SECRET : '';
  // Fail closed: separate Owner and Admin credentials are mandatory. No legacy fallback.
  const validSecret = value => typeof value === 'string' && value.length >= 32;
  if (!env.DB || !db || !validSecret(ownerSecret) || !validSecret(adminSecret) || ownerSecret === adminSecret) return null;

  const actual = request.headers.get('authorization') || '';
  if (!actual.startsWith('Bearer ')) return null;
  const supplied = actual.slice(7);
  if (supplied.length < 32 || supplied.length > 512) return null;

  try {
    await ensureAdminAuthTable(db);
    const now = Math.floor(Date.now() / 1000);
    const ipHash = await sha256Hex(request.headers.get('cf-connecting-ip') || 'local-unknown');
    const attempt = await db.prepare('SELECT attempts, window_started, blocked_until FROM admin_auth_attempts WHERE ip_hash = ?').bind(ipHash).first();
    const suppliedHash = await sha256Hex(supplied);
    const ownerMatches = constantTimeHexEqual(suppliedHash, await sha256Hex(ownerSecret));
    const adminMatches = constantTimeHexEqual(suppliedHash, await sha256Hex(adminSecret));

    // Correct credentials can recover access after earlier failed attempts.
    if (ownerMatches || adminMatches) {
      await db.prepare('DELETE FROM admin_auth_attempts WHERE ip_hash = ?').bind(ipHash).run();
      return ownerMatches ? 'owner' : 'admin';
    }

    if (attempt && Number(attempt.blocked_until) > now) return null;
    const attempts = attempt && now - Number(attempt.window_started) < 900 ? Number(attempt.attempts) : 0;
    const windowStarted = attempts ? Number(attempt.window_started) : now;
    const nextAttempts = attempts + 1;
    const blockedUntil = nextAttempts >= 5 ? now + 900 : 0;
    await db.prepare(`INSERT INTO admin_auth_attempts (ip_hash, attempts, window_started, blocked_until)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(ip_hash) DO UPDATE SET attempts=excluded.attempts, window_started=excluded.window_started, blocked_until=excluded.blocked_until`)
      .bind(ipHash, nextAttempts, windowStarted, blockedUntil).run();
    return null;
  } catch (error) {
    console.error('Admin authentication rate-limit check failed:', error?.message || error);
    return null;
  }
}

export async function getAdminRole(request, env) {
  return adminAuthState(env.DB, request, env);
}

export async function requireAdmin(request, env) {
  return Boolean(await getAdminRole(request, env));
}

export async function requireOwner(request, env) {
  return (await getAdminRole(request, env)) === 'owner';
}
export async function notifyAdmin(env, order, orderUrl) {
  if (!env.WA_ACCESS_TOKEN || !env.WA_PHONE_NUMBER_ID || !env.WA_ADMIN_TO) return;
  const apiVersion = env.WHATSAPP_API_VERSION || 'v23.0';
  const endpoint = `https://graph.facebook.com/${apiVersion}/${env.WA_PHONE_NUMBER_ID}/messages`;
  const bodyText = `SLF STORE — ${order.status === 'PAID' ? 'PEMBAYARAN BERHASIL' : 'PESANAN BARU'}\nNomor: ${order.id}\nPemain: ${order.minecraft_name} (${order.platform})\nProduk: ${order.product_name}\nTotal: ${currency(order.total)}\nStatus: ${order.status}\nDetail/admin: ${orderUrl}`;
  let message;
  if (env.WA_TEMPLATE_NAME) {
    // Template harus sudah disetujui Meta dan memiliki tepat 5 placeholder body.
    message = { messaging_product: 'whatsapp', to: env.WA_ADMIN_TO, type: 'template', template: { name: env.WA_TEMPLATE_NAME, language: { code: env.WA_TEMPLATE_LANGUAGE || 'id' }, components: [{ type: 'body', parameters: [{ type: 'text', text: order.id }, { type: 'text', text: `${order.minecraft_name} (${order.platform})` }, { type: 'text', text: order.product_name }, { type: 'text', text: currency(order.total) }, { type: 'text', text: `${order.status} — ${orderUrl}` }] }] } };
  } else {
    // Text message may be rejected outside the 24-hour customer-service window; use an approved template for reliable notifications.
    message = { messaging_product: 'whatsapp', recipient_type: 'individual', to: env.WA_ADMIN_TO, type: 'text', text: { preview_url: false, body: bodyText } };
  }
  const res = await fetch(endpoint, { method: 'POST', headers: { authorization: `Bearer ${env.WA_ACCESS_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(message) });
  if (!res.ok) throw new Error(`WhatsApp API rejected notification (${res.status})`);
}

export async function logAdminActivity(db, action, entityType, entityId, details = {}) {
  if (!db) return;
  try {
    const roleFromDetails = details && ['owner','admin'].includes(details.role) ? details.role : '';
    const ownerOnlyEntities = new Set(['product','promo','finance_entry','investment_plan','site_content']);
    const actor = roleFromDetails || (ownerOnlyEntities.has(String(entityType)) ? 'owner' : 'admin');
    await db.prepare('INSERT INTO admin_activity (actor, action, entity_type, entity_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(actor, String(action).slice(0,80), String(entityType).slice(0,40), entityId ? String(entityId).slice(0,100) : null, JSON.stringify(details).slice(0,2000), new Date().toISOString()).run();
  } catch (error) { console.error('Admin activity log failed:', error?.message || error); }
}

export async function notifySupportAdmin(env, ticket, ticketUrl) {
  if (!env.WA_ACCESS_TOKEN || !env.WA_PHONE_NUMBER_ID || !env.WA_ADMIN_TO) return;
  const apiVersion = env.WHATSAPP_API_VERSION || 'v23.0';
  const endpoint = `https://graph.facebook.com/${apiVersion}/${env.WA_PHONE_NUMBER_ID}/messages`;
  const ticketLink = ticketUrl || '/admin/';
  const bodyText = `SLF SUPPORT — TIKET BARU\nNomor tiket: ${ticket.id}\nPemain: ${ticket.player_name}\nKategori: ${ticket.category}\nSubjek: ${ticket.subject}\nPanel admin: ${ticketLink}`;
  let message;
  if (env.WA_SUPPORT_TEMPLATE_NAME) {
    message = { messaging_product:'whatsapp', to:env.WA_ADMIN_TO, type:'template', template:{
      name:env.WA_SUPPORT_TEMPLATE_NAME, language:{code:env.WA_SUPPORT_TEMPLATE_LANGUAGE || env.WA_TEMPLATE_LANGUAGE || 'id'},
      components:[{type:'body',parameters:[
        {type:'text',text:ticket.id},
        {type:'text',text:ticket.player_name},
        {type:'text',text:ticket.category},
        {type:'text',text:ticket.subject},
        {type:'text',text:`TIKET BARU — ${ticketLink}`}
      ]}]
    }};
  } else {
    message = { messaging_product:'whatsapp', recipient_type:'individual', to:env.WA_ADMIN_TO, type:'text', text:{preview_url:false,body:bodyText} };
  }
  const res = await fetch(endpoint,{method:'POST',headers:{authorization:`Bearer ${env.WA_ACCESS_TOKEN}`,'content-type':'application/json'},body:JSON.stringify(message)});
  if (!res.ok) throw new Error(`WhatsApp API rejected support notification (${res.status})`);
}
