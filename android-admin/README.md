# SLF Admin Android

Proyek Android native SLF Admin. Website production tidak diubah. Source project tersimpan dalam arsip `SLF_Admin_Android_Project.tar.xz`.

## Build APK

Workflow **SLF Admin Android APK** berjalan otomatis saat ada perubahan pada folder `android-admin/` di branch `android-admin-build`, atau dapat dijalankan manual melalui GitHub Actions.

Setelah job berhasil:
1. Buka tab **Actions** pada repository.
2. Pilih workflow **SLF Admin Android APK** dan run terbaru yang berstatus sukses.
3. Unduh artifact **SLF-Admin-debug-APK**.
4. Ekstrak ZIP artifact untuk mendapatkan `app-debug.apk`.

Build menggunakan JDK 17, Android SDK Platform 36, Build Tools 36.0.0, dan Gradle 9.3.1. Karena source project disetel ke compileSdk 37, workflow menurunkan compileSdk menjadi 36 hanya pada salinan kerja CI. Target SDK tetap 36; perubahan ini hanya untuk kompilasi dan tidak mengubah fungsi atau aturan server.

Sebelum ekstraksi, workflow memeriksa integritas XZ dan daftar isi arsip. APK yang dihasilkan adalah debug build untuk pengujian, bukan release Play Store. Uji login, akses role Owner/Admin, semua operasi, dan notifikasi dengan akun uji sebelum dipakai operasional. Verifikasi pembayaran tetap harus dicocokkan dengan transaksi DANA Bisnis yang benar-benar masuk.

## Isolasi dari website

Semua source dan build Android berada di folder `android-admin/` pada branch `android-admin-build`. Branch `main`, halaman website, Cloudflare Pages Functions, D1, dan harga/aturan server tidak diedit.
