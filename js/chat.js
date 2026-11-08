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
        '<div class="chat-bottom"><div class="chips scroll" data-saran></div><div class="suara-bar" data-suara hidden></div>' +
        '<div class="chat-input"><div class="box"><textarea rows="1" placeholder="Ketik transaksi atau pertanyaan…" enterkeyhint="send" aria-label="Pesan"></textarea>' +
        '<button class="mic" data-mic aria-label="Input suara" aria-pressed="false">' + ic('mic') + '</button></div>' +
        '<button class="send" aria-label="Kirim">' + ic('send-horizontal') + '</button></div></div>';
    },
    init(el) {
      Chat.el = el; Chat.scroll = el.querySelector('[data-scroll]'); Chat.input = el.querySelector('textarea');
      el.addEventListener('click', (e) => {
        const go = e.target.closest('[data-go]'); if (go) { UI.Router.go(go.dataset.go); return; }
        if (e.target.closest('[data-sync]')) { Chat.infoSinkron(); return; }
      });
      const kirim = () => { if (g.Suara && g.Suara.aktif()) g.Suara.berhenti(); const v = Chat.input.value; Chat.input.value = ''; Chat.autoTinggi(); Chat.kirim(v); };
      if (g.Suara) g.Suara.pasang(el);
      el.querySelector('.send').addEventListener('click', kirim);
      Chat.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); kirim(); }
      });
      Chat.input.addEventListener('input', Chat.autoTinggi);
      Chat.scroll.addEventListener('click', Chat.klikDalam);
      Chat.pasangTekanLama();
      el.querySelector('[data-saran]').addEventListener('click', (e) => {
        const b = e.target.closest('[data-t]'); if (b) Chat.kirim(b.dataset.t);
      });
      S.on('tx', (ids) => Chat.perbaruiTx(ids));
      S.on('outbox', () => Chat.statusHeader());
      S.on('sync', () => Chat.statusHeader());
      S.on('master', () => { Chat.header(); Chat.saran(); if (g.Penasihat) g.Penasihat.cekTertunda(); });
    },
    show(el) {
      Chat.header(); Chat.saran(); Chat.statusHeader(); Chat.Latar.muat();
      if (!Chat._dirender || el.dataset.kotor) { Chat.renderSemua(); Chat._dirender = true; }
      if (!S.chat.length) Chat.sambutan();
      requestAnimationFrame(() => Chat.keBawah());
    },
    segarkan() { Chat.header(); Chat.statusHeader(); }
  });

  // =============================================================
  // Latar chat dari galeri — hanya di HP ini (IndexedDB), tidak pernah dikirim ke server
  // =============================================================
  const MAKS_SISI = 1600;
  function muatGambar(file) {
    if (g.createImageBitmap) return g.createImageBitmap(file).catch(() => muatImg(file));
    return muatImg(file);
  }
  function muatImg(file) {
    return new Promise((res, rej) => {
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => { URL.revokeObjectURL(u); res(im); };
      im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Format gambar tidak didukung.')); };
      im.src = u;
    });
  }
  async function kecilkan(file) {
    const im = await muatGambar(file);
    const w0 = im.width, h0 = im.height;
    if (!w0 || !h0) throw new Error('Gambar kosong.');
    const k = Math.min(1, MAKS_SISI / Math.max(w0, h0));
    const c = document.createElement('canvas');
    c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    if (im.close) im.close();
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
    if (!blob) throw new Error('Gambar tidak bisa diproses.');
    return blob;
  }
  Chat.Latar = {
    url: null, _uid: null,
    async muat() {
      const uid = S.saya && S.saya.id;
      if (!uid) return;
      if (Chat.Latar._uid === uid) return Chat.Latar.terapkan();
      Chat.Latar._uid = uid;
      let v = null; try { v = await g.DB.latar.get(uid); } catch (e) {}
      Chat.Latar._set(v && v.buf ? new Blob([v.buf], { type: v.type || 'image/jpeg' }) : null);
    },
    _set(blob) {
      if (Chat.Latar.url) URL.revokeObjectURL(Chat.Latar.url);
      Chat.Latar.url = blob ? URL.createObjectURL(blob) : null;
      Chat.Latar.terapkan();
    },
    terapkan() {
      if (!Chat.el) return;
      Chat.el.classList.toggle('ada-latar', !!Chat.Latar.url);
      if (Chat.Latar.url) Chat.el.style.setProperty('--latar-img', 'url("' + Chat.Latar.url + '")');
      else Chat.el.style.removeProperty('--latar-img');
    },
    sibuk: false,
    async pasang(file) {
      if (!file || !/^image\//.test(file.type || 'image/')) throw new Error('Pilih file gambar.');
      const uid = S.saya && S.saya.id; if (!uid) return;
      // Gambar dari galeri kadang belum siap dibaca di percobaan pertama (mis. masih diunduh dari cloud) → coba sekali lagi
      let blob;
      try { blob = await kecilkan(file); }
      catch (e) { await new Promise((r) => setTimeout(r, 600)); blob = await kecilkan(file); }
      const buf = await new Response(blob).arrayBuffer();
      if (!buf.byteLength) throw new Error('Gambar tidak bisa diproses.');
      // Tampilkan langsung, lalu pastikan tersimpan di HP (dibaca ulang)
      Chat.Latar._uid = uid; Chat.Latar._set(blob);
      let ok = false;
      for (let i = 0; i < 2 && !ok; i++) {
        try {
          await g.DB.latar.set(uid, { buf: buf, type: blob.type, diubah: Date.now() });
          const v = await g.DB.latar.get(uid);
          ok = !!(v && v.buf && v.buf.byteLength === buf.byteLength);
        } catch (e) { ok = false; }
      }
      if (!ok) throw new Error('Latar terpasang, tapi belum tersimpan di HP. Coba sekali lagi.');
    },
    async hapus() {
      const uid = S.saya && S.saya.id; if (!uid) return;
      try { await g.DB.latar.hapus(uid); } catch (e) {}
      Chat.Latar._uid = uid; Chat.Latar._set(null);
    }
  };

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
    if (m.from !== 'me' && m.ref === undefined) m.ref = Chat._ref || null;   // balasan ditautkan ke pesan pengguna
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
  /** lepas=true: pesan sistem (mis. hasil sinkron) yang tidak terkait pesan mana pun */
  Chat.sistem = (teks, lepas) => Chat.tambah(Object.assign({ kind: 'teks', data: { teks } }, lepas ? { ref: null } : {}));

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
  Chat.chipsHtml = chipsHtml;
  Chat.teksAman = teksAman;

  // =============================================================
  // Gaya bicara: santai & ramah, seperti asisten pribadi
  // =============================================================
  const G = {
    _akhir: {},
    /** Pilih kalimat acak, tidak sama dengan yang terakhir dipakai */
    pilih(kunci, arr) {
      let i = Math.floor(Math.random() * arr.length);
      if (arr.length > 1 && G._akhir[kunci] === i) i = (i + 1) % arr.length;
      G._akhir[kunci] = i;
      return arr[i];
    },
    isi(s, v) { return s.replace(/\{(\w+)\}/g, (_, k) => (v && v[k] != null ? v[k] : '')); },
    kata(kunci, arr, v) { return G.isi(G.pilih(kunci, arr), Object.assign({ nama: G.nama() }, v || {})); },
    waktu() { const h = new Date().getHours(); return h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam'; },
    nama() { return S.saya ? S.sapa(S.saya) : ''; },
    kat(id) { const k = S.kat(id); return '**' + k.ikon + ' ' + k.nama + '**'; },
    catat(txs, warn) {
      const n = txs.length;
      if ((warn || []).some((w) => w.level === 2)) return G.kata('w2', ['Sudah aku catat ✅ Tapi ada anggaran yang kebablasan nih 👇', 'Tercatat! Eh, ada anggaran yang sudah lewat batas 👇']);
      if ((warn || []).length) return G.kata('w1', ['Sudah aku catat ✅ Anggarannya mulai menipis, hati-hati ya 👇', 'Tercatat! Tapi anggarannya hampir habis nih 👇']);
      const tabungan = (t) => t.jenis === 'PINDAH' && S.dompet(t.id_dompet_tujuan) && S.dompet(t.id_dompet_tujuan).tipe === 'TABUNGAN';
      if (txs.every(tabungan)) return G.kata('nabung', ['Mantap, rajin nabung! 🐷 Sudah aku catat.', 'Asyik, tabungan nambah! 🐷✨', 'Keren, nabung terus ya! 🐷 Sudah tercatat.']);
      if (txs.every((t) => t.jenis === 'PINDAH')) return G.kata('pindah', ['Oke, pindah saldonya sudah aku catat 🔄', 'Siap, saldonya sudah aku pindahkan di catatan 🔄']);
      if (txs.some((t) => t.jenis === 'MASUK')) return G.kata('masuk', ['Yeay, ada rezeki masuk! 💰 Sudah aku catat.', 'Asyik, ada uang masuk! 🎉 Tercatat ya.', 'Sip, pemasukannya sudah aku catat 💰']);
      if (n > 1) return G.kata('banyak', ['Siap, semuanya sudah aku catat ✅', 'Beres, sekaligus semua 👌', 'Oke, langsung aku catat semua 📝']);
      if (txs[0].jenis === 'KELUAR' && txs[0].nominal >= 1000000) return G.kata('besar', ['Lumayan besar nih, tapi sudah aku catat ya ✅', 'Siap, sudah aku catat. Pengeluaran yang cukup besar nih 👀']);
      return G.kata('satu', ['Siap, sudah aku catat ✅', 'Beres, tercatat! 👌', 'Oke, masuk catatan ya 📝', 'Sip, sudah kucatat ✍️', 'Done, tercatat rapi ✨', 'Siap, aman tercatat 👍']);
    },
    ingat(frasa, katId) {
      return G.kata('ingat', ['Siap, aku ingat! Mulai sekarang “{f}” langsung masuk {k} 👍', 'Oke, noted! 📝 Lain kali “{f}” aku masukkan ke {k}.', 'Sip, sudah kusimpan di ingatan 🧠 “{f}” = {k}.', 'Siap laksanakan! “{f}” → {k}, aku ingat ya 😉'], { f: frasa, k: G.kat(katId) });
    },
    tidakIngat() { return G.kata('tdk', ['Oke, nggak aku ingat. Cuma yang ini aja ya 👌', 'Siap, yang ini aja ya. Nggak aku simpan 👌']); },
    pindahKat(katId) { return G.kata('pk', ['Oke, sudah aku pindah ke {k} 👍', 'Sip, masuk {k} ya 👌', 'Siap, aku ubah ke {k} ✅'], { k: G.kat(katId) }); },
    chipsSapa() {
      return [{ label: 'Ringkasan hari ini', aksi: 'kirim', nilai: { teks: 'hari ini' } }, { label: 'Sisa anggaran', aksi: 'kirim', nilai: { teks: 'sisa anggaran' } }]
        .concat(S.fiturDompet() ? [{ label: 'Saldo', aksi: 'kirim', nilai: { teks: 'saldo' } }] : []).concat([{ label: 'Bantuan', aksi: 'kirim', nilai: { teks: 'bantuan' } }]);
    }
  };
  Chat.G = G;

  function txRowHtml(t) {
    if (!t) return '<div class="tx-row"><div class="grow muted small">Transaksi sudah dihapus.</div></div>';
    const pindah = t.jenis === 'PINDAH', saldo = t.jenis === 'SALDO';
    const k = pindah || saldo ? { ikon: S.ikonTx(t), warna: saldo ? '#64748B' : '#2563EB', nama: S.judulTx(t) } : S.kat(t.id_kategori);
    const dompet = S.fiturDompet() && t.id_dompet ? S.namaDompet(t.id_dompet) : '';
    let sub;
    if (pindah) sub = S.namaDompet(t.id_dompet) + ' \u2192 ' + S.namaDompet(t.id_dompet_tujuan);
    else if (saldo) sub = S.namaDompet(t.id_dompet) + ' \u00b7 ' + t.keterangan;
    else if (t.jenis === 'MASUK') sub = (t.keterangan.toLowerCase() === k.nama.toLowerCase() ? 'Pemasukan' : k.nama) + (dompet ? ' \u00b7 ' + dompet : '');
    else sub = k.nama + (dompet ? ' \u00b7 ' + dompet : '');
    if (t.tanggal_transaksi !== U.tglStr(new Date(Date.parse(t.waktu_catat) || Date.now()))) sub += ' · ' + U.tglPendek(t.tanggal_transaksi);
    if (t.id_pengguna !== S.saya.id) sub += ' · ' + S.orang(t.id_pengguna).nama;
    const st = S.statusTx(t.id_transaksi);
    const batal = t.status !== 'AKTIF';
    const kelasAmt = S.kelasJenis(t.jenis);
    let act = '';
    if (batal) act = '<span class="badge b-slate">Dibatalkan</span>';
    else {
      if (st === 'pending') act += '<span class="st-wait">' + ic('clock', 'ic-sm') + 'menyimpan…</span>';
      else if (st === 'gagal') act += '<span class="st-fail">' + ic('triangle-alert', 'ic-sm') + 'gagal</span>';
      if (S.bolehUbahTx(t)) act += '<button class="ubah" data-ubah="' + U.esc(t.id_transaksi) + '">Ubah</button>';
    }
    return '<div class="tx-row' + (batal ? ' batal' : '') + '" data-tx="' + U.esc(t.id_transaksi) + '"><span class="emo" style="background:' + U.alpha(k.warna || '#94A3B8', 0.16) + '">' + k.ikon + '</span>' +
      '<div class="grow"><div class="ttl ellip">' + U.esc(S.judulTx(t)) + '</div><div class="sub">' + U.esc(sub) + '</div></div>' +
      '<div class="rt"><div class="amt num ' + kelasAmt + '">' + U.rpTanda(t.nominal, t.jenis) + '</div><div class="act">' + act + '</div></div></div>';
  }
  Chat.txRowHtml = txRowHtml;

  const RENDER = Chat.RENDER = {
    teks(m) { return { html: '<p>' + teksAman(m.data.teks) + '</p>' + chipsHtml(m) }; },
    pilihan(m) { return { html: '<p>' + teksAman(m.data.teks) + '</p>' + (m.data.sub ? '<p class="small muted">' + teksAman(m.data.sub) + '</p>' : '') + chipsHtml(m) }; },
    tx(m) {
      const d = m.data;
      let h = d.salam ? '<p class="salam">' + teksAman(d.salam) + '</p>' : '';
      h += d.ids.length > 1 ? '<div class="bhead">' + ic('sparkles', 'ic-sm') + d.ids.length + ' transaksi tercatat</div>' : '';
      h += d.ids.map((id) => txRowHtml(S.tx.get(id))).join('');
      if (d.saldo) h += '<div class="small muted" style="padding:2px 0 4px">Saldo ' + U.esc(d.saldo.dompet) + ': ' + (d.saldo.dari < 0 ? '\u2212' : '') + U.rp(d.saldo.dari) + ' \u2192 <b style="color:var(--text)">' + U.rp(d.saldo.ke) + '</b></div>';
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
        ['Pindah saldo', 'top up gopay 100rb dari bri'], ['Nabung (tunai → rekening)', 'nabung 500rb'], ['Atur saldo dompet', 'saldo bank sekarang 5jt'], ['Tanya', 'jajan bulan ini?'], ['Rincian', 'rincian jajan'], ['Uang ke mana', 'uangku habis ke mana saja'], ['Terbesar', 'pengeluaran terbesar minggu ini'], ['Rata-rata', 'rata-rata pengeluaran per hari'], ['Unduh laporan', 'unduh laporan bulan ini'], ['Batalkan', 'batal']];
      return {
        html: '<p>' + teksAman(m.data.teks || 'Cukup ketik seperti mengobrol. Contoh:') + '</p>' +
          contoh.map((c) => '<div class="ln" style="display:flex;justify-content:space-between;gap:8px;padding:4px 0"><span class="muted small">' + c[0] + '</span><button class="link small" data-isi="' + U.esc(c[1]) + '">' + U.esc(c[1]) + '</button></div>').join('') +
          '<p class="small muted" style="margin-top:8px">Ketuk contoh untuk mencobanya. Kata yang belum saya kenal cukup dikoreksi sekali. Tekan lama sebuah pesan untuk menghapusnya — transaksinya ikut dibatalkan.</p>',
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
    if (Date.now() - (Chat._abaikanKlik || 0) < 500) return;
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

  /** Tindakan dari tombol di gelembung; balasannya ikut ditautkan ke pesan pengguna yang sama */
  Chat.aksi = async function (m, c, i) {
    const sebelum = Chat._ref;
    Chat._ref = m.ref || null;
    try { return await aksiDalam(m, c, i); } finally { Chat._ref = sebelum; }
  };
  async function aksiDalam(m, c, i) {
    const v = c.nilai || {};
    switch (c.aksi) {
      case 'kirim': if (!c.tetap) await tandai(m, i); return Chat.kirim(v.teks);
      case 'isi': Chat.input.value = v.teks; Chat.autoTinggi(); Chat.input.focus(); return;
      case 'buka': if (!c.tetap) await tandai(m, i); return UI.Router.go(v.halaman, v.param);
      case 'kategori': await tandai(m, i); return Chat.setelahPilihKategori(v.txId, v.katId, v.frasa);
      case 'kategoriGanda':
        await tandai(m, i);
        if (Chat.pending && Chat.pending.type === 'ganda') Chat.pending = null;
        return Chat.setelahPilihKategori(v.txId, v.katId, v.frasa, { ganda: v.kata });
      case 'kategoriLain': {
        const t = S.tx.get(v.txId); if (!t) return;
        const pilih = await UI.Sheet.pilih({ judul: 'Pilih kategori', opsi: S.kategoriAktif(t.jenis).map((k) => ({ value: k.id_kategori, label: k.nama, ikon: k.ikon })), nilai: t.id_kategori });
        if (!pilih) return;
        m.data.chips.splice(m.data.chips.length - 1, 0, { label: S.kat(pilih).ikon + ' ' + S.kat(pilih).nama, aksi: 'kategori', nilai: { txId: v.txId, katId: pilih, frasa: v.frasa } });
        await tandai(m, m.data.chips.length - 2);
        if (Chat.pending && Chat.pending.type === 'ganda') Chat.pending = null;
        return Chat.setelahPilihKategori(v.txId, pilih, v.frasa, { ganda: v.ganda });
      }
      case 'ingat':
        await tandai(m, i);
        if (Chat.pending && Chat.pending.type === 'ingat') Chat.pending = null;
        if (v.ya) {
          await S.ubahMaster('kamus.put', { id_kamus: 'KMS-' + Date.now().toString(36) + U.rand(4), frasa: v.frasa, tipe: 'KATEGORI', target: v.katId, sumber: 'BELAJAR' });
          return Chat.sistem(G.ingat(v.frasa, v.katId));
        }
        return Chat.sistem(G.tidakIngat());
      case 'ajariPilih': await tandai(m, i); return Chat.simpanIngatan(v.frasa, v.katId);
      case 'ajariLain': {
        const pilih = await UI.Sheet.pilih({ judul: 'Masuk kategori apa?', opsi: S.kategoriAktif().map((k) => ({ value: k.id_kategori, label: k.nama, ikon: k.ikon, sub: k.jenis === 'MASUK' ? 'Pemasukan' : '' })) });
        if (!pilih) return;
        m.data.chips.splice(m.data.chips.length - 1, 0, { label: S.kat(pilih).ikon + ' ' + S.kat(pilih).nama, aksi: 'ajariPilih', nilai: { frasa: v.frasa, katId: pilih } });
        await tandai(m, m.data.chips.length - 2);
        return Chat.simpanIngatan(v.frasa, pilih);
      }
      case 'urungIngat': {
        await tandai(m, i);
        if (v.lama) await S.ubahMaster('kamus.put', { id_kamus: v.lama.id_kamus, frasa: v.frasa, tipe: 'KATEGORI', target: v.lama.target, sumber: v.lama.sumber || 'MANUAL' });
        else await S.ubahMaster('kamus.del', { id_kamus: v.id });
        return Chat.sistem('Oke, nggak jadi aku ingat “' + v.frasa + '” ↩️');
      }
      case 'janggalOk': await tandai(m, i); return Chat.sistem(G.kata('jok', ['Oke, siap 👍', 'Sip, berarti memang segitu ya 👌', 'Siap, aman 👍']));
      case 'janggalUbah': await tandai(m, i); return g.EditTx.buka(v.txId, { dariChat: true });
      case 'nominal': {
        await tandai(m, i);
        const d = m.data.draft; d.nominal = v.n; d.nominalRagu = false;
        Chat.pending = null;
        if (d.jenis === 'PINDAH' && d.dompetRagu) { Chat.antreKlar.unshift({ type: 'dompet', d, batch: m.data.batch, teksAsli: m.data.teksAsli }); return Chat.lanjutKlar(); }
        return Chat.selesaikanDraft(d, { batch: m.data.batch, teksAsli: m.data.teksAsli });
      }
      case 'jenisMasuk': {
        await tandai(m, i);
        if (Chat.pending && Chat.pending.type === 'jenisMasuk') Chat.pending = null;
        const d = m.data.draft;
        d.tanyaJenis = false;
        if (v.dari) {
          d.jenis = 'PINDAH'; d.id_dompet_tujuan = d.id_dompet; d.id_dompet = v.dari; d.id_kategori = ''; d.keterangan = 'Pindah saldo'; d.dompetRagu = false;
          await Chat.simpanDrafts([d], m.data.teksAsli, m.data.batch);
          return Chat.lanjutKlar();
        }
        return Chat.selesaikanDraft(Chat.jadiPemasukan(d), { batch: m.data.batch, teksAsli: m.data.teksAsli });
      }
      case 'dompet': {
        await tandai(m, i);
        if (Chat.pending && Chat.pending.type === 'dompetPindah') Chat.pending = null;
        const d = m.data.draft;
        if (v.sisi === 'tujuan') d.id_dompet_tujuan = v.id; else d.id_dompet = v.id;
        d.dompetRagu = !d.id_dompet || !d.id_dompet_tujuan || d.id_dompet === d.id_dompet_tujuan;
        if (d.dompetRagu) Chat.antreKlar.unshift({ type: 'dompet', d, batch: m.data.batch, teksAsli: m.data.teksAsli });
        else await Chat.simpanDrafts([d], m.data.teksAsli, m.data.batch);
        return Chat.lanjutKlar();
      }
      case 'dompetBayar': {
        await tandai(m, i);
        if (Chat.pending && Chat.pending.type === 'dompetBayar') Chat.pending = null;
        const ds = m.data.drafts;
        ds.forEach((x) => { x.id_dompet = v.id; x.tanyaDompet = false; x.dompetPilihan = null; });
        await Chat.simpanDrafts(ds, m.data.teksAsli, m.data.batch);
        return Chat.lanjutKlar();
      }
      case 'dompetSemua': {
        await tandai(m, i);
        if (Chat.pending && Chat.pending.type === 'dompetBayar') Chat.pending = null;
        Chat.antreKlar.unshift({ type: 'dompetBayar', ds: m.data.drafts, pilihan: null, semua: true, batch: m.data.batch, teksAsli: m.data.teksAsli });
        return Chat.lanjutKlar();
      }
      case 'saldoDompet': {
        await tandai(m, i);
        if (Chat.pending && Chat.pending.type === 'saldoDompet') Chat.pending = null;
        await Chat.terapkanSaldo(v.id, m.data.it.nominal, m.data.teksAsli, m.data.batch);
        return Chat.lanjutKlar();
      }
      case 'batalYa': {
        await tandai(m, i);
        for (const id of v.ids) await S.ubahStatusTx(id, 'DIBATALKAN');
        S.cekPeringatan();
        return Chat.sistem(v.ids.length > 1 ? G.kata('btl2', ['Oke, {n} transaksi sudah dibatalkan ↩️', 'Beres, {n} transaksi dibatalkan ya ↩️'], { n: v.ids.length })
          : G.kata('btl', ['Oke, transaksinya sudah dibatalkan ↩️', 'Beres, sudah dibatalkan ya ↩️', 'Siap, dibatalkan ↩️']));
      }
      case 'tutup': return tandai(m, i);
      case 'typoYa': {
        await tandai(m, i);
        if (Chat.pending && Chat.pending.type === 'konfirmasi') Chat.pending = null;
        for (const x of v.ragu) await S.ubahMaster('typo.put', { salah: x.dari, benar: x.ke });
        await Chat.prosesIntent(P.analisis(v.teks, S.ctxParser()), v.teks);
        return Chat.sistem(G.kata('typo', ['Sip, lain kali {p} langsung aku baca benar 👍', 'Oke, aku catat: {p} 🧠'], { p: v.ragu.map((x) => '“' + x.dari + '” = “' + x.ke + '”').join(', ') }));
      }
      case 'typoBukan':
        await tandai(m, i);
        if (Chat.pending && Chat.pending.type === 'konfirmasi') Chat.pending = null;
        return Chat.prosesIntent(P.analisis(v.teks, S.ctxParser(), { abaikan: v.abaikan, tanpaRagu: true }), v.teks);
      case 'maksudCatat': {
        await tandai(m, i);
        await Chat.tambah({ kind: 'pilihan', data: { teks: 'Berapa harga ' + v.kata + '-nya?', sub: 'Ketik nominalnya aja, contoh: **25rb**' } });
        Chat.pending = { type: 'harga', jawab: (n) => Chat.proses(v.teks + ' ' + n) };
        return;
      }
      case 'salin':
        try { await navigator.clipboard.writeText(v.teks); UI.Toast.show('Disalin', 'success'); } catch (e) { UI.Toast.show('Tidak bisa menyalin otomatis', 'warn', 'Tekan lama teksnya untuk menyalin.'); }
        return;
      case 'sesi': await tandai(m, i); return g.Atur.chip(v);
      case 'isiKetik':
        await tandai(m, i);
        Chat.input.value = v.teks || ''; Chat.autoTinggi();
        try { Chat.input.focus(); Chat.input.setSelectionRange(Chat.input.value.length, Chat.input.value.length); } catch (e) { /* abaikan */ }
        return;
      case 'pakaiVersi': await tandai(m, i); return g.Asli && g.Asli.pakaiSekarang(v);
      case 'pnSesi': await tandai(m, i); return g.Penasihat.chip(v);
      case 'pn': return g.Penasihat.aksi(m, i, v, tandai);
      case 'rcLagi': return g.Rincian.jawab(v.it, '');
      case 'rcBulan': return g.Rincian.bulanLain(v);
      case 'targetHapusYa': await tandai(m, i); return g.Atur.targetHapusYa(v.id);
      case 'sapaYa': await tandai(m, i); return Chat.namaSet(Object.assign({}, v.it, { ragu: false }));
      case 'sapaPilih': {
        await tandai(m, i);
        if (Chat.pending && Chat.pending.type === 'sapaPilih') Chat.pending = null;
        return Chat.namaSet(Object.assign({}, v.it, { ragu: false, sapaan: v.sapaan }));
      }
      case 'ingatanPilih':
        await tandai(m, i);
        if (Chat.pending && Chat.pending.type === 'ingatanPilih') Chat.pending = null;
        return Chat.ingatanJawab(catatanId(v.ids));
      case 'ingatanGanti': await tandai(m, i); return Chat.ingatanSimpan(v.it, { ganti: v.id });
      case 'ingatanTambahan': await tandai(m, i); return Chat.ingatanSimpan(v.it, { tambahan: true });
      case 'ingatanPemilik': {
        await tandai(m, i);
        if (Chat.pending && Chat.pending.type === 'ingatanPemilik') Chat.pending = null;
        return Chat.ingatanSimpan(Object.assign({}, v.it, { label: (v.it.label + ' ' + (v.pemilik || '')).trim() }), { pemilikDitanya: true });
      }
      case 'ingatanSimpanBaru': await tandai(m, i); return Chat.ingatanSimpan({ label: v.label, nilai: '', lingkup: 'PRIBADI' }, { pemilikDitanya: false });
      case 'ingatanHapusYa': {
        await tandai(m, i);
        for (const id of v.ids) await S.ubahMaster('ingatan.del', { id_ingatan: id });
        return Chat.sistem(G.kata('ingHps', ['Oke, sudah aku lupakan 🧽', 'Siap, datanya sudah aku hapus 🧽']));
      }
      case 'pengingatIsi': {
        if (!Chat.pending || Chat.pending.type !== 'pengingatIsi') return;
        await tandai(m, i);
        const pd = Chat.pending; Chat.pending = null;
        return pd.isi(v.teks, true);
      }
      case 'pengingatUbahJam': {
        await tandai(m, i);
        const p = (S.master.pengingat || []).find((x) => x.id_pengingat === v.id);
        if (!p) return Chat.sistem('Pengingat itu sudah tidak ada.');
        return Chat.lanjutPengingat({ id: p.id_pengingat, judul: p.judul, j: { pola: p.pola, tanggal: p.tanggal, hari_bulan: p.hari_bulan, hari_minggu: p.hari_minggu, jam: '', perlu: ['jam'] } });
      }
      case 'pengingatHapusYa': {
        await tandai(m, i);
        const p = (S.master.pengingat || []).find((x) => x.id_pengingat === v.id);
        await S.ubahMaster('pengingat.del', { id_pengingat: v.id });
        return Chat.sistem('Oke, pengingat **' + (p ? p.judul : '') + '** sudah aku hapus 🗑️');
      }
      case 'notifAktif': {
        const r = await g.Pengingat.Notif.aktifkan();
        if (r.ok) await tandai(m, i);
        return Chat.sistem(r.pesan);
      }
      case 'notifUji': { const r = await g.Pengingat.Notif.uji(); return Chat.sistem(r.pesan); }
      case 'kalender': {
        const p = (S.master.pengingat || []).find((x) => x.id_pengingat === v.id);
        if (!p || !g.Pengingat.unduhIcs(p)) return Chat.sistem('Pengingat itu sudah tidak aktif.');
        return UI.Toast.show('Berkas kalender diunduh', 'success', 'Buka berkasnya lalu pilih aplikasi Kalender untuk menyimpan.');
      }
      case 'unduhPdf': return g.Laporan.unduh(m.data.cfg, b(m, i));
      case 'ubahFilter': g.Laporan.isiDari(m.data.cfg); return UI.Router.go('laporan');
      case 'pilihTanggal': await tandai(m, i); g.Laporan.isiDari({ mode: 'BEBAS' }); return UI.Router.go('laporan');
      case 'unduhCfg': await tandai(m, i); return Chat.kartuLaporan(v.cfg, v.catatan);
      case 'koreksiYa': await tandai(m, i); return Chat.prosesIntent(P.analisis(v.teks, S.ctxParser()), v.teks);
      case 'koreksiBukan': await tandai(m, i); return Chat.sistem('Oke deh. Coba ketik ulang ya, misalnya: **unduh laporan bulan ini**.');
      default: return null;
    }
  }
  function b(m, i) { return Chat.scroll && Chat.scroll.querySelector('[data-id="' + m.id + '"] [data-i="' + i + '"]'); }

  // =============================================================
  // Hapus pesan (tekan lama / klik kanan) → transaksinya ikut dibatalkan
  // =============================================================
  Chat.pasangTekanLama = function () {
    const sc = Chat.scroll;
    let timer = null, x0 = 0, y0 = 0;
    const batal = () => { clearTimeout(timer); timer = null; };
    sc.addEventListener('pointerdown', (e) => {
      const bub = e.target.closest('.bub');
      if (!bub || e.target.closest('button, a')) return;
      x0 = e.clientX; y0 = e.clientY;
      batal();
      timer = setTimeout(() => {
        timer = null;
        Chat._abaikanKlik = Date.now();
        if (navigator.vibrate) try { navigator.vibrate(12); } catch (er) {}
        Chat.menuPesan(bub.closest('.msg').dataset.id);
      }, 480);
    });
    sc.addEventListener('pointermove', (e) => { if (timer && (Math.abs(e.clientX - x0) > 8 || Math.abs(e.clientY - y0) > 8)) batal(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => sc.addEventListener(ev, batal));
    sc.addEventListener('contextmenu', (e) => {
      const msg = e.target.closest('.msg');
      if (!msg) return;
      e.preventDefault();
      if (Date.now() - (Chat._abaikanKlik || 0) < 800) return;      // sudah dibuka oleh tekan lama
      Chat.menuPesan(msg.dataset.id);
    });
  };

  /** Pesan-pesan yang ikut terhapus + transaksi yang ikut dibatalkan bila pesan m dihapus */
  Chat.dampakHapus = function (m) {
    let pesan = [m];
    if (m.from === 'me') {
      const terkait = S.chat.filter((x) => x.from !== 'me' && x.ref === m.id);
      if (terkait.length) pesan = pesan.concat(terkait);
      else {
        // Pesan lama (sebelum fitur ini): balasan = gelembung bot berikutnya sampai pesan pengguna berikutnya
        for (let i = S.chat.indexOf(m) + 1; i < S.chat.length && S.chat[i].from !== 'me'; i++) if (S.chat[i].ref === undefined) pesan.push(S.chat[i]);
      }
    }
    const ids = new Set();
    pesan.forEach((x) => { if (x.kind === 'tx') x.data.ids.forEach((id) => ids.add(id)); });
    if (m.from === 'me' && m.data.batch) S.tx.forEach((t) => { if (t.id_batch === m.data.batch) ids.add(t.id_transaksi); });
    const tx = Array.from(ids).map((id) => S.tx.get(id)).filter((t) => t && t.status === 'AKTIF' && S.bolehUbahTx(t));
    return { pesan, tx };
  };

  Chat.menuPesan = async function (id) {
    const m = Chat.cari(id);
    if (!m) return;
    const el = Chat.scroll.querySelector('[data-id="' + id + '"]');
    if (el) el.classList.add('pilih');
    const teks = m.data && m.data.teks ? String(m.data.teks).replace(/\*\*/g, '') : '';
    const dampak = Chat.dampakHapus(m);
    const opsi = [];
    if (teks) opsi.push({ value: 'salin', label: 'Salin teks', ikon: '📋' });
    opsi.push({ value: 'hapus', label: dampak.tx.length ? 'Hapus pesan & batalkan ' + dampak.tx.length + ' transaksi' : 'Hapus pesan', ikon: '🗑️' });
    const v = await UI.Sheet.pilih({ judul: m.from === 'me' ? '“' + (teks.length > 40 ? teks.slice(0, 40) + '…' : teks) + '”' : 'Pesan CashKu', opsi });
    if (el) el.classList.remove('pilih');
    if (v === 'salin') {
      try { await navigator.clipboard.writeText(teks); UI.Toast.show('Teks disalin', 'success'); } catch (e) { UI.Toast.show('Tidak bisa menyalin', 'error'); }
    } else if (v === 'hapus') return Chat.hapusPesan(m);
    return null;
  };

  Chat.hapusPesan = async function (m) {
    const d = Chat.dampakHapus(m);
    if (d.tx.length) {
      const total = d.tx.reduce((a, t) => a + (t.jenis === 'PINDAH' ? 0 : t.nominal), 0);
      const daftar = d.tx.map((t) => '<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0"><span>' + U.esc(S.judulTx(t)) + '</span><b class="num ' + (t.jenis === 'MASUK' ? 't-in' : t.jenis === 'PINDAH' ? 't-tr' : 't-out') + '">' + U.rpTanda(t.nominal, t.jenis) + '</b></div>').join('');
      const ok = await UI.Sheet.konfirmasi({
        judul: 'Hapus pesan ini?',
        isiHtml: 'Transaksi dari pesan ini ikut <b>dibatalkan</b>:<div class="inline-card" style="margin-top:10px">' + daftar + '</div>' + (d.tx.length > 1 && total ? '<div class="small" style="margin-top:6px;text-align:right">Total ' + U.rp(total) + '</div>' : ''),
        ok: 'Hapus & batalkan', batal: 'Jangan hapus', bahaya: true
      });
      if (!ok) return;
    } else {
      const ok = await UI.Sheet.konfirmasi({ judul: 'Hapus pesan ini?', isi: 'Pesan dihapus dari chat di HP ini.', ok: 'Hapus', batal: 'Batal', bahaya: true });
      if (!ok) return;
    }
    for (const t of d.tx) await S.ubahStatusTx(t.id_transaksi, 'DIBATALKAN');
    const hapusIds = new Set(d.pesan.map((x) => x.id));
    S.chat = S.chat.filter((x) => !hapusIds.has(x.id));
    await g.DB.delMany('chat', Array.from(hapusIds));
    // Pertanyaan lanjutan dari pesan yang dihapus tidak perlu dijawab lagi
    if (m.from === 'me' && !S.chat.some((x) => x.from === 'me' && x.t > m.t)) { Chat.pending = null; Chat.antreKlar = []; }
    if (d.tx.length) S.cekPeringatan();
    Chat.renderSemua();
    UI.Toast.show('Pesan dihapus', 'success', d.tx.length ? d.tx.length + ' transaksi dibatalkan' + (navigator.onLine === false ? ' (terkirim saat online)' : '') : '');
  };

  // =============================================================
  // Kirim & proses
  // =============================================================
  const RE_YA = /^(ya+|iya+|yes|yap|yup|boleh|ok|oke+|okey|okay|sip+|siap|ingat|inget|y|betul|benar|bener|mau|bener banget|betul sekali)( (ya|dong|deh|ingat|inget|boleh|aja|saja|siap|tolong|ingat ya|itu|benar|betul))*$/;
  const RE_TIDAK = /^(tidak|nggak|enggak|engga|ngga|no|jangan|skip|nope|gausah|gaush|bukan|salah)( (usah|perlu|deh|ya|dulu|diingat|ingat|itu|maksudnya|maksudku))*$/;
  Chat.kirim = async function (teks) {
    teks = String(teks || '').trim();
    if (!teks) return;
    const um = await Chat.tambah({ from: 'me', kind: 'teks', data: { teks } });
    const sebelum = Chat._ref;
    Chat._ref = um.id;
    try { await Chat.proses(teks); } catch (e) { console.error(e); Chat.sistem('Waduh, ada yang error 😥 ' + e.message); } finally { Chat._ref = sebelum; }
  };

  Chat.proses = async function (teks) {
    // Sesi pengaturan aktif → pesan dibaca sebagai jawaban (bukan transaksi)
    if (g.Atur && g.Atur.aktif() && await g.Atur.terima(teks)) return;
    if (g.Penasihat && g.Penasihat.aktif() && await g.Penasihat.terima(teks)) return;
    if (Chat.pending) {
      const p = Chat.pending;
      const n = P.nominalSaja(teks);
      Chat.pending = null;
      if (n && (p.type === 'harga' || p.type === 'nominal')) return p.jawab(n);
      if (p.type === 'konfirmasi') {
        const tt = P.normal(teks).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
        if (RE_YA.test(tt)) return p.jawab(true);
        if (RE_TIDAK.test(tt) || /^bukan\b/.test(tt)) return p.jawab(false);
      }
      if (p.type === 'pnLunas' && p.jawab(teks)) { Chat.pending = null; return; }
      if (p.type === 'ingatanNilai' && teks.trim() && !/^(batal|tidak|nggak|ga jadi|gak jadi)$/i.test(teks.trim())) return p.jawab(teks.trim());
      if (p.type === 'ingatanPemilik' && teks.trim() && teks.trim().split(/\s+/).length <= 3 && !/^(batal|ga jadi|gak jadi|nggak jadi)$/i.test(teks.trim())) {
        const v = P.normal(teks).replace(/^(?:milik|punya|punyanya|atas nama|a\.?n\.?)\s+/, '').trim();
        return p.jawab(/^(saya|aku|saya sendiri|aku sendiri|sendiri|punyaku|milikku|punya saya)$/.test(v) ? '' : v);
      }
      if (p.type === 'sapaPilih') {
        const tt = P.normal(teks).trim();
        const sp = /^(bapak|pak|pa|bpk)$/.test(tt) ? 'Pak' : /^(ibu|bu|buk|bunda)$/.test(tt) ? 'Bu' : /^(nama|nama saja|nama aja|namanya saja|namaku saja)$/.test(tt) ? 'NAMA' : '';
        if (sp) return Chat.namaSet(Object.assign({}, p.it, { ragu: false, sapaan: sp }));
      }
      if (p.type === 'ingatanPilih' && P.normal(teks).split(' ').length <= 4) {
        const xs = p.cocok(teks);
        if (xs && xs.length) return Chat.ingatanJawab(xs);
      }
      if (p.type === 'pengingatIsi') {
        const hasil = await p.isi(teks);
        if (hasil !== null && hasil !== undefined) return hasil;
      }
      if (p.type === 'ingat' || p.type === 'ganda') {
        const tt = P.normal(teks).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
        if (p.type === 'ingat') {
          if (RE_YA.test(tt)) return p.jawab(true);
          if (RE_TIDAK.test(tt)) return p.jawab(false);
        } else if (tt.split(' ').length <= 4) {
          const i = p.cocok(tt);
          if (i > -1) return p.jawab(i);
        }
      }
      if (p.type === 'jenisMasuk' && /\b(pemasukan|pendapatan|penghasilan|gaji|bonus|uang baru|rejeki|rezeki|income|dikasih|hadiah)\b/.test(P.normal(teks)) && P.normal(teks).split(' ').length <= 4) return p.jawabMasuk();
      if (p.type === 'dompetBayar' || p.type === 'saldoDompet' || p.type === 'dompetPindah' || p.type === 'jenisMasuk') {
        const semuaIds = P.dompetDari(teks, S.ctxParser());
        const ids = semuaIds.filter((id) => !p.pilihan || p.pilihan.indexOf(id) > -1);
        const pendek = P.normal(teks).split(' ').length <= 4;
        if (ids.length === 1 && pendek) return p.jawabDompet(ids[0]);
        const sd0 = semuaIds.length === 1 ? S.saldoDompet().find((x) => x.dompet.id_dompet === semuaIds[0]) : null;
        // Tabungan tidak ditawarkan, tetapi boleh dipakai bila disebut langsung ("tabungan")
        if (p.type !== 'saldoDompet' && sd0 && sd0.dompet.tipe === 'TABUNGAN' && sd0.saldo > 0 && pendek && !p.terkunci) return p.jawabDompet(semuaIds[0]);
        if (p.type !== 'saldoDompet' && !ids.length && semuaIds.length && pendek && !P.nominalSaja(teks)) {
          Chat.pending = p;
          const sd = S.saldoDompet().find((x) => x.dompet.id_dompet === semuaIds[0]);
          return Chat.sistem(sd && sd.saldo <= 0
            ? 'Saldo **' + sd.dompet.nama + '** ' + (sd.saldo < 0 ? '\u2212' : '') + U.rp(sd.saldo) + ', jadi tidak bisa dipakai' + (p.type === 'dompetBayar' ? ' membayar' : '') + '. Pilih dompet di atas, atau catat saldonya dulu.'
            : 'Pilih salah satu dompet di atas, ya.');
        }
        if (ids.length > 1 && pendek && !P.nominalSaja(teks)) {
          Chat.pending = p;
          return Chat.sistem('**' + U.huruf1(teks.trim()) + '** bisa dari beberapa dompet. Ketuk salah satu pilihan di atas, atau ketik nama dompetnya (misalnya **rek** atau **gopay**).');
        }
      }
      Chat.antreKlar = [];
    }
    const it = P.analisis(teks, S.ctxParser());
    return Chat.prosesIntent(it, teks);
  };

  Chat.prosesIntent = async function (it, teks) {
    switch (it.type) {
      case 'transaksi':
        if (it.perubahan && it.perubahan.length && it.drafts[0]) it.drafts[0].koreksi = it.perubahan;
        return Chat.catatDrafts(it.drafts, teks);
      case 'konfirmasiTypo': return Chat.konfirmasiTypo(it, teks);
      case 'maksud': return Chat.maksud(it);
      case 'atur': Chat.pending = null; return g.Atur.mulai(it.alur, it.data);
      case 'aturMenu': return g.Atur.menu();
      case 'penasihat': return g.Penasihat.mulai(it);
      case 'penasihatRagu': return g.Penasihat.ragu(it);
      case 'penasihatUbah': return g.Penasihat.ubahKondisi(it);
      case 'targetDaftar': return g.Atur.targetDaftar();
      case 'targetHapus': return g.Atur.targetHapus(it.kata);
      case 'namaSet': return Chat.namaSet(it);
      case 'namaTanya': return Chat.namaTanya();
      case 'ingatanSimpan': return Chat.ingatanSimpan(it);
      case 'ingatanTanya': return Chat.ingatanTanya(it);
      case 'ingatanDaftar': return Chat.ingatanDaftar(it);
      case 'ingatanHapus': return Chat.ingatanHapus(it.ids, it.kata);
      case 'ingatanUbah': return Chat.ingatanUbah(it);
      case 'pengingat': return Chat.lanjutPengingat({ judul: it.judul, j: Object.assign({}, it.jadwal, { perlu: (it.jadwal.perlu || []).slice() }) });
      case 'pengingatDaftar': return Chat.pengingatDaftar();
      case 'pengingatHapus': return Chat.pengingatHapus(it.kata);
      case 'pengingatUji': return Chat.pengingatUji();
      case 'saldo_set': return Chat.setSaldo(it.items, teks);
      case 'tanya': return Chat.jawabTanya(it);
      case 'unduh': return Chat.unduh(it);
      case 'batal': return Chat.batal(it.kata);
      case 'bantuan': return Chat.tambah({ kind: 'bantuan', data: { teks: 'Cukup ketik kayak lagi ngobrol, ya. Contoh:' } });
      case 'obrolan': return Chat.obrolan(it);
      case 'ajari': return Chat.ajari(it);
      case 'lupakan': return Chat.lupakan(it);
      case 'tanyaKata': return Chat.tanyaKata(it);
      case 'laporan_ambigu':
        return Chat.tambah({ kind: 'pilihan', data: { teks: 'Mau lihat ringkasan di chat atau unduh PDF?', chips: [
          { label: 'Ringkasan bulan ini', aksi: 'kirim', nilai: { teks: 'ringkasan bulan ini' } },
          { label: 'Unduh PDF bulan ini', aksi: 'kirim', nilai: { teks: 'unduh laporan bulan ini' }, ikon: 'download' }] } });
      case 'butuh_nominal': {
        const ket = it.keterangan;
        await Chat.tambah({ kind: 'pilihan', data: { teks: 'Berapa harga ' + ket.toLowerCase() + 'nya?', sub: 'Ketik nominalnya aja, contoh: **25rb**' } });
        Chat.pending = { type: 'harga', jawab: (n) => Chat.proses(it.teks + ' ' + n) };
        return;
      }
      case 'tidak_dikenal':
        // Log pemahaman: isi catatan (nomor, rekening, sandi) tidak ikut tersimpan
        if (!P.catatan.adaKata(teks, S.ctxParser()) && !SENSITIF.test(P.normal(teks))) S.antre('log.put', { aksi: 'TIDAK_DIKENALI', detail: String(teks || '').replace(/\d[\d\s.\-]{2,}\d/g, '###').slice(0, 200) }, 'log:' + U.uuid());
        return Chat.tambah({ kind: 'pilihan', data: { teks: G.kata('tp', ['Hmm, aku belum paham maksudnya 🤔 Mungkin maksud {nama}:', 'Waduh, aku belum paham nih 😅 Maksud {nama} yang ini?']), chips: it.saran.map((s) => s.contoh
          ? { label: s.label, aksi: 'isi', nilai: { teks: s.teks }, tetap: true }
          : { label: s.label, aksi: 'kirim', nilai: { teks: s.teks } }) } });
      default: return null;
    }
  };

  // ---------- Transaksi ----------
  const batchBaru = () => 'B' + Date.now().toString(36) + U.rand(3);

  Chat.catatDrafts = async function (drafts, teksAsli) {
    const batch = batchBaru(), jelas = [], klar = [], tanyaD = [];
    const um = Chat.cari(Chat._ref);
    if (um && um.from === 'me') { um.data.batch = batch; g.DB.put('chat', um); }
    const konfKecil = String(S.master.pengaturan.konfirmasi_nominal_kecil || 'ON') === 'ON';
    let pindahOff = false;
    drafts.forEach((d) => {
      if (d.pindahNonaktif) { pindahOff = true; return; }
      if (d.tanpaNominal) klar.push({ type: 'harga', d });
      else if (d.nominalRagu && konfKecil) klar.push({ type: 'nominal', d });
      else if (d.jenis === 'PINDAH' && d.dompetRagu) klar.push({ type: 'dompet', d });
      else if (d.tanyaJenis) klar.push({ type: 'jenisMasuk', d });
      else if (Chat.perluDompet(d)) tanyaD.push(d);
      else jelas.push(d);
    });
    // Dompet belum jelas → satu pertanyaan untuk semua transaksi dengan pilihan yang sama
    const grup = {};
    tanyaD.forEach((d) => { const kk = (d.dompetPilihan || []).join(',') || '*'; (grup[kk] = grup[kk] || []).push(d); });
    Object.keys(grup).forEach((kk) => klar.push({ type: 'dompetBayar', ds: grup[kk], pilihan: kk === '*' ? null : kk.split(',') }));
    if (jelas.length) await Chat.simpanDrafts(jelas, teksAsli, batch);
    if (pindahOff) await Chat.sistem('Fitur dompet sedang dinonaktifkan Admin, jadi pindah saldo tidak dicatat.');
    Chat.antreKlar = klar.map((k) => Object.assign(k, { batch, teksAsli }));
    return Chat.lanjutKlar();
  };

  Chat.simpanDrafts = async function (ds, teksAsli, batch) {
    const ids = [], baru = [], ragu = [], janggal = [], txs = [];
    for (const d of ds) {
      const t = await S.simpanTx({
        jenis: d.jenis, nominal: d.nominal, keterangan: d.keterangan || 'Transaksi', id_kategori: d.id_kategori || '', id_dompet: d.id_dompet || '',
        id_dompet_tujuan: d.id_dompet_tujuan || '', tanggal_transaksi: d.tanggal || U.hariIni(), teks_asli: teksAsli, id_batch: batch, sumber: 'CHAT'
      });
      ids.push(t.id_transaksi); txs.push(t);
      if (d.jenis !== 'PINDAH' && d.kategoriDikenal === false) baru.push({ t, d });
      else if (d.jenis === 'KELUAR' && d.kategoriRagu) ragu.push({ t, d });
      else if (d.nominalJanggal) janggal.push({ t, d });
    }
    const kats = new Set(ds.map((d) => d.id_kategori));
    const warn = S.cekPeringatan((x) => (!x.a.id_kategori || x.a.id_kategori === 'SEMUA' || kats.has(x.a.id_kategori)) && (x.a.lingkup !== 'PERORANG' || x.a.id_pengguna === S.saya.id))
      .map((x) => {
        const l = S.labelAnggaran(x.a);
        const teks = x.level === 2 ? '🚨 ' + l.lengkap + ' sudah terlampaui ' + U.rp(x.terpakai - x.batas) + '.'
          : '⚠️ ' + l.lengkap + ' ' + Math.round(x.persen) + '% (' + U.rp(x.terpakai) + ' dari ' + U.rp(x.batas) + ')';
        return { level: x.level, teks, persen: x.persen };
      });
    let salam = G.catat(txs, warn);
    const kor = (ds.find((d) => d.koreksi) || {}).koreksi;
    if (kor && kor.length) salam += '\n✏️ Aku baca: ' + kor.map((x) => '“' + x.dari + '” → “' + x.ke + '”').join(', ');
    await Chat.tambah({ kind: 'tx', data: { ids, warn, salam } });
    for (const b of ragu) await Chat.tanyaGanda(b.t, b.d);
    for (const b of janggal) await Chat.tanyaJanggal(b.t, b.d);
    for (const b of baru) await Chat.tanyaKategori(b.t, b.d.frasaBelajar || b.t.keterangan.toLowerCase());
  };

  /** Kata bermakna ganda yang belum jelas ("air 10rb") → tanya maksudnya; sementara dicatat ke tebakan terbaik */
  Chat.tanyaGanda = async function (t, d) {
    const r = d.kategoriRagu;
    const def = (P.KATA_GANDA.find((x) => x.kata.indexOf(r.kata) > -1) || { opsi: [] }).opsi;
    const opsi = r.opsi.filter((o) => S.master.kategori.some((k) => k.id_kategori === o.kat && k.aktif !== false));
    const kunci = opsi.map((o) => {
      const x = def.find((y) => y.kat === o.kat);
      const kata = (s) => P.normal(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && w !== r.kata && !/^(atau|untuk|yang)$/.test(w));
      return [].concat(x ? x.ciri : [], kata(o.label), kata(S.kat(o.kat).nama));
    });
    const m = await Chat.tambah({ kind: 'pilihan', data: {
      teks: r.tanya + ' (**' + t.keterangan + ' ' + U.rp(t.nominal) + '**)',
      sub: 'Biar nggak salah catat 😉 Sementara aku masukkan ke **' + S.kat(t.id_kategori).nama + '**.',
      chips: opsi.map((o) => ({ label: S.kat(o.kat).ikon + ' ' + o.label, aksi: 'kategoriGanda', nilai: { txId: t.id_transaksi, katId: o.kat, frasa: d.frasaKonteks || '', kata: r.kata } }))
        .concat([{ label: 'Lainnya…', aksi: 'kategoriLain', nilai: { txId: t.id_transaksi, frasa: d.frasaKonteks || '', ganda: r.kata }, gaya: 'ghost' }])
    } });
    Chat.pending = { type: 'ganda',
      cocok: (tt) => {
        const no = /^(?:yang |nomor |no )?(\d|pertama|kedua|ketiga|keempat)$/.exec(tt);
        if (no) { const i = /^\d$/.test(no[1]) ? Number(no[1]) - 1 : ['pertama', 'kedua', 'ketiga', 'keempat'].indexOf(no[1]); return i >= 0 && i < opsi.length ? i : -1; }
        return kunci.findIndex((ks) => ks.some((k) => new RegExp('(^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])').test(tt)));
      },
      jawab: (i) => Chat.aksi(m, m.data.chips[i], i) };
    return m;
  };

  /** Nominal jauh dari kebiasaan → konfirmasi (siapa tahu salah ketik) */
  Chat.tanyaJanggal = function (t, d) {
    return Chat.tambah({ kind: 'pilihan', data: {
      teks: 'Eh, **' + t.keterangan + ' ' + U.rp(t.nominal) + '**? Biasanya cuma sekitar ' + U.rp(d.nominalJanggal.biasa) + ' lho 👀 Nominalnya sudah benar?',
      chips: [{ label: 'Iya, benar', aksi: 'janggalOk', gaya: 'acc' }, { label: 'Ubah', aksi: 'janggalUbah', nilai: { txId: t.id_transaksi }, ikon: 'pencil' }]
    } });
  };

  Chat.tanyaKategori = function (t, frasa) {
    const sering = {};
    S.tx.forEach((x) => { if (x.jenis === t.jenis && x.status === 'AKTIF') sering[x.id_kategori] = (sering[x.id_kategori] || 0) + 1; });
    const def = S.kategoriDefault(t.jenis);
    const umum = P.kataUmum(frasa);
    // "belanja 200rb": belanja apa? → tanya kategori, tetapi kata umum tidak diingat
    if (umum && t.jenis === 'KELUAR' && !sering['KAT-BULANAN']) sering['KAT-BULANAN'] = 0.5;
    let pilihan = S.kategoriAktif(t.jenis).filter((k) => k.id_kategori !== def).sort((a, b) => (sering[b.id_kategori] || 0) - (sering[a.id_kategori] || 0) || (a.urutan - b.urutan)).slice(0, 3);
    if (umum) frasa = '';
    return Chat.tambah({ kind: 'pilihan', data: {
      teks: umum ? '**' + t.keterangan + ' ' + U.rp(t.nominal) + '** masuk kategori apa nih?' : G.kata('kb', ['Hmm, “{f}” belum aku kenal nih 🤔 Masuk kategori apa?', 'Eh, “{f}” belum aku kenal 😅 Masuk kategori apa ya?'], { f: frasa }),
      sub: umum ? (t.jenis === 'KELUAR' ? 'Lain kali sebut barangnya ya, misalnya **belanja mainan 100rb**, biar langsung masuk kategori yang pas.' : '') : 'Cukup sekali, berikutnya aku langsung tahu 😉',
      chips: pilihan.map((k) => ({ label: k.ikon + ' ' + k.nama, aksi: 'kategori', nilai: { txId: t.id_transaksi, katId: k.id_kategori, frasa } }))
        .concat([{ label: 'Lainnya…', aksi: 'kategoriLain', nilai: { txId: t.id_transaksi, frasa }, gaya: 'ghost' }])
    } });
  };

  Chat.setelahPilihKategori = async function (txId, katId, frasa, o) {
    o = o || {};
    const t = S.tx.get(txId);
    if (t && t.id_kategori !== katId) await S.simpanTx({ id_transaksi: txId, id_kategori: katId });
    const k = S.kat(katId);
    if (!frasa) {
      // Kata bermakna ganda tanpa kata pendamping: tidak diingat sebagai kata, tetapi riwayat nominalnya dipakai lain kali
      if (o.ganda) return Chat.sistem(G.kata('gn', ['Oke, masuk {k} 👍 Lain kali aku kenali juga dari nominalnya.', 'Sip, {k} ya 👌 Aku perhatikan nominalnya buat selanjutnya.'], { k: G.kat(katId) }));
      return Chat.sistem(G.pindahKat(katId));
    }
    const fn = P.normal(frasa);
    if (S.master.kamus.some((e) => e.tipe === 'KATEGORI' && P.normal(e.frasa) === fn && e.target === katId)) return Chat.sistem(G.pindahKat(katId));
    if (S.bolehKelola()) {
      const m = await Chat.tambah({ kind: 'pilihan', data: {
        teks: G.kata('ti', ['Sip, masuk {k} 👍 Mau aku ingat “{f}” = {n} buat selanjutnya?', 'Oke, {k} ya 👌 Perlu aku ingat “{f}” = {n} biar lain kali langsung?'], { k: G.kat(katId), f: frasa, n: k.nama }),
        sub: o.ganda && fn !== o.ganda ? '“' + o.ganda + '” saja tetap aku tanyakan kalau ragu.' : undefined,
        chips: [{ label: 'Ya, ingat ya', aksi: 'ingat', nilai: { ya: true, frasa, katId }, gaya: 'acc' }, { label: 'Nggak usah', aksi: 'ingat', nilai: { ya: false } }] } });
      Chat.pending = { type: 'ingat', jawab: (ya) => Chat.aksi(m, m.data.chips[ya ? 0 : 1], ya ? 0 : 1) };
      return m;
    }
    await S.ubahMaster('usulan.put', { id_usulan: 'USL-' + Date.now().toString(36) + U.rand(4), frasa, id_kategori_usulan: katId });
    return Chat.sistem('Sip, masuk **' + k.nama + '** 👍 Usulan kata “' + frasa + '” sudah aku kirim ke ' + Chat.pengurus() + ' ya.');
  };
  Chat.pengurus = () => S.anggotaAktif().filter((a) => a.peran !== 'ANAK').map((a) => a.nama).slice(0, 2).join('/') || 'Admin';

  // ---------- Diajari langsung: "ingat air galon masuk kebutuhan bulanan" ----------
  Chat.ajari = async function (it) {
    const f = P.normal(it.frasa);
    if (P.kataUmum(f)) return Chat.sistem('“' + f + '” terlalu umum buat diingat 😅 Coba sebut barangnya, misalnya **ingat sabun cuci masuk kebutuhan bulanan**.');
    const ks = it.kandidat.filter((id) => S.master.kategori.some((k) => k.id_kategori === id && k.aktif !== false));
    if (ks.length === 1) return Chat.simpanIngatan(f, ks[0]);
    const mirip = (k) => { const a = P.normal(it.namaKat || ''), b = P.normal(k.nama); return b.indexOf(a.slice(0, 3)) > -1 ? 0 : P.lev(a, b); };
    const opsi = ks.length ? ks : S.kategoriAktif('KELUAR').slice().sort((a, b) => mirip(a) - mirip(b)).slice(0, 4).map((k) => k.id_kategori);
    return Chat.tambah({ kind: 'pilihan', data: {
      teks: ks.length ? '“' + f + '” masuk kategori yang mana nih?' : 'Hmm, kategori “' + it.namaKat + '” nggak ketemu 🤔 Maksudnya yang mana?',
      chips: opsi.map((id) => ({ label: S.kat(id).ikon + ' ' + S.kat(id).nama, aksi: 'ajariPilih', nilai: { frasa: f, katId: id } }))
        .concat([{ label: 'Lainnya…', aksi: 'ajariLain', nilai: { frasa: f }, gaya: 'ghost' }]) } });
  };
  Chat.simpanIngatan = async function (f, katId) {
    const k = S.kat(katId);
    if (!S.bolehKelola()) {
      await S.ubahMaster('usulan.put', { id_usulan: 'USL-' + Date.now().toString(36) + U.rand(4), frasa: f, id_kategori_usulan: katId });
      return Chat.sistem('Siap! Aku sampaikan dulu ke ' + Chat.pengurus() + ' ya. Kalau disetujui, “' + f + '” langsung masuk **' + k.nama + '** 👍');
    }
    const lama = S.master.kamus.find((e) => e.tipe === 'KATEGORI' && P.normal(e.frasa) === f);
    if (lama && lama.target === katId) return Chat.sistem('Tenang, aku sudah ingat kok 😄 “' + f + '” = ' + G.kat(katId) + '.');
    const id = lama ? lama.id_kamus : 'KMS-' + Date.now().toString(36) + U.rand(4);
    await S.ubahMaster('kamus.put', { id_kamus: id, frasa: f, tipe: 'KATEGORI', target: katId, sumber: 'MANUAL' });
    let teks = G.ingat(f, katId);
    if (lama && S.master.kategori.some((x) => x.id_kategori === lama.target)) teks += ' (sebelumnya ' + S.kat(lama.target).nama + ')';
    const gx = P.KATA_GANDA.find((x) => x.kata.indexOf(f) > -1);
    if (gx) {
      const lain = gx.opsi.find((o) => o.kat !== katId);
      if (lain) teks += '\nTapi karena “' + f + '” bisa macam-macam, kalau ada petunjuk lain (misalnya “' + f + ' ' + lain.ciri[0] + '”) aku sesuaikan ya 😉';
    }
    return Chat.tambah({ kind: 'teks', data: { teks, chips: [{ label: 'Urungkan', aksi: 'urungIngat', nilai: { frasa: f, id, lama: lama ? { id_kamus: lama.id_kamus, target: lama.target, sumber: lama.sumber } : null }, gaya: 'ghost', ikon: 'undo-2' }] } });
  };
  Chat.lupakan = async function (it) {
    const f = P.normal(it.frasa);
    const es = S.master.kamus.filter((e) => e.tipe === 'KATEGORI' && P.normal(e.frasa) === f);
    if (!es.length) return Chat.sistem('Hmm, aku nggak punya ingatan soal “' + f + '” kok 🤔');
    if (!S.bolehKelola()) return Chat.sistem('Yang bisa menghapus ingatan kata cuma ' + Chat.pengurus() + ' ya 🙏');
    for (const e of es) await S.ubahMaster('kamus.del', { id_kamus: e.id_kamus });
    return Chat.sistem(G.kata('lupa', ['Oke, sudah aku lupakan “{f}” 🧽 Lain kali aku tanya dulu ya.', 'Siap, “{f}” sudah aku hapus dari ingatan 🧽'], { f }));
  };
  Chat.tanyaKata = function (it) {
    const f = P.normal(it.frasa);
    const gx = P.KATA_GANDA.find((x) => x.kata.indexOf(f) > -1);
    const ada = (id) => S.master.kategori.some((k) => k.id_kategori === id && k.aktif !== false);
    if (gx) {
      const ops = gx.opsi.filter((o) => ada(o.kat));
      return Chat.sistem('“' + f + '” bisa macam-macam nih:\n' + ops.map((o) => '• ' + o.label + ' → ' + S.kat(o.kat).ikon + ' ' + S.kat(o.kat).nama).join('\n') + '\nAku lihat dari kata lain dan nominalnya. Kalau masih ragu, aku tanya dulu 😉');
    }
    const e = S.master.kamus.find((x) => x.tipe === 'KATEGORI' && P.normal(x.frasa) === f && ada(x.target));
    if (e) return Chat.sistem('“' + f + '” biasanya aku masukkan ke ' + G.kat(e.target) + ' 👍');
    return Chat.sistem('Aku belum kenal “' + f + '” 🤔 Ajari aku dong, misalnya: **ingat ' + f + ' masuk jajan**.');
  };

  // ---------- Salah ketik setengah yakin: "Maksudnya: ...?" ----------
  Chat.ringkasMaksud = function (r, t) {
    if (r && r.type === 'transaksi') {
      const kerja = (/^(beli|bayar|isi|jajan|belanja|transfer|kirim|setor|tarik|nabung)\b/.exec(t) || [])[1];
      return r.drafts.map((d) => (kerja && r.drafts.length === 1 ? kerja + ' ' : '') + String(d.keterangan || '').toLowerCase() + ' ' + U.rp(d.nominal) +
        (d.jenis !== 'PINDAH' && d.id_kategori ? ' (' + S.kat(d.id_kategori).nama + ')' : '')).join(', ');
    }
    return t;
  };
  Chat.konfirmasiTypo = async function (it, teksAsli) {
    const m = await Chat.tambah({ kind: 'pilihan', data: {
      teks: 'Maksudnya: **' + Chat.ringkasMaksud(it.hasil, it.teks) + '**?',
      sub: 'Aku kurang yakin dengan ' + it.ragu.map((x) => '“' + x.dari + '” (' + x.ke + '?)').join(', ') + '. Kalau benar, lain kali langsung aku pahami.',
      chips: [{ label: 'Ya', aksi: 'typoYa', nilai: { teks: it.teks, ragu: it.ragu }, gaya: 'acc' }, { label: 'Bukan', aksi: 'typoBukan', nilai: { teks: teksAsli, abaikan: it.abaikan } }] } });
    Chat.pending = { type: 'konfirmasi', jawab: (ya) => Chat.aksi(m, m.data.chips[ya ? 0 : 1], ya ? 0 : 1) };
    return m;
  };

  // ---------- Satu kata saja ("kopi") → tanyakan maksudnya ----------
  const reKata = (k) => new RegExp('(^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])');
  const txDenganKata = (k) => { const re = reKata(P.normal(k)); return S.txTerlihat({}).filter((t) => t.jenis === 'KELUAR' && re.test(P.normal(t.keterangan))); };
  Chat.maksud = function (it) {
    const k = it.kata;
    const chips = [{ label: '📝 Catat ' + k, aksi: 'maksudCatat', nilai: { teks: it.teks, kata: k } }];
    if (it.dikenal) chips.push({ label: '🏷️ Masuk kategori apa?', aksi: 'kirim', nilai: { teks: k + ' termasuk kategori apa' } });
    if (txDenganKata(k).length) {
      chips.push({ label: '💰 Harga ' + k, aksi: 'kirim', nilai: { teks: 'harga ' + k + ' berapa' } });
      chips.push({ label: '📊 Pengeluaran ' + k + ' bulan ini', aksi: 'kirim', nilai: { teks: 'pengeluaran ' + k + ' bulan ini' } });
    }
    return Chat.tambah({ kind: 'pilihan', data: { teks: '**' + U.huruf1(k) + '** — maksudnya gimana nih? 🤔', sub: it.dikenal ? 'Mau dicatat, atau mau tanya sesuatu?' : 'Kalau mau dicatat, sebutkan harganya ya, misalnya **' + k + ' 10rb**.', chips } });
  };

  // ---------- Harga dari catatan: "harga kopi berapa" ----------
  Chat.jawabHarga = function (it, kor) {
    const k = it.kata, list = txDenganKata(k).sort((a, b) => String(b.tanggal_transaksi + b.waktu_catat).localeCompare(String(a.tanggal_transaksi + a.waktu_catat)));
    if (!list.length) {
      return Chat.tambah({ kind: 'pilihan', data: { teks: 'Belum ada catatan harga **' + k + '** 🤔', sub: 'Begitu kamu catat (misalnya **' + k + ' 25rb**), aku bisa kasih tahu harga terakhir & rata-ratanya.',
        chips: [{ label: '📝 Catat ' + k, aksi: 'isi', nilai: { teks: k + ' ' }, tetap: true }] } });
    }
    const n = list.map((t) => t.nominal), rata = n.reduce((a, b) => a + b, 0) / n.length;
    const ter = list[0];
    return Chat.tambah({ kind: 'ringkasan', data: { judul: '💰 Harga ' + k, total: U.rp(ter.nominal),
      caption: 'Terakhir · ' + U.tglPanjang(ter.tanggal_transaksi) + (ter.keterangan && P.normal(ter.keterangan) !== P.normal(k) ? ' · ' + ter.keterangan : ''),
      baris: [{ l: 'Rata-rata', v: U.rp(rata) }, { l: 'Termurah', v: U.rp(Math.min.apply(null, n)) }, { l: 'Termahal', v: U.rp(Math.max.apply(null, n)) }, { l: 'Dicatat', v: n.length + ' kali' }],
      catatan: kor } });
  };

  // ---------- Sapaan nama: "saya Dani" → "Baik, Pak Dani." ----------
  Chat.namaSet = async function (it) {
    if (!S.saya) return;
    const calon = Object.assign({}, S.saya, { panggilan: it.nama || S.saya.panggilan || '' });
    if (it.sapaan) calon.sapaan = it.sapaan;
    if (it.ragu) {
      return Chat.tambah({ kind: 'pilihan', data: { teks: 'Saya panggil **' + (S.hormat(calon) === null ? calon.panggilan : S.sapa(calon)) + '**, ya?',
        chips: [{ label: 'Ya', aksi: 'sapaYa', nilai: { it }, gaya: 'acc' }, { label: 'Bukan', aksi: 'tutup' }] } });
    }
    // Peran belum jelas (akun lama / kepala keluarga) → tanya sekali
    if (S.hormat(calon) === null) {
      await Chat.tambah({ kind: 'pilihan', data: { teks: 'Saya panggil Bapak atau Ibu?', chips: [{ label: 'Bapak', aksi: 'sapaPilih', nilai: { it, sapaan: 'Pak' } }, { label: 'Ibu', aksi: 'sapaPilih', nilai: { it, sapaan: 'Bu' } }, { label: 'Nama saja', aksi: 'sapaPilih', nilai: { it, sapaan: 'NAMA' } }] } });
      Chat.pending = { type: 'sapaPilih', it };
      return;
    }
    const patch = { panggilan: calon.panggilan };
    if (it.sapaan) patch.sapaan = it.sapaan;
    else if (!S.saya.sapaan && S.hormat(calon) !== null && !S.saya.hubungan && S.saya.peran !== 'ANAK') patch.sapaan = S.hormat(calon) || 'NAMA';
    await S.simpanSapaan(patch);
    return Chat.tambah({ kind: 'pilihan', data: { teks: 'Baik, ' + S.sapa() + '. 😊', sub: 'Mau diganti? Ketik misalnya **panggil saya Bang ' + (S.saya.panggilan || 'Dani') + '** atau **panggil saya ' + (S.saya.panggilan || 'Dani') + ' saja**.' } });
  };
  Chat.namaTanya = function () {
    if (!S.saya) return;
    const HUB = { KEPALA: 'kepala keluarga', SUAMI: 'suami', ISTRI: 'istri', ANAK: 'anak', LAINNYA: 'anggota keluarga' };
    const peran = HUB[String(S.saya.hubungan || '').toUpperCase()] || (S.saya.peran === 'ADMIN' ? 'kepala keluarga' : S.saya.peran === 'ANAK' ? 'anak' : 'anggota keluarga');
    const akun = 'akun **@' + (S.saya.username || S.saya.nama) + '**, ' + peran;
    if (!S.saya.panggilan) return Chat.tambah({ kind: 'pilihan', data: { teks: 'Ini ' + akun + ' 🙂 Tapi aku belum tahu nama panggilanmu.', sub: 'Ketik misalnya **nama saya Dani**.' } });
    return Chat.tambah({ kind: 'pilihan', data: { teks: G.kata('siapaSy', ['Tentu tahu dong 😊 Ini **{nama}**.', 'Ingat dong, ini **{nama}** 😊', 'Ini **{nama}**, kan? 😄']) + '\n(' + akun + ')',
      sub: 'Mau ganti panggilan? Ketik **panggil saya …**' } });
  };

  // ---------- Catatan data: nomor rekening, PLN, telepon, dll ----------
  const SENSITIF = /\b(pin|password|pass|sandi|kata sandi|cvv|otp)\b/;
  const CC = () => P.catatan;
  const tampilC = (x) => CC().tampil(x.label || x, S.ctxParser());
  const strukC = (x) => CC().struktur(x.label || x, S.ctxParser());
  const catatanId = (ids) => S.ingatanSaya().filter((x) => ids.indexOf(x.id_ingatan) > -1);
  /** Bagian label yang membedakan catatan dari kata yang ditanyakan ("istri", "vicky") */
  function pembeda(x, kata, semua) {
    const A = CC().kataKunci(x.label, S.ctxParser());
    const beda = A.filter((w) => w.g !== 'UMUM' && !(kata || []).some((k) => CC().miripKata(k, w.k)))
      .map((w) => (w.g === 'LEMBAGA' || /^(pln|pdam|bpjs|ktp|nik|npwp)$/.test(w.k) ? w.k.toUpperCase() : w.k));
    let s = Array.from(new Set(beda)).join(' ');
    if (!s) s = x.id_pengguna !== S.saya.id ? 'dari ' + S.orang(x.id_pengguna).nama : 'punyaku';
    // dua catatan berlabel sama → bedakan dengan awal isinya
    if ((semua || []).filter((y) => y !== x && y.label === x.label).length) s += ' · ' + String(x.nilai).slice(0, 6) + '…';
    return s;
  }
  const judulKata = (kata) => CC().tampil((kata || []).join(' '), S.ctxParser());
  const pemilikTeks = (x) => (x.id_pengguna !== S.saya.id ? ' (dari ' + S.orang(x.id_pengguna).nama + ')' : '');

  Chat.ingatanSimpan = async function (it, opsi) {
    opsi = opsi || {};
    if (!it.nilai) {
      const m = await Chat.tambah({ kind: 'pilihan', data: { teks: 'Oke! Isi **' + tampilC(it.label) + '** apa?', sub: 'Ketik saja isinya, nanti aku ingat 🧠' } });
      Chat.pending = { type: 'ingatanNilai', jawab: (v) => Chat.ingatanSimpan(Object.assign({}, it, { nilai: v }), opsi) };
      return m;
    }
    const st = strukC(it.label);
    const milikku = S.ingatanSaya().filter((x) => x.id_pengguna === S.saya.id);
    if (!opsi.tambahan && !opsi.ganti) {
      // Jenis + lembaga + pemilik sama → tanya diganti atau disimpan sebagai tambahan
      const sama = milikku.filter((x) => strukC(x).kunci === st.kunci);
      if (sama.length) {
        if (sama.some((x) => String(x.nilai).trim() === String(it.nilai).trim())) {
          return Chat.tambah({ kind: 'pilihan', data: { teks: 'Sudah aku simpan kok 👍\n**' + tampilC(sama[0]) + '**: ' + sama[0].nilai, chips: [{ label: 'Salin', aksi: 'salin', nilai: { teks: sama[0].nilai }, tetap: true }] } });
        }
        return Chat.tambah({ kind: 'pilihan', data: { teks: '**' + tampilC(it.label) + '** sudah ada: ' + sama.map((x) => x.nilai).join(', ') + '\nMau diganti atau disimpan sebagai tambahan?',
          chips: [{ label: 'Ganti', aksi: 'ingatanGanti', nilai: { id: sama[0].id_ingatan, it }, gaya: 'acc' }, { label: 'Simpan tambahan', aksi: 'ingatanTambahan', nilai: { it } }, { label: 'Batal', aksi: 'tutup' }] } });
      }
      // Pemilik belum disebut, padahal ada catatan sejenis milik orang lain → tanya milik siapa
      if (!opsi.pemilikDitanya && !st.pemilik.length && (st.jenis.length || st.lembaga.length)) {
        const sejenis = S.ingatanSaya().filter((x) => { const s2 = strukC(x); return s2.pemilik.length && s2.jenis.join() === st.jenis.join() && s2.lembaga.join() === st.lembaga.join(); });
        if (sejenis.length) {
          const nama = Array.from(new Set(sejenis.map((x) => strukC(x).pemilik.join(' ')))).slice(0, 4);
          await Chat.tambah({ kind: 'pilihan', data: { teks: '**' + tampilC(it.label) + '** ini milik siapa?', sub: 'Ketik namanya, atau pilih:',
            chips: [{ label: 'Saya sendiri', aksi: 'ingatanPemilik', nilai: { it, pemilik: '' } }].concat(nama.map((n) => ({ label: n, aksi: 'ingatanPemilik', nilai: { it, pemilik: n } }))) } });
          Chat.pending = { type: 'ingatanPemilik', jawab: (v) => Chat.ingatanSimpan(Object.assign({}, it, { label: (it.label + ' ' + v).trim() }), Object.assign({}, opsi, { pemilikDitanya: true })) };
          return;
        }
      }
    }
    const lama = opsi.ganti ? milikku.find((x) => x.id_ingatan === opsi.ganti) : null;
    const id = lama ? lama.id_ingatan : 'ING-' + Date.now().toString(36) + U.rand(4);
    const nilaiLama = lama ? lama.nilai : '';
    await S.ubahMaster('ingatan.put', { id_ingatan: id, label: lama && !opsi.labelBaru ? lama.label : it.label, nilai: it.nilai, lingkup: it.lingkup || (lama && lama.lingkup) || 'PRIBADI', id_pengguna: S.saya.id,
      jenis: st.jenis.join(' '), lembaga: st.lembaga.join(' '), pemilik: st.pemilik.join(' ') });
    const label = tampilC(lama && !opsi.labelBaru ? lama.label : it.label);
    let teks = (lama ? G.kata('ingUbah', ['Oke, sudah aku perbarui 👍', 'Siap, sudah kuganti 👌']) : G.kata('ingBaru', ['Oke, akan aku ingat 👍', 'Siap, sudah kusimpan 🧠', 'Beres, aku ingat ya ✍️'])) +
      '\n**' + label + '**: ' + it.nilai;
    if (lama && nilaiLama !== it.nilai) teks += '\n(sebelumnya: ' + nilaiLama + ')';
    const sub = ((it.lingkup || (lama && lama.lingkup)) === 'KELUARGA' ? 'Bisa dilihat semua anggota keluarga. ' : 'Hanya untuk kamu. ') + 'Tanya kapan saja, misalnya: **' + P.normal(it.label).split(' ').slice(0, 3).join(' ') + '**' +
      (SENSITIF.test(P.normal(it.label)) ? ' ⚠️ Data ini tersimpan di Google Sheet keluarga — jangan simpan PIN ATM/m-banking atau kode OTP ya.' : '');
    return Chat.tambah({ kind: 'pilihan', data: { teks, sub, chips: [{ label: 'Salin', aksi: 'salin', nilai: { teks: it.nilai }, tetap: true }, { label: 'Hapus', aksi: 'ingatanHapusYa', nilai: { ids: [id] }, gaya: 'ghost' }] } });
  };
  Chat.ingatanJawab = function (xs) {
    const teks = xs.length === 1 ? '**' + tampilC(xs[0]) + '**' + pemilikTeks(xs[0]) + ': ' + xs[0].nilai
      : 'Ini yang aku ingat:\n' + xs.map((x) => '• **' + tampilC(x) + '**' + pemilikTeks(x) + ': ' + x.nilai).join('\n');
    return Chat.tambah({ kind: 'pilihan', data: { teks, chips: xs.slice(0, 4).map((x) => ({ label: 'Salin' + (xs.length > 1 ? ' ' + pembeda(x, [], xs) : ''), aksi: 'salin', nilai: { teks: x.nilai }, tetap: true })) } });
  };
  Chat.ingatanTanya = async function (it) {
    const xs = catatanId(it.ids || []);
    if (!xs.length) {
      const mirip = catatanId(it.mirip || []);
      const label = it.label || (it.kata || []).join(' ');
      const chips = [{ label: 'Simpan', aksi: 'ingatanSimpanBaru', nilai: { label }, gaya: 'acc' }]
        .concat(mirip.map((x) => ({ label: tampilC(x), aksi: 'ingatanPilih', nilai: { ids: [x.id_ingatan] } })));
      return Chat.tambah({ kind: 'pilihan', data: { teks: 'Belum ada catatan tentang **' + (judulKata(it.kata) || label) + '**. Mau saya simpan?', sub: mirip.length ? 'Atau mungkin maksudnya yang ini:' : '', chips } });
    }
    if (xs.length === 1 && !it.pilih) return Chat.ingatanJawab(xs);
    // Lebih dari satu → tanya yang mana
    const chips = xs.slice(0, 6).map((x) => ({ label: pembeda(x, it.kata, xs), aksi: 'ingatanPilih', nilai: { ids: [x.id_ingatan] } }));
    if (xs.length > 1) chips.push({ label: 'Tampilkan semua', aksi: 'ingatanPilih', nilai: { ids: xs.map((x) => x.id_ingatan) }, gaya: 'ghost' });
    await Chat.tambah({ kind: 'pilihan', data: { teks: (judulKata(it.kata) || 'Catatan') + ' yang mana?', chips } });
    Chat.pending = { type: 'ingatanPilih', cocok: (teks) => {
      const c = CC().cari(teks, xs, S.ctxParser());
      if (/^(semua|tampilkan semua|semuanya)$/.test(P.normal(teks))) return xs;
      return c.ids.length && c.ids.length < xs.length ? catatanId(c.ids) : null;   // jawaban harus mempersempit pilihan
    } };
  };
  Chat.ingatanDaftar = function (it) {
    it = it || {};
    const semua = S.ingatanSaya();
    if (!semua.length) return Chat.tambah({ kind: 'pilihan', data: { teks: 'Aku belum menyimpan catatan apa pun 🙂', sub: 'Contoh: **ingat nomor listrik 1234567890**, **ingat rekening bri istri 0123456789**, **ingat password wifi: rahasia123**.' } });
    const xs = it.kata ? catatanId(it.ids || []) : semua;
    if (!xs.length) return Chat.tambah({ kind: 'pilihan', data: { teks: 'Belum ada catatan **' + judulKata(it.kata) + '** 🙂', chips: [{ label: 'Simpan', aksi: 'ingatanSimpanBaru', nilai: { label: (it.kata || []).join(' ') }, gaya: 'acc' }, { label: 'Semua catatan', aksi: 'kirim', nilai: { teks: 'daftar catatan' } }] } });
    const urut = xs.slice().sort((a, b) => tampilC(a).localeCompare(tampilC(b)));
    return Chat.tambah({ kind: 'pilihan', data: { teks: (it.kata ? 'Semua ' + judulKata(it.kata).toLowerCase() : 'Ini yang aku ingat') + ' 🧠\n' + urut.map((x) => '• **' + tampilC(x) + '**' + pemilikTeks(x) + ': ' + x.nilai + (x.lingkup === 'KELUARGA' ? ' 👨‍👩‍👧' : '')).join('\n'),
      sub: 'Ubah: **ganti ' + P.normal(urut[0].label) + ' jadi …** · Hapus: **hapus catatan ' + P.normal(urut[0].label) + '**',
      chips: urut.slice(0, 4).map((x) => ({ label: 'Salin ' + pembeda(x, it.kata || [], urut), aksi: 'salin', nilai: { teks: x.nilai }, tetap: true })) } });
  };
  Chat.ingatanUbah = function (it) {
    const xs = catatanId(it.ids).filter((x) => x.id_pengguna === S.saya.id || (x.lingkup === 'KELUARGA' && S.saya.peran === 'ADMIN'));
    if (!xs.length) return Chat.sistem('Catatan itu bukan milikmu, jadi tidak bisa kuubah 🙏');
    if (xs.length === 1) return Chat.ingatanSimpan({ label: xs[0].label, nilai: it.nilai, lingkup: xs[0].lingkup }, { ganti: xs[0].id_ingatan });
    return Chat.tambah({ kind: 'pilihan', data: { teks: (judulKata(it.kata) || 'Catatan') + ' yang mana yang diganti jadi **' + it.nilai + '**?',
      chips: xs.slice(0, 6).map((x) => ({ label: pembeda(x, it.kata, xs), aksi: 'ingatanGanti', nilai: { id: x.id_ingatan, it: { label: x.label, nilai: it.nilai, lingkup: x.lingkup } } })).concat([{ label: 'Batal', aksi: 'tutup' }]) } });
  };
  Chat.ingatanHapus = function (ids, kata) {
    if (!ids.length) return Chat.sistem('Belum ada catatan **' + judulKata(kata) + '** 🤔 Ketik **daftar catatan** untuk melihat semuanya.');
    const xs = catatanId(ids).filter((x) => x.id_pengguna === S.saya.id || S.saya.peran === 'ADMIN');
    if (!xs.length) return Chat.sistem('Catatan itu bukan milikmu, jadi tidak bisa kuhapus 🙏');
    if (xs.length === 1) {
      return Chat.tambah({ kind: 'pilihan', data: { teks: 'Hapus **' + tampilC(xs[0]) + '** (' + xs[0].nilai + ') dari catatan?',
        chips: [{ label: 'Hapus', aksi: 'ingatanHapusYa', nilai: { ids: [xs[0].id_ingatan] }, gaya: 'acc' }, { label: 'Batal', aksi: 'tutup' }] } });
    }
    return Chat.tambah({ kind: 'pilihan', data: { teks: (judulKata(kata) || 'Catatan') + ' yang mana yang dihapus?',
      chips: xs.slice(0, 6).map((x) => ({ label: '🗑️ ' + pembeda(x, kata, xs), aksi: 'ingatanHapusYa', nilai: { ids: [x.id_ingatan] } }))
        .concat([{ label: 'Hapus semua (' + xs.length + ')', aksi: 'ingatanHapusYa', nilai: { ids: xs.map((x) => x.id_ingatan) }, gaya: 'ghost' }, { label: 'Batal', aksi: 'tutup' }]) } });
  };

  // ---------- Pengingat & alarm ----------
  const PJ = () => g.Pengingat.Jadwal;
  const JAM_SARAN = { pagi: ['05:00', '06:00', '07:00', '08:00'], siang: ['11:00', '12:00', '13:00'], sore: ['15:00', '16:00', '17:00'], malam: ['19:00', '20:00', '21:00'] };
  Chat.tanyaPengingat = async function (d, teks, chips, isi, sub) {
    const m = await Chat.tambah({ kind: 'pilihan', data: { teks, sub, chips: (chips || []).map((c) => Object.assign({ aksi: 'pengingatIsi' }, c)) } });
    Chat.pending = { type: 'pengingatIsi', isi };
    return m;
  };
  Chat.lanjutPengingat = async function (d) {
    const j = d.j, perlu = j.perlu || (j.perlu = []);
    const selesai = (x) => { j.perlu = perlu.filter((y) => y !== x); return Chat.lanjutPengingat(d); };
    if (perlu.indexOf('judul') > -1) {
      return Chat.tanyaPengingat(d, 'Siap! Mau diingatkan soal apa? 📝', [], (tk) => { d.judul = U.huruf1(String(tk).trim().replace(/^(untuk|buat|soal)\s+/i, '')); return selesai('judul'); },
        'Contoh: **bayar air**, **minum obat**, **jemput anak**');
    }
    if (perlu.indexOf('kapan') > -1) {
      return Chat.tanyaPengingat(d, 'Kapan mau diingatkan soal **' + d.judul + '**? ⏰', [{ label: 'Besok', nilai: { teks: 'besok' } }, { label: 'Setiap hari', nilai: { teks: 'setiap hari' } },
        { label: 'Setiap minggu', nilai: { teks: 'setiap minggu' } }, { label: 'Setiap bulan', nilai: { teks: 'setiap bulan' } }], (tk) => {
        const j2 = P.jadwalDari(P.normal(tk), PJ().hariIniLokal());
        if (!j2.pola) return null;
        d.j = Object.assign(j2, { jam: j2.jam || j.jam, perlu: j2.perlu.filter((x) => x !== 'kapan' && !(x === 'jam' && j.jam)) });
        return Chat.lanjutPengingat(d);
      }, 'Contoh: **besok**, **setiap tanggal 20**, **tiap Senin**, **27 November**');
    }
    if (perlu.indexOf('hari') > -1) {
      const HR = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
      return Chat.tanyaPengingat(d, 'Setiap hari apa? 📅', HR.map((h) => ({ label: h, nilai: { teks: h.toLowerCase() } })), (tk) => {
        const ada = HR.map((h, i) => (new RegExp('\\b' + h.toLowerCase().slice(0, 3)).test(P.normal(tk)) ? i + 1 : 0)).filter(Boolean);
        if (!ada.length) return null;
        j.hari_minggu = ada.join(','); return selesai('hari');
      });
    }
    if (perlu.indexOf('tanggal') > -1) {
      return Chat.tanyaPengingat(d, 'Tanggal berapa setiap bulannya? 📅', ['1', '5', '10', '20', '25'].map((x) => ({ label: 'Tgl ' + x, nilai: { teks: x } })).concat([{ label: 'Akhir bulan', nilai: { teks: 'akhir' } }]), (tk) => {
        const t = P.normal(tk);
        if (/akhir/.test(t)) j.hari_bulan = 'AKHIR';
        else { const n = Number((/\d{1,2}/.exec(t) || [])[0]); if (!(n >= 1 && n <= 31)) return null; j.hari_bulan = String(n); }
        j.pola = 'BULANAN'; return selesai('tanggal');
      });
    }
    if (perlu.indexOf('ulang') > -1) {
      const hb = Number(String(j.tanggal).slice(8, 10));
      const tglTeks = U.tglPanjang(j.tanggal);
      const denganBulan = !j.hari_bulan;     // tanggal + nama bulan disebut ("27 November")
      const opsi = [{ label: '🔁 Setiap tanggal ' + hb, nilai: { teks: 'setiap bulan' } }, { label: 'Hanya ' + tglTeks, nilai: { teks: 'sekali' } }];
      if (denganBulan) opsi.push({ label: '🎂 Setiap tahun', nilai: { teks: 'setiap tahun' } });
      return Chat.tanyaPengingat(d, 'Mau diulang **setiap tanggal ' + hb + '**, atau **' + tglTeks + '** saja?', opsi, (tk) => {
        const t = P.normal(tk);
        if (/tahun/.test(t)) { j.pola = 'TAHUNAN'; j.tanggal = j.tanggal.slice(5); }
        else if (/\b(setiap|tiap|ulang|diulang|rutin|bulan)\b/.test(t) && !/\b(itu saja|itu aja|sekali)\b/.test(t)) { j.pola = 'BULANAN'; j.hari_bulan = String(hb); }
        else if (/\b(sekali|hanya|cuma|saja|aja|itu|tidak|nggak|jangan)\b/.test(t)) { j.pola = 'SEKALI'; j.hari_bulan = ''; }
        else return null;
        return selesai('ulang');
      });
    }
    if (perlu.indexOf('jam') > -1) {
      const saran = JAM_SARAN[j.saranJam] || ['07:00', '09:00', '12:00', '19:00'];
      return Chat.tanyaPengingat(d, 'Jam berapa mau diingatkan? 🕘', saran.map((x) => ({ label: x.replace(':', '.'), nilai: { teks: 'jam ' + x } })), (tk) => {
        let t = P.normal(tk).trim();
        if (/^\d{1,2}$/.test(t)) t = 'jam ' + t;
        if (/^\d{1,2}\s+(pagi|siang|sore|malam|subuh)$/.test(t)) t = 'jam ' + t;
        const jm = P.jamDari(t) || P.jamDari('jam ' + t);
        if (!jm) return null;
        j.jam = jm.jam; return selesai('jam');
      }, 'Ketik saja, misalnya **9**, **19.30**, atau **jam 7 malam**');
    }
    return Chat.simpanPengingat(d);
  };
  Chat.simpanPengingat = async function (d) {
    const J = PJ(), j = d.j, now = Date.now();
    const p = { id_pengingat: d.id || 'PGN-' + Date.now().toString(36) + U.rand(4), id_pengguna: S.saya.id, judul: d.judul || 'Pengingat', pola: j.pola || 'SEKALI',
      tanggal: j.tanggal || '', hari_bulan: j.hari_bulan || '', hari_minggu: j.hari_minggu || '', jam: j.jam || '07:00' };
    if (j.relatifMenit) { const w = J.dariMs(now + j.relatifMenit * 60000); p.pola = 'SEKALI'; p.tanggal = w.tanggal; p.jam = w.jam; }
    if (p.pola === 'SEKALI' && !p.tanggal) { p.tanggal = J.hariIniLokal(); if (!J.berikutnya(p, now)) p.tanggal = J.dariMs(now + 864e5).tanggal; }
    if (p.pola !== 'SEKALI') p.tanggal = p.pola === 'TAHUNAN' ? p.tanggal : '';
    p.berikutnya = J.berikutnya(p, now - 1000);
    if (!p.berikutnya) {
      d.j.perlu = ['jam'];
      await Chat.sistem('Waduh, waktu itu sudah lewat 😅 Pilih jam lain ya.');
      return Chat.lanjutPengingat(d);
    }
    await S.ubahMaster('pengingat.put', p);
    const st = g.Pengingat.Notif.status();
    const chips = [];
    if (st !== 'aktif') chips.push({ label: '🔔 Aktifkan alarm HP', aksi: 'notifAktif', tetap: true });
    if (!(g.Asli && g.Asli.aktif())) chips.push({ label: '📅 Simpan ke Kalender', aksi: 'kalender', nilai: { id: p.id_pengingat }, tetap: true });
    chips.push({ label: 'Ubah jam', aksi: 'pengingatUbahJam', nilai: { id: p.id_pengingat } });
    chips.push({ label: 'Hapus', aksi: 'pengingatHapusYa', nilai: { id: p.id_pengingat }, gaya: 'ghost' });
    return Chat.tambah({ kind: 'pilihan', data: {
      teks: (d.id ? 'Oke, jamnya sudah aku ubah ⏰' : G.kata('pgn', ['Siap, nanti aku ingatkan ⏰', 'Oke, pengingatnya sudah aku pasang ⏰', 'Beres! Nanti aku bunyikan ⏰'])) +
        '\n**' + p.judul + '**\n' + J.label(p) + '\nBerikutnya: ' + J.waktuLabel(p.berikutnya),
      sub: st === 'aktif' ? 'HP ini akan berbunyi saat waktunya tiba, walau CashKu ditutup 🔔' : 'Supaya HP berbunyi walau CashKu ditutup, ketuk **Aktifkan alarm HP**. ' + (st === 'belum' ? '' : g.Pengingat.Notif.pesanStatus()),
      chips } });
  };
  Chat.pengingatDaftar = function () {
    const J = PJ();
    const xs = (S.master.pengingat || []).filter((p) => p.id_pengguna === S.saya.id && p.status === 'AKTIF').sort((a, b) => (a.berikutnya || 0) - (b.berikutnya || 0));
    const st = g.Pengingat.Notif.status();
    const chipNotif = st === 'aktif' ? [{ label: '🔔 Tes alarm', aksi: 'notifUji', tetap: true }] : [{ label: '🔔 Aktifkan alarm HP', aksi: 'notifAktif', tetap: true }];
    if (!xs.length) return Chat.tambah({ kind: 'pilihan', data: { teks: 'Belum ada pengingat aktif ⏰', sub: 'Contoh: **ingatkan saya bayar air setiap tanggal 20 jam 9**', chips: chipNotif } });
    return Chat.tambah({ kind: 'pilihan', data: {
      teks: 'Pengingat kamu ⏰\n' + xs.map((p) => '• **' + p.judul + '** — ' + J.label(p) + (p.berikutnya ? ' (berikutnya ' + J.waktuLabel(p.berikutnya).replace(/^\w+, /, '') + ')' : '')).join('\n'),
      sub: g.Pengingat.Notif.pesanStatus(),
      chips: chipNotif.concat(xs.slice(0, 4).map((p) => ({ label: '🗑️ ' + p.judul, aksi: 'pengingatHapusYa', nilai: { id: p.id_pengingat }, gaya: 'ghost' }))) } });
  };
  Chat.pengingatHapus = function (kata) {
    const xs = (S.master.pengingat || []).filter((p) => p.id_pengguna === S.saya.id && p.status === 'AKTIF');
    const k = P.normal(kata || '').split(' ').filter((w) => w.length >= 3);
    const kataJ = (p) => P.normal(p.judul).split(/[^a-z0-9]+/).concat(P.normal(PJ().label(p)).split(/[^a-z0-9]+/)).filter(Boolean);
    const cocok = k.length ? xs.filter((p) => k.every((w) => P.normal(p.judul).indexOf(w) > -1 || kataJ(p).some((j) => P.catatan.miripKata(w, j)))) : xs;
    if (!cocok.length) return Chat.sistem(xs.length ? 'Hmm, nggak ada pengingat “' + kata + '” 🤔 Ketik **daftar pengingat** untuk melihat semuanya.' : 'Belum ada pengingat aktif 🙂');
    return Chat.tambah({ kind: 'pilihan', data: { teks: cocok.length === 1 ? 'Hapus pengingat **' + cocok[0].judul + '** (' + PJ().label(cocok[0]) + ')?' : 'Pengingat mana yang mau dihapus?',
      chips: cocok.slice(0, 5).map((p) => ({ label: cocok.length === 1 ? 'Hapus' : '🗑️ ' + p.judul, aksi: 'pengingatHapusYa', nilai: { id: p.id_pengingat }, gaya: cocok.length === 1 ? 'acc' : undefined }))
        .concat([{ label: 'Batal', aksi: 'tutup' }]) } });
  };
  Chat.pengingatUji = async function () {
    const st = g.Pengingat.Notif.status();
    if (st !== 'aktif') return Chat.tambah({ kind: 'pilihan', data: { teks: g.Pengingat.Notif.pesanStatus(), chips: st === 'belum' ? [{ label: '🔔 Aktifkan alarm HP', aksi: 'notifAktif', tetap: true }] : [] } });
    const r = await g.Pengingat.Notif.uji();
    return Chat.sistem(r.pesan);
  };

  // ---------- Obrolan ringan ----------
  Chat.obrolan = function (it) {
    const w = G.waktu();
    switch (it.jenis) {
      case 'makasih': return Chat.sistem(G.kata('mks', ['Sama-sama, {nama}! 😊', 'Siap, sama-sama! Kapan aja aku siap bantu 🙌', 'Dengan senang hati 😄']));
      case 'salam':
      case 'sapa': return Chat.tambah({ kind: 'pilihan', data: { teks: G.kata('sp', ['Selamat ' + w + ', {nama}! 👋 Ada yang mau dicatat?', 'Halo {nama}! 👋 Selamat ' + w + '. Mau catat apa ' + (w === 'malam' ? 'malam ini' : 'hari ini') + '?', 'Hai {nama}! 😊 Siap bantu. Ketik aja transaksinya ya.']), chips: G.chipsSapa() } });
      case 'siapa': return Chat.tambah({ kind: 'bantuan', data: { teks: 'Aku CashKu 🤖, asisten keuangan ' + S.namaKeluarga() + '. Tinggal ketik kayak ngobrol — aku yang catat, hitung, dan ingetin anggaran. Makin sering dipakai, aku makin pintar. Coba deh:' } });
      case 'kabar': return Chat.sistem(G.kata('kbr', ['Baik dong! 😄 Siap bantu catat keuangan. Ada pengeluaran hari ini?', 'Baik banget! {nama} gimana? Ada yang mau dicatat? 😊']));
      case 'puji': return Chat.sistem(G.kata('pj', ['Hehe makasih! 😄 Makin sering dipakai, aku makin pintar lho.', 'Aww, makasih! 🙈 Aku juga belajar dari catatan {nama}.']));
      default: return Chat.sistem(G.kata('ok', ['👍', 'Sip! 👌', 'Oke! 😊', 'Siap 🙌']));
    }
  };

  Chat.lanjutKlar = async function () {
    const k = Chat.antreKlar.shift();
    if (!k) return;
    const d = k.d;
    if (k.type === 'harga') {
      await Chat.tambah({ kind: 'pilihan', data: { teks: 'Berapa harga ' + (d.keterangan || 'itu').toLowerCase() + 'nya?', sub: 'Ketik nominalnya saja, contoh: **25rb**' } });
      Chat.pending = { type: 'harga', jawab: async (n) => { d.nominal = n; d.tanpaNominal = false; d.nominalRagu = false; return Chat.selesaikanDraft(d, k); } };
      return;
    }
    if (k.type === 'nominal') {
      const besar = d.nominal * 1000;
      await Chat.tambah({ kind: 'pilihan', data: { teks: d.keterangan + ': maksudnya ' + U.rp(besar) + ' atau ' + U.rp(d.nominal) + '?', draft: d, batch: k.batch, teksAsli: k.teksAsli,
        chips: [{ label: U.rp(besar), aksi: 'nominal', nilai: { n: besar }, gaya: 'acc' }, { label: U.rp(d.nominal), aksi: 'nominal', nilai: { n: d.nominal } }] } });
      Chat.pending = { type: 'nominal', jawab: async (n) => { d.nominal = n; d.nominalRagu = false; return Chat.selesaikanDraft(d, k); } };
      return;
    }
    if (k.type === 'dompet') {
      const sisi = !d.id_dompet_tujuan || d.id_dompet_tujuan === d.id_dompet ? 'tujuan' : 'sumber';
      const lain = sisi === 'tujuan' ? d.id_dompet : d.id_dompet_tujuan;
      const saldo = Object.fromEntries(S.saldoDompet().map((x) => [x.dompet.id_dompet, x.saldo]));
      let opsi = S.dompetAktif().filter((x) => x.id_dompet !== lain);
      let kosong = false;
      if (sisi === 'sumber') {
        // Uang hanya bisa dipindah dari dompet yang ada saldonya; Tabungan hanya bila disebut
        const bisa = opsi.filter((x) => x.tipe !== 'TABUNGAN' && (saldo[x.id_dompet] || 0) > 0);
        if (bisa.length === 1) {
          d.id_dompet = bisa[0].id_dompet; d.dompetRagu = false;
          await Chat.simpanDrafts([d], k.teksAsli, k.batch);
          return Chat.lanjutKlar();
        }
        if (bisa.length) opsi = bisa; else { opsi = opsi.filter((x) => x.tipe !== 'TABUNGAN'); kosong = true; }
        opsi.sort((a, b) => (saldo[b.id_dompet] || 0) - (saldo[a.id_dompet] || 0));
      }
      const ket = d.keterangan && !/^pindah saldo$/i.test(d.keterangan) ? d.keterangan : 'Pindah saldo';
      const keNama = sisi === 'sumber' && d.id_dompet_tujuan ? ' ke **' + S.namaDompet(d.id_dompet_tujuan) + '**' : '';
      const m = await Chat.tambah({ kind: 'pilihan', data: {
        teks: ket + ' ' + U.rp(d.nominal) + keNama + (sisi === 'tujuan' ? ' — ke dompet mana?' : ' — uangnya dari mana?'),
        sub: kosong ? 'Semua dompet saldonya Rp0 di CashKu. Catat saldonya dulu, misalnya **saldo tunai sekarang 500rb**.' : 'Atau ketik, misalnya: **tunai**, **rek**, **gopay**',
        draft: d, batch: k.batch, teksAsli: k.teksAsli,
        chips: opsi.map((x) => ({ label: (x.ikon || '') + ' ' + x.nama + (sisi === 'sumber' ? ' \u00b7 ' + (saldo[x.id_dompet] < 0 ? '\u2212' : '') + U.rp(saldo[x.id_dompet] || 0) : ''), aksi: 'dompet', nilai: { sisi, id: x.id_dompet } })) } });
      Chat.pending = { type: 'dompetPindah', pilihan: opsi.map((x) => x.id_dompet), jawabDompet: async (id) => {
        const i = m.data.chips.findIndex((c) => c.nilai.id === id);
        return Chat.aksi(m, m.data.chips[i] || { aksi: 'dompet', nilai: { sisi, id } }, i);
      } };
      return null;
    }
    if (k.type === 'jenisMasuk') {
      // "masuk rekening 2jt": pemasukan baru, atau pindahan dari dompet lain?
      const saldo = Object.fromEntries(S.saldoDompet().map((x) => [x.dompet.id_dompet, x.saldo]));
      const asal = S.dompetAktif().filter((x) => x.id_dompet !== d.id_dompet && x.tipe !== 'TABUNGAN' && (saldo[x.id_dompet] || 0) > 0)
        .sort((a, b) => (saldo[b.id_dompet] || 0) - (saldo[a.id_dompet] || 0));
      if (!asal.length) { d.tanyaJenis = false; return Chat.selesaikanDraft(Chat.jadiPemasukan(d), k); }
      const m = await Chat.tambah({ kind: 'pilihan', data: {
        teks: U.rp(d.nominal) + ' masuk ke **' + S.namaDompet(d.id_dompet) + '**. Ini pemasukan baru, atau pindahan dari dompet lain?',
        sub: 'Pindahan antar dompet tidak dihitung sebagai pemasukan.', draft: d, batch: k.batch, teksAsli: k.teksAsli,
        chips: [{ label: '\ud83d\udcb0 Pemasukan', aksi: 'jenisMasuk', nilai: { masuk: true }, gaya: 'acc' }]
          .concat(asal.map((x) => ({ label: '\ud83d\udd04 Dari ' + x.nama + ' \u00b7 ' + U.rp(saldo[x.id_dompet] || 0), aksi: 'jenisMasuk', nilai: { dari: x.id_dompet } })))
      } });
      Chat.pending = { type: 'jenisMasuk', pilihan: asal.map((x) => x.id_dompet),
        jawabMasuk: () => Chat.aksi(m, m.data.chips[0], 0),
        jawabDompet: async (id) => { const i = m.data.chips.findIndex((c) => c.nilai.dari === id); return Chat.aksi(m, m.data.chips[i] || { aksi: 'jenisMasuk', nilai: { dari: id } }, i); } };
      return null;
    }
    if (k.type === 'dompetBayar') {
      const ds = k.ds, masuk = ds.every((x) => x.jenis === 'MASUK');
      const saldo = Object.fromEntries(S.saldoDompet().map((x) => [x.dompet.id_dompet, x.saldo]));
      // Tabungan tidak ditawarkan untuk membayar, kecuali memang disebut (masuk daftar pilihan)
      const semuaOpsi = S.dompetAktif().filter((x) => (!k.pilihan ? x.tipe !== 'TABUNGAN' : k.pilihan.indexOf(x.id_dompet) > -1));
      // Membayar hanya bisa dari dompet yang ada saldonya (uang masuk boleh ke dompet mana pun)
      let opsi = masuk ? semuaOpsi : semuaOpsi.filter((x) => (saldo[x.id_dompet] || 0) > 0);
      const kosongSemua = !masuk && !opsi.length;
      if (kosongSemua) opsi = semuaOpsi;                              // tak ada yang bersaldo → tetap bisa dicatat, sambil diingatkan
      opsi.sort((a, b) => (saldo[b.id_dompet] || 0) - (saldo[a.id_dompet] || 0));
      if (!masuk && !kosongSemua && opsi.length === 1) {
        // Hanya satu dompet yang ada saldonya → pasti dibayar dari situ, tidak perlu bertanya
        ds.forEach((x) => { x.id_dompet = opsi[0].id_dompet; x.tanyaDompet = false; x.dompetPilihan = null; });
        await Chat.simpanDrafts(ds, k.teksAsli, k.batch);
        return Chat.lanjutKlar();
      }
      const total = ds.reduce((a, x) => a + x.nominal, 0);
      const apa = ds.length > 1 ? ds.length + ' transaksi (' + U.rp(total) + ')' : ds[0].keterangan + ' ' + U.rp(total);
      const contoh = opsi.slice(0, 3).map((x) => '**' + (x.tipe === 'TUNAI' ? 'tunai' : x.tipe === 'REKENING' ? 'rek' : (String(x.alias || '').split(',').map((a) => a.trim()).find((a) => /^(gopay|ovo|dana|shopeepay)$/.test(a)) || 'e-wallet')) + '**');
      const m = await Chat.tambah({ kind: 'pilihan', data: {
        teks: apa + (masuk ? ' masuk ke mana?' : ' dibayar pakai apa?'),
        sub: kosongSemua ? 'Semua dompet saldonya Rp0 di CashKu. Catat saldonya dulu, misalnya **saldo tunai sekarang 500rb**.' : 'Atau ketik, misalnya: ' + contoh.join(', '),
        drafts: ds, batch: k.batch, teksAsli: k.teksAsli,
        chips: opsi.map((x) => ({ label: (x.ikon || '') + ' ' + x.nama + ' \u00b7 ' + (saldo[x.id_dompet] < 0 ? '\u2212' : '') + U.rp(saldo[x.id_dompet] || 0), aksi: 'dompetBayar', nilai: { id: x.id_dompet } }))
      } });
      Chat.pending = { type: 'dompetBayar', pilihan: opsi.map((x) => x.id_dompet), jawabDompet: async (id) => {
        const i = m.data.chips.findIndex((c) => c.nilai.id === id);
        return Chat.aksi(m, m.data.chips[i] || { aksi: 'dompetBayar', nilai: { id } }, i);
      } };
      return null;
    }
    if (k.type === 'saldoDompet') {
      const it = k.it;
      const saldo = Object.fromEntries(S.saldoDompet().map((x) => [x.dompet.id_dompet, x.saldo]));
      const opsi = S.dompetAktif().filter((x) => !it.pilihan || it.pilihan.indexOf(x.id_dompet) > -1);
      const m = await Chat.tambah({ kind: 'pilihan', data: {
        teks: 'Saldo ' + U.rp(it.nominal) + ' ini untuk dompet mana?', sub: 'Saldo di aplikasi akan disesuaikan menjadi ' + U.rp(it.nominal) + '.',
        it, batch: k.batch, teksAsli: k.teksAsli,
        chips: opsi.map((x) => ({ label: (x.ikon || '') + ' ' + x.nama + ' \u00b7 ' + (saldo[x.id_dompet] < 0 ? '\u2212' : '') + U.rp(saldo[x.id_dompet] || 0), aksi: 'saldoDompet', nilai: { id: x.id_dompet } }))
      } });
      Chat.pending = { type: 'saldoDompet', pilihan: opsi.map((x) => x.id_dompet), jawabDompet: async (id) => {
        const i = m.data.chips.findIndex((c) => c.nilai.id === id);
        return Chat.aksi(m, m.data.chips[i] || { aksi: 'saldoDompet', nilai: { id } }, i);
      } };
      return null;
    }
    return null;
  };

  /** Draft yang dompetnya belum jelas: default "Tanya dulu" atau nama yang dipakai lebih dari satu dompet */
  /** Uang masuk dijadikan pemasukan (kategori ditanyakan bila belum jelas) */
  Chat.jadiPemasukan = function (d) {
    d.jenis = 'MASUK'; d.tanyaJenis = false;
    if (!d.keterangan || /^(masuk|uang|pemasukan lain|transaksi|transfer masuk|uang masuk)$/i.test(d.keterangan)) d.keterangan = 'Uang masuk';
    if (!d.kategoriDikenal) { d.id_kategori = S.kategoriDefault('MASUK'); d.frasaBelajar = 'uang masuk'; }
    return d;
  };
  Chat.perluDompet = (d) => d.jenis !== 'PINDAH' && S.fiturDompet() && !d.id_dompet && (d.tanyaDompet || (d.dompetPilihan && d.dompetPilihan.length > 1));
  Chat.selesaikanDraft = async function (d, k) {
    if (d.tanyaJenis) { Chat.antreKlar.unshift({ type: 'jenisMasuk', d, batch: k.batch, teksAsli: k.teksAsli }); return Chat.lanjutKlar(); }
    if (Chat.perluDompet(d)) Chat.antreKlar.unshift({ type: 'dompetBayar', ds: [d], pilihan: d.dompetPilihan || null, batch: k.batch, teksAsli: k.teksAsli });
    else await Chat.simpanDrafts([d], k.teksAsli, k.batch);
    return Chat.lanjutKlar();
  };

  // ---------- Penyesuaian saldo ("saldo bank sekarang 5jt") ----------
  Chat.setSaldo = async function (items, teksAsli) {
    if (!S.fiturDompet()) return Chat.sistem('Fitur dompet sedang dinonaktifkan Admin, jadi saldo per dompet tidak dicatat.');
    const batch = batchBaru();
    const um = Chat.cari(Chat._ref);
    if (um && um.from === 'me') { um.data.batch = batch; g.DB.put('chat', um); }
    const klar = [];
    for (const it of items) {
      if (it.id_dompet) await Chat.terapkanSaldo(it.id_dompet, it.nominal, teksAsli, batch);
      else klar.push({ type: 'saldoDompet', it, batch, teksAsli });
    }
    Chat.antreKlar = klar;
    return Chat.lanjutKlar();
  };
  Chat.terapkanSaldo = async function (id, target, teksAsli, batch) {
    const d = S.dompet(id);
    if (!d) return Chat.sistem('Dompet tidak ditemukan.');
    const cur = (S.saldoDompet().find((x) => x.dompet.id_dompet === id) || { saldo: 0 }).saldo;
    const selisih = target - cur;
    if (!selisih) return Chat.sistem('Saldo **' + d.nama + '** memang sudah ' + U.rp(target) + ', jadi nggak ada yang aku ubah 👌');
    const t = await S.simpanTx({ jenis: 'SALDO', nominal: selisih, keterangan: 'Saldo jadi ' + U.rp(target), id_dompet: id, tanggal_transaksi: U.hariIni(), teks_asli: teksAsli, id_batch: batch, sumber: 'CHAT' });
    return Chat.tambah({ kind: 'tx', data: { ids: [t.id_transaksi], saldo: { dari: cur, ke: target, dompet: d.nama }, salam: G.kata('sld', ['Oke, saldo **' + d.nama + '** sudah aku sesuaikan 👍', 'Siap, saldo **' + d.nama + '** aku perbarui ✅']) } });
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
    if (!target.length) return Chat.sistem(kata ? 'Hmm, nggak ada transaksi “' + kata + '” milikmu yang bisa dibatalkan 🤔' : 'Belum ada transaksi milikmu yang bisa dibatalkan 🙂');
    return Chat.tambah({ kind: 'ringkasan', data: {
      judul: target.length > 1 ? 'Batalkan pesan terakhir?' : 'Batalkan transaksi ini?',
      baris: target.map((t) => ({ l: S.ikonTx(t) + ' ' + S.judulTx(t) + (t.jenis === 'PINDAH' ? ' ' + S.namaDompet(t.id_dompet) + ' → ' + S.namaDompet(t.id_dompet_tujuan) : t.jenis === 'SALDO' ? ' ' + S.namaDompet(t.id_dompet) : ''), v: U.rpTanda(t.nominal, t.jenis), kelas: S.kelasJenis(t.jenis) })),
      chips: [{ label: 'Ya, batalkan', aksi: 'batalYa', nilai: { ids: target.map((t) => t.id_transaksi) }, gaya: 'danger' }, { label: 'Tidak', aksi: 'tutup' }]
    } });
  };

  // ---------- Pertanyaan ----------
  function catatanKoreksi(it) { return it.perubahan && it.perubahan.length ? 'Aku baca: “' + it.teksKoreksi + '”' : ''; }
  // ---------- Terbesar / terkecil ----------
  const selisihHari = (a, b) => Math.round((U.parseTgl(b) - U.parseTgl(a)) / 86400000);
  const tglSingkat = (a, b) => (a === b ? U.tglPendek(a) : U.tglPendek(a) + '–' + U.tglPendek(b)) + ' ' + b.slice(0, 4);
  Chat.jawabEkstrem = function (it, per, orang, namaOrang, kor) {
    const jenis = it.jenis || 'KELUAR', kata = jenis === 'MASUK' ? 'Pemasukan' : 'Pengeluaran', besar = it.arah !== 'kecil';
    let list = S.txTerlihat({ mulai: per.mulai, sampai: per.sampai, orang, jenis });
    if (it.kategori) list = list.filter((t) => t.id_kategori === it.kategori);
    const namaKat = it.kategori ? ' ' + S.kat(it.kategori).nama.toLowerCase() : '';
    const urut = (a, b) => (besar ? b - a : a - b);
    const total = list.reduce((a, t) => a + t.nominal, 0);
    const kosong = (judul) => Chat.tambah({ kind: 'ringkasan', data: { judul, catatan: 'Belum ada ' + kata.toLowerCase() + namaKat + ' ' + per.label.toLowerCase() + '. ' + kor } });
    const satuHari = per.mulai === per.sampai;
    const siapa = (t) => (S.lihatSemua() && t.id_pengguna !== S.saya.id ? ' · ' + S.orang(t.id_pengguna).nama : '');

    if (it.kelompok === 'kategori') {
      const g2 = {};
      list.forEach((t) => { g2[t.id_kategori] = (g2[t.id_kategori] || 0) + t.nominal; });
      const ids = Object.keys(g2).sort((a, b) => urut(g2[a], g2[b]));
      const judul = (besar ? '🏆 Kategori ' : '🔻 Kategori ') + kata.toLowerCase() + (besar ? ' terbesar' : ' terkecil') + ' · ' + per.label + namaOrang;
      if (!ids.length) return kosong(judul);
      const k0 = S.kat(ids[0]);
      return Chat.tambah({ kind: 'ringkasan', data: { judul, total: U.rp(g2[ids[0]]), kelasTotal: jenis === 'MASUK' ? 't-in' : 't-out',
        caption: '**' + k0.ikon + ' ' + k0.nama + '** · ' + U.persen(g2[ids[0]], total) + '% dari total ' + U.rp(total),
        baris: ids.slice(1, 6).map((id) => { const k = S.kat(id); return { l: k.ikon + ' ' + k.nama + ' · ' + U.persen(g2[id], total) + '%', v: U.rp(g2[id]) }; }),
        catatan: kor } });
    }
    if (it.kelompok === 'hari') {
      const g2 = {}, n = {};
      list.forEach((t) => { g2[t.tanggal_transaksi] = (g2[t.tanggal_transaksi] || 0) + t.nominal; n[t.tanggal_transaksi] = (n[t.tanggal_transaksi] || 0) + 1; });
      const hari = Object.keys(g2).sort((a, b) => urut(g2[a], g2[b]) || a.localeCompare(b));
      const judul = (besar ? '📅 Hari paling boros · ' : '📅 Hari paling hemat · ') + per.label + namaOrang;
      if (!hari.length) return kosong(judul);
      const lbl = (d) => U.HARI[U.parseTgl(d).getDay()] + ', ' + U.tglPendek(d);
      return Chat.tambah({ kind: 'ringkasan', data: { judul, total: U.rp(g2[hari[0]]), kelasTotal: 't-out',
        caption: '**' + lbl(hari[0]) + '** · ' + n[hari[0]] + ' transaksi',
        baris: hari.slice(1, 6).map((d) => ({ l: lbl(d) + ' · ' + n[d] + ' transaksi', v: U.rp(g2[d]) })),
        catatan: (besar ? '' : 'Hanya menghitung hari yang ada ' + kata.toLowerCase() + 'nya. ') + kor } });
    }
    if (it.kelompok === 'orang') {
      if (!S.lihatSemua()) return Chat.sistem('Kamu hanya bisa melihat data milikmu sendiri, jadi tidak bisa membandingkan antar anggota.');
      const g2 = {};
      list.forEach((t) => { g2[t.id_pengguna] = (g2[t.id_pengguna] || 0) + t.nominal; });
      const ids = Object.keys(g2).sort((a, b) => urut(g2[a], g2[b]));
      const judul = '👥 ' + kata + namaKat + ' per anggota · ' + per.label;
      if (!ids.length) return kosong(judul);
      return Chat.tambah({ kind: 'ringkasan', data: { judul, total: U.rp(g2[ids[0]]), kelasTotal: jenis === 'MASUK' ? 't-in' : 't-out',
        caption: '**' + S.orang(ids[0]).nama + '** paling ' + (besar ? 'banyak' : 'sedikit') + ' · ' + U.persen(g2[ids[0]], total) + '% dari total ' + U.rp(total),
        baris: ids.slice(1, 6).map((id) => ({ l: S.orang(id).nama + ' · ' + U.persen(g2[id], total) + '%', v: U.rp(g2[id]) })),
        catatan: kor } });
    }
    // Per transaksi
    const top = list.slice().sort((a, b) => urut(a.nominal, b.nominal) || String(b.waktu_catat).localeCompare(String(a.waktu_catat))).slice(0, 5);
    const judul = (besar ? '🔝 ' : '🔻 ') + kata + namaKat + (besar ? ' terbesar' : ' terkecil') + ' · ' + per.label + namaOrang;
    if (!top.length) return kosong(judul);
    const meta = (t) => (satuHari ? '' : ' · ' + U.tglPendek(t.tanggal_transaksi)) + siapa(t);
    const t0 = top[0];
    return Chat.tambah({ kind: 'ringkasan', data: { judul, total: U.rp(t0.nominal), kelasTotal: jenis === 'MASUK' ? 't-in' : 't-out',
      caption: '**' + S.ikonTx(t0) + ' ' + S.judulTx(t0) + '** · ' + S.kat(t0.id_kategori).nama + (S.fiturDompet() && t0.id_dompet ? ' · ' + S.namaDompet(t0.id_dompet) : '') + meta(t0),
      baris: top.slice(1).map((t) => ({ l: S.ikonTx(t) + ' ' + S.judulTx(t) + meta(t), v: U.rp(t.nominal) })),
      catatan: 'Dari ' + list.length + ' transaksi, total ' + U.rp(total) + '. ' + kor } });
  };

  // ---------- Rata-rata per hari / minggu / bulan / tahun ----------
  const HARI_PER = { hari: 1, minggu: 7, bulan: 30.4375, tahun: 365.25 };
  Chat.jawabRata = function (it, orang, namaOrang, kor) {
    const jenis = it.jenis || 'KELUAR', kata = jenis === 'MASUK' ? 'pemasukan' : 'pengeluaran', sat = it.satuan || 'hari';
    const hi = U.hariIni();
    const semua = S.txTerlihat({ orang });
    const awalData = semua.reduce((a, t) => (!a || t.tanggal_transaksi < a ? t.tanggal_transaksi : a), '');
    let list = semua.filter((t) => t.jenis === jenis);
    if (it.kategori) list = list.filter((t) => t.id_kategori === it.kategori);
    const namaKat = it.kategori ? ' ' + S.kat(it.kategori).nama.toLowerCase() : '';
    const judul = '📈 Rata-rata ' + kata + namaKat + ' per ' + sat + namaOrang;
    let mulai, sampai;
    if (it.periode) { mulai = it.periode.mulai; sampai = it.periode.sampai < hi ? it.periode.sampai : hi; }
    else {
      sampai = hi;
      mulai = sat === 'hari' ? U.tambahHari(hi, -29) : sat === 'minggu' ? U.tambahHari(hi, -83) : sat === 'bulan' ? U.tambahBulan(U.awalBulan(hi), -11) : awalData || hi;
    }
    if (awalData && mulai < awalData) mulai = awalData;            // jangan hitung hari sebelum mulai mencatat
    if (!awalData || mulai > sampai) return Chat.tambah({ kind: 'ringkasan', data: { judul, catatan: 'Belum ada ' + kata + ' yang tercatat' + (it.periode ? ' ' + it.periode.label.toLowerCase() : '') + '. ' + kor } });
    const dlm = list.filter((t) => t.tanggal_transaksi >= mulai && t.tanggal_transaksi <= sampai);
    const total = dlm.reduce((a, t) => a + t.nominal, 0);
    const nHari = selisihHari(mulai, sampai) + 1;
    const perHari = total / nHari;
    const bulat = (x, k) => Math.round(x / k) * k;
    const rata = bulat(perHari * HARI_PER[sat], 100);
    // Pembanding: berjalan saat ini & perkiraan satuan lain
    const kini = { hari: [hi, 'Hari ini'], minggu: [U.awalMinggu(hi), 'Minggu ini (s.d. hari ini)'], bulan: [U.awalBulan(hi), 'Bulan ini (s.d. hari ini)'], tahun: [hi.slice(0, 4) + '-01-01', 'Tahun ini (s.d. hari ini)'] }[sat];
    const jmlKini = list.filter((t) => t.tanggal_transaksi >= kini[0] && t.tanggal_transaksi <= hi).reduce((a, t) => a + t.nominal, 0);
    const banding = nHari > 1 && rata > 0 ? (jmlKini > rata * 1.05 ? 1 : jmlKini < rata * 0.95 ? -1 : 0) : null;
    const baris = [{ l: kini[1], v: U.rp(jmlKini), kelas: jenis === 'KELUAR' && sat === 'hari' && banding === 1 ? 't-out' : '' }];
    ['hari', 'minggu', 'bulan', 'tahun'].filter((x) => x !== sat).forEach((x) => baris.push({ l: '≈ per ' + x, v: U.rp(bulat(perHari * HARI_PER[x], x === 'hari' ? 100 : 1000)) }));
    const perkiraan = nHari < HARI_PER[sat];
    return Chat.tambah({ kind: 'ringkasan', data: { judul, total: U.rp(rata), kelasTotal: jenis === 'MASUK' ? 't-in' : 't-out',
      caption: 'Dihitung dari **' + nHari + ' hari** (' + tglSingkat(mulai, sampai) + '), total ' + U.rp(total) + ' · ' + dlm.length + ' transaksi.',
      baris,
      catatan: (perkiraan ? 'Data baru ' + nHari + ' hari, jadi angka per ' + sat + ' masih perkiraan. ' : '') +
        (sat === 'hari' && jenis === 'KELUAR' && banding !== null ? ['Hari ini masih di bawah rata-rata. ', 'Hari ini sekitar rata-rata. ', 'Hari ini di atas rata-rata. '][banding + 1] : '') +
        (!perkiraan && nHari < 365 ? 'Angka ≈ per ' + (nHari < 30 ? 'bulan/tahun' : 'tahun') + ' masih perkiraan. ' : '') +
        (nHari <= 3 ? 'Makin banyak hari tercatat, makin akurat rata-ratanya. ' : '') + kor } });
  };

  // ---------- Riwayat: kata, pindah saldo, terakhir kali ----------
  const cocokKata = (t, kata) => (' ' + P.normal((t.keterangan || '') + ' ' + (t.teks_asli || '')) + ' ').indexOf(' ' + kata + ' ') > -1;
  Chat.gerakDompet = function (id, n) {
    return S.txTerlihat({}).filter((t) => t.id_dompet === id || t.id_dompet_tujuan === id)
      .sort((a, b) => (b.tanggal_transaksi + b.waktu_catat).localeCompare(a.tanggal_transaksi + a.waktu_catat)).slice(0, n)
      .map((t) => {
        const masuk = t.jenis === 'MASUK' || (t.jenis === 'PINDAH' && t.id_dompet_tujuan === id) || (t.jenis === 'SALDO' && t.nominal > 0);
        return { l: U.tglPendek(t.tanggal_transaksi) + ' · ' + S.judulTx(t), v: (masuk ? '+' : '\u2212') + U.rp(t.nominal), kelas: masuk ? 't-in' : 't-out' };
      });
  };
  const PINDAH_Q = {
    nabung: { judul: '🐷 Nabung', f: (t, tp) => tp(t.id_dompet_tujuan) === 'TABUNGAN' || /\bnabung\b/i.test(t.keterangan || '') },
    ambiltab: { judul: '🐷 Ambil tabungan', f: (t, tp) => tp(t.id_dompet) === 'TABUNGAN' },
    topup: { judul: '📱 Top up', f: (t, tp) => tp(t.id_dompet_tujuan) === 'EWALLET' },
    tarik: { judul: '🏧 Tarik tunai', f: (t, tp) => tp(t.id_dompet_tujuan) === 'TUNAI' && tp(t.id_dompet) === 'REKENING' },
    setor: { judul: '🏦 Setor tunai', f: (t, tp) => tp(t.id_dompet) === 'TUNAI' && tp(t.id_dompet_tujuan) === 'REKENING' },
    semua: { judul: '🔄 Pindah saldo', f: () => true }
  };
  Chat.jawabPindah = function (it, per, orang, namaOrang, kor) {
    const def = PINDAH_Q[it.pindah] || PINDAH_Q.semua;
    const tp = (id) => (S.dompet(id) || {}).tipe;
    const list = S.txTerlihat({ mulai: per.mulai, sampai: per.sampai, orang, jenis: 'PINDAH' }).filter((t) => def.f(t, tp))
      .sort((a, b) => (b.tanggal_transaksi + b.waktu_catat).localeCompare(a.tanggal_transaksi + a.waktu_catat));
    const total = list.reduce((a, t) => a + t.nominal, 0);
    const judul = def.judul + ' · ' + per.label + namaOrang;
    if (!list.length) return Chat.tambah({ kind: 'ringkasan', data: { judul, total: U.rp(0), catatan: 'Belum ada catatan ' + def.judul.slice(3).toLowerCase() + ' ' + per.label.toLowerCase() + '. ' + kor } });
    let caption = '**' + list.length + ' kali**';
    if (it.pindah === 'nabung' || it.pindah === 'ambiltab') {
      const tab = S.saldoDompet().filter((x) => x.dompet.tipe === 'TABUNGAN').reduce((a, x) => a + x.saldo, 0);
      caption += ' · saldo Tabungan sekarang **' + U.rp(tab) + '**';
    }
    return Chat.tambah({ kind: 'ringkasan', data: { judul, total: U.rp(total), kelasTotal: 't-tr', caption,
      baris: list.slice(0, 5).map((t) => ({ l: U.tglPendek(t.tanggal_transaksi) + ' · ' + S.namaDompet(t.id_dompet) + ' → ' + S.namaDompet(t.id_dompet_tujuan), v: U.rp(t.nominal) })),
      catatan: (list.length > 5 ? '…dan ' + (list.length - 5) + ' lainnya. ' : '') + kor } });
  };
  Chat.jawabTerakhir = function (it, orang, namaOrang, kor) {
    const k = S.kat(it.kategori);
    let list = S.txTerlihat({ orang }).filter((t) => t.jenis !== 'PINDAH' && t.jenis !== 'SALDO' && t.id_kategori === it.kategori);
    const spes = list.filter((t) => cocokKata(t, it.kata));
    if (spes.length) list = spes;
    list.sort((a, b) => (b.tanggal_transaksi + b.waktu_catat).localeCompare(a.tanggal_transaksi + a.waktu_catat));
    const judul = '🕒 Terakhir ' + it.kata + namaOrang;
    if (!list.length) return Chat.tambah({ kind: 'ringkasan', data: { judul, catatan: 'Belum ada catatan “' + it.kata + '”. ' + kor } });
    const t0 = list[0], hr = Math.round((U.parseTgl(U.hariIni()) - U.parseTgl(t0.tanggal_transaksi)) / 86400000);
    return Chat.tambah({ kind: 'ringkasan', data: { judul, total: U.labelHari(t0.tanggal_transaksi).replace(/ · .*$/, '') === 'Hari ini' ? 'Hari ini' : U.tglPanjang(t0.tanggal_transaksi),
      caption: (hr === 0 ? 'hari ini' : hr === 1 ? 'kemarin' : hr + ' hari lalu') + ' · **' + t0.keterangan + ' ' + U.rp(t0.nominal) + '**' + (S.lihatSemua() && t0.id_pengguna !== S.saya.id ? ' · ' + S.orang(t0.id_pengguna).nama : '') + (S.fiturDompet() && t0.id_dompet ? ' · ' + S.namaDompet(t0.id_dompet) : ''),
      baris: list.slice(1, 4).map((t) => ({ l: 'Sebelumnya · ' + U.tglPendek(t.tanggal_transaksi), v: U.rp(t.nominal) })),
      catatan: kor } });
  };

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
    let kor = catatanKoreksi(it);
    if ((it.metric === 'rincian' || it.metric === 'kemana' || it.metric === 'sering') && g.Rincian) return g.Rincian.jawab(it, kor);

    if (it.metric === 'saldo') {
      if (!S.fiturDompet()) return Chat.sistem('Fitur dompet sedang dinonaktifkan Admin, jadi saldo per dompet tidak dihitung.');
      let s = S.saldoDompet();
      if (it.dompet) s = s.filter((x) => x.dompet.id_dompet === it.dompet);
      if (!s.length) return Chat.sistem('Belum ada dompet yang bisa kamu lihat saldonya.');
      const total = s.reduce((a, x) => a + x.saldo, 0);
      return Chat.tambah({ kind: 'ringkasan', data: { judul: it.dompet ? 'Saldo ' + s[0].dompet.nama : '💳 Saldo semua dompet', total: (total < 0 ? '−' : '') + U.rp(total), kelasTotal: total < 0 ? 't-out' : '',
        caption: it.dompet ? 'Per ' + U.tglPanjang(U.hariIni()) + (it.dompet && s[0].dompet.tipe === 'TABUNGAN' ? ' · uang yang disisihkan' : '') : undefined,
        baris: it.dompet ? Chat.gerakDompet(it.dompet, 3) : s.map((x) => ({ l: (x.dompet.ikon || '') + ' ' + x.dompet.nama, v: (x.saldo < 0 ? '−' : '') + U.rp(x.saldo), kelas: x.saldo < 0 ? 't-out' : '' })),
        catatan: (g.Sync.status !== 'ok' ? 'Data per ' + U.relatif(S.meta.lastSync) + '. ' : '') + kor } });
    }
    if (it.metric === 'harga') return Chat.jawabHarga(it, kor);
    if (it.metric === 'pindah') return Chat.jawabPindah(it, per, orang, namaOrang, kor);
    if (it.metric === 'terakhir') return Chat.jawabTerakhir(it, orang, namaOrang, kor);
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
    if (it.metric === 'ekstrem') return Chat.jawabEkstrem(it, per, orang, namaOrang, kor);
    if (it.metric === 'rata') return Chat.jawabRata(it, orang, namaOrang, kor);
    const r = S.ringkasan(f);
    if (it.metric === 'kategori' && it.kata) {
      // kata spesifik ("listrik", "kopi", "bensin"): hanya transaksi yang menyebut kata itu
      const k = S.kat(it.kategori);
      const semuaKat = r.list.filter((t) => t.id_kategori === it.kategori);
      const cocok = semuaKat.filter((t) => cocokKata(t, it.kata));
      if (cocok.length) {
        const total = cocok.reduce((a, t) => a + t.nominal, 0);
        const urut = cocok.slice().sort((a, b) => (b.tanggal_transaksi + b.waktu_catat).localeCompare(a.tanggal_transaksi + a.waktu_catat));
        return Chat.tambah({ kind: 'ringkasan', data: { judul: k.ikon + ' ' + U.huruf1(it.kata) + ' · ' + per.label + namaOrang, total: U.rp(total), kelasTotal: k.jenis === 'MASUK' ? 't-in' : 't-out',
          caption: '**' + cocok.length + ' kali**' + (cocok.length > 1 ? ' · rata-rata ' + U.rp(Math.round(total / cocok.length)) : '') + ' · kategori ' + k.nama,
          baris: urut.slice(0, 5).map((t) => ({ l: U.tglPendek(t.tanggal_transaksi) + ' · ' + t.keterangan + (S.lihatSemua() && t.id_pengguna !== S.saya.id ? ' · ' + S.orang(t.id_pengguna).nama : ''), v: U.rp(t.nominal) })),
          catatan: (urut.length > 5 ? '…dan ' + (urut.length - 5) + ' lainnya. ' : '') + kor } });
      }
      if (!semuaKat.length) return Chat.tambah({ kind: 'ringkasan', data: { judul: k.ikon + ' ' + U.huruf1(it.kata) + ' · ' + per.label + namaOrang, catatan: 'Tidak ada catatan “' + it.kata + '” ' + per.label.toLowerCase() + '. ' + kor } });
      kor += 'Tidak ada catatan “' + it.kata + '”, jadi ini total kategori ' + k.nama + '. ';
    }
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
        baris: list.slice(0, 10).map((t) => ({ l: (S.ikonTx(t) + ' ' + S.judulTx(t)) + (S.lihatSemua() && t.id_pengguna !== S.saya.id ? ' · ' + S.orang(t.id_pengguna).nama : ''), v: U.rpTanda(t.nominal, t.jenis), kelas: S.kelasJenis(t.jenis) })),
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
    return Chat.tambah({ kind: 'bantuan', data: { teks: 'Halo ' + S.saya.nama + '! 👋 Aku CashKu, asisten keuangan ' + S.namaKeluarga() + '. Cukup ketik kayak lagi ngobrol, misalnya:' } });
  };

  g.Chat = Chat;
})(window);
