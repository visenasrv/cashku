/* CashKu — Penasihat Keuangan (1.0.15)
 * "bagi gaji 5jt" → 5 pertanyaan singkat → kartu saran (Kebutuhan / Keinginan / Tabungan) → [Terapkan ke anggaran].
 * Perubahan kondisi ("cicilan nambah 400rb") dihitung ulang tanpa mengulang pertanyaan.
 * Tanpa AI: semua aturan ada di penasihat-hitung.js + sheet Aturan_Penasihat.
 */
(function (g) {
  'use strict';
  const BATAS_MENIT = 10;
  const Pn = {};
  let sesi = null, timer = null, tunda = null;
  const H = () => g.PenasihatHitung;
  const P = () => g.Parser;
  const Chat = () => g.Chat;
  const n = (t) => P().normal(String(t || '')).replace(/[^a-z0-9+ ]/g, ' ').replace(/\s+/g, ' ').trim();
  const rp = (x) => U.rp(x);
  const fp = (x) => H().fp(x);
  const admin = () => !!S.saya && S.saya.peran === 'ADMIN';
  const sapa = () => (S.sapa ? S.sapa() : '');
  const namaAdmin = () => (S.anggotaAktif().find((a) => a.peran === 'ADMIN') || {}).nama || 'Admin';
  const M = () => S.master.penasihat || {};
  const salin = (x) => JSON.parse(JSON.stringify(x || {}));
  const WARNA = { kebutuhan: '#2563EB', keinginan: '#F59E0B', tabungan: '#16A34A' };
  const LABEL = { kebutuhan: 'Kebutuhan', keinginan: 'Keinginan', tabungan: 'Tabungan' };
  const IKON = { kebutuhan: '🏠', keinginan: '🎉', tabungan: '💰' };

  const PERTANYAAN_BAWAAN = [
    { kunci: 'pendapatan', urutan: 1, teks: 'Berapa total pendapatan keluarga per bulan?', keterangan: 'Contoh: **5jt**', pilihan: '' },
    { kunci: 'tanggungan', urutan: 2, teks: 'Berapa orang yang jadi tanggungan?', keterangan: 'Hitung semua yang dibiayai, termasuk diri sendiri.', pilihan: '1,2,3,4+' },
    { kunci: 'cicilan', urutan: 3, teks: 'Total cicilan per bulan berapa?', keterangan: 'KPR, motor, pinjaman, kartu kredit, paylater.', pilihan: 'Tidak ada,500rb,1jt' },
    { kunci: 'dana_darurat', urutan: 4, teks: 'Dana darurat sudah ada?', keterangan: 'Cukup = minimal 3× kebutuhan sebulan.', pilihan: 'Belum,Sebagian,Cukup' },
    { kunci: 'tujuan', urutan: 5, teks: 'Tujuan utama menabung apa? Boleh lebih dari satu.', keterangan: 'Ketuk salah satu, atau ketik langsung, misalnya **motor 15jt 24 bulan**.', pilihan: 'Kendaraan,Rumah/tanah,Pendidikan,Ibadah,Usaha,Lunasi utang' }
  ];
  const BAWAAN_LEWATI = { tanggungan: 1, cicilan: 0, dana_darurat: 'BELUM', tujuan: [] };
  const KET_LEWATI = { tanggungan: 'tanggungan 1 orang', cicilan: 'tidak ada cicilan', dana_darurat: 'dana darurat belum ada', tujuan: 'tanpa tujuan khusus' };
  function daftarPertanyaan() {
    const xs = (M().pertanyaan && M().pertanyaan.length ? M().pertanyaan : PERTANYAAN_BAWAAN).filter((q) => q.aktif !== false && String(q.aktif) !== 'false');
    return xs.slice().sort((a, b) => (Number(a.urutan) || 0) - (Number(b.urutan) || 0));
  }

  // ------------------------------------------------------------------
  // Membaca jawaban (salah ketik dimaklumi: "blm" = belum)
  // ------------------------------------------------------------------
  const PILIH_DD = [{ nilai: 'BELUM', kata: ['belum', 'blm', 'belom', 'blum', 'belon', 'tidak ada', 'gak ada', 'nggak ada', 'ga ada', 'belum ada', 'kosong', 'tidak', 'nggak', 'gak', 'ga', 'habis'] },
    { nilai: 'SEBAGIAN', kata: ['sebagian', 'sbgn', 'sbagian', 'sebagain', 'sedikit', 'dikit', 'separuh', 'setengah', 'ada sedikit', 'lumayan', 'sebgian', 'baru sebagian'] },
    { nilai: 'CUKUP', kata: ['cukup', 'ckp', 'cukp', 'sudah', 'sdh', 'udah', 'udh', 'ada', 'aman', 'sudah cukup', 'sudah ada', 'banyak'] }];
  function pilihDari(t, opsi) {
    const x = n(t);
    if (!x) return null;
    let o = opsi.find((p) => p.kata.some((k) => k === x));
    if (o) return o;
    o = opsi.filter((p) => p.kata.some((k) => (x.length >= 3 && k.indexOf(x) === 0) || (x.length >= 4 && k.length >= 4 && P().lev(k, x) <= 1)));
    return o.length === 1 ? o[0] : null;
  }
  function nominal(t) {
    const s = P().angkaKata(P().normal(String(t)));
    if (/^(tidak ada|gak ada|nggak ada|ga ada|tidak|nggak|gak|ga|0|nol|kosong|belum ada|ngga ada|enggak ada)$/.test(n(t))) return 0;
    const a = P().cariNominal(s).filter((x) => x.nilai >= 0);
    return a.length ? a[a.length - 1].nilai : null;
  }
  const ANGKA = { satu: 1, sendiri: 1, dua: 2, berdua: 2, tiga: 3, bertiga: 3, empat: 4, berempat: 4, lima: 5, berlima: 5, enam: 6, berenam: 6, tujuh: 7 };
  function jawab(kunci, teks, d) {
    const t = n(teks);
    if (kunci === 'pendapatan') {
      const v = nominal(teks);
      if (v === null || v <= 0) return 'Ketik pendapatannya, contoh: **5jt** atau **4,5jt**';
      if (v < 1000) return 'Maksudnya ' + rp(v * 1000) + ' atau ' + rp(v * 1000000) + '? Ketik lengkap, misalnya **' + v + 'jt** atau **' + v + 'rb**.';
      d.pendapatan = v; return '';
    }
    if (kunci === 'tanggungan') {
      let v = /^(\d+)\s*\+?(?:\s*orang)?$/.test(t) ? Number(/^(\d+)/.exec(t)[1]) : ANGKA[t.replace(/\s*orang$/, '')] || 0;
      if (!v) { const m = /(\d+)/.exec(t); if (m) v = Number(m[1]); }
      if (!v || v > 30) return 'Ketik jumlah orangnya, misalnya **3**, atau pilih tombolnya.';
      d.tanggungan = v; return '';
    }
    if (kunci === 'cicilan') {
      const v = nominal(teks);
      if (v === null) return 'Ketik total cicilannya, contoh **600rb**, atau **Tidak ada**.';
      if (v > 0 && v < 1000) return 'Maksudnya ' + rp(v * 1000) + '? Ketik **' + v + 'rb** ya.';
      d.cicilan = v; return '';
    }
    if (kunci === 'dana_darurat') {
      const o = pilihDari(teks, PILIH_DD);
      if (!o) return 'Pilih **Belum**, **Sebagian**, atau **Cukup**.';
      d.dana_darurat = o.nilai; return '';
    }
    // pertanyaan tambahan dari sheet
    const q = daftarPertanyaan().find((x) => x.kunci === kunci) || {};
    const ops = String(q.pilihan || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (ops.length) { const o = pilihDari(teks, ops.map((s) => ({ nilai: s, kata: [n(s)] }))); if (!o) return 'Pilih salah satu: ' + ops.join(', ') + '.'; d.lain[kunci] = o.nilai; return ''; }
    d.lain[kunci] = String(teks).trim().slice(0, 100); return '';
  }

  // ------------------------------------------------------------------
  // Sesi tanya-jawab
  // ------------------------------------------------------------------
  Pn.aktif = () => !!sesi;
  Pn.sesi = () => sesi;
  Pn.batalkan = () => { sesi = null; clearTimeout(timer); };
  function aturTimer() {
    clearTimeout(timer);
    const id = sesi && sesi.id;
    timer = setTimeout(() => { if (sesi && sesi.id === id) tutupKarenaLama(); }, BATAS_MENIT * 60000);
  }
  function tutupKarenaLama() {
    sesi = null; clearTimeout(timer);
    return Chat().sistem('Sesi penasihat tadi saya tutup dulu karena belum dijawab 🙂 Ketik **penasihat** lagi kapan saja.');
  }
  function pemasukanTercatat() {
    const h = U.hariIni(), awal = h.slice(0, 8) + '01';
    const jumlah = (mulai, sampai) => S.txTerlihat({ mulai, sampai, jenis: 'MASUK' }).reduce((s, t) => s + (Number(t.nominal) || 0), 0);
    const ini = jumlah(awal, h);
    if (ini > 0) return { rp: ini, label: 'tercatat bulan ini' };
    const d = U.parseTgl(awal); d.setMonth(d.getMonth() - 1);
    const a2 = U.tglStr(d), d2 = U.parseTgl(awal); d2.setDate(0);
    const lalu = jumlah(a2, U.tglStr(d2));
    return lalu > 0 ? { rp: lalu, label: 'bulan lalu' } : null;
  }
  /** Mulai sesi. it.pendapatan dari pesan ("bagi gaji 5jt") melewati pertanyaan pertama. */
  Pn.mulai = async function (it, opsi) {
    it = it || {}; opsi = opsi || {};
    if (g.Atur) g.Atur.batalkan();
    Chat().pending = null;
    const d = opsi.data || { tujuan: undefined, lain: {} };
    if (it.pendapatan) d.pendapatan = it.pendapatan;
    sesi = { id: 'PN' + Date.now().toString(36), data: d, asumsi: opsi.asumsi || [], riwayat: [], akhir: Date.now(), tahap: null, sub: null, mode: opsi.mode || 'baru' };
    if (!opsi.diam) {
      await Chat().tambah({ kind: 'pilihan', data: { teks: 'Siap' + (sapa() ? ', ' + sapa() : '') + '! Aku bantu bagi pendapatan jadi **kebutuhan**, **keinginan**, dan **tabungan** 💡',
        sub: (d.pendapatan ? 'Pendapatan ' + rp(d.pendapatan) + ' sudah aku catat. ' : '') + 'Cukup jawab beberapa pertanyaan singkat. Ketik **batal**, **lewati**, atau **lihat hasil sekarang** kapan saja.' } });
    }
    return lanjut();
  };
  function chipsSesi(labels) { return labels.map((c) => ({ label: c.label || c, aksi: 'pnSesi', nilai: { teks: c.teks || c.label || c, sesi: sesi.id } })); }
  async function lanjut() {
    const d = sesi.data, Q = daftarPertanyaan();
    const q = Q.find((x) => (x.kunci === 'tujuan' ? d.tujuan === undefined : (x.kunci in BAWAAN_LEWATI || x.kunci === 'pendapatan') ? d[x.kunci] === undefined : d.lain[x.kunci] === undefined));
    if (!q) return selesai();
    sesi.tahap = q.kunci;
    aturTimer();
    const ke = Q.indexOf(q) + 1;
    const sub = (q.keterangan ? q.keterangan + '\n' : '') + ke + ' dari ' + Q.length + ' · **batal** · **lewati** · **lihat hasil sekarang**';
    let chips = String(q.pilihan || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (q.kunci === 'pendapatan') {
      chips = [];
      const tc = pemasukanTercatat();
      if (tc) chips.push({ label: rp(tc.rp) + ' (' + tc.label + ')', teks: String(tc.rp) });
      const lama = (M().profil || {}).pendapatan;
      if (lama && (!tc || Number(lama) !== tc.rp)) chips.push({ label: rp(lama) + ' (terakhir)', teks: String(lama) });
    }
    if (q.kunci === 'tujuan') {
      const ada = (S.master.target || []).filter((x) => x.aktif !== false);
      if (ada.length && !sesi.sub) chips = [{ label: 'Pakai target yang ada (' + ada.map((x) => x.nama).join(', ') + ')', teks: 'pakai target' }].concat(chips);
      if (sesi.sub === 'lagi') {
        const sudah = new Set((sesi.tujuanSementara || []).map((x) => x.jenis));
        const sisa = chips.filter((c) => !sudah.has(jenisLabel(c)));
        return Chat().tambah({ kind: 'pilihan', data: { teks: 'Ada tujuan lain?', sub: ke + ' dari ' + Q.length + ' · ketik misalnya **umroh 40jt 3 tahun**', chips: chipsSesi([{ label: 'Sudah, lihat hasil', teks: 'sudah' }].concat(sisa)) } });
      }
      if (sesi.sub && sesi.sub.jenis) {
        const s = sesi.sub;
        const t = !s.target ? 'Target **' + s.nama + '** berapa, dan dalam berapa lama?' : 'Mau tercapai dalam berapa lama?';
        return Chat().tambah({ kind: 'pilihan', data: { teks: t, sub: (!s.target ? 'Contoh: **' + contohTujuan(s.jenis) + '**\n' : '') + ke + ' dari ' + Q.length,
          chips: chipsSesi(s.target ? ['12 bulan', '24 bulan', '36 bulan', '5 tahun'] : []) } });
      }
    }
    return Chat().tambah({ kind: 'pilihan', data: { teks: q.teks, sub, chips: chipsSesi(chips) } });
  }
  const jenisLabel = (label) => { const j = P().JENIS_TUJUAN.find((x) => x[2] === label || x[1].test(n(label))); return j ? j[0] : 'LAIN'; };
  const contohTujuan = (j) => ({ KENDARAAN: 'motor 15jt 24 bulan', RUMAH: 'DP rumah 50jt 3 tahun', PENDIDIKAN: 'kuliah anak 30jt 4 tahun', IBADAH: 'umroh 40jt 3 tahun', USAHA: 'modal usaha 10jt 12 bulan', UTANG: 'lunasi utang 5jt 10 bulan' }[j] || 'motor 15jt 24 bulan');
  const RE_BATAL = /^(batal|batalkan|stop|keluar|cancel|ga jadi|gak jadi|nggak jadi|tidak jadi|udahan|sudahan|gajadi)$/;
  const RE_LEWATI = /^(lewati|lewat|skip|lewatin|nanti saja|nanti aja|terserah|bebas|pass)$/;
  const RE_HASIL = /^(lihat hasil( sekarang)?|hasil( sekarang)?|hasilnya|hitung( sekarang)?|langsung (lihat )?hasil(nya)?|lihat hasilnya)$/;
  const RE_KEMBALI = /^(kembali|balik|back|sebelumnya|mundur)$/;
  /** Pesan pengguna selama sesi → jawaban (bukan transaksi). true = sudah ditangani. */
  Pn.terima = async function (teks, dariChip) {
    if (!sesi) return false;
    if (Date.now() - sesi.akhir > BATAS_MENIT * 60000) { await tutupKarenaLama(); return false; }
    sesi.akhir = Date.now();
    const d = sesi.data, t = n(teks), k = sesi.tahap;
    if (RE_BATAL.test(t)) { sesi = null; clearTimeout(timer); await Chat().sistem('Oke, penasihat dibatalkan 👌 Ketik **penasihat** kapan saja.'); return true; }
    if (RE_HASIL.test(t)) {
      if (!d.pendapatan) { await Chat().sistem('Pendapatannya dulu ya, supaya bisa dihitung 🙂'); sesi.tahap = null; await lanjut(); return true; }
      tutupTujuanSementara();
      daftarPertanyaan().forEach((q) => { if (q.kunci in BAWAAN_LEWATI && (q.kunci === 'tujuan' ? d.tujuan === undefined : d[q.kunci] === undefined)) { d[q.kunci] = salin(BAWAAN_LEWATI[q.kunci]); sesi.asumsi.push(KET_LEWATI[q.kunci]); } });
      await selesai(); return true;
    }
    if (RE_KEMBALI.test(t)) {
      const kb = sesi.riwayat.pop();
      if (!kb) { await Chat().sistem('Ini sudah pertanyaan pertama 🙂'); await lanjut(); return true; }
      if (kb === 'tujuan') { d.tujuan = undefined; sesi.tujuanSementara = []; } else if (kb in d) delete d[kb]; else delete d.lain[kb];
      sesi.sub = null; await lanjut(); return true;
    }
    if (k === 'tujuan') return terimaTujuan(teks, t);
    if (RE_LEWATI.test(t)) {
      if (k === 'pendapatan') { await ulang('Pendapatan perlu diisi supaya bisa dihitung 🙏'); return true; }
      if (k in BAWAAN_LEWATI) { d[k] = salin(BAWAAN_LEWATI[k]); sesi.asumsi.push(KET_LEWATI[k]); } else d.lain[k] = '';
      sesi.riwayat.push(k); await lanjut(); return true;
    }
    const salah = jawab(k, teks, d);
    if (salah) { await ulang(salah); return true; }
    sesi.riwayat.push(k);
    await lanjut();
    return true;
  };
  function ulang(pesan) {
    aturTimer();
    const q = daftarPertanyaan().find((x) => x.kunci === sesi.tahap) || {};
    const chips = String(q.pilihan || '').split(',').map((s) => s.trim()).filter(Boolean);
    return Chat().tambah({ kind: 'pilihan', data: { teks: pesan, sub: 'Ketik **batal** untuk berhenti.', chips: chipsSesi(chips) } });
  }
  function tutupTujuanSementara() {
    if (sesi.tahap === 'tujuan' || sesi.tujuanSementara) {
      if (sesi.data.tujuan === undefined && sesi.tujuanSementara && sesi.tujuanSementara.length) sesi.data.tujuan = sesi.tujuanSementara;
    }
  }
  async function terimaTujuan(teks, t) {
    const d = sesi.data;
    sesi.tujuanSementara = sesi.tujuanSementara || [];
    const selesaikan = async () => { d.tujuan = sesi.tujuanSementara; sesi.sub = null; sesi.riwayat.push('tujuan'); return lanjut(); };
    if (RE_LEWATI.test(t) || /^(sudah|udah|sdh|cukup|tidak ada|gak ada|nggak ada|tidak|nggak|selesai|sudah lihat hasil|sudah, lihat hasil|itu saja|itu aja)$/.test(t)) {
      if (!sesi.tujuanSementara.length && RE_LEWATI.test(t)) sesi.asumsi.push(KET_LEWATI.tujuan);
      await selesaikan(); return true;
    }
    if (/^pakai target/.test(t)) {
      (S.master.target || []).filter((x) => x.aktif !== false).forEach((x) => {
        const bln = Math.max(1, (Number(x.tenggat.slice(0, 4)) - Number(U.hariIni().slice(0, 4))) * 12 + (Number(x.tenggat.slice(5, 7)) - Number(U.hariIni().slice(5, 7))));
        sesi.tujuanSementara.push({ nama: x.nama, jenis: jenisLabel(x.nama), target: x.nominal, bulan: bln });
      });
      sesi.sub = 'lagi'; await lanjut(); return true;
    }
    // Sedang melengkapi satu tujuan
    if (sesi.sub && sesi.sub.jenis) {
      const s = sesi.sub;
      const x = (P().tujuanDari(teks, U.hariIni())[0]) || {};
      const nom = x.target || nominal(teks);
      if (!s.target && nom >= 10000) s.target = nom;
      if (x.bulan) s.bulan = x.bulan; else { const tg = P().tenggatDari(teks, U.hariIni()); if (tg) s.bulan = tg.bulan; }
      if (x.nama && x.jenis === s.jenis && !/^(Kendaraan|Rumah\/tanah|Pendidikan|Ibadah|Usaha|Lunasi utang|Tabungan)$/.test(x.nama)) s.nama = x.nama;
      if (!s.target) { await Chat().sistem('Targetnya berapa? Contoh: **' + contohTujuan(s.jenis) + '**'); return true; }
      if (!s.bulan) { await lanjut(); return true; }
      sesi.tujuanSementara.push({ nama: s.nama, jenis: s.jenis, target: s.target, bulan: s.bulan });
      sesi.sub = 'lagi'; await lanjut(); return true;
    }
    // Ketik langsung: "motor 15jt 24 bulan, umroh 40jt 3 tahun"
    const xs = P().tujuanDari(teks, U.hariIni());
    if (xs.length && xs.some((x) => x.target)) {
      xs.forEach((x) => { if (x.target && x.bulan) sesi.tujuanSementara.push(x); });
      const kurang = xs.find((x) => !x.target || !x.bulan);
      if (kurang) { sesi.sub = { jenis: kurang.jenis, nama: kurang.nama, target: kurang.target, bulan: kurang.bulan }; await lanjut(); return true; }
      sesi.sub = 'lagi'; await lanjut(); return true;
    }
    // Pilih jenis (tombol)
    const j = P().JENIS_TUJUAN.find((x) => n(x[2]) === t || x[1].test(t)) || (pilihDari(teks, P().JENIS_TUJUAN.map((x) => ({ nilai: x[0], kata: [n(x[2]), x[0].toLowerCase()] }))) && P().JENIS_TUJUAN.find((x) => x[0] === pilihDari(teks, P().JENIS_TUJUAN.map((y) => ({ nilai: y[0], kata: [n(y[2]), y[0].toLowerCase()] }))).nilai));
    if (j) {
      const x = xs[0] || {};
      sesi.sub = { jenis: j[0], nama: x.nama && x.nama !== j[2] ? x.nama : j[2], target: x.target, bulan: x.bulan };
      await lanjut(); return true;
    }
    await Chat().tambah({ kind: 'pilihan', data: { teks: 'Belum paham tujuannya 🤔 Ketuk salah satu, atau ketik misalnya **motor 15jt 24 bulan**.', sub: 'Ketik **sudah** bila tidak ada tujuan lain.', chips: chipsSesi(daftarPertanyaan().find((q) => q.kunci === 'tujuan').pilihan.split(',').map((s) => s.trim()).concat(['Lewati'])) } });
    return true;
  }
  Pn.chip = async function (v) {
    if (!sesi || sesi.id !== v.sesi) return Chat().sistem('Sesi itu sudah selesai 🙂 Ketik **penasihat** untuk mulai lagi.');
    return Pn.terima(v.teks, true);
  };
  async function selesai() {
    const s = sesi;
    sesi = null; clearTimeout(timer);
    const lama = M().profil || {};
    const d = s.data;
    const profil = { pendapatan: d.pendapatan, tanggungan: d.tanggungan, cicilan: d.cicilan, dana_darurat: d.dana_darurat, tujuan: d.tujuan || [], lain: d.lain || {},
      ekstra_tabungan: s.mode === 'ubah' ? lama.ekstra_tabungan || 0 : 0 };
    return Pn.tampilHasil(profil, { asumsi: s.asumsi, sumber: s.mode === 'ubah' ? 'UBAH' : 'SESI' });
  }

  // ------------------------------------------------------------------
  // Kartu hasil
  // ------------------------------------------------------------------
  Pn.tampilHasil = async function (profil, opsi) {
    opsi = opsi || {};
    const hasil = H().hitung(profil, M().aturan);
    const idR = 'PNR-' + Date.now().toString(36).toUpperCase() + U.rand(3);
    if (admin()) await simpanProfil(profil);
    catatRiwayat(idR, profil, hasil, opsi.sumber || 'SESI', 'SARAN');
    const chips = [];
    if (hasil.bisaPercepat) chips.push({ label: '⚡ Percepat', aksi: 'pn', nilai: { aksi: 'percepat' }, gaya: 'acc' });
    if (admin()) chips.push({ label: 'Terapkan ke anggaran', aksi: 'pn', nilai: { aksi: 'terapkan' }, gaya: hasil.bisaPercepat ? '' : 'acc' });
    chips.push({ label: 'Ubah angka', aksi: 'pn', nilai: { aksi: 'ubah' } });
    chips.push({ label: 'Tutup', aksi: 'pn', nilai: { aksi: 'tutup' }, gaya: 'ghost' });
    return Chat().tambah({ kind: 'saran', data: { mode: 'hasil', profil, hasil, asumsi: opsi.asumsi || [], idR, chips,
      catatan: admin() ? '' : 'Hanya Admin (' + namaAdmin() + ') yang bisa menerapkan saran ini ke anggaran.' } });
  };
  const persenTeks = (x) => fp(x) + '%';
  function barisRincian(r) {
    if (r.kunci === 'DANA_DARURAT') return 'Dana darurat ' + rp(r.rp) + ' · target ' + rp(r.target) + (r.sebagian ? ' (sudah ada sebagian)' : ' (±' + r.bulanTercapai + ' bulan)');
    if (r.kunci === 'TUJUAN') return r.nama + ' ' + rp(r.rp) + ' · ' + rp(r.target) + (r.bulanTercapai ? ' tercapai ' + r.bulanTercapai + ' bulan' : '') + (r.bulanTercapai && r.bulanTercapai > r.bulan ? ' (target ' + r.bulan + ')' : '');
    return r.nama + ' ' + rp(r.rp);
  }
  function htmlKartu(m) {
    const d = m.data, e = U.esc, ta = Chat().teksAman;
    let h = '<div class="pn-card">';
    if (d.mode === 'banding') {
      const a = d.sebelum, b = d.sesudah;
      h += '<div class="pn-h">🔄 ' + e(d.judul) + '</div>';
      h += '<div class="pn-bar">' + ['kebutuhan', 'keinginan', 'tabungan'].map((k) => '<i style="width:' + b[k].persen + '%;background:' + WARNA[k] + '"></i>').join('') + '</div>';
      ['kebutuhan', 'keinginan', 'tabungan'].forEach((k) => {
        const naik = b[k].rp - a[k].rp;
        h += '<div class="pn-r"><span class="pn-dot" style="background:' + WARNA[k] + '"></span><div class="grow"><div class="pn-t"><b>' + LABEL[k] + '</b> <span class="pn-p">' + persenTeks(a[k].persen) + ' → ' + persenTeks(b[k].persen) + '</span></div>' +
          '<div class="pn-a">' + rp(a[k].rp) + ' → <b>' + rp(b[k].rp) + '</b></div></div>' +
          '<div class="pn-rp num ' + (naik > 0 ? 'pn-naik' : naik < 0 ? 'pn-turun' : '') + '">' + (naik > 0 ? '+' : naik < 0 ? '−' : '') + (naik ? rp(Math.abs(naik)) : '=') + '</div></div>';
      });
      if (b.tabungan.rincian.length) h += '<div class="pn-sub">' + b.tabungan.rincian.map((r) => '• ' + e(barisRincian(r))).join('<br>') + '</div>';
      if (d.kelonggaran) h += '<div class="pn-ok">💡 ' + ta(d.kelonggaran) + '</div>';
      (b.peringatan || []).forEach((w) => { h += '<div class="pn-w">⚠️ ' + e(w) + '</div>'; });
      h += '<div class="pn-n">Transaksi lama tidak berubah. Anggaran hanya diganti bila dipilih.</div>';
    } else {
      const r = d.hasil;
      h += '<div class="pn-h">💡 Saran pembagian pendapatan</div><div class="pn-total num">' + rp(r.pendapatan) + '<span>/bulan</span></div>';
      h += '<div class="pn-bar">' + ['kebutuhan', 'keinginan', 'tabungan'].map((k) => '<i style="width:' + r[k].persen + '%;background:' + WARNA[k] + '"></i>').join('') + '</div>';
      ['kebutuhan', 'keinginan', 'tabungan'].forEach((k) => {
        h += '<div class="pn-r"><span class="pn-dot" style="background:' + WARNA[k] + '"></span><div class="grow"><div class="pn-t">' + IKON[k] + ' <b>' + LABEL[k] + '</b> <span class="pn-p">' + persenTeks(r[k].persen) + '</span></div>' +
          '<div class="pn-a">' + e(r[k].alasan) + '</div></div><div class="pn-rp num">' + rp(r[k].rp) + '</div></div>';
        if (k === 'tabungan' && r.tabungan.rincian.length) h += '<div class="pn-sub">' + r.tabungan.rincian.map((x) => '• ' + e(barisRincian(x))).join('<br>') + '</div>';
      });
      (r.peringatan || []).forEach((w) => { h += '<div class="pn-w">⚠️ ' + e(w) + '</div>'; });
      if (d.asumsi && d.asumsi.length) h += '<div class="pn-n">Dilewati, dianggap: ' + e(d.asumsi.join(', ')) + '.</div>';
    }
    if (d.catatan) h += '<div class="pn-n">' + ta(d.catatan) + '</div>';
    h += '<div class="pn-n">ℹ️ Ini saran umum dari aturan sederhana, bukan nasihat keuangan profesional. Sesuaikan dengan kondisi keluarga.</div></div>';
    return { html: h + Chat().chipsHtml(m), lebar: true };
  }

  // ------------------------------------------------------------------
  // Simpan profil & riwayat
  // ------------------------------------------------------------------
  async function simpanProfil(profil, ekstra) {
    const p = Object.assign({ id_profil: 'KELUARGA' }, salin(profil), ekstra || {});
    if (!('rencana_tertunda' in p)) p.rencana_tertunda = (M().profil || {}).rencana_tertunda || null;
    if (!('berlaku_mulai' in p)) p.berlaku_mulai = (M().profil || {}).berlaku_mulai || '';
    await S.ubahMaster('penasihat.profil', p);
  }
  function catatRiwayat(id, profil, hasil, sumber, status) {
    const r = { id_riwayat: id, sumber, status, pendapatan: hasil.pendapatan, kebutuhan: hasil.kebutuhan.persen, keinginan: hasil.keinginan.persen, tabungan: hasil.tabungan.persen,
      rincian: hasil.tabungan.rincian.map((x) => ({ nama: x.nama, rp: x.rp, target: x.target || 0 })), profil: salin(profil) };
    S.antre('penasihat.riwayat', r, 'pnr:' + id);
  }
  Pn.ubahStatus = (id, status) => { if (id) S.antre('penasihat.riwayat', { id_riwayat: id, status }, 'pnr:' + id + ':' + status); };

  // ------------------------------------------------------------------
  // Penerapan ke anggaran, target tabungan, dan pengingat
  // ------------------------------------------------------------------
  const KELOMPOK = { KEBUTUHAN: 'Kebutuhan', KEINGINAN: 'Keinginan', TABUNGAN: 'Tabungan', ABAIKAN: 'Abaikan' };
  function tebakKelompok(nama) {
    const s = n(nama);
    if (/tabung|investasi|nabung|emas|deposito|reksa/.test(s)) return 'TABUNGAN';
    if (/makan|bulanan|dapur|tagihan|listrik|air|pulsa|paket data|transport|kendaraan|bensin|pendidikan|sekolah|kesehatan|obat|rumah|keluarga|anak|sosial|ibadah|cicilan|kredit|angsuran|utang|hutang|pinjaman|sewa|kos|kontrakan|asuransi|zakat/.test(s)) return 'KEBUTUHAN';
    if (/jajan|online|pakaian|hiburan|rekreasi|hobi|lain|nongkrong|kopi|game|langganan streaming|liburan|kecantikan|perawatan/.test(s)) return 'KEINGINAN';
    return '';
  }
  function petaKategori() {
    const peta = Object.assign({}, M().pemetaan || {});
    const kosong = !Object.keys(peta).length;
    S.kategoriAktif('KELUAR').forEach((k) => { if (!peta[k.id_kategori] && kosong) { const t = tebakKelompok(k.nama); if (t) peta[k.id_kategori] = t; } });
    return peta;
  }
  const RE_CICILAN = /cicilan|kredit|angsuran|utang|hutang|pinjaman|kpr|paylater/;
  function rencanaAnggaran(hasil, peta) {
    const kats = S.kategoriAktif('KELUAR');
    const d = U.parseTgl(U.hariIni()); d.setDate(d.getDate() - 90);
    const hist = {};
    S.txTerlihat({ mulai: U.tglStr(d), jenis: 'KELUAR' }).forEach((t) => { hist[t.id_kategori] = (hist[t.id_kategori] || 0) + (Number(t.nominal) || 0); });
    const grup = (kel) => kats.filter((k) => peta[k.id_kategori] === kel);
    const K = grup('KEBUTUHAN'), W = grup('KEINGINAN');
    const katCicilan = K.find((k) => RE_CICILAN.test(n(k.nama)));
    const anggaranK = Math.max(0, hasil.kebutuhan.rp - hasil.cicilan);
    const bobot = (xs) => { const o = {}; xs.forEach((k) => { o[k.id_kategori] = hist[k.id_kategori] || 0; }); return o; };
    const bK = H().bagiKategori(anggaranK, bobot(K.filter((k) => k !== katCicilan)), hasil.aturan.pembulatan);
    if (katCicilan) bK[katCicilan.id_kategori] = hasil.cicilan;
    const bW = H().bagiKategori(hasil.keinginan.rp, bobot(W), hasil.aturan.pembulatan);
    const out = [];
    const lamaDari = (id) => S.master.anggaran.find((a) => a.aktif !== false && a.id_kategori === id && (a.periode || 'BULANAN') === 'BULANAN' && a.lingkup !== 'PERORANG');
    Object.keys(bK).forEach((id) => out.push({ id_kategori: id, kelompok: 'KEBUTUHAN', batas: bK[id], lama: lamaDari(id) }));
    Object.keys(bW).forEach((id) => out.push({ id_kategori: id, kelompok: 'KEINGINAN', batas: bW[id], lama: lamaDari(id) }));
    const tot = lamaDari('SEMUA');
    if (tot) out.push({ id_kategori: 'SEMUA', kelompok: 'TOTAL', batas: hasil.kebutuhan.rp + hasil.keinginan.rp, lama: tot });
    return { daftar: out, cicilanTanpaKategori: katCicilan ? 0 : hasil.cicilan };
  }
  async function tanyaPeta(k, sisa) {
    const chips = Object.keys(KELOMPOK).map((x) => ({ label: KELOMPOK[x], aksi: 'pn', nilai: { aksi: 'petakan', id: k.id_kategori, kelompok: x } }));
    return Chat().tambah({ kind: 'pilihan', data: { teks: 'Kategori **' + k.ikon + ' ' + k.nama + '** termasuk kebutuhan, keinginan, atau tabungan?',
      sub: 'Cukup sekali, nanti aku ingat.' + (sisa > 1 ? ' (' + sisa + ' kategori belum terpetakan)' : ''), chips } });
  }
  /** opsi: { yakin (sudah dikonfirmasi), bulanDepan, idR } */
  Pn.terapkan = async function (profil, opsi) {
    opsi = opsi || {};
    if (!admin()) return Chat().sistem('Maaf' + (sapa() ? ', ' + sapa() : '') + ' 🙏 Hanya Admin (' + namaAdmin() + ') yang bisa menerapkan saran ke anggaran.');
    const peta = petaKategori();
    const belum = S.kategoriAktif('KELUAR').filter((k) => !peta[k.id_kategori]);
    if (belum.length) { tunda = { profil, opsi }; return tanyaPeta(belum[0], belum.length); }
    const hasil = H().hitung(profil, M().aturan);
    const rencana = rencanaAnggaran(hasil, peta);
    if (opsi.bulanDepan) {
      const d = U.parseTgl(U.hariIni()); d.setDate(1); d.setMonth(d.getMonth() + 1);
      const mulai = U.tglStr(d);
      await simpanProfil(profil, { rencana_tertunda: { profil: salin(profil) }, berlaku_mulai: mulai });
      Pn.ubahStatus(opsi.idR, 'BULAN_DEPAN');
      return Chat().tambah({ kind: 'pilihan', data: { teks: 'Siap, angka baru mulai dipakai **1 ' + U.BULAN[d.getMonth()] + ' ' + d.getFullYear() + '** 📅', sub: 'Sampai saat itu anggaran sekarang tidak berubah. Saat bulan berganti, aku terapkan otomatis dan memberi tahu di chat.' } });
    }
    const ada = rencana.daftar.filter((r) => r.lama && r.lama.batas !== r.batas);
    if (!opsi.yakin && ada.length) {
      const contoh = ada.slice(0, 4).map((r) => '• ' + (r.id_kategori === 'SEMUA' ? 'Total pengeluaran' : S.kat(r.id_kategori).nama) + ': ' + rp(r.lama.batas) + ' → ' + rp(r.batas)).join('\n');
      return Chat().tambah({ kind: 'pilihan', data: { teks: 'Anggaran bulan ini sudah ada untuk ' + ada.length + ' kategori. Ganti dengan angka baru?\n' + contoh + (ada.length > 4 ? '\n• …' : ''),
        sub: 'Transaksi yang sudah tercatat tidak berubah.', chips: [{ label: 'Ganti', aksi: 'pn', nilai: { aksi: 'terapkanYakin', profil, idR: opsi.idR }, gaya: 'acc' }, { label: 'Batal', aksi: 'tutup' }] } });
    }
    return terapkanSekarang(profil, hasil, rencana, opsi);
  };
  const tglBulanLagi = (bln) => { const d = U.parseTgl(U.hariIni()); d.setDate(1); d.setMonth(d.getMonth() + bln + 1); d.setDate(0); return U.tglStr(d); };
  async function terapkanSekarang(profil, hasil, rencana, opsi) {
    opsi = opsi || {};
    // 1) Anggaran per kategori
    for (const r of rencana.daftar) {
      await S.ubahMaster('anggaran.put', { id_anggaran: r.lama ? r.lama.id_anggaran : 'AGR-' + Date.now().toString(36).toUpperCase() + U.rand(3), lingkup: 'KELUARGA', id_pengguna: '',
        id_kategori: r.id_kategori, periode: 'BULANAN', batas: r.batas, ambang_peringatan: r.lama ? r.lama.ambang_peringatan || 80 : 80, aktif: true });
    }
    // 2) Target tabungan di dompet Tabungan
    const dpTab = (S.dompetAktif().find((x) => x.tipe === 'TABUNGAN') || {}).id_dompet || '';
    const targetLama = (nama) => (S.master.target || []).find((x) => x.aktif !== false && n(x.nama) === n(nama));
    const dibuat = [];
    for (const r of hasil.tabungan.rincian) {
      if (r.kunci === 'UMUM' || !r.target) continue;
      const lama = targetLama(r.nama);
      const tenggat = r.kunci === 'DANA_DARURAT' ? tglBulanLagi(r.bulanTercapai || 12) : tglBulanLagi(r.bulan || 12);
      await S.ubahMaster('target.put', { id_target: lama ? lama.id_target : 'TGT-' + Date.now().toString(36).toUpperCase() + U.rand(3), nama: r.nama, nominal: r.target, tenggat, id_dompet: dpTab, aktif: true });
      dibuat.push(r.nama + ' ' + rp(r.target));
    }
    // 3) Pengingat bulanan: sisihkan tabungan (tanggal 1, jam 08.00)
    const J = g.Pengingat && g.Pengingat.Jadwal;
    if (J) {
      const lama = (S.master.pengingat || []).find((x) => x.id_pengguna === S.saya.id && x.status !== 'SELESAI' && /^Sisihkan tabungan/.test(x.judul || ''));
      const p = { id_pengingat: lama ? lama.id_pengingat : 'PGN-' + Date.now().toString(36) + U.rand(4), id_pengguna: S.saya.id, judul: 'Sisihkan tabungan ' + rp(hasil.tabungan.rp),
        pola: 'BULANAN', tanggal: '', hari_bulan: '1', hari_minggu: '', jam: '08:00' };
      p.berikutnya = J.berikutnya(p, Date.now());
      await S.ubahMaster('pengingat.put', p);
    }
    // 4) Profil & riwayat
    await simpanProfil(profil, { rencana_tertunda: null, berlaku_mulai: '' });
    if (opsi.idR) Pn.ubahStatus(opsi.idR, 'DITERAPKAN');
    else catatRiwayat('PNR-' + Date.now().toString(36).toUpperCase() + U.rand(3), profil, hasil, opsi.sumber || 'TERAPKAN', 'DITERAPKAN');
    const nK = rencana.daftar.filter((r) => r.kelompok === 'KEBUTUHAN').length, nW = rencana.daftar.filter((r) => r.kelompok === 'KEINGINAN').length;
    const baris = ['• ' + (nK + nW) + ' anggaran kategori: kebutuhan ' + rp(hasil.kebutuhan.rp - rencana.cicilanTanpaKategori) + ' (' + nK + ' kategori), keinginan ' + rp(hasil.keinginan.rp) + ' (' + nW + ' kategori)'];
    if (rencana.cicilanTanpaKategori) baris.push('• Cicilan ' + rp(rencana.cicilanTanpaKategori) + ' disisihkan di luar anggaran kategori');
    if (dibuat.length) baris.push('• Target tabungan: ' + dibuat.join(', '));
    baris.push('• Pengingat tiap tanggal 1 jam 08.00: sisihkan ' + rp(hasil.tabungan.rp));
    return Chat().tambah({ kind: 'pilihan', data: { teks: (opsi.otomatis ? 'Bulan baru, angka baru dari penasihat sudah aku terapkan ✅\n' : 'Sudah diterapkan ✅\n') + baris.join('\n'),
      sub: 'Aku ingatkan kalau anggaran kategori sudah terpakai 80%.', chips: [{ label: 'Sisa anggaran', aksi: 'kirim', nilai: { teks: 'sisa anggaran' } }, { label: 'Lihat target', aksi: 'kirim', nilai: { teks: 'lihat target' } }] } });
  }
  /** Rencana "mulai bulan depan" → diterapkan otomatis saat bulan berganti (di HP Admin) */
  let cekJalan = false;
  Pn.cekTertunda = async function () {
    if (cekJalan || !admin()) return;
    const p = M().profil;
    if (!p || !p.rencana_tertunda || !p.berlaku_mulai || U.hariIni() < p.berlaku_mulai) return;
    cekJalan = true;
    try {
      const prof = p.rencana_tertunda.profil || p;
      const hasil = H().hitung(prof, M().aturan);
      await terapkanSekarang(prof, hasil, rencanaAnggaran(hasil, petaKategori()), { otomatis: true, sumber: 'BULAN_DEPAN' });
    } finally { cekJalan = false; }
  };

  // ------------------------------------------------------------------
  // Perubahan kondisi: "tanggungan jadi 3", "cicilan nambah 400rb", "gaji naik jadi 6jt"
  // ------------------------------------------------------------------
  const NAMA_UBAH = { tanggungan: 'Tanggungan', cicilan: 'Cicilan', pendapatan: 'Pendapatan', dana_darurat: 'Dana darurat' };
  const DD_LABEL = { BELUM: 'belum ada', SEBAGIAN: 'sebagian', CUKUP: 'cukup' };
  const nilaiTeks = (f, v) => (f === 'tanggungan' ? (Number(v) >= 4 ? v + ' orang' : v + ' orang') : f === 'dana_darurat' ? DD_LABEL[v] || v : rp(v || 0));
  Pn.ubahKondisi = async function (it) {
    const lama = M().profil;
    if (!lama || !lama.pendapatan) {
      return Chat().tambah({ kind: 'pilihan', data: { teks: 'Belum ada data penasihat keuangan 🙂 Yuk mulai dulu, cuma beberapa pertanyaan.', chips: [{ label: 'Mulai penasihat', aksi: 'kirim', nilai: { teks: 'mulai penasihat' }, gaya: 'acc' }] } });
    }
    const u = it.ubah, baru = salin(lama);
    const f = u.field;
    if (f === 'cicilan' && u.mode === 'lunas' && !u.nilai) {
      if (!(Number(lama.cicilan) > 0)) return Chat().sistem('Di data penasihat, cicilannya memang sudah Rp0 🙂');
      await Chat().tambah({ kind: 'pilihan', data: { teks: 'Cicilan yang lunas berapa per bulan?', sub: 'Total cicilan sekarang ' + rp(lama.cicilan) + '.',
        chips: [{ label: 'Semua (' + rp(lama.cicilan) + ')', aksi: 'pn', nilai: { aksi: 'lunas', nilai: Number(lama.cicilan) } }] } });
      Chat().pending = { type: 'pnLunas', jawab: (teks) => { const v = nominal(teks); if (!(v > 0)) return false; Pn.ubahKondisi({ ubah: { field: 'cicilan', mode: 'kurang', nilai: v } }); return true; } };
      return;
    }
    const v0 = Number(lama[f]) || 0;
    if (f === 'dana_darurat') baru.dana_darurat = u.nilai;
    else if (u.mode === 'set') baru[f] = u.nilai;
    else if (u.mode === 'tambah') baru[f] = v0 + u.nilai;
    else baru[f] = Math.max(0, v0 - (u.nilai || 0));
    if (f === 'tanggungan') baru.tanggungan = Math.max(1, Math.round(baru.tanggungan));
    if (f === 'pendapatan' && !(baru.pendapatan > 0)) return Chat().sistem('Pendapatannya jadi Rp0? Coba ketik ulang, misalnya **gaji jadi 6jt**.');
    if (String(baru[f]) === String(lama[f])) return Chat().sistem(NAMA_UBAH[f] + ' memang sudah ' + nilaiTeks(f, lama[f]) + ' 🙂');
    const hA = H().hitung(lama, M().aturan), hB0 = H().hitung(baru, M().aturan);
    const judul = NAMA_UBAH[f] + ' ' + nilaiTeks(f, lama[f]) + ' → ' + nilaiTeks(f, baru[f]);
    const longgar = r2(hA.kebutuhan.persen - hB0.kebutuhan.persen);
    if (longgar > 0 && (f === 'tanggungan' || f === 'cicilan')) {
      const baru2 = salin(baru);
      baru2.ekstra_tabungan = r2((Number(lama.ekstra_tabungan) || 0) + longgar);
      const kRp = hA.kebutuhan.rp - hB0.kebutuhan.rp;
      return kartuBanding(lama, baru2, judul, { kelonggaran: 'Ada kelonggaran **' + rp(kRp) + '** — saya sarankan masuk **tabungan**.', alternatif: baru, kelRp: kRp });
    }
    return kartuBanding(lama, baru, judul, {});
  };
  const r2 = (x) => Math.round(x * 100) / 100;
  async function kartuBanding(lama, baru, judul, o) {
    const a = H().hitung(lama, M().aturan), b = H().hitung(baru, M().aturan);
    const idR = 'PNR-' + Date.now().toString(36).toUpperCase() + U.rand(3);
    catatRiwayat(idR, baru, b, 'PERUBAHAN', 'SARAN');
    const chips = admin() ? [
      { label: 'Terapkan bulan ini', aksi: 'pn', nilai: { aksi: 'bulanIni' }, gaya: 'acc' },
      { label: 'Mulai bulan depan', aksi: 'pn', nilai: { aksi: 'bulanDepan' } },
      { label: 'Biarkan', aksi: 'pn', nilai: { aksi: 'biarkan' }, gaya: 'ghost' }] : [{ label: 'Tutup', aksi: 'pn', nilai: { aksi: 'tutup' }, gaya: 'ghost' }];
    if (admin() && o.alternatif) chips.push({ label: 'Kelonggaran ke keinginan', aksi: 'pn', nilai: { aksi: 'keKeinginan' } });
    if (admin() && o.keTabungan) chips.push({ label: 'Kelonggaran ke tabungan', aksi: 'pn', nilai: { aksi: 'keTabungan' } });
    return Chat().tambah({ kind: 'saran', data: { mode: 'banding', judul, profilLama: lama, profil: baru, sebelum: a, sesudah: b, kelonggaran: o.kelonggaran || '', alternatif: o.alternatif || null, keTabungan: o.keTabungan || null, kelRp: o.kelRp || 0, idR, chips,
      catatan: admin() ? '' : 'Hanya Admin (' + namaAdmin() + ') yang bisa mengubah anggaran.' } });
  }

  // ------------------------------------------------------------------
  // Pemicu ragu: "rencanakan uang gajian" → tanya, lalu simpan frasanya
  // ------------------------------------------------------------------
  Pn.ragu = function (it) {
    return Chat().tambah({ kind: 'pilihan', data: { teks: 'Maksudnya mau mulai **penasihat keuangan**? 💡', sub: 'Aku bantu bagi pendapatan jadi kebutuhan, keinginan, dan tabungan.',
      chips: [{ label: 'Ya, mulai', aksi: 'pn', nilai: { aksi: 'mulaiRagu', frasa: it.frasa, pendapatan: it.pendapatan }, gaya: 'acc' }, { label: 'Bukan', aksi: 'tutup' }] } });
  };

  // ------------------------------------------------------------------
  // Tombol di kartu
  // ------------------------------------------------------------------
  Pn.aksi = async function (m, i, v, tandai) {
    const d = m.data;
    switch (v.aksi) {
      case 'mulaiRagu':
        await tandai(m, i);
        if (v.frasa) await S.ubahMaster('pemicu.put', { frasa: v.frasa });
        return Pn.mulai({ pendapatan: v.pendapatan });
      case 'percepat': {
        await tandai(m, i);
        const p = salin(d.profil);
        const telat = new Set(d.hasil.terlambat || []);
        (p.tujuan || []).forEach((x) => { if (telat.has(x.nama)) x.percepat = true; });
        return Pn.tampilHasil(p, { asumsi: d.asumsi, sumber: 'PERCEPAT' });
      }
      case 'terapkan': await tandai(m, i); return Pn.terapkan(d.profil, { idR: d.idR });
      case 'terapkanYakin': await tandai(m, i); return Pn.terapkan(v.profil, { yakin: true, idR: v.idR });
      case 'ubah': {
        await tandai(m, i);
        const ops = [['pendapatan', 'Pendapatan'], ['tanggungan', 'Tanggungan'], ['cicilan', 'Cicilan'], ['dana_darurat', 'Dana darurat'], ['tujuan', 'Tujuan']];
        return Chat().tambah({ kind: 'pilihan', data: { teks: 'Mau ubah yang mana?', chips: ops.map((o) => ({ label: o[1], aksi: 'pn', nilai: { aksi: 'ubahField', field: o[0], profil: d.profil, asumsi: d.asumsi } })) } });
      }
      case 'ubahField': {
        await tandai(m, i);
        const data = salin(v.profil);
        data.lain = data.lain || {};
        if (v.field === 'tujuan') { data.tujuan = undefined; } else delete data[v.field];
        const asumsi = (v.asumsi || []).filter((a) => a !== KET_LEWATI[v.field]);
        return Pn.mulai({}, { data, asumsi, mode: 'ubah', diam: true });
      }
      case 'tutup': await tandai(m, i); return Chat().sistem('Oke 👍 Ketik **penasihat** kapan saja kalau mau menghitung lagi.');
      case 'petakan': {
        await tandai(m, i);
        await S.ubahMaster('pemetaan.put', { id_kategori: v.id, kelompok: v.kelompok });
        if (tunda) { const t = tunda; tunda = null; return Pn.terapkan(t.profil, t.opsi); }
        return;
      }
      case 'lunas': await tandai(m, i); Chat().pending = null; return Pn.ubahKondisi({ ubah: { field: 'cicilan', mode: 'kurang', nilai: v.nilai } });
      case 'bulanIni': await tandai(m, i); return Pn.terapkan(d.profil, { yakin: true, idR: d.idR, sumber: 'PERUBAHAN' });
      case 'bulanDepan': await tandai(m, i); return Pn.terapkan(d.profil, { bulanDepan: true, idR: d.idR });
      case 'biarkan':
        await tandai(m, i);
        await simpanProfil(d.profil);
        Pn.ubahStatus(d.idR, 'DIBIARKAN');
        return Chat().sistem('Oke, anggaran tidak diubah 👌 Data keluarga untuk penasihat sudah aku perbarui.');
      case 'keKeinginan':
        await tandai(m, i);
        return kartuBanding(d.profilLama, d.alternatif, d.judul, { kelonggaran: 'Kelonggaran **' + rp(d.kelRp) + '** masuk **keinginan**.', keTabungan: d.profil, kelRp: d.kelRp });
      case 'keTabungan':
        await tandai(m, i);
        return kartuBanding(d.profilLama, d.keTabungan, d.judul, { kelonggaran: 'Ada kelonggaran **' + rp(d.kelRp) + '** — saya sarankan masuk **tabungan**.', alternatif: d.profil, kelRp: d.kelRp });
    }
  };

  Pn.pasang = function () {
    if (Chat() && Chat().RENDER) Chat().RENDER.saran = htmlKartu;
  };
  Pn.PERTANYAAN_BAWAAN = PERTANYAAN_BAWAAN;
  Pn.tebakKelompok = tebakKelompok;
  g.Penasihat = Pn;
  if (g.Chat && g.Chat.RENDER) Pn.pasang();
})(window);
