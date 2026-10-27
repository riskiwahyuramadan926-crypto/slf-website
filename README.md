# Survival Legacy Frontier — Website & Store

Store menggunakan Cloudflare Pages Functions dan D1. Pembayaran DANA Bisnis dilakukan manual melalui WhatsApp.

## Alur pembelian
1. Pembeli checkout; sistem menyimpan pesanan dan membuka WhatsApp admin dengan detail order.
2. Admin mengirim QRIS DANA Bisnis secara manual.
3. Admin memeriksa transaksi masuk dan nominal di DANA (jangan percaya screenshot saja).
4. Admin masuk ke /admin/ dan menekan verifikasi pembayaran.
5. Admin memberikan produk secara manual di Minecraft, lalu menekan Selesai.
6. Tautan ulasan muncul setelah selesai. Ulasan hanya bisa dikirim satu kali.

## Konfigurasi wajib
- Binding D1 sudah ditetapkan di `wrangler.toml`: `DB` → database `slf-website` (`a5d20f54-37fe-495b-8608-dd7afa1a5a05`). Pastikan Pages memakai Wrangler config ini dan buat deployment baru.
- Middleware Store membuat tabel `orders` dan `reviews` secara aman saat API pertama kali diakses. `schema.sql` tetap tersedia untuk pemeriksaan atau pemasangan manual.
- Cloudflare Secret ADMIN_SECRET, minimal 32 karakter.
- Isi adminWhatsApp di assets/js/store-config.js dengan nomor admin format internasional angka saja (contoh format 62812xxxxxxx, ganti dengan nomor asli). Tanpa ini, checkout masih tercatat tetapi WhatsApp tidak terbuka otomatis.
- Harga ada di assets/js/store-config.js dan functions/_lib/catalog.js.

Tes /api/health; hasil benar: {"ok":true,"database":"connected","tables":["orders","reviews"]}. Jangan simpan secret di file publik/GitHub.