# SLF Admin Android

Proyek Android native SLF Admin. Website production tidak diubah. Source package ditempatkan di `android-admin/SLF_Admin_Android_Project.tar.gz` dan diekstrak oleh workflow build ke `android-admin/slf-admin-android/`.

## Build APK

Workflow **SLF Admin Android APK** berjalan otomatis saat ada perubahan pada folder `android-admin/` di branch `android-admin-build`, atau dapat dijalankan manual melalui GitHub Actions.

Setelah job berhasil:
1. Buka tab **Actions** pada repository.
2. Pilih workflow **SLF Admin Android APK** dan run terbaru yang berstatus sukses.
3. Unduh artifact **SLF-Admin-debug-APK**.
4. Ekstrak ZIP artifact untuk mendapatkan `app-debug.apk`.

Build menggunakan JDK 17, Android SDK Platform 36, Build Tools 36.0.0, dan Gradle Wrapper 9.3.1. Source project lokal tetap memakai compileSdk 37; workflow CI menyesuaikan nilai compileSdk menjadi 36 sementara di workspace runner karena SDK stable platform 37 belum tersedia di SDK Manager yang digunakan runner. Target SDK aplikasi tetap 36. Penyesuaian ini hanya compile-time dan tidak mengubah aturan server/API SLF.

APK yang dihasilkan adalah debug build untuk pengujian perangkat, bukan release build Play Store. Jangan gunakan APK ini untuk transaksi nyata sebelum login Owner/Admin, akses server, dan seluruh alur operasional diuji dengan akun uji.

## Isolasi dari website

Semua source dan build Android berada di folder `android-admin/` pada branch `android-admin-build`. Branch `main`, halaman website, Cloudflare Pages Functions, D1, serta workflow website yang sudah ada tidak diubah oleh pekerjaan ini.
