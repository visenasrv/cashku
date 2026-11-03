/* CashKu — halaman Unduh Laporan + pembuat PDF di HP (jsPDF, berjalan offline) */
(function (g) {
  'use strict';
  const S = g.S, U = g.U, UI = g.UI, ic = g.ic;

  const L = {
    mode: 'BULAN', bulan: U.hariIni().slice(0, 7), minggu: U.hariIni(), dari: U.awalBulan(U.hariIni()), sampai: U.hariIni(),
    orang: '', dompet: '', hanyaKeluar: false, labelPaksa: ''
  };

  // ---------- Konfigurasi periode ----------
  function cfgHalaman() {
    let mulai, sampai, label, jenisPeriode;
    if (L.mode === 'BULAN') {
      mulai = L.bulan + '-01'; sampai = U.akhirBulan(mulai); label = U.namaBulan(mulai); jenisPeriode = 'bulan';
    } else if (L.mode === 'MINGGU') {
      mulai = U.awalMinggu(L.minggu); sampai = U.tambahHari(mulai, 6); jenisPeriode = 'minggu';
      label = U.tglPendek(mulai) + '–' + U.tglPanjang(sampai);
    } else {
      mulai = L.dari <= L.sampai ? L.dari : L.sampai; sampai = L.dari <= L.sampai ? L.sampai : L.dari; jenisPeriode = 'rentang';
      if (mulai.slice(5) === '01-01' && sampai.slice(5) === '12-31' && mulai.slice(0, 4) === sampai.slice(0, 4)) { label = 'Tahun ' + mulai.slice(0, 4); jenisPeriode = 'tahun'; }
      else label = U.tglPanjang(mulai) + ' – ' + U.tglPanjang(sampai);
    }
    return { mulai, sampai, label: L.labelPaksa || label, jenisPeriode, orang: L.orang, dompet: L.dompet, jenis: L.hanyaKeluar ? 'KELUAR' : '' };
  }
  function isiDari(c) {
    c = c || {};
    L.labelPaksa = '';
    if (c.mode === 'BEBAS') { L.mode = 'BEBAS'; L.dari = U.awalBulan(U.hariIni()); L.sampai = U.hariIni(); }
    else if (c.mulai) {
      if (c.jenisPeriode === 'bulan') { L.mode = 'BULAN'; L.bulan = c.mulai.slice(0, 7); }
      else if (c.jenisPeriode === 'minggu') { L.mode = 'MINGGU'; L.minggu = c.mulai; }
      else { L.mode = 'BEBAS'; L.dari = c.mulai; L.sampai = c.sampai; }
    }
    if (c.orang !== undefined) L.orang = c.orang || '';
    if (c.dompet !== undefined) L.dompet = c.dompet || '';
    if (c.jenis !== undefined) L.hanyaKeluar = c.jenis === 'KELUAR';
    if (!S.lihatSemua()) L.orang = '';
  }
  function labelFilter(c) {
    const o = !S.lihatSemua() ? 'Milik saya' : c.orang ? S.orang(c.orang).nama : 'Semua anggota';
    const d = c.dompet ? S.namaDompet(c.dompet) : (S.fiturDompet() ? 'Semua dompet' : '');
    const j = c.jenis === 'KELUAR' ? 'Pengeluaran saja' : c.jenis === 'MASUK' ? 'Pemasukan saja' : '';
    return [o, d, j].filter(Boolean).join(' · ');
  }
  function namaFile(c) { return 'CashKu_Laporan_' + c.label.replace(/[–—]/g, '-').replace(/[^A-Za-z0-9-]+/g, '_').replace(/^_|_$/g, '') + '.pdf'; }

  // ---------- Data ----------
  async function ambilData(c) {
    let list;
    const jendela = S.meta.jendelaMulai || '0000-00-00';
    if (c.mulai < jendela) {
      if (navigator.onLine === false) throw new Error('Periode sebelum ' + U.tglPanjang(jendela) + ' perlu koneksi internet.');
      const res = await g.API.api('laporanData', { mulai: c.mulai, sampai: c.sampai });
      if (!res.success) throw new Error(res.message || 'Gagal mengambil data dari server.');
      const peta = new Map(res.data.tx.map((t) => [t.id_transaksi, t]));
      S.txTerlihat({ mulai: c.mulai, sampai: c.sampai }).forEach((t) => peta.set(t.id_transaksi, t));
      list = Array.from(peta.values()).filter((t) => t.status === 'AKTIF');
    } else list = S.txTerlihat({ mulai: c.mulai, sampai: c.sampai });
    if (c.orang) list = list.filter((t) => t.id_pengguna === c.orang);
    if (c.dompet) list = list.filter((t) => t.id_dompet === c.dompet || t.id_dompet_tujuan === c.dompet);
    if (c.jenis) list = list.filter((t) => t.jenis === c.jenis);
    return list.sort((a, b) => a.tanggal_transaksi.localeCompare(b.tanggal_transaksi) || String(a.waktu_catat).localeCompare(String(b.waktu_catat)));
  }
  function ringkas(list, c) {
    let masuk = 0, keluar = 0;
    const perKat = {}, jumKat = {};
    list.forEach((t) => {
      if (t.jenis === 'PINDAH') {
        if (c.dompet) { if (t.id_dompet_tujuan === c.dompet) masuk += t.nominal; else keluar += t.nominal; }
        return;
      }
      if (t.jenis === 'MASUK') masuk += t.nominal;
      else { keluar += t.nominal; perKat[t.id_kategori] = (perKat[t.id_kategori] || 0) + t.nominal; jumKat[t.id_kategori] = (jumKat[t.id_kategori] || 0) + 1; }
    });
    const kat = Object.keys(perKat).map((id) => ({ id, k: S.kat(id), total: perKat[id], n: jumKat[id], persen: keluar ? (perKat[id] / keluar) * 100 : 0 })).sort((a, b) => b.total - a.total);
    return { masuk, keluar, selisih: masuk - keluar, kat, jumlah: list.filter((t) => t.jenis !== 'PINDAH').length };
  }
  function seriBulan(list, c) {
    let awal, n;
    const bulanA = c.mulai.slice(0, 7), bulanB = c.sampai.slice(0, 7);
    if (c.jenisPeriode === 'tahun') { awal = c.mulai.slice(0, 4) + '-01-01'; n = 12; }
    else if (bulanA === bulanB) { awal = U.tambahBulan(bulanA + '-01', -5); n = 6; }
    else { awal = bulanA + '-01'; n = Math.min(12, (Number(bulanB.slice(0, 4)) - Number(bulanA.slice(0, 4))) * 12 + Number(bulanB.slice(5)) - Number(bulanA.slice(5)) + 1); }
    const out = [];
    for (let i = 0; i < n; i++) {
      const b = U.tambahBulan(awal, i), key = b.slice(0, 7), d = U.parseTgl(b);
      out.push({ key, label: U.BLN[d.getMonth()] + (n === 12 && c.jenisPeriode !== 'tahun' ? '' : ''), masuk: 0, keluar: 0 });
    }
    // Bulan di luar periode laporan memakai data lokal (untuk tren 6 bulan)
    const sumber = bulanA === bulanB && c.jenisPeriode !== 'tahun' ? S.txTerlihat({ mulai: awal, sampai: c.sampai, orang: c.orang, dompet: c.dompet }) : list;
    sumber.forEach((t) => {
      const o = out.find((x) => x.key === t.tanggal_transaksi.slice(0, 7));
      if (!o || t.jenis === 'PINDAH') return;
      if (t.jenis === 'MASUK') o.masuk += t.nominal; else o.keluar += t.nominal;
    });
    return out;
  }

  // ---------- Halaman ----------
  UI.Router.daftar('laporan', {
    template() {
      return UI.header({ title: 'Unduh Laporan' }) + '<div class="page-body with-bar" data-body></div>' +
        '<div class="bar-bottom"><button class="btn block lg" data-unduh>' + ic('download') + 'Unduh PDF</button></div>';
    },
    init(el) {
      el.querySelector('[data-unduh]').onclick = (e) => unduh(cfgHalaman(), e.currentTarget);
      el.addEventListener('change', (e) => {
        const k = e.target.dataset.k;
        if (!k) return;
        if (k === 'hanyaKeluar') L.hanyaKeluar = e.target.checked; else L[k] = e.target.value;
        L.labelPaksa = '';
        render(el, true);
      });
      el.addEventListener('click', async (e) => {
        const m = e.target.closest('[data-mode] button[data-v]');
        if (m) { L.mode = m.dataset.v; L.labelPaksa = ''; render(el); return; }
        if (e.target.closest('[data-pick-orang]')) {
          const v = await UI.Sheet.pilih({ judul: 'Orang', opsi: [{ value: '', label: 'Semua anggota' }].concat(S.master.anggota.map((a) => ({ value: a.id, label: a.nama }))), nilai: L.orang });
          if (v !== null) { L.orang = v; render(el); }
        }
        if (e.target.closest('[data-pick-dompet]')) {
          const v = await UI.Sheet.pilih({ judul: 'Dompet', opsi: [{ value: '', label: 'Semua dompet' }].concat(S.dompetAktif().map((d) => ({ value: d.id_dompet, label: d.nama, ikon: d.ikon }))), nilai: L.dompet });
          if (v !== null) { L.dompet = v; render(el); }
        }
      });
    },
    show(el) { render(el); },
    segarkan(el) { render(el, true); }
  });

  function render(el, hanyaPratinjau) {
    const c = cfgHalaman();
    if (!hanyaPratinjau || !el.querySelector('[data-prev]')) {
      const badge = { BULAN: 'Bulanan', MINGGU: 'Mingguan', BEBAS: 'Bebas' }[L.mode];
      let periodeHtml = '';
      if (L.mode === 'BULAN') periodeHtml = '<label class="field" style="margin-top:16px"><span class="lbl">Bulan Laporan</span><div class="input-wrap">' + ic('calendar') + '<input class="input" type="month" data-k="bulan" value="' + L.bulan + '" max="' + U.hariIni().slice(0, 7) + '"></div></label>';
      else if (L.mode === 'MINGGU') periodeHtml = '<label class="field" style="margin-top:16px"><span class="lbl">Minggu yang memuat tanggal</span><div class="input-wrap">' + ic('calendar') + '<input class="input" type="date" data-k="minggu" value="' + L.minggu + '" max="' + U.hariIni() + '"></div><div class="help" data-mgg></div></label>';
      else periodeHtml = '<div class="row2" style="margin-top:16px"><label><span class="lbl">Dari</span><input class="input" type="date" data-k="dari" value="' + L.dari + '"></label><label><span class="lbl">Sampai</span><input class="input" type="date" data-k="sampai" value="' + L.sampai + '"></label></div>';
      const off = navigator.onLine === false || (g.Sync && g.Sync.status === 'offline');
      el.querySelector('[data-body]').innerHTML =
        (off ? '<div class="banner amber" style="margin-bottom:12px">' + ic('cloud-off') + '<span class="small">Kamu sedang offline. Laporan dibuat dari data di HP (data per ' + U.relatif(S.meta.lastSync) + ').</span></div>' : '') +
        '<div class="card"><div class="card-title"><span class="grow">Pilih Periode</span><span class="badge b-green">' + badge + '</span></div>' +
        '<div class="seg" data-mode><button data-v="BULAN" class="' + (L.mode === 'BULAN' ? 'on' : '') + '">Per Bulan</button><button data-v="MINGGU" class="' + (L.mode === 'MINGGU' ? 'on' : '') + '">Per Minggu</button><button data-v="BEBAS" class="' + (L.mode === 'BEBAS' ? 'on' : '') + '">Tanggal Bebas</button></div>' +
        periodeHtml + '</div>' +
        '<div class="card"><div class="card-title">Filter</div>' +
        '<span class="lbl">Orang</span>' + (S.lihatSemua()
          ? '<button class="pick" data-pick-orang><span class="ico-c sm">' + ic('user', 'ic-sm') + '</span><span class="v">' + U.esc(L.orang ? S.orang(L.orang).nama : 'Semua anggota') + '</span>' + ic('chevron-down') + '</button>'
          : '<div class="pick"><span class="ico-c sm">' + ic('user', 'ic-sm') + '</span><span class="v">Milik saya</span></div>') +
        (S.fiturDompet() ? '<span class="lbl" style="margin-top:16px">Dompet</span><button class="pick" data-pick-dompet><span class="ico-c sm">' + ic('wallet', 'ic-sm') + '</span><span class="v">' + U.esc(L.dompet ? S.namaDompet(L.dompet) : 'Semua dompet') + '</span>' + ic('chevron-down') + '</button>' : '') +
        '<label class="row" style="margin-top:16px;padding:12px 14px;border-radius:12px;background:var(--input)"><span class="grow"><b style="font-weight:500;display:block">Pengeluaran saja</b><span class="small muted">Sembunyikan pemasukan di laporan</span></span><span class="switch"><input type="checkbox" data-k="hanyaKeluar"' + (L.hanyaKeluar ? ' checked' : '') + '><i></i></span></label></div>' +
        '<div class="card"><div class="card-title"><span class="grow">Pratinjau</span><span class="badge b-slate" data-hal></span></div><div class="a4-wrap"><div class="a4" data-prev></div></div>' +
        '<div class="row" style="margin-top:12px"><span class="ico-c sm" style="color:#DC2626;background:#FEE2E2">' + ic('file-text', 'ic-sm') + '</span><span class="grow ellip small" data-fn></span></div></div>';
    }
    const mg = el.querySelector('[data-mgg]'); if (mg) mg.textContent = c.label;
    el.querySelector('[data-fn]').textContent = namaFile(c);
    pratinjau(el, c);
  }

  async function pratinjau(el, c) {
    const box = el.querySelector('[data-prev]');
    if (c.mulai < (S.meta.jendelaMulai || '0000')) {
      box.innerHTML = '<div style="display:grid;place-items:center;height:100%;text-align:center;color:#667781;font-size:11px">Periode ini di luar 24 bulan terakhir.<br>Data diambil dari server saat diunduh.</div>';
      el.querySelector('[data-hal]').textContent = 'A4';
      return;
    }
    const list = await ambilData(c), r = ringkas(list, c);
    const hal = 1 + Math.ceil(Math.max(0, list.length - 18) / 42) + (r.kat.length > 8 ? 1 : 0);
    el.querySelector('[data-hal]').textContent = 'A4 · ' + hal + ' Halaman';
    const terakhir = list.slice(-4).reverse();
    box.innerHTML = '<div class="ah"><div><b>CashKu</b><div>' + U.esc(S.namaKeluarga()) + ' · ' + U.esc(c.label) + '</div></div><div style="text-align:right">Laporan Keuangan<div style="color:#667781">' + U.esc(labelFilter(c)) + '</div></div></div>' +
      '<div class="boxes">' + (c.jenis === 'KELUAR' ? '' : '<div>Pemasukan<b style="color:#16A34A">+' + U.rp(r.masuk) + '</b></div>') + '<div>Pengeluaran<b style="color:#DC2626">' + U.rp(r.keluar) + '</b></div>' + (c.jenis === 'KELUAR' ? '<div>Transaksi<b>' + r.jumlah + '</b></div><div></div>' : '<div>Selisih<b>' + U.rpSelisih(r.selisih) + '</b></div>') + '</div>' +
      '<h4>Rincian per Kategori</h4><table><tr><th>Kategori</th><th class="r">Nominal</th><th class="r">%</th></tr>' +
      (r.kat.slice(0, 4).map((x) => '<tr><td>' + x.k.ikon + ' ' + U.esc(x.k.nama) + '</td><td class="r">' + U.rp(x.total) + '</td><td class="r">' + Math.round(x.persen) + '%</td></tr>').join('') || '<tr><td colspan="3" style="color:#667781">Belum ada pengeluaran</td></tr>') + '</table>' +
      '<h4>Catatan Transaksi Terakhir</h4><table><tr><th>Tgl</th><th>Oleh</th><th>Ket</th><th class="r">Nominal</th></tr>' +
      (terakhir.map((t) => '<tr><td>' + U.tglPendek(t.tanggal_transaksi) + '</td><td>' + U.esc(S.orang(t.id_pengguna).nama) + '</td><td>' + U.esc(t.jenis === 'PINDAH' ? 'Pindah saldo' : t.keterangan) + '</td><td class="r" style="color:' + (t.jenis === 'MASUK' ? '#16A34A' : t.jenis === 'PINDAH' ? '#2563EB' : '#DC2626') + '">' + U.rpTanda(t.nominal, t.jenis) + '</td></tr>').join('') || '<tr><td colspan="4" style="color:#667781">Belum ada transaksi</td></tr>') + '</table>' +
      '<div class="af"><span>Dicetak ' + U.tglPanjang(U.hariIni()) + '</span><span>Data per ' + U.relatif(S.meta.lastSync) + '</span></div>';
  }

  // ---------- Muat jsPDF hanya saat dibutuhkan ----------
  function muatSkrip(src) {
    return new Promise((res, rej) => {
      if (document.querySelector('script[data-src="' + src + '"]')) return res();
      const s = document.createElement('script'); s.src = src; s.dataset.src = src;
      s.onload = () => res(); s.onerror = () => rej(new Error('Gagal memuat ' + src));
      document.head.appendChild(s);
    });
  }
  async function muatJsPdf() {
    if (g.jspdf && g.jspdf.jsPDF && g.jspdf.jsPDF.API.autoTable) return;
    await muatSkrip('js/vendor/jspdf.umd.min.js');
    await muatSkrip('js/vendor/jspdf.plugin.autotable.min.js');
  }

  // ---------- Unduh ----------
  async function unduh(c, btn) {
    if (btn) UI.tombolSibuk(btn, true, 'Menyiapkan…');
    try {
      if (navigator.onLine !== false && g.Sync) await Promise.race([g.Sync.sekarang(), new Promise((r) => setTimeout(r, 8000))]);
      const belum = navigator.onLine === false || g.Sync.status !== 'ok';
      if (belum) {
        const ok = await UI.Sheet.konfirmasi({
          judul: 'Data mungkin belum lengkap',
          isi: (navigator.onLine === false ? 'Kamu sedang offline. ' : 'Sinkron belum berhasil. ') + 'Transaksi anggota lain setelah ' + U.relatif(S.meta.lastSync) + ' belum ikut. Tetap unduh?',
          ok: 'Tetap unduh', batal: 'Batal'
        });
        if (!ok) return;
      }
      const list = await ambilData(c);
      await muatJsPdf();
      const doc = buatPdf(c, list);
      await simpan(doc, namaFile(c));
      UI.Toast.show('Laporan berhasil diunduh', 'success', namaFile(c));
    } catch (e) {
      console.error(e);
      UI.Toast.show('Gagal membuat laporan', 'error', e.message);
    } finally {
      if (btn) UI.tombolSibuk(btn, false);
    }
  }
  async function simpan(doc, nama) {
    const blob = doc.output('blob');
    const file = typeof File !== 'undefined' ? new File([blob], nama, { type: 'application/pdf' }) : null;
    const iosStandalone = navigator.standalone === true;
    if (iosStandalone && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: nama }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = nama; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  // Teks PDF hanya mendukung huruf Latin dasar
  function tp(s) {
    return String(s == null ? '' : s).replace(/[→]/g, '->').replace(/[−–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
      .replace(/[…]/g, '...').replace(/[^\x20-\x7E\xA0-\xFF]/g, '').replace(/\s+/g, ' ').trim();
  }
  const rpP = (n) => 'Rp' + Math.round(Math.abs(n)).toLocaleString('id-ID');

  function buatPdf(c, list) {
    const { jsPDF } = g.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const W = 210, M = 14;
    const tema = U.temaDari(S.master.pengaturan.warna_utama || '#25D366');
    const P = U.hexRgb(tema.primary), A = U.hexRgb(tema.accent);
    const HIJAU = [22, 163, 74], MERAH = [220, 38, 38], BIRU = [37, 99, 235], ABU = [102, 119, 129], GELAP = [17, 27, 33];
    const r = ringkas(list, c);
    const kunciKeluar = c.jenis === 'KELUAR';

    // Kop
    doc.setFillColor(P[0], P[1], P[2]); doc.rect(0, 0, W, 30, 'F');
    doc.setFillColor(A[0], A[1], A[2]); doc.rect(0, 30, W, 1.2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('CashKu', M, 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text('Laporan Keuangan', M, 20);
    doc.setFontSize(9); doc.text(tp(S.namaKeluarga()), W - M, 13, { align: 'right' });
    doc.text('Data per ' + tp(U.tglPanjang(U.tglStr(new Date(S.meta.lastSync || Date.now())))) + ', ' + U.jamDari(S.meta.lastSync || Date.now()), W - M, 20, { align: 'right' });

    let y = 42;
    doc.setTextColor(GELAP[0], GELAP[1], GELAP[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text(tp(c.label), M, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(ABU[0], ABU[1], ABU[2]);
    doc.text(tp(labelFilter(c)) + '  |  ' + r.jumlah + ' transaksi', M, y + 6);
    y += 13;

    // Kotak ringkasan
    const kotak = kunciKeluar ? [['Pengeluaran', rpP(r.keluar), MERAH], ['Jumlah transaksi', String(r.jumlah), GELAP]]
      : [['Pemasukan', '+' + rpP(r.masuk), HIJAU], ['Pengeluaran', rpP(r.keluar), MERAH], ['Selisih', (r.selisih < 0 ? '-' : '+') + rpP(r.selisih), r.selisih < 0 ? MERAH : GELAP]];
    const bw = (W - 2 * M - (kotak.length - 1) * 4) / kotak.length;
    kotak.forEach((k, i) => {
      const x = M + i * (bw + 4);
      doc.setDrawColor(227, 237, 243); doc.setFillColor(247, 251, 254); doc.roundedRect(x, y, bw, 18, 2, 2, 'FD');
      doc.setFontSize(8.5); doc.setTextColor(ABU[0], ABU[1], ABU[2]); doc.text(k[0], x + 4, y + 6);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(k[2][0], k[2][1], k[2][2]); doc.text(k[1], x + 4, y + 13.5);
      doc.setFont('helvetica', 'normal');
    });
    y += 26;

    // Grafik
    const PAL = g.Charts.PALET;
    if (r.keluar > 0) {
      const top = r.kat.slice(0, 7);
      const lain = r.kat.slice(7).reduce((a, x) => a + x.total, 0);
      const data = top.map((x, i) => ({ v: x.total, c: x.k.warna || PAL[i % 10], nama: x.k.nama, persen: x.persen }));
      if (lain) data.push({ v: lain, c: '#94A3B8', nama: 'Lainnya', persen: (lain / r.keluar) * 100 });
      const cv = document.createElement('canvas');
      g.Charts.donut(cv, data, { w: 220, h: 220, scale: 3, kosong: '#E3EDF3' });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(GELAP[0], GELAP[1], GELAP[2]);
      doc.text('Pengeluaran per Kategori', M, y);
      doc.addImage(cv.toDataURL('image/png'), 'PNG', M, y + 3, 46, 46);
      doc.setFontSize(7.5); doc.setTextColor(ABU[0], ABU[1], ABU[2]); doc.setFont('helvetica', 'normal');
      doc.text('Total', M + 23, y + 24.5, { align: 'center' });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(GELAP[0], GELAP[1], GELAP[2]);
      doc.text(rpP(r.keluar), M + 23, y + 29, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      data.forEach((d, i) => {
        const ly = y + 7 + i * 5.6, rgb = U.hexRgb(d.c);
        doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.circle(M + 51, ly - 1.1, 1.3, 'F');
        doc.setTextColor(GELAP[0], GELAP[1], GELAP[2]); doc.text(tp(d.nama).slice(0, 22), M + 54, ly);
        doc.setTextColor(ABU[0], ABU[1], ABU[2]); doc.text(Math.round(d.persen) + '%', M + 91, ly, { align: 'right' });
      });
      // Batang
      const seri = seriBulan(list, c);
      const cb = document.createElement('canvas');
      g.Charts.batang(cb, seri.map((s) => ({ label: s.label, masuk: kunciKeluar ? 0 : s.masuk, keluar: s.keluar })), { w: 300, h: 190, scale: 3, warnaMasuk: '#16A34A', warnaKeluar: '#DC2626', teks: '#667781', garis: '#E3EDF3' });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(GELAP[0], GELAP[1], GELAP[2]);
      doc.text(kunciKeluar ? 'Pengeluaran per Bulan' : 'Pemasukan vs Pengeluaran', 114, y);
      doc.addImage(cb.toDataURL('image/png'), 'PNG', 112, y + 3, 84, 53.2);
      y += 62;
    }

    const footer = () => {};
    const gayaTabel = {
      theme: 'grid', margin: { left: M, right: M, bottom: 18 },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8, textColor: GELAP, lineColor: [227, 237, 243], lineWidth: 0.2 },
      headStyles: { fillColor: P, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 251, 254] }, didDrawPage: footer
    };
    const judul = (t) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(GELAP[0], GELAP[1], GELAP[2]); doc.text(t, M, y); y += 2.5;
    };

    // Rincian per kategori
    judul('Rincian per Kategori');
    doc.autoTable(Object.assign({}, gayaTabel, {
      startY: y,
      head: [['Kategori', 'Transaksi', 'Nominal', '%']],
      body: r.kat.length ? r.kat.map((x) => [tp(x.k.nama), String(x.n), rpP(x.total), x.persen.toFixed(1).replace('.', ',') + '%']).concat([[{ content: 'Total', styles: { fontStyle: 'bold' } }, String(r.kat.reduce((a, x) => a + x.n, 0)), { content: rpP(r.keluar), styles: { fontStyle: 'bold' } }, '100%']])
        : [[{ content: 'Belum ada pengeluaran pada periode ini.', colSpan: 4, styles: { textColor: ABU } }]],
      columnStyles: { 1: { halign: 'center', cellWidth: 22 }, 2: { halign: 'right', cellWidth: 38 }, 3: { halign: 'right', cellWidth: 18 } }
    }));
    y = doc.lastAutoTable.finalY + 9;

    // Ringkasan per bulan (laporan tahunan / lintas bulan)
    if (c.jenisPeriode === 'tahun' || c.mulai.slice(0, 7) !== c.sampai.slice(0, 7)) {
      const seri = seriBulan(list, c);
      judul('Ringkasan per Bulan');
      doc.autoTable(Object.assign({}, gayaTabel, {
        startY: y,
        head: [kunciKeluar ? ['Bulan', 'Pengeluaran'] : ['Bulan', 'Pemasukan', 'Pengeluaran', 'Selisih']],
        body: seri.map((s) => {
          const nm = U.BULAN[Number(s.key.slice(5)) - 1] + ' ' + s.key.slice(0, 4);
          return kunciKeluar ? [nm, rpP(s.keluar)] : [nm, rpP(s.masuk), rpP(s.keluar), (s.masuk - s.keluar < 0 ? '-' : '+') + rpP(s.masuk - s.keluar)];
        }),
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } }
      }));
      y = doc.lastAutoTable.finalY + 9;
    }

    // Daftar transaksi
    judul('Daftar Transaksi');
    doc.autoTable(Object.assign({}, gayaTabel, {
      startY: y,
      head: [['Tanggal', 'Pencatat', 'Keterangan', 'Kategori', S.fiturDompet() ? 'Dompet' : '', 'Nominal']],
      body: list.length ? list.map((t) => {
        const pindah = t.jenis === 'PINDAH';
        const nom = (t.jenis === 'MASUK' ? '+' : t.jenis === 'KELUAR' ? '-' : '') + rpP(t.nominal);
        return [U.tglPendek(t.tanggal_transaksi) + ' ' + t.tanggal_transaksi.slice(0, 4), tp(S.orang(t.id_pengguna).nama), tp(pindah ? 'Pindah saldo' : t.keterangan),
          pindah ? 'Pindah' : tp(S.kat(t.id_kategori).nama), S.fiturDompet() ? tp(pindah ? S.namaDompet(t.id_dompet) + ' -> ' + S.namaDompet(t.id_dompet_tujuan) : S.namaDompet(t.id_dompet)) : '',
          { content: nom, styles: { textColor: t.jenis === 'MASUK' ? HIJAU : pindah ? BIRU : MERAH } }];
      }) : [[{ content: 'Belum ada transaksi pada periode ini.', colSpan: 6, styles: { textColor: ABU } }]],
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 22 }, 4: { cellWidth: S.fiturDompet() ? 30 : 0 }, 5: { halign: 'right', cellWidth: 28 } }
    }));

    // Kaki halaman
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setDrawColor(227, 237, 243); doc.line(M, 284, W - M, 284);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(ABU[0], ABU[1], ABU[2]);
      doc.text('Dicetak ' + tp(U.tglPanjang(U.hariIni())) + ', ' + U.jamDari(Date.now()) + ' oleh ' + tp(S.saya.nama) + '  |  CashKu', M, 289);
      doc.text('Halaman ' + i + ' dari ' + n, W - M, 289, { align: 'right' });
    }
    return doc;
  }

  g.Laporan = { isiDari, labelFilter, unduh, cfgHalaman, namaFile, ambilData, buatPdf, muatJsPdf };
})(window);
