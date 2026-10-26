# Survival Legacy Frontier — Website V5 Wiki Lengkap

Paket ini menggabungkan website publik V4 + Saweria + seluruh Wiki SLF dalam satu unggahan. Bukan perlu dipasang tahap demi tahap.

## Isi paket
- `index.html` — beranda publik yang sudah ada, termasuk wilayah, store/donasi Saweria, bantuan, dan navigasi Wiki.
- `wiki/index.html` — pusat Wiki dengan pencarian, filter kategori, dan 18 artikel.
- `wiki/artikel/*.html` — halaman artikel terpisah yang bisa diedit satu per satu.
- `assets/css/style.css` — desain global website.
- `assets/css/wiki.css` — desain pusat Wiki dan halaman artikel Wiki.
- `assets/js/config.js` — semua link yang mudah diubah, termasuk Saweria.
- `assets/js/main.js` — interaksi beranda.
- `assets/js/wiki.js` — pencarian, filter, menu, dan tahun footer Wiki.

## Cara unggah sekali di GitHub
1. Unduh ZIP ini dan ekstrak di laptop.
2. Buka repo GitHub `slf-website` pada halaman utama branch yang dipakai Cloudflare Pages.
3. Pilih **Add file → Upload files**.
4. Unggah semua isi folder hasil ekstrak ke root repo, termasuk `index.html`, `README.md`, dan folder `assets` serta `wiki`.
5. Pastikan tidak terbentuk folder ekstra seperti `SLF-Website-V5-Wiki-Lengkap/` di dalam repo. `index.html` harus langsung berada di root.
6. Commit changes. Tunggu Cloudflare Pages deployment sukses, lalu buka website dan pilih **Buka Pusat Wiki Lengkap**.

Jika GitHub menolak file dengan nama yang sama, jangan hapus repo. Buka file konflik dan replace kontennya atau upload ulang melalui editor yang memiliki akses tulis. Jangan mengubah nama `index.html`, `assets`, atau `wiki`.

## Edit dengan rapi
- Isi artikel: edit file yang sesuai di `wiki/artikel/`, misalnya `zona-elarion.html`.
- Daftar artikel, kategori, dan pencarian: `wiki/index.html`.
- Warna, jarak, dan layout Wiki: `assets/css/wiki.css`.
- Warna/layout umum beranda: `assets/css/style.css`.
- Link Saweria, store, CS, sosial: `assets/js/config.js`.
- Fitur pencarian dan menu Wiki: `assets/js/wiki.js`.

## Link Saweria
`https://saweria.co/LegacyFrontier`

## Catatan akurasi
Artikel yang berstatus **Perlu verifikasi** atau **Rencana** sengaja diberi label. Sebagian detail SLF diketahui sebagai rancangan (misalnya ukuran wilayah dan batas claim) tetapi masih harus dicocokkan dengan konfigurasi server/season aktif sebelum dijadikan janji publik. Noxveil ditandai belum dibuka; daftar ras, angka skill, harga toko, alamat koneksi publik, dan kanal CS tidak dikarang.
