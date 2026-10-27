// Server-side catalog and pricing. The D1 catalog is authoritative after schema initialization.
export const PRODUCTS = {
  VIP_PLUS: { name: 'VIP+', price: 55000, description: 'Rank VIP+ dan Custom Rank permanen; benefit tambahan aktif selama langganan VIP+ berlaku. Saat langganan habis, rank tetap ada tetapi fiturnya berhenti.' },
  CUSTOM_RANK: { name: 'Custom Rank', price: 20000, description: 'Rank dengan nama dan tampilan pilihan pembeli' },
  REENTRY_1: { name: 'Tiket Masuk Kembali · 1', price: 15000, description: 'Satu tiket re-entry: 3 nyawa untuk Member/VIP biasa atau 5 nyawa untuk VIP+ dengan langganan aktif.' },
  REENTRY_2: { name: 'Tiket Masuk Kembali · 2', price: 28000, description: 'Paket dua tiket re-entry; tiap tiket memberi 3 nyawa untuk Member/VIP biasa atau 5 nyawa untuk VIP+ dengan langganan aktif.' },
  REENTRY_3: { name: 'Tiket Masuk Kembali · 3', price: 35000, description: 'Paket tiga tiket re-entry; tiap tiket memberi 3 nyawa untuk Member/VIP biasa atau 5 nyawa untuk VIP+ dengan langganan aktif.' }
};
export const RANK_COLORS = new Set(['#FFFFFF','#FF5555','#FFAA00','#FFFF55','#55FF55','#55FFFF','#5555FF','#AA00AA','#FF55FF','#B98CF4','#E8C47C']);
export const RANK_STYLES = new Set(['normal','bold','italic','bold_italic']);
export async function calculatePrice(productId, promoCode, env) {
  if (!env.DB) throw new Error('Database Store belum tersambung.');
  const productRow = await env.DB.prepare('SELECT id, name, price, description, icon, tag, note FROM store_products WHERE id = ? AND active = 1').bind(productId).first();
  if (!productRow) throw new Error('Produk tidak dikenal atau sedang tidak tersedia.');
  const descriptionOverrides = {
    VIP_PLUS: 'Rank VIP+ dan Custom Rank permanen. Benefit tambahan hanya aktif selama langganan VIP+ berlaku; setelah langganan habis, rank tetap tetapi fitur tambahan berhenti.',
    REENTRY_1: 'Satu tiket re-entry: 3 nyawa untuk Member/VIP biasa atau 5 nyawa untuk VIP+ dengan langganan aktif.',
    REENTRY_2: 'Paket dua tiket re-entry; tiap tiket memberi 3 nyawa untuk Member/VIP biasa atau 5 nyawa untuk VIP+ dengan langganan aktif.',
    REENTRY_3: 'Paket tiga tiket re-entry; tiap tiket memberi 3 nyawa untuk Member/VIP biasa atau 5 nyawa untuk VIP+ dengan langganan aktif.'
  };
  const product = {
    id: productRow.id,
    name: productRow.name,
    price: Number(productRow.price),
    description: descriptionOverrides[productRow.id] || productRow.description || ''
  };
  let discount = 0;
  if (promoCode) {
    const promo = await env.DB.prepare('SELECT code, type, value, active, expires_at, max_uses FROM promo_codes WHERE code = ?').bind(promoCode).first();
    if (promo) {
      if (!promo.active) throw new Error('Kode promo sedang tidak aktif.');
      if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) throw new Error('Kode promo sudah kedaluwarsa.');
      if (promo.max_uses !== null && promo.max_uses !== undefined) {
        const used = await env.DB.prepare("SELECT COUNT(*) AS total FROM orders WHERE promo_code = ? AND status IN ('PAID','PROCESSING','COMPLETED')").bind(promoCode).first();
        if (Number(used?.total || 0) >= Number(promo.max_uses)) throw new Error('Batas pemakaian kode promo sudah tercapai.');
      }
      if (promo.type === 'percent' && Number(promo.value) > 0 && Number(promo.value) <= 100) discount = Math.floor(product.price * Number(promo.value) / 100);
      else if (promo.type === 'fixed' && Number(promo.value) > 0) discount = Math.min(product.price, Math.floor(Number(promo.value)));
      else throw new Error('Aturan kode promo tidak valid.');
    } else {
      // Keep legacy server-only PROMO_CODES_JSON codes working during migration.
      let promos = {};
      try { promos = JSON.parse(env.PROMO_CODES_JSON || '{}'); } catch { throw new Error('Konfigurasi promo di server tidak valid.'); }
      const legacy = promos[promoCode];
      if (!legacy) throw new Error('Kode promo tidak valid atau sudah tidak aktif.');
      if (legacy.type === 'percent' && Number(legacy.value) > 0 && Number(legacy.value) <= 100) discount = Math.floor(product.price * Number(legacy.value) / 100);
      else if (legacy.type === 'fixed' && Number(legacy.value) > 0) discount = Math.min(product.price, Math.floor(Number(legacy.value)));
      else throw new Error('Aturan kode promo tidak valid.');
    }
  }
  return { product, subtotal: product.price, discount, total: Math.max(0, product.price - discount) };
}
