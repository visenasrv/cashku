/* CashKu — 1.0.19: Atur ulang saldo dompet (khusus Admin) & nonaktif/aktifkan anggaran lewat chat.
 * Atur ulang saldo = saldo dompet dijadikan 0 (atau angka baru) memakai catatan penyesuaian saldo.
 * Riwayat transaksi & laporan tetap utuh. Selalu didahului peringatan tegas + mengetik "ATUR ULANG".
 */
(function (g) {
  'use strict';
  const K = {};
  const S = () => g.S, U = () => g.U, UI = () => g.UI, Chat = () => g.Chat;
  const KATA_KONFIRMASI = 'ATUR ULANG';
  const rp = (n) => U().rp(n);
  const tanda = (n) => (n < 0 ? '−' : '') + rp(n);

  // =============================================================
  // ATUR ULANG SALDO
  // =============================================================
  // Dompet nonaktif (1.0.21): Tunai/Rekening/E-wallet digabung jadi "Uang" (id UANG); Tabungan tetap sendiri
  function saldoSekarang() {
    const out = {};
    S().saldoRingkas().forEach((x) => { out[x.id] = x.saldo; });
    return out;
  }
  function semuaDompet() {
    if (S().fiturDompet()) return S().dompetAktif();
    return S().saldoRingkas().map((x) => (x.id === 'UANG' ? { id_dompet: 'UANG', nama: 'Uang', ikon: '👛', tipe: 'UANG' } : x.dompet));
  }
  /** Dompet yang dituju: dipilih, atau semua dompet aktif */
  function daftarDompet(ids) {
    const aktif = semuaDompet();
    if (!S().fiturDompet() && ids && ids.length) ids = ids.map((id) => (id === 'UANG' || !S().dompet(id) || S().dompet(id).tipe !== 'TABUNGAN' ? 'UANG' : id));
    return ids && ids.length ? aktif.filter((d) => ids.indexOf(d.id_dompet) > -1) : aktif;
  }

  /** Peringatan tegas: wajib mengetik ATUR ULANG. Dipakai dari chat maupun Pengaturan. */
  K.konfirmasiTegas = function (dompet, target) {
    const saldo = saldoSekarang();
    return new Promise((resolve) => {
      const baris = dompet.map((d) => '<div class="ln" style="display:flex;justify-content:space-between;gap:8px;padding:4px 0"><span>' + U().esc((d.ikon || '💳') + ' ' + d.nama) + '</span><b class="num">' + tanda(saldo[d.id_dompet] || 0) + ' → ' + rp(target) + '</b></div>').join('');
      const s = UI().Sheet.open({
        title: '⚠️ Atur ulang saldo',
        html: '<div class="banner red" style="margin-bottom:12px;display:block"><b>Tindakan ini mengubah saldo dompet berikut.</b><br>Saldo lama tidak dipakai lagi. Riwayat transaksi tetap ada, tetapi saldo dihitung ulang mulai dari ' + rp(target) + ' per hari ini.</div>' +
          '<div class="card" style="padding:10px 14px;margin-bottom:12px">' + baris + '</div>' +
          '<label class="field"><span class="lbl"><span>Ketik <b>' + KATA_KONFIRMASI + '</b> untuk melanjutkan</span></span><input class="input" data-ketik autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="' + KATA_KONFIRMASI + '"></label>' +
          '<div class="sheet-foot"><button class="btn block lg danger" data-ok disabled>Atur ulang saldo</button><button class="btn block ghost" data-no>Batal</button></div>',
        onClose: (v) => resolve(v === true)
      });
      const inp = s.el.querySelector('[data-ketik]'), ok = s.el.querySelector('[data-ok]');
      inp.addEventListener('input', () => { ok.disabled = inp.value.trim().toUpperCase().replace(/\s+/g, ' ') !== KATA_KONFIRMASI; });
      ok.onclick = () => { if (!ok.disabled) s.close(true); };
      s.el.querySelector('[data-no]').onclick = () => s.close(false);
      setTimeout(() => { try { inp.focus(); } catch (e) { /* abaikan */ } }, 300);
    });
  };

  /** Simpan penyesuaian saldo; mengembalikan daftar transaksi yang dibuat */
  K.terapkanSaldo = async function (dompet, target, teksAsli) {
    const saldo = saldoSekarang(), batch = 'B' + Date.now().toString(36) + U().rand(3), ids = [];
    for (const d of dompet) {
      const selisih = target - (saldo[d.id_dompet] || 0);
      if (!selisih) continue;
      const idDompet = d.id_dompet === 'UANG' ? (S().dompetUtama() || {}).id_dompet || '' : d.id_dompet;
      const t = await S().simpanTx({ jenis: 'SALDO', nominal: selisih, keterangan: 'Atur ulang saldo jadi ' + rp(target), id_dompet: idDompet,
        tanggal_transaksi: U().hariIni(), teks_asli: teksAsli || '', id_batch: batch, sumber: teksAsli ? 'CHAT' : 'APP' });
      ids.push(t.id_transaksi);
    }
    if (g.Sync) g.Sync.jadwal(300);
    return ids;
  };

  function tolakSaldo() {
    const s = S();
    if (!s.isAdmin()) return 'Maaf, atur ulang saldo hanya bisa dilakukan oleh **Admin**.';
    if (!s.dompetAktif().length) return 'Belum ada dompet aktif.';
    return '';
  }

  /** Dari chat: "reset saldo", "nolkan saldo gopay", "atur ulang saldo bank jadi 2 juta" */
  K.saldoMulai = function (it, teks) {
    const C = Chat(), tolak = tolakSaldo();
    if (tolak) return C.sistem(tolak);
    const dompet = daftarDompet(it.semua ? [] : it.dompet);
    if (!dompet.length) return C.sistem('Dompet yang dimaksud tidak ditemukan atau sedang nonaktif.');
    const saldo = saldoSekarang(), target = Math.max(0, Number(it.target) || 0);
    const berubah = dompet.filter((d) => (saldo[d.id_dompet] || 0) !== target);
    if (!berubah.length) return C.sistem('Saldo ' + (dompet.length > 1 ? 'semua dompet itu' : '**' + dompet[0].nama + '**') + ' memang sudah ' + rp(target) + ', jadi tidak ada yang diubah.');
    return C.tambah({ kind: 'ringkasan', data: {
      judul: '⚠️ Atur ulang saldo ' + (dompet.length === semuaDompet().length && dompet.length > 1 ? 'semua dompet' : dompet.map((d) => d.nama).join(', ')),
      baris: dompet.map((d) => ({ l: (d.ikon || '💳') + ' ' + d.nama, v: tanda(saldo[d.id_dompet] || 0) + ' → ' + rp(target), kelas: 't-out' })),
      catatan: '**Peringatan:** saldo lama tidak dipakai lagi dan dihitung ulang mulai dari ' + rp(target) + ' per hari ini. Riwayat transaksi & laporan tetap ada. Setelah ini akan diminta mengetik **' + KATA_KONFIRMASI + '**.',
      chips: [{ label: 'Lanjutkan', aksi: 'saldoUlang', nilai: { ids: dompet.map((d) => d.id_dompet), target, teks: teks || '' }, gaya: 'danger', ikon: 'triangle-alert', tetap: true },
        { label: 'Batal', aksi: 'tutup' }]
    } });
  };
  /** Tombol [Lanjutkan] di chat */
  K.saldoLanjut = async function (m, i, v, tandai) {
    const C = Chat(), tolak = tolakSaldo();
    if (tolak) return C.sistem(tolak);
    if (m.data.selesai) return C.sistem('Saldo ini sudah diatur ulang sebelumnya.');
    const dompet = daftarDompet(v.ids);
    const ok = await K.konfirmasiTegas(dompet, v.target);
    if (!ok) return C.sistem('Oke, saldo **tidak** diubah 👍');
    await tandai(m, i);
    const ids = await K.terapkanSaldo(dompet, v.target, v.teks || 'atur ulang saldo');
    if (!ids.length) return C.sistem('Saldonya sudah ' + rp(v.target) + ', tidak ada yang diubah.');
    return C.tambah({ kind: 'tx', data: { ids, salam: 'Saldo ' + (dompet.length > 1 ? dompet.length + ' dompet' : '**' + dompet[0].nama + '**') + ' sudah diatur ulang jadi ' + rp(v.target) + ' ✅' } });
  };
  /** Dari Pengaturan → Kelola Dompet */
  K.saldoDariPengaturan = function () {
    const tolak = tolakSaldo();
    if (tolak) return UI().Toast.show('Tidak bisa', 'warn', tolak.replace(/\*\*/g, ''));
    const saldo = saldoSekarang(), semua = semuaDompet();
    const pilih = new Set(semua.map((d) => d.id_dompet));
    const s = UI().Sheet.open({
      title: 'Atur ulang saldo', sub: 'Pilih dompet yang saldonya diatur ulang',
      html: '<div class="list-group" data-daftar></div>' +
        '<label class="field" style="margin-top:14px"><span class="lbl">Saldo baru</span><div class="input-wrap"><span class="pre" style="font-size:14px">Rp</span><input class="input num" data-target value="0" inputmode="numeric"></div></label>' +
        '<p class="small muted" style="margin:8px 0 0">Riwayat transaksi tetap ada. Saldo dihitung ulang mulai dari angka ini per hari ini.</p>' +
        '<div class="sheet-foot"><button class="btn block lg danger" data-lanjut>Lanjutkan</button></div>'
    });
    const daftar = s.el.querySelector('[data-daftar]');
    const gambar = () => {
      daftar.innerHTML = '<label class="list-row"><span class="grow" style="font-weight:600">Semua dompet</span><span class="switch"><input type="checkbox" data-semua' + (pilih.size === semua.length ? ' checked' : '') + '><i></i></span></label>' +
        semua.map((d) => '<label class="list-row"><span class="ico-c sm">' + U().esc(d.ikon || '💳') + '</span><span class="grow"><b style="font-weight:500;display:block">' + U().esc(d.nama) + '</b><span class="small muted">Saldo ' + tanda(saldo[d.id_dompet] || 0) + '</span></span><span class="switch"><input type="checkbox" data-pilih="' + U().esc(d.id_dompet) + '"' + (pilih.has(d.id_dompet) ? ' checked' : '') + '><i></i></span></label>').join('');
    };
    gambar();
    daftar.addEventListener('change', (e) => {
      if (e.target.dataset.semua !== undefined) { pilih.clear(); if (e.target.checked) semua.forEach((d) => pilih.add(d.id_dompet)); }
      else if (e.target.dataset.pilih) { if (e.target.checked) pilih.add(e.target.dataset.pilih); else pilih.delete(e.target.dataset.pilih); }
      gambar();
    });
    UI().inputRupiah(s.el.querySelector('[data-target]'));
    s.el.querySelector('[data-lanjut]').onclick = async () => {
      if (!pilih.size) return UI().Toast.show('Pilih minimal satu dompet', 'error');
      const target = U().angkaInput(s.el.querySelector('[data-target]').value);
      const dompet = daftarDompet(Array.from(pilih));
      s.close();
      await new Promise((r) => setTimeout(r, 280));
      if (!(await K.konfirmasiTegas(dompet, target))) return UI().Toast.show('Saldo tidak diubah', 'info');
      const ids = await K.terapkanSaldo(dompet, target, '');
      UI().Toast.show(ids.length ? 'Saldo diatur ulang' : 'Tidak ada yang berubah', 'success', ids.length ? ids.length + ' dompet jadi ' + rp(target) + '.' : 'Saldonya memang sudah ' + rp(target) + '.');
      UI().Router.segarkan();
    };
  };

  // =============================================================
  // ANGGARAN: nonaktifkan (satu / beberapa / semua) & aktifkan lagi
  // =============================================================
  const labelA = (a) => { const l = S().labelAnggaran(a); return l.ikon + ' ' + l.nama + (a.lingkup === 'PERORANG' ? ' (' + l.lingkup + ')' : '') + (a.periode === 'MINGGUAN' ? ' · mingguan' : ''); };
  const bolehAnggaran = () => S().bolehKelola();
  function cocokAnggaran(it, aktif) {
    let xs = S().master.anggaran.filter((a) => (aktif ? a.aktif !== false : a.aktif === false));
    if (!S().isAdmin()) xs = xs.filter((a) => a.lingkup !== 'PERORANG' || a.id_pengguna === S().saya.id);
    if (it.orang) xs = xs.filter((a) => a.lingkup === 'PERORANG' && a.id_pengguna === it.orang);
    if (it.periode) xs = xs.filter((a) => (a.periode || 'BULANAN') === it.periode);
    if (it.semua) return { xs, tidak: [] };
    if (!it.kategori.length) return { xs: null, tidak: it.kata || [], kandidat: xs };
    const tidak = it.kategori.filter((id) => !xs.some((a) => (a.id_kategori || 'SEMUA') === id)).map((id) => (id === 'SEMUA' ? 'Total pengeluaran' : S().kat(id).nama)).concat(it.kata || []);
    return { xs: xs.filter((a) => it.kategori.indexOf(a.id_kategori || 'SEMUA') > -1), tidak };
  }
  K.anggaranStatus = function (it) {
    const C = Chat();
    if (!bolehAnggaran()) return C.sistem('Maaf, anggaran hanya bisa diubah oleh Admin atau anggota dewasa.');
    const nonaktif = it.mode === 'nonaktif';
    const r = cocokAnggaran(it, nonaktif);
    if (!r.xs) {
      // Tidak menyebut anggaran mana → tawarkan pilihan
      if (!r.kandidat.length) return C.sistem(nonaktif ? 'Tidak ada anggaran yang sedang aktif.' : 'Tidak ada anggaran yang sedang nonaktif.');
      return C.tambah({ kind: 'pilihan', data: { teks: 'Anggaran mana yang mau ' + (nonaktif ? 'dinonaktifkan' : 'diaktifkan lagi') + '?',
        sub: 'Bisa lebih dari satu, misalnya ketik **' + (nonaktif ? 'hapus' : 'aktifkan') + ' anggaran jajan dan makan**.',
        chips: r.kandidat.slice(0, 8).map((a) => ({ label: labelA(a), aksi: 'anggaranPilih', nilai: { mode: it.mode, ids: [a.id_anggaran] } }))
          .concat(r.kandidat.length > 1 ? [{ label: 'Semua anggaran (' + r.kandidat.length + ')', aksi: 'anggaranPilih', nilai: { mode: it.mode, ids: r.kandidat.map((a) => a.id_anggaran) }, gaya: nonaktif ? 'ghost' : '' }] : []) } });
    }
    const catTidak = r.tidak.length ? 'Tidak ada anggaran ' + (nonaktif ? 'aktif' : 'nonaktif') + ' untuk: ' + r.tidak.join(', ') + '.' : '';
    if (!r.xs.length) return C.sistem((catTidak || (nonaktif ? 'Tidak ada anggaran yang sedang aktif.' : 'Tidak ada anggaran yang sedang nonaktif.')) + (nonaktif ? ' Ketik **sisa anggaran** untuk melihat yang aktif.' : ''));
    return K.anggaranKonfirmasi(it.mode, r.xs.map((a) => a.id_anggaran), catTidak);
  };
  K.anggaranKonfirmasi = function (mode, ids, catatan) {
    const C = Chat(), xs = S().master.anggaran.filter((a) => ids.indexOf(a.id_anggaran) > -1);
    if (mode === 'aktif') return K.anggaranUbah(xs, true);
    return C.tambah({ kind: 'ringkasan', data: {
      judul: '⚠️ Yakin mau menonaktifkan ' + (xs.length > 1 ? xs.length + ' anggaran' : 'anggaran ini') + '?',
      baris: xs.map((a) => ({ l: labelA(a), v: rp(a.batas) + '/' + (a.periode === 'MINGGUAN' ? 'mgg' : 'bln') })),
      catatan: (catatan ? catatan + ' ' : '') + 'Anggaran nonaktif tidak dihitung dan tidak memberi peringatan lagi. Bisa diaktifkan kembali kapan saja.',
      chips: [{ label: 'Ya, nonaktifkan', aksi: 'anggaranYa', nilai: { ids }, gaya: 'danger' }, { label: 'Batal', aksi: 'tutup' }]
    } });
  };
  K.anggaranUbah = async function (xs, aktif) {
    const C = Chat();
    if (!bolehAnggaran()) return C.sistem('Maaf, anggaran hanya bisa diubah oleh Admin atau anggota dewasa.');
    for (const a of xs) await S().ubahMaster('anggaran.put', Object.assign({}, a, { aktif }));
    const ids = xs.map((a) => a.id_anggaran);
    const daftar = xs.map((a) => '• ' + labelA(a)).join('\n');
    return C.tambah({ kind: 'pilihan', data: {
      teks: (aktif ? 'Siap, anggaran ini aktif lagi ✅\n' : 'Oke, anggaran ini sudah dinonaktifkan ✅\n') + daftar,
      sub: aktif ? 'Peringatan anggaran berjalan lagi.' : 'Mau dipakai lagi? Ketik **aktifkan anggaran ' + (xs.length === 1 ? S().labelAnggaran(xs[0]).nama.toLowerCase() : '…') + '** atau ketuk tombol di bawah.',
      chips: aktif ? [{ label: 'Sisa anggaran', aksi: 'kirim', nilai: { teks: 'sisa anggaran' } }]
        : [{ label: 'Aktifkan lagi', aksi: 'anggaranPilih', nilai: { mode: 'aktif', ids }, tetap: false }]
    } });
  };
  K.aksi = async function (m, i, c, tandai) {
    const v = c.nilai || {};
    if (c.aksi === 'saldoUlang') return K.saldoLanjut(m, i, v, tandai);
    if (c.aksi === 'anggaranPilih') { await tandai(m, i); return K.anggaranKonfirmasi(v.mode, v.ids, ''); }
    if (c.aksi === 'anggaranYa') {
      await tandai(m, i);
      const xs = S().master.anggaran.filter((a) => v.ids.indexOf(a.id_anggaran) > -1 && a.aktif !== false);
      if (!xs.length) return Chat().sistem('Anggaran itu sudah nonaktif.');
      return K.anggaranUbah(xs, false);
    }
    return null;
  };

  // =============================================================
  // RESET CASHKU (1.0.20) — khusus Admin, wajib password Admin
  // =============================================================
  K.resetCashku = function () {
    const u = U(), ui = UI();
    if (!S().isAdmin()) return ui.Toast.show('Hanya Admin', 'warn', 'Reset CashKu hanya bisa dilakukan oleh Admin.');
    let cadangan = null;
    const s = ui.Sheet.open({
      title: '⚠️ Reset CashKu',
      html: '<div class="banner red" style="display:block;margin-bottom:12px"><b>Semua data berikut akan DIHAPUS dan tidak bisa dikembalikan:</b>' +
        '<ul style="margin:6px 0 0;padding-left:20px;line-height:22px"><li>Semua riwayat transaksi</li><li>Saldo semua dompet (jadi Rp0)</li><li>Semua pengingat</li><li>Semua anggaran</li>' +
        '<li>Catatan yang diingat (nomor PLN, rekening, dll.)</li><li>Target tabungan & data Penasihat Keuangan</li><li>Riwayat chat di semua HP keluarga</li></ul></div>' +
        '<p class="small muted" style="margin:0 0 14px">Yang tetap ada: akun anggota keluarga, kategori, kata yang sudah dipelajari, nama dompet, dan pengaturan.</p>' +
        '<span class="lbl">Buat cadangan Google Sheet dulu?</span><div class="seg" data-cad style="margin-top:6px"><button type="button" data-v="ya">Ya, buat cadangan</button><button type="button" data-v="tidak">Tidak perlu</button></div>' +
        '<p class="small muted" style="margin:6px 0 0" data-cad-ket>Cadangan disimpan di folder CashKu di Google Drive.</p>' +
        '<label class="field" style="margin-top:14px"><span class="lbl">Password Admin</span><div class="input-wrap">' + g.ic('lock') + '<input class="input has-end" type="password" data-pw autocomplete="current-password"><button type="button" class="end" data-eye aria-label="Tampilkan password">' + g.ic('eye') + '</button></div><div data-err></div></label>' +
        '<div class="sheet-foot"><button class="btn block lg danger" data-reset disabled>Reset CashKu</button><button class="btn block ghost" data-no>Batal</button></div>'
    });
    const el = s.el, pw = el.querySelector('[data-pw]'), btn = el.querySelector('[data-reset]'), err = el.querySelector('[data-err]');
    const cekSiap = () => { btn.disabled = !(cadangan !== null && pw.value.length > 0); };
    el.querySelector('[data-cad]').onclick = (e) => {
      const b = e.target.closest('button[data-v]'); if (!b) return;
      cadangan = b.dataset.v === 'ya';
      u.$$('[data-cad] button', el).forEach((x) => x.classList.toggle('on', x === b));
      el.querySelector('[data-cad-ket]').textContent = cadangan ? 'Cadangan disimpan di folder CashKu di Google Drive (butuh beberapa detik).' : 'Tanpa cadangan, data lama tidak bisa dikembalikan sama sekali.';
      cekSiap();
    };
    pw.addEventListener('input', () => { err.innerHTML = ''; pw.classList.remove('err'); cekSiap(); });
    el.querySelector('[data-eye]').onclick = () => { pw.type = pw.type === 'password' ? 'text' : 'password'; el.querySelector('[data-eye]').innerHTML = g.ic(pw.type === 'password' ? 'eye' : 'eye-off'); };
    el.querySelector('[data-no]').onclick = () => s.close();
    btn.onclick = async () => {
      if (btn.disabled) return;
      if (navigator.onLine === false) { err.innerHTML = '<div class="err-msg">' + g.ic('circle-alert', 'ic-sm') + 'Reset perlu koneksi internet.</div>'; return; }
      ui.tombolSibuk(btn, true, cadangan ? 'Membuat cadangan…' : 'Mereset…');
      const res = await g.API.api('resetCashku', { password: pw.value, cadangan: !!cadangan }, { tries: 1 });
      if (!res.success) {
        ui.tombolSibuk(btn, false);
        if (res.data && res.data.code === 'PASSWORD') pw.classList.add('err');
        err.innerHTML = '<div class="err-msg">' + g.ic('circle-alert', 'ic-sm') + u.esc(res.message || 'Reset gagal. Coba lagi.') + '</div>';
        return;
      }
      s.close();
      if (g.Sync) await g.Sync.terapkanReset(true);
      ui.Toast.show('CashKu sudah direset', 'success', res.data.cadangan ? 'Cadangan tersimpan di folder CashKu di Google Drive.' : '');
      if (res.data.cadangan && g.Chat) await g.Chat.sistem('💾 Cadangan data lama tersimpan di folder **CashKu** di Google Drive (nama berkas diawali *Cadangan CashKu*).', true);
      ui.Router.go('chat');
    };
  };
  /** Dari chat: "reset cashku" → arahkan ke Pengaturan */
  K.resetInfo = function () {
    const C = Chat();
    if (!S().isAdmin()) return C.sistem('Reset CashKu hanya bisa dilakukan oleh **Admin**.');
    return C.tambah({ kind: 'pilihan', data: { teks: 'Reset CashKu menghapus semua riwayat, saldo, pengingat, anggaran, catatan, dan target. Demi keamanan, reset hanya bisa lewat **Pengaturan** dengan password Admin.',
      chips: [{ label: 'Buka Pengaturan', aksi: 'buka', nilai: { halaman: 'pengaturan' }, ikon: 'settings', tetap: true }] } });
  };

  g.Kelola = K;
})(window);
