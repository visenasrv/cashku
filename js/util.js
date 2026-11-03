/* CashKu — utilitas umum (format, tanggal, warna, DOM) */
(function (g) {
  'use strict';
  const U = {};
  U.VERSI = '1.0.7';                    // versi tampilan (naikkan bersama VERSI di sw.js)

  // ---------- DOM ----------
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  U.debounce = (fn, ms) => { let t; return function () { clearTimeout(t); const a = arguments; t = setTimeout(() => fn.apply(this, a), ms); }; };
  U.idle = (fn, ms) => (g.requestIdleCallback ? g.requestIdleCallback(fn, { timeout: ms || 1500 }) : setTimeout(fn, ms || 300));

  // ---------- ID & hash ----------
  U.rand = (n) => { let s = ''; const a = 'abcdefghijklmnopqrstuvwxyz0123456789'; const r = (g.crypto && g.crypto.getRandomValues) ? g.crypto.getRandomValues(new Uint8Array(n)) : Array.from({ length: n }, () => Math.random() * 256); for (let i = 0; i < n; i++) s += a[r[i] % 36]; return s; };
  U.uuid = () => (g.crypto && g.crypto.randomUUID ? g.crypto.randomUUID() : Date.now().toString(36) + '-' + U.rand(12));
  U.hashStr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h + ':' + s.length; };

  // ---------- Angka & Rupiah ----------
  U.rp = (n) => 'Rp' + Math.round(Math.abs(Number(n) || 0)).toLocaleString('id-ID');
  U.rpTanda = (n, jenis) => {
    if (jenis === 'MASUK') return '+' + U.rp(n);
    if (jenis === 'KELUAR') return '−' + U.rp(n);
    if (jenis === 'SALDO') return U.rpSelisih(n);
    return U.rp(n);
  };
  U.rpSelisih = (n) => (n < 0 ? '−' : '+') + U.rp(n);
  U.ringkas = (n) => {
    const a = Math.abs(n), s = n < 0 ? '−' : '';
    if (a >= 1e9) return s + (a / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' M';
    if (a >= 1e6) return s + (a / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' jt';
    if (a >= 1e3) return s + (a / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' rb';
    return s + a.toLocaleString('id-ID');
  };
  U.angkaInput = (str) => Number(String(str || '').replace(/[^\d]/g, '')) || 0;
  U.fmtInput = (n) => (Number(n) ? Number(n).toLocaleString('id-ID') : '');
  U.persen = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

  // ---------- Tanggal (zona waktu perangkat, format YYYY-MM-DD) ----------
  const pad = (n) => (n < 10 ? '0' : '') + n;
  U.pad = pad;
  U.tglStr = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  U.hariIni = () => U.tglStr(new Date());
  U.parseTgl = (s) => { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2] || 1); };
  U.tambahHari = (s, n) => { const d = U.parseTgl(s); d.setDate(d.getDate() + n); return U.tglStr(d); };
  U.tambahBulan = (s, n) => { const d = U.parseTgl(s); d.setDate(1); d.setMonth(d.getMonth() + n); return U.tglStr(d); };
  U.awalBulan = (s) => s.slice(0, 8) + '01';
  U.akhirBulan = (s) => { const d = U.parseTgl(s); return U.tglStr(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
  U.awalMinggu = (s) => { const d = U.parseTgl(s); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return U.tglStr(d); };
  U.isoSekarang = () => { const d = new Date(); const off = -d.getTimezoneOffset(); const sg = off >= 0 ? '+' : '-'; return U.tglStr(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '.' + String(d.getMilliseconds()).padStart(3, '0') + sg + pad(Math.floor(Math.abs(off) / 60)) + ':' + pad(Math.abs(off) % 60); };
  U.BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  U.BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  U.HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  U.namaBulan = (s) => { const d = U.parseTgl(s); return U.BULAN[d.getMonth()] + ' ' + d.getFullYear(); };
  U.tglPanjang = (s) => { const d = U.parseTgl(s); return d.getDate() + ' ' + U.BLN[d.getMonth()] + ' ' + d.getFullYear(); };
  U.tglPendek = (s) => { const d = U.parseTgl(s); return d.getDate() + ' ' + U.BLN[d.getMonth()]; };
  U.labelHari = (s) => {
    const hi = U.hariIni();
    const d = U.parseTgl(s), hari = U.HARI[d.getDay()];
    if (s === hi) return 'Hari ini · ' + hari + ', ' + U.tglPendek(s);
    if (s === U.tambahHari(hi, -1)) return 'Kemarin · ' + hari + ', ' + U.tglPendek(s);
    return hari + ', ' + U.tglPanjang(s);
  };
  U.jam = (iso) => { const m = String(iso || '').match(/T(\d{2}):(\d{2})/); return m ? m[1] + '.' + m[2] : ''; };
  U.jamDari = (ms) => { const d = new Date(ms); return pad(d.getHours()) + '.' + pad(d.getMinutes()); };
  U.relatif = (ms) => {
    if (!ms) return 'belum pernah';
    const s = Math.round((Date.now() - ms) / 1000);
    if (s < 45) return 'baru saja';
    if (s < 3600) return Math.round(s / 60) + ' menit lalu';
    if (s < 86400 && new Date(ms).getDate() === new Date().getDate()) return 'pukul ' + U.jamDari(ms);
    return U.tglPendek(U.tglStr(new Date(ms))) + ', ' + U.jamDari(ms);
  };

  // ---------- Warna ----------
  U.hexRgb = (h) => { h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  U.rgbHex = (r, g2, b) => '#' + [r, g2, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
  U.luminance = (hex) => { const c = U.hexRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  U.rgbHsl = (r, g2, b) => { r /= 255; g2 /= 255; b /= 255; const max = Math.max(r, g2, b), min = Math.min(r, g2, b); let h = 0, s = 0; const l = (max + min) / 2; if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); h = max === r ? (g2 - b) / d + (g2 < b ? 6 : 0) : max === g2 ? (b - r) / d + 2 : (r - g2) / d + 4; h /= 6; } return [h, s, l]; };
  U.hslHex = (h, s, l) => { const f = (n) => { const k = (n + h * 12) % 12; const a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); }; return U.rgbHex(f(0) * 255, f(8) * 255, f(4) * 255); };
  // Pasangan warna tema: accent (pilihan Admin) + primary (versi gelap untuk header/tombol)
  U.TEMA_PRESET = { '#25D366': '#008069', '#0EA5E9': '#0369A1', '#6366F1': '#4338CA', '#E11D48': '#BE123C', '#F59E0B': '#B45309', '#0F766E': '#115E59' };
  U.temaDari = (accent) => {
    const a = String(accent || '#25D366').toUpperCase();
    let primary = U.TEMA_PRESET[a];
    if (!primary) {
      const hsl = U.rgbHsl.apply(null, U.hexRgb(a));
      primary = U.hslHex(hsl[0], Math.min(1, hsl[1] * 0.95), Math.min(0.30, hsl[2] * 0.7));
    }
    const hslP = U.rgbHsl.apply(null, U.hexRgb(primary));
    return {
      accent: a, primary: primary,
      primaryTekan: U.hslHex(hslP[0], hslP[1], Math.max(0.12, hslP[2] - 0.06)),
      onAccent: U.luminance(a) > 0.35 ? '#111B21' : '#FFFFFF'
    };
  };
  // Campur dua warna hex: t=0 → a, t=1 → b
  U.campur = (a, b, t) => { const x = U.hexRgb(a), y = U.hexRgb(b); return U.rgbHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); };
  U.alpha = (hex, a) => { const c = U.hexRgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };

  U.inisial = (nama) => String(nama || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  U.huruf1 = (s) => { s = String(s || '').trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; };

  g.U = U;
  if (typeof module !== 'undefined') module.exports = U;
})(typeof window !== 'undefined' ? window : globalThis);
