export const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
export const fail = (message, status = 400) => json({ error: message }, status);
export async function readJson(request) {
  try { return await request.json(); } catch { throw new Error('Format permintaan tidak valid.'); }
}
export async function sha256Hex(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
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
export async function requireAdmin(request, env) {
  const expected = env.ADMIN_SECRET;
  if (!expected || expected.length < 32) return false;
  const actual = request.headers.get('authorization') || '';
  if (!actual.startsWith('Bearer ')) return false;
  const a = actual.slice(7);
  // Constant-work hash comparison avoids comparing secret text directly.
  return (await sha256Hex(a)) === (await sha256Hex(expected));
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
    await db.prepare('INSERT INTO admin_activity (actor, action, entity_type, entity_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind('admin', String(action).slice(0,80), String(entityType).slice(0,40), entityId ? String(entityId).slice(0,100) : null, JSON.stringify(details).slice(0,2000), new Date().toISOString()).run();
  } catch (error) { console.error('Admin activity log failed:', error?.message || error); }
}
