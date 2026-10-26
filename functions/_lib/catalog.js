// Authoritative prices. Keep in sync with assets/js/store-config.js; server prices always win.
export const PRODUCTS = {
  VIP_PLUS: { name: 'VIP+', price: 55000, description: 'Rank VIP+' },
  CUSTOM_RANK: { name: 'Custom Rank', price: 20000, description: 'Rank dengan nama dan tampilan pilihan pembeli' },
  REENTRY_1: { name: 'Tiket Masuk Kembali · 1', price: 15000, description: 'Paket satu tiket masuk kembali' },
  REENTRY_2: { name: 'Tiket Masuk Kembali · 2', price: 28000, description: 'Paket dua tiket masuk kembali' },
  REENTRY_3: { name: 'Tiket Masuk Kembali · 3', price: 35000, description: 'Paket tiga tiket masuk kembali' }
};
export const RANK_COLORS = new Set(['#FFFFFF','#FF5555','#FFAA00','#FFFF55','#55FF55','#55FFFF','#5555FF','#AA00AA','#FF55FF','#B98CF4','#E8C47C']);
export const RANK_STYLES = new Set(['normal','bold','italic','bold_italic']);
export function calculatePrice(productId, promoCode, env) {
  const product = PRODUCTS[productId];
  if (!product) throw new Error('Produk tidak dikenal.');
  let discount = 0;
  if (promoCode) {
    let promos = {};
    try { promos = JSON.parse(env.PROMO_CODES_JSON || '{}'); } catch { throw new Error('Konfigurasi promo di server tidak valid.'); }
    const promo = promos[promoCode];
    if (!promo) throw new Error('Kode promo tidak valid atau sudah tidak aktif.');
    if (promo.type === 'percent' && Number.isFinite(Number(promo.value)) && Number(promo.value) > 0 && Number(promo.value) <= 100) discount = Math.floor(product.price * Number(promo.value) / 100);
    else if (promo.type === 'fixed' && Number.isFinite(Number(promo.value)) && Number(promo.value) > 0) discount = Math.min(product.price, Math.floor(Number(promo.value)));
    else throw new Error('Aturan kode promo tidak valid.');
  }
  return { product, subtotal: product.price, discount, total: Math.max(0, product.price - discount) };
}
