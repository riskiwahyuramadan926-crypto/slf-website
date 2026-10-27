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


- CS otomatis 24 jam tersedia sebagai widget chat di beranda, Store, dan seluruh artikel Wiki. Bot menjawab FAQ berbasis aturan; pertanyaan khusus diarahkan ke formulir tiket. Ini bukan layanan manusia yang dijamin selalu online.
- Bila WhatsApp Business Cloud API dikonfigurasi, tiket bantuan baru juga dapat mengirim notifikasi ke admin. Tanpa secrets itu, tiket tetap tersimpan di D1 dan terbaca di panel admin.
- Fitur admin: pesanan/transaksi, verifikasi pembayaran manual, ekspor CSV, notifikasi browser, balasan ulasan, manajemen katalog produk dan harga, kode promo, data pelanggan, laporan penjualan, log aktivitas admin, pusat bantuan/tiket, serta pengumuman Store.
- Batas tiket re-entry aktif: maksimal 3 tiket per nama Minecraft per season. Paket 1/2/3 menggunakan kuota sesuai jumlah tiket. Kuota dicek saat checkout dan verifikasi pembayaran; pesanan belum dibayar memesan kuota sampai dibatalkan admin.
- Variabel `SLF_CURRENT_SEASON` di `wrangler.toml` menentukan season aktif (saat ini `season-1`). Pada season baru, ubah nilainya ke ID baru dan deploy ulang supaya kuota reset untuk season baru.
- Harga produk dikelola di menu Produk dan disimpan ke D1. Harga baru digunakan untuk pesanan baru; detail order yang sudah tersimpan tidak berubah.
- Kode promo yang dibuat di menu Promo divalidasi di server. Promo lama dari secret PROMO_CODES_JSON tetap bisa bekerja selama konfigurasi legacy masih tersedia.
- Formulir bantuan di /store/ menyimpan tiket ke D1. Balasan/status di panel admin, dan admin bisa membuka WhatsApp/email pelanggan dari tombol kontak; pengiriman balasan tetap tindakan manual.
- Notifikasi WhatsApp otomatis membutuhkan Cloudflare secrets `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_ADMIN_TO` (format nomor internasional angka saja). Untuk notifikasi order stabil di luar jendela layanan WhatsApp, set `WA_TEMPLATE_NAME` ke template Meta yang disetujui dengan 5 placeholder body. Untuk tiket CS gunakan template terpisah `WA_SUPPORT_TEMPLATE_NAME` (juga 5 placeholder); opsional `WA_SUPPORT_TEMPLATE_LANGUAGE`, `WA_TEMPLATE_LANGUAGE`, dan `WHATSAPP_API_VERSION`. Tanpa konfigurasi Cloud API ini, admin tetap menerima notifikasi dalam dashboard selama panel terbuka dan bisa menghubungi pembeli dari tombol Chat WhatsApp.
- Jangan masukkan token WhatsApp ke file frontend atau GitHub.

KONFIGURASI WAJIB
- `wrangler.toml` telah mengikat database D1 `slf-website` (`a5d20f54-37fe-495b-8608-dd7afa1a5a05`) dengan nama binding persis `DB`.
- Pastikan Cloudflare Pages menggunakan Wrangler config dari repository lalu buat deployment baru agar binding aktif.
- Middleware API membuat tabel pesanan, ulasan, katalog, promo, aktivitas, tiket bantuan, dan pengumuman secara aman jika belum ada. `schema.sql` disimpan sebagai cadangan setup manual.
- Cloudflare Secret ADMIN_SECRET minimal 32 karakter. Jangan simpan di GitHub.
- Isi adminWhatsApp di assets/js/store-config.js dengan nomor WhatsApp admin dalam format internasional angka saja. Contoh format: 62812xxxxxxx (ganti dengan nomor admin asli).
- Katalog tampilan dimuat dari `/api/store-products`; data produk dan harga utama berada di tabel D1 `store_products`. Harga dihitung server melalui `functions/_lib/catalog.js`.

UJI
- Buka /api/health. Harus muncul {"ok":true,"database":"connected","tables":["admin_activity","announcements","orders","promo_codes","review_replies","reviews","store_products","support_tickets"]}.
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
