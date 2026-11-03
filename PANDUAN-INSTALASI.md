# Panduan Instalasi CashKu

CashKu terdiri dari dua bagian:

| Bagian | Isi | Tempat |
|---|---|---|
| **Server** | `Kode.gs` (+ `appsscript.json`, opsional) | Google Apps Script, di akun Google keluarga |
| **Aplikasi (tampilan)** | Folder hasil ekstrak `cashku-frontend.zip` | GitHub Pages |

Data keluarga tersimpan di **Google Sheets milik Anda sendiri**. GitHub hanya menyimpan tampilan aplikasi, tanpa data dan tanpa password.

---

## Tahap 1 — Pasang server (± 10 menit)

1. Buka **https://script.google.com** → klik **Proyek baru**.
2. Ganti nama proyek (kiri atas) menjadi **CashKu**.
3. Klik berkas **Code.gs**, hapus semua isinya, lalu **tempel seluruh isi `Kode.gs`**.
4. Di bagian paling atas kode, ubah bagian `SETUP`:
   ```javascript
   const SETUP = {
     ADMIN_NAMA:     'Ayah',
     ADMIN_USERNAME: 'admin',
     ADMIN_PASSWORD: 'ganti-password-ini'   // minimal 6 karakter
   };
   ```
5. Klik **Simpan** (ikon disket).
6. *(Opsional, disarankan)* Klik ⚙️ **Setelan proyek** → centang **Tampilkan file manifes "appsscript.json"** → buka `appsscript.json` → ganti isinya dengan berkas `appsscript.json` yang disediakan. Ini memastikan zona waktu **WITA**.
7. Di menu atas, pilih fungsi **`setupAppEnvironment`** → klik **▶ Jalankan**.
   - Muncul *Perlu otorisasi* → **Tinjau izin** → pilih akun Google → **Lanjutan** → **Buka CashKu (tidak aman)** → **Izinkan**.
   - Tunggu sampai **Log eksekusi** menampilkan ✅ **Setup selesai!**
   - Di Google Drive kini ada folder **📁 CashKu** berisi **🗃️ Database — CashKu**.
   - ⚠️ Cukup **sekali**. Kalau dijalankan lagi, setup tidak membuat apa pun (aman).
8. *(Opsional)* Pilih fungsi **`pasangPemanas`** → **▶ Jalankan**. Server dijaga tetap "hangat" sehingga login pertama lebih cepat.
9. Klik **Terapkan** (Deploy) → **Deployment baru**:
   - Jenis: ⚙️ → **Aplikasi web**
   - Jalankan sebagai: **Saya**
   - Yang memiliki akses: **Siapa saja**
   - Klik **Terapkan** → **salin URL** yang berakhiran **`/exec`**.

> **Kenapa "Siapa saja"?** Agar aplikasi di GitHub Pages bisa menghubungi server. Data tetap aman: setiap permintaan wajib membawa kunci sesi dari login, dan hak akses dicek di server.

---

## Tahap 2 — Isi alamat server di aplikasi

1. Ekstrak **`cashku-frontend.zip`** (klik kanan → *Extract All*). Hasilnya folder **`cashku-frontend`** yang langsung berisi `index.html`, folder `css`, `js`, `fonts`, `icons`.
2. Buka **`js/config.js`** dengan Notepad, ganti alamatnya dengan URL `/exec` dari Tahap 1:
   ```javascript
   self.CASHKU_CONFIG = {
     GAS_URL: 'https://script.google.com/macros/s/AKfycb...../exec',
     VERSI: '1.0.0'
   };
   ```
3. Simpan.

---

## Tahap 3 — Unggah ke GitHub Pages

**Folder yang diunggah adalah `cashku-frontend`** (folder yang di dalamnya langsung terlihat `index.html`). Jangan naik satu tingkat ke folder di atasnya.

Ringkasan perintah (dijalankan di PowerShell/Terminal **di dalam folder `cashku-frontend`**):

```bash
git init
git add .
git commit -m "Upload pertama CashKu"
git branch -M main
git remote add origin https://github.com/USERNAME/cashku.git
git push -u origin main
```

Lalu di GitHub: repository **cashku** → **Settings** → **Pages** → Source **Deploy from a branch** → Branch **main** / **(root)** → **Save**, centang **Enforce HTTPS**.
Situs aktif di `https://USERNAME.github.io/cashku/` dalam 1–2 menit.

> Saat diminta password ketika `git push`, gunakan **Personal Access Token** (github.com/settings/tokens → *Generate new token (classic)* → centang **repo**), bukan password akun. Saat menempel token, layar memang tidak menampilkan apa pun; itu normal.

Claude akan memandu tahap ini satu per satu di percakapan.

---

## Tahap 4 — Pertama kali dipakai

1. Buka situs → masuk dengan username & password Admin dari `SETUP`.
2. **Pengaturan → Kelola dompet**: ganti nama sesuai milik keluarga (misalnya "BRI Ayah") dan alias seperti `bri, brimo`. Saldo awal bisa diisi di sini, atau cukup ketik di chat: `saldo bank sekarang 5jt`, `uang tunai saya 300rb`.
3. **Pengaturan → Kelola Anggota**: tambahkan Bunda (Dewasa), anak-anak (Anak; pilih izin lihat).
4. **Pengaturan → Anggaran**: buat batas belanja, misalnya Jajan keluarga Rp1.000.000/bulan.
5. **Ganti password Admin** di **Akun Saya** (password di `SETUP` ada di kode).
6. Di HP: buka situs → **Pengaturan → Pasang CashKu di HP** (Android: Chrome; iPhone: Safari → Bagikan → Tambah ke Layar Utama).

### Contoh chat

| Ketik | Hasil |
|---|---|
| `beli kopi 25rb` | Pengeluaran Rp25.000 · Jajan |
| `bensin 25rb, makan siang 30rb` | 2 transaksi sekaligus |
| `gaji masuk bri 10jt` | Pemasukan ke rekening |
| `top up gopay 100rb dari bri` | Pindah saldo rekening → e-wallet |
| `nabung 500rb` | Uang tunai masuk ke rekening (tercatat sebagai Nabung) |
| `saldo saya dibank sekarang 5.000.000` · `rekening sekarang 5jt` · `di bank ada 5jt` | Saldo Rekening disesuaikan menjadi Rp5.000.000 |
| `uang tunai saya sekarang 1,5jt` · `kas tinggal 300rb` · `tunai sisa 200rb` | Saldo Tunai disesuaikan |
| `saldo saya sekarang 2jt` (tanpa nama dompet) | CashKu menanyakan dompet yang dimaksud |
| `kemarin parkir 2rb` | Dicatat tanggal kemarin |
| `jajan bulan ini?` · `saldo` · `sisa anggaran` | Jawaban ringkas di chat |
| `pengeluaran terbesar hari ini` · `… dua hari ini` · `… 3 hari terakhir` · `… seminggu terakhir` · `… bulan ini` · `… tahun ini` | 5 pengeluaran terbesar pada periode itu |
| `kategori pengeluaran terbesar bulan ini` · `hari paling boros minggu ini` · `siapa yang paling boros bulan ini` | Peringkat per kategori / per hari / per anggota |
| `rata-rata pengeluaran per hari` · `… per minggu` · `… per bulan` · `… per tahun` · `rata-rata jajan per hari bulan ini` | Rata-rata + perbandingan dengan hari/minggu/bulan berjalan |
| `checkout shopee 150rb` · `beli baju di lazada 120rb` · `ongkir 15rb` | Kategori **Belanja Online** |
| `bayar qris 25rb` | CashKu bertanya: dari Rekening atau E-Wallet (yang ada saldonya; bila hanya satu, langsung dipakai) |
| `unduh laporan bulan ini` · `laporan maret 2026` · `laporan tahun 2025` | Kartu laporan + tombol Unduh PDF |
| `batal` | Membatalkan pesan transaksi terakhir |
| `bantuan` | Daftar contoh |
| **Tekan lama** sebuah pesan → *Hapus pesan* | Pesan dihapus dan transaksinya ikut dibatalkan |

**Penyesuaian saldo** tidak dihitung sebagai pemasukan atau pengeluaran. Yang dicatat hanya selisihnya (misalnya saldo di aplikasi Rp4.200.000, Anda ketik `saldo bank sekarang 5jt` → tercatat penyesuaian +Rp800.000), sehingga laporan bulanan tetap rapi.

**Dompet default "Tanya dulu"** — di **Akun Saya → Dompet default** pilih *Tanya dulu setiap transaksi*. Setiap mencatat, CashKu menanyakan dibayar pakai apa dan **hanya menawarkan dompet yang ada saldonya** (dompet kosong tidak bisa dipakai membayar). Bila hanya satu dompet yang ada saldonya, CashKu langsung memakainya tanpa bertanya. Bila semua dompet Rp0, semua tetap ditawarkan dengan pengingat untuk mencatat saldo dulu. Anda boleh mengetuk pilihan atau mengetik `tunai`, `rek`, `gopay`. Bila chat sudah menyebut dompetnya (`bayar parkir 5rb pakai tunai`), CashKu tidak bertanya lagi. Kata `rek` selalu berarti Rekening.

**Warna & latar chat** — Admin mengganti warna di **Pengaturan → Tampilan**; warna langsung berubah di layar (termasuk gelembung chat Anda) sambil disimpan ke server, dan anggota lain mendapatkannya saat sinkron. **Latar chat** bisa diganti dengan gambar dari galeri oleh setiap anggota. Gambar diperkecil dan **hanya disimpan di HP itu**, tidak dikirim ke server atau Google Sheets. Di HP lain atur sendiri. Pilih *Pakai bawaan* untuk mengembalikannya.

---

## Memperbarui aplikasi

> **Pembaruan 1.0.5 (pertanyaan terbesar & rata-rata, Belanja Online, QRIS)** mengubah **server dan tampilan**: tempel ulang `Kode.gs` lalu buat *Versi baru*. Kategori **Belanja Online** dan kata kuncinya otomatis ditambahkan ke database lama saat aplikasi pertama kali sinkron (atau jalankan fungsi `migrasiData` sekali dari editor). Lalu unggah ulang tampilan.
>
> **Pembaruan 1.0.2 (penyesuaian saldo, Tanya dulu, warna instan, latar chat)** mengubah **keduanya**: tempel ulang `Kode.gs` yang baru lalu buat *Versi baru* (langkah di bawah; **tidak perlu** menjalankan `setupAppEnvironment` lagi), kemudian unggah ulang tampilan ke GitHub.

**Server (Kode.gs)** — setelah mengubah kode: **Terapkan → Kelola deployment → ✏️ Edit → Versi: Versi baru → Terapkan**.
⚠️ Jangan memilih *Deployment baru*, karena URL `/exec` akan berubah dan aplikasi terputus.

**Tampilan (GitHub)** — dari folder `cashku-frontend`:
```bash
git add .
git commit -m "Perbarui CashKu"
git push
```
Setelah 1–2 menit, buka CashKu: muncul banner **"Versi baru tersedia"** → ketuk **Muat ulang**. Bila banner belum muncul, tutup aplikasi sepenuhnya lalu buka lagi.

Bila suatu halaman menampilkan **"Halaman ini gagal dimuat"**, ketuk **Perbaiki & muat ulang**. Berkas aplikasi di HP diunduh ulang; data dan login tetap aman.

---

## Masalah umum

| Yang terlihat | Penyebab & solusi |
|---|---|
| Kotak kuning "Alamat server belum diisi" di halaman masuk | `js/config.js` belum diisi URL `/exec`. Isi, lalu `git add . && git commit -m "config" && git push`. |
| "Server membalas HTTP … (bukan JSON)" | URL salah, atau akses deployment bukan **Siapa saja**. Cek Tahap 1 langkah 9. |
| "Server belum di-setup" | `setupAppEnvironment()` belum dijalankan / gagal. Jalankan lagi dan lihat log. |
| "Username atau password salah" berkali-kali lalu terkunci | Tunggu 15 menit. Admin bisa reset password anggota di **Kelola Anggota**. |
| Titik di header abu-abu, ada angka ⏱ | Sedang offline. Catatan aman di HP dan terkirim otomatis saat online. |
| Di iPhone data belum terkirim | iPhone baru mengirim saat aplikasi dibuka. Buka CashKu sebentar saat ada sinyal. |
| Halaman 404 di GitHub Pages | `index.html` tidak berada di akar repository. Pastikan `git init` dijalankan di folder `cashku-frontend`. |
| Tampilan tanpa warna/berantakan | Folder `css`/`js` tidak ikut. Unggah lewat terminal, bukan "Upload files" di web GitHub. |

---

## Catatan teknis

- **Offline-first**: semua catatan disimpan dulu di HP (IndexedDB), lalu dikirim ke Sheets. Setiap transaksi punya ID unik dari HP, sehingga kiriman ulang tidak pernah tercatat ganda (sheet `Log_Sinkron`).
- **Sesi login** memakai token bertanda tangan (HMAC) yang berlaku 30 hari, bukan sheet `Sesi`, agar server lebih cepat dan tidak penuh. Reset password atau menonaktifkan anggota langsung mencabut sesinya.
- **PDF dibuat di HP** (jsPDF), bisa offline, dan memuat grafik.
- Data di HP: transaksi 24 bulan terakhir. Laporan periode lebih lama mengambil data dari server (perlu internet).
- Sheet `Transaksi` dapat menampung ± 70.000 transaksi/tahun tanpa masalah. Setelah beberapa tahun, salin baris lama ke sheet arsip bila terasa lambat.
