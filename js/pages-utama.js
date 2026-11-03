/* CashKu — halaman Dashboard, Riwayat, dan lembar Ubah Transaksi */
(function (g) {
  'use strict';
  const S = g.S, U = g.U, UI = g.UI, ic = g.ic;

  // =============================================================
  // DASHBOARD
  // =============================================================
  const PERIODE_DASH = [
    { v: 'minggu', label: 'Minggu ini' }, { v: 'bulan', label: 'Bulan ini' }, { v: 'bulanlalu', label: 'Bulan lalu' },
    { v: '3bulan', label: '3 bulan terakhir' }, { v: 'tahun', label: 'Tahun ini' }
  ];
  const Dash = { periode: 'bulan', orang: '' };
  function rentangDash() {
    const t = { minggu: 'minggu ini', bulan: 'bulan ini', bulanlalu: 'bulan lalu', '3bulan': '3 bulan terakhir', tahun: 'tahun ini' }[Dash.periode];
    return g.Parser.periode(t, U.hariIni());
  }

  UI.Router.daftar('dashboard', {
    template() {
      return UI.header({ title: 'Dashboard', right: '<button class="chip" data-per style="background:rgba(255,255,255,.16);border-color:transparent;color:inherit;height:36px"><span data-perl>Bulan ini</span>' + ic('chevron-down', 'ic-sm') + '</button>' }) +
        '<div class="page-body with-bar" data-body></div>' +
        '<div class="bar-bottom"><button class="btn block lg" data-pdf>' + ic('file-down') + 'Unduh Laporan PDF</button></div>';
    },
    init(el) {
      el.querySelector('[data-per]').onclick = async () => {
        const v = await UI.Sheet.pilih({ judul: 'Periode', opsi: PERIODE_DASH.map((p) => ({ value: p.v, label: p.label })), nilai: Dash.periode });
        if (v) { Dash.periode = v; renderDash(el); }
      };
      el.querySelector('[data-pdf]').onclick = () => {
        const r = rentangDash();
        g.Laporan.isiDari({ mulai: r.mulai, sampai: r.sampai, label: r.label, jenisPeriode: r.jenis, orang: Dash.orang });
        UI.Router.go('laporan');
      };
      el.addEventListener('click', (e) => {
        const c = e.target.closest('[data-orang]');
        if (c) { Dash.orang = c.dataset.orang; renderDash(el); return; }
        if (e.target.closest('[data-ke-anggaran]') && S.bolehKelola()) UI.Router.go('anggaran');
        if (e.target.closest('[data-sinkron]')) g.Sync.sekarang();
      });
      let tmr;
      addEventListener('resize', () => { clearTimeout(tmr); tmr = setTimeout(() => { if (!el.hidden) gambarGrafik(el); }, 200); });
    },
    show(el) { renderDash(el); },
    segarkan(el) { renderDash(el); }
  });

  function renderDash(el) {
    const per = rentangDash();
    el.querySelector('[data-perl]').textContent = PERIODE_DASH.find((p) => p.v === Dash.periode).label;
    if (!S.lihatSemua()) Dash.orang = S.saya.id === Dash.orang ? Dash.orang : '';
    const f = { mulai: per.mulai, sampai: per.sampai, orang: Dash.orang };
    const r = S.ringkasan(f);
    const ref = per.sampai > U.hariIni() ? U.hariIni() : per.sampai;
    const seri = S.seriBulanan(Dash.periode === 'tahun' ? 12 : 6, Dash.periode === 'tahun' ? per.sampai : ref, { orang: Dash.orang });
    const surplus = seri.reduce((a, s) => a + s.masuk - s.keluar, 0) / seri.length;

    let h = '<div class="fam-label">' + U.esc(S.namaKeluarga()) + '</div><div class="fam-title">Ringkasan Finansial</div>';
    if (S.lihatSemua() && S.anggotaAktif().length > 1) {
      h += '<div class="chips scroll" style="margin-top:12px"><button class="chip ' + (!Dash.orang ? 'on' : '') + '" data-orang="">Semua</button>' +
        S.anggotaAktif().map((a) => '<button class="chip ' + (Dash.orang === a.id ? 'on' : '') + '" data-orang="' + U.esc(a.id) + '"><span class="cdot" style="background:' + U.esc(a.warna) + '"></span>' + U.esc(a.nama) + '</button>').join('') + '</div>';
    }
    h += '<div class="kpi">' +
      kpi('Masuk', 'arrow-down-left', 'var(--income)', U.ringkas(r.masuk), U.rp(r.masuk), 't-in', '+') +
      kpi('Keluar', 'arrow-up-right', 'var(--expense)', U.ringkas(r.keluar), U.rp(r.keluar), 't-out', '') +
      kpi('Selisih', 'scale', 'var(--primary)', U.ringkas(r.selisih), U.rpSelisih(r.selisih), r.selisih < 0 ? 't-out' : '', r.selisih >= 0 ? '+' : '') + '</div>';

    // Donut
    const top = r.perKategori.slice(0, 6);
    const lain = r.perKategori.slice(6).reduce((a, x) => a + x.total, 0);
    const data = top.map((x, i) => ({ v: x.total, c: x.warna || g.Charts.PALET[i % 10], nama: x.nama, ikon: x.ikon, persen: x.persen }));
    if (lain) data.push({ v: lain, c: '#94A3B8', nama: 'Lainnya', ikon: '📦', persen: (lain / r.keluar) * 100 });
    h += '<div class="card" style="margin-top:16px"><div class="card-title">' + ic('chart-pie') + '<span class="grow">Pengeluaran per Kategori</span><span class="badge b-slate">' + U.esc(per.label.replace(/ \(.+\)$/, '')) + '</span></div>' +
      (r.keluar ? '<div class="donut-wrap"><canvas data-donut></canvas><div class="donut-mid"><b class="num">' + U.rp(r.keluar) + '</b><span>total keluar</span></div></div>' +
        '<div class="legend">' + data.map((d) => '<div class="lg-row"><span class="sw" style="background:' + U.esc(d.c) + '"></span><span class="grow ellip">' + d.ikon + ' ' + U.esc(d.nama) + '</span><span class="pct">' + Math.round(d.persen) + '%</span><b class="num">' + U.rp(d.v) + '</b></div>').join('') + '</div>'
        : '<div class="empty"><div class="em">🌱</div><b>Belum ada pengeluaran</b>Catat lewat chat, misalnya “beli kopi 25rb”.</div>') + '</div>';

    // Batang
    h += '<div class="card"><div class="card-title" style="margin-bottom:2px">' + ic('chart-column') + '<span class="grow">Pemasukan vs Pengeluaran</span></div>' +
      '<div class="small muted" style="margin-bottom:8px">' + (Dash.periode === 'tahun' ? 'Per bulan, tahun ini' : '6 bulan terakhir') + ' · <span class="t-in">● Masuk</span> <span class="t-out">● Keluar</span></div>' +
      '<canvas class="bar-chart" data-bar></canvas>' +
      '<div class="banner" style="margin-top:12px;padding:10px 12px">' + ic('trending-up') + '<span class="grow small">' + (surplus >= 0 ? 'Surplus' : 'Defisit') + ' rata-rata per bulan</span><b class="num ' + (surplus >= 0 ? 't-in' : 't-out') + '">' + U.rpSelisih(surplus) + '</b></div></div>';

    // Saldo dompet
    if (S.fiturDompet()) {
      const sd = S.saldoDompet();
      if (sd.length) {
        const tot = sd.reduce((a, x) => a + x.saldo, 0);
        h += '<div class="row" style="margin:20px 0 8px;align-items:flex-end"><div class="grow"><div class="fam-title" style="font-size:18px">Saldo Dompet</div><div class="small muted">Tunai, rekening & e-wallet</div></div>' +
          '<div style="text-align:right"><div class="small muted">Total Saldo</div><b class="num" style="font-size:17px;color:var(--primary)">' + (tot < 0 ? '−' : '') + U.rp(tot) + '</b></div></div>' +
          '<div class="hscroll">' + sd.map((x) => '<div class="card wallet-card"><div class="row"><span class="ico-c sm">' + U.esc(x.dompet.ikon || '💳') + '</span><span class="badge b-slate">' + ({ TUNAI: 'Fisik', REKENING: 'Bank', EWALLET: 'Digital' })[x.dompet.tipe] + '</span></div>' +
            '<div class="nm ellip">' + U.esc(x.dompet.nama) + '</div><div class="v num ' + (x.saldo < 0 ? 't-out' : '') + '">' + (x.saldo < 0 ? '−' : '') + U.rp(x.saldo) + '</div></div>').join('') + '</div>';
      }
    }

    // Sisa anggaran
    const st = S.statusAnggaran(ref).filter((x) => !Dash.orang || x.a.lingkup !== 'PERORANG' || x.a.id_pengguna === Dash.orang);
    h += '<div class="card" style="margin-top:16px" data-ke-anggaran><div class="card-title" style="margin-bottom:2px"><span class="grow">Sisa Anggaran</span>' + (S.bolehKelola() ? ic('sliders-horizontal') : '') + '</div><div class="small muted" style="margin-bottom:8px">Batas belanja periode berjalan</div>';
    if (!st.length) h += '<div class="empty" style="padding:20px 8px"><b>Belum ada anggaran</b>' + (S.bolehKelola() ? 'Ketuk untuk mengatur batas belanja.' : 'Admin belum mengatur anggaran.') + '</div>';
    st.forEach((x) => {
      const l = S.labelAnggaran(x.a);
      h += '<div class="bud-row' + (x.level === 2 ? ' over' : '') + '"><div class="top"><span>' + l.ikon + '</span><b class="ellip">' + U.esc(l.nama) + '</b>' +
        (x.a.lingkup === 'PERORANG' ? '<span class="badge b-blue">' + U.esc(l.lingkup) + '</span>' : '<span class="badge b-green">Keluarga</span>') +
        '<span class="grow"></span>' + (x.level === 2 ? '<span class="badge b-red">Lewat ' + U.rp(x.terpakai - x.batas) + '</span>' : '<span class="small ' + (x.level ? 't-warn' : 't-in') + '" style="font-weight:600">' + Math.round(x.persen) + '% terpakai</span>') + '</div>' +
        '<div class="prog l' + x.level + '"><i style="width:' + Math.min(100, x.persen) + '%"></i></div>' +
        '<div class="bot"><span>' + (x.sisa >= 0 ? 'Sisa ' + U.rp(x.sisa) : 'Total ' + U.rp(x.terpakai)) + '</span><span>Batas ' + U.rp(x.batas) + '</span></div></div>';
    });
    h += '</div>';
    const st2 = g.Sync.status;
    h += '<button class="sync-foot" data-sinkron style="width:100%">' + ic(st2 === 'offline' ? 'cloud-off' : 'shield-check', 'ic-sm') +
      (st2 === 'offline' ? 'Offline · data per ' + U.relatif(S.meta.lastSync) : 'Sinkronisasi otomatis aktif · diperbarui ' + U.relatif(S.meta.lastSync)) + '</button>';

    el._dash = { data, seri, sorot: seri.findIndex((s) => s.bulan === U.awalBulan(ref)) };
    if (el._html === h + document.documentElement.dataset.theme) return;
    el.querySelector('[data-body]').innerHTML = h;
    el._html = h + document.documentElement.dataset.theme;
    gambarGrafik(el);
  }
  function kpi(judul, ikon, warna, v, full, kelas, tanda) {
    return '<div class="card"><div class="k-top"><span>' + judul + '</span><span class="k-ic" style="background:color-mix(in srgb,' + warna + ' 14%,transparent);color:' + warna + '">' + ic(ikon, 'ic-sm') + '</span></div>' +
      '<div class="k-v num ' + kelas + '">' + (tanda && !/^−/.test(v) ? tanda : '') + v + '</div><div class="k-s num ellip">' + full + '</div></div>';
  }
  function gambarGrafik(el) {
    const d = el._dash; if (!d) return;
    const css = getComputedStyle(document.documentElement);
    const dn = el.querySelector('[data-donut]');
    if (dn) g.Charts.donut(dn, d.data, { kosong: css.getPropertyValue('--track') });
    const br = el.querySelector('[data-bar]');
    if (br) g.Charts.batang(br, d.seri, { warnaMasuk: css.getPropertyValue('--income').trim(), warnaKeluar: css.getPropertyValue('--expense').trim(), teks: css.getPropertyValue('--muted').trim(), teksTebal: css.getPropertyValue('--text').trim(), garis: css.getPropertyValue('--line').trim(), sorot: d.sorot });
  }

  // =============================================================
  // RIWAYAT
  // =============================================================
  const R = { cari: '', jenis: '', kategori: '', dompet: '', orang: '', tanggal: '', batas: 60 };
  UI.Router.daftar('riwayat', {
    template() {
      return UI.header({ title: 'Riwayat Transaksi' }) +
        '<div class="page-body"><div class="search">' + ic('search') + '<input class="input" type="search" placeholder="Cari keterangan…" data-cari aria-label="Cari"></div>' +
        '<div class="chips scroll" style="margin:12px 0 4px" data-filter></div><div data-list></div><div data-sentinel style="height:1px"></div></div>';
    },
    init(el) {
      el.querySelector('[data-cari]').addEventListener('input', U.debounce((e) => { R.cari = e.target.value; R.batas = 60; renderRiwayat(el); }, 250));
      el.querySelector('[data-filter]').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) pilihFilter(el, b.dataset.f); });
      el.querySelector('[data-list]').addEventListener('click', (e) => {
        const b = e.target.closest('[data-tx]'); if (b) g.EditTx.buka(b.dataset.tx);
      });
      if ('IntersectionObserver' in g) {
        new IntersectionObserver((en) => { if (en[0].isIntersecting && !el.hidden && el._sisa > 0) { R.batas += 60; renderRiwayat(el); } }).observe(el.querySelector('[data-sentinel]'));
      }
    },
    show(el) { renderRiwayat(el); },
    segarkan(el) { renderRiwayat(el); }
  });

  function labelFilter(f) {
    if (f === 'jenis') return R.jenis ? ({ KELUAR: 'Pengeluaran', MASUK: 'Pemasukan', PINDAH: 'Pindah saldo' })[R.jenis] : 'Jenis';
    if (f === 'kategori') return R.kategori ? S.kat(R.kategori).nama : 'Kategori';
    if (f === 'dompet') return R.dompet ? S.namaDompet(R.dompet) : 'Dompet';
    if (f === 'orang') return R.orang ? S.orang(R.orang).nama : 'Orang';
    if (f === 'tanggal') return R.tanggal ? ({ hari: 'Hari ini', minggu: 'Minggu ini', bulan: 'Bulan ini', bulanlalu: 'Bulan lalu' })[R.tanggal] : 'Tanggal';
    return f;
  }
  async function pilihFilter(el, f) {
    let opsi = [{ value: '', label: 'Semua' }];
    if (f === 'jenis') opsi = opsi.concat([{ value: 'KELUAR', label: 'Pengeluaran' }, { value: 'MASUK', label: 'Pemasukan' }].concat(S.fiturDompet() ? [{ value: 'PINDAH', label: 'Pindah saldo' }] : []));
    if (f === 'kategori') opsi = opsi.concat(S.kategoriAktif().map((k) => ({ value: k.id_kategori, label: k.nama, ikon: k.ikon, sub: k.jenis === 'MASUK' ? 'Pemasukan' : '' })));
    if (f === 'dompet') opsi = opsi.concat(S.dompetAktif().map((d) => ({ value: d.id_dompet, label: d.nama, ikon: d.ikon })));
    if (f === 'orang') opsi = opsi.concat(S.master.anggota.map((a) => ({ value: a.id, label: a.nama })));
    if (f === 'tanggal') opsi = opsi.concat([{ value: 'hari', label: 'Hari ini' }, { value: 'minggu', label: 'Minggu ini' }, { value: 'bulan', label: 'Bulan ini' }, { value: 'bulanlalu', label: 'Bulan lalu' }]);
    const v = await UI.Sheet.pilih({ judul: 'Filter ' + ({ jenis: 'jenis', kategori: 'kategori', dompet: 'dompet', orang: 'anggota', tanggal: 'tanggal' })[f], opsi, nilai: R[f] });
    if (v === null) return;
    R[f] = v; R.batas = 60; renderRiwayat(el);
  }

  function renderRiwayat(el) {
    const fs = ['jenis', 'kategori'].concat(S.fiturDompet() ? ['dompet'] : [], S.lihatSemua() ? ['orang'] : [], ['tanggal']);
    el.querySelector('[data-filter]').innerHTML = fs.map((f) => '<button class="chip ' + (R[f] ? 'on' : '') + '" data-f="' + f + '">' + U.esc(labelFilter(f)) + ic('chevron-down', 'ic-sm') + '</button>').join('');
    let mulai = '', sampai = '';
    if (R.tanggal) { const p = g.Parser.periode({ hari: 'hari ini', minggu: 'minggu ini', bulan: 'bulan ini', bulanlalu: 'bulan lalu' }[R.tanggal], U.hariIni()); mulai = p.mulai; sampai = p.sampai; }
    const q = g.Parser.normal(R.cari);
    const list = S.txTerlihat({ status: 'TAMPIL', jenis: R.jenis, kategori: R.kategori, dompet: R.dompet, orang: R.orang, mulai, sampai })
      .filter((t) => !q || g.Parser.normal(t.keterangan + ' ' + S.kat(t.id_kategori).nama + ' ' + t.teks_asli).indexOf(q) > -1)
      .sort((a, b) => b.tanggal_transaksi.localeCompare(a.tanggal_transaksi) || String(b.waktu_catat).localeCompare(String(a.waktu_catat)));
    const tampil = list.slice(0, R.batas);
    el._sisa = list.length - tampil.length;
    if (!list.length) {
      el.querySelector('[data-list]').innerHTML = '<div class="empty"><div class="em">🧾</div><b>' + (R.cari || fs.some((f) => R[f]) ? 'Tidak ada yang cocok' : 'Belum ada transaksi') + '</b>' + (R.cari || fs.some((f) => R[f]) ? 'Coba ubah kata pencarian atau filter.' : 'Transaksi yang dicatat lewat chat muncul di sini.') + '</div>';
      return;
    }
    const grup = {};
    tampil.forEach((t) => { (grup[t.tanggal_transaksi] = grup[t.tanggal_transaksi] || []).push(t); });
    let h = '';
    Object.keys(grup).forEach((d) => {
      const net = grup[d].reduce((a, t) => a + (t.status !== 'AKTIF' ? 0 : t.jenis === 'MASUK' ? t.nominal : t.jenis === 'KELUAR' ? -t.nominal : 0), 0);
      h += '<div class="day-head"><span>' + U.esc(U.labelHari(d)) + '</span><span class="num ' + (net < 0 ? 't-out' : net > 0 ? 't-in' : '') + '">' + (net ? U.rpSelisih(net) : '') + '</span></div><div class="day-group">' +
        grup[d].map(itemTx).join('') + '</div>';
    });
    if (el._sisa > 0) h += '<p class="small muted" style="text-align:center">Memuat ' + el._sisa + ' transaksi lagi…</p>';
    el.querySelector('[data-list]').innerHTML = h;
  }
  function itemTx(t) {
    const pindah = t.jenis === 'PINDAH', k = pindah ? { ikon: '🔄', warna: '#2563EB', nama: 'Pindah saldo' } : S.kat(t.id_kategori);
    const meta = [S.lihatSemua() ? S.orang(t.id_pengguna).nama : '', pindah ? S.namaDompet(t.id_dompet) + ' → ' + S.namaDompet(t.id_dompet_tujuan) : k.nama, !pindah && S.fiturDompet() && t.id_dompet ? S.namaDompet(t.id_dompet) : '', U.jam(t.waktu_catat)].filter(Boolean).join(' · ');
    const st = S.statusTx(t.id_transaksi);
    const badge = t.status === 'DIBATALKAN' ? '<span class="badge b-slate">Dibatalkan</span>' : st === 'pending' ? '<span class="badge b-amber">Menunggu kirim</span>' : st === 'gagal' ? '<span class="badge b-red">Gagal</span>' : '';
    return '<button class="tx-item' + (t.status !== 'AKTIF' ? ' batal' : '') + '" data-tx="' + U.esc(t.id_transaksi) + '"><span class="emo" style="background:' + U.alpha(k.warna || '#94A3B8', 0.16) + '">' + k.ikon + '</span>' +
      '<span class="grow"><span class="ttl ellip" style="display:block">' + U.esc(pindah ? 'Pindah saldo' : t.keterangan) + '</span><span class="sub ellip" style="display:block">' + U.esc(meta) + '</span></span>' +
      '<span style="text-align:right"><span class="amt num ' + (pindah ? 't-tr' : t.jenis === 'MASUK' ? 't-in' : 't-out') + '" style="display:block">' + U.rpTanda(t.nominal, t.jenis) + '</span>' + badge + '</span></button>';
  }

  // =============================================================
  // LEMBAR UBAH TRANSAKSI
  // =============================================================
  const EditTx = {
    async buka(id, opt) {
      opt = opt || {};
      const t = S.tx.get(id);
      if (!t) return UI.Toast.show('Transaksi tidak ditemukan', 'error');
      const boleh = S.bolehUbahTx(t) && t.status === 'AKTIF';
      const fitur = S.fiturDompet();
      const pencatat = S.orang(t.id_pengguna).nama;
      const html = '<div class="seg" data-jenis>' +
        '<button data-v="KELUAR" class="' + (t.jenis === 'KELUAR' ? 'on out' : 'out') + '"><span class="rdot"></span>Pengeluaran</button>' +
        '<button data-v="MASUK" class="' + (t.jenis === 'MASUK' ? 'on in' : 'in') + '"><span class="rdot"></span>Pemasukan</button>' +
        (fitur ? '<button data-v="PINDAH" class="' + (t.jenis === 'PINDAH' ? 'on tr' : 'tr') + '"><span class="rdot"></span>Pindah</button>' : '') + '</div>' +
        '<label class="field" style="margin-top:16px"><span class="lbl">Nominal</span><div class="input-wrap rp"><span class="pre">Rp</span><input class="input num" data-nom value="' + U.fmtInput(t.nominal) + '"></div></label>' +
        '<label class="field"><span class="lbl">Keterangan</span><input class="input" data-ket maxlength="120" value="' + U.esc(t.keterangan) + '"></label>' +
        '<div class="row2" data-katrow><div><span class="lbl">Kategori</span><button class="pick" data-kat></button></div>' + (fitur ? '<div><span class="lbl">Dompet</span><button class="pick" data-dom></button></div>' : '') + '</div>' +
        '<div class="row2" data-pindahrow hidden><div><span class="lbl">Dari</span><button class="pick" data-dari></button></div><div><span class="lbl">Ke</span><button class="pick" data-ke></button></div></div>' +
        '<label class="field"><span class="lbl">Tanggal</span><div class="input-wrap">' + ic('calendar') + '<input class="input" type="date" data-tgl value="' + t.tanggal_transaksi + '" max="' + U.hariIni() + '"></div></label>' +
        (t.teks_asli ? '<p class="small muted" style="margin-top:12px">Dari chat: “' + U.esc(t.teks_asli) + '”</p>' : '') +
        '<div class="sheet-foot">' + (boleh ? '<button class="btn block lg" data-simpan>Simpan Perubahan</button><button class="btn block text-danger" data-hapus>' + ic('trash-2') + 'Hapus Transaksi</button>'
          : '<div class="banner">' + ic('lock') + '<span class="small">' + (t.status !== 'AKTIF' ? 'Transaksi ini sudah dibatalkan.' : 'Hanya ' + U.esc(pencatat) + ' atau Admin yang bisa mengubah transaksi ini.') + '</span></div>') + '</div>';
      const sh = UI.Sheet.open({ title: boleh ? 'Ubah Transaksi' : 'Detail Transaksi', sub: 'Dicatat oleh ' + pencatat + ' · ' + U.tglPanjang(t.tanggal_transaksi) + (U.jam(t.waktu_catat) ? ', ' + U.jam(t.waktu_catat) : ''), html });
      const el = sh.el;
      const st = { jenis: t.jenis, kat: t.id_kategori || S.kategoriDefault(t.jenis === 'MASUK' ? 'MASUK' : 'KELUAR'), dom: t.id_dompet, ke: t.id_dompet_tujuan };
      const nom = el.querySelector('[data-nom]'); UI.inputRupiah(nom);
      if (!boleh) U.$$('input,button.pick,.seg button', el).forEach((x) => { x.disabled = true; });
      const gambar = () => {
        const k = S.kat(st.kat);
        el.querySelector('[data-kat]').innerHTML = '<span>' + k.ikon + '</span><span class="v">' + U.esc(k.nama) + '</span>' + ic('chevron-down');
        const dm = el.querySelector('[data-dom]');
        if (dm) { const d = S.dompet(st.dom); dm.innerHTML = '<span>' + U.esc((d && d.ikon) || '💳') + '</span><span class="v">' + U.esc(d ? d.nama : 'Pilih') + '</span>' + ic('chevron-down'); }
        const p = st.jenis === 'PINDAH';
        el.querySelector('[data-katrow]').hidden = p; el.querySelector('[data-pindahrow]').hidden = !p;
        if (p) {
          el.querySelector('[data-dari]').innerHTML = '<span class="v">' + U.esc(S.namaDompet(st.dom)) + '</span>' + ic('chevron-down');
          el.querySelector('[data-ke]').innerHTML = '<span class="v">' + U.esc(S.namaDompet(st.ke)) + '</span>' + ic('chevron-down');
        }
        U.$$('[data-jenis] button', el).forEach((b) => b.classList.toggle('on', b.dataset.v === st.jenis));
      };
      gambar();
      el.querySelector('[data-jenis]').addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b || !boleh) return;
        st.jenis = b.dataset.v;
        if (st.jenis !== 'PINDAH' && S.kat(st.kat).jenis !== st.jenis) st.kat = S.kategoriDefault(st.jenis);
        gambar();
      });
      const pilihDompet = async (kunci, judul) => {
        const v = await UI.Sheet.pilih({ judul, opsi: S.dompetAktif().map((d) => ({ value: d.id_dompet, label: d.nama, ikon: d.ikon })), nilai: st[kunci] });
        if (v) { st[kunci] = v; gambar(); }
      };
      el.querySelector('[data-kat]').onclick = async () => {
        const v = await UI.Sheet.pilih({ judul: 'Kategori', opsi: S.kategoriAktif(st.jenis === 'MASUK' ? 'MASUK' : 'KELUAR').map((k) => ({ value: k.id_kategori, label: k.nama, ikon: k.ikon })), nilai: st.kat });
        if (v) { st.kat = v; gambar(); }
      };
      if (el.querySelector('[data-dom]')) el.querySelector('[data-dom]').onclick = () => pilihDompet('dom', 'Dompet');
      el.querySelector('[data-dari]').onclick = () => pilihDompet('dom', 'Dari dompet');
      el.querySelector('[data-ke]').onclick = () => pilihDompet('ke', 'Ke dompet');
      if (!boleh) return;
      el.querySelector('[data-simpan]').onclick = async () => {
        const n = U.angkaInput(nom.value);
        if (!(n > 0)) { nom.classList.add('err'); return UI.Toast.show('Nominal harus lebih dari 0', 'error'); }
        if (st.jenis === 'PINDAH' && (!st.dom || !st.ke || st.dom === st.ke)) return UI.Toast.show('Pilih dompet asal dan tujuan yang berbeda', 'error');
        const ket = el.querySelector('[data-ket]').value.trim() || (st.jenis === 'PINDAH' ? 'Pindah saldo' : S.kat(st.kat).nama);
        const katLama = t.id_kategori;
        await S.simpanTx({ id_transaksi: t.id_transaksi, jenis: st.jenis, nominal: n, keterangan: ket, id_kategori: st.jenis === 'PINDAH' ? '' : st.kat,
          id_dompet: st.dom || '', id_dompet_tujuan: st.jenis === 'PINDAH' ? st.ke : '', tanggal_transaksi: el.querySelector('[data-tgl]').value || t.tanggal_transaksi });
        sh.close();
        UI.Toast.show('Perubahan disimpan', 'success', navigator.onLine === false ? 'Akan dikirim saat online.' : '');
        // Belajar dari koreksi kategori lewat tombol Ubah di chat
        if (opt.dariChat && st.jenis !== 'PINDAH' && st.kat !== katLama) {
          const frasa = g.Parser.normal(ket).split(' ').slice(0, 3).join(' ');
          const sudah = S.master.kamus.some((k) => k.frasa === frasa && k.target === st.kat);
          if (frasa && !sudah) g.Chat.setelahPilihKategori(t.id_transaksi, st.kat, frasa);
        }
      };
      el.querySelector('[data-hapus]').onclick = async () => {
        const ok = await UI.Sheet.konfirmasi({ judul: 'Hapus transaksi?', isi: '“' + t.keterangan + '” ' + U.rp(t.nominal) + ' akan dihapus dari catatan keluarga.', ok: 'Hapus', bahaya: true });
        if (!ok) return;
        await S.ubahStatusTx(t.id_transaksi, 'DIHAPUS');
        sh.close();
        UI.Toast.show('Transaksi dihapus', 'success');
      };
    }
  };
  g.EditTx = EditTx;
})(window);
