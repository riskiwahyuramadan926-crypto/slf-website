import { json, fail, readJson, sha256Hex, randomHex, safeText, notifyAdmin } from '../../_lib/common.js';
import { calculatePrice, RANK_COLORS, RANK_STYLES } from '../../_lib/catalog.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) return fail('Database Store belum tersambung. Binding harus bernama DB.', 503);
    const data = await readJson(request);
    if (!data.agree) return fail('Centang persetujuan sebelum membuat pesanan.');
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
    const now = new Date().toISOString();
    const date = now.slice(2,10).replaceAll('-','');
    const id = 'SLF-' + date + '-' + randomHex(6).toUpperCase();
    const ref = ('SLF' + date + randomHex(10).toUpperCase()).slice(0,25);
    const token = randomHex(40) + randomHex(24);
    const hash = await sha256Hex(token);
    const details = ['CUSTOM_RANK','VIP_PLUS'].includes(data.productId)
      ? {rankName:safeText(data.details?.rankName,16),rankColor:String(data.details?.rankColor||'').toUpperCase(),rankStyle:safeText(data.details?.rankStyle,20),buyerNote:data.productId==='VIP_PLUS'?safeText(data.details?.buyerNote,400):''}
      : {buyerNote:safeText(data.details?.buyerNote,400)};
    const sql = "INSERT INTO orders (id,access_key_hash,minecraft_name,platform,whatsapp,email,product_id,product_name,details_json,promo_code,subtotal,discount,total,status,partner_reference_no,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDING_PAYMENT',?,?,?)";
    await env.DB.prepare(sql).bind(id,hash,minecraftName,platform,whatsapp,email||null,data.productId,price.product.name,JSON.stringify(details),promoCode||null,price.subtotal,price.discount,price.total,ref,now,now).run();
    const ticketCount = ({ REENTRY_1: 1, REENTRY_2: 2, REENTRY_3: 3 })[data.productId] || 0;
    for (let index = 0; index < ticketCount; index += 1) {
      const ticketId = 'TKT-' + date + '-' + randomHex(8).toUpperCase();
      await env.DB.prepare(
        "INSERT INTO reentry_tickets (id, order_id, access_key_hash, minecraft_name, product_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'WAITING_PAYMENT', ?, ?)"
      ).bind(ticketId, id, hash, minecraftName, price.product.name, now, now).run();
    }
    const orderUrl = new URL('/store/order.html', request.url);
    orderUrl.searchParams.set('id', id); orderUrl.searchParams.set('key', token);
    // Best-effort WhatsApp Cloud API alert; never block checkout if notification is not configured.
    try {
      await notifyAdmin(env, { id, minecraft_name:minecraftName, platform, product_name:price.product.name, total:price.total, status:'PENDING_PAYMENT' }, new URL('/admin/?order='+encodeURIComponent(id), request.url).toString());
    } catch (notificationError) { console.error('Admin WhatsApp notification failed:', notificationError?.message || notificationError); }
    return json({orderId:id,orderUrl:orderUrl.toString(),total:price.total,subtotal:price.subtotal,discount:price.discount,status:'PENDING_PAYMENT'});
  } catch (e) {
    console.error('Order creation failed', e?.message || e);
    return fail('Pesanan gagal dibuat. Periksa koneksi database D1 dan tabel Store.', 503);
  }
}
