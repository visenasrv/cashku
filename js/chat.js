/* CashKu — halaman Chat (halaman utama): mencatat, bertanya, unduh laporan, batal, klarifikasi */
(function (g) {
  'use strict';
  const S = g.S, U = g.U, UI = g.UI, ic = g.ic, P = g.Parser;
  const MAKS_TAMPIL = 150;

  const Chat = { el: null, scroll: null, input: null, pending: null, antreKlar: [], _tampil: MAKS_TAMPIL };

  // =============================================================
  // Halaman
  // =============================================================
  UI.Router.daftar('chat', {
    kelas: 'chat-page',
    template() {
      return '<header class="app-header chat-head">' +
        '<span class="logo-c">' + UI.LOGO + '</span>' +
        '<button class="tt" data-sync style="text-align:left;color:inherit"><b>CashKu <span class="sdot" data-sdot></span><span class="pending-pill" data-pend hidden></span></b><span class="sub" data-sub></span></button>' +
        '<button class="hbtn" data-go="dashboard" aria-label="Dashboard">' + ic('chart-column') + '</button>' +
        '<button class="hbtn" data-go="riwayat" aria-label="Riwayat transaksi">' + ic('receipt-text') + '</button>' +
        '<button class="hbtn" data-go="anggota" aria-label="Kelola anggota" data-admin>' + ic('users') + '</button>' +
        '<button class="hbtn" data-go="pengaturan" aria-label="Pengaturan">' + ic('settings') + '<span class="dot" data-usulan hidden></span></button>' +
        '</header>' +
        '<div class="chat-scroll" data-scroll aria-live="polite"></div>' +
        '<div class="chat-bottom"><div class="chips scroll" data-saran></div>' +
        '<div class="chat-input"><div class="box"><textarea rows="1" placeholder="Ketik transaksi atau pertanyaan…" enterkeyhint="send" aria-label="Pesan"></textarea></div>' +
        '<button class="send" aria-label="Kirim">' + ic('send-horizontal') + '</button></div></div>';
    },
    init(el) {
      Chat.el = el; Chat.scroll = el.querySelector('[data-scroll]'); Chat.input = el.querySelector('textarea');
      el.addEventListener('click', (e) => {
        const go = e.target.closest('[data-go]'); if (go) { UI.Router.go(go.dataset.go); return; }
        if (e.target.closest('[data-sync]')) { Chat.infoSinkron(); return; }
      });
      const kirim = () => { const v = Chat.input.value; Chat.input.value = ''; Chat.autoTinggi(); Chat.kirim(v); };
      el.querySelector('.send').addEventListener('click', kirim);
      Chat.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); kirim(); }
      });
      Chat.input.addEventListener('input', Chat.autoTinggi);
      Chat.scroll.addEventListener('click', Chat.klikDalam);
      el.querySelector('[data-saran]').addEventListener('click', (e) => {
        const b = e.target.closest('[data-t]'); if (b) Chat.kirim(b.dataset.t);
      });
      S.on('tx', (ids) => Chat.perbaruiTx(ids));
      S.on('outbox', () => Chat.statusHeader());
      S.on('sync', () => Chat.statusHeader());
      S.on('master', () => { Chat.header(); Chat.saran(); });
    },
    show(el) {
      Chat.header(); Chat.saran(); Chat.statusHeader();
      if (!Chat._dirender || el.dataset.kotor) { Chat.renderSemua(); Chat._dirender = true; }
      if (!S.chat.length) Chat.sambutan();
      requestAnimationFrame(() => Chat.keBawah());
    },
    segarkan() { Chat.header(); Chat.statusHeader(); }
  });

  Chat.autoTinggi = () => { const t = Chat.input; t.style.height = 'auto'; t.style.height = Math.min(120, t.scrollHeight) + 'px'; };
  Chat.keBawah = () => { if (Chat.scroll) Chat.scroll.scrollTop = Chat.scroll.scrollHeight; };
  Chat.header = () => {
    if (!Chat.el || !S.saya) return;
    Chat.el.querySelector('[data-sub]').textContent = 'Asisten keuangan ' + S.namaKeluarga();
    Chat.el.querySelector('[data-admin]').hidden = !S.isAdmin();
    const n = S.bolehKelola() ? S.master.usulan.filter((u) => u.status === 'MENUNGGU').length : 0;
    const d = Chat.el.querySelector('[data-usulan]'); d.hidden = !n; d.textContent = n;
    if (Chat.statusHeader) Chat.statusHeader();
  };
  Chat.saran = () => {
    if (!Chat.el) return;
    const s = [['wallet', 'Saldo', 'saldo'], ['calendar', 'Bulan ini', 'ringkasan bulan ini'], ['chart-pie', 'Sisa anggaran', 'sisa anggaran'],
      ['download', 'Unduh laporan', 'unduh laporan bulan ini'], ['undo-2', 'Batal', 'batal'], ['lightbulb', 'Bantuan', 'bantuan']];
    if (!S.fiturDompet()) s.shift();
    Chat.el.querySelector('[data-saran]').innerHTML = s.map((x) => '<button class="chip" data-t="' + x[2] + '">' + ic(x[0], 'ic-sm') + U.esc(x[1]) + '</button>').join('');
  };
  Chat.statusHeader = () => {
    if (!Chat.el) return;
    const st = g.Sync ? g.Sync.status : 'ok';
    const dot = Chat.el.querySelector('[data-sdot]');
    dot.className = 'sdot' + (st === 'offline' ? ' off' : st === 'error' ? ' err' : st === 'sinkron' ? ' run' : '');
    const n = S.jumlahAntre(), pend = Chat.el.querySelector('[data-pend]');
    const nTx = Array.from(S.outbox.values()).filter((o) => o.type === 'tx.put').length;
    pend.hidden = !nTx;
    pend.innerHTML = ic('clock', 'ic-sm') + nTx;
    pend.title = nTx + ' transaksi belum terkirim';
    Chat.el.querySelector('[data-sub]').textContent = st === 'offline' ? 'Offline' + (nTx ? ' \u00b7 ' + nTx + ' belum terkirim' : ' \u00b7 catatan tersimpan di HP')
      : nTx ? nTx + ' transaksi belum terkirim' : 'Asisten keuangan ' + S.namaKeluarga();
    dot.title = st === 'offline' ? 'Offline' : st === 'error' ? 'Gagal sinkron' : n ? 'Menunggu sinkron' : 'Tersinkron';
  };
  Chat.infoSinkron = () => {
    const st = g.Sync.status;
    const n = Array.from(S.outbox.values()).filter((o) => o.type === 'tx.put').length;
    const teks = st === 'offline' ? 'Kamu sedang offline. ' + (n ? n + ' transaksi akan terkirim otomatis saat online.' : 'Semua catatan tetap tersimpan di HP.')
      : st === 'error' ? 'Sinkron gagal: ' + (g.Sync.pesanError || 'server tidak merespons') + '. Mencoba lagi…'
        : n ? 'Mengirim ' + n + ' transaksi…' : 'Tersinkron · terakhir ' + U.relatif(S.meta.lastSync);
    UI.Toast.show(st === 'offline' ? 'Offline' : st === 'error' ? 'Belum tersinkron' : 'Sinkron', st === 'ok' ? 'success' : st === 'error' ? 'warn' : 'info', teks);
    g.Sync.sekarang();
  };

  // =============================================================
  // Pesan: simpan, render
  // =============================================================
  Chat.tambah = async function (m) {
    m.id = m.id || 'M' + Date.now().toString(36) + U.rand(4);
    m.t = m.t || Date.now();
    m.u = S.saya.id;
    m.from = m.from || 'bot';
    S.chat.push(m);
    await g.DB.put('chat', m);
    if (Chat.scroll && !Chat.el.hidden) {
      const prev = S.chat[S.chat.length - 2];
      if (!prev || U.tglStr(new Date(prev.t)) !== U.tglStr(new Date(m.t))) Chat.scroll.insertAdjacentHTML('beforeend', Chat.dayChip(m.t));
      Chat.scroll.insertAdjacentHTML('beforeend', Chat.htmlPesan(m, prev));
      Chat.keBawah();
    } else if (Chat.el) Chat.el.dataset.kotor = '1';
    return m;
  };
  Chat.ubah = async function (m) {
    await g.DB.put('chat', m);
    const el = Chat.scroll && Chat.scroll.querySelector('[data-id="' + m.id + '"]');
    if (el) { const i = S.chat.indexOf(m); el.outerHTML = Chat.htmlPesan(m, S.chat[i - 1]); }
  };
  Chat.cari = (id) => S.chat.find((m) => m.id === id);
  Chat.sistem = (teks) => Chat.tambah({ kind: 'teks', data: { teks } });

  Chat.dayChip = (t) => {
    const s = U.tglStr(new Date(t)), hi = U.hariIni();
    const lbl = s === hi ? 'Hari ini' : s === U.tambahHari(hi, -1) ? 'Kemarin' : U.tglPanjang(s);
    return '<div class="day-chip">' + lbl + '</div>';
  };
  Chat.renderSemua = function () {
    if (!Chat.scroll) return;
    const list = S.chat.slice(-Chat._tampil);
    let html = S.chat.length > list.length ? '<div style="text-align:center;margin:8px 0"><button class="chip" data-lama>' + ic('history', 'ic-sm') + 'Tampilkan pesan lama</button></div>' : '';
    let hari = '';
    list.forEach((m, i) => {
      const h = U.tglStr(new Date(m.t));
      if (h !== hari) { html += Chat.dayChip(m.t); hari = h; }
      html += Chat.htmlPesan(m, list[i - 1]);
    });
    Chat.scroll.innerHTML = html;
  };

  Chat.htmlPesan = function (m, prev) {
    const sw = prev && prev.from !== m.from ? ' sw' : '';
    const jam = U.jamDari(m.t);
    if (m.from === 'me') {
      return '<div class="msg me' + sw + '" data-id="' + m.id + '"><div class="bub">' + U.esc(m.data.teks).replace(/\n/g, '<br>') +
        '<div class="meta">' + jam + ic('check-check') + '</div></div></div>';
    }
    let isi = '', lebar = false;
    try { const r = (RENDER[m.kind] || RENDER.teks)(m); isi = r.html; lebar = r.lebar; } catch (e) { console.error(e); isi = '<p class="muted">Pesan tidak dapat ditampilkan.</p>'; }
    return '<div class="msg bot' + sw + '" data-id="' + m.id + '"><div class="bub' + (lebar ? ' wide' : '') + '">' + isi + '<div class="meta">' + jam + '</div></div></div>';
  };

  function chipsHtml(m) {
    const d = m.data;
    if (!d.chips || !d.chips.length) return '';
    return '<div class="chips">' + d.chips.map((c, i) => {
      const dipilih = d.selesai && d.dipilih === i;
      const kelas = dipilih ? 'chip on' : 'chip ' + (c.gaya || '');
      return '<button class="' + kelas + '" data-aksi data-msg="' + m.id + '" data-i="' + i + '"' + (d.selesai && !c.tetap ? ' disabled' : '') + '>' +
        (dipilih ? ic('check', 'ic-sm') : (c.ikon ? ic(c.ikon, 'ic-sm') : '')) + U.esc(c.label) + '</button>';
    }).join('') + '</div>';
  }
  const teksAman = (s) => U.esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

  function txRowHtml(t) {
    if (!t) return '<div class="tx-row"><div class="grow muted small">Transaksi sudah dihapus.</div></div>';
    const pindah = t.jenis === 'PINDAH';
    const k = pindah ? { ikon: '🔄', warna: '#2563EB', nama: 'Pindah saldo' } : S.kat(t.id_kategori);
    const dompet = S.fiturDompet() && t.id_dompet ? S.namaDompet(t.id_dompet) : '';
    let sub;
    if (pindah) sub = S.namaDompet(t.id_dompet) + ' → ' + S.namaDompet(t.id_dompet_tujuan);
    else if (t.jenis === 'MASUK') sub = (t.keterangan.toLowerCase() === k.nama.toLowerCase() ? 'Pemasukan' : k.nama) + (dompet ? ' · ' + dompet : '');
    else sub = k.nama + (dompet ? ' · ' + dompet : '');
    if (t.tanggal_transaksi !== U.tglStr(new Date(Date.parse(t.waktu_catat) || Date.now()))) sub += ' · ' + U.tglPendek(t.tanggal_transaksi);
    if (t.id_pengguna !== S.saya.id) sub += ' · ' + S.orang(t.id_pengguna).nama;
    const st = S.statusTx(t.id_transaksi);
    const batal = t.status !== 'AKTIF';
    const kelasAmt = pindah ? 't-tr' : t.jenis === 'MASUK' ? 't-in' : 't-out';
    let act = '';
    if (batal) act = '<span class="badge b-slate">Dibatalkan</span>';
    else {
      if (st === 'pending') act += '<span class="st-wait">' + ic('clock', 'ic-sm') + 'menyimpan…</span>';
      else if (st === 'gagal') act += '<span class="st-fail">' + ic('triangle-alert', 'ic-sm') + 'gagal</span>';
      if (S.bolehUbahTx(t)) act += '<button class="ubah" data-ubah="' + U.esc(t.id_transaksi) + '">Ubah</button>';
    }
    return '<div class="tx-row' + (batal ? ' batal' : '') + '" data-tx="' + U.esc(t.id_transaksi) + '"><span class="emo" style="background:' + U.alpha(k.warna || '#94A3B8', 0.16) + '">' + k.ikon + '</span>' +
      '<div class="grow"><div class="ttl ellip">' + U.esc(pindah ? 'Pindah saldo' : t.keterangan) + '</div><div class="sub">' + U.esc(sub) + '</div></div>' +
      '<div class="rt"><div class="amt num ' + kelasAmt + '">' + U.rpTanda(t.nominal, t.jenis) + '</div><div class="act">' + act + '</div></div></div>';
  }
  Chat.txRowHtml = txRowHtml;

  const RENDER = {
    teks(m) { return { html: '<p>' + teksAman(m.data.teks) + '</p>' + chipsHtml(m) }; },
    pilihan(m) { return { html: '<p>' + teksAman(m.data.teks) + '</p>' + (m.data.sub ? '<p class="small muted">' + teksAman(m.data.sub) + '</p>' : '') + chipsHtml(m) }; },
    tx(m) {
      const d = m.data;
      let h = d.ids.length > 1 ? '<div class="bhead">' + ic('sparkles', 'ic-sm') + d.ids.length + ' transaksi tercatat</div>' : '';
      h += d.ids.map((id) => txRowHtml(S.tx.get(id))).join('');
      (d.warn || []).forEach((w) => {
        h += '<div class="warn-strip' + (w.level === 2 ? ' red' : '') + '">' + U.esc(w.teks) + '<div class="prog ' + (w.level === 2 ? 'l2' : 'l1') + '"><i style="width:' + Math.min(100, w.persen) + '%"></i></div></div>';
      });
      return { html: h, lebar: true };
    },
    ringkasan(m) {
      const d = m.data;
      let h = '<div class="sum-card"><div class="lbl2"><span>' + U.esc(d.judul) + '</span>' + (d.badge ? '<span class="badge ' + d.badge.kelas + '">' + U.esc(d.badge.teks) + '</span>' : '') + '</div>';
      if (d.total != null) h += '<div class="big num ' + (d.kelasTotal || '') + '">' + U.esc(d.total) + '</div>';
      if (d.progress) h += '<div class="prog ' + (d.progress.level === 2 ? 'l2' : d.progress.level === 1 ? 'l1' : '') + '"><i style="width:' + Math.min(100, d.progress.persen) + '%"></i></div>';
      if (d.caption) h += '<p class="small muted" style="margin-top:8px">' + teksAman(d.caption) + '</p>';
      if (d.baris && d.baris.length) h += '<div class="lines">' + d.baris.map((b) => '<div class="ln"><span class="ellip">' + U.esc(b.l) + '</span><b class="num ' + (b.kelas || '') + '">' + U.esc(b.v) + '</b></div>').join('') + '</div>';
      if (d.catatan) h += '<p class="small muted" style="margin-top:8px">' + teksAman(d.catatan) + '</p>';
      h += '</div>' + chipsHtml(m);
      return { html: h, lebar: true };
    },
    laporan(m) {
      const d = m.data, c = d.cfg, r = d.r;
      let h = '<div class="bhead">' + ic('file-text', 'ic-sm') + 'Laporan Keuangan</div><div style="font-weight:700;font-size:16px">📄 ' + U.esc(c.label) + '</div>' +
        '<div class="small muted">' + U.esc(g.Laporan.labelFilter(c)) + '</div>';
      if (r) {
        h += '<div class="inline-card"><div class="ln" style="display:flex;justify-content:space-between"><span class="muted">Pemasukan</span><b class="num t-in">' + U.rp(r.masuk) + '</b></div>' +
          '<div class="ln" style="display:flex;justify-content:space-between"><span class="muted">Pengeluaran</span><b class="num t-out">' + U.rp(r.keluar) + '</b></div>' +
          '<div class="ln" style="display:flex;justify-content:space-between"><span class="muted">Selisih</span><b class="num">' + U.rpSelisih(r.selisih) + '</b></div>' +
          '<div class="small muted" style="margin-top:4px">' + r.jumlah + ' transaksi</div></div>';
      }
      if (d.catatan) h += '<p class="small muted" style="margin-top:8px">' + teksAman(d.catatan) + '</p>';
      return { html: h + chipsHtml(m), lebar: true };
    },
    bantuan(m) {
      const contoh = [['Catat pengeluaran', 'beli kopi 25rb'], ['Beberapa sekaligus', 'bensin 25rb, makan siang 30rb'], ['Pemasukan', 'gaji masuk bri 5jt'],
        ['Pindah saldo', 'top up gopay 100rb dari bri'], ['Tanya', 'jajan bulan ini?'], ['Unduh laporan', 'unduh laporan bulan ini'], ['Batalkan', 'batal']];
      return {
        html: '<p>' + teksAman(m.data.teks || 'Cukup ketik seperti mengobrol. Contoh:') + '</p>' +
          contoh.map((c) => '<div class="ln" style="display:flex;justify-content:space-between;gap:8px;padding:4px 0"><span class="muted small">' + c[0] + '</span><button class="link small" data-isi="' + U.esc(c[1]) + '">' + U.esc(c[1]) + '</button></div>').join('') +
          '<p class="small muted" style="margin-top:8px">Ketuk contoh untuk mencobanya. Kata yang belum saya kenal cukup dikoreksi sekali.</p>',
        lebar: true
      };
    }
  };

  Chat.perbaruiTx = function (ids) {
    if (!Chat.scroll) return;
    const set = new Set(ids || []);
    S.chat.forEach((m) => {
      if (m.kind === 'tx' && m.data.ids.some((id) => set.has(id))) {
        const el = Chat.scroll.querySelector('[data-id="' + m.id + '"]');
        if (el) { const i = S.chat.indexOf(m); el.outerHTML = Chat.htmlPesan(m, S.chat[i - 1]); }
      }
    });
    Chat.statusHeader();
  };

  // =============================================================
  // Interaksi di dalam gelembung
  // =============================================================
  Chat.klikDalam = function (e) {
    const lama = e.target.closest('[data-lama]');
    if (lama) { Chat._tampil += 150; Chat.renderSemua(); return; }
    const ub = e.target.closest('[data-ubah]');
    if (ub) { g.EditTx.buka(ub.dataset.ubah, { dariChat: true }); return; }
    const isi = e.target.closest('[data-isi]');
    if (isi) { Chat.input.value = isi.dataset.isi; Chat.autoTinggi(); Chat.input.focus(); return; }
    const b = e.target.closest('[data-aksi]');
    if (!b) return;
    const m = Chat.cari(b.dataset.msg);
    if (!m) return;
    const chip = m.data.chips[Number(b.dataset.i)];
    Chat.aksi(m, chip, Number(b.dataset.i));
  };

  async function tandai(m, i, ekstra) {
    m.data.selesai = true; m.data.dipilih = i;
    if (ekstra) Object.assign(m.data, ekstra);
    await Chat.ubah(m);
  }

  Chat.aksi = async function (m, c, i) {
    const v = c.nilai || {};
    switch (c.aksi) {
      case 'kirim': if (!c.tetap) await tandai(m, i); return Chat.kirim(v.teks);
      case 'isi': Chat.input.value = v.teks; Chat.autoTinggi(); Chat.input.focus(); return;
      case 'buka': if (!c.tetap) await tandai(m, i); return UI.Router.go(v.halaman, v.param);
      case 'kategori': await tandai(m, i); return Chat.setelahPilihKategori(v.txId, v.katId, v.frasa);
      case 'kategoriLain': {
        const t = S.tx.get(v.txId); if (!t) return;
        const pilih = await UI.Sheet.pilih({ judul: 'Pilih kategori', opsi: S.kategoriAktif(t.jenis).map((k) => ({ value: k.id_kategori, label: k.nama, ikon: k.ikon })), nilai: t.id_kategori });
        if (!pilih) return;
        m.data.chips.splice(m.data.chips.length - 1, 0, { label: S.kat(pilih).ikon + ' ' + S.kat(pilih).nama, aksi: 'kategori', nilai: { txId: v.txId, katId: pilih, frasa: v.frasa } });
        await tandai(m, m.data.chips.length - 2);
        return Chat.setelahPilihKategori(v.txId, pilih, v.frasa);
      }
      case 'ingat':
        await tandai(m, i);
        if (v.ya) {
          await S.ubahMaster('kamus.put', { id_kamus: 'KMS-' + Date.now().toString(36) + U.rand(4), frasa: v.frasa, tipe: 'KATEGORI', target: v.katId, sumber: 'BELAJAR' });
          UI.Toast.show('Kata “' + v.frasa + '” diingat', 'success', 'Berikutnya langsung masuk ' + S.kat(v.katId).nama + '.');
        }
        return;
      case 'nominal': {
        await tandai(m, i);
        const d = m.data.draft; d.nominal = v.n; d.nominalRagu = false;
        if (d.jenis === 'PINDAH' && d.dompetRagu) { Chat.antreKlar.unshift({ type: 'dompet', d, batch: m.data.batch, teksAsli: m.data.teksAsli }); }
        else await Chat.simpanDrafts([d], m.data.teksAsli, m.data.batch);
        Chat.pending = null;
        return Chat.lanjutKlar();
      }
      case 'dompet': {
        await tandai(m, i);
        const d = m.data.draft;
        if (v.sisi === 'tujuan') d.id_dompet_tujuan = v.id; else d.id_dompet = v.id;
        d.dompetRagu = !d.id_dompet || !d.id_dompet_tujuan || d.id_dompet === d.id_dompet_tujuan;
        if (d.dompetRagu) Chat.antreKlar.unshift({ type: 'dompet', d, batch: m.data.batch, teksAsli: m.data.teksAsli });
        else await Chat.simpanDrafts([d], m.data.teksAsli, m.data.batch);
        return Chat.lanjutKlar();
      }
      case 'batalYa': {
        await tandai(m, i);
        for (const id of v.ids) await S.ubahStatusTx(id, 'DIBATALKAN');
        S.cekPeringatan();
        return Chat.sistem(v.ids.length > 1 ? v.ids.length + ' transaksi dibatalkan.' : 'Transaksi dibatalkan.');
      }
      case 'tutup': return tandai(m, i);
      case 'unduhPdf': return g.Laporan.unduh(m.data.cfg, b(m, i));
      case 'ubahFilter': g.Laporan.isiDari(m.data.cfg); return UI.Router.go('laporan');
      case 'pilihTanggal': await tandai(m, i); g.Laporan.isiDari({ mode: 'BEBAS' }); return UI.Router.go('laporan');
      case 'unduhCfg': await tandai(m, i); return Chat.kartuLaporan(v.cfg, v.catatan);
      case 'koreksiYa': await tandai(m, i); return Chat.prosesIntent(P.analisis(v.teks, S.ctxParser()), v.teks);
      case 'koreksiBukan': await tandai(m, i); return Chat.sistem('Oke. Coba ketik ulang, misalnya: **unduh laporan bulan ini**.');
      default: return null;
    }
  };
  function b(m, i) { return Chat.scroll && Chat.scroll.querySelector('[data-id="' + m.id + '"] [data-i="' + i + '"]'); }

  // =============================================================
  // Kirim & proses
  // =============================================================
  Chat.kirim = async function (teks) {
    teks = String(teks || '').trim();
    if (!teks) return;
    await Chat.tambah({ from: 'me', kind: 'teks', data: { teks } });
    try { await Chat.proses(teks); } catch (e) { console.error(e); Chat.sistem('Maaf, terjadi kesalahan: ' + e.message); }
  };

  Chat.proses = async function (teks) {
    if (Chat.pending) {
      const p = Chat.pending;
      const n = P.nominalSaja(teks);
      Chat.pending = null;
      if (n && (p.type === 'harga' || p.type === 'nominal')) return p.jawab(n);
      Chat.antreKlar = [];
    }
    const it = P.analisis(teks, S.ctxParser());
    return Chat.prosesIntent(it, teks);
  };

  Chat.prosesIntent = async function (it, teks) {
    switch (it.type) {
      case 'transaksi': return Chat.catatDrafts(it.drafts, teks);
      case 'tanya': return Chat.jawabTanya(it);
      case 'unduh': return Chat.unduh(it);
      case 'batal': return Chat.batal(it.kata);
      case 'bantuan': return Chat.tambah({ kind: 'bantuan', data: { teks: it.sapa ? 'Halo ' + S.saya.nama + '! Cukup ketik seperti mengobrol. Contoh:' : '' } });
      case 'laporan_ambigu':
        return Chat.tambah({ kind: 'pilihan', data: { teks: 'Mau lihat ringkasan di chat atau unduh PDF?', chips: [
          { label: 'Ringkasan bulan ini', aksi: 'kirim', nilai: { teks: 'ringkasan bulan ini' } },
          { label: 'Unduh PDF bulan ini', aksi: 'kirim', nilai: { teks: 'unduh laporan bulan ini' }, ikon: 'download' }] } });
      case 'butuh_nominal': {
        const ket = it.keterangan;
        await Chat.tambah({ kind: 'pilihan', data: { teks: 'Berapa harga ' + ket.toLowerCase() + 'nya?', sub: 'Ketik nominalnya saja, contoh: **25rb**' } });
        Chat.pending = { type: 'harga', jawab: (n) => Chat.proses(it.teks + ' ' + n) };
        return;
      }
      case 'tidak_dikenal':
        S.antre('log.put', { aksi: 'TIDAK_DIKENALI', detail: String(teks || '').slice(0, 200) }, 'log:' + U.uuid());
        return Chat.tambah({ kind: 'pilihan', data: { teks: 'Saya belum paham maksudnya. Mungkin maksud ' + S.saya.nama + ':', chips: it.saran.map((s) => s.contoh
          ? { label: s.label, aksi: 'isi', nilai: { teks: s.teks }, tetap: true }
          : { label: s.label, aksi: 'kirim', nilai: { teks: s.teks } }) } });
      default: return null;
    }
  };

  // ---------- Transaksi ----------
  const batchBaru = () => 'B' + Date.now().toString(36) + U.rand(3);

  Chat.catatDrafts = async function (drafts, teksAsli) {
    const batch = batchBaru(), jelas = [], klar = [];
    const konfKecil = String(S.master.pengaturan.konfirmasi_nominal_kecil || 'ON') === 'ON';
    let pindahOff = false;
    drafts.forEach((d) => {
      if (d.pindahNonaktif) { pindahOff = true; return; }
      if (d.tanpaNominal) klar.push({ type: 'harga', d });
      else if (d.nominalRagu && konfKecil) klar.push({ type: 'nominal', d });
      else if (d.jenis === 'PINDAH' && d.dompetRagu) klar.push({ type: 'dompet', d });
      else jelas.push(d);
    });
    if (jelas.length) await Chat.simpanDrafts(jelas, teksAsli, batch);
    if (pindahOff) await Chat.sistem('Fitur dompet sedang dinonaktifkan Admin, jadi pindah saldo tidak dicatat.');
    Chat.antreKlar = klar.map((k) => Object.assign(k, { batch, teksAsli }));
    return Chat.lanjutKlar();
  };

  Chat.simpanDrafts = async function (ds, teksAsli, batch) {
    const ids = [], baru = [];
    for (const d of ds) {
      const t = await S.simpanTx({
        jenis: d.jenis, nominal: d.nominal, keterangan: d.keterangan || 'Transaksi', id_kategori: d.id_kategori || '', id_dompet: d.id_dompet || '',
        id_dompet_tujuan: d.id_dompet_tujuan || '', tanggal_transaksi: d.tanggal || U.hariIni(), teks_asli: teksAsli, id_batch: batch, sumber: 'CHAT'
      });
      ids.push(t.id_transaksi);
      if (d.jenis !== 'PINDAH' && d.kategoriDikenal === false) baru.push({ t, d });
    }
    const kats = new Set(ds.map((d) => d.id_kategori));
    const warn = S.cekPeringatan((x) => (!x.a.id_kategori || x.a.id_kategori === 'SEMUA' || kats.has(x.a.id_kategori)) && (x.a.lingkup !== 'PERORANG' || x.a.id_pengguna === S.saya.id))
      .map((x) => {
        const l = S.labelAnggaran(x.a);
        const teks = x.level === 2 ? '🚨 ' + l.lengkap + ' sudah terlampaui ' + U.rp(x.terpakai - x.batas) + '.'
          : '⚠️ ' + l.lengkap + ' ' + Math.round(x.persen) + '% (' + U.rp(x.terpakai) + ' dari ' + U.rp(x.batas) + ')';
        return { level: x.level, teks, persen: x.persen };
      });
    await Chat.tambah({ kind: 'tx', data: { ids, warn } });
    for (const b of baru) await Chat.tanyaKategori(b.t, b.d.frasaBelajar || b.t.keterangan.toLowerCase());
  };

  Chat.tanyaKategori = function (t, frasa) {
    const sering = {};
    S.tx.forEach((x) => { if (x.jenis === t.jenis && x.status === 'AKTIF') sering[x.id_kategori] = (sering[x.id_kategori] || 0) + 1; });
    const def = S.kategoriDefault(t.jenis);
    let pilihan = S.kategoriAktif(t.jenis).filter((k) => k.id_kategori !== def).sort((a, b) => (sering[b.id_kategori] || 0) - (sering[a.id_kategori] || 0) || (a.urutan - b.urutan)).slice(0, 3);
    return Chat.tambah({ kind: 'pilihan', data: {
      teks: 'Kata “' + frasa + '” belum saya kenal. Masuk kategori apa?',
      chips: pilihan.map((k) => ({ label: k.ikon + ' ' + k.nama, aksi: 'kategori', nilai: { txId: t.id_transaksi, katId: k.id_kategori, frasa } }))
        .concat([{ label: 'Lainnya…', aksi: 'kategoriLain', nilai: { txId: t.id_transaksi, frasa }, gaya: 'ghost' }])
    } });
  };

  Chat.setelahPilihKategori = async function (txId, katId, frasa) {
    const t = S.tx.get(txId);
    if (t && t.id_kategori !== katId) await S.simpanTx({ id_transaksi: txId, id_kategori: katId });
    const k = S.kat(katId);
    if (!frasa) return;
    if (S.bolehKelola()) {
      return Chat.tambah({ kind: 'pilihan', data: { teks: 'Sudah diubah ke **' + k.nama + '**. Ingat “' + frasa + '” sebagai ' + k.nama + ' untuk berikutnya?', chips: [
        { label: 'Ya, ingat', aksi: 'ingat', nilai: { ya: true, frasa, katId }, gaya: 'acc' },
        { label: 'Tidak', aksi: 'ingat', nilai: { ya: false } }] } });
    }
    await S.ubahMaster('usulan.put', { id_usulan: 'USL-' + Date.now().toString(36) + U.rand(4), frasa, id_kategori_usulan: katId });
    const pengurus = S.anggotaAktif().filter((a) => a.peran !== 'ANAK').map((a) => a.nama).slice(0, 2).join('/') || 'Admin';
    return Chat.sistem('Sudah diubah ke **' + k.nama + '**. Usulan kata “' + frasa + '” dikirim ke ' + pengurus + '.');
  };

  Chat.lanjutKlar = async function () {
    const k = Chat.antreKlar.shift();
    if (!k) return;
    const d = k.d;
    if (k.type === 'harga') {
      await Chat.tambah({ kind: 'pilihan', data: { teks: 'Berapa harga ' + (d.keterangan || 'itu').toLowerCase() + 'nya?', sub: 'Ketik nominalnya saja, contoh: **25rb**' } });
      Chat.pending = { type: 'harga', jawab: async (n) => { d.nominal = n; d.tanpaNominal = false; d.nominalRagu = false; await Chat.simpanDrafts([d], k.teksAsli, k.batch); return Chat.lanjutKlar(); } };
      return;
    }
    if (k.type === 'nominal') {
      const besar = d.nominal * 1000;
      await Chat.tambah({ kind: 'pilihan', data: { teks: d.keterangan + ': maksudnya ' + U.rp(besar) + ' atau ' + U.rp(d.nominal) + '?', draft: d, batch: k.batch, teksAsli: k.teksAsli,
        chips: [{ label: U.rp(besar), aksi: 'nominal', nilai: { n: besar }, gaya: 'acc' }, { label: U.rp(d.nominal), aksi: 'nominal', nilai: { n: d.nominal } }] } });
      Chat.pending = { type: 'nominal', jawab: async (n) => { d.nominal = n; d.nominalRagu = false; await Chat.simpanDrafts([d], k.teksAsli, k.batch); return Chat.lanjutKlar(); } };
      return;
    }
    if (k.type === 'dompet') {
      const sisi = !d.id_dompet_tujuan || d.id_dompet_tujuan === d.id_dompet ? 'tujuan' : 'sumber';
      const lain = sisi === 'tujuan' ? d.id_dompet : d.id_dompet_tujuan;
      const opsi = S.dompetAktif().filter((x) => x.id_dompet !== lain);
      return Chat.tambah({ kind: 'pilihan', data: { teks: 'Pindah saldo ' + U.rp(d.nominal) + (sisi === 'tujuan' ? ' ke dompet mana?' : ' dari dompet mana?'), draft: d, batch: k.batch, teksAsli: k.teksAsli,
        chips: opsi.map((x) => ({ label: (x.ikon || '') + ' ' + x.nama, aksi: 'dompet', nilai: { sisi, id: x.id_dompet } })) } });
    }
    return null;
  };

  // ---------- Batal ----------
  Chat.batal = async function (kata) {
    const mine = Array.from(S.tx.values()).filter((t) => t.id_pengguna === S.saya.id && t.status === 'AKTIF').sort((a, b) => String(b.waktu_catat).localeCompare(String(a.waktu_catat)));
    let target = [];
    if (kata) {
      const k = P.normal(kata);
      const t = mine.find((x) => P.normal(x.keterangan).indexOf(k) > -1 || P.normal(S.kat(x.id_kategori).nama).indexOf(k) > -1);
      if (t) target = [t];
    } else if (mine.length) {
      const last = mine[0];
      target = last.id_batch ? mine.filter((x) => x.id_batch === last.id_batch) : [last];
    }
    if (!target.length) return Chat.sistem(kata ? 'Tidak ada transaksi “' + kata + '” milikmu yang bisa dibatalkan.' : 'Belum ada transaksi milikmu yang bisa dibatalkan.');
    return Chat.tambah({ kind: 'ringkasan', data: {
      judul: target.length > 1 ? 'Batalkan pesan terakhir?' : 'Batalkan transaksi ini?',
      baris: target.map((t) => ({ l: (t.jenis === 'PINDAH' ? '🔄 Pindah saldo ' + S.namaDompet(t.id_dompet) + ' → ' + S.namaDompet(t.id_dompet_tujuan) : S.kat(t.id_kategori).ikon + ' ' + t.keterangan), v: U.rpTanda(t.nominal, t.jenis), kelas: t.jenis === 'MASUK' ? 't-in' : t.jenis === 'PINDAH' ? 't-tr' : 't-out' })),
      chips: [{ label: 'Ya, batalkan', aksi: 'batalYa', nilai: { ids: target.map((t) => t.id_transaksi) }, gaya: 'danger' }, { label: 'Tidak', aksi: 'tutup' }]
    } });
  };

  // ---------- Pertanyaan ----------
  function catatanKoreksi(it) { return it.perubahan && it.perubahan.length ? 'Saya baca: “' + it.teksKoreksi + '”' : ''; }
  Chat.jawabTanya = async function (it) {
    if (it.periodeError) {
      const pe = it.periodeError;
      return Chat.tambah({ kind: 'pilihan', data: { teks: pe.pesan, chips: (pe.saran || []).map((s) => ({ label: s.label || s, aksi: 'kirim', nilai: { teks: 'ringkasan ' + (s.teks || s) } })) } });
    }
    const per = it.periode || P.periode('bulan ini', U.hariIni());
    const orang = it.orang;
    if (orang && orang !== S.saya.id && !S.lihatSemua()) {
      return Chat.tambah({ kind: 'pilihan', data: { teks: 'Kamu hanya bisa melihat data milikmu sendiri.', chips: [{ label: 'Data saya ' + per.label.toLowerCase(), aksi: 'kirim', nilai: { teks: 'pengeluaran saya ' + per.label.toLowerCase() } }] } });
    }
    const f = { mulai: per.mulai, sampai: per.sampai, orang };
    const namaOrang = orang ? (orang === S.saya.id ? ' (saya)' : ' · ' + S.orang(orang).nama) : '';
    const kor = catatanKoreksi(it);

    if (it.metric === 'saldo') {
      if (!S.fiturDompet()) return Chat.sistem('Fitur dompet sedang dinonaktifkan Admin, jadi saldo per dompet tidak dihitung.');
      let s = S.saldoDompet();
      if (it.dompet) s = s.filter((x) => x.dompet.id_dompet === it.dompet);
      if (!s.length) return Chat.sistem('Belum ada dompet yang bisa kamu lihat saldonya.');
      const total = s.reduce((a, x) => a + x.saldo, 0);
      return Chat.tambah({ kind: 'ringkasan', data: { judul: it.dompet ? 'Saldo ' + s[0].dompet.nama : '💳 Saldo semua dompet', total: (total < 0 ? '−' : '') + U.rp(total), kelasTotal: total < 0 ? 't-out' : '',
        baris: it.dompet ? [] : s.map((x) => ({ l: (x.dompet.ikon || '') + ' ' + x.dompet.nama, v: (x.saldo < 0 ? '−' : '') + U.rp(x.saldo), kelas: x.saldo < 0 ? 't-out' : '' })),
        catatan: (g.Sync.status !== 'ok' ? 'Data per ' + U.relatif(S.meta.lastSync) + '. ' : '') + kor } });
    }
    if (it.metric === 'anggaran') {
      let st = S.statusAnggaran(per.mulai);
      if (it.kategori) st = st.filter((x) => x.a.id_kategori === it.kategori);
      if (!st.length) {
        return Chat.tambah({ kind: 'pilihan', data: { teks: it.kategori ? 'Belum ada anggaran untuk ' + S.kat(it.kategori).nama + '.' : 'Belum ada anggaran yang aktif.',
          chips: S.bolehKelola() ? [{ label: 'Atur anggaran', aksi: 'buka', nilai: { halaman: 'anggaran' }, ikon: 'chart-pie', tetap: true }] : [] } });
      }
      return Chat.tambah({ kind: 'ringkasan', data: { judul: '🎯 Sisa anggaran · ' + U.namaBulan(per.mulai),
        baris: st.map((x) => { const l = S.labelAnggaran(x.a); return { l: l.ikon + ' ' + l.nama + (x.a.lingkup === 'PERORANG' ? ' (' + l.lingkup + ')' : '') + ' · ' + Math.round(x.persen) + '%', v: (x.sisa < 0 ? 'lewat ' : 'sisa ') + U.rp(x.sisa), kelas: x.level === 2 ? 't-out' : x.level === 1 ? 't-warn' : 't-in' }; }),
        catatan: kor } });
    }
    const r = S.ringkasan(f);
    if (it.metric === 'kategori' || (it.metric === 'masuk' && it.kategori)) {
      const k = S.kat(it.kategori);
      const list = r.list.filter((t) => t.id_kategori === it.kategori);
      const total = list.reduce((a, t) => a + t.nominal, 0);
      const ang = S.statusAnggaran(per.mulai).find((x) => x.a.id_kategori === it.kategori && (x.a.lingkup !== 'PERORANG' || x.a.id_pengguna === (orang || S.saya.id)));
      const top = {};
      list.forEach((t) => { const kk = t.keterangan; top[kk] = (top[kk] || 0) + t.nominal; });
      const baris = Object.keys(top).sort((a, b) => top[b] - top[a]).slice(0, 3).map((kk) => ({ l: kk, v: U.rp(top[kk]) }));
      const d = { judul: k.ikon + ' ' + k.nama + ' · ' + per.label + namaOrang, total: U.rp(total), baris, catatan: (list.length ? list.length + ' transaksi. ' : 'Belum ada transaksi. ') + kor };
      if (ang && per.jenis === 'bulan') {
        const p = (total / ang.batas) * 100;
        d.badge = { teks: Math.round(p) + '% Anggaran', kelas: p >= 100 ? 'b-red' : p >= (ang.a.ambang_peringatan || 80) ? 'b-amber' : 'b-green' };
        d.progress = { persen: p, level: p >= 100 ? 2 : p >= (ang.a.ambang_peringatan || 80) ? 1 : 0 };
        d.caption = total <= ang.batas ? 'Sisa **' + U.rp(ang.batas - total) + '** dari anggaran ' + U.rp(ang.batas) : 'Lewat **' + U.rp(total - ang.batas) + '** dari anggaran ' + U.rp(ang.batas);
      }
      return Chat.tambah({ kind: 'ringkasan', data: d });
    }
    if (it.metric === 'keluar' || it.metric === 'masuk') {
      const keluar = it.metric === 'keluar';
      const per2 = keluar ? r.perKategori : r.perKategoriMasuk;
      return Chat.tambah({ kind: 'ringkasan', data: { judul: (keluar ? 'Pengeluaran' : 'Pemasukan') + ' · ' + per.label + namaOrang, total: U.rp(keluar ? r.keluar : r.masuk), kelasTotal: keluar ? 't-out' : 't-in',
        baris: per2.slice(0, 3).map((x) => ({ l: x.ikon + ' ' + x.nama + ' · ' + Math.round(x.persen) + '%', v: U.rp(x.total) })),
        catatan: (per2.length ? '' : 'Belum ada transaksi. ') + kor } });
    }
    if (it.metric === 'daftar') {
      const list = r.list.concat(S.txTerlihat({ mulai: per.mulai, sampai: per.sampai, orang, jenis: 'PINDAH' }).filter((t) => r.list.indexOf(t) < 0))
        .sort((a, b) => String(b.waktu_catat).localeCompare(String(a.waktu_catat)));
      return Chat.tambah({ kind: 'ringkasan', data: { judul: '🗓️ ' + per.label + namaOrang, total: U.rp(r.keluar), kelasTotal: 't-out',
        caption: 'Pengeluaran ' + U.rp(r.keluar) + ' · Pemasukan ' + U.rp(r.masuk),
        baris: list.slice(0, 10).map((t) => ({ l: (t.jenis === 'PINDAH' ? '🔄 Pindah saldo' : S.kat(t.id_kategori).ikon + ' ' + t.keterangan) + (S.lihatSemua() && t.id_pengguna !== S.saya.id ? ' · ' + S.orang(t.id_pengguna).nama : ''), v: U.rpTanda(t.nominal, t.jenis), kelas: t.jenis === 'MASUK' ? 't-in' : t.jenis === 'PINDAH' ? 't-tr' : 't-out' })),
        catatan: (list.length > 10 ? '+' + (list.length - 10) + ' transaksi lain di Riwayat. ' : list.length ? '' : 'Belum ada transaksi. ') + kor,
        chips: list.length > 10 ? [{ label: 'Buka Riwayat', aksi: 'buka', nilai: { halaman: 'riwayat' }, tetap: true }] : [] } });
    }
    if (it.metric === 'ringkasan') {
      return Chat.tambah({ kind: 'ringkasan', data: { judul: '📊 Ringkasan · ' + per.label + namaOrang, total: U.rpSelisih(r.selisih), kelasTotal: r.selisih < 0 ? 't-out' : 't-in',
        baris: [{ l: 'Pemasukan', v: U.rp(r.masuk), kelas: 't-in' }, { l: 'Pengeluaran', v: U.rp(r.keluar), kelas: 't-out' }].concat(r.perKategori.slice(0, 3).map((x) => ({ l: x.ikon + ' ' + x.nama, v: U.rp(x.total) }))),
        catatan: r.jumlah + ' transaksi. ' + kor } });
    }
    return Chat.tambah({ kind: 'pilihan', data: { teks: 'Mau tahu yang mana?', chips: [
      { label: 'Pengeluaran bulan ini', aksi: 'kirim', nilai: { teks: 'pengeluaran bulan ini' } },
      { label: 'Saldo semua dompet', aksi: 'kirim', nilai: { teks: 'saldo' } },
      { label: 'Sisa anggaran', aksi: 'kirim', nilai: { teks: 'sisa anggaran' } }] } });
  };

  // ---------- Unduh laporan lewat chat ----------
  Chat.unduh = async function (it) {
    if (it.perubahan && it.perubahan.length) {
      const per = it.periode && it.periode.ok ? it.periode.label : '';
      return Chat.tambah({ kind: 'pilihan', data: { teks: 'Maksudnya: unduh laporan' + (per ? ' ' + per : '') + '?', sub: 'Saya baca “' + it.teksKoreksi + '”', chips: [
        { label: 'Ya, unduh', aksi: 'koreksiYa', nilai: { teks: it.teksKoreksi }, gaya: 'acc' }, { label: 'Bukan', aksi: 'koreksiBukan' }] } });
    }
    if (!it.periode) {
      return Chat.tambah({ kind: 'pilihan', data: { teks: 'Laporan periode kapan?', chips: [
        { label: 'Minggu ini', aksi: 'kirim', nilai: { teks: 'unduh laporan minggu ini' } }, { label: 'Bulan ini', aksi: 'kirim', nilai: { teks: 'unduh laporan bulan ini' } },
        { label: 'Bulan lalu', aksi: 'kirim', nilai: { teks: 'unduh laporan bulan lalu' } }, { label: 'Tahun ini', aksi: 'kirim', nilai: { teks: 'unduh laporan tahun ini' } },
        { label: 'Pilih tanggal…', aksi: 'pilihTanggal', ikon: 'calendar' }] } });
    }
    if (!it.periode.ok) {
      return Chat.tambah({ kind: 'pilihan', data: { teks: it.periode.pesan, chips: (it.periode.saran || []).map((s) => ({ label: s.label || s, aksi: 'kirim', nilai: { teks: 'unduh laporan ' + (s.teks || s) } }))
        .concat([{ label: 'Pilih bulan…', aksi: 'pilihTanggal', ikon: 'calendar' }]) } });
    }
    const per = it.periode;
    const cfg = { mulai: per.mulai, sampai: per.sampai, label: per.label, jenisPeriode: per.jenis, orang: it.orang || '', dompet: it.dompet || '', jenis: it.jenis || '' };
    if (it.orangTakDikenal) {
      return Chat.tambah({ kind: 'pilihan', data: { teks: 'Anggota “' + it.orangTakDikenal + '” tidak ditemukan.', chips: (S.lihatSemua() ? S.anggotaAktif() : [S.orang(S.saya.id)])
        .map((a) => ({ label: a.nama, aksi: 'unduhCfg', nilai: { cfg: Object.assign({}, cfg, { orang: a.id }) } }))
        .concat(S.lihatSemua() ? [{ label: 'Semua anggota', aksi: 'unduhCfg', nilai: { cfg } }] : []) } });
    }
    if (it.dompetAmbigu) {
      return Chat.tambah({ kind: 'pilihan', data: { teks: 'Dompet yang mana?', chips: it.dompetAmbigu.map((id) => ({ label: S.namaDompet(id), aksi: 'unduhCfg', nilai: { cfg: Object.assign({}, cfg, { dompet: id }) } }))
        .concat([{ label: 'Semua dompet', aksi: 'unduhCfg', nilai: { cfg } }]) } });
    }
    if (cfg.orang && cfg.orang !== S.saya.id && !S.lihatSemua()) {
      return Chat.tambah({ kind: 'pilihan', data: { teks: 'Kamu hanya bisa mengunduh laporan milikmu sendiri.', chips: [{ label: 'Laporan saya ' + per.label.toLowerCase(), aksi: 'unduhCfg', nilai: { cfg: Object.assign({}, cfg, { orang: S.saya.id }) } }] } });
    }
    const catatan = per.tahunTebakan ? 'Saya pakai ' + per.label + ' ya (' + per.label.split(' ')[0] + ' ' + (Number(per.label.split(' ')[1]) + 1) + ' belum berjalan).' : '';
    return Chat.kartuLaporan(cfg, catatan);
  };

  Chat.kartuLaporan = async function (cfg, catatan) {
    const chips = [{ label: 'Unduh PDF', aksi: 'unduhPdf', ikon: 'download', gaya: 'acc', tetap: true }, { label: 'Ubah filter', aksi: 'ubahFilter', ikon: 'sliders-horizontal', tetap: true }];
    if (cfg.mulai < (S.meta.jendelaMulai || '0000')) {
      return Chat.tambah({ kind: 'laporan', data: { cfg, catatan: (catatan ? catatan + ' ' : '') + 'Periode ini lebih lama dari 24 bulan yang tersimpan di HP, jadi datanya diambil dari server saat diunduh (perlu internet).', chips } });
    }
    const r = S.ringkasan(cfg);
    const rr = { masuk: r.masuk, keluar: r.keluar, selisih: r.selisih, jumlah: r.jumlah };
    if (cfg.jenis === 'KELUAR') rr.masuk = 0;
    if (!r.jumlah && !r.list.length) {
      const ada = Array.from(S.tx.values()).filter((t) => t.status === 'AKTIF' && t.tanggal_transaksi <= U.hariIni()).map((t) => t.tanggal_transaksi).sort().pop();
      const saran = [{ label: 'Bulan ini', aksi: 'kirim', nilai: { teks: 'unduh laporan bulan ini' } }];
      if (ada && U.awalBulan(ada) !== U.awalBulan(U.hariIni())) saran.push({ label: U.namaBulan(ada), aksi: 'kirim', nilai: { teks: 'unduh laporan ' + U.namaBulan(ada).toLowerCase() } });
      return Chat.tambah({ kind: 'pilihan', data: { teks: 'Belum ada transaksi di ' + cfg.label + '.', chips: saran } });
    }
    return Chat.tambah({ kind: 'laporan', data: { cfg, r: rr, catatan, chips } });
  };

  // ---------- Sambutan ----------
  Chat.sambutan = function () {
    return Chat.tambah({ kind: 'bantuan', data: { teks: 'Halo ' + S.saya.nama + '! Saya CashKu, asisten keuangan ' + S.namaKeluarga() + '. Cukup ketik seperti mengobrol, misalnya:' } });
  };

  g.Chat = Chat;
})(window);
