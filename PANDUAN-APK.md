# Panduan Aplikasi Android (APK) CashKu

APK CashKu adalah aplikasi Android sungguhan. Isinya sama dengan CashKu di browser, ditambah:

- **Alarm asli Android**:
  - Berbunyi tepat waktu walau HP terkunci, offline, atau baru dinyalakan ulang.
  - Memakai volume & nada alarm, berulang, dan tampil layar penuh di atas layar kunci.
  - Tombol di layar alarm: **[Matikan] [Tunda 10 menit] [Sudah bayar]**.
- **Input suara** memakai pengenal suara bawaan Android (bisa offline bila paket bahasa Indonesia offline sudah terpasang di HP).

APK dibuat otomatis oleh **GitHub Actions**, tanpa Android Studio dan tanpa biaya.

---

## 1. Susunan repo (satu repo saja)

Ekstrak ZIP CashKu ke folder repo yang sudah ada. Susunannya jadi seperti ini:

```
cashku/                    ← repo GitHub Pages yang sekarang
├── index.html, js/, css/, icons/, fonts/, sw.js, aset.json   ← tampilan (seperti biasa)
├── js/config.js           ← punya Bapak sendiri (tidak ada di ZIP, jangan dihapus)
├── _android/              ← proyek APK (tidak tampil di situs)
└── .github/workflows/android.yml   ← resep membangun APK
```

> Folder yang namanya diawali garis bawah (`_android`) **tidak** ikut tampil di GitHub Pages.
> Pastikan repo **tidak** punya berkas `.nojekyll`. Bila ada, folder `_android` ikut terbit (tidak berbahaya, hanya tidak perlu).

---

## 2. Kunci tanda tangan APK (sekali saja, PENTING)

Setiap APK harus ditandatangani dengan kunci yang **sama**. Kalau kuncinya hilang, versi berikutnya tidak bisa dipasang di atas yang lama. Aplikasi harus dihapus dulu, dan data yang belum tersinkron di HP ikut hilang.

Kunci sudah dibuatkan dan dikirim terpisah dari ZIP:

- `cashku-kunci.jks`: berkas kuncinya.
- `RAHASIA-kunci-APK.txt`: berisi isi ketiga secret di bawah.

**Langkah:**

1. **Simpan cadangan** kedua berkas itu di tempat aman, misalnya Google Drive pribadi atau flashdisk. **Jangan** dimasukkan ke folder repo dan **jangan** di-push ke GitHub.
2. Buka repo di GitHub → **Settings → Secrets and variables → Actions → New repository secret**. Buat 3 secret:

   | Name | Secret (isi) |
   |---|---|
   | `CASHKU_KUNCI_BASE64` | teks panjang di bagian 1 berkas RAHASIA |
   | `CASHKU_KUNCI_SANDI` | sandi di bagian 2 |
   | `CASHKU_KUNCI_ALIAS` | `cashku` |

Secret tetap terkunci walau repo publik. Orang lain tidak bisa melihatnya, dan GitHub menyamarkannya di log.

---

## 3. Push & tunggu APK jadi

1. Push seperti biasa (`git add .` → `git commit -m "CashKu 1.0.16"` → `git push`).
2. Buka tab **Actions** di repo, lalu pilih **Bangun APK CashKu**. Tunggu ±5–10 menit sampai tanda ✅.
3. APK muncul di dua tempat:
   - **Releases** (kanan halaman repo): `CashKu.apk`. Paling mudah dibuka dari HP.
   - **Actions → build tersebut → Artifacts**.

Membangun ulang tanpa perubahan: **Actions → Bangun APK CashKu → Run workflow**.

> APK hanya dibangun ulang bila isi folder `_android` berubah. Update tampilan biasa (chat, laporan, dan lainnya) **tidak** butuh APK baru. Lihat bagian 6.

---

## 4. Memasang di HP

1. Di HP, buka `https://github.com/<akun>/<repo>/releases/latest` lalu unduh **CashKu.apk**.
2. Buka berkasnya. Bila muncul *"Instal aplikasi tidak dikenal"*, izinkan untuk Chrome/Files.
3. Ketuk **Instal**, lalu **Buka**.
4. Masuk dengan akun CashKu seperti biasa. Data diambil dari server.

> Catatan yang masih *belum terkirim* di CashKu versi browser tetap di browser itu. Sinkronkan dulu di browser sebelum pindah ke APK.

**Memperbarui APK:** pasang APK baru di atas yang lama. Data tidak hilang, karena kuncinya sama.

---

## 5. Mengaktifkan alarm (wajib sekali per HP)

Buka **Pengaturan → Alarm Android** (CashKu juga mengajak lewat chat saat pertama dibuka). Pastikan keempat izin **Aktif**:

| Izin | Gunanya |
|---|---|
| Notifikasi (Android 13+) | Menampilkan alarm |
| Alarm tepat waktu | Berbunyi tepat di menitnya |
| Tampil layar penuh (Android 14+) | Layar alarm muncul di atas layar kunci |
| Tanpa batasan baterai | Android tidak "menidurkan" alarm |

Lalu ketuk **Tes alarm sekarang** dan **kunci layar**. Alarm berbunyi 10 detik kemudian dengan layar penuh. Nada bisa diganti di **Nada alarm**.

**Tips per merek HP** (juga tampil otomatis di halaman itu):

- **Xiaomi / Redmi / POCO:**
  - Aktifkan **Mulai otomatis**.
  - Penghemat baterai → **Tanpa batasan**.
  - Kunci CashKu di daftar aplikasi terbaru (tekan lama → gembok).
- **OPPO / realme / OnePlus:** Penggunaan baterai → izinkan **aktivitas latar belakang** & **mulai otomatis**.
- **vivo / iQOO:** izinkan **konsumsi daya latar belakang tinggi** & **mulai otomatis**.
- **Samsung:** Baterai → **Tidak dibatasi**. Pastikan CashKu tidak ada di **Aplikasi tidur**.

**Cara kerja alarm:**

- Berbunyi dengan volume alarm, berulang, dan bergetar.
- Berhenti saat HP **dibuka kuncinya**, atau saat **[Matikan]** diketuk.
- **[Tunda 10 menit]** membunyikan lagi 10 menit kemudian.
- **[Sudah bayar]** membuka CashKu dan menawarkan mencatat pengeluarannya.
- Bila diabaikan: berhenti setelah 2 menit, lalu diulang 5 menit kemudian (maksimal 3 kali).
- Pengingat bulanan tanggal 31 berbunyi di hari terakhir bulan pendek.
- Pengingat berulang otomatis dijadwalkan ke kejadian berikutnya, juga setelah HP dinyalakan ulang atau APK diperbarui.
- Pengingat yang dibuat/diubah/dihapus di chat langsung tersinkron ke alarm HP. Daftar dari sheet ikut diperbarui setiap sinkron.

---

## 6. Pembaruan tampilan tanpa APK baru (strategi yang dipakai)

**Cara kerjanya:**

1. Tampilan CashKu **dibundel di dalam APK**, sehingga selalu bisa dibuka walau offline.
2. Saat online, APK memeriksa `aset.json` di GitHub Pages (paling sering tiap 6 jam, atau lewat **Alarm Android → Cek pembaruan tampilan**).
3. Bila versinya lebih baru, semua berkas diunduh ke penyimpanan aplikasi. Versi baru baru dipakai bila unduhan **lengkap**.
4. Versi baru dipakai saat aplikasi dibuka lagi, atau langsung lewat tombol **Pakai sekarang** di chat.

Jadi untuk update fitur biasa: cukup push ZIP tampilan seperti biasa. APK di HP ikut terbarui sendiri.

**Risiko dan pengamannya:**

| Risiko | Pengaman |
|---|---|
| Versi tampilan baru rusak/macet | Bila versi baru gagal terbuka 2 kali, APK **otomatis kembali** ke tampilan bawaan APK dan versi itu tidak diunduh lagi |
| Unduhan terputus | Versi hanya dipakai bila semua berkas lengkap. Bila tidak, tetap memakai versi lama |
| Fitur yang butuh kode Android baru (alarm, izin) | Butuh APK baru. Saya akan memberi tahu bila sebuah update mengubah folder `_android` |
| Data di HP | Tidak terpengaruh. Data tersimpan terpisah dari berkas tampilan |

Setiap APK baru selalu membawa tampilan terbaru saat dibangun, jadi tidak ada versi yang "tertinggal".

---

## 7. iPhone

iPhone tidak bisa memasang APK. Di iPhone, CashKu tetap dipakai lewat Safari → **Tambah ke Layar Utama**. Alarm memakai notifikasi PWA + berkas kalender, sama seperti sebelumnya. Input suara di Safari juga didukung.

---

## 8. Nama paket

Nama paket APK: **`com.cashku.keluarga`**. Nama ini tidak bisa diganti setelah APK terpasang (APK dengan nama paket lain dianggap aplikasi berbeda).

Bila ingin nama lain, ganti **sebelum push pertama** di dua tempat:

- `_android/android/app/build.gradle` → `applicationId`
- `_android/capacitor.config.json` → `appId`

---

## Masalah umum

| Gejala | Solusi |
|---|---|
| Actions merah: *Secret … belum diisi* | Isi 3 secret (bagian 2), lalu **Re-run jobs** |
| *Aplikasi tidak terpasang* saat update | APK ditandatangani kunci berbeda. Pastikan secret berisi kunci yang sama dengan sebelumnya |
| Alarm tidak berbunyi saat HP terkunci | Buka **Alarm Android**, pastikan 4 izin Aktif, ikuti tips merek HP, lalu **Tes alarm sekarang** |
| Mikrofon tidak bisa | Pengaturan HP → Aplikasi → CashKu → Izin → Mikrofon → Izinkan |
| Tampilan tidak ikut terbarui | **Alarm Android → Cek pembaruan tampilan**. Pastikan `aset.json` ikut di-push |
