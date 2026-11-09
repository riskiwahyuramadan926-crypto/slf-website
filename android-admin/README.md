# SLF Admin Android

Project Android native untuk ruang operasional Survival Legacy Frontier. Website production tidak diubah. Source project tersimpan dalam arsip `SLF_Admin_Android_Project.tar.gz`.

Build otomatis tersedia di branch `android-admin-build` melalui GitHub Actions. Job menggunakan JDK 17, Android SDK Platform 36, Build Tools 36.0.0, dan Gradle 9.3.1. Karena source project disetel ke compileSdk 37, workflow menurunkan compileSdk menjadi 36 hanya pada salinan kerja CI. Target SDK tetap 36; perubahan ini hanya untuk kompilasi dan tidak mengubah fungsi atau aturan server.

Setelah job berhasil, buka tab Actions, pilih workflow **SLF Admin Android APK**, kemudian unduh artifact **SLF-Admin-debug-APK**. Ekstrak ZIP artifact untuk mendapatkan `app-debug.apk`.

APK yang dihasilkan adalah debug build untuk pengujian, bukan release Play Store. Uji login, akses role Owner/Admin, semua operasi, dan notifikasi dengan akun uji sebelum dipakai operasional. Verifikasi pembayaran tetap harus dicocokkan dengan transaksi DANA Bisnis yang benar-benar masuk.

Seluruh pekerjaan ini berada pada branch `android-admin-build` dan folder `android-admin/`. Branch `main`, halaman website, Cloudflare Pages Functions, D1, dan harga/aturan server tidak diedit.
