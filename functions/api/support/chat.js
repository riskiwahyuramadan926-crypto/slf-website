import { json, fail, readJson, safeText } from '../../_lib/common.js';

const actions = {
  store: { label: 'Lihat produk Store', href: '/store/#produk' },
  ticket: { label: 'Buat tiket bantuan', href: '/store/#pusat-bantuan' },
  order: { label: 'Buka Store / bantuan order', href: '/store/#pusat-bantuan' }
};

function answerQuestion(message) {
  const q = message.toLocaleLowerCase('id').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  if (/^(hai|halo|hello|hi|p|permisi|assalamualaikum)[!?.\s]*$/.test(q)) {
    return { topic:'sapaan', answer:'Halo! Aku Asisten Otomatis SLF, tersedia 24 jam untuk pertanyaan umum. Pilih topik di bawah atau tulis kendalamu. Untuk kasus akun/order yang butuh pengecekan manusia, buat tiket bantuan agar tim SLF bisa menindaklanjuti.', actions:[actions.store,actions.ticket] };
  }
  if (/(password|kata sandi|otp|pin dana|pin qris|kode otp)/.test(q)) {
    return { topic:'keamanan', answer:'Demi keamanan, jangan pernah kirim password Minecraft/Microsoft, PIN DANA, kode OTP, atau token ke siapa pun—termasuk admin. Untuk bantuan, cukup kirim nama pemain, nomor pesanan bila ada, dan ringkasan kendala.', actions:[actions.ticket] };
  }
  if (/(refund|pengembalian dana|uang kembali|minta kembali|batal.*bayar|batalkan pesanan)/.test(q)) {
    return { topic:'pengembalian', answer:'Permintaan pembatalan atau pengembalian dana perlu diperiksa manual sesuai status transaksi dan ketentuan SLF. Jangan kirim data rahasia. Buat tiket dengan nomor pesanan dan alasan supaya tim bisa memeriksanya; chatbot tidak menyetujui refund otomatis.', actions:[actions.ticket] };
  }
  if (/(dana|qris|bayar|pembayaran|transfer|bukti bayar|bukti transfer|lunas|payment)/.test(q)) {
    return { topic:'pembayaran', answer:'Alur pembayaran Store SLF masih manual: buat pesanan, tunggu admin mengirim QRIS DANA Bisnis, bayar nominal yang benar, lalu admin memeriksa transaksi masuk di DANA. Screenshot saja tidak cukup untuk menyatakan lunas. Jangan membayar ke QRIS dari sumber lain.', actions:[actions.store,actions.ticket] };
  }
  if (/(pesanan|order|status order|status pesanan|cek order|cek pesanan|lacak|tracking|nomor order)/.test(q)) {
    return { topic:'status-pesanan', answer:'Status pesanan hanya bisa dilihat melalui tautan pribadi yang diberikan setelah checkout. Buka tautan itu dan simpan baik-baik; jangan bagikan karena tautannya memuat kunci akses pesanan. Kalau tautan hilang atau status bermasalah, kirim tiket dengan nomor pesanan dan nama Minecraft—jangan sertakan kata sandi.', actions:[actions.order] };
  }
  if (/(vip|rank|custom rank|warna rank|nama rank|donatur)/.test(q)) {
    return { topic:'produk-rank', answer:'VIP+ mencakup Custom Rank permanen sesuai detail produk Store. Rank tidak dipasang otomatis oleh chatbot: setelah pembayaran benar-benar terverifikasi, admin memasang produk di server lalu menandai pesanan selesai. Nama/warna/gaya mengikuti batasan plugin SLF. Untuk pesanan tertunda atau detail rank keliru, kirim tiket.', actions:[actions.store,actions.ticket] };
  }
  if (/(re.?entry|tiket masuk kembali|nyawa|masuk kembali|season|season reset)/.test(q)) {
    return { topic:'re-entry', answer:'Tiket Masuk Kembali diproses manual oleh admin berdasarkan aturan season SLF yang sedang aktif. Pembelian tidak otomatis mengaktifkan akun. Cantumkan nomor pesanan dan nama Minecraft jika kamu perlu memastikan penggunaan tiket.', actions:[actions.store,actions.ticket] };
  }
  if (/(java|bedrock|gagal masuk|gagal login|tidak bisa masuk|gak bisa masuk|error masuk|koneksi|server|join|masuk server)/.test(q)) {
    return { topic:'teknis', answer:'Untuk kendala masuk server, tulis platform (Java/Bedrock), versi game, pesan error persis, dan kapan mulai terjadi. Jangan kirim password. Asisten ini tidak dapat memeriksa status server atau akun secara langsung; kirim tiket agar tim bisa menelusuri detailnya.', actions:[actions.ticket] };
  }
  if (/(admin|cs|customer service|petugas|manusia|orang asli|hubungi|kontak|balas kapan|24 jam|24jam)/.test(q)) {
    return { topic:'kontak-cs', answer:'Asisten otomatis ini merespons 24 jam untuk pertanyaan umum. Balasan manusia tidak dijamin selalu langsung tersedia. Kalau butuh pemeriksaan atau tindak lanjut, kirim tiket dari formulir bantuan; tiket tetap tersimpan meskipun admin sedang offline.', actions:[actions.ticket] };
  }
  if (/(produk|harga|beli|store|toko|katalog|diskon|promo)/.test(q)) {
    return { topic:'store', answer:'Katalog dan harga terbaru ada di Store resmi SLF. Harga yang tampil dihitung lagi oleh server saat checkout. Kode promo yang tidak valid atau kedaluwarsa akan ditolak. Admin memproses produk setelah pembayaran terverifikasi.', actions:[actions.store] };
  }
  return { topic:'belum-diketahui', answer:'Aku belum punya jawaban pasti untuk pertanyaan itu dan tidak mau menebak. Kirim tiket bantuan dengan detail masalah, nama Minecraft, serta nomor pesanan jika terkait pembelian. Jangan sertakan password, PIN, atau OTP.', actions:[actions.ticket] };
}

export async function onRequestPost({ request }) {
  let data;
  try { data = await readJson(request); } catch { return fail('Pesan tidak terbaca. Coba kirim ulang.'); }
  const message = safeText(data.message, 500);
  if (message.length < 1) return fail('Tulis pertanyaan terlebih dahulu.');
  if (message.length > 500) return fail('Pesan maksimal 500 karakter.');
  const response = answerQuestion(message);
  return json({ ok:true, service:'SLF Automated Support', available:'24/7', automated:true, ...response });
}
