/* CashKu — penghubung aplikasi Android (APK) — 1.0.16
 * - Deteksi platform: APK → alarm asli Android; web/iPhone → notifikasi PWA + kalender (seperti sebelumnya)
 * - Sinkron pengingat ke alarm asli (berbunyi walau offline, HP terkunci, setelah HP dinyalakan ulang)
 * - Tanggapan dari layar alarm (Matikan / Tunda / Sudah bayar) dikirim ke server saat aplikasi dibuka
 * - Pembaruan tampilan tanpa APK baru: unduh dari GitHub Pages, dipakai saat aplikasi dibuka lagi (aman: kembali otomatis bila gagal)
 * - Halaman "Izin alarm Android": status izin, tips merek HP, tes alarm, pilih nada
 */
(function (g) {
  'use strict';
  const Asli = {};
  const A = () => (g.Capacitor && g.Capacitor.Plugins ? g.Capacitor.Plugins.AlarmCashKu : null);
  Asli.aktif = () => !!(g.Capacitor && g.Capacitor.isNativePlatform && g.Capacitor.isNativePlatform() && A());
  const simpan = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; };
  const ic = (n, c) => (g.UI ? g.UI.ic(n, c) : '');

  /** Bandingkan versi "1.0.16" */
  Asli.lebihBaru = function (a, b) {
    const x = String(a || '').split('.').map(Number), y = String(b || '').split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; }
    return false;
  };

  // ------------------------------------------------------------------
  // Sinkron alarm
  // ------------------------------------------------------------------
  let tSinkron = null;
  Asli.daftarAlarm = function () {
    if (!S.saya) return [];
    return (S.master.pengingat || []).filter((p) => p.id_pengguna === S.saya.id).map((p) => ({
      id_pengingat: p.id_pengingat, judul: p.judul, pola: p.pola, tanggal: p.tanggal || '', hari_bulan: String(p.hari_bulan || ''),
      hari_minggu: String(p.hari_minggu || ''), jam: p.jam || '07:00', berikutnya: Number(p.berikutnya) || 0, status: p.status || 'AKTIF' }));
  };
  Asli.sinkronAlarm = function (segera) {
    if (!Asli.aktif()) return;
    clearTimeout(tSinkron);
    tSinkron = setTimeout(async () => {
      try { await A().sinkron({ daftar: Asli.daftarAlarm(), offset: g.Pengingat ? g.Pengingat.Jadwal.offset() : 8 }); } catch (e) { console.warn('Sinkron alarm gagal', e); }
    }, segera ? 0 : 700);
  };

  // ------------------------------------------------------------------
  // Tanggapan dari layar alarm
  // ------------------------------------------------------------------
  const sudahDiproses = new Set();
  Asli.prosesAksi = async function () {
    if (!Asli.aktif() || !S.saya) return;
    let r;
    try { r = await A().ambilAksi(); } catch (e) { return; }
    const daftar = (r && r.aksi) || [];
    const bayar = [];
    for (const x of daftar) {
      const kunci = x.id + ':' + x.aksi + ':' + x.jatuh;
      if (sudahDiproses.has(kunci)) continue;
      sudahDiproses.add(kunci);
      const p = (S.master.pengingat || []).find((e) => e.id_pengingat === x.id);
      if (!p) continue;
      if (x.aksi === 'tunda') await S.ubahMaster('pengingat.tunda', { id_pengingat: x.id, sampai: Number(x.sampai) });
      else await S.ubahMaster('pengingat.ack', { id_pengingat: x.id, berikutnya: Number(x.jatuh) });
      if (x.aksi === 'bayar') bayar.push(x.judul || p.judul);
    }
    if (bayar.length && g.Chat) {
      const j = bayar[0];
      await g.Chat.tambah({ kind: 'pilihan', data: { teks: '✅ **' + j + '** ditandai sudah dibayar' + (bayar.length > 1 ? ' (+' + (bayar.length - 1) + ' lainnya)' : '') + '. Mau dicatat sebagai pengeluaran?',
        sub: 'Ketuk **Catat**, lalu tambahkan nominalnya.', chips: [{ label: 'Catat', aksi: 'isiKetik', nilai: { teks: String(j).toLowerCase() + ' ' }, gaya: 'acc' }, { label: 'Nanti saja', aksi: 'tutup' }] } });
    }
  };

  // ------------------------------------------------------------------
  // Pembaruan tampilan tanpa APK baru
  // ------------------------------------------------------------------
  Asli.sehat = function () { if (Asli.aktif()) A().versiSehat().catch(() => {}); };
  Asli.cekPembaruan = async function (paksa) {
    if (!Asli.aktif() || navigator.onLine === false) return null;
    const terakhir = Number(simpan('cashku_cek_ui') || 0);
    if (!paksa && Date.now() - terakhir < 6 * 3600e3) return null;
    simpan('cashku_cek_ui', String(Date.now()));
    let info;
    try { info = await A().info(); } catch (e) { return null; }
    if (!info.urlPembaruan) return null;
    let aset;
    try {
      const res = await fetch(info.urlPembaruan + 'aset.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return null;
      aset = await res.json();
    } catch (e) { return null; }
    if (!aset || !aset.versi || !Array.isArray(aset.berkas) || !Asli.lebihBaru(aset.versi, U.VERSI) || aset.versi === info.gagalVersi) return { terbaru: true, versi: U.VERSI };
    if (simpan('cashku_ui_siap') === aset.versi) return { siap: aset.versi };
    try {
      const r = await A().unduhVersi({ url: info.urlPembaruan, versi: aset.versi, berkas: aset.berkas });
      await A().pakaiVersi({ path: r.path, versi: aset.versi, sekarang: false });
      simpan('cashku_ui_siap', aset.versi);
      if (g.Chat) {
        await g.Chat.tambah({ kind: 'pilihan', data: { teks: 'Tampilan CashKu **' + aset.versi + '** sudah diunduh ✨', sub: 'Dipakai otomatis saat aplikasi dibuka lagi.',
          chips: [{ label: 'Pakai sekarang', aksi: 'pakaiVersi', nilai: { path: r.path, versi: aset.versi }, gaya: 'acc' }] } });
      }
      return { siap: aset.versi };
    } catch (e) { console.warn('Pembaruan tampilan gagal', e); return { gagal: true }; }
  };
  Asli.pakaiSekarang = async function (v) {
    try { if (g.Sync && S.outbox.size && navigator.onLine !== false) await Promise.race([g.Sync.sekarang(), new Promise((r) => setTimeout(r, 4000))]); } catch (e) { /* tetap lanjut */ }
    return A().pakaiVersi({ path: v.path, versi: v.versi, sekarang: true });
  };

  // ------------------------------------------------------------------
  // Mulai (dipanggil setelah masuk)
  // ------------------------------------------------------------------
  let mulai = false;
  Asli.mulai = function () {
    if (!Asli.aktif() || mulai) return;
    mulai = true;
    document.documentElement.classList.add('apk');
    S.on('master', () => Asli.sinkronAlarm());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { Asli.prosesAksi(); Asli.sinkronAlarm(); Asli.cekPembaruan(); } });
    Asli.sinkronAlarm(true);
    setTimeout(() => Asli.prosesAksi(), 800);
    setTimeout(() => Asli.cekPembaruan(), 4000);
    setTimeout(Asli.tawarkanIzin, 2500);
  };
  /** Pertama kali di APK: ajak mengaktifkan izin alarm bila ada yang belum */
  Asli.tawarkanIzin = async function () {
    if (simpan('cashku_izin_ditawarkan') === '1' || !g.Chat) return;
    let z;
    try { z = await A().cekIzin(); } catch (e) { return; }
    simpan('cashku_izin_ditawarkan', '1');
    if (z.notifikasi && z.alarmTepat && z.layarPenuh && z.baterai) return;
    await g.Chat.tambah({ kind: 'pilihan', data: { teks: '📱 Supaya alarm tagihan tetap berbunyi walau HP terkunci atau offline, aktifkan beberapa izin dulu ya.',
      chips: [{ label: 'Buka panduan izin', aksi: 'buka', nilai: { halaman: 'izin-alarm' }, gaya: 'acc' }] } });
  };

  // ------------------------------------------------------------------
  // Halaman "Izin alarm Android"
  // ------------------------------------------------------------------
  const TIPS = [
    [/xiaomi|redmi|poco/i, 'Xiaomi / Redmi / POCO', ['Pengaturan → Aplikasi → Kelola aplikasi → CashKu → <b>Mulai otomatis</b>: aktifkan.', 'Di halaman yang sama → <b>Penghemat baterai</b> → pilih <b>Tanpa batasan</b>.', 'Buka daftar aplikasi terbaru, tekan lama CashKu → ketuk ikon <b>gembok</b> agar tidak ditutup paksa.']],
    [/oppo|realme|oneplus/i, 'OPPO / realme / OnePlus', ['Pengaturan → Aplikasi → CashKu → <b>Penggunaan baterai</b> → aktifkan <b>Izinkan aktivitas latar belakang</b> dan <b>Izinkan mulai otomatis</b>.', 'Kunci CashKu di daftar aplikasi terbaru (tekan lama → Kunci).']],
    [/vivo|iqoo/i, 'vivo / iQOO', ['Pengaturan → Baterai → <b>Konsumsi daya latar belakang tinggi</b> → izinkan CashKu.', 'i Manager → Manajemen aplikasi → <b>Mulai otomatis</b> → aktifkan CashKu.']],
    [/samsung/i, 'Samsung', ['Pengaturan → Aplikasi → CashKu → Baterai → pilih <b>Tidak dibatasi</b>.', 'Pengaturan → Perawatan perangkat → Baterai → Batas penggunaan latar → pastikan CashKu <b>tidak</b> ada di <b>Aplikasi tidur</b>.']],
    [/huawei|honor/i, 'Huawei / Honor', ['Pengaturan → Baterai → Peluncuran aplikasi → CashKu → <b>Kelola secara manual</b>, aktifkan semua.']],
    [/./, 'HP Android lain', ['Pengaturan → Aplikasi → CashKu → Baterai → pilih <b>Tidak dibatasi</b> / <b>Tanpa batasan</b>.']]
  ];
  function barisIzin(ok, judul, ket, jenis) {
    return '<div class="row izin-row" style="gap:12px;align-items:flex-start;padding:10px 0"><span class="ico-c sm" style="' + (ok ? 'background:var(--info-bg);color:var(--income)' : 'background:var(--danger-bg);color:var(--expense)') + '">' + ic(ok ? 'check' : 'triangle-alert', 'ic-sm') + '</span>' +
      '<span class="grow"><b style="font-weight:600;display:block">' + judul + '</b><span class="small muted">' + ket + '</span></span>' +
      (ok ? '<span class="small t-in" style="padding-top:4px">Aktif</span>' : '<button class="btn sm" data-izin="' + jenis + '">Atur</button>') + '</div>';
  }
  async function gambarIzin(el) {
    const body = el.querySelector('[data-body]');
    if (!Asli.aktif()) { body.innerHTML = '<div class="card"><p class="muted" style="margin:0">Halaman ini khusus aplikasi Android CashKu.</p></div>'; return; }
    let z = {}, info = {};
    try { z = await A().cekIzin(); info = await A().info(); } catch (e) { /* tetap tampil */ }
    const tip = TIPS.find((t) => t[0].test(z.merek || ''));
    body.innerHTML =
      '<div class="card"><p class="small muted" style="margin:0 0 4px">Supaya alarm tagihan berbunyi tepat waktu walau HP terkunci, offline, atau baru dinyalakan ulang:</p>' +
      barisIzin(z.notifikasi, 'Notifikasi', 'Untuk menampilkan alarm & pengingat.', 'notifikasi') +
      barisIzin(z.alarmTepat, 'Alarm tepat waktu', 'Agar berbunyi tepat di menitnya.', 'alarmTepat') +
      barisIzin(z.layarPenuh, 'Tampil layar penuh', 'Layar alarm muncul di atas layar kunci.', 'layarPenuh') +
      barisIzin(z.baterai, 'Tanpa batasan baterai', 'Agar Android tidak menghentikan alarm.', 'baterai') + '</div>' +
      '<div class="sec">Tes</div><div class="card"><p class="small muted" style="margin:0 0 10px">Ketuk tes, lalu <b>kunci layar HP</b>. Alarm berbunyi 10 detik lagi.</p>' +
      '<button class="btn block" data-tes>' + ic('bell-ring', 'ic-sm') + ' Tes alarm sekarang</button>' +
      '<button class="list-row" data-nada style="margin-top:8px"><span class="ico-c sm">' + ic('music', 'ic-sm') + '</span><span class="grow"><b style="font-weight:500;display:block">Nada alarm</b><span class="small muted" data-nama-nada>' + U.esc(z.nada || 'Bawaan') + '</span></span>' + ic('chevron-right', 'ic-sm') + '</button></div>' +
      '<div class="sec">Tips ' + U.esc(tip ? tip[1] : 'HP Android') + '</div><div class="card"><ol style="margin:0;padding-left:20px;line-height:22px;font-size:14px">' + (tip ? tip[2] : []).map((t) => '<li style="margin-bottom:6px">' + t + '</li>').join('') + '</ol>' +
      '<button class="btn sm soft" data-izin="autostart" style="margin-top:6px">Buka pengaturan mulai otomatis</button></div>' +
      '<div class="sec">Aplikasi</div><div class="card"><div class="small muted">APK ' + U.esc(info.versiApk || '-') + ' (build ' + U.esc(String(info.buildApk || '-')) + ') · tampilan ' + U.esc(U.VERSI) + '</div>' +
      '<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn sm soft" data-cek-ui>' + ic('refresh-cw', 'ic-sm') + ' Cek pembaruan tampilan</button>' +
      (info.repo ? '<button class="btn sm soft" data-apk-baru>' + ic('download', 'ic-sm') + ' Unduh APK terbaru</button>' : '') + '</div></div>';
    body.querySelectorAll('[data-izin]').forEach((b) => {
      b.onclick = async () => {
        const j = b.dataset.izin;
        if (j === 'notifikasi') { const r = await A().mintaNotifikasi(); if (!r.notifikasi) await A().bukaIzin({ jenis: 'notifikasi' }); }
        else await A().bukaIzin({ jenis: j });
      };
    });
    body.querySelector('[data-tes]').onclick = async () => {
      await A().tes({ detik: 10 });
      UI.Toast.show('Alarm tes berbunyi 10 detik lagi ⏰', 'info', 'Kunci layar HP sekarang untuk mencoba layar alarm.');
    };
    body.querySelector('[data-nada]').onclick = async () => {
      try { const r = await A().pilihNada(); body.querySelector('[data-nama-nada]').textContent = r.nada || 'Bawaan'; } catch (e) { /* dibatalkan */ }
    };
    body.querySelector('[data-cek-ui]').onclick = async (e) => {
      UI.tombolSibuk(e.currentTarget, true);
      const r = await Asli.cekPembaruan(true);
      UI.tombolSibuk(e.currentTarget, false);
      if (!r) UI.Toast.show('Belum bisa memeriksa', 'warn', 'Pastikan HP tersambung internet.');
      else if (r.terbaru) UI.Toast.show('Tampilan sudah versi terbaru', 'success');
      else if (r.siap) UI.Toast.show('Versi ' + r.siap + ' siap', 'success', 'Dipakai saat aplikasi dibuka lagi.');
      else UI.Toast.show('Pembaruan gagal diunduh', 'error', 'Coba lagi nanti.');
    };
    const ab = body.querySelector('[data-apk-baru]');
    if (ab) ab.onclick = () => { g.open('https://github.com/' + info.repo + '/releases/latest', '_blank'); };
  }
  if (g.UI && g.UI.Router) {
    g.UI.Router.daftar('izin-alarm', {
      template() { return g.UI.header({ title: 'Alarm Android', sub: 'Izin, tes, dan nada alarm' }) + '<div class="page-body" data-body style="padding-bottom:40px"></div>'; },
      show(el) { gambarIzin(el); },
      segarkan() { /* status izin diperiksa saat halaman dibuka / kembali dari pengaturan */ }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && g.UI.Router.saatIni === 'izin-alarm') { const el = g.UI.Router.root && g.UI.Router.root.querySelector('.page[data-page="izin-alarm"]'); if (el) gambarIzin(el); }
    });
  }

  g.Asli = Asli;
})(window);
