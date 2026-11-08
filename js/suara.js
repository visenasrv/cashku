/* CashKu — Input suara (1.0.16)
 * Tombol mikrofon di samping kolom ketik. Teks hasil suara masuk ke kolom ketik untuk diperiksa — TIDAK dikirim otomatis.
 * Rekaman suara tidak pernah disimpan: yang dipakai hanya teks hasil pengenalan.
 * Browser: Web Speech API (id-ID). Aplikasi Android (APK): pengenal suara bawaan Android lewat plugin SuaraCashKu.
 */
(function (g) {
  'use strict';
  const Suara = {};
  const BATAS_DETIK = 30;
  const KUNCI_PENJELASAN = 'cashku_mic_dijelaskan';
  let aktif = false, rec = null, timer = null, dasar = '', input = null, bar = null, tombol = null, pendengar = [];

  const asli = () => !!(g.Capacitor && g.Capacitor.isNativePlatform && g.Capacitor.isNativePlatform());
  const plugin = () => (asli() && g.Capacitor.Plugins ? g.Capacitor.Plugins.SuaraCashKu : null);
  const SR = () => g.SpeechRecognition || g.webkitSpeechRecognition;
  const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent || '');
  Suara.didukung = () => !!(plugin() || SR());
  Suara.aktif = () => aktif;

  const PESAN = {
    tidakDidukung: 'Mikrofon belum didukung di browser ini. Coba pakai ikon mikrofon di keyboard HP.',
    offline: 'Suara butuh internet. Ketik pesan, atau pakai ikon mikrofon di keyboard HP.',
    tidakTerdengar: 'Suara tidak terdengar. Coba lagi dan bicara lebih dekat ke HP.',
    tanpaMik: 'Mikrofon tidak ditemukan di perangkat ini.',
    sibuk: 'Mikrofon sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.',
    umum: 'Suara belum bisa dikenali.'
  };

  function simpanLokal(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; }

  // ---------------- Tampilan ----------------
  /** Dipanggil chat.js setelah kolom ketik dibuat */
  Suara.pasang = function (el) {
    input = el.querySelector('textarea');
    tombol = el.querySelector('[data-mic]');
    bar = el.querySelector('[data-suara]');
    if (!tombol) return;
    tombol.addEventListener('click', (e) => { e.preventDefault(); aktif ? Suara.berhenti() : Suara.mulai(); });
    if (bar) bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sa]'); if (!b) return;
      if (b.dataset.sa === 'stop') Suara.berhenti();
      else if (b.dataset.sa === 'ulang') Suara.mulai();
      else if (b.dataset.sa === 'izin') panduanIzin();
      else tampilBar(null);
    });
  };
  function tampilBar(mode, teks) {
    if (!bar) return;
    if (!mode) { bar.hidden = true; bar.innerHTML = ''; bar.className = 'suara-bar'; return; }
    bar.hidden = false;
    bar.className = 'suara-bar ' + mode;
    const ic = g.UI ? g.UI.ic : () => '';
    if (mode === 'dengar') {
      bar.innerHTML = '<span class="suara-dot" aria-hidden="true"></span><span class="grow" role="status">Sedang mendengarkan… bicara sekarang</span><button class="btn sm" data-sa="stop">' + ic('square', 'ic-sm') + ' Berhenti</button>';
    } else if (mode === 'galat') {
      bar.innerHTML = '<span class="grow" role="alert">' + U.esc(teks) + '</span><button class="btn sm" data-sa="ulang">Coba lagi</button><button class="hbtn sm" data-sa="tutup" aria-label="Tutup">' + ic('x', 'ic-sm') + '</button>';
    } else if (mode === 'izin') {
      bar.innerHTML = '<span class="grow" role="alert">' + U.esc(teks) + '</span><button class="btn sm" data-sa="izin">Cara mengizinkan</button><button class="hbtn sm" data-sa="tutup" aria-label="Tutup">' + ic('x', 'ic-sm') + '</button>';
    } else {
      bar.innerHTML = '<span class="grow" role="status">' + U.esc(teks) + '</span><button class="hbtn sm" data-sa="tutup" aria-label="Tutup">' + ic('x', 'ic-sm') + '</button>';
    }
  }
  function setTombol(on) {
    aktif = on;
    if (tombol) { tombol.classList.toggle('rekam', on); tombol.setAttribute('aria-label', on ? 'Berhenti mendengarkan' : 'Input suara'); tombol.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  }
  function tulis(teks) {
    if (!input) return;
    input.value = (dasar ? dasar + ' ' : '') + String(teks || '').trim();
    if (g.Chat && g.Chat.autoTinggi) g.Chat.autoTinggi();
  }
  const fokus = () => { try { input && input.focus(); } catch (e) { /* abaikan */ } };

  // ---------------- Penjelasan & izin ----------------
  function jelaskanSekali() {
    if (simpanLokal(KUNCI_PENJELASAN) === '1' || !g.UI || !g.UI.Sheet) return Promise.resolve(true);
    return g.UI.Sheet.konfirmasi({
      judul: 'Izinkan mikrofon',
      isiHtml: 'CashKu memakai mikrofon <b>hanya saat tombol 🎤 ditekan</b>. Ucapan diubah jadi teks di kolom ketik, lalu bisa diperiksa dulu sebelum dikirim.<br><br>' +
        'Suara <b>tidak direkam dan tidak disimpan</b>. Setelah ini HP akan meminta izin mikrofon — pilih <b>Izinkan</b>.',
      ok: 'Lanjut', batal: 'Nanti saja'
    }).then((ok) => { if (ok) simpanLokal(KUNCI_PENJELASAN, '1'); return ok; });
  }
  function panduanIzin() {
    if (!g.UI || !g.UI.Sheet) return;
    const langkah = asli()
      ? '<ol><li>Buka <b>Pengaturan HP → Aplikasi → CashKu</b>.</li><li>Ketuk <b>Izin → Mikrofon</b>.</li><li>Pilih <b>Izinkan hanya saat aplikasi digunakan</b>.</li></ol>'
      : ios()
        ? '<ol><li>Buka <b>Pengaturan → Safari → Mikrofon</b> (atau <b>Pengaturan → Privasi → Mikrofon</b>).</li><li>Pilih <b>Izinkan</b> / <b>Tanya</b>.</li><li>Kembali ke CashKu lalu muat ulang halaman.</li></ol>'
        : '<ol><li>Ketuk ikon <b>🔒 / ⓘ</b> di samping alamat situs (atau ⋮ → <b>Setelan situs</b>).</li><li>Pilih <b>Izin → Mikrofon → Izinkan</b>.</li><li>Muat ulang halaman, lalu ketuk 🎤 lagi.</li></ol>' +
          '<div class="muted" style="margin-top:6px">Bila CashKu dipasang di layar utama: tekan lama ikon CashKu → <b>Info aplikasi → Izin → Mikrofon</b>.</div>';
    const s = g.UI.Sheet.open({ title: 'Mikrofon belum diizinkan', html: '<div style="font-size:15px;line-height:22px">' + langkah + '</div><div class="sheet-foot">' +
      (asli() ? '<button class="btn block lg" data-buka>Buka pengaturan aplikasi</button>' : '') + '<button class="btn block ghost" data-x2>Tutup</button></div>' });
    const b = s.el.querySelector('[data-buka]');
    if (b) b.onclick = () => { const A = g.Capacitor.Plugins.AlarmCashKu; if (A) A.bukaIzin({ jenis: 'aplikasi' }); s.close(); };
    s.el.querySelector('[data-x2]').onclick = () => s.close();
  }

  // ---------------- Mulai / berhenti ----------------
  Suara.mulai = async function () {
    if (aktif) return;
    tampilBar(null);
    if (!Suara.didukung()) { tampilBar('info', PESAN.tidakDidukung); fokus(); return; }
    let lokal = false;
    if (navigator.onLine === false && !asli()) {
      // Pengenalan di perangkat (bila browser mendukung) boleh dipakai saat offline
      const C = SR();
      try { if (C && typeof C.available === 'function' && (await C.available({ langs: ['id-ID'], processLocally: true })) === 'available') lokal = true; } catch (e) { lokal = false; }
      if (!lokal) { tampilBar('info', PESAN.offline); fokus(); return; }
    }
    if (!(await jelaskanSekali())) return;
    dasar = input ? input.value.trim() : '';
    return plugin() ? mulaiAsli() : mulaiWeb(lokal);
  };
  Suara.berhenti = function () {
    clearTimeout(timer);
    if (plugin()) { try { plugin().berhenti(); } catch (e) { /* abaikan */ } }
    if (rec) { try { rec.stop(); } catch (e) { /* abaikan */ } }
    selesai();
  };
  function selesai() {
    clearTimeout(timer);
    setTombol(false);
    if (bar && bar.classList.contains('dengar')) tampilBar(null);
    rec = null;
    pendengar.forEach((p) => { try { p.remove(); } catch (e) { /* abaikan */ } });
    pendengar = [];
    fokus();
  }
  function galat(kode) {
    clearTimeout(timer);
    setTombol(false);
    rec = null;
    if (kode === 'not-allowed' || kode === 'service-not-allowed' || kode === 'izin') { tampilBar('izin', 'Izin mikrofon ditolak.'); return; }
    if (kode === 'network' || kode === 'jaringan') { tampilBar('info', PESAN.offline); fokus(); return; }
    if (kode === 'no-speech' || kode === 'sunyi') { tampilBar('galat', PESAN.tidakTerdengar); return; }
    if (kode === 'audio-capture') { tampilBar('galat', PESAN.tanpaMik); return; }
    if (kode === 'sibuk') { tampilBar('galat', PESAN.sibuk); return; }
    if (kode === 'aborted') { tampilBar(null); return; }
    tampilBar('galat', PESAN.umum);
  }
  function mulaiWeb(lokal) {
    const C = SR();
    try {
      rec = new C();
      rec.lang = 'id-ID';
      rec.interimResults = true;
      rec.continuous = false;          // berhenti sendiri saat hening
      rec.maxAlternatives = 1;
      if (lokal && 'processLocally' in rec) rec.processLocally = true;
    } catch (e) { galat('umum'); return; }
    let akhir = '';
    rec.onresult = (e) => {
      let sementara = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) akhir += t; else sementara += t;
      }
      tulis(akhir + sementara);
    };
    rec.onerror = (e) => galat(e.error);
    rec.onend = () => { if (aktif) selesai(); };
    try { rec.start(); } catch (e) { galat('umum'); return; }
    setTombol(true);
    tampilBar('dengar');
    timer = setTimeout(() => Suara.berhenti(), BATAS_DETIK * 1000);
  }
  async function mulaiAsli() {
    const S2 = plugin();
    try {
      let izin = await S2.periksaIzin();
      if (izin.mikrofon !== 'granted') izin = await S2.mintaIzin();
      if (izin.mikrofon !== 'granted') { galat('izin'); return; }
      pendengar.push(await S2.addListener('sebagian', (d) => tulis(d.teks)));
      pendengar.push(await S2.addListener('hasil', (d) => { tulis(d.teks); selesai(); }));
      pendengar.push(await S2.addListener('galat', (d) => { pendengar.forEach((p) => p.remove()); pendengar = []; galat(d.kode); }));
      setTombol(true);
      tampilBar('dengar');
      timer = setTimeout(() => Suara.berhenti(), BATAS_DETIK * 1000);
      await S2.mulai({ bahasa: 'id-ID', utamakanOffline: navigator.onLine === false });
    } catch (e) { galat('umum'); }
  }

  Suara.PESAN = PESAN;
  g.Suara = Suara;
})(window);
