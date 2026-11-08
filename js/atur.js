/* CashKu — Pengaturan lewat chat (1.0.14)
 * Satu pertanyaan per pesan + tombol jawaban cepat. Selama sesi aktif, pesan dibaca sebagai JAWABAN (bukan transaksi).
 * Perintah di dalam sesi: "batal", "kembali", "lewati". Sesi ditutup sopan bila 10 menit tidak dijawab.
 * Perubahan akses/uang hanya oleh kepala keluarga (Admin), selalu dikonfirmasi, dicatat server di sheet Log_Pengaturan.
 */
(function (g) {
  'use strict';
  const BATAS_MENIT = 10;
  const Atur = {};
  let sesi = null, timer = null;
  const P = () => g.Parser;
  const Chat = () => g.Chat;
  const n = (t) => P().normal(String(t || '')).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const rp = (x) => U.rp(x);
  const admin = () => !!S.saya && S.saya.peran === 'ADMIN';
  const namaAdmin = () => (S.anggotaAktif().find((a) => a.peran === 'ADMIN') || {}).nama || 'Admin';
  const sapa = () => (S.sapa ? S.sapa() : (S.saya && S.saya.nama) || '');
  const PERAN = {
    KEPALA: { label: 'Kepala keluarga', peran: 'ADMIN' }, SUAMI: { label: 'Suami', peran: 'DEWASA' }, ISTRI: { label: 'Istri', peran: 'DEWASA' },
    ANAK: { label: 'Anak', peran: 'ANAK' }, LAINNYA: { label: 'Lainnya', peran: 'DEWASA' }
  };
  const labelHub = (a) => (a.hubungan && PERAN[a.hubungan] ? PERAN[a.hubungan].label : a.peran === 'ADMIN' ? 'Kepala keluarga' : a.peran === 'ANAK' ? 'Anak' : 'Dewasa');
  const TIPE = { REKENING: 'Rekening', EWALLET: 'E-Wallet', TUNAI: 'Tunai', TABUNGAN: 'Tabungan' };
  const RE_BATAL = /^(batal|batalkan|stop|keluar|cancel|ga jadi|gak jadi|nggak jadi|tidak jadi|enggak jadi|udahan|sudahan|gajadi)$/;
  const RE_KEMBALI = /^(kembali|balik|back|sebelumnya|mundur|ulang yang tadi)$/;
  const RE_LEWATI = /^(lewati|lewat|skip|lewatin|nanti saja|nanti aja|terserah|bebas|kosong|tidak ada|nggak ada|gak ada|ga ada)$/;
  const RE_YA = /^(ya|iya|y|yes|ok|oke|okay|sip|siap|simpan|benar|betul|setuju|lanjut|boleh|gas|yup|yoi|mantap|bener|iya simpan|ya simpan|nonaktifkan|aktifkan|hapus)$/;

  /** Cocokkan jawaban ketik dengan pilihan (boleh salah ketik / sebagian) */
  function pilih(teks, opsi) {
    const t = n(teks);
    if (!t) return null;
    let x = opsi.find((o) => [o.label].concat(o.kata || []).some((k) => n(k) === t));
    if (x) return x;
    x = opsi.filter((o) => [o.label].concat(o.kata || []).some((k) => { const kk = n(k); return (t.length >= 3 && kk.indexOf(t) === 0) || (t.length >= 4 && P().lev(kk, t) <= 1) || kk.split(' ').some((w) => w.length >= 4 && P().lev(w, t) <= 1); }));
    return x.length === 1 ? x[0] : null;
  }
  const orangOpsi = (filter) => S.master.anggota.filter(filter || (() => true)).map((a) => ({ label: a.nama, nilai: a.id, kata: [a.username || ''] }));
  const katOpsi = (jenis) => S.kategoriAktif(jenis).map((k) => ({ label: k.nama, nilai: k.id_kategori, ikon: k.ikon }));
  function cariKat(teks, jenis) {
    const ids = P().cariKategoriNama(teks, S.ctxParser()).filter((id) => !jenis || (S.kat(id) || {}).jenis === jenis);
    if (ids.length === 1) return ids[0];
    const o = pilih(teks, katOpsi(jenis));
    return o ? o.nilai : '';
  }
  const blnLabel = (tgl) => { const d = String(tgl).split('-').map(Number); return U.BULAN[d[1] - 1] + ' ' + d[0]; };
  const sisaBulan = (tgl) => { const h = U.hariIni().split('-').map(Number), d = String(tgl).split('-').map(Number); return Math.max(1, (d[0] - h[0]) * 12 + (d[1] - h[1])); };
  const sandiAcak = () => { const h = 'abcdefghjkmnpqrstuvwxyz', a = '23456789'; let s = ''; for (let i = 0; i < 4; i++) s += h[Math.floor(Math.random() * h.length)]; for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
  const slug = (s) => n(s).replace(/\s+/g, '').replace(/[^a-z0-9._-]/g, '').slice(0, 20);
  function saranUsername(nama) {
    let b = slug(nama.split(' ')[0]) || 'anggota';
    if (b.length < 3) b = (b + 'xxx').slice(0, 3);
    const ada = new Set(S.master.anggota.map((a) => String(a.username || '').toLowerCase()));
    let u = b, i = 2;
    while (ada.has(u)) u = b + (i++);
    return u;
  }
  async function panggil(action, data) {
    if (navigator.onLine === false) return { offline: true };
    try {
      const res = await g.API.api(action, data);
      if (res && res.success && g.Sync) await g.Sync.sekarang({ paksaMaster: true });
      return res || { success: false, message: 'Tidak ada jawaban server.' };
    } catch (e) { return { offline: true, message: e.message }; }
  }

  // =================================================================
  // Alur (setiap langkah: perlu? → tanya → jawab)
  // =================================================================
  const ALUR = {};
  const LIHAT_AKUN = (d) => S.orang(d.orang) || {};

  ALUR.akun = {
    judul: 'tambah akun', perintah: 'tambah akun',
    langkah: [
      { k: 'nama', tanya: () => ({ teks: 'Siapa nama anggota barunya?', sub: 'Contoh: **Rina**' }),
        jawab: (t, d) => { const v = String(t).replace(/[^A-Za-zÀ-ÿ' \-]/g, ' ').replace(/\s+/g, ' ').trim(); if (/\d/.test(t) || v.length < 2 || v.split(' ').length > 3) return 'Namanya cukup 1–3 kata huruf saja, ya. Contoh: **Rina**'; d.nama = v.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()); } },
      { k: 'peran', tanya: (d) => ({ teks: '**' + d.nama + '** perannya apa?', chips: Object.keys(PERAN).map((k) => ({ label: PERAN[k].label })) }),
        jawab: (t, d) => { const v = P().peranDari(t) || (pilih(t, Object.keys(PERAN).map((k) => ({ label: PERAN[k].label, nilai: k }))) || {}).nilai; if (!v) return 'Pilih salah satu: kepala keluarga, suami, istri, anak, atau lainnya.'; d.peran = v; } },
      { k: 'izin', opsional: 'SENDIRI', perlu: (d) => d.peran === 'ANAK',
        tanya: (d) => ({ teks: '**' + d.nama + '** boleh melihat transaksi siapa?', chips: [{ label: 'Milik sendiri' }, { label: 'Semua keluarga' }] }),
        jawab: (t, d) => { const o = pilih(t, [{ label: 'Milik sendiri', nilai: 'SENDIRI', kata: ['sendiri', 'dirinya', 'miliknya'] }, { label: 'Semua keluarga', nilai: 'SEMUA', kata: ['semua', 'keluarga'] }]); if (!o) return 'Pilih **Milik sendiri** atau **Semua keluarga**.'; d.izin = o.nilai; } },
      { k: 'username', tanya: (d) => ({ teks: 'Username untuk masuk (login) **' + d.nama + '**?', sub: 'Huruf kecil/angka, 3–20 karakter.', chips: [{ label: saranUsername(d.nama) }] }),
        jawab: (t, d) => {
          const v = String(t).trim().toLowerCase().replace(/^@/, '');
          if (!/^[a-z0-9._-]{3,20}$/.test(v)) return 'Username 3–20 karakter: huruf kecil, angka, titik, minus, atau garis bawah. Contoh: **' + saranUsername(d.nama) + '**';
          if (S.master.anggota.some((a) => String(a.username || '').toLowerCase() === v)) return 'Username **' + v + '** sudah dipakai. Coba **' + saranUsername(d.nama) + '**.';
          d.username = v;
        } },
      { k: 'password', rahasia: true, tanya: (d) => ({ teks: 'Password awal untuk **' + d.nama + '**?', sub: 'Minimal 6 karakter. Nanti ' + d.nama + ' bisa menggantinya sendiri di Akun Saya.', chips: [{ label: 'Buatkan otomatis' }] }),
        jawab: (t, d) => { const v = String(t).trim(); if (/^buatkan( otomatis)?$/i.test(v) || /^(acak|otomatis|random)$/i.test(v)) { d.password = sandiAcak(); return; } if (v.length < 6) return 'Password minimal 6 karakter ya.'; if (/\s/.test(v)) return 'Password tidak boleh ada spasi.'; d.password = v; } }
    ],
    ringkas: (d) => ({ teks: 'Cek dulu ya, akun baru:\n• Nama: **' + d.nama + '**\n• Peran: **' + PERAN[d.peran].label + '**' + (d.peran === 'ANAK' ? ' (lihat ' + (d.izin === 'SEMUA' ? 'semua transaksi' : 'milik sendiri') + ')' : '') +
      '\n• Username: **' + d.username + '**\n• Password awal: **' + d.password + '**', sub: 'Simpan password ini dan berikan ke ' + d.nama + '. Menyimpan akun butuh internet.', ya: 'Simpan' }),
    async simpan(d) {
      const res = await panggil('penggunaSimpan', { id: '', nama_tampilan: d.nama, username: d.username, peran: PERAN[d.peran].peran, hubungan: d.peran,
        izin_lihat: d.peran === 'ANAK' ? d.izin || 'SENDIRI' : 'SEMUA', id_dompet_default: (S.dompetAktif()[0] || {}).id_dompet || '', password: d.password });
      if (res.offline) return { ulang: 'Sedang offline 📴 Akun baru butuh internet. Ketuk **Simpan** lagi saat sudah online.' };
      if (!res.success) return { ulang: 'Belum bisa disimpan: ' + res.message };
      return { teks: 'Akun **' + d.nama + '** sudah dibuat ✅\nMasuk dengan username **' + d.username + '** dan password **' + d.password + '**.', sub: 'Peran: ' + PERAN[d.peran].label + '. ' + d.nama + ' bisa mengganti password sendiri setelah masuk.' };
    }
  };

  const langkahOrang = (teks, filter) => ({ k: 'orang',
    tanya: () => ({ teks, chips: orangOpsi(filter).slice(0, 8).map((o) => ({ label: o.label })) }),
    jawab: (t, d) => { const o = pilih(t, orangOpsi(filter)); if (!o) return 'Aku belum menemukan akun itu. Pilih salah satu nama di atas, ya.'; d.orang = o.nilai; } });

  ALUR.ubahAkun = {
    judul: 'ubah akun', perintah: 'ubah akun',
    langkah: [
      langkahOrang('Akun siapa yang mau diubah?'),
      { k: 'ubah', tanya: (d) => ({ teks: 'Apa yang mau diubah dari **' + LIHAT_AKUN(d).nama + '**?', chips: [{ label: 'Nama' }, { label: 'Peran' }] }),
        jawab: (t, d) => { const o = pilih(t, [{ label: 'Nama', nilai: 'nama', kata: ['nama tampilan'] }, { label: 'Peran', nilai: 'peran', kata: ['jabatan', 'posisi'] }]); if (!o) return 'Pilih **Nama** atau **Peran**.'; d.ubah = o.nilai; } },
      { k: 'nama', perlu: (d) => d.ubah === 'nama', tanya: (d) => ({ teks: 'Nama baru untuk **' + LIHAT_AKUN(d).nama + '**?' }),
        jawab: (t, d) => { const v = String(t).trim().slice(0, 30); if (v.length < 2) return 'Namanya terlalu pendek.'; d.nama = v; } },
      { k: 'peran', perlu: (d) => d.ubah === 'peran', tanya: (d) => ({ teks: 'Peran baru **' + LIHAT_AKUN(d).nama + '**?', chips: Object.keys(PERAN).map((k) => ({ label: PERAN[k].label })) }),
        jawab: (t, d) => { const v = P().peranDari(t) || (pilih(t, Object.keys(PERAN).map((k) => ({ label: PERAN[k].label, nilai: k }))) || {}).nilai; if (!v) return 'Pilih salah satu: kepala keluarga, suami, istri, anak, atau lainnya.'; d.peran = v; } }
    ],
    ringkas: (d) => { const a = LIHAT_AKUN(d); return d.ubah === 'nama'
      ? { teks: 'Ubah nama **' + a.nama + '** jadi **' + d.nama + '**?', ya: 'Simpan' }
      : { teks: 'Ubah peran **' + a.nama + '**: ' + labelHub(a) + ' → **' + PERAN[d.peran].label + '**?', sub: d.peran === 'ANAK' ? 'Sebagai anak, ' + a.nama + ' hanya melihat transaksi miliknya sendiri.' : '', ya: 'Simpan' }; },
    async simpan(d) {
      const a = LIHAT_AKUN(d);
      const p = d.ubah === 'peran' ? d.peran : '';
      const res = await panggil('penggunaSimpan', { id: a.id, username: a.username, nama_tampilan: d.ubah === 'nama' ? d.nama : a.nama, peran: p ? PERAN[p].peran : a.peran,
        hubungan: p || a.hubungan || '', izin_lihat: p === 'ANAK' ? 'SENDIRI' : a.izin_lihat, id_dompet_default: a.id_dompet_default, aktif: a.aktif !== false });
      if (res.offline) return { ulang: 'Sedang offline 📴 Ketuk **Simpan** lagi saat sudah online.' };
      if (!res.success) return { selesai: true, teks: 'Belum bisa diubah: ' + res.message };
      return { teks: d.ubah === 'nama' ? 'Nama akun sudah diganti jadi **' + d.nama + '** ✅' : 'Peran **' + a.nama + '** sekarang **' + PERAN[p].label + '** ✅' };
    }
  };

  ALUR.nonaktif = {
    judul: 'nonaktifkan akun', perintah: 'nonaktifkan akun',
    langkah: [langkahOrang('Akun siapa yang mau dinonaktifkan?', (a) => a.aktif !== false && (!S.saya || a.id !== S.saya.id))],
    cek: (d) => (S.saya && d.orang === S.saya.id ? 'Akun sendiri tidak bisa dinonaktifkan dari sini 🙂' : ''),
    ringkas: (d) => ({ teks: 'Nonaktifkan akun **' + LIHAT_AKUN(d).nama + '**?', sub: LIHAT_AKUN(d).nama + ' tidak bisa masuk lagi, tapi semua transaksinya tetap tersimpan. Bisa diaktifkan kembali kapan saja.', ya: 'Nonaktifkan' }),
    async simpan(d) {
      const a = LIHAT_AKUN(d);
      const res = await panggil('penggunaSimpan', { id: a.id, username: a.username, nama_tampilan: a.nama, peran: a.peran, hubungan: a.hubungan || '', izin_lihat: a.izin_lihat, id_dompet_default: a.id_dompet_default, aktif: false });
      if (res.offline) return { ulang: 'Sedang offline 📴 Ketuk **Nonaktifkan** lagi saat sudah online.' };
      if (!res.success) return { selesai: true, teks: 'Belum bisa: ' + res.message };
      return { teks: 'Akun **' + a.nama + '** sudah dinonaktifkan ✅ Transaksinya tetap aman.', sub: 'Untuk mengaktifkan lagi: **aktifkan akun ' + n(a.nama) + '**' };
    }
  };
  ALUR.aktifkan = {
    judul: 'aktifkan akun', perintah: 'aktifkan akun',
    langkah: [langkahOrang('Akun siapa yang mau diaktifkan lagi?', (a) => a.aktif === false)],
    ringkas: (d) => ({ teks: 'Aktifkan lagi akun **' + LIHAT_AKUN(d).nama + '**?', ya: 'Aktifkan' }),
    async simpan(d) {
      const a = LIHAT_AKUN(d);
      const res = await panggil('penggunaSimpan', { id: a.id, username: a.username, nama_tampilan: a.nama, peran: a.peran, hubungan: a.hubungan || '', izin_lihat: a.izin_lihat, id_dompet_default: a.id_dompet_default, aktif: true });
      if (res.offline) return { ulang: 'Sedang offline 📴 Ketuk **Aktifkan** lagi saat sudah online.' };
      if (!res.success) return { selesai: true, teks: 'Belum bisa: ' + res.message };
      return { teks: 'Akun **' + a.nama + '** aktif lagi ✅' };
    }
  };

  const anggaranLama = (d) => S.master.anggaran.find((a) => a.aktif !== false && a.id_kategori === d.kategori && (a.periode || 'BULANAN') === (d.periode || 'BULANAN') &&
    (d.orang ? a.lingkup === 'PERORANG' && a.id_pengguna === d.orang : a.lingkup !== 'PERORANG'));
  const namaKat = (id) => (id === 'SEMUA' ? '💸 Total pengeluaran' : (S.kat(id).ikon + ' ' + S.kat(id).nama));
  ALUR.anggaran = {
    judul: 'atur anggaran', perintah: 'atur anggaran',
    langkah: [
      { k: 'kategori', tanya: (d) => ({ teks: d.kategoriTeks ? 'Kategori **' + d.kategoriTeks + '** belum ketemu. Anggaran untuk kategori apa?' : 'Anggaran untuk kategori apa?',
        chips: [{ label: 'Total pengeluaran' }].concat(S.kategoriAktif('KELUAR').slice(0, 7).map((k) => ({ label: k.nama }))) }),
        jawab: (t, d) => { if (/^(total|total pengeluaran|semua|semua kategori|keseluruhan)$/.test(n(t))) { d.kategori = 'SEMUA'; return; } const k = cariKat(t, 'KELUAR'); if (!k) return 'Kategori itu belum ada. Pilih dari tombol di atas, atau buat dulu: **tambah kategori ' + n(t) + '**'; d.kategori = k; } },
      { k: 'batas', tanya: (d) => { const l = anggaranLama(d); return { teks: 'Berapa batas anggaran **' + namaKat(d.kategori) + '** per ' + (d.periode === 'MINGGUAN' ? 'minggu' : 'bulan') + '?', sub: l ? 'Sekarang: ' + rp(l.batas) : 'Contoh: **500rb**' }; },
        jawab: (t, d) => { const v = P().nominalSaja(t) || (P().cariNominal(P().angkaKata(P().normal(t)))[0] || {}).nilai; if (!(v > 0)) return 'Ketik nominalnya, contoh: **500rb** atau **1,5jt**'; d.batas = v; } }
    ],
    ringkas: (d) => { const l = anggaranLama(d); const untuk = d.orang ? ' untuk **' + S.orang(d.orang).nama + '**' : ' untuk keluarga'; const per = d.periode === 'MINGGUAN' ? 'minggu' : 'bulan';
      return l ? { teks: 'Ubah anggaran **' + namaKat(d.kategori) + '**' + untuk + ': ' + rp(l.batas) + ' → **' + rp(d.batas) + '** per ' + per + '?', ya: 'Simpan' }
        : { teks: 'Buat anggaran **' + namaKat(d.kategori) + '** **' + rp(d.batas) + '** per ' + per + untuk + '?', sub: 'Aku ingatkan kalau sudah terpakai 80%.', ya: 'Simpan' }; },
    async simpan(d) {
      const l = anggaranLama(d);
      await S.ubahMaster('anggaran.put', { id_anggaran: l ? l.id_anggaran : 'AGR-' + Date.now().toString(36).toUpperCase(), lingkup: d.orang ? 'PERORANG' : 'KELUARGA', id_pengguna: d.orang || '',
        id_kategori: d.kategori, periode: d.periode || 'BULANAN', batas: d.batas, ambang_peringatan: l ? l.ambang_peringatan || 80 : 80, aktif: true });
      return { teks: 'Siap, anggaran **' + namaKat(d.kategori) + '** ' + rp(d.batas) + '/' + (d.periode === 'MINGGUAN' ? 'minggu' : 'bulan') + ' sudah ' + (l ? 'diperbarui' : 'dibuat') + ' ✅', chips: [{ label: 'Sisa anggaran', aksi: 'kirim', nilai: { teks: 'sisa anggaran' } }] };
    }
  };

  const IKON = ['🏷️', '🐾', '⚽', '🎁', '✈️', '💼', '🧒', '🛠️'];
  ALUR.kategori = {
    judul: 'tambah kategori', perintah: 'tambah kategori',
    langkah: [
      { k: 'nama', tanya: () => ({ teks: 'Nama kategori barunya apa?', sub: 'Contoh: **Hewan Peliharaan**' }),
        jawab: (t, d) => { const v = String(t).trim().slice(0, 40); if (v.length < 2) return 'Namanya terlalu pendek.'; if (S.master.kategori.some((k) => n(k.nama) === n(v))) return 'Kategori **' + v + '** sudah ada. Pakai nama lain, ya.'; d.nama = v.replace(/^./, (c) => c.toUpperCase()); } },
      { k: 'jenis', tanya: (d) => ({ teks: '**' + d.nama + '** termasuk pengeluaran atau pemasukan?', chips: [{ label: 'Pengeluaran' }, { label: 'Pemasukan' }] }),
        jawab: (t, d) => { const o = pilih(t, [{ label: 'Pengeluaran', nilai: 'KELUAR', kata: ['keluar', 'belanja'] }, { label: 'Pemasukan', nilai: 'MASUK', kata: ['masuk', 'pendapatan', 'penghasilan'] }]); if (!o) return 'Pilih **Pengeluaran** atau **Pemasukan**.'; d.jenis = o.nilai; } },
      { k: 'ikon', opsional: '🏷️', tanya: (d) => ({ teks: 'Pilih ikon untuk **' + d.nama + '**:', sub: 'Atau ketik emoji sendiri.', chips: IKON.map((e) => ({ label: e })).concat([{ label: 'Lewati' }]) }),
        jawab: (t, d) => { const v = String(t).trim(); if (!/\p{Extended_Pictographic}/u.test(v) || v.length > 8) return 'Ketuk salah satu ikon, atau **Lewati**.'; d.ikon = v; } }
    ],
    cek: (d) => (d.nama && S.master.kategori.some((k) => n(k.nama) === n(d.nama)) ? 'Kategori **' + d.nama + '** sudah ada 🙂' : ''),
    ringkas: (d) => ({ teks: 'Tambah kategori ' + (d.jenis === 'MASUK' ? 'pemasukan' : 'pengeluaran') + ' **' + (d.ikon || '🏷️') + ' ' + d.nama + '**?', ya: 'Simpan' }),
    async simpan(d) {
      const id = 'KAT-' + Date.now().toString(36).toUpperCase();
      await S.ubahMaster('kategori.put', { id_kategori: id, nama: d.nama, jenis: d.jenis, ikon: d.ikon || '🏷️', warna: g.Charts && g.Charts.PALET ? g.Charts.PALET[S.master.kategori.length % 10] : '#94A3B8', urutan: S.master.kategori.length + 1, aktif: true });
      return { teks: 'Kategori **' + (d.ikon || '🏷️') + ' ' + d.nama + '** sudah ditambahkan ✅', sub: d.jenis === 'KELUAR' ? 'Mau kasih anggaran? Ketik misalnya **anggaran ' + n(d.nama) + ' 300rb**.' : '' };
    }
  };
  ALUR.ubahKategori = {
    judul: 'ubah kategori', perintah: 'ganti nama kategori',
    langkah: [
      { k: 'kat', tanya: (d) => ({ teks: (d.katTeks ? 'Kategori **' + d.katTeks + '** belum ketemu. ' : '') + 'Kategori mana yang mau diganti namanya?', chips: S.kategoriAktif().slice(0, 8).map((k) => ({ label: k.nama })) }),
        jawab: (t, d) => { const k = cariKat(t); if (!k) return 'Kategori itu belum ketemu. Pilih dari tombol di atas, ya.'; d.kat = k; } },
      { k: 'nama', tanya: (d) => ({ teks: 'Nama baru untuk **' + S.kat(d.kat).nama + '**?' }),
        jawab: (t, d) => { const v = String(t).trim().slice(0, 40); if (v.length < 2) return 'Namanya terlalu pendek.'; d.nama = v.replace(/^./, (c) => c.toUpperCase()); } }
    ],
    ringkas: (d) => ({ teks: 'Ganti nama kategori **' + S.kat(d.kat).ikon + ' ' + S.kat(d.kat).nama + '** jadi **' + d.nama + '**?', sub: 'Transaksi lama ikut memakai nama baru.', ya: 'Simpan' }),
    async simpan(d) {
      const k = S.kat(d.kat), lama = k.nama;
      await S.ubahMaster('kategori.put', { id_kategori: k.id_kategori, nama: d.nama, jenis: k.jenis, ikon: k.ikon, warna: k.warna, urutan: k.urutan, aktif: k.aktif !== false });
      return { teks: 'Kategori **' + lama + '** sekarang bernama **' + d.nama + '** ✅' };
    }
  };

  ALUR.dompet = {
    judul: 'tambah dompet', perintah: 'tambah dompet',
    langkah: [
      { k: 'nama', tanya: () => ({ teks: 'Nama dompet barunya?', sub: 'Contoh: **BCA**, **GoPay**, **Celengan**' }),
        jawab: (t, d) => { const v = String(t).trim().slice(0, 30); if (v.length < 2) return 'Namanya terlalu pendek.'; if (S.master.dompet.some((x) => n(x.nama) === n(v))) return 'Dompet **' + v + '** sudah ada.'; d.nama = v; const tp = P().tipeDompetDari(v); if (tp && !d.tipe) d.tipeSaran = tp; } },
      { k: 'tipe', tanya: (d) => ({ teks: '**' + d.nama + '** termasuk jenis apa?', chips: Object.keys(TIPE).map((k) => ({ label: TIPE[k] })) }),
        jawab: (t, d) => { const o = pilih(t, Object.keys(TIPE).map((k) => ({ label: TIPE[k], nilai: k, kata: { REKENING: ['bank', 'rek'], EWALLET: ['ewallet', 'dompet digital'], TUNAI: ['cash', 'uang tunai'], TABUNGAN: ['celengan'] }[k] }))); if (!o) return 'Pilih: Rekening, E-Wallet, Tunai, atau Tabungan.'; d.tipe = o.nilai; } },
      { k: 'saldo', opsional: 0, tanya: (d) => ({ teks: 'Saldo **' + d.nama + '** sekarang berapa?', sub: 'Contoh: **1,2jt**. Ketuk **Lewati** bila mulai dari Rp0.', chips: [{ label: 'Lewati' }] }),
        jawab: (t, d) => { const v = /^0$/.test(String(t).trim()) ? 0 : P().nominalSaja(t) || (P().cariNominal(P().angkaKata(P().normal(t)))[0] || {}).nilai; if (v === undefined || v === null || isNaN(v)) return 'Ketik nominalnya, contoh **500rb**, atau **Lewati**.'; d.saldo = v; } }
    ],
    ringkas: (d) => ({ teks: 'Tambah dompet **' + d.nama + '** (' + TIPE[d.tipe] + ') dengan saldo awal **' + rp(d.saldo || 0) + '**?', sub: 'Menyimpan dompet butuh internet.', ya: 'Simpan' }),
    async simpan(d) {
      const res = await panggil('dompetSimpan', { id_dompet: '', nama: d.nama, tipe: d.tipe, pemilik: '', saldo_awal: d.saldo || 0, tanggal_saldo_awal: U.hariIni(), alias: n(d.nama), aktif: true });
      if (res.offline) return { ulang: 'Sedang offline 📴 Ketuk **Simpan** lagi saat sudah online.' };
      if (!res.success) return { selesai: true, teks: 'Belum bisa disimpan: ' + res.message };
      return { teks: 'Dompet **' + d.nama + '** sudah ditambahkan ✅ Saldo awal ' + rp(d.saldo || 0) + '.' };
    }
  };

  const tabunganUtama = () => S.dompetAktif().find((x) => x.tipe === 'TABUNGAN');
  ALUR.target = {
    judul: 'target tabungan', perintah: 'target tabungan',
    langkah: [
      { k: 'nama', opsional: 'Tabungan', tanya: () => ({ teks: 'Target tabungan untuk apa?', chips: ['Dana darurat', 'Motor', 'Rumah', 'Pendidikan', 'Liburan', 'Lewati'].map((x) => ({ label: x })) }),
        jawab: (t, d) => { const v = String(t).trim().slice(0, 40); if (v.length < 2) return 'Ketik tujuannya, contoh **Motor**.'; d.nama = v.replace(/^./, (c) => c.toUpperCase()); } },
      { k: 'nominal', tanya: (d) => ({ teks: 'Berapa target **' + d.nama + '**?', sub: 'Contoh: **15jt**' }),
        jawab: (t, d) => { const v = P().nominalSaja(t) || (P().cariNominal(P().angkaKata(P().normal(t)))[0] || {}).nilai; if (!(v >= 1000)) return 'Ketik nominalnya, contoh: **15jt**'; d.nominal = v; } },
      { k: 'tenggat', tanya: (d) => ({ teks: 'Mau tercapai kapan?', sub: 'Contoh: **24 bulan**, **Desember 2027**', chips: ['6 bulan', '1 tahun', '2 tahun', 'Akhir tahun'].map((x) => ({ label: x })) }),
        jawab: (t, d) => { const x = P().tenggatDari(t, U.hariIni()); if (!x) return 'Belum paham waktunya. Contoh: **24 bulan** atau **Desember 2027**.'; if (x.tanggal <= U.hariIni()) return 'Waktunya harus setelah hari ini, ya.'; d.tenggat = x.tanggal; } },
      { k: 'dompet', perlu: () => !tabunganUtama(), tanya: () => ({ teks: 'Uangnya dikumpulkan di dompet mana?', chips: S.dompetAktif().map((x) => ({ label: x.nama })) }),
        jawab: (t, d) => { const o = pilih(t, S.dompetAktif().map((x) => ({ label: x.nama, nilai: x.id_dompet }))); if (!o) return 'Pilih salah satu dompet di atas.'; d.dompet = o.nilai; } }
    ],
    ringkas: (d) => { const b = sisaBulan(d.tenggat); return { teks: 'Buat target **' + d.nama + '** ' + rp(d.nominal) + ' sampai **' + blnLabel(d.tenggat) + '** (' + b + ' bulan)?', sub: 'Perlu menabung ±' + rp(Math.ceil(d.nominal / b / 1000) * 1000) + ' per bulan.', ya: 'Simpan' }; },
    async simpan(d) {
      const dp = d.dompet || (tabunganUtama() || {}).id_dompet || '';
      await S.ubahMaster('target.put', { id_target: 'TGT-' + Date.now().toString(36).toUpperCase() + U.rand(3), nama: d.nama, nominal: d.nominal, tenggat: d.tenggat, id_dompet: dp, aktif: true });
      const b = sisaBulan(d.tenggat);
      return { teks: 'Target **' + d.nama + '** ' + rp(d.nominal) + ' sampai ' + blnLabel(d.tenggat) + ' sudah dibuat 🎯', sub: 'Sisihkan ±' + rp(Math.ceil(d.nominal / b / 1000) * 1000) + '/bulan, misalnya: **nabung 500rb**.', chips: [{ label: 'Lihat target', aksi: 'kirim', nilai: { teks: 'lihat target' } }] };
    }
  };

  // =================================================================
  // Mesin sesi
  // =================================================================
  Atur.aktif = () => !!sesi;
  Atur.sesi = () => sesi;
  function aturTimer() {
    clearTimeout(timer);
    const id = sesi && sesi.id;
    timer = setTimeout(() => { if (sesi && sesi.id === id) tutupKarenaLama(); }, BATAS_MENIT * 60000);
  }
  function tutupKarenaLama() {
    const a = ALUR[sesi.alur];
    sesi = null; clearTimeout(timer);
    return Chat().sistem('Sesi **' + a.judul + '** tadi saya tutup dulu karena belum dijawab 🙂 Ketik **' + a.perintah + '** lagi kapan saja.');
  }
  function tolak() {
    return Chat().tambah({ kind: 'pilihan', data: { teks: 'Maaf' + (sapa() ? ', ' + sapa() : '') + ' 🙏 Pengaturan akun, anggaran, kategori, dompet, dan target tabungan hanya bisa diubah oleh kepala keluarga (' + namaAdmin() + ').',
      sub: 'Kalau perlu perubahan, minta tolong ' + namaAdmin() + ' ya.' } });
  }
  Atur.menu = function () {
    const chips = ['Tambah akun', 'Ubah akun', 'Nonaktifkan akun', 'Atur anggaran', 'Tambah kategori', 'Ganti nama kategori', 'Tambah dompet', 'Target tabungan']
      .map((x) => ({ label: x, aksi: 'kirim', nilai: { teks: x.toLowerCase() } }));
    return Chat().tambah({ kind: 'pilihan', data: { teks: 'Ini yang bisa diatur lewat chat ⚙️', sub: admin() ? 'Ketuk salah satu, atau ketik langsung, misalnya **anggaran jajan 500rb** atau **tambah akun Rina istri**.' : 'Perubahan ini hanya bisa dilakukan kepala keluarga (' + namaAdmin() + ').',
      chips: admin() ? chips.concat([{ label: 'Buka halaman Pengaturan', aksi: 'buka', nilai: { halaman: 'atur' }, gaya: 'ghost' }]) : [{ label: 'Buka halaman Pengaturan', aksi: 'buka', nilai: { halaman: 'atur' } }] } });
  };
  /** Mulai sesi. data = isian dari pesan pertama ("tambah akun Rina istri"). */
  Atur.mulai = async function (alur, data) {
    if (!ALUR[alur]) return;
    if (!admin()) return tolak();
    if (g.Penasihat) g.Penasihat.batalkan();
    data = Object.assign({}, data || {});
    // Isian awal yang tidak valid dibuang (akan ditanyakan)
    if ('orang' in data && !data.orang) delete data.orang;
    if (data.orang && ALUR[alur].langkah.some((l) => l.k === 'orang')) {
      const a = S.orang(data.orang);
      if (alur === 'nonaktif' && a.aktif === false) return Chat().sistem('Akun **' + a.nama + '** memang sudah nonaktif 🙂 Untuk mengaktifkan: **aktifkan akun ' + n(a.nama) + '**');
      if (alur === 'aktifkan' && a.aktif !== false) return Chat().sistem('Akun **' + a.nama + '** masih aktif kok 🙂');
    }
    if (alur === 'ubahAkun') { if (!data.peran) delete data.peran; if (!data.nama) delete data.nama; }
    if (alur === 'ubahKategori' && !data.kat) delete data.kat;
    if (alur === 'ubahKategori' && !data.nama) delete data.nama;
    if (alur === 'akun' && data.nama && S.master.anggota.some((a) => n(a.nama) === n(data.nama))) data.namaSama = data.nama;
    sesi = { id: 'SES' + Date.now().toString(36), alur, data, riwayat: [], akhir: Date.now(), tahap: null };
    const cek = ALUR[alur].cek && ALUR[alur].cek(data);
    if (cek) { sesi = null; return Chat().sistem(cek); }
    if (data.namaSama) await Chat().sistem('Catatan: sudah ada anggota bernama **' + data.namaSama + '**. Lanjut membuat akun baru dengan nama yang sama.');
    return lanjut();
  };
  function langkahList() { return ALUR[sesi.alur].langkah.filter((l) => !l.perlu || l.perlu(sesi.data)); }
  async function lanjut() {
    const a = ALUR[sesi.alur], d = sesi.data;
    const L = langkahList();
    const l = L.find((x) => d[x.k] === undefined);
    if (!l) return tampilRingkas();
    sesi.tahap = l.k;
    const q = l.tanya(d);
    const ke = L.indexOf(l) + 1;
    aturTimer();
    return Chat().tambah({ kind: 'pilihan', data: { teks: q.teks, sub: [q.sub, 'Langkah ' + ke + ' dari ' + (L.length + 1) + ' · ketik **batal** untuk berhenti' + (sesi.riwayat.length ? ', **kembali** untuk mengubah jawaban sebelumnya' : '')].filter(Boolean).join('\n'),
      chips: (q.chips || []).map((c) => ({ label: c.label, aksi: 'sesi', nilai: { teks: c.label, sesi: sesi.id } })), sesi: sesi.id } });
  }
  async function tampilRingkas() {
    const a = ALUR[sesi.alur];
    sesi.tahap = '_ringkas';
    const r = a.ringkas(sesi.data);
    aturTimer();
    return Chat().tambah({ kind: 'pilihan', data: { teks: r.teks, sub: [r.sub, 'Ketik **kembali** untuk mengubah jawaban.'].filter(Boolean).join('\n'),
      chips: [{ label: r.ya || 'Simpan', aksi: 'sesi', nilai: { teks: 'ya', sesi: sesi.id }, gaya: 'acc' }, { label: 'Batal', aksi: 'sesi', nilai: { teks: 'batal', sesi: sesi.id } }], sesi: sesi.id } });
  }
  /** Pesan pengguna selama sesi → jawaban. Mengembalikan true bila sudah ditangani. */
  Atur.terima = async function (teks, dariChip) {
    if (!sesi) return false;
    if (Date.now() - sesi.akhir > BATAS_MENIT * 60000) { await tutupKarenaLama(); return false; }
    sesi.akhir = Date.now();
    const a = ALUR[sesi.alur], d = sesi.data, t = n(teks);
    if (RE_BATAL.test(t)) { sesi = null; clearTimeout(timer); await Chat().sistem('Oke, ' + a.judul + ' dibatalkan 👌 Tidak ada yang diubah.'); return true; }
    if (RE_KEMBALI.test(t)) {
      const k = sesi.riwayat.pop();
      if (!k) { await Chat().sistem('Ini sudah pertanyaan pertama 🙂'); await lanjut(); return true; }
      delete d[k];
      await lanjut(); return true;
    }
    if (sesi.tahap === '_ringkas') {
      if (RE_YA.test(t) || t === n(a.ringkas(d).ya || 'simpan')) {
        const r = await a.simpan(d);
        if (r.ulang) { await Chat().tambah({ kind: 'pilihan', data: { teks: r.ulang, chips: [{ label: a.ringkas(d).ya || 'Simpan', aksi: 'sesi', nilai: { teks: 'ya', sesi: sesi.id }, gaya: 'acc' }, { label: 'Batal', aksi: 'sesi', nilai: { teks: 'batal', sesi: sesi.id } }], sesi: sesi.id } }); return true; }
        sesi = null; clearTimeout(timer);
        await Chat().tambah({ kind: 'pilihan', data: { teks: r.teks, sub: r.sub || '', chips: r.chips || [] } });
        return true;
      }
      if (/^(tidak|nggak|gak|ga|no|jangan|enggak|tdk)$/.test(t)) { sesi = null; clearTimeout(timer); await Chat().sistem('Oke, tidak jadi 👌 Tidak ada yang diubah.'); return true; }
      await Chat().sistem('Ketuk **' + (a.ringkas(d).ya || 'Simpan') + '** untuk menyimpan, **kembali** untuk mengubah, atau **batal**.');
      return true;
    }
    const l = langkahList().find((x) => x.k === sesi.tahap);
    if (!l) { await lanjut(); return true; }
    if (l.rahasia && !dariChip) await samarkanPesanTerakhir();
    if (RE_LEWATI.test(t) || (t === 'lewati')) {
      if (l.opsional === undefined) { await ulangTanya(l, 'Bagian ini perlu diisi ya 🙏'); return true; }
      d[l.k] = l.opsional;
    } else {
      const salah = l.jawab(teks, d);
      if (salah) { await ulangTanya(l, salah); return true; }
    }
    sesi.riwayat.push(l.k);
    await lanjut();
    return true;
  };
  /** Jawaban belum bisa dipakai → jelaskan singkat, tampilkan lagi pilihan yang sama */
  function ulangTanya(l, pesan) {
    aturTimer();
    return Chat().tambah({ kind: 'pilihan', data: { teks: pesan, sub: 'Ketik **batal** untuk berhenti.',
      chips: ((l.tanya(sesi.data).chips) || []).map((c) => ({ label: c.label, aksi: 'sesi', nilai: { teks: c.label, sesi: sesi.id } })), sesi: sesi.id } });
  }
  /** Password yang diketik tidak ditampilkan/tersimpan utuh di riwayat chat */
  async function samarkanPesanTerakhir() {
    const m = Chat()._ref ? Chat().cari(Chat()._ref) : null;
    if (m && m.from === 'me') { m.data.teks = '••••••'; await Chat().ubah(m); }
  }
  /** Tombol jawaban di gelembung sesi */
  Atur.chip = async function (v) {
    if (!sesi || sesi.id !== v.sesi) return Chat().sistem('Sesi itu sudah selesai 🙂');
    return Atur.terima(v.teks, true);
  };
  Atur.batalkan = () => { sesi = null; clearTimeout(timer); };

  // =================================================================
  // Target tabungan: daftar & hapus
  // =================================================================
  Atur.targetDaftar = function () {
    const xs = (S.master.target || []).filter((x) => x.aktif !== false);
    if (!xs.length) return Chat().tambah({ kind: 'pilihan', data: { teks: 'Belum ada target tabungan 🎯', sub: 'Contoh: **target tabungan motor 15jt 24 bulan**', chips: admin() ? [{ label: 'Buat target', aksi: 'kirim', nilai: { teks: 'target tabungan' } }] : [] } });
    const saldo = (id) => { const s = S.saldoDompet().find((x) => x.dompet.id_dompet === id); return s ? s.saldo : 0; };
    const baris = xs.map((x) => { const b = sisaBulan(x.tenggat); return '• **' + x.nama + '**: ' + rp(x.nominal) + ' sampai ' + blnLabel(x.tenggat) + ' → ±' + rp(Math.ceil(x.nominal / b / 1000) * 1000) + '/bulan'; });
    const dps = Array.from(new Set(xs.map((x) => x.id_dompet).filter(Boolean)));
    const sub = dps.map((id) => 'Saldo ' + (S.dompet(id) || {}).nama + ' sekarang: ' + rp(saldo(id))).join(' · ');
    return Chat().tambah({ kind: 'pilihan', data: { teks: 'Target tabungan 🎯\n' + baris.join('\n'), sub } });
  };
  Atur.targetHapus = function (kata) {
    if (!admin()) return tolak();
    const xs = (S.master.target || []).filter((x) => x.aktif !== false);
    const k = n(kata);
    const c = k ? xs.filter((x) => n(x.nama).indexOf(k) > -1 || P().lev(n(x.nama), k) <= 1) : xs;
    if (!c.length) return Chat().sistem(xs.length ? 'Target **' + kata + '** tidak ketemu 🤔 Ketik **lihat target**.' : 'Belum ada target tabungan 🙂');
    return Chat().tambah({ kind: 'pilihan', data: { teks: c.length === 1 ? 'Hapus target **' + c[0].nama + '** (' + rp(c[0].nominal) + ')?' : 'Target mana yang dihapus?',
      sub: 'Uang di dompet tidak berubah.', chips: c.slice(0, 5).map((x) => ({ label: c.length === 1 ? 'Hapus' : '🗑️ ' + x.nama, aksi: 'targetHapusYa', nilai: { id: x.id_target }, gaya: c.length === 1 ? 'acc' : undefined })).concat([{ label: 'Batal', aksi: 'tutup' }]) } });
  };
  Atur.targetHapusYa = async function (id) {
    const x = (S.master.target || []).find((y) => y.id_target === id);
    if (!x) return;
    await S.ubahMaster('target.put', Object.assign({}, x, { aktif: false }));
    return Chat().sistem('Target **' + x.nama + '** sudah dihapus 🧽');
  };

  Atur.ALUR = ALUR;
  g.Atur = Atur;
})(window);
