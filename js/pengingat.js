/* CashKu — pengingat & alarm
 * - Jadwal: hitung waktu bunyi berikutnya (sama persis dengan jadwalBerikutnya_ di Kode.gs)
 * - Alarm : layar alarm dengan bunyi berulang & getar saat aplikasi terbuka
 * - Notif : notifikasi HP lewat Web Push (berbunyi walau aplikasi ditutup; diulang tiap menit sampai HP dibuka)
 * - Kalender: berkas .ics agar pengingat juga tersimpan di aplikasi Kalender HP */
(function (g) {
  'use strict';
  const S = g.S, U = g.U, UI = g.UI;
  const ZONA = { 'Asia/Jakarta': 7, 'Asia/Pontianak': 7, 'Asia/Makassar': 8, 'Asia/Jayapura': 9 };
  const HARI_PANJANG = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const p2 = (n) => (n < 10 ? '0' : '') + n;

  // =============================================================
  // JADWAL
  // =============================================================
  const Jadwal = {
    offset() { const z = (S.master && S.master.pengaturan && S.master.pengaturan.zona_waktu) || 'Asia/Makassar'; return ZONA[z] != null ? ZONA[z] : 8; },
    /** Waktu bunyi berikutnya (ms) setelah `sejak` (ms) atau null bila tidak ada lagi */
    berikutnya(p, sejak, off) {
      off = off == null ? Jadwal.offset() : off;
      const hm = String(p.jam || '07:00').split(':'), hh = Number(hm[0]) || 0, mm = Number(hm[1]) || 0;
      const geser = off * 3600000;
      const L = new Date(sejak + geser);
      const Ly = L.getUTCFullYear(), Lm = L.getUTCMonth() + 1, Ld = L.getUTCDate();
      const cek = (y, m, d) => { const t = Date.UTC(y, m - 1, d, hh, mm) - geser; return t > sejak ? t : null; };
      const hariKe = (i) => { const x = new Date(Date.UTC(Ly, Lm - 1, Ld + i)); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate(), dow: ((x.getUTCDay() + 6) % 7) + 1 }; };
      const jmlHari = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
      let a, x, t;
      switch (p.pola) {
        case 'SEKALI':
          a = String(p.tanggal || '').split('-').map(Number);
          return a.length === 3 && a[0] ? cek(a[0], a[1], a[2]) : null;
        case 'HARIAN':
          for (let i = 0; i < 3; i++) { x = hariKe(i); t = cek(x.y, x.m, x.d); if (t) return t; }
          return null;
        case 'MINGGUAN': {
          const hs = String(p.hari_minggu || '').split(',').map(Number).filter((n) => n >= 1 && n <= 7);
          if (!hs.length) return null;
          for (let i = 0; i < 15; i++) { x = hariKe(i); if (hs.indexOf(x.dow) < 0) continue; t = cek(x.y, x.m, x.d); if (t) return t; }
          return null;
        }
        case 'BULANAN':
          for (let i = 0; i < 14; i++) {
            let y = Ly, m = Lm + i;
            while (m > 12) { m -= 12; y++; }
            const n = jmlHari(y, m);
            const hb = String(p.hari_bulan).toUpperCase() === 'AKHIR' ? n : Math.min(Number(p.hari_bulan) || 1, n);
            t = cek(y, m, hb); if (t) return t;
          }
          return null;
        case 'TAHUNAN': {
          a = String(p.tanggal || '').split('-').map(Number);
          const mo = a.length === 3 ? a[1] : a[0], da = a.length === 3 ? a[2] : a[1];
          if (!mo || !da) return null;
          for (let i = 0; i < 3; i++) { t = cek(Ly + i, mo, Math.min(da, jmlHari(Ly + i, mo))); if (t) return t; }
          return null;
        }
      }
      return null;
    },
    /** Bagian tanggal/jam lokal (zona keluarga) dari ms */
    lokal(ms, off) {
      off = off == null ? Jadwal.offset() : off;
      const d = new Date(ms + off * 3600000);
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), hh: d.getUTCHours(), mm: d.getUTCMinutes(), dow: ((d.getUTCDay() + 6) % 7) + 1 };
    },
    jamLabel(j) { return String(j || '').replace(':', '.'); },
    /** "Setiap tanggal 20 · 09.00" */
    label(p) {
      const jam = Jadwal.jamLabel(p.jam);
      switch (p.pola) {
        case 'HARIAN': return 'Setiap hari · ' + jam;
        case 'MINGGUAN': return 'Setiap ' + String(p.hari_minggu).split(',').map((n) => HARI_PANJANG[Number(n)]).filter(Boolean).join(' & ') + ' · ' + jam;
        case 'BULANAN': return (String(p.hari_bulan).toUpperCase() === 'AKHIR' ? 'Setiap akhir bulan' : 'Setiap tanggal ' + p.hari_bulan) + ' · ' + jam;
        case 'TAHUNAN': { const a = String(p.tanggal).split('-').map(Number); const mo = a.length === 3 ? a[1] : a[0], da = a.length === 3 ? a[2] : a[1]; return 'Setiap ' + da + ' ' + U.BULAN[mo - 1] + ' · ' + jam; }
        default: return p.tanggal ? U.tglPanjang(p.tanggal) + ' · ' + jam : jam;
      }
    },
    /** "Jumat, 20 Nov 2026 · 09.00" */
    waktuLabel(ms) {
      const l = Jadwal.lokal(ms);
      return HARI_PANJANG[l.dow] + ', ' + l.d + ' ' + U.BLN[l.m - 1] + ' ' + l.y + ' · ' + p2(l.hh) + '.' + p2(l.mm);
    },
    /** Tanggal (YYYY-MM-DD) & jam (HH:mm) lokal untuk ms tertentu */
    dariMs(ms) { const l = Jadwal.lokal(ms); return { tanggal: l.y + '-' + p2(l.m) + '-' + p2(l.d), jam: p2(l.hh) + ':' + p2(l.mm) }; },
    hariIniLokal() { return Jadwal.dariMs(Date.now()).tanggal; }
  };

  // =============================================================
  // ALARM DI LAYAR (aplikasi terbuka)
  // =============================================================
  let audio = null;
  function ctxAudio() {
    try { audio = audio || new (g.AudioContext || g.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) { audio = null; }
    return audio;
  }
  // Izin bunyi browser: buka "kunci" audio pada sentuhan pertama
  ['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, () => ctxAudio(), { once: true, passive: true }));

  const Alarm = {
    sudah: new Set(), timer: null, bunyiTimer: null, el: null, berhenti: 0,
    mulai() {
      if (Alarm.timer) return;
      Alarm.timer = setInterval(Alarm.cek, 15000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(Alarm.cek, 400); });
      if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.type === 'alarm') Alarm.cek(true); });
      S.on('master', () => setTimeout(Alarm.cek, 300));
      setTimeout(Alarm.cek, 1200);
      // Dibuka dari notifikasi (…#/chat?alarm=ID)
      if (/[?&]alarm=/.test(location.hash)) setTimeout(() => Alarm.cek(false), 800);
    },
    milikSaya() { return (S.master.pengingat || []).filter((p) => p.id_pengguna === (S.saya && S.saya.id) && p.status === 'AKTIF'); },
    cek(dariPush) {
      if (!S.saya) return;
      const now = Date.now();
      const jatuh = Alarm.milikSaya().filter((p) => p.berikutnya && p.berikutnya <= now + 1000 && now - p.berikutnya < 6 * 3600e3 && !Alarm.sudah.has(p.id_pengingat + ':' + p.berikutnya));
      if (!jatuh.length) return;
      // Bunyi panjang hanya bila baru jatuh tempo dan aplikasi sedang dilihat; bila sudah berbunyi lewat notifikasi, cukup tampilkan
      const baru = jatuh.some((p) => now - p.berikutnya < 90e3) || dariPush === true;
      Alarm.tampil(jatuh, baru && document.visibilityState === 'visible');
    },
    async tampil(list, bunyi) {
      list.forEach((p) => Alarm.sudah.add(p.id_pengingat + ':' + p.berikutnya));
      Alarm.tutup(true);
      const p0 = list[0];
      const el = U.el('<div class="alarm-layar" role="alertdialog" aria-live="assertive"><div class="alarm-kartu">' +
        '<div class="alarm-ikon">⏰</div><div class="alarm-sub">' + (g.S && g.S.saya && g.S.saya.panggilan ? U.esc(g.S.sapa()) + ', waktunya' : 'Pengingat') + ' · ' + U.esc(Jadwal.waktuLabel(p0.berikutnya).split(' · ')[1] || '') + '</div>' +
        list.map((p) => '<div class="alarm-judul">' + U.esc(p.judul) + '</div>').join('') +
        '<div class="alarm-ket">' + U.esc(Jadwal.label(p0)) + '</div>' +
        '<div class="alarm-tombol"><button class="btn block lg" data-selesai>Selesai</button><button class="btn block soft" data-tunda>Tunda ' + Alarm.menitTunda() + ' menit</button></div></div></div>');
      document.body.appendChild(el);
      Alarm.el = el;
      el.querySelector('[data-selesai]').onclick = () => Alarm.tutup();
      el.querySelector('[data-tunda]').onclick = async () => {
        Alarm.tutup();
        const sampai = Date.now() + Alarm.menitTunda() * 60000;
        for (const p of list) await S.ubahMaster('pengingat.tunda', { id_pengingat: p.id_pengingat, sampai });
        UI.Toast.show('Aku ingatkan lagi ' + Alarm.menitTunda() + ' menit lagi ⏰', 'info');
      };
      // Sudah terlihat → hentikan bunyi di HP lain/berikutnya dan majukan jadwal
      for (const p of list) await S.ubahMaster('pengingat.ack', { id_pengingat: p.id_pengingat, berikutnya: p.berikutnya });
      if (bunyi) Alarm.bunyikan();
    },
    menitTunda() { return Number((S.master.aturan || {}).alarm_tunda_menit) || 10; },
    bunyikan() {
      const a = ctxAudio();
      Alarm.berhenti = Date.now() + 60000;               // berbunyi maksimal 1 menit
      const putar = () => {
        if (!Alarm.el || Date.now() > Alarm.berhenti) return Alarm.diam();
        if (a) {
          [0, 0.18, 0.36, 0.7, 0.88, 1.06].forEach((dt, i) => {
            const o = a.createOscillator(), gn = a.createGain();
            o.type = 'square'; o.frequency.value = i % 3 === 2 ? 1320 : 990;
            gn.gain.setValueAtTime(0.0001, a.currentTime + dt);
            gn.gain.exponentialRampToValueAtTime(0.25, a.currentTime + dt + 0.01);
            gn.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dt + 0.14);
            o.connect(gn); gn.connect(a.destination); o.start(a.currentTime + dt); o.stop(a.currentTime + dt + 0.16);
          });
        }
        if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 400]);
      };
      putar();
      Alarm.bunyiTimer = setInterval(putar, 1800);
    },
    diam() { clearInterval(Alarm.bunyiTimer); Alarm.bunyiTimer = null; if (navigator.vibrate) navigator.vibrate(0); },
    tutup(senyap) { Alarm.diam(); if (Alarm.el) { Alarm.el.remove(); Alarm.el = null; } if (!senyap && /[?&]alarm=/.test(location.hash)) history.replaceState(null, '', '#/chat'); }
  };

  // =============================================================
  // NOTIFIKASI HP (Web Push)
  // =============================================================
  const b64ke = (s) => { const pad = '='.repeat((4 - (s.length % 4)) % 4); const b = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const terpasang = () => (g.matchMedia && g.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const apk = () => !!(g.Asli && g.Asli.aktif());
  const Notif = {
    didukung() { return 'serviceWorker' in navigator && 'PushManager' in g && 'Notification' in g; },
    status() {
      if (apk()) return 'aktif';                 // APK Android: alarm asli (bukan Web Push)
      if (!Notif.didukung()) return isIOS && !terpasang() ? 'ios-pasang' : 'tidak';
      if (Notification.permission === 'denied') return 'ditolak';
      try { if (Notification.permission === 'granted' && localStorage.getItem('cashku_push') === (S.saya && S.saya.id)) return 'aktif'; } catch (e) {}
      return 'belum';
    },
    pesanStatus() {
      if (apk()) return 'Alarm Android aktif: berbunyi walau HP terkunci atau offline 🔔';
      return ({ aktif: 'Alarm & notifikasi aktif di HP ini 🔔', belum: 'Notifikasi belum diaktifkan di HP ini.', ditolak: 'Notifikasi diblokir. Buka pengaturan browser → Situs → Notifikasi, lalu izinkan CashKu.',
        'ios-pasang': 'Di iPhone/iPad, pasang CashKu ke Layar Utama dulu (Bagikan → Tambah ke Layar Utama), lalu buka dari ikonnya untuk mengaktifkan alarm.',
        tidak: 'Browser ini belum mendukung notifikasi. Pakai Chrome di Android, atau pasang CashKu ke Layar Utama di iPhone.' })[Notif.status()];
    },
    /** Harus dipanggil dari ketukan pengguna */
    async aktifkan() {
      if (apk()) { UI.Router.go('izin-alarm'); return { ok: true, pesan: 'Atur izin alarm Android di halaman ini 📱' }; }
      const st = Notif.status();
      if (st === 'tidak' || st === 'ios-pasang' || st === 'ditolak') return { ok: false, pesan: Notif.pesanStatus() };
      if (navigator.onLine === false) return { ok: false, pesan: 'Perlu internet untuk mengaktifkan notifikasi.' };
      const izin = await Notification.requestPermission();
      if (izin !== 'granted') return { ok: false, pesan: 'Izin notifikasi tidak diberikan. Alarm tetap muncul saat CashKu dibuka.' };
      const k = await g.API.api('pushKunci', {}, { token: S.token });
      if (!k.success) return { ok: false, pesan: k.message || 'Server belum siap untuk notifikasi.' };
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      const kunci = b64ke(k.data.kunci);
      if (sub && sub.options && sub.options.applicationServerKey) {
        const lama = new Uint8Array(sub.options.applicationServerKey);
        if (lama.length !== kunci.length || lama.some((v, i) => v !== kunci[i])) { await sub.unsubscribe(); sub = null; }
      }
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: kunci });
      const r = await g.API.api('pushDaftar', { langganan: sub.toJSON(), perangkat: navigator.userAgent.slice(0, 120), asal: location.origin }, { token: S.token });
      if (!r.success) return { ok: false, pesan: r.message || 'Gagal mendaftarkan HP ini.' };
      try { localStorage.setItem('cashku_push', S.saya.id); } catch (e) {}
      return { ok: true, pesan: 'Alarm aktif! HP ini akan berbunyi saat pengingat tiba, walau CashKu ditutup 🔔' };
    },
    async uji() {
      if (apk()) { await g.Capacitor.Plugins.AlarmCashKu.tes({ detik: 10 }); return { ok: true, pesan: 'Alarm tes berbunyi 10 detik lagi ⏰ Kunci layar HP untuk mencoba layar alarm.' }; }
      const r = await g.API.api('pushUji', {}, { token: S.token });
      if (!r.success) return { ok: false, pesan: r.message || 'Gagal mengirim tes.' };
      if (!r.data.perangkat) return { ok: false, pesan: 'Belum ada HP yang terdaftar untuk notifikasi. Ketuk "Aktifkan alarm" dulu.' };
      return { ok: true, pesan: 'Tes terkirim ke ' + r.data.perangkat + ' perangkat. Sebentar lagi HP berbunyi 🔔' };
    }
  };

  // =============================================================
  // KALENDER HP (.ics) — cadangan yang tetap berbunyi walau tanpa internet
  // =============================================================
  function ics(p) {
    const st = p.berikutnya || Jadwal.berikutnya(p, Date.now());
    if (!st) return null;
    const l = Jadwal.lokal(st), e = Jadwal.lokal(st + 15 * 60000);
    const f = (x) => x.y + p2(x.m) + p2(x.d) + 'T' + p2(x.hh) + p2(x.mm) + '00';
    const HARI_ICS = ['', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
    const rrule = ({ HARIAN: 'FREQ=DAILY', MINGGUAN: 'FREQ=WEEKLY;BYDAY=' + String(p.hari_minggu).split(',').map((n) => HARI_ICS[Number(n)]).join(','),
      BULANAN: 'FREQ=MONTHLY;BYMONTHDAY=' + (String(p.hari_bulan).toUpperCase() === 'AKHIR' ? '-1' : p.hari_bulan), TAHUNAN: 'FREQ=YEARLY' })[p.pola];
    const esc = (s) => String(s).replace(/[\\,;]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CashKu//Pengingat//ID', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      'UID:' + p.id_pengingat + '@cashku', 'DTSTAMP:' + now, 'DTSTART:' + f(l), 'DTEND:' + f(e), 'SUMMARY:⏰ ' + esc(p.judul),
      'DESCRIPTION:' + esc('Pengingat dari CashKu'), rrule ? 'RRULE:' + rrule : '',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(p.judul), 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  }
  function unduhIcs(p) {
    const isi = ics(p);
    if (!isi) return false;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([isi], { type: 'text/calendar;charset=utf-8' }));
    a.download = 'pengingat-' + String(p.judul).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) + '.ics';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    return true;
  }

  g.Pengingat = { Jadwal, Alarm, Notif, ics, unduhIcs };
})(window);
