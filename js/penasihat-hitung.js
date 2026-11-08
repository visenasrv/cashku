/* CashKu — Penasihat Keuangan: aturan hitung (tanpa AI, tanpa server).
 * Membagi pendapatan ke Kebutuhan / Keinginan / Tabungan berdasarkan tanggungan, cicilan, dana darurat, dan tujuan.
 * Semua angka awal bisa disetel di sheet Aturan_Penasihat. */
(function (g) {
  'use strict';
  const ATURAN_BAWAAN = {
    dasar_kebutuhan: 50, dasar_keinginan: 30, dasar_tabungan: 20,
    tanggungan_2: 3, tanggungan_3: 6, tanggungan_4: 10,
    tabungan_dd_belum: 25, tabungan_dd_sebagian: 22, tabungan_dd_cukup: 20,
    cicilan_tertampung: 15, cicilan_peringatan: 30,
    min_keinginan: 5, min_tabungan: 10, maks_kebutuhan: 75,
    porsi_dana_darurat: 60, kali_dana_darurat: 3, pembulatan: 1000
  };
  const KET_ATURAN = {
    dasar_kebutuhan: 'Persen awal kebutuhan', dasar_keinginan: 'Persen awal keinginan', dasar_tabungan: 'Persen awal tabungan',
    tanggungan_2: 'Tambahan poin kebutuhan untuk 2 tanggungan (diambil dari keinginan)', tanggungan_3: 'Tambahan poin untuk 3 tanggungan', tanggungan_4: 'Tambahan poin untuk 4 tanggungan atau lebih',
    tabungan_dd_belum: 'Persen tabungan bila dana darurat belum ada', tabungan_dd_sebagian: 'Persen tabungan bila dana darurat baru sebagian', tabungan_dd_cukup: 'Persen tabungan bila dana darurat sudah cukup',
    cicilan_tertampung: 'Cicilan sampai persen ini dianggap sudah tertampung di kebutuhan', cicilan_peringatan: 'Beri peringatan bila cicilan di atas persen ini',
    min_keinginan: 'Batas bawah keinginan (%)', min_tabungan: 'Batas bawah tabungan (%)', maks_kebutuhan: 'Batas atas kebutuhan (%)',
    porsi_dana_darurat: 'Persen jatah tabungan untuk dana darurat bila belum cukup', kali_dana_darurat: 'Target dana darurat = sekian kali kebutuhan bulanan', pembulatan: 'Pembulatan rupiah'
  };
  const r2 = (x) => Math.round(x * 100) / 100;
  /** 12.5 → "12,5"; 60 → "60" */
  const fp = (x) => { const v = Math.round(x * 10) / 10; return String(v).replace('.', ','); };
  const rpTeks = (n) => 'Rp' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  function gabungAturan(a) {
    const o = Object.assign({}, ATURAN_BAWAAN);
    Object.keys(a || {}).forEach((k) => { const v = Number(String(a[k]).replace(',', '.')); if (k in o && isFinite(v)) o[k] = v; });
    return o;
  }

  /**
   * profil: { pendapatan, tanggungan (1..4, 4 = 4+), cicilan (Rp/bulan), dana_darurat (BELUM|SEBAGIAN|CUKUP),
   *           tujuan: [{ nama, jenis, target, bulan, percepat }], ekstra_tabungan (poin dari kelonggaran) }
   */
  function hitung(profil, aturan) {
    const A = gabungAturan(aturan);
    const R = (x) => Math.round(x / A.pembulatan) * A.pembulatan;
    const naik = (x) => Math.ceil(x / A.pembulatan) * A.pembulatan;
    const P = Math.max(0, Math.round(Number(profil.pendapatan) || 0));
    let K = A.dasar_kebutuhan, W = A.dasar_keinginan, T = A.dasar_tabungan;
    const aK = ['dasar ' + fp(K) + '%'], aT = [], peringatan = [];
    let catatanW = '';
    // 1) Tanggungan
    const tg = Math.min(4, Math.max(1, Math.round(Number(profil.tanggungan) || 1)));
    const bonus = tg >= 4 ? A.tanggungan_4 : tg === 3 ? A.tanggungan_3 : tg === 2 ? A.tanggungan_2 : 0;
    if (bonus) { K += bonus; W -= bonus; aK.push('+' + fp(bonus) + ' untuk ' + (tg >= 4 ? '4+' : tg) + ' tanggungan'); }
    // 2) Dana darurat
    const dd = ['BELUM', 'SEBAGIAN', 'CUKUP'].indexOf(profil.dana_darurat) > -1 ? profil.dana_darurat : 'BELUM';
    const Tt = A['tabungan_dd_' + dd.toLowerCase()];
    W -= (Tt - T); T = Tt;
    aT.push(fp(Tt) + '% karena dana darurat ' + (dd === 'BELUM' ? 'belum ada' : dd === 'SEBAGIAN' ? 'baru sebagian' : 'sudah cukup') +
      (dd === 'CUKUP' ? ', jadi semua untuk tujuan' : '; ' + fp(A.porsi_dana_darurat) + '% ke dana darurat dulu'));
    // 3) Cicilan di atas batas tertampung → kebutuhan naik, diambil dari keinginan lalu tabungan
    const cic = Math.max(0, Number(profil.cicilan) || 0);
    const cicPct = P ? r2(cic / P * 100) : 0;
    if (cicPct > A.cicilan_tertampung) {
      let lebih = r2(cicPct - A.cicilan_tertampung);
      const total = lebih;
      const dariW = Math.min(lebih, Math.max(0, W - A.min_keinginan)); W -= dariW; lebih = r2(lebih - dariW);
      const dariT = Math.min(lebih, Math.max(0, T - A.min_tabungan)); T -= dariT; lebih = r2(lebih - dariT);
      K += total - lebih;
      aK.push('+' + fp(total - lebih) + ' karena cicilan ' + fp(cicPct) + '% pendapatan (di atas ' + fp(A.cicilan_tertampung) + '%)');
      if (lebih > 0) peringatan.push('Cicilan terlalu besar: keinginan dan tabungan sudah di batas minimal, ' + fp(lebih) + '% cicilan tidak tertampung.');
    }
    if (cicPct > A.cicilan_peringatan) peringatan.push('Cicilan ' + fp(cicPct) + '% dari pendapatan, di atas batas aman ' + fp(A.cicilan_peringatan) + '%. Usahakan tidak menambah cicilan baru.');
    // 4) Batas
    if (K > A.maks_kebutuhan) { const x = r2(K - A.maks_kebutuhan); K = A.maks_kebutuhan; T += x; peringatan.push('Kebutuhan dibatasi ' + fp(A.maks_kebutuhan) + '%. Coba tinjau ulang pengeluaran pokok atau cicilan.'); }
    if (W < A.min_keinginan) { const x = r2(A.min_keinginan - W); W = A.min_keinginan; const dT = Math.min(x, Math.max(0, T - A.min_tabungan)); T -= dT; K -= x - dT; }
    if (T < A.min_tabungan) { const x = r2(A.min_tabungan - T); T = A.min_tabungan; const dW = Math.min(x, Math.max(0, W - A.min_keinginan)); W -= dW; K -= x - dW; }
    // 5) Kelonggaran yang dipilih masuk tabungan
    const ekstra = Math.max(0, Number(profil.ekstra_tabungan) || 0);
    let ePoin = 0;
    if (ekstra) { ePoin = r2(Math.min(ekstra, Math.max(0, W - A.min_keinginan))); if (ePoin > 0) { W -= ePoin; T += ePoin; aT.push('+' + fp(ePoin) + ' poin dari kelonggaran'); } }
    K = r2(K); W = r2(W); T = r2(100 - K - W);

    // ---- Rupiah: total harus sama persis dengan pendapatan ----
    const Kr = R(K / 100 * P);
    let Wr = R(W / 100 * P);
    const eRp = ePoin > 0 ? R(ePoin / 100 * P) : 0;          // kelonggaran: langsung ditabung, tidak mengurangi kebutuhan "percepat"
    const Tr0 = P - Kr - Wr - eRp;
    const ddr = dd === 'CUKUP' ? 0 : R(Tr0 * A.porsi_dana_darurat / 100);
    const pool = Tr0 - ddr;
    const tujuan = (profil.tujuan || []).filter((x) => x && Number(x.target) > 0).map((x) => ({
      nama: x.nama || 'Tabungan', jenis: x.jenis || 'LAIN', target: Number(x.target), bulan: Math.max(1, Number(x.bulan) || 12), percepat: !!x.percepat }));
    const butuh = tujuan.map((x) => naik(x.target / x.bulan));
    const N = butuh.reduce((a, b) => a + b, 0);
    let alokasi = tujuan.map(() => 0), umum = pool;
    if (tujuan.length) {
      if (pool >= N) { alokasi = butuh.slice(); umum = pool - N; }
      else {
        let sisa = pool;
        alokasi = butuh.map((b, i) => { if (i === butuh.length - 1) return sisa; const v = Math.min(sisa, R(pool * b / N)); sisa -= v; return v; });
        umum = 0;
      }
    }
    // Percepat: tambah dari keinginan (tidak di bawah batas)
    let tambahW = 0;
    const percepatInfo = [];
    tujuan.forEach((x, i) => {
      if (!x.percepat || !alokasi[i] && !butuh[i]) return;
      const kurang = butuh[i] - alokasi[i];
      if (kurang <= 0) return;
      const bisa = Math.max(0, R((W - A.min_keinginan) / 100 * P) - tambahW);
      const ambil = Math.min(kurang, bisa);
      if (ambil > 0) { alokasi[i] += ambil; tambahW += ambil; percepatInfo.push({ nama: x.nama, rp: ambil }); }
      if (ambil < kurang) peringatan.push('Keinginan sudah di batas minimal ' + fp(A.min_keinginan) + '%, ' + x.nama + ' belum bisa dipercepat penuh.');
    });
    if (tambahW) {
      const poin = r2(tambahW / P * 100);
      W = r2(W - poin); T = r2(100 - K - W); Wr -= tambahW;
      catatanW = ', dikurangi ' + fp(poin) + ' poin untuk mempercepat ' + percepatInfo.map((x) => x.nama).join(' & ');
      aT.push('+' + fp(poin) + ' poin untuk mempercepat ' + percepatInfo.map((x) => x.nama).join(' & '));
    }
    const Tr = P - Kr - Wr;
    // Rincian tabungan
    const rincian = [];
    const targetDd = R(A.kali_dana_darurat * Kr);
    const ddTotal = ddr + (dd === 'CUKUP' ? 0 : eRp);
    if (ddTotal > 0) rincian.push({ kunci: 'DANA_DARURAT', nama: 'Dana darurat', rp: ddTotal, target: targetDd, bulanTercapai: Math.ceil(targetDd / ddTotal), sebagian: dd === 'SEBAGIAN' });
    if (dd === 'CUKUP') umum += eRp;
    const terlambat = [];
    tujuan.forEach((x, i) => {
      const bt = alokasi[i] > 0 ? Math.ceil(x.target / alokasi[i]) : null;
      rincian.push({ kunci: 'TUJUAN', nama: x.nama, jenis: x.jenis, rp: alokasi[i], target: x.target, bulan: x.bulan, bulanTercapai: bt, percepat: x.percepat });
      if (!bt || bt > x.bulan) {
        terlambat.push(i);
        peringatan.push(x.nama + (bt ? ' tercapai ' + bt + ' bulan, lebih lama dari target ' + x.bulan + ' bulan.' : ' belum mendapat jatah tabungan.'));
      }
    });
    if (umum > 0) rincian.push({ kunci: 'UMUM', nama: tujuan.length ? 'Tabungan bebas' : 'Tabungan', rp: umum });
    const bisaPercepat = terlambat.length > 0 && W > A.min_keinginan + 0.001;
    const alasan = {
      kebutuhan: aK.join(', ').replace(/^./, (c) => c.toUpperCase()) + '.',
      keinginan: (W <= A.min_keinginan + 0.001 ? 'Sudah di batas minimal ' + fp(A.min_keinginan) + '%' : 'Sisa setelah kebutuhan dan tabungan') + catatanW + '.',
      tabungan: aT.join(', ').replace(/^./, (c) => c.toUpperCase()) + '.'
    };
    return {
      pendapatan: P, tanggungan: tg, cicilan: cic, cicilanPersen: cicPct, dana_darurat: dd,
      kebutuhan: { persen: K, rp: Kr, alasan: alasan.kebutuhan },
      keinginan: { persen: W, rp: Wr, alasan: alasan.keinginan },
      tabungan: { persen: T, rp: Tr, alasan: alasan.tabungan, rincian },
      peringatan, bisaPercepat, terlambat: terlambat.map((i) => tujuan[i].nama), aturan: A
    };
  }
  /** Perbandingan sebelum → sesudah */
  function banding(a, b) {
    return ['kebutuhan', 'keinginan', 'tabungan'].map((k) => ({ kunci: k, sebelum: a[k], sesudah: b[k], selisihRp: b[k].rp - a[k].rp, selisihPersen: r2(b[k].persen - a[k].persen) }));
  }
  /** Bagi satu kelompok (rupiah) ke beberapa kategori sesuai bobot (riwayat belanja). Hasil dibulatkan, totalnya pas. */
  function bagiKategori(totalRp, bobot, pembulatan) {
    const B = pembulatan || 1000;
    const ids = Object.keys(bobot);
    if (!ids.length || totalRp <= 0) return {};
    const jumlah = ids.reduce((s, k) => s + Math.max(0, bobot[k]), 0);
    const lantai = jumlah > 0 ? jumlah * 0.03 : 1;
    const w = {}; let W = 0;
    ids.forEach((k) => { w[k] = Math.max(0, bobot[k]) + lantai; W += w[k]; });
    const out = {}; let sisa = totalRp;
    ids.forEach((k) => { out[k] = Math.floor(totalRp * w[k] / W / B) * B; sisa -= out[k]; });
    const besar = ids.slice().sort((a, b) => w[b] - w[a])[0];
    out[besar] += sisa;
    return out;
  }
  const H = { ATURAN_BAWAAN, KET_ATURAN, hitung, banding, bagiKategori, fp, rpTeks, gabungAturan };
  g.PenasihatHitung = H;
  if (typeof module !== 'undefined') module.exports = H;
})(typeof window !== 'undefined' ? window : globalThis);
