# SLF Admin Android

Aplikasi native Android untuk ruang operasional Survival Legacy Frontier. Proyek ini berada di folder terpisah android-admin/; tidak mengubah halaman website, Cloudflare Pages Functions, D1, atau konfigurasi server.

## Fitur terhubung ke backend SLF

- Login Owner/Admin melalui GET /api/admin/me.
- Menu mengikuti role server; menu Owner hanya ditampilkan untuk role Owner.
- Pesanan, tiket re-entry, bantuan, ulasan, pelanggan, aktivitas, pengumuman, catatan tim, produk, promo, laporan, keuangan, editor konten, Studio, Wiki, dan akses.
- Tindakan pesanan memakai endpoint panel web yang sudah ada: verifikasi pembayaran, batalkan, mulai proses, dan selesai.
- Alur re-entry memakai endpoint status tiket yang sama. Batas tiga tiket per pemain per season tetap divalidasi backend.
- Balasan ulasan, tanggapan bantuan, catatan, pengumuman, produk, promo, catatan kas, dan konten website dikirim ke API existing.
- Kredensial disimpan terenkripsi dengan Android Keystore AES-GCM. HTTPS saja, Android backup dimatikan, layar dilindungi FLAG_SECURE.

## Build otomatis

Workflow GitHub Actions ada di .github/workflows/android-admin-build.yml. Setiap perubahan di android-admin/ memicu kompilasi. Artifact bernama SLF-Admin-Android-debug berisi app-debug.apk.

## Build manual

Buka folder android-admin/ melalui Android Studio dengan JDK 17, Android SDK Platform 36, dan Gradle 8.13. Jalankan assembleDebug.

APK debug akan berada di app/build/outputs/apk/debug/app-debug.apk.

## Catatan operasional

- Aplikasi mengakses backend website SLF yang sudah ada di https://legacy-frontier.web.id.
- Aplikasi tidak menyimpan kode Owner/Admin dalam source. Masukkan kode akses yang sudah dikonfigurasi di Cloudflare Pages.
- Verifikasi pembayaran harus dilakukan setelah transaksi DANA Bisnis dan nominal diperiksa secara langsung. Screenshot bukti saja tidak cukup.
- Aplikasi ini native Jetpack Compose, bukan WebView/PWA.
- Notifikasi real-time push/FCM belum termasuk. Data dimuat dari API saat tab dibuka atau tombol Muat ulang digunakan.
- Editor visual lanjutan/preview desain dan upload media masih lebih lengkap pada panel web. Modul Studio, Wiki, dan editor konten di aplikasi saat ini berfungsi sebagai akses data dasar melalui API yang ada.
