# Survival Legacy Frontier — Website & Store

Store menggunakan Cloudflare Pages Functions dan D1. Pembayaran DANA Bisnis dilakukan manual melalui WhatsApp.

## Alur pembelian
1. Pembeli checkout; sistem menyimpan pesanan dan membuka WhatsApp admin dengan detail order.
2. Admin mengirim QRIS DANA Bisnis secara manual.
3. Admin memeriksa transaksi masuk dan nominal di DANA (jangan percaya screenshot saja).
4. Admin masuk ke /admin/ dan menekan verifikasi pembayaran.
5. Admin memberikan produk secara manual di Minecraft, lalu menekan Selesai.
6. Tautan ulasan muncul setelah selesai. Ulasan hanya bisa dikirim satu kali.


- Admin operasional mencakup katalog produk berbasis D1 (harga baru dipakai server saat checkout berikutnya), kode promo, ringkasan pelanggan, laporan periode/produk, log tindakan admin, inbox tiket bantuan, pengumuman terjadwal, dan balasan ulasan.
- Halaman Store memuat katalog aktif dari `/api/store-products`, pengumuman dari `/api/announcements`, dan menerima tiket bantuan melalui `/api/support/tickets`. Schema runtime menyiapkan tabel admin dengan `CREATE TABLE IF NOT EXISTS` dan mempertahankan data lama.
- Fitur admin: statistik order, pencarian/filter, ekspor CSV, auto-refresh dan notifikasi browser, inbox ulasan serta balasan publik admin.
- Notifikasi WhatsApp otomatis membutuhkan Cloudflare secrets `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_ADMIN_TO` (format nomor internasional angka saja). Untuk notifikasi stabil di luar jendela layanan WhatsApp, set `WA_TEMPLATE_NAME` ke nama template Meta yang sudah disetujui dengan tepat 5 placeholder body; opsional `WA_TEMPLATE_LANGUAGE` dan `WHATSAPP_API_VERSION`. Tanpa konfigurasi Cloud API ini, admin tetap menerima notifikasi dalam dashboard selama panel terbuka dan bisa menghubungi pembeli dari tombol Chat WhatsApp.
- Jangan masukkan token WhatsApp ke file frontend atau GitHub.

## Konfigurasi wajib
- Binding D1 sudah ditetapkan di `wrangler.toml`: `DB` → database `slf-website` (`a5d20f54-37fe-495b-8608-dd7afa1a5a05`). Pastikan Pages memakai Wrangler config ini dan buat deployment baru.
- Middleware Store membuat tabel `orders` dan `reviews` secara aman saat API pertama kali diakses. `schema.sql` tetap tersedia untuk pemeriksaan atau pemasangan manual.
- Cloudflare Secret ADMIN_SECRET, minimal 32 karakter.
- Isi adminWhatsApp di assets/js/store-config.js dengan nomor admin format internasional angka saja (contoh format 62812xxxxxxx, ganti dengan nomor asli). Tanpa ini, checkout masih tercatat tetapi WhatsApp tidak terbuka otomatis.
- Harga ada di assets/js/store-config.js dan functions/_lib/catalog.js.

Tes /api/health; hasil benar: {"ok":true,"database":"connected","tables":["orders","reviews"]}. Jangan simpan secret di file publik/GitHub.