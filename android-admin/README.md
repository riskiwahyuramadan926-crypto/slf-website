# SLF Admin Android

Proyek Android native SLF Admin. Website production tidak diubah. Source package ditempatkan di `android-admin/SLF_Admin_Android_Project.tar.gz` dan diekstrak oleh workflow build ke `android-admin/slf-admin-android/`.

## Build APK

Workflow **SLF Admin Android APK** berjalan otomatis saat ada perubahan di folder `android-admin/` pada branch `android-admin-build`, atau dapat dijalankan manual melalui GitHub Actions.

Setelah job berhasil:
1. Buka tab **Actions** pada repository.
2. Pilih workflow **SLF Admin Android APK** dan run terbaru yang berstatus sukses.
3. Unduh artifact **SLF-Admin-debug-APK**.
4. Ekstrak ZIP artifact untuk mendapatkan `app-debug.apk`.

Build menggunakan JDK 17, Android SDK Platform 37, Build Tools 36.0.0, dan Gradle 9.3.1. APK yang dihasilkan adalah debug build untuk pengujian perangkat, bukan release build Play Store. Jangan gunakan APK ini untuk transaksi nyata sebelum login Owner/Admin, akses server, dan seluruh alur operasional diuji dengan akun uji.

## Isolasi dari website

Semua source dan build Android berada di folder `android-admin/` pada branch `android-admin-build`. Branch `main`, halaman website, Cloudflare Pages Functions, D1, dan workflow website yang sudah ada tidak diubah oleh pekerjaan ini.
