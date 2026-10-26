import { json, fail, readJson, sha256Hex, randomHex, danaTimestamp, rsaSign, safeText, notifyAdmin } from '../../_lib/common.js';
import { calculatePrice, RANK_COLORS, RANK_STYLES } from '../../_lib/catalog.js';

async function createDanaQr(env, partnerReferenceNo, total, now) {
  const required = ['DANA_API_BASE','DANA_PARTNER_ID','DANA_MERCHANT_ID','DANA_STORE_ID','DANA_PRIVATE_KEY_PEM','DANA_CHANNEL_ID','DANA_ORIGIN'];
  const missing = required.filter(k => !env[k]);
  if (missing.length) throw new Error('Pembayaran belum aktif: konfigurasi DANA belum lengkap (' + missing.join(', ') + ').');
  const path = '/v1.0/qr/qr-mpm-generate.htm';
  const timestamp = danaTimestamp();
  const expires = new Date(Date.now() + 15 * 60 * 1000 + 7 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, '+07:00');
  const body = {
    merchantId: env.DANA_MERCHANT_ID,
    partnerReferenceNo,
    amount: { value: Number(total).toFixed(2), currency: 'IDR' },
    storeId: env.DANA_STORE_ID,
    validityPeriod: expires,
    additionalInfo: { terminalSource: 'MER', envInfo: { terminalType: 'SYSTEM', orderTerminalType: 'WEB', websiteLanguage: 'id-ID', sourcePlatform: 'IPG' } }
  };
  const bodyText = JSON.stringify(body);
  const bodyHash = await sha256Hex(bodyText);
  const signingText = `POST:${path}:${bodyHash}:${timestamp}`;
  const signature = await rsaSign(env.DANA_PRIVATE_KEY_PEM, signingText);
  const externalId = partnerReferenceNo.slice(0, 36);
  const res = await fetch(new URL(path, env.DANA_API_BASE), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-timestamp': timestamp, 'x-signature': signature, origin: env.DANA_ORIGIN, 'x-partner-id': env.DANA_PARTNER_ID, 'x-external-id': externalId, 'channel-id': env.DANA_CHANNEL_ID },
    body: bodyText
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.responseCode !== '2004700' || !(data.qrContent || data.qrImage || data.qrUrl)) {
    // Don't expose credentials or raw partner response to visitors; log only the DANA response code.
    console.error('DANA QRIS creation failed', { httpStatus: res.status, responseCode: data.responseCode, responseMessage: data.responseMessage });
    throw new Error('DANA belum berhasil membuat QRIS. Pesanan belum dibuat; periksa kredensial, parameter merchant, dan log API DANA.');
  }
  return { qrContent: data.qrContent || null, qrImage: data.qrImage || null, qrUrl: data.qrUrl || null, expiresAt: expires, danaReferenceNo: data.referenceNo || null };
}

export async function onRequestPost({ request, env, waitUntil }) {
  try {
    if (!env.DB) return fail('Database Store belum tersambung. Hubungkan Cloudflare D1 dengan binding bernama DB.', 503);
    const data = await readJson(request);
    if (!data.agree) return fail('Centang persetujuan sebelum membuat pesanan.');
    const minecraftName = safeText(data.minecraftName, 32);
    const platform = data.platform === 'Java' || data.platform === 'Bedrock' ? data.platform : '';
    const whatsapp = safeText(data.whatsapp, 20).replace(/[\s()-]/g, '');
    const email = safeText(data.email, 254);
    const promoCode = safeText(data.promoCode, 32).toUpperCase();
    if (minecraftName.length < 2 || !platform) return fail('Nama Minecraft dan platform wajib diisi.');
    if (!/^[.]?[A-Za-z0-9_]{2,31}$/.test(minecraftName)) return fail('Nama Minecraft tidak sesuai format. Gunakan huruf, angka, garis bawah, dan awalan titik bila diperlukan.');
    if (!/^\+?[0-9]{8,16}$/.test(whatsapp)) return fail('Nomor WhatsApp tidak valid. Gunakan kode negara, contoh 62812xxxxxxx.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Format email tidak valid.');
    if (['CUSTOM_RANK', 'VIP_PLUS'].includes(data.productId)) {
  const d = data.details || {};
  const rankName = safeText(d.rankName, 16);

  if (!/^[A-Za-z0-9_ -]{2,16}$/.test(rankName))
    return fail('Nama Custom Rank wajib 2–16 karakter.');

  if (!RANK_COLORS.has(String(d.rankColor || '').toUpperCase()))
    return fail('Warna rank tidak valid.');

  if (!RANK_STYLES.has(d.rankStyle))
    return fail('Gaya tulisan tidak valid.');
}
    }
    let pricing;
    try { pricing = calculatePrice(data.productId, promoCode, env); } catch (e) { return fail(e.message || 'Produk/promo tidak valid.'); }
    if (pricing.total < 1000) return fail('Total pembayaran terlalu kecil.');
    const now = new Date().toISOString();
    const id = `SLF-${now.slice(2,10).replaceAll('-','')}-${randomHex(6).toUpperCase()}`;
    const partnerReferenceNo = `SLF${now.slice(2,10).replaceAll('-','')}${randomHex(10).toUpperCase()}`.slice(0, 25);
    const token = randomHex(40) + randomHex(24);
    const tokenHash = await sha256Hex(token);
    const details = ['CUSTOM_RANK', 'VIP_PLUS'].includes(data.productId)
  ? {
      rankName: safeText(data.details?.rankName, 16),
      rankColor: String(data.details?.rankColor || '').toUpperCase(),
      rankStyle: safeText(data.details?.rankStyle, 20),
      buyerNote: data.productId === 'VIP_PLUS'
        ? safeText(data.details?.buyerNote, 400)
        : ''
    }
  : {
      buyerNote: safeText(data.details?.buyerNote, 400)
    };
    const qr = await createDanaQr(env, partnerReferenceNo, pricing.total, now);
    await env.DB.prepare(`INSERT INTO orders (id, access_key_hash, minecraft_name, platform, whatsapp, email, product_id, product_name, details_json, promo_code, subtotal, discount, total, status, partner_reference_no, dana_reference_no, qr_content, qr_image, qr_url, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_PAYMENT', ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, tokenHash, minecraftName, platform, whatsapp, email || null, data.productId, pricing.product.name, JSON.stringify(details), promoCode || null, pricing.subtotal, pricing.discount, pricing.total, partnerReferenceNo, qr.danaReferenceNo, qr.qrContent, qr.qrImage, qr.qrUrl, qr.expiresAt, now, now).run();
    const orderUrl = `${new URL('/store/order.html', request.url).origin}/store/order.html?id=${encodeURIComponent(id)}&key=${encodeURIComponent(token)}`;
    const adminUrl = `${new URL('/admin/', request.url).origin}/admin/?order=${encodeURIComponent(id)}`;
    const order = { id, minecraft_name: minecraftName, platform, product_name: pricing.product.name, total: pricing.total, status: 'PENDING_PAYMENT' };
    if (waitUntil) waitUntil(notifyAdmin(env, order, adminUrl).catch(e => console.error('WhatsApp order notification failed', e.message)));
    return json({ orderId: id, orderUrl, total: pricing.total, subtotal: pricing.subtotal, discount: pricing.discount, expiresAt: qr.expiresAt });
  } catch (e) {
    console.error('Order creation failed', e?.message || e);
    const message = e?.message || 'Server gagal membuat pesanan.';
    return fail(message.includes('konfigurasi DANA') || message.includes('DANA belum') ? message : 'Server belum dapat membuat pesanan. Pastikan database, secret, dan konfigurasi DANA benar.', 503);
  }
}
