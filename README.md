# Website Publik Survival Legacy Frontier (SLF)

Website ini menggunakan HTML, CSS, dan JavaScript biasa. Tidak perlu framework atau proses build.

## Struktur file

```text
slf-website/
├── index.html                 # Susunan konten dan teks setiap bagian website
├── assets/
│   ├── css/
│   │   └── style.css          # Warna, desain, layout, dan tampilan mobile
│   └── js/
│       ├── config.js          # Tempat utama mengganti link/tautan
│       └── main.js            # Menu, pencarian Wiki, notifikasi; jarang perlu diedit
└── README.md                  # Panduan ini
```

## Cara mengedit bagian website

- **Teks, judul, isi Wiki, zona, kartu Store:** edit `index.html`. Setiap bagian diberi komentar `BAGIAN 01`, `BAGIAN 02`, dan seterusnya.
- **Warna, ukuran tulisan, jarak, bentuk tombol, tampilan HP:** edit `assets/css/style.css`.
- **Link Saweria, Store, tiket bantuan, Discord, WhatsApp, TikTok, YouTube:** edit `assets/js/config.js`.
- **Menu mobile, pencarian Wiki, dan notifikasi:** edit `assets/js/main.js`.

## Link Saweria

Tombol Saweria sudah dipasang di bagian Beranda dan Store. Link saat ini berada di `assets/js/config.js`:

```js
saweria: "https://saweria.co/LegacyFrontier",
```

Untuk mengganti link di masa depan, ubah nilai di atas. Jangan menghapus koma di akhir baris jika masih ada konfigurasi setelahnya.

## Mengaktifkan link lain nanti

Di `assets/js/config.js`, ubah nilai kosong menjadi tautan resmi. Contoh:

```js
discord: "https://discord.gg/TAUTAN-RESMI",
```

Jangan isi link contoh tersebut sebelum tautan resmi benar-benar tersedia. Link kosong akan tetap menampilkan notifikasi bahwa link belum dipasang.

## Cara mengunggah ke GitHub / Cloudflare Pages

1. Ekstrak ZIP ini terlebih dahulu di laptop.
2. Buka repo GitHub `slf-website` dan pilih **Add file → Upload files**.
3. Unggah `index.html`, folder `assets` (beserta isi di dalamnya), dan `README.md` ke **root repo**.
4. Pastikan struktur di repo sama seperti diagram di atas. `index.html` harus langsung berada di root, bukan tersimpan di dalam folder pembungkus seperti `slf-website-v4-rapi/`.
5. Isi commit message, misalnya `Rapikan struktur website dan pasang Saweria`, lalu klik **Commit changes**.
6. Cloudflare Pages akan mulai deploy otomatis dari repo. Buka halaman Deployments dan tunggu status **Success**, lalu refresh situs.

## Catatan

- Alamat Java/Bedrock, link Store, tiket CS, dan kanal sosial yang belum disahkan sengaja tidak diisi agar website tidak menyebarkan tautan atau alamat yang keliru.
- Donasi Saweria ditampilkan sebagai dukungan sukarela, bukan janji otomatis untuk menerima rank atau item.
- Jangan menghapus folder `assets`; website membutuhkan file CSS dan JavaScript di dalamnya.
