import { json, fail, readJson, sha256Hex, hmacSha256Hex, randomHex, safeText, notifyAdmin, resolveTicketLinkSecret, encryptOrderAccessKey } from '../../_lib/common.js';
import { calculatePrice, RANK_COLORS, RANK_STYLES } from '../../_lib/catalog.js';
import { ensureStoreSchema } from '../../_lib/store-schema.js';

export async function onRequestPost({ request, env }) {
  let stage = 'database-binding';
  try {
    if (!env.DB) return fail('Database Store belum tersambung. Binding harus bernama DB.', 503);
    stage = 'store-schema';
    await ensureStoreSchema(env.DB);
    stage = 'request-validation';
    const data = await readJson(request);
    if (!data.agree) return fail('Centang persetujuan sebelum membuat pesanan.');
    const isReentryProduct = ['REENTRY_1','REENTRY_2','REENTRY_3'].includes(data.productId);
    if (isReentryProduct && !resolveTicketLinkSecret(env).ready) {
      return fail('Checkout tiket sementara dinonaktifkan demi keamanan tautan pribadi. Owner perlu mengatur secret tiket minimal 32 karakter yang berbeda dari OWNER_SECRET/ADMIN_SECRET. Nama yang disarankan TICKET_LINK_SECRET; TICKET_SECRET juga diterima sebagai alias lama.', 503);
    }
    const minecraftName = safeText(data.minecraftName, 32);
    const platform = ['Java', 'Bedrock'].includes(data.platform) ? data.platform : '';
    const whatsapp = safeText(data.whatsapp, 20).replace(/[\s()-]/g, '');
    const email = safeText(data.email, 254);
    const promoCode = safeText(data.promoCode, 32).toUpperCase();
    if (!/^[.]?[A-Za-z0-9_]{2,31}$/.test(minecraftName) || !platform) return fail('Nama Minecraft atau platform tidak valid.');
    if (!/^\+?[0-9]{8,16}$/.test(whatsapp)) return fail('WhatsApp tidak valid. Gunakan kode negara, contoh 62812xxxxxxx.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Format email tidak valid.');
    if (['CUSTOM_RANK','VIP_PLUS'].includes(data.productId)) {
      const d = data.details || {};
      if (!/^[A-Za-z0-9_ -]{2,16}$/.test(safeText(d.rankName,16))) return fail('Nama Custom Rank harus 2–16 karakter.');
      if (!RANK_COLORS.has(String(d.rankColor || '').toUpperCase())) return fail('Warna rank tidak valid.');
      if (!RANK_STYLES.has(d.rankStyle)) return fail('Gaya tulisan rank tidak valid.');
    }
    let price;
    try { price = await calculatePrice(data.productId, promoCode, env); }
    catch (e) { return fail(e.message || 'Produk/promo tidak valid.'); }
    const ticketCount = ({ REENTRY_1: 1, REENTRY_2: 2, REENTRY_3: 3 })[data.productId] || 0;
    const seasonId = String(env.SLF_CURRENT_SEASON || 'season-1').trim();
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(seasonId)) return fail('Konfigurasi SLF_CURRENT_SEASON tidak valid.', 503);
    if (ticketCount > 0) {
      const existing = await env.DB.prepare(
        `SELECT COUNT(*) AS total
         FROM reentry_tickets t JOIN orders o ON o.id = t.order_id
         WHERE LOWER(TRIM(t.minecraft_name)) = LOWER(TRIM(?))
           AND t.season_id = ?
           AND o.status NOT IN ('CANCELLED','EXPIRED')`
      ).bind(minecraftName, seasonId).first();
      const reserved = Number(existing?.total || 0);
      if (reserved + ticketCount > 3) {
        const remaining = Math.max(0, 3 - reserved);
        return fail(`Batas maksimal 3 tiket re-entry per pemain per season. Nama Minecraft ini sudah memiliki ${reserved} tiket pada season ${seasonId}; sisa kuota ${remaining} tiket. Paket yang dibeli ikut dihitung per tiket.`, 409);
      }
    }
    const now = new Date().toISOString();
    const date = now.slice(2,10).replaceAll('-','');
    const id = 'SLF-' + date + '-' + randomHex(6).toUpperCase();
    const ref = ('SLF' + date + randomHex(10).toUpperCase()).slice(0,25);
    const token = randomHex(40) + randomHex(24);
    const hash = await sha256Hex(token);
    const encryptedAccessKey = await encryptOrderAccessKey(token, env);
    if (!encryptedAccessKey) return fail('Checkout sementara tidak tersedia: OWNER_SECRET atau ORDER_LINK_SECRET harus dikonfigurasi dengan minimal 32 karakter agar tautan pesanan dan ulasan aman.', 503);
    const details = ['CUSTOM_RANK','VIP_PLUS'].includes(data.productId)
      ? {rankName:safeText(data.details?.rankName,16),rankColor:String(data.details?.rankColor||'').toUpperCase(),rankStyle:safeText(data.details?.rankStyle,20),buyerNote:safeText(data.details?.buyerNote,400)}
      : {buyerNote:safeText(data.details?.buyerNote,400)};
    const sql = "INSERT INTO orders (id,access_key_hash,access_key_encrypted,minecraft_name,platform,whatsapp,email,product_id,product_name,details_json,promo_code,subtotal,discount,total,status,partner_reference_no,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDING_PAYMENT',?,?,?)";
    const statements = [
      env.DB.prepare(sql).bind(id,hash,encryptedAccessKey,minecraftName,platform,whatsapp,email||null,data.productId,price.product.name,JSON.stringify(details),promoCode||null,price.subtotal,price.discount,price.total,ref,now,now)
    ];

    // Prepare every re-entry row before writing. D1 batch makes the order and all
    // related tickets one transaction: any failed insert rolls the entire set back.
    if (ticketCount > 0) {
      const ticketSecret = resolveTicketLinkSecret(env).secret;
      for (let index = 0; index < ticketCount; index += 1) {
        const ticketId = 'TKT-' + date + '-' + randomHex(8).toUpperCase();
        const ticketToken = await hmacSha256Hex(ticketSecret, id + ':' + ticketId + ':' + token);
        const ticketHash = await sha256Hex(ticketToken);
        statements.push(env.DB.prepare(
          "INSERT INTO reentry_tickets (id, order_id, access_key_hash, minecraft_name, product_name, season_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'WAITING_PAYMENT', ?, ?)"
        ).bind(ticketId, id, ticketHash, minecraftName, price.product.name, seasonId, now, now));
      }
    }

    stage = 'store-order-and-tickets';
    await env.DB.batch(statements);
    const orderUrl = new URL('/store/order.html', request.url);
    orderUrl.searchParams.set('id', id); orderUrl.searchParams.set('key', token);
    // Best-effort WhatsApp Cloud API alert; never block checkout if notification is not configured.
    try {
      await notifyAdmin(env, { id, minecraft_name:minecraftName, platform, product_name:price.product.name, total:price.total, status:'PENDING_PAYMENT' }, new URL('/admin/?order='+encodeURIComponent(id), request.url).toString());
    } catch (notificationError) { console.error('Admin WhatsApp notification failed:', notificationError?.message || notificationError); }
    return json({orderId:id,orderUrl:orderUrl.toString(),total:price.total,subtotal:price.subtotal,discount:price.discount,status:'PENDING_PAYMENT'});
  } catch (e) {
    console.error('Order creation failed at ' + stage + ':', e?.message || e);
    return fail('Pesanan belum berhasil disimpan. Tidak ada pembayaran yang perlu dilakukan. Periksa kembali data lalu coba sekali lagi. Jika masalah berulang, hubungi CS SLF.', 503);
  }
}
