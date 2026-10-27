import { json, fail, readJson, safeText } from '../../_lib/common.js';
import { ensureStoreSchema } from '../../_lib/store-schema.js';

const actions = {
  store: { label: 'Lihat produk Store', href: '/store/#produk' },
  ticket: { label: 'Buat tiket bantuan', href: '/store/#pusat-bantuan' },
  order: { label: 'Bantuan pesanan', href: '/store/#pusat-bantuan' },
  guide: { label: 'Panduan mulai bermain', href: '/wiki/artikel/mulai-bermain.html' },
  rules: { label: 'Aturan komunitas', href: '/wiki/artikel/aturan-komunitas.html' },
  zones: { label: 'Panduan dunia & zona', href: '/wiki/artikel/dunia-slf.html' },
  claims: { label: 'Panduan klaim tanah', href: '/wiki/artikel/claim-tanah.html' },
  travel: { label: 'Waystone & perjalanan', href: '/wiki/artikel/perjalanan-waystone.html' },
  survival: { label: 'Panduan lapar & haus', href: '/wiki/artikel/lapar-haus.html' },
  economy: { label: 'Ekonomi & pasar', href: '/wiki/artikel/ekonomi-pasar.html' },
  faq: { label: 'FAQ teknis', href: '/wiki/artikel/faq-teknis.html' }
};

async function answerQuestion(message, env) {
  const q = message.toLocaleLowerCase('id')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  if (/^(hai|halo|hello|hi|p|permisi|assalamualaikum|selamat pagi|selamat siang|selamat sore|selamat malam)[!?.\s]*$/.test(q)) {
    return { topic:'sapaan', answer:'Halo! Aku Asisten Otomatis SLF, tersedia 24 jam untuk pertanyaan umum. Pilih topik cepat atau tulis pertanyaanmu. Untuk masalah akun/pesanan yang butuh pemeriksaan khusus, buat tiket supaya tim SLF bisa menindaklanjuti.', actions:[actions.guide,actions.store,actions.ticket] };
  }

  if (/(password|kata sandi|otp|pin dana|pin qris|kode otp|token rahasia|secret admin)/.test(q)) {
    return { topic:'keamanan', answer:'Demi keamanan, jangan kirim password Minecraft/Microsoft, PIN DANA, kode OTP, token, atau ADMIN_SECRET kepada siapa pun—termasuk orang yang mengaku admin. Admin Store hanya membutuhkan nama pemain, nomor pesanan bila ada, dan ringkasan kendala.', actions:[actions.ticket,actions.rules] };
  }

  if (/(refund|pengembalian dana|uang kembali|minta kembali|batal.*bayar|batalkan pesanan|salah transfer|salah nominal)/.test(q)) {
    return { topic:'pengembalian', answer:'Pembatalan atau pengembalian dana perlu diperiksa manual berdasarkan status pesanan dan transaksi yang benar-benar masuk. Chatbot tidak bisa menyetujui refund otomatis. Buat tiket dan tuliskan nomor pesanan, waktu transaksi, nominal, serta alasan. Jangan sertakan PIN atau OTP.', actions:[actions.ticket,actions.order] };
  }

  if (/(dana|qris|bayar|pembayaran|transfer|bukti bayar|bukti transfer|lunas|payment|rekening|metode bayar)/.test(q)) {
    return { topic:'pembayaran', answer:'Alur pembayaran Store SLF: buat pesanan, ikuti instruksi admin untuk QRIS DANA Bisnis, bayar nominal yang tepat, lalu tunggu pemeriksaan transaksi masuk. Screenshot saja tidak cukup untuk menyatakan lunas. Jangan membayar QRIS dari sumber lain yang tidak terkait pesananmu.', actions:[actions.store,actions.ticket] };
  }

  if (/(pesanan|order|status order|status pesanan|cek order|cek pesanan|lacak|tracking|nomor order|link order|tautan order|pesanan hilang)/.test(q)) {
    return { topic:'status-pesanan', answer:'Gunakan tautan status pribadi yang muncul setelah checkout untuk melihat detail pesanan. Simpan tautan itu baik-baik dan jangan bagikan karena memuat kunci akses. Kalau tautannya hilang atau status tidak berubah, kirim tiket berisi nama Minecraft, nomor pesanan jika masih ada, dan masalahnya—jangan kirim password.', actions:[actions.order,actions.ticket] };
  }

  if (/(harga|berapa|price|biaya|tarif|nominal|price list)/.test(q)) {
    let currentProducts = [];
    try {
      if (env.DB) {
        await ensureStoreSchema(env.DB);
        const { results = [] } = await env.DB.prepare("SELECT id,name,price FROM store_products WHERE active=1 ORDER BY created_at,id").all();
        currentProducts = results;
      }
    } catch (error) {
      console.error('CS catalog lookup unavailable:', error?.message || error);
    }
    const mentionsVip = /vip/.test(q);
    const mentionsCustom = /custom|rank/.test(q);
    const mentionsReentry = /re.?entry|tiket masuk kembali|tiket/.test(q);
    let shown = currentProducts;
    if (mentionsReentry) shown = currentProducts.filter(p => /^REENTRY_/.test(String(p.id)));
    else if (mentionsCustom && mentionsVip) shown = currentProducts.filter(p => ['VIP_PLUS','CUSTOM_RANK'].includes(String(p.id)));
    else if (mentionsCustom) shown = currentProducts.filter(p => String(p.id)==='CUSTOM_RANK');
    else if (mentionsVip) shown = currentProducts.filter(p => String(p.id)==='VIP_PLUS');
    if (shown.length) {
      const money = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0);
      const list = shown.map(p => '• '+p.name+': '+money(p.price)).join('\n');
      return { topic:'harga-produk', answer:'Harga aktif yang tercatat di Store SLF saat ini:\n'+list+'\n\nHarga divalidasi ulang saat checkout. Kalau produk yang kamu cari tidak muncul, cek katalog Store.', actions:[actions.store] };
    }
    return { topic:'harga-produk', answer:'Harga terbaru ada di katalog Store SLF. Aku belum dapat membaca katalog sekarang, jadi aku tidak akan menebak harga. Total di checkout menjadi acuan untuk pesananmu.', actions:[actions.store,actions.ticket] };
  }

  if (/(custom rank|warna rank|nama rank|format rank|gaya rank|vip\+?|donatur|pembelian rank|rank belum|rank belum masuk)/.test(q)) {
    return { topic:'produk-rank', answer:'Produk VIP+ dan Custom Rank diproses manual setelah pembayaran diverifikasi. Chatbot tidak memasang rank otomatis. Pastikan nama, warna, dan gaya yang dikirim saat checkout sudah benar. Jika rank belum dipasang atau hasilnya keliru, sertakan nomor pesanan dan nama Minecraft di tiket bantuan.', actions:[actions.store,actions.ticket] };
  }

  if (/(re.?entry|tiket masuk kembali|nyawa|mati permanen|masuk kembali|season reset|season baru|akun diban|terban karena nyawa)/.test(q)) {
    return { topic:'re-entry', answer:'Tiket Masuk Kembali diproses manual oleh admin sesuai aturan season SLF yang sedang aktif. Pembelian tidak otomatis mengaktifkan akun. Jika butuh pengecekan, kirim nomor pesanan dan nama Minecraft melalui tiket bantuan.', actions:[actions.store,actions.ticket,actions.rules] };
  }

  if (/(zona|zone|green|yellow|red zone|black zone|elarion|veyrwood|drakmor|noxveil|wilayah|dunia slf|peta dunia)/.test(q)) {
    return { topic:'zona', answer:'SLF memiliki wilayah dengan tingkat risiko berbeda. Baca panduan dunia dan zona untuk memahami area aman, eksplorasi, wilayah berbahaya, serta status zona yang belum dibuka. Jangan menganggap zona yang belum dibuka sudah dapat dimasuki.', actions:[actions.zones,actions.guide] };
  }

  if (/(claim|klaim|lindungi tanah|lindungi rumah|proteksi tanah|grief|rumah dicuri|bangunan dihancurkan)/.test(q)) {
    return { topic:'klaim-tanah', answer:'Untuk perlindungan bangunan dan batas klaim, ikuti panduan klaim tanah SLF. Jika tanah atau bangunan bermasalah, sertakan nama pemain, lokasi/koordinat, dan bukti yang relevan dalam tiket. Jangan membalas griefing dengan melanggar aturan.', actions:[actions.claims,actions.ticket,actions.rules] };
  }

  if (/(lapar|haus|thirst|hunger|minum|makan|dehidrasi|bar haus)/.test(q)) {
    return { topic:'survival', answer:'SLF memiliki mekanik lapar dan haus. Buka panduan untuk melihat cara mengelola kebutuhan karakter. Kalau indikator tidak muncul atau mekanik tidak berfungsi, tuliskan platform, versi game, dan gejala yang terjadi di tiket teknis.', actions:[actions.survival,actions.faq,actions.ticket] };
  }

  if (/(waystone|way.?stone|portal|teleport|teleportasi|rtp|tpa|spawn|warp|cara pergi|perjalanan)/.test(q)) {
    return { topic:'perjalanan', answer:'Perjalanan di SLF mengikuti sistem dunia dan titik perjalanan yang disediakan server; jangan menganggap perintah teleport umum tersedia. Lihat panduan Waystone dan perjalanan untuk cara berpindah wilayah.', actions:[actions.travel,actions.faq] };
  }

  if (/(uang dalam game|ekonomi|mata uang|jual item|beli item|pasar|shop|toko npc|jual barang|berdagang|harga item)/.test(q)) {
    return { topic:'ekonomi', answer:'Untuk ekonomi, perdagangan, dan pasar pemain, ikuti panduan Ekonomi & Pasar. Fitur dan harga dalam game mengikuti aturan server yang aktif; jika toko atau transaksi bermasalah, buat tiket teknis dan sertakan nama toko/barang serta pesan error.', actions:[actions.economy,actions.ticket] };
  }

  if (/(java|bedrock|gagal masuk|gagal login|tidak bisa masuk|gak bisa masuk|ga bisa masuk|error masuk|koneksi|versi game|ip server|alamat server|port server|join|masuk server|server offline|server down|lag|crash)/.test(q)) {
    return { topic:'teknis', answer:'Untuk kendala masuk atau performa, tuliskan platform (Java/Bedrock), versi game, pesan error persis, dan kapan masalah mulai terjadi. Asisten ini tidak dapat memeriksa status server atau akun secara langsung. Kirim tiket teknis agar tim dapat menelusurinya; jangan mengirim password.', actions:[actions.faq,actions.guide,actions.ticket] };
  }

  if (/(aturan|rules|dilarang|ban|mute|hukuman|lapor pemain|report pemain|cheat|curang|toxic|pelecehan|gangguan pemain)/.test(q)) {
    return { topic:'aturan', answer:'Untuk larangan, perilaku komunitas, dan pelaporan pemain, baca aturan resmi SLF. Jika ingin melapor, sertakan nama pemain, waktu kejadian, lokasi, dan bukti yang relevan. Hindari menyebarkan data pribadi atau melakukan pembalasan.', actions:[actions.rules,actions.ticket] };
  }

  if (/(ras|race|ability|kemampuan ras|skill ras|mana|pilih ras)/.test(q)) {
    return { topic:'ras', answer:'Detail ras dan kemampuan mengikuti informasi yang tersedia di Wiki SLF serta konfigurasi server yang aktif. Jika kemampuan tidak berjalan, tuliskan nama ras, kemampuan yang dicoba, dan pesan error bila ada melalui tiket teknis.', actions:[actions.zones,actions.faq,actions.ticket] };
  }

  if (/(promo|kupon|kode diskon|diskon|voucher|kode promo)/.test(q)) {
    return { topic:'promo', answer:'Masukkan kode promo saat checkout. Kode yang nonaktif, kedaluwarsa, atau sudah mencapai batas penggunaan akan ditolak oleh server. Harga akhir yang ditampilkan sebelum membuat pesanan adalah acuan checkout. Jika kode seharusnya valid tetapi gagal, kirim nama kode dan pesan error ke tiket bantuan—jangan kirim data pembayaran rahasia.', actions:[actions.store,actions.ticket] };
  }

  if (/(ulasan|review|rating|bintang|balas ulasan)/.test(q)) {
    return { topic:'ulasan', answer:'Tautan ulasan tersedia setelah pesanan selesai. Ulasan hanya dapat dikirim melalui halaman ulasan yang terkait dengan pesanan. Jika tautan tidak muncul, kirim nomor pesanan dan nama Minecraft melalui tiket bantuan.', actions:[actions.order,actions.ticket] };
  }

  if (/(admin|cs|customer service|petugas|manusia|orang asli|hubungi|kontak|balas kapan|24 jam|24jam|tiket bantuan|nomor tiket)/.test(q)) {
    return { topic:'kontak-cs', answer:'Asisten otomatis tersedia 24 jam untuk pertanyaan umum. Ini bukan petugas manusia dan tidak dapat mengubah data akun atau transaksi. Untuk pemeriksaan khusus, kirim tiket bantuan; tiket tetap tersimpan saat admin offline dan akan ditindaklanjuti tim ketika tersedia.', actions:[actions.ticket] };
  }

  if (/(produk|harga|beli|store|toko|katalog|berapa.*harga|harga.*berapa)/.test(q)) {
    return { topic:'store', answer:'Katalog dan harga terbaru ada di Store resmi SLF. Harga divalidasi lagi di server saat checkout, jadi total yang terlihat di checkout menjadi acuan untuk pesananmu. Produk digital diproses manual setelah pembayaran diverifikasi.', actions:[actions.store,actions.ticket] };
  }

  if (/(mulai bermain|pemula|cara main|pertama kali|baru join|baru masuk|panduan awal|cara bergabung)/.test(q)) {
    return { topic:'mulai-bermain', answer:'Pemain baru sebaiknya mulai dari panduan awal, aturan komunitas, dan panduan dunia SLF. Jika masih bingung setelah membaca panduan, tuliskan pertanyaan yang spesifik atau buat tiket bantuan.', actions:[actions.guide,actions.rules,actions.zones] };
  }

  return { topic:'belum-diketahui', answer:'Aku belum punya jawaban pasti untuk pertanyaan itu dan tidak mau menebak. Coba pilih panduan yang paling dekat dengan masalahmu, atau buat tiket agar tim SLF dapat menindaklanjuti. Jangan sertakan password, PIN, atau OTP.', actions:[actions.guide,actions.faq,actions.ticket] };
}

export async function onRequestPost({ request, env }) {
  let data;
  try { data = await readJson(request); } catch { return fail('Pesan tidak terbaca. Coba kirim ulang.'); }
  const rawMessage = typeof data.message === 'string' ? data.message.trim() : '';
  if (rawMessage.length < 1) return fail('Tulis pertanyaan terlebih dahulu.');
  if (rawMessage.length > 500) return fail('Pesan maksimal 500 karakter.');
  const message = safeText(rawMessage, 500);
  const response = await answerQuestion(message, env);
  return json({ ok:true, service:'SLF Automated Support', available:'24/7', automated:true, ...response });
}
