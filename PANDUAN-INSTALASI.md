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
| `nabung 500rb` · `nabung 1jt dari rekening` | Uang masuk ke dompet **Tabungan**; bila asalnya tidak disebut, CashKu bertanya dari dompet mana |
| `ambil tabungan 200rb` · `bongkar celengan 300rb` · `beli hp 3jt dari tabungan` | Memakai uang Tabungan (Tabungan hanya dipakai bila disebut) |
| `masuk rekening 2jt` · `uang masuk ke gopay 100rb` | CashKu bertanya: pemasukan baru, atau pindahan dari dompet lain? |
| `top up gopay 100rb` · `isi e-wallet 50rb` · `isi rekening 1jt` | Pindah saldo; CashKu bertanya uangnya dari mana (hanya dompet yang ada saldonya) |
| `pindah dana tunai ke rek 500rb` · `pindahin 200rb dari gopay ke rekening` · `transfer dari bca ke gopay 100rb` · `tarik tunai 500rb` · `setor tunai 1jt` | Pindah saldo langsung tercatat |
| `belanja mainan 100rb` · `belanja sayur 30rb` · `belanja 200rb` | Kategori mengikuti barangnya; `belanja` saja → ditanya kategorinya |
| `beli umpan mancing 25rb` · `sewa lapangan futsal 150rb` | Kategori **Hobi** |
| `saldo saya dibank sekarang 5.000.000` · `rekening sekarang 5jt` · `di bank ada 5jt` | Saldo Rekening disesuaikan menjadi Rp5.000.000 |
| `uang tunai saya sekarang 1,5jt` · `kas tinggal 300rb` · `tunai sisa 200rb` | Saldo Tunai disesuaikan |
| `saldo saya sekarang 2jt` (tanpa nama dompet) | CashKu menanyakan dompet yang dimaksud |
| `kemarin parkir 2rb` | Dicatat tanggal kemarin |
| `jajan bulan ini?` · `saldo` · `sisa anggaran` | Jawaban ringkas di chat |
| `pengeluaran terbesar hari ini` · `… dua hari ini` · `… 3 hari terakhir` · `… seminggu terakhir` · `… bulan ini` · `… tahun ini` | 5 pengeluaran terbesar pada periode itu |
| `kategori pengeluaran terbesar bulan ini` · `hari paling boros minggu ini` · `siapa yang paling boros bulan ini` | Peringkat per kategori / per hari / per anggota |
| `rata-rata pengeluaran per hari` · `… per minggu` · `… per bulan` · `… per tahun` · `rata-rata jajan per hari bulan ini` | Rata-rata + perbandingan dengan hari/minggu/bulan berjalan |
| `berapa tabungan sekarang` · `uang di rekening berapa` · `tunai tinggal berapa` | Saldo dompet itu + 3 gerakan terakhir |
| `nabung bulan ini berapa` · `bulan kemarin nabung berapa` · `top up gopay bulan ini` · `tarik tunai bulan lalu` | Total pindah saldo pada periode itu |
| `gaji bulan september masuk berapa` · `bayar listrik bulan oktober berapa` · `berapa kali beli kopi bulan ini` | Riwayat per kata/kategori (listrik saja, bukan semua tagihan) |
| `kapan terakhir beli bensin` | Tanggal & nominal terakhir |
| `listrik 350rb tanggal 5 oktober` · `bensin 20rb 3 okt` | Mencatat transaksi di tanggal lampau |
| `checkout shopee 150rb` · `beli baju di lazada 120rb` · `ongkir 15rb` | Kategori **Belanja Online** |
| `bayar qris 25rb` | CashKu bertanya: dari Rekening atau E-Wallet (yang ada saldonya; bila hanya satu, langsung dipakai) |
| `unduh laporan bulan ini` · `laporan maret 2026` · `laporan tahun 2025` | Kartu laporan + tombol Unduh PDF |
| `bayar air 500rb` · `beli air 10rb` · `air galon 20rb` · `air 10rb` | Kata bermakna ganda: CashKu melihat kata pendamping, kata kerja, nominal, dan kebiasaan Anda. **Bayar** air → Tagihan, **beli** air / galon → Kebutuhan Bulanan. Bila masih ragu, CashKu bertanya *“Air yang mana nih?”* (boleh diketuk atau diketik, misalnya `galon`) |
| `obat nyamuk 15rb` · `servis ac 250rb` · `token ml 50rb` · `susu anak 120rb` · `iuran sekolah 100rb` | Kata ganda lain (obat, servis, token, minyak, kopi, susu, paket, iuran, tiket, sewa, pajak, pulsa, ongkos, buku) masuk kategori sesuai konteksnya |
| `ingat air depot masuk kebutuhan bulanan` · `kalau air galon masuk ke bulanan ya` · `air minum itu kategori bulanan` | Mengajari CashKu langsung → *“Siap, aku ingat!”* (ada tombol **Urungkan**) |
| `lupakan kata air` · `kopi itu termasuk apa?` | Menghapus ingatan kata · menanyakan kata itu masuk kategori apa |
| `bensin 2jt` (biasanya 25rb) | CashKu memastikan dulu: *“Biasanya cuma sekitar Rp25.000 lho, sudah benar?”* |
| `halo` · `selamat pagi` · `makasih` · `kamu siapa?` · `ok` | Dibalas santai seperti asisten pribadi, dengan bahasa netral (tanpa ungkapan keagamaan) |
| `bli kopi 25rb` · `byar listrik 350rb` · `bli bnsin 25rb` · `beliii kopi 25k` | Salah ketik dibaca benar otomatis bila CashKu **yakin** (ditandai *✏️ Aku baca: “bli” → “beli”*, tetap ada tombol **Ubah**) |
| `kpoi 25rb` | Bila **setengah yakin**, CashKu bertanya *“Maksudnya: kopi Rp25.000 (Jajan)?”* → **Ya** disimpan ke sheet **Kamus_Typo** dan dipakai otomatis berikutnya; **Bukan** → kata dipakai apa adanya |
| `kopi itu termasuk apa` · `kopi masuk kategori apa` | Menjawab **kategori** (tanda tanya tidak wajib) |
| `harga kopi berapa` · `berapa harga bensin` | Menjawab **harga** dari catatan: terakhir, rata-rata, termurah, termahal |
| `pengeluran bulan ni brp` · `bayar listrik bulan oktober berapa` | Laporan — **pertanyaan tidak pernah dicatat sebagai transaksi** |
| `kopi` (satu kata) | CashKu menanyakan maksudnya: catat, tanya kategori, atau tanya harga |
| `kopi 25` | Nominal tidak ditebak — ditanyakan *Rp25.000?* |
| `tolong ingat nomor listrik saya 1234567890` · `simpan no rek bca saya 0123 a.n. Dani` · `ingat password wifi: rahasia123` | *“Oke, akan aku ingat 👍”* — data apa pun bisa diingat (sheet **Ingatan**). Tambah `untuk keluarga` agar anggota lain bisa melihat |
| `no pln saya berapa` · `nomor rekening bca` · `apa saja yang kamu ingat` · `hapus nomor listrik` | Menanyakan, melihat semua, atau menghapus data yang diingat |
| `rek istri` · `istri bri rek` · `no listrik` · `pln` · `token` | **Catatan dicari longgar:** urutan kata bebas, kata sambung (*punya, milik, atas nama, yang, si*) diabaikan, singkatan & salah ketik dimaklumi (`rek` = rekening, `pln` = `listrik` = `token`, `hp` = telepon). Satu hasil → langsung dijawab + tombol **Salin** |
| `rekening bri` · `rek` | Bila ada beberapa catatan (misalnya milik istri & Vicky) → *“Rekening BRI yang mana?”* dengan tombol **istri · vicky · Tampilkan semua** (boleh juga diketik) |
| `rekening bca` (belum disimpan) | *“Belum ada catatan tentang Rekening BCA. Mau saya simpan?”* + catatan yang mirip |
| `ingat rek bri istri 9999` (sudah ada) | *“…sudah ada. Mau diganti atau disimpan sebagai tambahan?”* |
| `ingat rekening bri 5555` (pemilik tidak disebut) | Bila ada rekening BRI milik orang lain → *“Rekening BRI ini milik siapa?”* |
| `semua rekening` · `daftar catatan` · `catatan apa saja` | Daftar catatan (semua, atau satu jenis) |
| `ganti rek bri istri jadi 5555` · `hapus catatan pln` | Mengubah / menghapus catatan |
| `bayar air tanggal 20 jam 9 ingatkan saya` · `ingetin bayar listrik besok jam 7` · `pengingat bayar air hapus` | Perintah pengingat boleh di mana saja dalam kalimat & boleh salah ketik |
| `saya Dani` · `nama saya Dani` · `namaku Sinta` · `panggil aku Rafi` | CashKu memanggil sesuai peran: suami → *“Baik, Pak Dani.”*, istri → *“Baik, Bu Sinta.”*, anak → *“Baik, Rafi.”*. Bila peran belum jelas, CashKu bertanya sekali *“Saya panggil Bapak atau Ibu?”* |
| `panggil saya Bang Dani` · `panggil saya Dani saja` · `siapa nama saya` | Sapaan pilihan sendiri, tanpa Pak/Bu, atau menanyakan nama panggilan |
| `ingatkan saya bayar air setiap tanggal 20 jam 9` | Pengingat bulanan + alarm/notifikasi HP |
| `ingatkan bayar listrik tanggal 27 November` | CashKu bertanya: *diulang setiap tanggal 27* atau *27 November saja*, lalu bertanya jamnya |
| `ingatkan minum obat tiap hari jam 7 malam` · `ingatkan setiap senin jam 6 buang sampah` · `ingatkan 30 menit lagi angkat jemuran` · `ingatkan bayar kos setiap akhir bulan jam 10` | Pengingat harian, mingguan, sekali, akhir bulan, tahunan |
| `daftar pengingat` · `hapus pengingat bayar air` · `tes alarm` | Melihat, menghapus, dan menguji alarm |
| `batal` | Membatalkan pesan transaksi terakhir |
| `bantuan` | Daftar contoh |
| **Tekan lama** sebuah pesan → *Hapus pesan* | Pesan dihapus dan transaksinya ikut dibatalkan |

**Penyesuaian saldo** tidak dihitung sebagai pemasukan atau pengeluaran. Yang dicatat hanya selisihnya (misalnya saldo di aplikasi Rp4.200.000, Anda ketik `saldo bank sekarang 5jt` → tercatat penyesuaian +Rp800.000), sehingga laporan bulanan tetap rapi.

**Dompet default "Tanya dulu"** — di **Akun Saya → Dompet default** pilih *Tanya dulu setiap transaksi*. Setiap mencatat, CashKu menanyakan dibayar pakai apa dan **hanya menawarkan dompet yang ada saldonya** (dompet kosong tidak bisa dipakai membayar). Bila hanya satu dompet yang ada saldonya, CashKu langsung memakainya tanpa bertanya. Bila semua dompet Rp0, semua tetap ditawarkan dengan pengingat untuk mencatat saldo dulu. Anda boleh mengetuk pilihan atau mengetik `tunai`, `rek`, `gopay`. Bila chat sudah menyebut dompetnya (`bayar parkir 5rb pakai tunai`), CashKu tidak bertanya lagi. Kata `rek` selalu berarti Rekening.

**Warna & latar chat** — Admin mengganti warna di **Pengaturan → Tampilan**; warna langsung berubah di layar (termasuk gelembung chat Anda) sambil disimpan ke server, dan anggota lain mendapatkannya saat sinkron. **Latar chat** bisa diganti dengan gambar dari galeri oleh setiap anggota. Gambar diperkecil dan **hanya disimpan di HP itu**, tidak dikirim ke server atau Google Sheets. Di HP lain atur sendiri. Pilih *Pakai bawaan* untuk mengembalikannya.

---

## Memperbarui aplikasi

> **Pembaruan 1.0.13 (catatan fleksibel, pengingat urutan bebas, sapaan nama)** — **server dan tampilan** berubah:
> 1. Apps Script → ganti seluruh isi `Kode.gs` dengan yang baru → **Simpan**.
> 2. Pilih fungsi **`migrasiData`** → **Jalankan** (sekali). Hasilnya: sheet baru **Alias_Catatan** (daftar singkatan: `rek` → rekening, `pln`/`listrik`/`token`, `hp` → telepon, nama bank, pemilik) dan **Log_Pengaturan**, serta kolom baru di ujung kanan: **Ingatan** (`jenis`, `lembaga`, `pemilik`) dan **Pengguna** (`panggilan`, `sapaan`, `hubungan`). Data lama tidak diubah. Bila lupa, migrasi tetap berjalan otomatis saat aplikasi sinkron.
> 3. **Deploy → Manage deployments → Edit → Version: New version → Deploy**.
> 4. Unggah ulang tampilan ke GitHub.
> 5. (Opsional) **Pengaturan → Anggota keluarga → ubah anggota → Dipanggil: Pak / Bu / Nama saja**. Bila dibiarkan *Tanya*, CashKu bertanya sekali di chat.
>
> **Menambah singkatan sendiri:** tambahkan baris di sheet **Alias_Catatan**, misalnya `alias` = `nyonya`, `kata` = `istri`, `kelompok` = `PEMILIK`. Kelompok: `JENIS` (rekening, pln, telepon…), `LEMBAGA` (bank/e-wallet), `PEMILIK` (istri, ayah…), `UMUM` (kata yang boleh tidak disebut, seperti *nomor*). Terbaca HP setelah sinkron berikutnya.
>
> **Privasi:** isi catatan dan pertanyaan tentang catatan **tidak** masuk log *pesan tidak dikenali* (Log_Aktivitas); angka di pesan lain ditulis `###`.
>
> **Pembaruan 1.0.12 (paham typo, ingatan data, pengingat & alarm)** — kali ini **server juga berubah**:
> 1. Buka Apps Script → ganti seluruh isi `Kode.gs` dengan berkas `Kode.gs` yang baru → **Simpan**.
> 2. Pilih fungsi **`pasangPengingat`** → **Jalankan**. Google akan meminta izin baru (*menghubungkan ke layanan eksternal* untuk mengirim notifikasi HP, dan *menjalankan pemicu*) → **Izinkan**. Di log muncul *✅ Pemicu pengingat terpasang*. Fungsi ini juga otomatis membuat 5 sheet baru: **Kamus_Typo**, **Aturan_Parser**, **Ingatan**, **Pengingat**, **Langganan_Push**.
> 3. **Deploy → Manage deployments → Edit (ikon pensil) → Version: New version → Deploy** (URL /exec tetap sama).
> 4. Unggah ulang tampilan ke GitHub (langkah di bawah).
> 5. Di setiap HP: **Pengaturan → Pengingat & alarm → Aktifkan alarm** (atau ketuk *🔔 Aktifkan alarm HP* di chat), lalu ketik `tes alarm`. Di iPhone, CashKu harus dipasang ke Layar Utama dulu (iOS 16.4+).
>
> **Tentang alarm:** notifikasi berbunyi walau CashKu ditutup, **diulang tiap menit (5×) sampai HP dibuka** atau ditekan *Selesai/Tunda*. Saat CashKu sedang terbuka, alarm tampil di layar dengan bunyi berulang dan getar. Karena CashKu adalah aplikasi web, bunyinya memakai suara notifikasi HP (bukan nada alarm jam). Untuk cadangan yang tetap berbunyi walau tanpa internet, ketuk *📅 Simpan ke Kalender* agar pengingat tersimpan juga di aplikasi Kalender HP.
>
> **Menyetel kepintaran CashKu tanpa mengubah kode:** sheet **Aturan_Parser** berisi bobot & ambang (misalnya `typo_ambang_yakin` 0.85, `ambang_tanya` 3, `alarm_ulang` 5) beserta penjelasannya. Sheet **Kamus_Typo** berisi daftar salah ketik → kata benar; Anda boleh menambah baris sendiri. Perubahan terbaca HP setelah sinkron berikutnya.
>
> **Pembaruan 1.0.11 (CashKu lebih pintar & santai)** hanya mengubah **tampilan** — `Kode.gs` **tidak perlu** ditempel ulang. Unggah ulang tampilan ke GitHub (langkah di bawah). Kata yang dulu sudah diingat (misalnya “air” → Tagihan) tetap dipakai, tetapi sekarang hanya sebagai salah satu petunjuk: `beli air 10rb` otomatis masuk Kebutuhan Bulanan. Saat Anda mengoreksi kategori, CashKu mengingat frasa lengkapnya (misalnya “beli air”), bukan satu kata saja.
>
> **Pembaruan 1.0.8 (Tabungan, Hobi, pindah saldo fleksibel, "belanja" umum)** mengubah **server dan tampilan**: tempel ulang `Kode.gs` lalu buat *Versi baru*. Dompet **Tabungan**, kategori **Hobi**, dan perubahan kata "belanja" otomatis ditambahkan ke database lama saat aplikasi sinkron (atau jalankan `migrasiData` sekali). Dompet Tabungan bisa dimatikan di **Pengaturan → Kelola dompet → Tabungan → Aktif**.
>
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
