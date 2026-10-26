SURVIVAL LEGACY FRONTIER — WEBSITE + STORE (V1)
==============================================

ISI PAKET
- index.html                 Portal utama SLF versi sebelumnya, dengan tautan Store diperbarui.
- store/                     Katalog, formulir checkout, halaman status dan rating.
- admin/                     Pusat admin untuk melihat pesanan dan menandai pesanan selesai.
- assets/css/store.css       Tampilan Store terpisah.
- assets/js/store-config.js  Harga/katalog untuk tampilan publik.
- assets/js/store.js         Katalog, formulir, ringkasan, ulasan.
- functions/                 Backend Cloudflare Pages Functions.
- schema.sql                 Struktur database Cloudflare D1.

HARGA DEFAULT
VIP+ Rp55.000 — fitur Custom Rank permanen
Custom Rank Rp20.000 — pembelian Custom Rank terpisah
Tiket masuk kembali 1 Rp15.000
Tiket masuk kembali 2 Rp28.000
Tiket masuk kembali 3 Rp35.000

PENTING: FILE INI BELUM TERHUBUNG KE AKUN DANA BISNIS MILIKMU. Jangan membuka checkout publik sebelum uji sandbox DANA berhasil, webhook terverifikasi, dan WhatsApp admin diuji. Backend sengaja menolak checkout ketika konfigurasi pembayaran belum lengkap. Tidak ada QR palsu maupun tombol untuk mengakali status pembayaran.

A. PASANG KE REPOSITORY GITHUB / CLOUDFLARE PAGES
1. Cadangkan repository web SLF yang sekarang.
2. Ekstrak ZIP ini.
3. Upload ISI folder hasil ekstrak (index.html, folder store, admin, assets, functions, schema.sql, dll) ke root repository, bukan folder pembungkus.
4. Jika GitHub menanyakan penggantian index.html, cek apakah itu memang repository portal SLF, lalu commit perubahan.
5. Cloudflare Pages akan melakukan deploy. Tes dulu di alamat pages.dev.

B. BUAT DATABASE D1
1. Cloudflare Dashboard → Workers & Pages → D1 SQL Database → Create database; nama bebas, misalnya slf-store-db.
2. Buka database itu → Console → tempel seluruh isi schema.sql → jalankan.
3. Buka project Pages → Settings → Bindings → Add → D1 database.
4. Variable name harus persis: DB. Pilih database yang tadi dibuat.
5. Save lalu redeploy project.

C. ATUR VARIABEL / SECRETS CLOUDFLARE
Project Pages → Settings → Variables and Secrets. Pakai Secrets untuk private key/token/secret, bukan ditulis di GitHub.
- ADMIN_SECRET: secret acak minimal 32 karakter. Jangan bagikan ke pembeli dan jangan taruh di file HTML.
- PUBLIC_SITE_URL: alamat website yang benar, misalnya https://legacy-frontier.web.id.
- DANA_API_BASE: base URL yang tampil pada dashboard integrasi DANA milikmu (sandbox dulu, produksi setelah lolos tes).
- DANA_PARTNER_ID: Client ID/X-PARTNER-ID dari DANA.
- DANA_MERCHANT_ID: merchantId dari DANA.
- DANA_STORE_ID: store ID terdaftar di DANA.
- DANA_CHANNEL_ID: channel ID yang diberikan/diatur untuk integrasi DANA.
- DANA_ORIGIN: domain yang didaftarkan pada dashboard DANA, tanpa menambahkan kredensial.
- DANA_PRIVATE_KEY_PEM: private key merchant format PKCS#8 PEM. Simpan sebagai Secret; jangan kirim ke chat atau commit ke GitHub.
- DANA_PUBLIC_KEY_PEM: public key DANA untuk memverifikasi callback. Untuk produksi, gunakan public key yang DANA berikan untuk environment produksimu, bukan menyalin key sandbox.
- WA_ACCESS_TOKEN, WA_PHONE_NUMBER_ID, WA_ADMIN_TO: kredensial WhatsApp Business Cloud API dan nomor tujuan admin, nomor tujuan dalam format internasional tanpa tanda +.
- WHATSAPP_API_VERSION: versi Graph API yang masih aktif di akun Meta-mu.
- WA_TEMPLATE_NAME (disarankan): template notifikasi transaksi yang sudah disetujui Meta, dengan 5 placeholder body berurutan: nomor pesanan, pemain+platform, produk, total, link/status. Jika tidak disetel, sistem mencoba pesan teks biasa, yang mungkin ditolak di luar jendela layanan WhatsApp 24 jam.
- WA_TEMPLATE_LANGUAGE: biasanya id sesuai bahasa template yang disetujui.
- PROMO_CODES_JSON (opsional): contoh {"SLF10":{"type":"percent","value":10},"HEMAT5000":{"type":"fixed","value":5000}}. Jangan pasang kode promo sebelum kebijakan diskon ditetapkan.

Jangan menaruh isi private key, access token, ADMIN_SECRET atau kredensial lain di README, index.html, JS publik, atau screenshot.

D. AKTIFKAN WEBHOOK DANA
1. Ikuti dashboard dan dokumentasi integrasi DANA Bisnis milikmu; pastikan produk QRIS MPM/acquirer dan akun merchant kamu memang diizinkan untuk API ini.
2. Atur URL webhook Finish Notify ke: https://DOMAIN-KAMU/api/dana/notify
3. Uji dari DANA Sandbox sebelum production. Backend membentuk signature request sesuai pola asymmetric SNAP yang didokumentasikan DANA dan memverifikasi signature webhook; format/credential sandbox maupun production harus diuji dengan callback resmi DANA. Jika signature ditolak, status akan tetap pending (ini sengaja agar pembayaran tidak bisa dipalsukan); cocokkan canonical signing string dan key environment dengan panduan DANA yang berlaku untuk produk merchant-mu.
4. Pastikan status `latestTransactionStatus = 00`, merchant, referensi dan nominal cocok dengan pesanan sebelum sistem menandai PAID.
5. Jangan anggap screenshot transfer sebagai bukti otomatis. Hanya konfirmasi backend dari layanan pembayaran yang bisa mengubah status otomatis.

E. UJI DULU
1. Tes halaman /store/ di browser HP.
2. Tanpa konfigurasi, tombol checkout seharusnya memberikan pesan bahwa pembayaran belum aktif dan tidak membuat pesanan/QR.
3. Di Sandbox, buat pesanan nominal kecil uji sesuai skenario DANA; pastikan QR mencerminkan nominal total.
4. Pastikan callback berhasil dan status bergerak dari Menunggu pembayaran → Pembayaran berhasil.
5. Pastikan pesan WhatsApp masuk ke admin.
6. Buka /admin/, masukkan ADMIN_SECRET. Pastikan pesanan tampil dan tombol Selesai hanya tersedia jika pembayaran sudah diverifikasi.
7. Baru setelah produk benar-benar diberikan di Minecraft, admin menekan Tandai Pesanan Selesai.
8. Tautan status pembeli akan membuka rating; rating harus ditolak sebelum status selesai dan tidak bisa dikirim dua kali.

F. EDIT HARGA / PRODUK
Harga tampil ke pembeli ada di assets/js/store-config.js. Harga authoritative ada di functions/_lib/catalog.js. Jika harga berubah, edit kedua file lalu tes. Harga tidak dipercayai dari browser; server menghitung ulang harga.

G. STATUS DAN BATAS IMPLEMENTASI
- Otomatis: pembuatan order, nominal QRIS dinamis via DANA API (setelah kredensial valid), update pembayaran dari webhook yang signature-nya lolos, rating baru terbuka setelah admin menandai selesai.
- Manual: admin memberi rank/tiket di server Minecraft.
- WhatsApp otomatis membutuhkan WhatsApp Business Cloud API aktif + token/nomor, serta lebih baik memakai template pesan yang telah disetujui Meta.
- Verifikasi signature callback DANA perlu dites di Sandbox akun kamu; dokumentasi/credential acquirer yang kamu dapatkan dari DANA adalah sumber final. Jangan gunakan ke produksi sebelum seluruh tes berhasil.
- VIP+ Rp55.000 mencakup fitur Custom Rank permanen sesuai keputusan pemilik SLF. Nama rank, warna, dan gaya tulisan tetap dibatasi kemampuan plugin/format teks yang dipakai server. Benefit VIP+ lain dan masa aktif rank VIP+ harus dijelaskan terpisah sebelum checkout produksi.
- Kompensasi keterlambatan admin 1 jam belum dimasukkan karena jenis/nominal bonus belum ditetapkan.
