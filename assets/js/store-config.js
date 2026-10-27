/* Pengaturan tampilan Store SLF.
   Harga server juga diverifikasi ulang di functions/_lib/catalog.js.
   Jika mengganti harga, ubah kedua file dan tes checkout lagi. */
window.SLF_STORE_CONFIG = {
  currency: 'IDR',
  storeName: 'SLF Store',
  // Isi nomor WhatsApp admin dengan kode negara, angka saja. Contoh format: 62812xxxxxxx.
  adminWhatsApp: '',
  products: [
    { id: 'VIP_PLUS', name: 'VIP+', price: 55000, icon: '♜', tag: 'Keanggotaan', description: 'Rank VIP+ dengan fitur Custom Rank permanen untuk akun Minecraft yang kamu daftarkan.', note: 'Fitur Custom Rank tetap menjadi hak akun setelah dibeli; nama, warna, dan gaya tulisan mengikuti kemampuan plugin SLF.' },
    { id: 'CUSTOM_RANK', name: 'Custom Rank', price: 20000, icon: '✧', tag: 'Personalisasi', description: 'Tentukan nama rank, warna, dan gaya tulisan yang kamu inginkan.', note: 'Gaya final mengikuti kemampuan plugin dan format teks server SLF.' },
    { id: 'REENTRY_1', name: 'Tiket Masuk Kembali · 1', price: 15000, icon: '♥', tag: 'Paket 1 tiket', description: 'Paket tiket masuk kembali untuk aturan season SLF.', note: 'Baca batas penggunaan dan aturan re-entry season sebelum membeli.' },
    { id: 'REENTRY_2', name: 'Tiket Masuk Kembali · 2', price: 28000, icon: '♥', tag: 'Paket 2 tiket', description: 'Paket dua tiket masuk kembali.', note: 'Tiket digunakan sesuai kebijakan season; tidak otomatis mengaktifkan akun.' },
    { id: 'REENTRY_3', name: 'Tiket Masuk Kembali · 3', price: 35000, icon: '♥', tag: 'Paket 3 tiket', description: 'Paket tiga tiket masuk kembali.', note: 'Penggunaan tetap perlu diproses admin sesuai aturan season.' }
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
