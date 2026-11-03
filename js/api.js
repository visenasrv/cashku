/* CashKu — klien API: timeout, retry, reqId idempoten, pengukur performa */
(function (g) {
  'use strict';
  const GAS_URL = () => g.CASHKU_CONFIG.GAS_URL;
  const BACA = /^(ping|bootstrap|sinkronTarik|laporanData)$/;

  const Perf = {
    rows: [],
    add(action, total, server) {
      this.rows.push({ action, total, server: server == null ? null : server, net: server == null ? null : total - server, at: Date.now() });
      if (this.rows.length > 200) this.rows.shift();
    },
    table() { console.table(this.rows.slice(-30)); }
  };

  async function apiOnce(action, data, timeout, reqId, token) {
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeout), t0 = performance.now();
    try {
      const res = await fetch(GAS_URL(), {
        method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },     // hindari CORS preflight
        body: JSON.stringify({ action, token: token || '', reqId, data: data || {} })
      });
      const text = await res.text();
      try {
        const j = JSON.parse(text);
        Perf.add(action, Math.round(performance.now() - t0), j.ms);
        return j;
      } catch (e) {
        return { success: false, network: true, retryable: res.status >= 500 || res.status === 429, message: 'Server membalas HTTP ' + res.status + ' (bukan JSON). Periksa URL di js/config.js.' };
      }
    } catch (err) {
      return { success: false, network: true, retryable: true, message: err.name === 'AbortError' ? 'Server terlalu lama merespons.' : 'Koneksi terputus.' };
    } finally { clearTimeout(timer); }
  }

  function tungguOnline(ms) {
    return new Promise((r) => {
      if (navigator.onLine !== false) return r();
      const t = setTimeout(done, ms);
      function done() { clearTimeout(t); removeEventListener('online', done); r(); }
      addEventListener('online', done);
    });
  }

  /** opt: { token, reqId, tries } */
  async function api(action, data, opt) {
    opt = opt || {};
    const baca = BACA.test(action);
    const reqId = baca ? '' : (opt.reqId || g.U.uuid());
    const tries = opt.tries || (baca ? 3 : 2);
    let res;
    for (let i = 0; i < tries; i++) {
      if (i) { await new Promise((r) => setTimeout(r, 1200 * i)); if (navigator.onLine === false) await tungguOnline(15000); }
      res = await apiOnce(action, data, baca ? (i ? 40000 : 25000) : 60000, reqId, opt.token !== undefined ? opt.token : (g.S && g.S.token));
      if (res.success || !res.retryable) break;
    }
    if (!res.success && res.data && res.data.code === 'AUTH' && g.App && g.App.sesiBerakhir) g.App.sesiBerakhir();
    if (!res.success && res.network && res.message === 'Koneksi terputus.') res.message = await diagnosa();
    return res;
  }

  /** Jelaskan kenapa server tidak bisa dihubungi (pengganti pesan umum "Koneksi terputus") */
  let _diag = null;
  function diagnosa() {
    if (navigator.onLine === false) return Promise.resolve('Tidak ada koneksi internet.');
    if (!urlTerisi()) return Promise.resolve('Alamat server di js/config.js belum diisi. Tempel URL /exec dari Apps Script.');
    if (_diag) return _diag;
    _diag = fetch(GAS_URL() + '?cek=' + Date.now(), { cache: 'no-store', redirect: 'follow' })
      .then((r) => r.json()).then((j) => (j && j.success
        ? 'Server terhubung, tetapi permintaan ini gagal diproses. Coba lagi sebentar lagi.'
        : 'Server membalas tidak wajar. Periksa URL /exec di js/config.js.'))
      .catch(() => 'Server tidak bisa dihubungi. Periksa URL /exec di js/config.js dan pastikan akses deployment Apps Script "Siapa saja".')
      .finally(() => setTimeout(() => { _diag = null; }, 3000));
    return _diag;
  }

  function pemanasan() {
    try { fetch(GAS_URL() + '?ping=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(() => {}); } catch (e) {}
  }
  function urlTerisi() {
    const u = String(GAS_URL() || '');
    if (/TEMPEL|ID_DEPLOYMENT/i.test(u)) return false;
    return /^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[^/]{20,}\/exec/.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)/.test(u);
  }

  g.API = { api, pemanasan, urlTerisi, diagnosa, Perf };
  g.Perf = Perf;
})(window);
