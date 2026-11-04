/* CashKu — Pengaturan, Kategori, Kamus, Anggaran, Dompet, Akun Saya, Kelola Anggota */
(function (g) {
  'use strict';
  const S = g.S, U = g.U, UI = g.UI, ic = g.ic;
  const SWATCH = ['#25D366', '#0EA5E9', '#6366F1', '#E11D48', '#F59E0B', '#0F766E'];
  const PERAN = { ADMIN: ['Admin', 'b-green'], DEWASA: ['Dewasa', 'b-blue'], ANAK: ['Anak', 'b-amber'] };

  const labelDefault = (id) => (id === 'TANYA' ? 'Tanya dulu' : S.namaDompet(id));
  const opsiDefault = (pilih) => '<option value="TANYA"' + (pilih === 'TANYA' ? ' selected' : '') + '>\u2753 Tanya dulu setiap transaksi</option>' +
    S.dompetAktif().filter((d) => d.tipe !== 'TABUNGAN').map((d) => '<option value="' + U.esc(d.id_dompet) + '"' + (d.id_dompet === pilih ? ' selected' : '') + '>' + U.esc(d.ikon || '') + ' ' + U.esc(d.nama) + '</option>').join('');

  async function panggilOnline(action, data, btn) {
    if (!UI.perluOnline()) return null;
    if (btn) UI.tombolSibuk(btn, true);
    try {
      const res = await g.API.api(action, data);
      if (!res.success) { UI.Toast.show('Gagal disimpan', 'error', res.message); return res; }
      await g.Sync.sekarang({ paksaMaster: true });
      return res;
    } finally { if (btn) UI.tombolSibuk(btn, false); }
  }

  // =============================================================
  // PENGATURAN
  // =============================================================
  UI.Router.daftar('pengaturan', {
    template() { return UI.header({ title: 'Pengaturan' }) + '<div class="page-body" data-body></div>'; },
    init(el) {
      el.addEventListener('click', async (e) => {
        const go = e.target.closest('[data-go]'); if (go) { UI.Router.go(go.dataset.go); return; }
        const sw = e.target.closest('[data-warna]');
        if (sw && S.isAdmin()) { simpanWarna(sw.dataset.warna, el); return; }
        if (e.target.closest('[data-latar-hapus]')) { await g.Chat.Latar.hapus(); render(el); UI.Toast.show('Latar chat dikembalikan', 'success'); return; }
        const m = e.target.closest('[data-tema] button[data-v]');
        if (m) { UI.Tema.setMode(m.dataset.v); render(el); return; }
        if (e.target.closest('[data-pasang]')) { g.App.pasang(); return; }
        if (e.target.closest('[data-keluar]')) { g.App.keluar(); return; }
        if (e.target.closest('[data-sinkron]')) { await g.Sync.sekarang({ paksaMaster: true }); render(el); UI.Toast.show(g.Sync.status === 'ok' ? 'Tersinkron' : 'Belum tersinkron', g.Sync.status === 'ok' ? 'success' : 'warn', g.Sync.pesanError || ''); }
      });
      el.addEventListener('change', async (e) => {
        if (e.target.dataset.custom !== undefined) { simpanWarna(e.target.value.toUpperCase(), el); return; }
        if (e.target.dataset.latarFile !== undefined && e.target.files && e.target.files[0]) {
          const lbl = el.querySelector('[data-latar-pilih]');
          if (lbl) lbl.classList.add('sibuk');
          try { await g.Chat.Latar.pasang(e.target.files[0]); UI.Toast.show('Latar chat diganti', 'success', 'Hanya tersimpan di HP ini.'); }
          catch (er) { UI.Toast.show('Gambar tidak bisa dipakai', 'error', er.message); }
          e.target.value = ''; render(el); return;
        }
        if (e.target.dataset.fitur !== undefined) {
          const v = e.target.checked ? 'ON' : 'OFF';
          const res = await panggilOnline('pengaturanSimpan', { fitur_dompet: v });
          if (!res || !res.success) e.target.checked = !e.target.checked;
          else UI.Toast.show(v === 'ON' ? 'Fitur dompet diaktifkan' : 'Fitur dompet dinonaktifkan', 'success');
          render(el);
        }
      });
    },
    show(el) { render(el); },
    segarkan(el) { render(el); }
  });
  // Ganti warna: langsung diterapkan di layar (instan), disimpan ke server di latar; dikembalikan bila gagal
  let urutWarna = 0, statusWarna = '';
  async function simpanWarna(w, el) {
    if (!S.isAdmin() || !UI.perluOnline()) return;
    const id = ++urutWarna;
    if (!S._warnaSementara) S._warnaLama = String(S.master.pengaturan.warna_utama || '#25D366');
    S._warnaSementara = w;
    statusWarna = 'simpan';
    UI.Tema.terapkan(); render(el);
    const res = await g.API.api('pengaturanSimpan', { warna_utama: w });
    if (id !== urutWarna) return;                     // sudah ada pilihan warna yang lebih baru
    if (res.success) {
      S.master.pengaturan.warna_utama = w; await S.simpanMaster();
      statusWarna = 'ok'; g.Sync.jadwal(1500);
    } else {
      S.master.pengaturan.warna_utama = S._warnaLama; statusWarna = 'gagal';
      UI.Toast.show('Warna belum tersimpan', 'error', res.message || 'Coba lagi saat koneksi stabil.');
    }
    S._warnaSementara = null;
    UI.Tema.terapkan(); render(el);
    setTimeout(() => { if (id === urutWarna && statusWarna === 'ok') { statusWarna = ''; if (!el.hidden) render(el); } }, 2500);
  }
  function render(el) {
    const s = S.saya, warna = String(S._warnaSementara || S.master.pengaturan.warna_utama || '#25D366').toUpperCase();
    const L = g.Chat && g.Chat.Latar;
    const usulan = S.master.usulan.filter((u) => u.status === 'MENUNGGU').length;
    const st = g.Sync.status, antre = Array.from(S.outbox.values()).filter((o) => o.type === 'tx.put').length;
    const row = (go, ikon, judul, kanan, extra) => '<button class="list-row" ' + go + '><span class="ico-c sm">' + ic(ikon, 'ic-sm') + '</span><span class="grow" style="font-weight:500">' + judul + '</span>' + (kanan || '') + (extra === false ? '' : ic('chevron-right', 'chev')) + '</button>';
    let h = '<div class="card row" style="gap:14px">' + UI.ava({ nama: s.nama, warna: s.warna || 'var(--primary)' }, 'lg') +
      '<div class="grow"><div class="row" style="gap:8px"><b style="font-size:17px" class="ellip">' + U.esc(s.nama) + '</b><span class="badge ' + PERAN[s.peran][1] + '">' + PERAN[s.peran][0] + '</span></div><div class="small muted">@' + U.esc(s.username || '') + '</div></div>' +
      '<button class="link small" data-go="akun">Ubah profil' + ic('chevron-right', 'ic-sm') + '</button></div>';

    h += '<div class="sec">Tampilan</div><div class="card"><div class="row" style="margin-bottom:12px"><span class="ico-c sm">' + ic('palette', 'ic-sm') + '</span><b style="font-weight:500">Warna utama aplikasi</b></div>' +
      '<div class="swatches">' + SWATCH.map((w) => '<button class="swatch ' + (w === warna ? 'on' : '') + '" data-warna="' + w + '" style="background:' + w + '" aria-label="Warna ' + w + '"' + (S.isAdmin() ? '' : ' disabled') + '>' + (w === warna ? ic('check', 'ic-sm') : '') + '</button>').join('') +
      (SWATCH.indexOf(warna) < 0 ? '<span class="swatch on" style="background:' + U.esc(warna) + '">' + ic('check', 'ic-sm') + '</span>' : '') +
      (S.isAdmin() ? '<label class="swatch add" aria-label="Warna lain">' + ic('plus', 'ic-sm') + '<input type="color" data-custom value="' + U.esc(warna.toLowerCase()) + '"></label>' : '') + '</div>' +
      (statusWarna === 'simpan' ? '<p class="small" style="margin:10px 0 0;display:flex;gap:8px;align-items:center;color:var(--primary)"><span class="spin-sm"></span>Menyimpan warna\u2026 (sudah terlihat di HP ini)</p>'
        : statusWarna === 'ok' ? '<p class="small t-in" style="margin:10px 0 0;display:flex;gap:6px;align-items:center">' + ic('check', 'ic-sm') + 'Warna tersimpan. Anggota lain mendapat warna baru saat sinkron.</p>'
        : statusWarna === 'gagal' ? '<p class="small t-out" style="margin:10px 0 0;display:flex;gap:6px;align-items:center">' + ic('triangle-alert', 'ic-sm') + 'Gagal menyimpan, warna dikembalikan.</p>'
        : '<p class="small muted" style="margin:10px 0 0;display:flex;gap:6px;align-items:center">' + ic('lock', 'ic-sm') + 'Hanya Admin yang dapat mengubah warna</p>') +
      '<div class="hr"></div><div class="row" style="margin-bottom:10px"><span class="ico-c sm">' + ic('moon', 'ic-sm') + '</span><b style="font-weight:500">Mode tampilan</b></div>' +
      '<div class="seg" data-tema>' + [['TERANG', 'Terang'], ['GELAP', 'Gelap'], ['OTOMATIS', 'Otomatis']].map((m) => '<button data-v="' + m[0] + '" class="' + (UI.Tema.mode() === m[0] ? 'on' : '') + '">' + m[1] + '</button>').join('') + '</div>' +
      (L ? '<div class="hr"></div><div class="row" style="margin-bottom:10px"><span class="ico-c sm">' + ic('image', 'ic-sm') + '</span><b style="font-weight:500">Latar chat</b></div>' +
      '<div class="row" style="align-items:flex-start"><div class="latar-prev' + (L.url ? ' ada' : '') + '"' + (L.url ? ' style="background-image:url(' + L.url + ')"' : '') + '></div>' +
      '<div class="grow"><div class="row" style="gap:8px;flex-wrap:wrap"><label class="btn sm soft" data-latar-pilih>' + ic('image-plus', 'ic-sm') + 'Pilih dari galeri<input type="file" accept="image/*" data-latar-file hidden></label>' +
      (L.url ? '<button class="btn sm ghost" data-latar-hapus>Pakai bawaan</button>' : '') + '</div>' +
      '<p class="small muted" style="margin:8px 0 0">Gambar hanya tersimpan di HP ini, tidak dikirim ke server atau database.</p></div></div>' : '') + '</div>';

    if (S.isAdmin() || S.fiturDompet()) {
      h += '<div class="sec">Dompet</div><div class="list-group">';
      if (S.isAdmin()) h += '<label class="list-row"><span class="ico-c sm">' + ic('wallet', 'ic-sm') + '</span><span class="grow"><b style="font-weight:500;display:block">Aktifkan fitur dompet</b><span class="small muted">Pisahkan saldo Tunai, Rekening, dan E-Wallet</span></span><span class="switch"><input type="checkbox" data-fitur' + (S.fiturDompet() ? ' checked' : '') + '><i></i></span></label>';
      if (S.isAdmin()) h += row('data-go="dompet"', 'sliders-horizontal', 'Kelola dompet', '<span class="small muted">' + S.dompetAktif().length + ' dompet</span>');
      else h += row('data-go="akun"', 'wallet', 'Dompet default', '<span class="small muted">' + U.esc(labelDefault(s.id_dompet_default)) + '</span>');
      h += '</div>';
    }
    if (S.bolehKelola()) {
      h += '<div class="sec">Data Keuangan</div><div class="list-group">' +
        row('data-go="kategori"', 'shapes', 'Kategori', '<span class="small muted">' + S.kategoriAktif().length + '</span>') +
        row('data-go="kamus"', 'book-open', 'Kamus Kata Kunci', usulan ? '<span class="badge b-amber">' + usulan + ' usulan</span>' : '') +
        row('data-go="anggaran"', 'chart-pie', 'Anggaran', '') + '</div>';
    }
    h += '<div class="sec">Akun</div><div class="list-group">' + row('data-go="akun"', 'user', 'Akun Saya', '') +
      (S.isAdmin() ? row('data-go="anggota"', 'users', 'Kelola Anggota', '<span class="small muted">' + S.anggotaAktif().length + ' anggota</span>') : '') +
      row('data-sinkron', st === 'offline' ? 'cloud-off' : 'refresh-cw', 'Sinkron sekarang', '<span class="small muted">' + (antre ? antre + ' belum terkirim' : U.relatif(S.meta.lastSync)) + '</span>', false) +
      (g.App.bisaPasang() ? row('data-pasang', 'smartphone', 'Pasang CashKu di HP', '') : '') +
      '<button class="list-row" data-keluar style="color:var(--expense)"><span class="ico-c sm" style="background:var(--danger-bg);color:var(--expense)">' + ic('log-out', 'ic-sm') + '</span><span class="grow" style="font-weight:600">Keluar</span></button></div>' +
      '<p class="small muted" style="text-align:center;margin-top:20px;display:flex;justify-content:center;gap:6px;align-items:center">' + ic('cloud', 'ic-sm') + 'CashKu v' + U.esc(U.VERSI) + ' · Data tersimpan di Google Sheets keluarga</p>';
    el.querySelector('[data-body]').innerHTML = h;
  }

  // =============================================================
  // KATEGORI
  // =============================================================
  UI.Router.daftar('kategori', {
    izin: () => S.bolehKelola(),
    template() { return UI.header({ title: 'Kategori' }) + '<div class="page-body" data-body style="padding-bottom:100px"></div><button class="fab" data-tambah>' + ic('plus') + 'Kategori</button>'; },
    init(el) {
      el.querySelector('[data-tambah]').onclick = () => ubahKategori(null);
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-kat]'); if (b) ubahKategori(b.dataset.kat); });
    },
    show(el) {
      const grup = (jenis, judul) => '<div class="sec">' + judul + '</div><div class="list-group">' + S.master.kategori.filter((k) => k.jenis === jenis).sort((a, b) => (a.urutan || 0) - (b.urutan || 0)).map((k) =>
        '<button class="list-row" data-kat="' + U.esc(k.id_kategori) + '"' + (k.aktif === false ? ' style="opacity:.5"' : '') + '><span class="ico-c sm" style="background:' + U.alpha(k.warna || '#94A3B8', 0.16) + '">' + k.ikon + '</span><span class="grow">' + U.esc(k.nama) + '</span>' +
        (k.aktif === false ? '<span class="badge b-slate">Nonaktif</span>' : '<span class="small muted">' + S.master.kamus.filter((x) => x.target === k.id_kategori).length + ' kata</span>') + ic('chevron-right', 'chev') + '</button>').join('') + '</div>';
      el.querySelector('[data-body]').innerHTML = grup('KELUAR', 'Pengeluaran') + grup('MASUK', 'Pemasukan');
    }
  });
  function ubahKategori(id) {
    const k = id ? S.kat(id) : { jenis: 'KELUAR', ikon: '🏷️', warna: g.Charts.PALET[S.master.kategori.length % 10], nama: '', aktif: true };
    const warna = g.Charts.PALET.concat(['#94A3B8']);
    const sh = UI.Sheet.open({ title: id ? 'Ubah Kategori' : 'Kategori Baru', html:
      (id ? '' : '<div class="seg" data-jenis><button data-v="KELUAR" class="on">Pengeluaran</button><button data-v="MASUK">Pemasukan</button></div>') +
      '<div class="row2" style="grid-template-columns:88px 1fr;margin-top:16px"><label><span class="lbl">Ikon</span><input class="input" data-ikon maxlength="4" value="' + U.esc(k.ikon) + '" style="text-align:center;font-size:22px"></label>' +
      '<label><span class="lbl">Nama kategori</span><input class="input" data-nama maxlength="40" value="' + U.esc(k.nama) + '" placeholder="Contoh: Hewan Peliharaan"></label></div>' +
      '<span class="lbl" style="margin-top:16px">Warna</span><div class="swatches">' + warna.map((w) => '<button class="swatch ' + (w === k.warna ? 'on' : '') + '" data-w="' + w + '" style="background:' + w + ';width:34px;height:34px"></button>').join('') + '</div>' +
      (id ? '<label class="row" style="margin-top:16px"><span class="grow"><b style="font-weight:500">Aktif</b><div class="small muted">Kategori nonaktif tidak muncul di pilihan</div></span><span class="switch"><input type="checkbox" data-aktif' + (k.aktif !== false ? ' checked' : '') + '><i></i></span></label>' : '') +
      '<div class="sheet-foot"><button class="btn block lg" data-simpan>Simpan</button></div>' });
    const el = sh.el; let w = k.warna, jenis = k.jenis;
    if (!id) UI.seg(el.querySelector('[data-jenis]'), (v) => { jenis = v; });
    el.querySelector('.swatches').onclick = (e) => { const b = e.target.closest('[data-w]'); if (!b) return; w = b.dataset.w; U.$$('[data-w]', el).forEach((x) => x.classList.toggle('on', x === b)); };
    el.querySelector('[data-simpan]').onclick = async () => {
      const nama = el.querySelector('[data-nama]').value.trim();
      if (!nama) return UI.Toast.show('Nama kategori wajib diisi', 'error');
      const data = { id_kategori: id || 'KAT-' + Date.now().toString(36).toUpperCase(), nama, jenis, ikon: el.querySelector('[data-ikon]').value.trim() || '🏷️', warna: w,
        urutan: id ? k.urutan : S.master.kategori.length + 1, aktif: id ? el.querySelector('[data-aktif]').checked : true };
      await S.ubahMaster('kategori.put', data);
      sh.close(); UI.Router.segarkan(); UI.Toast.show('Kategori disimpan', 'success');
    };
  }

  // =============================================================
  // KAMUS KATA KUNCI
  // =============================================================
  const K = { tab: 'kata', cari: '', filter: 'SEMUA', buka: {} };
  UI.Router.daftar('kamus', {
    izin: () => S.bolehKelola(),
    template() {
      return UI.header({ title: 'Kamus Kata Kunci', right: '' }) + '<div class="tabs" data-tabs></div><div class="page-body" data-body style="padding-bottom:100px"></div>' +
        '<button class="fab" data-tambah>' + ic('plus') + 'Tambah Kata</button>';
    },
    init(el) {
      el.querySelector('[data-tambah]').onclick = () => tambahKata();
      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-tab]'); if (t) { K.tab = t.dataset.tab; renderKamus(el); return; }
        const f = e.target.closest('[data-flt]'); if (f) { K.filter = f.dataset.flt; renderKamus(el); return; }
        const a = e.target.closest('[data-acc]'); if (a) { K.buka[a.dataset.acc] = !K.buka[a.dataset.acc]; renderKamus(el); return; }
        const kw = e.target.closest('[data-kw]'); if (kw) { aksiKata(kw.dataset.kw); return; }
        const u = e.target.closest('[data-usulan]'); if (u) { putuskan(u.dataset.usulan, u.dataset.st); return; }
        if (e.target.closest('[data-tinjau]')) { K.tab = 'usulan'; renderKamus(el); }
        const lb = e.target.closest('[data-lebih]'); if (lb) { K.buka[lb.dataset.lebih] = 'semua'; renderKamus(el); }
      });
      el.addEventListener('input', U.debounce((e) => { if (e.target.dataset.cari !== undefined) { K.cari = e.target.value; renderKamus(el, true); } }, 200));
    },
    show(el) { renderKamus(el); },
    segarkan(el) { renderKamus(el); }
  });
  function renderKamus(el, hanyaIsi) {
    const usulan = S.master.usulan.filter((u) => u.status === 'MENUNGGU');
    el.querySelector('[data-tabs]').innerHTML = '<button data-tab="kata" class="' + (K.tab === 'kata' ? 'on' : '') + '">Kata Kunci</button><button data-tab="usulan" class="' + (K.tab === 'usulan' ? 'on' : '') + '">Usulan <span class="badge b-slate">' + usulan.length + '</span></button>';
    el.querySelector('[data-tambah]').hidden = K.tab !== 'kata';
    const body = el.querySelector('[data-body]');
    if (K.tab === 'usulan') {
      body.innerHTML = usulan.length ? usulan.map((u) => {
        const k = S.kat(u.id_kategori_usulan);
        return '<div class="card"><div class="row"><span class="kw belajar"><span class="gd"></span>' + U.esc(u.frasa) + '</span><span class="grow"></span>' + UI.ava(S.orang(u.id_pengguna), 'sm') + '</div>' +
          '<p class="small muted" style="margin:10px 0">' + U.esc(S.orang(u.id_pengguna).nama) + ' mengusulkan masuk <b>' + k.ikon + ' ' + U.esc(k.nama) + '</b></p>' +
          '<div class="row" style="gap:8px"><button class="btn sm" data-usulan="' + U.esc(u.id_usulan) + '" data-st="DISETUJUI">' + ic('check', 'ic-sm') + 'Setujui</button><button class="btn sm outline" data-usulan="' + U.esc(u.id_usulan) + '" data-st="UBAH">Ubah kategori</button><button class="btn sm ghost" data-usulan="' + U.esc(u.id_usulan) + '" data-st="DITOLAK">Tolak</button></div></div>';
      }).join('') : '<div class="empty"><div class="em">✅</div><b>Tidak ada usulan</b>Usulan kata dari akun Anak akan muncul di sini.</div>';
      return;
    }
    if (!hanyaIsi) {
      body.innerHTML = (usulan.length ? '<div class="banner" style="margin-bottom:12px">' + ic('lightbulb') + '<span class="grow" style="font-weight:600">' + usulan.length + ' usulan kata menunggu persetujuan</span><button class="btn sm" data-tinjau>Tinjau' + ic('arrow-right', 'ic-sm') + '</button></div>' : '') +
        '<div class="search">' + ic('search') + '<input class="input" type="search" data-cari placeholder="Cari kata…" value="' + U.esc(K.cari) + '"></div>' +
        '<div class="chips scroll" style="margin:12px 0" data-flts></div><div data-isi></div>' +
        '<p class="small muted" style="text-align:center;margin-top:16px"><span class="kw" style="height:auto;padding:0 6px;background:none"><span class="gd" style="background:var(--line-2)"></span>Bawaan</span> <span class="kw" style="height:auto;padding:0 6px;background:none"><span class="gd"></span>Belajar</span> <span class="kw" style="height:auto;padding:0 6px;background:none;border:0"><span class="gd" style="background:transparent;border:1.5px solid var(--faint)"></span>Manual</span></p>';
    }
    el.querySelector('[data-flts]').innerHTML = [['SEMUA', 'Semua'], ['KELUAR', 'Pengeluaran'], ['MASUK', 'Pemasukan'], ['PENANDA', 'Penanda']].concat(S.fiturDompet() ? [['DOMPET', 'Dompet']] : [])
      .map((f) => '<button class="chip ' + (K.filter === f[0] ? 'on' : '') + '" data-flt="' + f[0] + '">' + f[1] + '</button>').join('');
    const q = g.Parser.normal(K.cari);
    const cocok = (f) => !q || f.indexOf(q) > -1;
    let h = '';
    const urut = { BELAJAR: 0, MANUAL: 1 };
    const kartu = (key, ikon, judul, sub, kws) => {
      if (q && !kws.length) return '';
      kws = kws.slice().sort((a, b) => (urut[a.sumber] ?? 2) - (urut[b.sumber] ?? 2));     // hasil belajar tampil paling depan
      const buka = q || K.buka[key];
      const tampil = buka === 'semua' || q ? kws : kws.slice(0, 14);
      return '<div class="acc-card"><button class="acc-head" data-acc="' + U.esc(key) + '"><span class="ico-c sm">' + ikon + '</span><b class="grow ellip">' + U.esc(judul) + '</b><span class="badge b-slate">' + kws.length + ' kata</span>' + ic(buka ? 'chevron-up' : 'chevron-down') + '</button>' +
        (buka ? '<div class="acc-body">' + (sub ? '<p class="small muted" style="margin:0 0 10px">' + U.esc(sub) + '</p>' : '') + '<div class="chips">' + tampil.map((k) => '<button class="kw ' + (k.sumber === 'BELAJAR' ? 'belajar' : k.sumber === 'MANUAL' ? 'manual' : '') + '" data-kw="' + U.esc(k.id_kamus || '') + '">' + (k.sumber === 'BELAJAR' ? '<span class="gd"></span>' : '') + U.esc(k.frasa) + '</button>').join('') +
          (kws.length > tampil.length ? '<button class="kw manual" data-lebih="' + U.esc(key) + '">+' + (kws.length - tampil.length) + ' lainnya' + ic('chevron-down', 'ic-sm') + '</button>' : '') + '</div></div>' : '') + '</div>';
    };
    if (K.filter === 'SEMUA' || K.filter === 'KELUAR' || K.filter === 'MASUK') {
      S.kategoriAktif().filter((k) => K.filter === 'SEMUA' || k.jenis === K.filter).forEach((k) => {
        const kws = S.master.kamus.filter((x) => x.tipe === 'KATEGORI' && x.target === k.id_kategori && cocok(x.frasa));
        h += kartu(k.id_kategori, k.ikon, k.nama + (k.jenis === 'MASUK' ? ' (Pemasukan)' : ''), 'Kata yang otomatis masuk ke ' + k.nama + '.', kws);
      });
    }
    if (K.filter === 'SEMUA' || K.filter === 'PENANDA') {
      h += kartu('PM', '⬇️', 'Penanda pemasukan', 'Kata yang membuat transaksi dicatat sebagai pemasukan.', S.master.kamus.filter((x) => x.tipe === 'JENIS_MASUK' && cocok(x.frasa)));
      h += kartu('PP', '🔄', 'Penanda pindah saldo', 'Kata yang membuat transaksi dicatat sebagai pindah antar-dompet.', S.master.kamus.filter((x) => x.tipe === 'JENIS_PINDAH' && cocok(x.frasa)));
    }
    if (K.filter === 'DOMPET') {
      S.dompetAktif().forEach((d) => {
        const kws = [d.nama].concat(String(d.alias || '').split(',')).map((x) => x.trim().toLowerCase()).filter((x) => x && cocok(x)).map((f) => ({ frasa: f, sumber: 'BAWAAN', id_kamus: '' }));
        h += kartu(d.id_dompet, d.ikon || '💳', d.nama, S.isAdmin() ? 'Ubah lewat Pengaturan › Kelola dompet.' : 'Diatur oleh Admin.', kws);
      });
    }
    el.querySelector('[data-isi]').innerHTML = h || '<div class="empty"><b>Tidak ditemukan</b>Coba kata lain atau tambahkan kata baru.</div>';
  }
  async function tambahKata(frasaAwal) {
    const sh = UI.Sheet.open({ title: 'Tambah Kata', html:
      '<label class="field"><span class="lbl">Kata atau frasa</span><input class="input" data-f maxlength="60" placeholder="Contoh: seblak, cuci sofa" value="' + U.esc(frasaAwal || '') + '"></label>' +
      '<span class="lbl" style="margin-top:16px">Masuk ke</span><button class="pick" data-t><span class="v">Pilih kategori</span>' + ic('chevron-down') + '</button>' +
      '<p class="help">Setelah disimpan, kata ini langsung dikenali di chat.</p><div class="sheet-foot"><button class="btn block lg" data-simpan>Simpan</button></div>' });
    let target = '', tipe = 'KATEGORI';
    const opsi = S.kategoriAktif().map((k) => ({ value: 'KATEGORI|' + k.id_kategori, label: k.nama, ikon: k.ikon, sub: k.jenis === 'MASUK' ? 'Pemasukan' : '' }))
      .concat([{ value: 'JENIS_MASUK|MASUK', label: 'Penanda pemasukan', ikon: '⬇️' }, { value: 'JENIS_PINDAH|PINDAH', label: 'Penanda pindah saldo', ikon: '🔄' }]);
    sh.el.querySelector('[data-t]').onclick = async () => {
      const v = await UI.Sheet.pilih({ judul: 'Masuk ke', opsi, nilai: tipe + '|' + target });
      if (!v) return; [tipe, target] = v.split('|');
      const o = opsi.find((x) => x.value === v);
      sh.el.querySelector('[data-t] .v').textContent = (o.ikon || '') + ' ' + o.label;
    };
    sh.el.querySelector('[data-simpan]').onclick = async () => {
      const f = g.Parser.normal(sh.el.querySelector('[data-f]').value);
      if (!f) return UI.Toast.show('Kata wajib diisi', 'error');
      if (!target) return UI.Toast.show('Pilih kategori tujuan', 'error');
      await S.ubahMaster('kamus.put', { id_kamus: 'KMS-' + Date.now().toString(36) + U.rand(4), frasa: f, tipe, target, sumber: 'MANUAL' });
      sh.close(); UI.Router.segarkan(); UI.Toast.show('“' + f + '” ditambahkan', 'success');
    };
  }
  async function aksiKata(id) {
    const k = S.master.kamus.find((x) => x.id_kamus === id);
    if (!k) return;
    const v = await UI.Sheet.pilih({ judul: '“' + k.frasa + '”', opsi: [{ value: 'pindah', label: 'Pindahkan ke kategori lain', ikon: '⇄' }, { value: 'hapus', label: 'Hapus dari kamus', ikon: '🗑️' }] });
    if (v === 'hapus') {
      if (!(await UI.Sheet.konfirmasi({ judul: 'Hapus kata?', isi: '“' + k.frasa + '” tidak akan dikenali otomatis lagi.', ok: 'Hapus', bahaya: true }))) return;
      await S.ubahMaster('kamus.del', { id_kamus: id });
    } else if (v === 'pindah') {
      const t = await UI.Sheet.pilih({ judul: 'Pindahkan ke', opsi: S.kategoriAktif().map((x) => ({ value: x.id_kategori, label: x.nama, ikon: x.ikon })), nilai: k.target });
      if (!t) return;
      await S.ubahMaster('kamus.put', { id_kamus: id, frasa: k.frasa, tipe: 'KATEGORI', target: t, sumber: 'MANUAL' });
    } else return;
    UI.Router.segarkan();
  }
  async function putuskan(id, st) {
    const u = S.master.usulan.find((x) => x.id_usulan === id);
    if (!u) return;
    let kat = u.id_kategori_usulan;
    if (st === 'UBAH') {
      kat = await UI.Sheet.pilih({ judul: 'Masuk kategori', opsi: S.kategoriAktif().map((x) => ({ value: x.id_kategori, label: x.nama, ikon: x.ikon })), nilai: kat });
      if (!kat) return; st = 'DISETUJUI';
    }
    await S.ubahMaster('usulan.putuskan', { id_usulan: id, status: st, id_kategori: kat });
    UI.Router.segarkan();
    UI.Toast.show(st === 'DISETUJUI' ? '“' + u.frasa + '” ditambahkan ke ' + S.kat(kat).nama : 'Usulan ditolak', 'success');
  }

  // =============================================================
  // ANGGARAN
  // =============================================================
  let lingkupTab = 'KELUARGA';
  UI.Router.daftar('anggaran', {
    izin: () => S.bolehKelola(),
    template() { return UI.header({ title: 'Anggaran', sub: U.namaBulan(U.hariIni()) }) + '<div class="page-body" data-body style="padding-bottom:100px"></div><button class="fab" data-tambah>' + ic('plus') + 'Anggaran</button>'; },
    init(el) {
      el.querySelector('[data-tambah]').onclick = () => ubahAnggaran(null);
      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-lk] button[data-v]'); if (t) { lingkupTab = t.dataset.v; renderAnggaran(el); return; }
        const a = e.target.closest('[data-ang]'); if (a) ubahAnggaran(a.dataset.ang);
      });
    },
    show(el) { renderAnggaran(el); },
    segarkan(el) { renderAnggaran(el); }
  });
  function renderAnggaran(el) {
    const st = S.statusAnggaran().filter((x) => x.a.lingkup === lingkupTab);
    const nonaktif = S.master.anggaran.filter((a) => a.aktif === false && a.lingkup === lingkupTab);
    let h = '<div class="seg" data-lk style="margin-bottom:16px"><button data-v="KELUARGA" class="' + (lingkupTab === 'KELUARGA' ? 'on' : '') + '">Keluarga</button><button data-v="PERORANG" class="' + (lingkupTab === 'PERORANG' ? 'on' : '') + '">Per Orang</button></div>';
    if (!st.length) h += '<div class="empty"><div class="em">🎯</div><b>Belum ada anggaran ' + (lingkupTab === 'KELUARGA' ? 'keluarga' : 'per orang') + '</b>Ketuk “+ Anggaran” untuk membuat batas belanja.</div>';
    st.forEach((x) => {
      const l = S.labelAnggaran(x.a);
      h += '<button class="card" data-ang="' + U.esc(x.a.id_anggaran) + '" style="width:100%;text-align:left;display:block' + (x.level === 2 ? ';background:var(--danger-bg)' : '') + '">' +
        '<div class="row" style="margin-bottom:10px"><span class="ico-c sm">' + l.ikon + '</span><span class="grow"><b class="ellip" style="display:block">' + U.esc(l.nama) + '</b><span class="small muted">' + (x.a.lingkup === 'PERORANG' ? U.esc(l.lingkup) + ' · ' : '') + (x.a.periode === 'MINGGUAN' ? 'Mingguan' : 'Bulanan') + '</span></span>' +
        (x.level ? ic('triangle-alert', x.level === 2 ? 't-out' : 't-warn') : '') + '<b class="num ' + (x.level === 2 ? 't-out' : x.level ? 't-warn' : 't-in') + '">' + Math.round(x.persen) + '%</b></div>' +
        '<div class="prog l' + x.level + '"><i style="width:' + Math.min(100, x.persen) + '%"></i></div><div class="row small muted" style="justify-content:space-between;margin-top:6px"><span class="num">' + U.rp(x.terpakai) + ' / ' + U.rp(x.batas) + '</span><span>Peringatan ' + (x.a.ambang_peringatan || 80) + '%</span></div></button>';
    });
    if (nonaktif.length) h += '<div class="sec">Nonaktif</div>' + nonaktif.map((a) => '<button class="card" data-ang="' + U.esc(a.id_anggaran) + '" style="width:100%;text-align:left;opacity:.6">' + U.esc(S.labelAnggaran(a).lengkap) + ' · ' + U.rp(a.batas) + '</button>').join('');
    el.querySelector('[data-body]').innerHTML = h;
  }
  function ubahAnggaran(id) {
    const a = id ? S.master.anggaran.find((x) => x.id_anggaran === id) : { lingkup: lingkupTab, id_pengguna: '', id_kategori: 'KAT-JAJAN', periode: 'BULANAN', batas: 0, ambang_peringatan: 80, aktif: true };
    const st = Object.assign({}, a);
    if (st.lingkup === 'PERORANG' && !st.id_pengguna) st.id_pengguna = (S.anggotaAktif().find((x) => x.peran === 'ANAK') || S.anggotaAktif()[0] || {}).id;
    const sh = UI.Sheet.open({ title: id ? 'Ubah Anggaran' : 'Tambah Anggaran', html:
      '<span class="lbl">Lingkup Anggaran</span><div class="seg fill" data-lk><button data-v="KELUARGA">Keluarga</button><button data-v="PERORANG">Per Orang</button></div>' +
      '<div data-untuk style="margin-top:16px"><div class="lbl"><span>Untuk Anggota</span><span class="hint" data-tp style="color:var(--primary);font-weight:600"></span></div><div class="chips scroll" data-ava style="gap:14px"></div></div>' +
      '<div class="row2" style="margin-top:16px"><div><span class="lbl">Kategori</span><button class="pick" data-kat></button></div><div><span class="lbl">Periode</span><div class="seg" data-per><button data-v="BULANAN">Bulanan</button><button data-v="MINGGUAN">Mingguan</button></div></div></div>' +
      '<label class="field" style="margin-top:16px"><span class="lbl">Batas Anggaran</span><div class="input-wrap rp"><span class="pre">Rp</span><input class="input num" data-batas value="' + U.fmtInput(st.batas) + '" placeholder="0"></div></label>' +
      '<div class="card" style="margin-top:16px;background:var(--info-bg);border:0"><div class="row"><span style="color:var(--warning)">' + ic('bell-ring') + '</span><span class="grow" style="font-weight:500">Beri peringatan saat terpakai</span><b class="num" style="font-size:20px;color:var(--primary)" data-ambv></b></div>' +
      '<input type="range" class="range" min="50" max="100" step="5" data-amb value="' + st.ambang_peringatan + '" style="margin-top:14px"><div class="row small muted" style="justify-content:space-between;margin-top:6px"><span>Aman (50%)</span><span class="t-warn" style="font-weight:600">Waspada (80%)</span><span>Batas Maks (100%)</span></div></div>' +
      '<div class="banner" style="margin-top:12px">' + ic('info') + '<span class="small" data-info></span></div>' +
      (id ? '<label class="row" style="margin-top:16px"><span class="grow" style="font-weight:500">Aktif</span><span class="switch"><input type="checkbox" data-aktif' + (st.aktif !== false ? ' checked' : '') + '><i></i></span></label>' : '') +
      '<div class="sheet-foot"><button class="btn block lg" data-simpan>' + ic('save') + 'Simpan Anggaran</button><button class="btn block ghost" data-x2>Batal</button></div>' });
    const el = sh.el;
    const gambar = () => {
      U.$$('[data-lk] button', el).forEach((b) => b.classList.toggle('on', b.dataset.v === st.lingkup));
      U.$$('[data-per] button', el).forEach((b) => b.classList.toggle('on', b.dataset.v === st.periode));
      el.querySelector('[data-untuk]').hidden = st.lingkup !== 'PERORANG';
      el.querySelector('[data-ava]').innerHTML = S.anggotaAktif().map((m) => '<button data-u="' + U.esc(m.id) + '" style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:none">' +
        '<span style="border-radius:99px;padding:3px;border:3px solid ' + (st.id_pengguna === m.id ? 'var(--primary)' : 'transparent') + '">' + UI.ava(m, 'lg') + '</span><span class="small" style="font-weight:' + (st.id_pengguna === m.id ? '700;color:var(--primary)' : '500') + '">' + U.esc(m.nama) + '</span></button>').join('');
      el.querySelector('[data-tp]').textContent = st.lingkup === 'PERORANG' && st.id_pengguna ? S.orang(st.id_pengguna).nama + ' terpilih' : '';
      const k = st.id_kategori === 'SEMUA' ? { ikon: '💸', nama: 'Total Pengeluaran' } : S.kat(st.id_kategori);
      el.querySelector('[data-kat]').innerHTML = '<span>' + k.ikon + '</span><span class="v">' + U.esc(k.nama) + '</span>' + ic('chevron-down');
      el.querySelector('[data-ambv]').textContent = st.ambang_peringatan + '%';
      const admin = S.anggotaAktif().filter((x) => x.peran === 'ADMIN').map((x) => x.nama)[0] || 'Admin';
      el.querySelector('[data-info]').textContent = st.lingkup === 'PERORANG' ? 'Peringatan otomatis dikirim ke ' + S.orang(st.id_pengguna).nama + ' dan ' + admin + ' (Admin).' : 'Peringatan otomatis dikirim ke semua anggota keluarga.';
    };
    gambar();
    el.addEventListener('click', async (e) => {
      const lk = e.target.closest('[data-lk] button'); if (lk) { st.lingkup = lk.dataset.v; if (st.lingkup === 'PERORANG' && !st.id_pengguna) st.id_pengguna = (S.anggotaAktif()[0] || {}).id; gambar(); return; }
      const pr = e.target.closest('[data-per] button'); if (pr) { st.periode = pr.dataset.v; gambar(); return; }
      const u = e.target.closest('[data-u]'); if (u) { st.id_pengguna = u.dataset.u; gambar(); return; }
      if (e.target.closest('[data-kat]')) {
        const v = await UI.Sheet.pilih({ judul: 'Kategori', opsi: [{ value: 'SEMUA', label: 'Total Pengeluaran (semua kategori)', ikon: '💸' }].concat(S.kategoriAktif('KELUAR').map((k) => ({ value: k.id_kategori, label: k.nama, ikon: k.ikon }))), nilai: st.id_kategori });
        if (v) { st.id_kategori = v; gambar(); }
      }
      if (e.target.closest('[data-x2]')) sh.close();
    });
    el.querySelector('[data-amb]').addEventListener('input', (e) => { st.ambang_peringatan = Number(e.target.value); gambar(); });
    UI.inputRupiah(el.querySelector('[data-batas]'));
    el.querySelector('[data-simpan]').onclick = async () => {
      st.batas = U.angkaInput(el.querySelector('[data-batas]').value);
      if (!(st.batas > 0)) return UI.Toast.show('Batas anggaran harus lebih dari 0', 'error');
      const data = { id_anggaran: id || 'AGR-' + Date.now().toString(36).toUpperCase(), lingkup: st.lingkup, id_pengguna: st.lingkup === 'PERORANG' ? st.id_pengguna : '',
        id_kategori: st.id_kategori, periode: st.periode, batas: st.batas, ambang_peringatan: st.ambang_peringatan, aktif: id ? el.querySelector('[data-aktif]').checked : true };
      await S.ubahMaster('anggaran.put', data);
      sh.close(); lingkupTab = st.lingkup; UI.Router.segarkan(); UI.Toast.show('Anggaran disimpan', 'success');
    };
  }

  // =============================================================
  // DOMPET (Admin, perlu online)
  // =============================================================
  UI.Router.daftar('dompet', {
    izin: () => S.isAdmin(),
    template() { return UI.header({ title: 'Kelola Dompet' }) + '<div class="page-body" data-body style="padding-bottom:40px"></div>'; },
    init(el) {
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-dmp]'); if (b) ubahDompet(b.dataset.dmp); });
    },
    show(el) {
      const saldo = Object.fromEntries(S.saldoDompet().map((x) => [x.dompet.id_dompet, x.saldo]));
      const adaTab = S.master.dompet.some((d) => d.tipe === 'TABUNGAN');
      el.querySelector('[data-body]').innerHTML = (!adaTab ? '<div class="banner amber" style="margin-bottom:12px">' + ic('triangle-alert') + '<span class="small">Dompet <b>Tabungan</b> belum ada di server. Tempel ulang <b>Kode.gs</b> versi terbaru di Apps Script, jalankan <b>migrasiData</b>, lalu buat <b>Versi baru</b> pada deployment.</span></div>' : '') + (navigator.onLine === false ? '<div class="banner amber" style="margin-bottom:12px">' + ic('cloud-off') + '<span class="small">Mengubah dompet perlu koneksi internet.</span></div>' : '') +
        '<div class="list-group">' + S.master.dompet.map((d) => '<button class="list-row" data-dmp="' + U.esc(d.id_dompet) + '"' + (d.aktif === false ? ' style="opacity:.5"' : '') + '><span class="ico-c">' + U.esc(d.ikon || '💳') + '</span><span class="grow"><b style="display:block;font-weight:600">' + U.esc(d.nama) + '</b><span class="small muted">' + ({ TUNAI: 'Tunai', REKENING: 'Rekening bank', EWALLET: 'E-wallet', TABUNGAN: 'Tabungan' })[d.tipe] + (d.pemilik ? ' · milik ' + U.esc(S.orang(d.pemilik).nama) : ' · keluarga') + '</span></span>' +
          (d.aktif === false ? '<span class="badge b-slate">Nonaktif</span>' : '<b class="num">' + U.rp(saldo[d.id_dompet] || 0) + '</b>') + ic('chevron-right', 'chev') + '</button>').join('') + '</div>' +
        '<p class="help" style="margin-top:12px">Alias adalah kata yang dikenali di chat untuk dompet ini, misalnya “bri” atau “gopay”.</p>' +
        '<p class="help">🐷 <b>Tabungan</b> adalah uang yang disisihkan. Chat <b>nabung 1jt</b> masuk ke Tabungan, dan Tabungan tidak ditawarkan saat membayar kecuali disebut (<b>beli hp 3jt dari tabungan</b>). Matikan lewat tombol <b>Aktif</b> bila tidak dipakai.</p>';
    }
  });
  function ubahDompet(id) {
    const d = id ? S.dompet(id) : { nama: '', tipe: 'EWALLET', pemilik: '', saldo_awal: 0, tanggal_saldo_awal: U.hariIni(), alias: '', aktif: true, ikon: '' };
    const st = Object.assign({}, d);
    const sh = UI.Sheet.open({ title: id ? 'Ubah Dompet' : 'Dompet Baru', html:
      '<label class="field"><span class="lbl">Nama dompet</span><input class="input" data-nama maxlength="30" value="' + U.esc(st.nama) + '" placeholder="Contoh: BRI Ayah, GoPay Bunda"></label>' +
      '<span class="lbl" style="margin-top:16px">Jenis</span><div class="seg seg-4" data-tipe><button data-v="TUNAI">💵 Tunai</button><button data-v="REKENING">🏦 Rek</button><button data-v="EWALLET">📱 E-Wallet</button><button data-v="TABUNGAN">🐷 Tabungan</button></div>' +
      '<span class="lbl" style="margin-top:16px">Pemilik</span><button class="pick" data-pem></button>' +
      '<div class="row2" style="margin-top:16px"><label><span class="lbl">Saldo awal</span><div class="input-wrap"><span class="pre" style="font-size:14px">Rp</span><input class="input num" data-saldo value="' + U.fmtInput(st.saldo_awal) + '" placeholder="0"></div></label>' +
      '<label><span class="lbl">Per tanggal</span><input class="input" type="date" data-tgl value="' + U.esc(st.tanggal_saldo_awal || U.hariIni()) + '"></label></div>' +
      '<label class="field" style="margin-top:16px"><span class="lbl">Alias <span class="hint">pisahkan dengan koma</span></span><textarea class="input" data-alias placeholder="bri, brimo, rekening ayah">' + U.esc(st.alias || '') + '</textarea></label>' +
      (id ? '<label class="row" style="margin-top:16px"><span class="grow" style="font-weight:500">Aktif</span><span class="switch"><input type="checkbox" data-aktif' + (st.aktif !== false ? ' checked' : '') + '><i></i></span></label>' : '') +
      '<div class="sheet-foot"><button class="btn block lg" data-simpan>Simpan</button></div>' });
    const el = sh.el;
    const gambar = () => {
      U.$$('[data-tipe] button', el).forEach((b) => b.classList.toggle('on', b.dataset.v === st.tipe));
      el.querySelector('[data-pem]').innerHTML = '<span class="v">' + U.esc(st.pemilik ? S.orang(st.pemilik).nama : 'Keluarga (bersama)') + '</span>' + ic('chevron-down');
    };
    gambar();
    el.querySelector('[data-tipe]').onclick = (e) => { const b = e.target.closest('button'); if (b) { st.tipe = b.dataset.v; gambar(); } };
    el.querySelector('[data-pem]').onclick = async () => {
      const v = await UI.Sheet.pilih({ judul: 'Pemilik', opsi: [{ value: '', label: 'Keluarga (bersama)' }].concat(S.anggotaAktif().map((a) => ({ value: a.id, label: a.nama }))), nilai: st.pemilik });
      if (v !== null) { st.pemilik = v; gambar(); }
    };
    UI.inputRupiah(el.querySelector('[data-saldo]'));
    el.querySelector('[data-simpan]').onclick = async (e) => {
      const nama = el.querySelector('[data-nama]').value.trim();
      if (!nama) return UI.Toast.show('Nama dompet wajib diisi', 'error');
      const res = await panggilOnline('dompetSimpan', { id_dompet: id || '', nama, tipe: st.tipe, pemilik: st.pemilik, saldo_awal: U.angkaInput(el.querySelector('[data-saldo]').value),
        tanggal_saldo_awal: el.querySelector('[data-tgl]').value, alias: el.querySelector('[data-alias]').value, aktif: id ? el.querySelector('[data-aktif]').checked : true }, e.currentTarget);
      if (res && res.success) { sh.close(); UI.Router.segarkan(); UI.Toast.show('Dompet disimpan', 'success'); }
    };
  }

  // =============================================================
  // AKUN SAYA
  // =============================================================
  UI.Router.daftar('akun', {
    template() { return UI.header({ title: 'Akun Saya' }) + '<div class="page-body" data-body></div>'; },
    segarkan() { /* formulir: jangan digambar ulang oleh sinkron di latar (isian tidak boleh hilang) */ },
    show(el) {
      const s = S.saya;
      el.querySelector('[data-body]').innerHTML = '<div class="card"><label class="field"><span class="lbl">Nama tampilan</span><input class="input" data-nama maxlength="30" value="' + U.esc(s.nama) + '"></label>' +
        (S.fiturDompet() ? '<span class="lbl" style="margin-top:16px">Dompet default</span><select class="select" data-dompet>' + opsiDefault(s.id_dompet_default) + '</select><p class="help">Dipakai bila chat tidak menyebut dompet. Pilih <b>Tanya dulu</b> agar CashKu menanyakan dompet yang dipakai. Hanya dompet yang ada saldonya yang ditawarkan; bila hanya satu yang ada saldonya, langsung dipakai.</p>' : '') +
        '<button class="btn block" style="margin-top:16px" data-simpan-profil>Simpan profil</button></div>' +
        '<div class="sec">Ganti password</div><div class="card"><label class="field"><span class="lbl">Password lama</span><input class="input" type="password" data-lama autocomplete="current-password"></label>' +
        '<label class="field"><span class="lbl">Password baru</span><input class="input" type="password" data-baru autocomplete="new-password" minlength="6"></label><p class="help">Minimal 6 karakter.</p>' +
        '<button class="btn block outline" style="margin-top:12px" data-ganti>Ganti password</button></div>' +
        '<p class="small muted" style="text-align:center;margin-top:16px">Peran: ' + PERAN[s.peran][0] + (s.peran === 'ANAK' ? ' · ' + (s.izin_lihat === 'SEMUA' ? 'melihat semua transaksi keluarga' : 'melihat transaksi milik sendiri') : '') + '</p>';
      el.querySelector('[data-simpan-profil]').onclick = async (e) => {
        const nama = el.querySelector('[data-nama]').value.trim();
        if (!nama) return UI.Toast.show('Nama wajib diisi', 'error');
        const dm = el.querySelector('[data-dompet]');
        if (!UI.perluOnline()) return;
        const btn = e.currentTarget;
        UI.tombolSibuk(btn, true);
        const res = await g.API.api('profilSimpan', { nama_tampilan: nama, id_dompet_default: dm ? dm.value : s.id_dompet_default });
        UI.tombolSibuk(btn, false);
        if (!res.success) return UI.Toast.show('Gagal disimpan', 'error', res.message);
        S.saya.nama = nama; if (dm) S.saya.id_dompet_default = dm.value;
        await S.simpanSesi();
        UI.Toast.show('Profil disimpan', 'success', dm && dm.value === 'TANYA' ? 'CashKu akan menanyakan dompet setiap mencatat.' : undefined);
        g.Sync.sekarang({ paksaMaster: true });
      };
      el.querySelector('[data-ganti]').onclick = async (e) => {
        const lama = el.querySelector('[data-lama]').value, baru = el.querySelector('[data-baru]').value;
        if (baru.length < 6) return UI.Toast.show('Password baru minimal 6 karakter', 'error');
        if (!UI.perluOnline()) return;
        UI.tombolSibuk(e.currentTarget, true);
        const res = await g.API.api('gantiPassword', { lama, baru });
        UI.tombolSibuk(e.currentTarget, false);
        if (res.success) { el.querySelector('[data-lama]').value = ''; el.querySelector('[data-baru]').value = ''; UI.Toast.show('Password berhasil diganti', 'success'); }
        else UI.Toast.show('Gagal', 'error', res.message);
      };
    }
  });

  // =============================================================
  // KELOLA ANGGOTA (Admin, perlu online)
  // =============================================================
  UI.Router.daftar('anggota', {
    izin: () => S.isAdmin(),
    template() { return UI.header({ title: 'Kelola Anggota', sub: '' }) + '<div class="page-body" data-body style="padding-bottom:100px"></div><button class="fab" data-tambah>' + ic('user-plus') + 'Tambah Anggota</button>'; },
    init(el) {
      el.querySelector('[data-tambah]').onclick = () => ubahAnggota(null);
      el.addEventListener('click', async (e) => {
        const m = e.target.closest('[data-menu]');
        if (!m) return;
        const a = S.orang(m.dataset.menu);
        const v = await UI.Sheet.pilih({ judul: a.nama, opsi: [{ value: 'ubah', label: 'Ubah', ikon: '✏️' }, { value: 'reset', label: 'Reset password', ikon: '🔑' },
          { value: 'aktif', label: a.aktif === false ? 'Aktifkan' : 'Nonaktifkan', ikon: a.aktif === false ? '✅' : '⛔' }] });
        if (v === 'ubah') ubahAnggota(a.id);
        if (v === 'reset') resetPassword(a);
        if (v === 'aktif') {
          if (a.aktif !== false && !(await UI.Sheet.konfirmasi({ judul: 'Nonaktifkan ' + a.nama + '?', isi: a.nama + ' tidak bisa masuk lagi sampai diaktifkan. Catatannya tetap tersimpan.', ok: 'Nonaktifkan', bahaya: true }))) return;
          const res = await panggilOnline('penggunaSimpan', { id: a.id, username: a.username, nama_tampilan: a.nama, peran: a.peran, izin_lihat: a.izin_lihat, id_dompet_default: a.id_dompet_default, aktif: a.aktif === false });
          if (res && res.success) { UI.Router.segarkan(); UI.Toast.show(a.aktif === false ? 'Anggota diaktifkan' : 'Anggota dinonaktifkan', 'success'); }
        }
      });
    },
    show(el) {
      el.querySelector('.app-header .sub').textContent = S.namaKeluarga() + ' · ' + S.anggotaAktif().length + ' anggota';
      el.querySelector('[data-body]').innerHTML = (navigator.onLine === false ? '<div class="banner amber" style="margin-bottom:12px">' + ic('cloud-off') + '<span class="small">Mengelola anggota perlu koneksi internet.</span></div>' : '') +
        S.master.anggota.map((a) => '<div class="card row"' + (a.aktif === false ? ' style="opacity:.65"' : '') + '>' + UI.ava(a) + '<div class="grow"><div class="row" style="gap:8px;flex-wrap:wrap"><b>' + U.esc(a.nama) + '</b><span class="badge ' + PERAN[a.peran][1] + '">' + PERAN[a.peran][0] + '</span></div>' +
          '<div class="small muted">@' + U.esc(a.username || '') + '</div>' + (a.peran === 'ANAK' ? '<div class="small muted">Izin lihat: ' + (a.izin_lihat === 'SEMUA' ? 'Semua transaksi' : 'Milik sendiri') + '</div>' : '') + '</div>' +
          '<span class="badge ' + (a.aktif === false ? 'b-slate' : 'b-green') + '">' + (a.aktif === false ? 'Nonaktif' : 'Aktif') + '</span><button class="hbtn" style="color:var(--muted)" data-menu="' + U.esc(a.id) + '" aria-label="Menu ' + U.esc(a.nama) + '">' + ic('ellipsis-vertical') + '</button></div>').join('');
    }
  });
  function ubahAnggota(id) {
    const a = id ? S.orang(id) : { nama: '', username: '', peran: 'ANAK', izin_lihat: 'SENDIRI', id_dompet_default: (S.dompetAktif()[0] || {}).id_dompet || '', aktif: true };
    const st = Object.assign({}, a);
    const sh = UI.Sheet.open({ title: id ? 'Ubah Anggota' : 'Tambah Anggota', html:
      '<label class="field"><span class="lbl">Nama tampilan</span><input class="input" data-nama maxlength="30" value="' + U.esc(st.nama) + '" placeholder="Contoh: Adik"></label>' +
      '<label class="field"><span class="lbl">Username <span class="hint">Digunakan untuk login</span></span><div class="input-wrap"><span class="pre" style="font-size:16px">@</span><input class="input" data-user maxlength="20" autocapitalize="off" autocomplete="off" value="' + U.esc(st.username || '') + '"></div><div data-uerr></div></label>' +
      (id ? '' : '<label class="field"><span class="lbl">Password awal</span><div class="input-wrap"><input class="input has-end" style="padding-left:14px" type="password" data-pw autocomplete="new-password"><button class="end" type="button" data-eye aria-label="Tampilkan password">' + ic('eye') + '</button></div><p class="help">Anggota dapat menggantinya nanti di profil</p></label>') +
      '<span class="lbl" style="margin-top:16px">Peran dalam keluarga</span><div class="seg fill" data-peran><button data-v="ADMIN">Admin</button><button data-v="DEWASA">Dewasa</button><button data-v="ANAK">' + ic('smile', 'ic-sm') + 'Anak</button></div>' +
      '<div class="card" style="margin-top:16px;background:var(--info-bg);border:0" data-izinbox><div class="row" style="margin-bottom:12px">' + ic('lock-open') + '<b style="font-weight:500">Izin akses transaksi</b></div>' +
      '<label class="radio-card"><input type="radio" name="izin" value="SEMUA"' + (st.izin_lihat === 'SEMUA' ? ' checked' : '') + '><span><b>Semua transaksi keluarga</b><span class="small muted">Dapat melihat catatan belanja orang tua</span></span></label>' +
      '<label class="radio-card"><input type="radio" name="izin" value="SENDIRI"' + (st.izin_lihat !== 'SEMUA' ? ' checked' : '') + '><span><b>Milik sendiri saja</b><span class="small muted">Hanya melihat uang saku dan jajan pribadi</span></span></label></div>' +
      (S.fiturDompet() ? '<span class="lbl" style="margin-top:16px">Dompet default</span><select class="select" data-dompet>' + opsiDefault(st.id_dompet_default) + '</select>' : '') +
      '<div class="sheet-foot"><button class="btn block lg" data-simpan>Simpan Anggota</button><button class="btn block ghost" data-x2>Batal</button></div>' });
    const el = sh.el;
    const gambar = () => {
      U.$$('[data-peran] button', el).forEach((b) => b.classList.toggle('on', b.dataset.v === st.peran));
      el.querySelector('[data-izinbox]').hidden = st.peran !== 'ANAK';
    };
    gambar();
    el.querySelector('[data-peran]').onclick = (e) => { const b = e.target.closest('button'); if (b) { st.peran = b.dataset.v; gambar(); } };
    el.querySelector('[data-x2]').onclick = () => sh.close();
    const eye = el.querySelector('[data-eye]');
    if (eye) eye.onclick = () => { const p = el.querySelector('[data-pw]'); p.type = p.type === 'password' ? 'text' : 'password'; eye.innerHTML = ic(p.type === 'password' ? 'eye' : 'eye-off'); };
    const uinp = el.querySelector('[data-user]');
    uinp.addEventListener('input', () => { uinp.classList.remove('err'); el.querySelector('[data-uerr]').innerHTML = ''; });
    el.querySelector('[data-simpan]').onclick = async (e) => {
      const nama = el.querySelector('[data-nama]').value.trim();
      const username = uinp.value.trim().toLowerCase();
      if (!nama) return UI.Toast.show('Nama wajib diisi', 'error');
      const lokalDup = S.master.anggota.some((x) => x.id !== id && String(x.username || '').toLowerCase() === username);
      if (lokalDup) { uinp.classList.add('err'); el.querySelector('[data-uerr]').innerHTML = '<div class="err-msg">' + ic('circle-x', 'ic-sm') + 'Username sudah dipakai</div>'; return; }
      const pw = el.querySelector('[data-pw]');
      if (pw && pw.value.length < 6) return UI.Toast.show('Password awal minimal 6 karakter', 'error');
      const izin = (el.querySelector('input[name="izin"]:checked') || {}).value || 'SENDIRI';
      const dm = el.querySelector('[data-dompet]');
      const res = await panggilOnline('penggunaSimpan', { id: id || '', nama_tampilan: nama, username, peran: st.peran, izin_lihat: izin, id_dompet_default: dm ? dm.value : '', password: pw ? pw.value : undefined, aktif: st.aktif !== false }, e.currentTarget);
      if (!res) return;
      if (!res.success) {
        if (res.data && /USERNAME/.test(res.data.code || '')) { uinp.classList.add('err'); el.querySelector('[data-uerr]').innerHTML = '<div class="err-msg">' + ic('circle-x', 'ic-sm') + U.esc(res.message) + '</div>'; }
        return;
      }
      sh.close(); UI.Router.segarkan(); UI.Toast.show(id ? 'Anggota diperbarui' : nama + ' ditambahkan', 'success', id ? '' : 'Login dengan @' + username);
    };
  }
  function resetPassword(a) {
    const sh = UI.Sheet.open({ title: 'Reset password', sub: a.nama + ' (@' + (a.username || '') + ')', html:
      '<label class="field"><span class="lbl">Password baru</span><input class="input" type="text" data-pw autocomplete="off" placeholder="Minimal 6 karakter"></label><p class="help">' + U.esc(a.nama) + ' akan keluar dari semua perangkat dan perlu masuk lagi.</p>' +
      '<div class="sheet-foot"><button class="btn block lg" data-simpan>Reset password</button></div>' });
    sh.el.querySelector('[data-simpan]').onclick = async (e) => {
      const pw = sh.el.querySelector('[data-pw]').value;
      if (pw.length < 6) return UI.Toast.show('Password minimal 6 karakter', 'error');
      const res = await panggilOnline('penggunaReset', { id: a.id, password: pw }, e.currentTarget);
      if (res && res.success) { sh.close(); UI.Toast.show('Password direset', 'success', 'Beri tahu ' + a.nama + ' password barunya.'); }
    };
  }
})(window);
