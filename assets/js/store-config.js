/* Pengaturan tampilan Store SLF.
   Harga server juga diverifikasi ulang di functions/_lib/catalog.js.
   Jika mengganti harga, ubah kedua file dan tes checkout lagi. */
window.SLF_STORE_CONFIG = {
  currency: 'IDR',
  storeName: 'SLF Store',
  // Isi nomor WhatsApp admin dengan kode negara, angka saja. Contoh format: 62812xxxxxxx.
  adminWhatsApp: '6281396440173',
  products: [
    { id: 'VIP_PLUS', name: 'VIP+', price: 55000, icon: '♜', tag: 'Rank permanen + fitur berlangganan', description: 'Rank VIP+ dan Custom Rank permanen; benefit tambahan aktif hanya selama langganan VIP+ berlaku.', note: 'Jika langganan berakhir, rank VIP+ dan Custom Rank tetap ada, tetapi benefit langganan berhenti. Benefit aktif termasuk claim 20 chunk/2 claim, akses /shop jarak jauh, dan 5 nyawa per tiket re-entry.' },
    { id: 'CUSTOM_RANK', name: 'Custom Rank', price: 20000, icon: '✧', tag: 'Personalisasi', description: 'Tentukan nama rank, warna, dan gaya tulisan yang kamu inginkan.', note: 'Gaya final mengikuti kemampuan plugin dan format teks server SLF.' },
    { id: 'REENTRY_1', name: 'Tiket Masuk Kembali · 1', price: 15000, icon: '♥', tag: 'Paket 1 tiket', description: 'Satu tiket re-entry untuk mengajukan masuk kembali ke Survival SLF.', note: 'Setiap tiket memberikan 3 nyawa untuk Member/VIP biasa, atau 5 nyawa jika langganan VIP+ masih aktif. Tiket harus diajukan dan diproses manual oleh admin.' },
    { id: 'REENTRY_2', name: 'Tiket Masuk Kembali · 2', price: 28000, icon: '♥', tag: 'Paket 2 tiket', description: 'Paket dua tiket re-entry.', note: 'Setiap tiket memberikan 3 nyawa untuk Member/VIP biasa, atau 5 nyawa jika langganan VIP+ aktif. Penggunaan diproses manual oleh admin.' },
    { id: 'REENTRY_3', name: 'Tiket Masuk Kembali · 3', price: 35000, icon: '♥', tag: 'Paket 3 tiket', description: 'Paket tiga tiket re-entry.', note: 'Setiap tiket memberikan 3 nyawa untuk Member/VIP biasa, atau 5 nyawa jika langganan VIP+ aktif. Penggunaan diproses manual oleh admin.' }
  ],
  rankColors: [
    { value: '#FFFFFF', label: 'Putih' }, { value: '#FF5555', label: 'Merah' }, { value: '#FFAA00', label: 'Emas' },
    { value: '#FFFF55', label: 'Kuning' }, { value: '#55FF55', label: 'Hijau' }, { value: '#55FFFF', label: 'Aqua' },
    { value: '#5555FF', label: 'Biru' }, { value: '#AA00AA', label: 'Ungu' }, { value: '#FF55FF', label: 'Pink' },
    { value: '#B98CF4', label: 'Ungu SLF' }, { value: '#E8C47C', label: 'Emas SLF' }
  ],
  rankStyles: [
    { value: 'normal', label: 'Normal' }, { value: 'bold', label: 'Tebal' },
    { value: 'italic', label: 'Miring' }, { value: 'bold_italic', label: 'Tebal + Miring' }
  ]
};
