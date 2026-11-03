/* CashKu — komponen tampilan: ikon, toast, bottom sheet, router, tema */
(function (g) {
  'use strict';
  const U = g.U;

  // ---------- Ikon (subset Lucide di js/icons.js) ----------
  function ic(name, cls) {
    const b = (g.ICONS || {})[name];
    if (!b) { if (g.console) console.warn('Ikon hilang:', name); return ''; }
    return '<svg class="ic ' + (cls || '') + '" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + b + '</svg>';
  }
  const LOGO = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="15" y="20" width="34" height="23" rx="4.5" fill="none" stroke="#008069" stroke-width="3.6"/><path d="M15 27h34" stroke="#008069" stroke-width="3.6"/><circle cx="41.5" cy="35.5" r="3" fill="#25D366"/></svg>';
  const LOGO_BESAR = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 10h40a8 8 0 0 1 8 8v22a8 8 0 0 1-8 8H27l-11 9a1.2 1.2 0 0 1-2-1v-8h-2a8 8 0 0 1-8-8V18a8 8 0 0 1 8-8z" fill="#E7F6F1"/><rect x="15" y="18" width="34" height="23" rx="4.5" fill="none" stroke="#008069" stroke-width="3.6"/><path d="M15 25h34" stroke="#008069" stroke-width="3.6"/><circle cx="41.5" cy="33.5" r="3" fill="#25D366"/></svg>';

  // ---------- Toast ----------
  const Toast = {
    show(judul, tipe, sub, ms) {
      let w = U.$('.toast-wrap');
      if (!w) { w = U.el('<div class="toast-wrap" role="status" aria-live="polite"></div>'); document.body.appendChild(w); }
      const ikon = { error: 'x', warn: 'triangle-alert', info: 'info' }[tipe] || 'check';
      const t = U.el('<div class="toast ' + (tipe || '') + '"><span class="tic">' + ic(ikon, 'ic-sm') + '</span><div class="grow"><b>' + U.esc(judul) + '</b>' + (sub ? '<small>' + U.esc(sub) + '</small>' : '') + '</div><button class="hbtn" aria-label="Tutup" style="width:32px;height:32px">' + ic('x', 'ic-sm') + '</button></div>');
      t.querySelector('button').onclick = () => t.remove();
      w.appendChild(t);
      setTimeout(() => t.remove(), ms || (tipe === 'error' ? 5000 : 2800));
    }
  };

  // ---------- Bottom sheet ----------
  const Sheet = {
    stack: [],
    open(opt) {
      const scrim = U.el('<div class="scrim"></div>');
      const sh = U.el('<div class="sheet" role="dialog" aria-modal="true"><div class="handle"></div>' +
        (opt.title ? '<div class="sheet-head"><div class="grow"><h2>' + U.esc(opt.title) + '</h2>' + (opt.sub ? '<div class="muted" style="margin-top:2px">' + U.esc(opt.sub) + '</div>' : '') + '</div><button class="x" data-x aria-label="Tutup">' + ic('x') + '</button></div>' : '') +
        '<div class="sheet-body"></div></div>');
      const body = sh.querySelector('.sheet-body');
      if (typeof opt.html === 'string') body.innerHTML = opt.html; else if (opt.html) body.appendChild(opt.html);
      document.body.appendChild(scrim); document.body.appendChild(sh);
      requestAnimationFrame(() => { scrim.classList.add('on'); sh.classList.add('on'); });
      const api = {
        el: sh, body,
        close(val) {
          if (api._closed) return; api._closed = true;
          scrim.classList.remove('on'); sh.classList.remove('on');
          setTimeout(() => { scrim.remove(); sh.remove(); }, 250);
          Sheet.stack = Sheet.stack.filter((x) => x !== api);
          if (opt.onClose) opt.onClose(val);
        }
      };
      scrim.onclick = () => api.close();
      const x = sh.querySelector('[data-x]'); if (x) x.onclick = () => api.close();
      // Geser ke bawah pada pegangan untuk menutup
      let y0 = null;
      sh.querySelector('.handle').addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
      sh.addEventListener('touchend', (e) => { if (y0 != null && e.changedTouches[0].clientY - y0 > 80) api.close(); y0 = null; });
      Sheet.stack.push(api);
      if (opt.onMount) opt.onMount(sh, api);
      return api;
    },
    tutupSemua() { Sheet.stack.slice().forEach((s) => s.close()); },
    konfirmasi(opt) {
      return new Promise((resolve) => {
        const s = Sheet.open({
          title: opt.judul, html: '<div class="muted" style="font-size:15px;line-height:22px">' + (opt.isiHtml || U.esc(opt.isi || '')) + '</div><div class="sheet-foot"><button class="btn block lg ' + (opt.bahaya ? 'danger' : '') + '" data-ok>' + U.esc(opt.ok || 'Ya') + '</button><button class="btn block ghost" data-no>' + U.esc(opt.batal || 'Batal') + '</button></div>',
          onClose: (v) => resolve(!!v)
        });
        s.el.querySelector('[data-ok]').onclick = () => s.close(true);
        s.el.querySelector('[data-no]').onclick = () => s.close(false);
      });
    },
    pilih(opt) {
      return new Promise((resolve) => {
        const html = '<div class="opt-list">' + opt.opsi.map((o, i) => '<button class="list-row ' + (o.value === opt.nilai ? 'on' : '') + '" data-i="' + i + '">' +
          (o.ikon ? '<span class="ico-c sm">' + o.ikon + '</span>' : '') + '<span class="grow"><span class="ellip" style="display:block">' + U.esc(o.label) + '</span>' + (o.sub ? '<span class="small muted">' + U.esc(o.sub) + '</span>' : '') + '</span>' +
          (o.value === opt.nilai ? ic('check') : '') + '</button>').join('') + '</div>';
        const s = Sheet.open({ title: opt.judul, html, onClose: (v) => resolve(v === undefined ? null : v) });
        U.$$('[data-i]', s.el).forEach((b) => { b.onclick = () => s.close(opt.opsi[Number(b.dataset.i)].value); });
      });
    }
  };

  // ---------- Router (SPA, halaman tidak dibuang) ----------
  const Pages = {};
  const Router = {
    root: null, saatIni: '', riwayat: [],
    daftar(name, def) { Pages[name] = Object.assign({ auth: true }, def); },
    go(name, param, opt) {
      const h = '#/' + name + (param ? '/' + encodeURIComponent(param) : '');
      if (opt && opt.ganti) { history.replaceState(null, '', h); Router.route(); return; }
      if (location.hash === h) Router.route(); else location.hash = h;
    },
    kembali() {
      if (Router.riwayat.length > 1) history.back(); else Router.go('chat', null, { ganti: true });
    },
    route() {
      const raw = location.hash.replace(/^#\/?/, '');
      let [name, param] = raw.split('/');
      if (!g.S.token) name = 'login';
      else if (!Pages[name] || name === 'login') name = 'chat';
      const def = Pages[name];
      if (def.izin && !def.izin()) { Router.go('chat', null, { ganti: true }); return; }
      Sheet.tutupSemua();
      let el = Router.root.querySelector('.page[data-page="' + name + '"]');
      if (el && el.dataset.rusak) { el.remove(); el = null; }
      if (!el) {
        el = document.createElement('section');
        el.className = 'page' + (def.kelas ? ' ' + def.kelas : '');
        el.dataset.page = name;
        el.innerHTML = def.template();
        Router.root.appendChild(el);
        if (def.init) { try { def.init(el); } catch (err) { Router.gagal(el, err); } }
      }
      U.$$('.page', Router.root).forEach((p) => { p.hidden = p !== el; });
      const sebelum = Router.saatIni;
      Router.saatIni = name;
      if (Router.riwayat[Router.riwayat.length - 2] === name) Router.riwayat.pop(); else Router.riwayat.push(name);
      if (def.show && !el.dataset.rusak) Router.aman(el, () => def.show(el, param ? decodeURIComponent(param) : '', sebelum));
      if (name !== 'chat') window.scrollTo(0, 0);
      el.dataset.kotor = '';
    },
    /** Jalankan render halaman; bila gagal, tampilkan pesan (bukan layar kosong) */
    aman(el, fn) {
      try { const r = fn(); if (r && r.catch) r.catch((err) => Router.gagal(el, err)); } catch (err) { Router.gagal(el, err); }
    },
    gagal(el, err) {
      console.error('Halaman gagal dimuat:', err);
      el.dataset.rusak = '1';
      const body = el.querySelector('[data-body]'), box = body || el;
      if (body) body.innerHTML = ''; else { const old = el.querySelector('.page-err'); if (old) old.remove(); }
      const kartu = U.el('<div class="card page-err" style="margin:16px;text-align:center">' +
        '<p style="margin:0 0 6px;font-weight:600">Halaman ini gagal dimuat</p>' +
        '<p class="small muted" style="margin:0 0 14px">Biasanya karena berkas aplikasi di perangkat ini belum lengkap setelah pembaruan. Data Anda aman.</p>' +
        '<button class="btn block" data-perbaiki>Perbaiki & muat ulang</button>' +
        '<p class="small muted" style="margin:12px 0 0;word-break:break-word;opacity:.7">' + U.esc(String((err && err.message) || err)) + '</p></div>');
      kartu.querySelector('[data-perbaiki]').onclick = () => (g.App && g.App.muatUlangBersih ? g.App.muatUlangBersih() : location.reload());
      box.appendChild(kartu);
    },
    /** Tandai halaman perlu render ulang; yang sedang tampil langsung dirender */
    segarkan() {
      U.$$('.page', Router.root).forEach((p) => {
        const def = Pages[p.dataset.page];
        if (!def || !def.show) return;
        if (!p.hidden) Router.aman(p, () => (def.segarkan ? def.segarkan(p) : def.show(p, '', Router.saatIni)));
        else p.dataset.kotor = '1';
      });
    }
  };

  function header(opt) {
    return '<header class="app-header">' + (opt.back !== false ? '<button class="hbtn" data-back aria-label="Kembali">' + ic('arrow-left', 'ic-lg') + '</button>' : '') +
      '<h1>' + U.esc(opt.title) + (opt.sub !== undefined ? '<div class="sub">' + U.esc(opt.sub) + '</div>' : '') + '</h1>' + (opt.right || '') + '</header>';
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-back]'); if (b) { e.preventDefault(); Router.kembali(); } });

  // ---------- Tema ----------
  const Tema = {
    mode() { try { return localStorage.getItem('cashku:tema') || 'OTOMATIS'; } catch (e) { return 'OTOMATIS'; } },
    setMode(m) { try { localStorage.setItem('cashku:tema', m); } catch (e) {} Tema.terapkan(); },
    gelap() { const m = Tema.mode(); return m === 'GELAP' || (m === 'OTOMATIS' && g.matchMedia && g.matchMedia('(prefers-color-scheme: dark)').matches); },
    terapkan() {
      const root = document.documentElement;
      root.dataset.theme = Tema.gelap() ? 'dark' : 'light';
      const warna = (g.S && g.S._warnaSementara) || (g.S && g.S.master && g.S.master.pengaturan && g.S.master.pengaturan.warna_utama) || (function () { try { return localStorage.getItem('cashku:warna'); } catch (e) { return null; } })() || '#25D366';
      try { localStorage.setItem('cashku:warna', warna); } catch (e) {}
      const t = U.temaDari(warna);
      root.style.setProperty('--accent', t.accent);
      root.style.setProperty('--primary', t.primary);
      root.style.setProperty('--primary-press', t.primaryTekan);
      root.style.setProperty('--on-accent', t.onAccent);
      root.style.setProperty('--tint', Tema.gelap() ? U.alpha(t.accent, 0.16) : U.alpha(t.primary, 0.1));
      root.style.setProperty('--tint-text', Tema.gelap() ? t.accent : t.primary);
      // Gelembung chat milik pengguna ikut warna tema (terang: tint accent; gelap: primary diredupkan)
      root.style.setProperty('--me', t.accent === '#25D366' ? (Tema.gelap() ? '#005C4B' : '#D9FDD3') : Tema.gelap() ? U.campur(t.primary, '#0B141A', 0.35) : U.campur(t.accent, '#FFFFFF', 0.8));
      root.style.setProperty('--focus-ring', U.alpha(t.accent, 0.15));
      const meta = U.$('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', Tema.gelap() ? '#202C33' : t.primary);
    }
  };
  if (g.matchMedia) g.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => Tema.terapkan());

  // ---------- Bantuan form ----------
  function inputRupiah(inp) {
    inp.setAttribute('inputmode', 'numeric');
    inp.addEventListener('input', () => {
      const pos = inp.value.length - inp.selectionStart;
      inp.value = U.fmtInput(U.angkaInput(inp.value));
      const p = Math.max(0, inp.value.length - pos);
      try { inp.setSelectionRange(p, p); } catch (e) {}
    });
  }
  function seg(el, onChange) {
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b || b.disabled) return;
      U.$$('button', el).forEach((x) => x.classList.toggle('on', x === b));
      onChange && onChange(b.dataset.v);
    });
  }
  function segNilai(el) { const b = el.querySelector('button.on'); return b ? b.dataset.v : ''; }
  function ava(o, cls) { return '<span class="ava ' + (cls || '') + '" style="background:' + U.esc((o && o.warna) || '#64748B') + '">' + U.esc(U.inisial(o && o.nama)) + '</span>'; }
  function tombolSibuk(btn, sibuk, teks) {
    if (sibuk) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>' + (teks ? ' ' + U.esc(teks) : ''); }
    else { btn.disabled = false; if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
  }
  function perluOnline() {
    if (navigator.onLine === false) { Toast.show('Perlu koneksi internet', 'warn', 'Pengaturan ini hanya bisa diubah saat online.'); return false; }
    return true;
  }

  g.UI = { ic, LOGO, LOGO_BESAR, Toast, Sheet, Router, Pages, header, Tema, inputRupiah, seg, segNilai, ava, tombolSibuk, perluOnline };
  g.ic = ic;
})(window);
