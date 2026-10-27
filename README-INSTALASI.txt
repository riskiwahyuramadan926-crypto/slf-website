SURVIVAL LEGACY FRONTIER — WEBSITE + STORE (PEMBAYARAN MANUAL)
================================================================

ALUR PEMBELIAN
1. Pembeli memilih produk dan mengisi nama Minecraft, platform, WhatsApp, serta detail rank/tiket.
2. Checkout menyimpan pesanan dan membuka WhatsApp admin dengan ringkasan pesanan.
3. Admin mengirim QRIS DANA Bisnis secara manual.
4. Pembeli membayar dan mengirim bukti; admin memeriksa transaksi masuk langsung di DANA.
5. Admin membuka /admin/ lalu menekan "Verifikasi pembayaran" hanya setelah dana benar-benar masuk.
6. Admin memberikan rank/tiket di Minecraft, kemudian menekan "Tandai Pesanan Selesai".
7. Tautan ulasan muncul di halaman status setelah selesai. Ulasan hanya dapat dikirim satu kali.

KONFIGURASI WAJIB
- Cloudflare Pages D1 binding bernama DB.
- Jalankan schema.sql pada database D1 jika tabel orders/reviews belum ada.
- Cloudflare Secret ADMIN_SECRET minimal 32 karakter. Jangan simpan di GitHub.
- Isi adminWhatsApp di assets/js/store-config.js dengan nomor WhatsApp admin dalam format internasional angka saja. Contoh format: 62812xxxxxxx (ganti dengan nomor admin asli).
- Harga katalog publik: assets/js/store-config.js. Harga yang dipercaya server: functions/_lib/catalog.js.

UJI
- Buka /api/health. Harus muncul {"ok":true,"database":"connected","tables":["orders","reviews"]}.
- Buat pesanan uji dari /store/. Pastikan nomor pesanan, nominal, dan tautan status dikirim melalui WhatsApp admin.
- Di /admin/, masukkan ADMIN_SECRET. Pesanan harus muncul.
- Jangan menekan verifikasi jika belum ada pembayaran nyata. Verifikasi setelah transaksi masuk DANA.
- Setelah status PAID, uji tombol "Mulai Proses"; setelah produk benar-benar diberikan, tekan "Tandai Pesanan Selesai".
- Pastikan halaman status menampilkan tautan ulasan. Kirim ulasan, lalu buka ulang tautan; sistem harus menolak kiriman kedua.

KEAMANAN
- Pembayaran tidak diverifikasi otomatis. Screenshot bukan bukti cukup; cek transaksi masuk dan nominal di aplikasi/dashboard DANA.
- Situs tidak membuat QRIS dan tidak meminta PIN, OTP, kata sandi, token, atau kredensial DANA.
- Endpoint admin memerlukan Authorization: Bearer ADMIN_SECRET.
- Tautan status mengandung token acak; jangan bagikan kepada orang lain.
- VIP+ Rp55.000 termasuk Custom Rank permanen sesuai ketentuan SLF.

HARGA DEFAULT
VIP+ Rp55.000 — termasuk Custom Rank permanen
Custom Rank Rp20.000
Tiket masuk kembali 1 Rp15.000
Tiket masuk kembali 2 Rp28.000
Tiket masuk kembali 3 Rp35.000
