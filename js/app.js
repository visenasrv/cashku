/* CashKu — awal aplikasi: login, sesi, PWA (pasang & pembaruan), keluar */
(function (g) {
  'use strict';
  const S = g.S, U = g.U, UI = g.UI, ic = g.ic;
  let promptPasang = null;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const terpasang = () => (g.matchMedia && g.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

  // =============================================================
  // LOGIN
  // =============================================================
  UI.Router.daftar('login', {
    auth: false,
    template() {
      return '<div class="login"><div class="login-top"><div class="login-logo">' + UI.LOGO_BESAR + '</div><h1>CashKu</h1><p>Catat keuangan keluarga semudah chatting</p></div>' +
        '<form class="login-sheet" data-form novalidate><div class="handle" style="width:36px;height:4px;border-radius:99px;background:var(--line-2);margin:0 auto"></div>' +
        '<h2>Masuk</h2><p class="muted">Gunakan akun yang dibuat Admin keluarga</p><div data-cfg></div>' +
        '<label class="field"><span class="lbl">Username</span><div class="input-wrap">' + ic('user') + '<input class="input" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" required></div></label>' +
        '<label class="field"><span class="lbl">Password</span><div class="input-wrap">' + ic('lock') + '<input class="input has-end" name="password" type="password" autocomplete="current-password" required><button type="button" class="end" data-eye aria-label="Tampilkan password">' + ic('eye') + '</button></div><div data-err></div></label>' +
        '<button class="btn block lg" style="margin-top:24px" data-masuk>Masuk</button>' +
        '<p class="muted small" style="text-align:center;margin:16px 0 0">Lupa password? <span class="link">Hubungi Admin keluarga</span></p>' +
        '<div class="hr" style="margin:24px 0"></div><button type="button" class="btn block soft" data-pasang>' + ic('download') + 'Pasang CashKu di HP</button>' +
        '<div class="ver">CashKu v' + U.esc(U.VERSI) + '</div></form></div>';
    },
    init(el) {
      const f = el.querySelector('[data-form]');
      el.querySelector('[data-eye]').onclick = () => { const p = f.password; p.type = p.type === 'password' ? 'text' : 'password'; el.querySelector('[data-eye]').innerHTML = ic(p.type === 'password' ? 'eye' : 'eye-off'); };
      el.querySelector('[data-pasang]').onclick = () => App.pasang();
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = el.querySelector('[data-err]'); err.innerHTML = '';
        const username = f.username.value.trim(), password = f.password.value;
        if (!username || !password) { err.innerHTML = errHtml('Username dan password wajib diisi.'); return; }
        if (navigator.onLine === false) { err.innerHTML = errHtml('Masuk pertama kali perlu koneksi internet.'); return; }
        const btn = el.querySelector('[data-masuk]');
        UI.tombolSibuk(btn, true, 'Masuk…');
        const res = await g.API.api('login', { username, password }, { token: '', tries: 2 });
        if (!res.success) {
          UI.tombolSibuk(btn, false);
          f.password.classList.toggle('err', res.data && res.data.code === 'WRONG');
          err.innerHTML = errHtml(res.message || 'Gagal masuk.');
          return;
        }
        await S.terapkanBoot(res.data.token, res.data.boot);
        UI.tombolSibuk(btn, false);
        f.reset();
        await App.mulaiSesi();
        UI.Router.go('chat', null, { ganti: true });
      });
      f.password.addEventListener('input', () => f.password.classList.remove('err'));
    },
    show(el) {
      el.querySelector('[data-pasang]').hidden = terpasang();
      el.querySelector('[data-cfg]').innerHTML = g.API.urlTerisi() ? '' : '<div class="banner amber" style="margin-bottom:16px">' + ic('triangle-alert') + '<span class="small">Alamat server belum diisi. Buka berkas <b>js/config.js</b> dan tempel URL Web App (/exec) dari Apps Script.</span></div>';
    }
  });
  const errHtml = (m) => '<div class="err-msg">' + ic('circle-alert', 'ic-sm') + U.esc(m) + '</div>';

  // =============================================================
  // APP
  // =============================================================
  const App = {
    async boot() {
      UI.Router.root = document.getElementById('app');
      UI.Tema.terapkan();
      let ada = false;
      try { ada = await S.muat(); } catch (e) { console.error(e); }
      UI.Tema.terapkan();
      const segarkan = U.debounce(() => UI.Router.segarkan(), 150);
      S.on('tx', segarkan);
      S.on('master', () => { UI.Tema.terapkan(); segarkan(); });
      // Status sinkron hanya memengaruhi halaman yang menampilkannya
      S.on('sync', (st) => { if ((st === 'ok' || st === 'offline') && ['dashboard', 'pengaturan', 'laporan'].indexOf(UI.Router.saatIni) > -1) segarkan(); });
      addEventListener('hashchange', UI.Router.route);
      document.getElementById('app').innerHTML = '';
      if (ada) await App.mulaiSesi();
      UI.Router.route();
      App.daftarSW();
    },
    async mulaiSesi() {
      g.Sync.mulai();
      g.API.pemanasan();
      g.DB.mintaPermanen();
      UI.Tema.terapkan();
      g.Sync.jadwal(200);
      if (g.Pengingat) g.Pengingat.Alarm.mulai();
      const ruang = await g.DB.perkiraanRuang();
      if (ruang && ruang.quota && ruang.usage / ruang.quota > 0.9) UI.Toast.show('Penyimpanan HP hampir penuh', 'warn', 'Segera online agar data terkirim.');
      if (S.outbox.size > 500) UI.Toast.show(S.outbox.size + ' perubahan belum terkirim', 'warn', 'Segera sambungkan ke internet.');
      if (g.DB.pakaiMemori()) UI.Toast.show('Mode penyimpanan sementara', 'warn', 'Browser ini tidak mengizinkan penyimpanan offline (mode privat?).');
      if (!g.API.urlTerisi()) UI.Toast.show('Alamat server belum diisi', 'error', 'Buka js/config.js lalu tempel URL /exec dari Apps Script. Sampai itu diisi, catatan hanya tersimpan di HP ini.', 15000);
    },

    /** Token kedaluwarsa/dicabut: data di HP tetap aman, minta masuk lagi dengan akun yang sama */
    sesiBerakhir() {
      if (App._minta || !S.saya) return;
      App._minta = true;
      const sh = UI.Sheet.open({ title: 'Masuk lagi', sub: 'Sesi berakhir. Catatan yang belum terkirim tetap aman di HP.', html:
        '<label class="field"><span class="lbl">Username</span><input class="input" value="' + U.esc(S.saya.username || '') + '" disabled></label>' +
        '<label class="field"><span class="lbl">Password</span><input class="input" type="password" data-pw autocomplete="current-password"></label><div data-err></div>' +
        '<div class="sheet-foot"><button class="btn block lg" data-ok>Masuk</button><button class="btn block ghost" data-out>Keluar dari akun ini</button></div>',
        onClose: () => { App._minta = false; } });
      sh.el.querySelector('[data-out]').onclick = () => { sh.close(); App.keluar(true); };
      sh.el.querySelector('[data-ok]').onclick = async (e) => {
        UI.tombolSibuk(e.currentTarget, true);
        const res = await g.API.api('login', { username: S.saya.username, password: sh.el.querySelector('[data-pw]').value }, { token: '' });
        UI.tombolSibuk(e.currentTarget, false);
        if (!res.success) { sh.el.querySelector('[data-err]').innerHTML = errHtml(res.message); return; }
        await S.terapkanBoot(res.data.token, res.data.boot);
        sh.close(); UI.Router.segarkan(); g.Sync.sekarang();
        UI.Toast.show('Berhasil masuk lagi', 'success');
      };
    },

    async keluar(paksa) {
      const n = Array.from(S.outbox.values()).filter((o) => o.type === 'tx.put').length;
      if (n && !paksa) {
        if (navigator.onLine !== false) {
          const ok = await UI.Sheet.konfirmasi({ judul: 'Ada ' + n + ' transaksi belum terkirim', isi: 'Kirim dulu sebelum keluar?', ok: 'Kirim lalu keluar' });
          if (!ok) return;
          await g.Sync.sekarang();
          if (S.outbox.size) { UI.Toast.show('Belum semua terkirim', 'error', 'Coba lagi saat koneksi stabil.'); return; }
        } else {
          const a = await UI.Sheet.konfirmasi({ judul: 'Kamu sedang offline', isi: 'Ada ' + n + ' transaksi yang belum terkirim. Jika keluar sekarang, transaksi itu akan hilang.', ok: 'Tetap keluar', batal: 'Jangan keluar', bahaya: true });
          if (!a) return;
          const b = await UI.Sheet.konfirmasi({ judul: 'Yakin?', isi: n + ' transaksi akan dihapus dari HP ini dan tidak bisa dikembalikan.', ok: 'Ya, hapus & keluar', batal: 'Batal', bahaya: true });
          if (!b) return;
        }
      } else if (!paksa) {
        const ok = await UI.Sheet.konfirmasi({ judul: 'Keluar dari CashKu?', isi: 'Data di HP ini akan dihapus. Semua catatan tetap aman di Google Sheets keluarga.', ok: 'Keluar', bahaya: true });
        if (!ok) return;
      }
      await S.keluar();
      location.hash = '#/login';
      location.reload();
    },

    bisaPasang() { return !terpasang() && (!!promptPasang || isIOS); },
    async pasang() {
      if (terpasang()) return UI.Toast.show('CashKu sudah terpasang', 'info');
      if (promptPasang) {
        promptPasang.prompt();
        const r = await promptPasang.userChoice.catch(() => null);
        if (r && r.outcome === 'accepted') UI.Toast.show('CashKu dipasang', 'success', 'Buka dari layar utama HP.');
        promptPasang = null;
        return;
      }
      const langkah = isIOS
        ? ['Buka situs ini di <b>Safari</b>.', 'Ketuk tombol <b>Bagikan</b> ' + ic('share', 'ic-sm') + ' di bawah layar.', 'Pilih <b>Tambah ke Layar Utama</b>.', 'Ketuk <b>Tambah</b>. Ikon CashKu muncul di layar utama.']
        : ['Buka situs ini di <b>Chrome</b>.', 'Ketuk menu <b>⋮</b> di kanan atas.', 'Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.', 'Ikuti petunjuk sampai ikon CashKu muncul.'];
      UI.Sheet.open({ title: 'Pasang CashKu di HP', html: '<ol style="padding-left:20px;margin:0;line-height:30px;font-size:15px">' + langkah.map((l) => '<li>' + l + '</li>').join('') + '</ol><div class="sheet-foot"><button class="btn block" data-x>Mengerti</button></div>', onMount: (el, s) => { el.querySelector('.sheet-foot [data-x]').onclick = () => s.close(); } });
    },

    daftarSW() {
      if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
      navigator.serviceWorker.register('sw.js').then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) App.tawarkanPembaruan(reg);
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (nw) nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) App.tawarkanPembaruan(reg); });
        });
        setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
      }).catch((e) => console.warn('SW gagal didaftarkan', e));
      // Muat ulang hanya saat pengguna menekan "Muat ulang" (bukan saat pemasangan pertama)
      let muatUlang = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (muatUlang || !App._mauPerbarui) return; muatUlang = true; location.reload(); });
    },
    async muatUlangBersih() {
      try { if (S.outbox.size && navigator.onLine !== false) await Promise.race([g.Sync.sekarang(), new Promise((r) => setTimeout(r, 5000))]); } catch (e) {}
      try { if (g.caches) { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); } } catch (e) {}
      try { const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration()); if (reg) { await reg.update().catch(() => {}); if (reg.waiting) { App._mauPerbarui = true; reg.waiting.postMessage({ type: 'SKIP_WAITING' }); setTimeout(() => location.reload(), 1500); return; } } } catch (e) {}
      location.reload();
    },
    tawarkanPembaruan(reg) {
      if (document.querySelector('.update-bar')) return;
      const bar = U.el('<div class="update-bar" role="status">' + ic('sparkles') + '<span class="grow small"><b>Versi baru tersedia</b></span><button class="btn sm accent">Muat ulang</button></div>');
      bar.querySelector('button').onclick = async (e) => {
        UI.tombolSibuk(e.currentTarget, true);
        // Kirim dulu data yang belum terkirim (data tetap aman di HP walau belum terkirim)
        if (S.outbox.size && navigator.onLine !== false) await Promise.race([g.Sync.sekarang(), new Promise((r) => setTimeout(r, 6000))]);
        App._mauPerbarui = true;
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' }); else location.reload();
      };
      document.body.appendChild(bar);
    }
  };
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptPasang = e; });
  addEventListener('appinstalled', () => { promptPasang = null; });

  g.App = App;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', App.boot); else App.boot();
})(window);
