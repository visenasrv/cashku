# CashKu — Catat Keuangan Keluarga Semudah Chatting

Aplikasi web (PWA) pencatat keuangan keluarga berbasis chat. Frontend statis untuk GitHub Pages; backend Google Apps Script + Google Sheets.

Panduan lengkap: **[PANDUAN-INSTALASI.md](PANDUAN-INSTALASI.md)**

## Struktur

```
index.html              Kerangka aplikasi
manifest.webmanifest    Data PWA (nama, ikon)
sw.js                   Service worker: offline + sinkron latar belakang
css/style.css           Tampilan (mode terang & gelap)
js/config.js            ← SATU-SATUNYA berkas yang perlu diubah (URL /exec)
js/parser.js            Pembaca kalimat chat (nominal, kategori, dompet, periode, salah ketik)
js/state.js             Data lokal & perhitungan (saldo, anggaran, ringkasan)
js/sync.js              Antrean & sinkron ke server
js/db.js, api.js        Penyimpanan HP (IndexedDB) & klien API (timeout, retry, idempoten)
js/chat.js              Halaman Chat
js/pages-utama.js       Dashboard, Riwayat, Ubah Transaksi
js/laporan.js           Unduh Laporan + pembuat PDF
js/pages-atur.js        Pengaturan, Kategori, Kamus, Anggaran, Dompet, Akun, Anggota
js/app.js               Login, sesi, pemasangan PWA, pembaruan
js/vendor/              jsPDF + AutoTable (dimuat hanya saat membuat PDF)
fonts/, icons/          Plus Jakarta Sans & ikon aplikasi
```

## Pembaruan

Ubah berkas → **naikkan `VERSI` di `sw.js`** (dan `U.VERSI` di `js/util.js`) → `git add . && git commit -m "..." && git push`.

Aplikasi di HP menyimpan satu set berkas per versi, sehingga berkas lama dan baru tidak pernah tercampur. Tanpa menaikkan `VERSI`, perubahan tidak sampai ke HP pengguna. Setelah push, pengguna melihat banner **"Versi baru tersedia" → Muat ulang**. Pengecualian: `js/config.js` selalu diambil terbaru dari server.
