/* CashKu — grafik ringan tanpa pustaka (lingkaran & batang), dipakai di Dashboard dan PDF */
(function (g) {
  'use strict';
  const U = g.U;

  function siapkan(canvas, w, h, scale) {
    const dpr = scale || Math.min(3, g.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return ctx;
  }

  /** data: [{v, c}] ; opt: {tebal, kosong, bg} */
  function donut(canvas, data, opt) {
    opt = opt || {};
    const w = opt.w || canvas.clientWidth || 210, h = opt.h || canvas.clientHeight || 210;
    const ctx = siapkan(canvas, w, h, opt.scale);
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 4, tebal = opt.tebal || r * 0.3;
    const total = data.reduce((a, d) => a + d.v, 0);
    ctx.lineWidth = tebal; ctx.lineCap = 'butt';
    if (!total) {
      ctx.strokeStyle = opt.kosong || '#E3EDF3';
      ctx.beginPath(); ctx.arc(cx, cy, r - tebal / 2, 0, Math.PI * 2); ctx.stroke();
      return;
    }
    let a = -Math.PI / 2;
    const celah = data.length > 1 ? 0.025 : 0;
    data.forEach((d) => {
      const s = (d.v / total) * Math.PI * 2;
      ctx.strokeStyle = d.c;
      ctx.beginPath(); ctx.arc(cx, cy, r - tebal / 2, a + celah / 2, a + Math.max(s - celah / 2, celah)); ctx.stroke();
      a += s;
    });
  }

  /** seri: [{label, masuk, keluar}] ; opt: {warnaMasuk, warnaKeluar, teks, garis, sorot} */
  function batang(canvas, seri, opt) {
    opt = opt || {};
    const w = opt.w || canvas.clientWidth || 320, h = opt.h || canvas.clientHeight || 200;
    const ctx = siapkan(canvas, w, h, opt.scale);
    const padL = 34, padB = 22, padT = 8, padR = 4;
    const ch = h - padB - padT, cw = w - padL - padR;
    const maks = Math.max(1, ...seri.map((s) => Math.max(s.masuk, s.keluar)));
    const langkah = skalaBagus(maks);
    const atas = Math.ceil(maks / langkah) * langkah;
    ctx.font = '500 10px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = opt.teks || '#667781'; ctx.strokeStyle = opt.garis || '#E3EDF3'; ctx.lineWidth = 1;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let v = 0; v <= atas + 1; v += langkah) {
      const y = padT + ch - (v / atas) * ch;
      ctx.beginPath(); ctx.moveTo(padL, Math.round(y) + 0.5); ctx.lineTo(w - padR, Math.round(y) + 0.5); ctx.stroke();
      ctx.fillText(labelSumbu(v), padL - 6, y);
    }
    const grup = cw / seri.length, bw = Math.min(16, grup * 0.3), gap = 3;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    seri.forEach((s, i) => {
      const x0 = padL + grup * i + grup / 2;
      const bar = (val, x, c) => {
        const bh = (val / atas) * ch, y = padT + ch - bh;
        ctx.fillStyle = c;
        const r = Math.min(4, bw / 2, bh);
        ctx.beginPath();
        ctx.moveTo(x, padT + ch); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.lineTo(x + bw - r, y); ctx.quadraticCurveTo(x + bw, y, x + bw, y + r); ctx.lineTo(x + bw, padT + ch);
        ctx.closePath(); ctx.fill();
      };
      bar(s.masuk, x0 - bw - gap / 2, opt.warnaMasuk || '#16A34A');
      bar(s.keluar, x0 + gap / 2, opt.warnaKeluar || '#DC2626');
      ctx.fillStyle = opt.sorot === i ? (opt.teksTebal || '#111B21') : (opt.teks || '#667781');
      ctx.font = (opt.sorot === i ? '700 ' : '500 ') + '10px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(s.label, x0, padT + ch + 6);
    });
  }
  function skalaBagus(maks) {
    const kasar = maks / 4, p = Math.pow(10, Math.floor(Math.log10(kasar))), n = kasar / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  function labelSumbu(v) {
    if (v >= 1e9) return (v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + 'M';
    if (v >= 1e6) return (v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + 'jt';
    if (v >= 1e3) return (v / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 }) + 'rb';
    return String(v);
  }
  const PALET = ['#008069', '#0EA5E9', '#F59E0B', '#F97316', '#8B5CF6', '#EAB308', '#EC4899', '#14B8A6', '#64748B', '#EF4444'];

  g.Charts = { donut, batang, PALET, labelSumbu };
  if (!U) return;
})(window);
