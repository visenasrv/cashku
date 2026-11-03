/* CashKu — pembaca kalimat chat (berjalan di HP, tanpa server, tanpa AI).
 * Membaca: nominal, jenis (KELUAR/MASUK/PINDAH), kategori (kamus), dompet, tanggal,
 * pertanyaan ringkasan, unduh laporan, batal, serta salah ketik ringan. */
(function (g) {
  'use strict';

  const BULAN = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
  const BULAN_SINGKAT = { jan: 1, feb: 2, febr: 2, mar: 3, apr: 4, jun: 6, jul: 7, agu: 8, agt: 8, agus: 8, ags: 8, sep: 9, sept: 9, okt: 10, nov: 11, nop: 11, des: 12 };
  const ABBR = {
    bln: 'bulan', mgg: 'minggu', mg: 'minggu', thn: 'tahun', th: 'tahun', tgl: 'tanggal', hr: 'hari', lap: 'laporan', rkp: 'rekap',
    ni: 'ini', kmrn: 'kemarin', kmarin: 'kemarin', kemaren: 'kemarin', kmren: 'kemarin', yg: 'yang', utk: 'untuk', dr: 'dari',
    brp: 'berapa', berpa: 'berapa', donlod: 'download', donload: 'download', dl: 'download', pengluaran: 'pengeluaran',
    pemasukkan: 'pemasukan', sd: 'sampai', 'smp': 'sampai', blnini: 'bulan ini', tf: 'tf', ato: 'atau', gk: 'tidak', ga: 'tidak', gak: 'tidak'
  };
  const VOCAB = ['unduh', 'download', 'cetak', 'print', 'ekspor', 'export', 'laporan', 'rekap', 'ringkasan', 'bulan', 'minggu', 'tahun',
    'hari', 'lalu', 'kemarin', 'terakhir', 'pengeluaran', 'pemasukan', 'saldo', 'sisa', 'anggaran', 'berapa', 'total', 'batal',
    'bantuan', 'tanggal', 'sampai', 'semua', 'saja', 'transaksi'].concat(BULAN);
  const STOP = ['beli', 'membeli', 'dibeli', 'bayar', 'bayarin', 'membayar', 'dibayar', 'buat', 'untuk', 'tadi', 'sebesar', 'seharga',
    'harga', 'rp', 'sih', 'ya', 'dong', 'nih', 'aja', 'saja', 'yang', 'barusan', 'td'];
  const KATA_MASUK_HAPUS = ['masuk', 'dapat', 'dapet', 'terima', 'diterima', 'menerima', 'cair'];
  const PREP = ['dari', 'ke', 'di', 'pakai', 'pake', 'via', 'lewat', 'dengan', 'pakai saldo', 'pake saldo', 'dgn'];
  const TIPE_KATA = {
    TUNAI: ['tunai', 'cash', 'kas', 'kes', 'kontan', 'uang tunai', 'uang cash', 'duit tunai'],
    REKENING: ['rekening', 'rek', 'bank', 'atm', 'tabungan', 'debit', 'm-banking', 'mbanking'],
    EWALLET: ['e-wallet', 'ewallet', 'e wallet', 'dompet digital', 'dompet online', 'qris']
  };
  const SEP_KONJ = /\s+(?:dan|sama|terus|trus|lalu juga|plus|&|\+)\s+/;

  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
  const reCache = new Map();
  function frasaRe(f, global) {
    const k = f + (global ? '#g' : '');
    let r = reCache.get(k);
    if (!r) { r = new RegExp('(^|[^a-z0-9])(' + escRe(f) + ')(?=$|[^a-z0-9])', global ? 'g' : ''); reCache.set(k, r); }
    if (global) r.lastIndex = 0;
    return r;
  }
  function cari(text, f) { const m = frasaRe(f).exec(text); return m ? { index: m.index + m[1].length, len: f.length, frasa: f } : null; }
  function ada(text, f) { return frasaRe(f).test(text); }

  function normal(s) {
    s = String(s || '').toLowerCase().replace(/[‘’`]/g, "'").replace(/[“”]/g, '"').replace(/[−–—]/g, '-');
    s = s.replace(/\s+/g, ' ').trim();
    // "dibank", "kerekening" → "di bank", "ke rekening"
    s = s.replace(/\b(di|ke)(bank|rekening|rek|atm|tabungan|gopay|ovo|dana|shopeepay|tunai|kas|dompet)\b/g, '$1 $2');
    return s.split(' ').map((w) => ABBR[w] || w).join(' ');
  }

  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }

  // ----------------------------------------------------------------
  // Indeks kamus (dibangun ulang hanya bila master berubah)
  // ----------------------------------------------------------------
  let IDX = null, IDX_KEY = '';
  function siapkan(ctx) {
    const key = ctx.versi || (ctx.kamus.length + ':' + ctx.dompet.length + ':' + ctx.anggota.length + ':' + ctx.kategori.length);
    if (IDX && IDX_KEY === key) return IDX;
    const katAktif = {};
    ctx.kategori.forEach((k) => { if (k.aktif !== false) katAktif[k.id_kategori] = k; });
    const byLen = (a, b) => b.frasa.length - a.frasa.length;
    const kat = [], masuk = [], pindah = [];
    ctx.kamus.forEach((k) => {
      const f = normal(k.frasa);
      if (!f) return;
      if (k.tipe === 'KATEGORI' && katAktif[k.target]) kat.push({ frasa: f, target: k.target, jenis: katAktif[k.target].jenis });
      else if (k.tipe === 'JENIS_MASUK') masuk.push({ frasa: f });
      else if (k.tipe === 'JENIS_PINDAH') pindah.push({ frasa: f });
    });
    const dompet = [];
    ctx.dompet.forEach((d) => {
      if (d.aktif === false) return;
      const fr = [d.nama].concat(String(d.alias || '').split(',')).map((x) => normal(x)).filter(Boolean);
      Array.from(new Set(fr)).forEach((f) => dompet.push({ frasa: f, id: d.id_dompet, tipe: d.tipe }));
    });
    // Kata umum per jenis dompet ("kas", "rek", "bank", "dompet digital"...). Bila jenisnya punya >1 dompet → ditanyakan.
    const sudah = new Set(dompet.map((e) => e.frasa));
    Object.keys(TIPE_KATA).forEach((tp) => {
      const ids = ctx.dompet.filter((d) => d.aktif !== false && d.tipe === tp).map((d) => d.id_dompet);
      if (ids.length) TIPE_KATA[tp].forEach((f) => { if (!sudah.has(f)) ids.forEach((id) => dompet.push({ frasa: f, id, tipe: tp, umum: true })); });
    });
    const anggota = [];
    ctx.anggota.forEach((a) => {
      [a.nama, a.username].filter(Boolean).forEach((x) => anggota.push({ frasa: normal(x), id: a.id }));
    });
    // Penanda bawaan yang selalu berlaku walau database dibuat sebelum kata ini ada
    ['nabung', 'menabung'].forEach((f) => { if (!pindah.some((e) => e.frasa === f)) pindah.push({ frasa: f }); });
    kat.sort(byLen); masuk.sort(byLen); pindah.sort(byLen); dompet.sort(byLen); anggota.sort(byLen);
    const known = new Set(VOCAB.concat(STOP, KATA_MASUK_HAPUS, PREP, Object.keys(ABBR), Object.values(ABBR),
      ['ini', 'itu', 'yang', 'dan', 'atau', 'saya', 'aku', 'kami', 'keluarga', 'semua', 'anggota', 'pdf', 'per', 'orang']));
    [kat, masuk, pindah, dompet, anggota].forEach((arr) => arr.forEach((e) => e.frasa.split(/[^a-z0-9]+/).forEach((w) => w && known.add(w))));
    IDX = { kat, masuk, pindah, dompet, anggota, katAktif, known, dompetById: Object.fromEntries(ctx.dompet.map((d) => [d.id_dompet, d])) };
    IDX_KEY = key;
    return IDX;
  }

  // ----------------------------------------------------------------
  // Nominal
  // ----------------------------------------------------------------
  const RE_AMT = /(^|[^a-z0-9])(rp\.?\s?)?(\d+(?:[.,]\d+)*)(\s?(?:juta|jt|ribu|rb|rbu|k)(?:an)?)?(\d{1,3})?(?=$|[^a-z0-9])/g;
  function nilaiNominal(num, unit, trail) {
    const u = unit ? unit.trim().replace(/an$/, '') : '';
    const mult = /^(juta|jt)$/.test(u) ? 1e6 : /^(ribu|rb|rbu|k)$/.test(u) ? 1e3 : 1;
    let v;
    if (mult > 1) {
      v = /^\d+[.,]\d{1,2}$/.test(num) ? parseFloat(num.replace(',', '.')) : parseFloat(num.replace(/[.,]/g, ''));
      v *= mult;
      if (trail) v += parseFloat('0.' + trail) * mult;
    } else if (/^\d{1,3}([.,]\d{3})+$/.test(num)) v = parseFloat(num.replace(/[.,]/g, ''));
    else if (/^\d+[.,]\d{1,2}$/.test(num)) v = parseFloat(num.replace(',', '.'));
    else v = parseFloat(num.replace(/[.,]/g, ''));
    return { v: Math.round(v), mult };
  }
  function cariNominal(s) {
    const out = [];
    RE_AMT.lastIndex = 0;
    let m;
    while ((m = RE_AMT.exec(s))) {
      const start = m.index + m[1].length, teks = m[0].slice(m[1].length);
      const r = nilaiNominal(m[3], m[4], m[4] ? m[5] : '');
      if (!(r.v > 0)) continue;
      const kuat = r.mult > 1 || !!m[2] || /[.,]\d{3}(?!\d)/.test(m[3]) || r.v >= 1000;
      out.push({ nilai: r.v, kuat, index: start, len: teks.length, teks });
    }
    return out;
  }
  // Ekspresi tanggal/periode yang mengandung angka tapi bukan nominal
  const NAMA_BULAN_RE = '(?:' + BULAN.join('|') + '|' + Object.keys(BULAN_SINGKAT).join('|') + ')';
  const RE_BUKAN_NOMINAL = [
    /\b(?:tanggal)\s*\d{1,2}(?:\s*(?:-|sampai|s\/d|hingga)\s*\d{1,2})?/g,
    /\b\d+\s*hari\s*(?:yang\s*)?lalu\b/g,
    /\bke-?\s?\d+\b/g,
    /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g,
    /\b\d{1,2}\/\d{4}\b/g,
    /\bbulan\s*\d{1,2}\b/g,
    /\btahun\s*\d{4}\b/g,
    /\b\d+\s*bulan\s*terakhir\b/g,
    new RegExp('\\b\\d{1,2}(?:\\s*(?:-|sampai|s\\/d|hingga)\\s*\\d{1,2})?\\s+' + NAMA_BULAN_RE + '\\b(?:\\s+\\d{4})?', 'g'),
    new RegExp('\\b' + NAMA_BULAN_RE + '\\s+\\d{4}\\b', 'g')
  ];
  function tutupBukanNominal(s) {
    RE_BUKAN_NOMINAL.forEach((re) => { re.lastIndex = 0; s = s.replace(re, (x) => ' '.repeat(x.length)); });
    return s;
  }

  /** Untuk balasan klarifikasi: "25rb" → 25000 (null bila bukan nominal saja) */
  function nominalSaja(text) {
    const t = normal(text);
    const a = cariNominal(t);
    if (a.length !== 1) return null;
    const sisa = (t.slice(0, a[0].index) + t.slice(a[0].index + a[0].len)).replace(/\b(rp|aja|saja|ya|kok|harganya|harga)\b/g, '').trim();
    return sisa ? null : a[0].nilai;
  }

  // ----------------------------------------------------------------
  // Tanggal transaksi & periode laporan
  // ----------------------------------------------------------------
  const p2 = (n) => (n < 10 ? '0' : '') + n;
  const ymd = (y, m, d) => y + '-' + p2(m) + '-' + p2(d);
  const pd = (s) => { const a = s.split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); };
  const fd = (d) => ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const addD = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return fd(d); };
  const hariDlmBulan = (y, m) => new Date(y, m, 0).getDate();
  const senin = (s) => { const d = pd(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return fd(d); };
  const BLN_LABEL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const BLN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const tglLabel = (s) => { const d = pd(s); return d.getDate() + ' ' + BLN_PENDEK[d.getMonth()] + ' ' + d.getFullYear(); };

  function tanggalTransaksi(t, hariIni) {
    let m;
    if ((m = /\bkemarin\s+lusa\b/.exec(t))) return { tanggal: addD(hariIni, -2), frasa: m[0], index: m.index };
    if ((m = /\bkemarin\b/.exec(t))) return { tanggal: addD(hariIni, -1), frasa: m[0], index: m.index };
    if ((m = /\b(\d{1,2})\s*hari\s*(?:yang\s*)?lalu\b/.exec(t))) return { tanggal: addD(hariIni, -Number(m[1])), frasa: m[0], index: m.index };
    if ((m = /\btanggal\s*(\d{1,2})\b(?!\s*(?:-|sampai|hingga))/.exec(t))) {
      const d = Number(m[1]); const h = pd(hariIni);
      let y = h.getFullYear(), mo = h.getMonth() + 1;
      if (d > h.getDate()) { mo--; if (mo < 1) { mo = 12; y--; } }
      if (d >= 1 && d <= hariDlmBulan(y, mo)) return { tanggal: ymd(y, mo, d), frasa: m[0], index: m.index };
    }
    if ((m = /\b(tadi|barusan)\b/.exec(t))) return { tanggal: hariIni, frasa: '', index: -1 };
    return null;
  }

  function bulanDari(word) {
    const i = BULAN.indexOf(word);
    if (i > -1) return i + 1;
    return BULAN_SINGKAT[word] || 0;
  }

  /** Periode untuk pertanyaan & laporan. Mengembalikan {ok, mulai, sampai, label, jenis} atau {ok:false, err, pesan, saran} */
  function periode(t, hariIni) {
    const h = pd(hariIni), Y = h.getFullYear(), M = h.getMonth() + 1;
    let m;
    const bulanPenuh = (y, mo, extra) => Object.assign({ ok: true, mulai: ymd(y, mo, 1), sampai: ymd(y, mo, hariDlmBulan(y, mo)), label: BLN_LABEL[mo - 1] + ' ' + y, jenis: 'bulan', kunci: 'B' + y + p2(mo) }, extra || {});
    const cekMasaDepan = (r, saran) => {
      if (r.ok && r.mulai > hariIni) return { ok: false, err: 'future', pesan: r.label + ' belum berjalan.', label: r.label, saran: saran || [] };
      return r;
    };
    if (/\bhari ini\b/.test(t)) return { ok: true, mulai: hariIni, sampai: hariIni, label: 'Hari ini (' + tglLabel(hariIni) + ')', jenis: 'hari' };
    if (/\bkemarin\b/.test(t)) { const k = addD(hariIni, -1); return { ok: true, mulai: k, sampai: k, label: 'Kemarin (' + tglLabel(k) + ')', jenis: 'hari' }; }
    if (/\bminggu ini\b/.test(t)) { const s = senin(hariIni); return { ok: true, mulai: s, sampai: addD(s, 6), label: 'Minggu ini (' + tglLabel(s).replace(/ \d{4}$/, '') + '–' + tglLabel(addD(s, 6)) + ')', jenis: 'minggu' }; }
    if (/\bminggu (?:lalu|kemarin)\b/.test(t)) { const s = addD(senin(hariIni), -7); return { ok: true, mulai: s, sampai: addD(s, 6), label: 'Minggu lalu (' + tglLabel(s).replace(/ \d{4}$/, '') + '–' + tglLabel(addD(s, 6)) + ')', jenis: 'minggu' }; }
    if (/\bbulan ini\b/.test(t)) return bulanPenuh(Y, M);
    if (/\bbulan (?:lalu|kemarin)\b/.test(t)) { let y = Y, mo = M - 1; if (mo < 1) { mo = 12; y--; } return bulanPenuh(y, mo); }
    if (/\btahun ini\b/.test(t)) return { ok: true, mulai: ymd(Y, 1, 1), sampai: ymd(Y, 12, 31), label: 'Tahun ' + Y, jenis: 'tahun', tahun: Y };
    if (/\btahun (?:lalu|kemarin)\b/.test(t)) return { ok: true, mulai: ymd(Y - 1, 1, 1), sampai: ymd(Y - 1, 12, 31), label: 'Tahun ' + (Y - 1), jenis: 'tahun', tahun: Y - 1 };
    if ((m = /\b(\d{1,2})\s*bulan\s*terakhir\b/.exec(t))) {
      const n = Math.max(1, Math.min(24, Number(m[1])));
      let y = Y, mo = M - (n - 1); while (mo < 1) { mo += 12; y--; }
      return { ok: true, mulai: ymd(y, mo, 1), sampai: ymd(Y, M, hariDlmBulan(Y, M)), label: n + ' bulan terakhir', jenis: 'rentang' };
    }
    // Rentang tanggal: "1-15 oktober 2026", "tanggal 1 sampai 15 oktober"
    const reRentang = new RegExp('(?:tanggal\\s*)?(\\d{1,2})\\s*(?:-|sampai|s\\/d|hingga)\\s*(?:tanggal\\s*)?(\\d{1,2})(?:\\s+(' + NAMA_BULAN_RE + '))?(?:\\s+(\\d{4}))?');
    if ((m = reRentang.exec(t)) && (m[3] || /tanggal/.test(m[0]))) {
      const a = Number(m[1]), b = Number(m[2]);
      let mo = m[3] ? bulanDari(m[3]) : M, y = m[4] ? Number(m[4]) : Y;
      if (!m[4] && ymd(y, mo, 1) > hariIni) y--;
      const maks = hariDlmBulan(y, mo);
      if (a < 1 || b < 1 || a > maks || b > maks) return { ok: false, err: 'invalid', pesan: 'Tanggal ' + (a > maks ? a : b) + ' tidak ada di ' + BLN_LABEL[mo - 1] + ' ' + y + '.', saran: ['bulan ini'] };
      const mulai = ymd(y, mo, Math.min(a, b)), sampai = ymd(y, mo, Math.max(a, b));
      return cekMasaDepan({ ok: true, mulai, sampai, label: Math.min(a, b) + '–' + Math.max(a, b) + ' ' + BLN_LABEL[mo - 1] + ' ' + y, jenis: 'rentang' });
    }
    // Nama bulan (+ tahun)
    const reBulan = new RegExp('\\b(' + NAMA_BULAN_RE + ')\\b(?:\\s+(?:tahun\\s+)?(\\d{4}))?');
    if ((m = reBulan.exec(t))) {
      const mo = bulanDari(m[1]);
      if (m[2]) {
        const y = Number(m[2]);
        return cekMasaDepan(bulanPenuh(y, mo), [{ label: 'Bulan ini sampai hari ini', teks: 'bulan ini' }, { label: BLN_LABEL[mo - 1] + ' ' + (y - 1), teks: BULAN[mo - 1] + ' ' + (y - 1) }]);
      }
      const y = mo > M ? Y - 1 : Y;
      return bulanPenuh(y, mo, { tahunTebakan: mo > M });
    }
    // "bulan 3", "bulan 3 tahun 2025", "03/2026"
    if ((m = /\bbulan\s*(\d{1,2})\b(?:\s+(?:tahun\s*)?(\d{4}))?/.exec(t)) || (m = /\b(\d{1,2})\/(\d{4})\b/.exec(t))) {
      const mo = Number(m[1]);
      if (mo < 1 || mo > 12) return { ok: false, err: 'invalid', pesan: 'Bulan ' + mo + ' tidak ada.', saran: [{ label: 'Bulan ini', teks: 'bulan ini' }, { label: BLN_LABEL[(M + 10) % 12] + ' ' + (M === 1 ? Y - 1 : Y), teks: 'bulan lalu' }] };
      if (m[2]) return cekMasaDepan(bulanPenuh(Number(m[2]), mo));
      const y = mo > M ? Y - 1 : Y;
      return bulanPenuh(y, mo, { tahunTebakan: mo > M });
    }
    if ((m = /\btahun\s*(\d{4})\b/.exec(t)) || (m = /(?:^|\s)(20\d{2})(?:\s|$)/.exec(t))) {
      const y = Number(m[1]);
      if (y > Y) return { ok: false, err: 'future', pesan: 'Tahun ' + y + ' belum berjalan.', saran: [{ label: 'Tahun ini', teks: 'tahun ini' }] };
      return { ok: true, mulai: ymd(y, 1, 1), sampai: ymd(y, 12, 31), label: 'Tahun ' + y, jenis: 'tahun', tahun: y };
    }
    if ((m = /\btanggal\s*(\d{1,2})\b/.exec(t))) {
      const d = Number(m[1]);
      if (d < 1 || d > hariDlmBulan(Y, M)) return { ok: false, err: 'invalid', pesan: 'Tanggal ' + d + ' tidak ada di bulan ini.', saran: [{ label: 'Hari ini', teks: 'hari ini' }] };
      const s = ymd(Y, M, d);
      return cekMasaDepan({ ok: true, mulai: s, sampai: s, label: tglLabel(s), jenis: 'hari' });
    }
    return { ok: false, err: 'none' };
  }

  // ----------------------------------------------------------------
  // Pencarian entitas
  // ----------------------------------------------------------------
  function cariSemua(text, entries) {
    const hasil = [], terpakai = [];
    entries.forEach((e) => {
      const re = frasaRe(e.frasa, true);
      let m;
      while ((m = re.exec(text))) {
        const s = m.index + m[1].length, en = s + e.frasa.length;
        if (!terpakai.some((r) => s < r[1] && en > r[0])) { hasil.push(Object.assign({ index: s, len: e.frasa.length }, e)); terpakai.push([s, en]); }
        if (re.lastIndex === m.index) re.lastIndex++;
      }
    });
    return hasil.sort((a, b) => a.index - b.index);
  }
  function kataSebelum(text, idx) {
    const m = /([a-z]+(?:\s+saldo)?)\s*$/.exec(text.slice(0, idx));
    return m ? m[1] : '';
  }
  function cariAnggota(t, idx, ctx) {
    if (/\b(saya|aku|punyaku|milikku|ku)\b/.test(t)) return { id: ctx.saya.id, sendiri: true };
    const a = cariSemua(t, idx.anggota)[0];
    return a ? { id: a.id } : null;
  }
  function cariDompetQ(t, idx) {
    const hits = cariSemua(t, idx.dompet);
    if (!hits.length) return null;
    const f = hits[0].frasa;
    const ids = Array.from(new Set(idx.dompet.filter((e) => e.frasa === f).map((e) => e.id)));
    return ids.length > 1 ? { ambigu: ids, frasa: f } : { id: ids[0], frasa: f };
  }

  function koreksiTypo(t, idx) {
    const perubahan = [];
    const out = t.split(' ').map((w) => {
      if (w.length < 4 || !/^[a-z]+$/.test(w) || idx.known.has(w)) return w;
      let best = null, bd = 99;
      VOCAB.forEach((v) => {
        if (Math.abs(v.length - w.length) > 2) return;
        const d = lev(w, v);
        if (d < bd) { bd = d; best = v; }
      });
      const maks = w.length >= 5 ? 2 : 1;
      if (best && bd <= maks) { perubahan.push({ dari: w, ke: best }); return best; }
      return w;
    }).join(' ');
    return { teks: out, perubahan };
  }

  // ----------------------------------------------------------------
  // Transaksi
  // ----------------------------------------------------------------
  function pecahSegmen(t) {
    // Koma yang bukan pemisah angka, titik koma, baris baru
    const kasar = [];
    let buf = '', i = 0;
    while (i < t.length) {
      const c = t[i];
      if (c === '\n' || c === ';' || (c === ',' && !(/\d/.test(t[i - 1] || '') && /\d/.test(t[i + 1] || '')))) {
        if (buf.trim()) kasar.push({ teks: buf.trim(), sep: 'koma' }); buf = ''; i++; continue;
      }
      buf += c; i++;
    }
    if (buf.trim()) kasar.push({ teks: buf.trim(), sep: 'koma' });
    // Kata sambung
    const seg = [];
    kasar.forEach((k, ki) => {
      const parts = k.teks.split(SEP_KONJ);
      parts.forEach((p, pi) => seg.push({ teks: p.trim(), sepSesudah: pi < parts.length - 1 ? 'konj' : (ki < kasar.length - 1 ? 'koma' : null) }));
    });
    // Segmen tanpa nominal yang disambung "dan" → gabung ke segmen berikutnya
    const gab = [];
    for (let j = 0; j < seg.length; j++) {
      let s = seg[j];
      while (s.sepSesudah === 'konj' && !cariNominal(tutupBukanNominal(s.teks)).length && seg[j + 1]) {
        s = { teks: s.teks + ' dan ' + seg[j + 1].teks, sepSesudah: seg[j + 1].sepSesudah }; j++;
      }
      gab.push(s);
    }
    // Satu segmen dengan beberapa nominal kuat → pecah di setiap nominal
    const akhir = [];
    gab.forEach((s) => {
      const nom = cariNominal(tutupBukanNominal(s.teks)).filter((a) => a.kuat);
      if (nom.length < 2) { akhir.push(s.teks); return; }
      let start = 0;
      nom.forEach((a, k) => {
        const end = k === nom.length - 1 ? s.teks.length : a.index + a.len;
        akhir.push(s.teks.slice(start, end).trim());
        start = end;
      });
    });
    return akhir.filter(Boolean);
  }

  function hapusRentang(text, ranges) {
    const arr = text.split('');
    ranges.forEach((r) => { for (let i = r[0]; i < r[1] && i < arr.length; i++) arr[i] = ' '; });
    return arr.join('');
  }

  function bersihkanKet(text, jenis) {
    let w = text.replace(/[^a-z0-9.\- ]/g, ' ').split(/\s+/).filter(Boolean);
    w = w.filter((x) => STOP.indexOf(x) < 0 && !/^[.\-]+$/.test(x));
    if (jenis === 'MASUK') w = w.filter((x) => KATA_MASUK_HAPUS.indexOf(x) < 0);
    while (w.length && PREP.indexOf(w[0]) > -1) w.shift();
    while (w.length && PREP.indexOf(w[w.length - 1]) > -1) w.pop();
    return w.join(' ').trim();
  }

  function segmenTransaksi(seg, ctx, idx, tglPesan) {
    const tg = tanggalTransaksi(seg, ctx.hariIni) || tglPesan;
    let s = seg;
    const buang = [];
    if (tg && tg.frasa && s.indexOf(tg.frasa) > -1) { const i = s.indexOf(tg.frasa); buang.push([i, i + tg.frasa.length]); }
    const nominal = cariNominal(tutupBukanNominal(hapusRentang(s, buang)));
    const kuat = nominal.filter((a) => a.kuat);
    const pilih = kuat[0] || nominal[0] || null;
    if (pilih) buang.push([pilih.index, pilih.index + pilih.len]);
    const tanpaNominal = hapusRentang(s, buang);

    // Jenis
    const katSemua = cariSemua(tanpaNominal, idx.kat);
    const katTerpanjang = katSemua.slice().sort((a, b) => b.len - a.len)[0];
    const dompetHits = ctx.fiturDompet ? cariSemua(tanpaNominal, idx.dompet) : [];
    let pindahM = null;
    for (const e of idx.pindah) {
      const h = cari(tanpaNominal, e.frasa);
      if (!h) continue;
      // Frasa kategori yang lebih panjang & menutupi penanda (mis. "top up game") → bukan pindah
      if (katTerpanjang && katTerpanjang.len > h.len && katTerpanjang.index <= h.index && katTerpanjang.index + katTerpanjang.len >= h.index + h.len) continue;
      if (/^(transfer ke|setor|pindah)$/.test(e.frasa) && !dompetHits.length) continue;
      pindahM = h; break;
    }
    const awalKeluar = /^(beli|bayar|bayarin|membeli|membayar|kasih|kirim|transfer ke)\b/.test(tanpaNominal.trim());
    let masukM = null;
    if (!awalKeluar) for (const e of idx.masuk) { const h = cari(tanpaNominal, e.frasa); if (h) { masukM = h; break; } }

    let jenis = 'KELUAR';
    if (pindahM) jenis = 'PINDAH';
    else if (masukM) jenis = 'MASUK';
    else if (katTerpanjang && katTerpanjang.jenis === 'MASUK' && !awalKeluar) jenis = 'MASUK';

    const d = { teks: seg, jenis, nominal: pilih ? pilih.nilai : 0, nominalRagu: !!(pilih && !pilih.kuat), tanpaNominal: !pilih, tanggal: (tg && tg.tanggal) || ctx.hariIni };

    if (jenis === 'PINDAH') {
      if (!ctx.fiturDompet) { d.pindahNonaktif = true; return d; }
      const dk = (id) => idx.dompetById[id];
      const tipe = (tp) => ctx.dompet.filter((x) => x.aktif !== false && x.tipe === tp).map((x) => x.id_dompet);
      let tujuan = null, sumber = null;
      dompetHits.forEach((hh) => {
        const prep = kataSebelum(tanpaNominal, hh.index);
        if (/\b(ke)$/.test(prep) && !tujuan) tujuan = hh.id;
        else if (/\b(dari|pakai|pake|via|lewat|pakai saldo)$/.test(prep) && !sumber) sumber = hh.id;
      });
      const f = pindahM.frasa;
      const sisa = dompetHits.map((hh) => hh.id).filter((id) => id !== tujuan && id !== sumber);
      if (/tarik|ambil/.test(f)) {
        tujuan = tujuan || tipe('TUNAI')[0] || null;
        sumber = sumber || sisa.find((id) => id !== tujuan) || tipe('REKENING')[0] || null;
      } else if (/setor|nabung/.test(f)) {
        // Setor / nabung: uang tunai masuk ke rekening (kecuali dompet lain disebut)
        sumber = sumber || tipe('TUNAI')[0] || null;
        tujuan = tujuan || sisa.find((id) => id !== sumber) || tipe('REKENING')[0] || null;
      } else {
        // top up / isi / pindah / transfer ke
        if (!tujuan) {
          const sesudah = dompetHits.find((hh) => hh.index >= pindahM.index + pindahM.len && hh.id !== sumber);
          tujuan = sesudah ? sesudah.id : (sisa[0] || null);
        }
        if (!sumber) sumber = dompetHits.map((hh) => hh.id).find((id) => id !== tujuan) || null;
        if (!sumber) {
          const def = ctx.saya.id_dompet_default;
          sumber = def && def !== tujuan && dk(def) ? def : (tipe('REKENING').find((id) => id !== tujuan) || null);
        }
      }
      d.id_dompet = sumber; d.id_dompet_tujuan = tujuan;
      if (!tujuan || !sumber || tujuan === sumber) d.dompetRagu = true;
      const ketP = bersihkanKet(hapusRentang(tanpaNominal, dompetHits.map((hh) => {
        const prep = kataSebelum(tanpaNominal, hh.index);
        const pakaiPrep = /\b(pakai|pake|via|lewat|dari|ke|di|dengan|pakai saldo)$/.test(prep);
        return [hh.index - (pakaiPrep ? prep.length + 1 : 0), hh.index + hh.len];
      })), jenis);
      d.keterangan = U_huruf1(ketP || (/nabung/.test(f) ? 'Nabung' : 'Pindah saldo'));
      return d;
    }

    // Kategori sesuai jenis (frasa terpanjang menang)
    const kat = katSemua.filter((k) => k.jenis === jenis).sort((a, b) => b.len - a.len)[0];
    d.id_kategori = kat ? kat.target : (jenis === 'MASUK' ? ctx.kategoriDefaultMasuk : ctx.kategoriDefaultKeluar);
    d.kategoriDikenal = !!kat;
    d.frasaKategori = kat ? kat.frasa : '';

    // Dompet
    if (ctx.fiturDompet) {
      let pilihD = dompetHits[0] || null;
      const pref = dompetHits.find((hh) => /\b(pakai|pake|via|lewat|dari|ke|di|dengan|pakai saldo)$/.test(kataSebelum(tanpaNominal, hh.index)));
      if (pref) pilihD = pref;
      d.dompetDisebut = !!pilihD;
      if (pilihD) {
        const ids = idsFrasa(idx, pilihD.frasa);
        if (ids.length > 1) { d.id_dompet = ''; d.dompetPilihan = ids; }        // mis. "bank" padahal ada 2 rekening
        else d.id_dompet = pilihD.id;
      } else if (ctx.saya.id_dompet_default === 'TANYA') {
        d.id_dompet = ''; d.tanyaDompet = true;                                    // default "Tanya dulu"
      } else {
        d.id_dompet = ctx.saya.id_dompet_default && idx.dompetById[ctx.saya.id_dompet_default] ? ctx.saya.id_dompet_default : (ctx.dompet.find((x) => x.aktif !== false) || {}).id_dompet || '';
      }
    } else d.id_dompet = '';

    const rangesDompet = dompetHits.map((hh) => {
      const prep = kataSebelum(tanpaNominal, hh.index);
      const pakaiPrep = /\b(pakai|pake|via|lewat|dari|ke|di|dengan|pakai saldo)$/.test(prep);
      return [hh.index - (pakaiPrep ? prep.length + 1 : 0), hh.index + hh.len];
    });
    let ket = bersihkanKet(hapusRentang(tanpaNominal, rangesDompet), jenis);
    if (!ket) {
      const kk = idx.katAktif[d.id_kategori];
      ket = kat ? kat.frasa : (kk ? kk.nama : 'Transaksi');
    }
    d.keterangan = U_huruf1(ket);
    d.frasaBelajar = ket.split(' ').slice(0, 3).join(' ');
    return d;
  }
  function idsFrasa(idx, f) { return Array.from(new Set(idx.dompet.filter((e) => e.frasa === f).map((e) => e.id))); }

  /** Pernyataan saldo: "saldo bank sekarang 5jt", "kas saya tinggal 300rb", "uang tunai ada 1,2jt" */
  const ISI_SALDO = /^(saya|aku|ku|gue|gw|kita|kami|di|ke|dalam|yang|punya|milik|dompet|uang|duit|uangku|duitku|uangnya|duitnya|nya|ini|itu|sudah|udah|sdh|masih|sekarang|skrg|skg|saat|tinggal|tersisa|sisa|sisanya|ada|jadi|menjadi|totalnya|total|cuma|hanya|tersedia|terkini|lagi|kok|nih|ya|dong|sih|pas|sekitar|kurang|lebih|semua|jumlah|rp|rupiah|kas|tunai)$/;
  function pernyataanSaldo(t0, ctx, idx) {
    if (/\b(berapa|brp)\b/.test(t0)) return null;
    if (/^(beli|bayar|bayarin|membeli|membayar|kasih|kirim|transfer)\b/.test(t0)) return null;
    if (idx.pindah.some((e) => ada(t0, e.frasa))) return null;                   // "isi saldo", "top up", "pindah saldo"
    const kataKeadaan = /\b(sekarang|skrg|skg|saat ini|tinggal|tersisa|sisa|sisanya|ada|jadi|menjadi|totalnya|total|cuma|hanya|masih|tersedia|terkini)\b/.test(t0);
    const kataSaldo = /\bsaldo(ku|nya)?\b/.test(t0) || (/\bkas\b/.test(t0) && kataKeadaan);
    const kataUang = /\b(uang|duit|uangku|duitku|uangnya|duitnya)\b/.test(t0) && kataKeadaan;
    // Tanpa kata "saldo/uang": cukup nama dompet + kata keadaan ("rekening saya sekarang 5jt", "di bank ada 5jt", "tunai sisa 200rb")
    const adaKat = cariSemua(t0, idx.kat).some((k) => !/^(uang|duit|saldo|tabungan|kas)$/.test(k.frasa));
    const adaMasuk = idx.masuk.some((e) => ada(t0, e.frasa));
    // Tanpa kata "saldo": selain dompet, nominal & kata keadaan tidak boleh ada kata lain ("biaya admin rekening jadi 10rb" = transaksi)
    const polos = () => {
      const rentang = cariNominal(tutupBukanNominal(t0)).map((x) => [x.index, x.index + x.len]).concat(cariSemua(t0, idx.dompet).map((h) => [h.index, h.index + h.len]));
      return hapusRentang(t0, rentang).split(/[^a-z0-9]+/).filter((w) => w && !ISI_SALDO.test(w)).length === 0;
    };
    const kataDompet = kataKeadaan && !adaKat && !adaMasuk && cariSemua(t0, idx.dompet).length > 0 && polos();
    if (!kataSaldo && !kataUang && !kataDompet) return null;
    if (!kataSaldo && (adaKat || adaMasuk || !polos())) return null;                          // "uang jajan sisa 20rb", "uang masuk ada 1jt" bukan saldo
    const items = [];
    pecahSegmen(t0).forEach((sg) => {
      const nom = cariNominal(tutupBukanNominal(sg)).filter((a) => a.kuat);
      if (!nom.length) return;
      const tanpa = hapusRentang(sg, [[nom[0].index, nom[0].index + nom[0].len]]);
      const hit = cariSemua(tanpa, idx.dompet)[0];
      const it = { nominal: nom[0].nilai, teks: sg };
      if (hit) { const ids = idsFrasa(idx, hit.frasa); if (ids.length > 1) it.pilihan = ids; else it.id_dompet = hit.id; }
      items.push(it);
    });
    if (!items.length) return null;
    if (!kataSaldo && !kataUang && items.some((x) => !x.id_dompet && !x.pilihan)) return null;
    return { type: 'saldo_set', items };
  }

  /** Dompet yang disebut dalam jawaban singkat ("tunai", "pakai bri") */
  function dompetDari(text, ctx) {
    const idx = siapkan(ctx);
    const hit = cariSemua(normal(text), idx.dompet)[0];
    return hit ? idsFrasa(idx, hit.frasa) : [];
  }
  function U_huruf1(s) { s = String(s || '').trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; }

  // ----------------------------------------------------------------
  // Analisis utama
  // ----------------------------------------------------------------
  function analisis(raw, ctx) {
    const idx = siapkan(ctx);
    const t0 = normal(raw);
    if (!t0) return { type: 'kosong' };

    let m;
    if ((m = /^(?:batal(?:kan)?|undo|cancel|hapus terakhir|salah catat|salah)\b(.*)$/.exec(t0))) return { type: 'batal', kata: m[1].trim() };
    if (/^(bantuan|help|tolong|cara pakai|caranya|contoh|menu|\?+|halo|hai|hi|assalamualaikum)$/.test(t0)) return { type: 'bantuan', sapa: /^(halo|hai|hi|assalamualaikum)$/.test(t0) };

    const nomAwal = cariNominal(tutupBukanNominal(t0));
    const nominalKuat = nomAwal.some((a) => a.kuat);
    const kor = nominalKuat ? { teks: t0, perubahan: [] } : koreksiTypo(t0, idx);
    const t = kor.teks;

    const kataUnduh = /\b(unduh|download|cetak|print|ekspor|export|simpan|kirim|minta)\b/.test(t);
    const kataLaporan = /\b(laporan|rekap|pdf)\b/.test(t);
    const per = periode(t, ctx.hariIni);
    const adaPeriode = per.ok || per.err === 'invalid' || per.err === 'future';

    // ---- Unduh laporan ----
    if ((kataUnduh && kataLaporan) || (/\blaporan\b/.test(t) && adaPeriode && !nominalKuat) || /\bpdf\b/.test(t)) {
      const r = { type: 'unduh', periode: adaPeriode ? per : null, perubahan: kor.perubahan, teksKoreksi: t };
      const ang = cariAnggota(t, idx, ctx);
      if (ang) r.orang = ang.id;
      const dq = cariDompetQ(t, idx);
      if (dq && dq.ambigu) r.dompetAmbigu = dq.ambigu; else if (dq) r.dompet = dq.id;
      if (/\bpengeluaran\b/.test(t)) r.jenis = 'KELUAR';
      else if (/\bpemasukan\b/.test(t)) r.jenis = 'MASUK';
      // Kata sisa yang tidak dikenali di posisi nama orang ("laporan om bulan ini")
      if (!ang && !dq) {
        const sisa = t.replace(/\b(unduh|download|cetak|print|ekspor|export|simpan|kirim|minta|laporan|rekap|pdf|keuangan|saya|tolong|dong|ya|untuk|buat|semua|anggota|dompet|pengeluaran|pemasukan|saja|aja|hari|ini|kemarin|minggu|bulan|tahun|lalu|terakhir|tanggal|sampai|hingga|per|orang|keluarga)\b/g, ' ')
          .replace(new RegExp('\\b' + NAMA_BULAN_RE + '\\b', 'g'), ' ').replace(/[0-9/\-–]+/g, ' ').trim().split(/\s+/).filter(Boolean);
        if (sisa.length === 1 && sisa[0].length >= 2) r.orangTakDikenal = sisa[0];
      }
      return r;
    }
    if (/^(laporan|rekap laporan|lihat laporan)$/.test(t)) return { type: 'laporan_ambigu' };

    // ---- Pertanyaan ----
    const kataTanya = /\b(berapa|total|rekap|ringkasan|habis|sisa|saldo|pengeluaran|pemasukan|pendapatan|anggaran)\b|\?/.test(t);
    const katHit = cariSemua(t, idx.kat).filter((k) => !/^(pemasukan|uang masuk|belanja)$/.test(k.frasa) || !/\b(pengeluaran|pemasukan)\b/.test(t)).sort((a, b) => b.len - a.len)[0];
    if (!nominalKuat && (kataTanya || (adaPeriode && (katHit || /\b(transaksi|catatan|riwayat)\b/.test(t) || per.jenis === 'hari')))) {
      const q = { type: 'tanya', perubahan: kor.perubahan, teksKoreksi: t };
      if (per.ok) q.periode = per; else if (adaPeriode) q.periodeError = per;
      const ang = cariAnggota(t, idx, ctx); if (ang) q.orang = ang.id;
      if (/\bsaldo\b/.test(t)) {
        q.metric = 'saldo';
        const dq = cariDompetQ(t, idx); if (dq && dq.id) q.dompet = dq.id; else if (dq) q.dompetAmbigu = dq.ambigu;
      } else if (/\b(anggaran|budget)\b/.test(t) || (/\bsisa\b/.test(t) && katHit)) {
        q.metric = 'anggaran'; if (katHit) q.kategori = katHit.target;
      } else if (/\b(pemasukan|pendapatan|penghasilan|uang masuk)\b/.test(t)) {
        q.metric = 'masuk'; if (katHit && katHit.jenis === 'MASUK') q.kategori = katHit.target;
      } else if (katHit) {
        q.metric = 'kategori'; q.kategori = katHit.target;
      } else if (/\b(pengeluaran|keluar|habis|spending)\b/.test(t)) q.metric = 'keluar';
      else if (/\b(transaksi|catatan|riwayat)\b/.test(t) || (per.ok && per.jenis === 'hari')) q.metric = 'daftar';
      else if (/\b(ringkasan|rekap|total)\b/.test(t) || per.ok) q.metric = 'ringkasan';
      else q.metric = 'kurang';
      return q;
    }

    // ---- Pernyataan saldo dompet ----
    if (nominalKuat) { const ps = pernyataanSaldo(t0, ctx, idx); if (ps) return ps; }

    // ---- Transaksi ----
    if (nomAwal.length) {
      const tglPesan = tanggalTransaksi(t0, ctx.hariIni);
      const segs = pecahSegmen(t0);
      const drafts = segs.map((sg) => segmenTransaksi(sg, ctx, idx, tglPesan)).filter((d) => d.nominal > 0 || d.keterangan);
      return { type: 'transaksi', drafts };
    }

    // Kata kunci tanpa nominal → minta nominal
    if (/\b(me)?nabung\b/.test(t0)) return { type: 'butuh_nominal', keterangan: 'Nabung', jenis: 'PINDAH', teks: t0 };
    if (katHit) return { type: 'butuh_nominal', keterangan: U_huruf1(bersihkanKet(t0, katHit.jenis) || katHit.frasa), kategori: katHit.target, jenis: katHit.jenis, teks: t0 };
    if (/\b(hari ini|kemarin)\b/.test(t)) return { type: 'tanya', metric: 'daftar', periode: per };

    // Tidak dikenali → rekomendasi
    const saran = [];
    if (/\b(laporan|unduh|download)\b/.test(t)) saran.push({ label: 'Unduh laporan bulan ini', teks: 'unduh laporan bulan ini' });
    if (/\b(saldo|dompet|uang)\b/.test(t)) saran.push({ label: 'Saldo semua dompet', teks: 'saldo' });
    saran.push({ label: 'Catat jajan — contoh: es teh 5rb', teks: 'es teh 5rb', contoh: true });
    saran.push({ label: 'Pengeluaran bulan ini', teks: 'pengeluaran bulan ini' });
    saran.push({ label: 'Bantuan', teks: 'bantuan' });
    return { type: 'tidak_dikenal', saran: saran.slice(0, 3).concat(saran.length > 3 ? [saran[saran.length - 1]] : []) };
  }

  const Parser = { analisis, periode, nominalSaja, normal, cariNominal, siapkan, lev, BULAN, dompetDari };
  g.Parser = Parser;
  if (typeof module !== 'undefined') module.exports = Parser;
})(typeof window !== 'undefined' ? window : globalThis);
