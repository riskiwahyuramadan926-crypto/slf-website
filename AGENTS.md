# Aturan Proyek Website SLF

Aturan ini wajib dibaca sebelum AI atau kontributor mengubah kode website Survival Legacy Frontier.

## 1. Cara kerja proyek
- Proyek adalah website statis HTML/CSS/JavaScript dengan Cloudflare Pages Functions.
- Database produksi memakai Cloudflare D1 melalui binding bernama persis `DB`.
- Konfigurasi Pages dan D1 berada di `wrangler.toml`; output statis adalah root proyek (`.`).
- Fungsi backend berada di `functions/`, library server di `functions/_lib/`, halaman di folder halaman masing-masing, dan aset browser di `assets/`.
- Jangan menambahkan framework, bundler, database, atau layanan berbayar baru tanpa alasan teknis dan persetujuan Owner.

## 2. Perintah pengembangan dan tes
- Pemeriksaan otomatis: `npm test`
- Alias pemeriksaan: `npm run check`
- Server lokal Cloudflare Pages: `npm run pages:dev` (memerlukan Wrangler).
- Sebelum perubahan dinyatakan selesai, jalankan tes yang relevan. CI menjalankan `npm test` pada push dan pull request.

## 3. Aturan perubahan kode
- Baca file yang relevan dan pemanggilnya sebelum mengubahnya. Jangan menebak struktur atau kontrak API.
- Buat perubahan sekecil mungkin yang menyelesaikan permintaan. Jangan mengubah fitur lain, harga, alur pembayaran, season, permission, atau konfigurasi server tanpa diminta.
- Pertahankan kompatibilitas Java dan Bedrock bila perubahan menyentuh pengalaman pemain.
- Pertahankan tampilan responsif untuk ponsel dan desktop.
- Gunakan JavaScript ESM dan API bawaan platform bila memungkinkan. Jangan menambah dependency hanya untuk pekerjaan kecil.
- Jangan menyatakan fitur berhasil hanya karena kode berhasil ditulis. Laporkan tes yang benar-benar dijalankan dan hal yang belum bisa diverifikasi.

## 4. Database dan data
- D1 adalah sumber data persisten untuk pesanan, tiket, ulasan, pengumuman, Wiki, konfigurasi desain, dan data operasional.
- Migrasi harus idempoten: utamakan `CREATE TABLE IF NOT EXISTS`, pemeriksaan kolom, dan perubahan bertahap yang aman.
- Dilarang memakai `DROP TABLE`, mereset database, atau menghapus data lama sebagai jalan pintas.
- Jangan mengubah ID database, nama binding `DB`, atau ID season tanpa instruksi eksplisit.
- Pisahkan isi/tampilan dari data. Perubahan UI tidak boleh menghapus atau menginisialisasi ulang data pengguna.
- Uji jalur berhasil dan gagal, termasuk data kosong, format salah, pengguna tanpa izin, dan database tidak tersedia.

## 5. Secret dan konfigurasi
- Jangan pernah menulis secret, token, password, private key, atau kredensial ke file source, HTML, JavaScript browser, dokumentasi yang dilacak Git, commit, log, atau chat.
- Secret produksi disimpan pada Cloudflare Pages → Settings → Variables and Secrets. Secret lokal memakai `.dev.vars`.
- `.dev.vars`, `.env`, dan variasi lokalnya wajib diabaikan Git. File contoh hanya berisi nama variabel dan nilai kosong.
- Jangan mencetak nilai secret ke respons API atau log. Health check hanya boleh mengeluarkan status konfigurasi, bukan nilainya.
- Pertahankan pemeriksaan akses Owner/Admin di server API; menyembunyikan tombol di frontend bukan pengganti otorisasi backend.

## 6. Database, API, dan keamanan
- Validasi input di server dan gunakan parameter binding D1, bukan menyusun SQL dari input pengguna.
- Endpoint admin harus memanggil pemeriksaan role server-side yang sesuai (`requireOwner` atau `requireAdmin`).
- Respons API yang sensitif menggunakan `no-store`. Jangan membocorkan detail rahasia atau data pelanggan ke endpoint publik.
- Pembayaran tetap diverifikasi berdasarkan transaksi yang benar-benar masuk; screenshot bukan bukti pembayaran.
- Jangan mempercayai nilai harga, role, status pembayaran, atau kuota yang dikirim browser tanpa validasi server.

## 7. Deploy dan monitoring
- Deploy produksi dilakukan melalui Cloudflare Pages yang terhubung ke repository ini. Periksa hasil deploy dari URL produksi setelah perubahan.
- Jalankan CI sebelum menganggap perubahan lolos pemeriksaan. Branch `main` sebaiknya dilindungi dengan required status check `quality`.
- Workflow monitoring memeriksa halaman utama dan `/api/health` secara berkala. Kegagalan harus ditinjau melalui GitHub Actions dan Cloudflare deployment/runtime logs.
- Jangan pernah mengaku sudah deploy atau menguji produksi bila status live belum benar-benar diperiksa.
- Perubahan database produksi harus mempertahankan data lama dan memiliki jalur pemulihan yang jelas.

## 8. Pelaporan hasil
Setiap penyelesaian teknis harus menyebut:
1. File/fitur yang diubah.
2. Tes yang dijalankan dan hasilnya.
3. Status deploy/produksi: terverifikasi atau belum terverifikasi.
4. Tindakan manual yang masih diperlukan dari Owner.

Jika ada bagian yang belum dapat diperiksa, katakan terus terang. Jangan centang lapis checklist sebelum bukti pemeriksaannya tersedia.
