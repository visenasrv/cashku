/* CashKu — Rincian & "uang habis ke mana" (1.0.17)
 * Menjawab lewat chat:
 *   • "rincian jajan", "detail bensin bulan lalu", "pemasukan dari mana saja"   → metric 'rincian'
 *   • "uangku habis ke mana saja", "kok uang cepat habis"                       → metric 'kemana'
 *   • "paling sering beli apa"                                                  → metric 'sering'
 * Bulan lain hanya ditawarkan bila bulan itu memang punya catatan.
 */
(function (g) {
  'use strict';
  const R = {};
  const MAKS_DAFTAR = 15, MAKS_CHIP_BULAN = 3;

  const S = () => g.S;
  const U = () => g.U;
  const normal = (s) => g.Parser.normal(String(s || ''));
  const cocok = (t, kata) => (' ' + normal((t.keterangan || '') + ' ' + (t.teks_asli || '')) + ' ').indexOf(' ' + kata + ' ') > -1;
  const jumlah = (list) => list.reduce((a, t) => a + (Number(t.nominal) || 0), 0);
  const urutBaru = (a, b) => (b.tanggal_transaksi + (b.waktu_catat || '')).localeCompare(a.tanggal_transaksi + (a.waktu_catat || ''));
  const warnaAman = (w) => (/^#[0-9a-f]{3,8}$/i.test(String(w || '')) ? w : '');
  const kecil1 = (s) => { s = String(s || ''); return s ? s[0].toLowerCase() + s.slice(1) : s; };

  function periodeBulan(awal) {
    const u = U();
    return { ok: true, mulai: awal, sampai: u.akhirBulan(awal), label: u.namaBulan(awal), jenis: 'bulan' };
  }
  const periodeDari = (teks) => g.Parser.periode(teks, U().hariIni());

  /** Transaksi yang ditanyakan (jenis, kategori, kata, anggota) dalam periode; per = null → semua waktu */
  function ambil(it, per) {
    let list = S().txTerlihat({ mulai: per ? per.mulai : undefined, sampai: per ? per.sampai : undefined, orang: it.orang || undefined, jenis: it.jenis || 'KELUAR' });
    if (it.kategori) list = list.filter((t) => t.id_kategori === it.kategori);
    if (it.kata) list = list.filter((t) => cocok(t, it.kata));
    return list;
  }

  /** Kelompokkan → [{key, total, n, contoh}] urut dari total terbesar */
  function grup(list, kunci) {
    const m = {};
    list.forEach((t) => {
      const k = kunci(t);
      if (!m[k]) m[k] = { key: k, total: 0, n: 0, contoh: t, label: {} };
      m[k].total += Number(t.nominal) || 0; m[k].n++;
      const lb = String(t.keterangan || '').trim();
      m[k].label[lb] = (m[k].label[lb] || 0) + 1;
    });
    return Object.values(m).map((x) => {
      x.nama = Object.keys(x.label).sort((a, b) => x.label[b] - x.label[a])[0] || '';
      return x;
    }).sort((a, b) => b.total - a.total);
  }
  const kunciItem = (t) => normal(t.keterangan).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() || '(tanpa keterangan)';
  const palingSering = (arr) => arr.slice().sort((a, b) => b.n - a.n || b.total - a.total);

  /** Bulan-bulan lain yang punya catatan (terbaru dulu) */
  function bulanAda(it, kecuali) {
    const u = U(), hari = u.hariIni(), set = new Set();
    ambil(it, null).forEach((t) => { if (t.tanggal_transaksi <= hari) set.add(u.awalBulan(t.tanggal_transaksi)); });
    (kecuali || []).forEach((b) => set.delete(b));
    return Array.from(set).sort().reverse();
  }
  function bersih(it, ubah) {
    const o = { metric: it.metric, jenis: it.jenis || 'KELUAR' };
    ['kategori', 'kata', 'orang'].forEach((k) => { if (it[k]) o[k] = it[k]; });
    return Object.assign(o, ubah || {});
  }
  function chipBulan(it, bulan) {
    const chips = bulan.slice(0, MAKS_CHIP_BULAN).map((b) => ({ label: U().namaBulan(b), aksi: 'rcLagi', nilai: { it: bersih(it, { periode: periodeBulan(b) }) }, ikon: 'calendar', tetap: true }));
    if (bulan.length > MAKS_CHIP_BULAN) chips.push({ label: 'Bulan lainnya', aksi: 'rcBulan', nilai: { it: bersih(it), bulan: bulan.slice(MAKS_CHIP_BULAN, MAKS_CHIP_BULAN + 12) }, tetap: true });
    return chips;
  }
  const TAWAR = 'Ada catatan di bulan lain. Mau lihat?';

  function labelOrang(it) {
    const s = S();
    if (it.orang) return it.orang === s.saya.id ? 'Milik saya' : s.orang(it.orang).nama;
    return s.lihatSemua() && s.anggotaAktif().length > 1 ? 'Semua anggota' : '';
  }
  function chipKeluarga(it) {
    const s = S();
    if (it.orang === s.saya.id && s.lihatSemua() && s.anggotaAktif().length > 1) {
      return [{ label: 'Seluruh keluarga', aksi: 'rcLagi', nilai: { it: bersih(it, { orang: undefined, periode: it.periode }) }, ikon: 'users', tetap: true }];
    }
    return [];
  }
  function namaSasaran(it) {
    const s = S();
    if (it.kata) return { ikon: it.kategori ? s.kat(it.kategori).ikon : '🔎', nama: g.U.huruf1(it.kata) };
    if (it.kategori) { const k = s.kat(it.kategori); return { ikon: k.ikon, nama: k.nama }; }
    return it.jenis === 'MASUK' ? { ikon: '💰', nama: 'Pemasukan' } : { ikon: '💸', nama: 'Pengeluaran' };
  }
  const orangTx = (t) => (S().lihatSemua() && t.id_pengguna !== S().saya.id ? S().orang(t.id_pengguna).nama : '');
  const kata = (jenis) => (jenis === 'MASUK' ? 'pemasukan' : 'pengeluaran');

  /** Baris per kategori dengan batang persen */
  function barisKategori(list, total, maks) {
    const s = S();
    const gk = grup(list, (t) => t.id_kategori || '');
    return {
      baris: gk.slice(0, maks).map((x) => { const k = s.kat(x.key); return { ikon: k.ikon, l: k.nama, s: x.n + ' transaksi · ' + Math.round((x.total / (total || 1)) * 100) + '%', v: U().rp(x.total), persen: (x.total / (total || 1)) * 100, warna: warnaAman(k.warna) }; }),
      lagi: gk.length > maks ? '+' + (gk.length - maks) + ' kategori lain' : '',
      gk
    };
  }

  // =============================================================
  // "Uangku habis ke mana?" — minggu ini & bulan ini (atau periode yang disebut)
  // =============================================================
  function kemana(it, kor) {
    const s = S(), u = U(), Chat = g.Chat;
    it = Object.assign({}, it, { jenis: 'KELUAR' });
    const daftarPer = it.periode ? [it.periode] : [periodeDari('minggu ini'), periodeDari('bulan ini')];
    const utama = daftarPer[daftarPer.length - 1];
    const listUtama = ambil(it, utama);
    const kecuali = utama.jenis === 'bulan' ? [utama.mulai] : [];
    const bulan = bulanAda(it, kecuali);
    const sub = labelOrang(it);
    const adaIsi = daftarPer.some((p) => ambil(it, p).length);

    if (!adaIsi) {
      const teks = 'Belum ada pengeluaran ' + (it.periode ? 'di ' + kecil1(utama.label) : 'minggu ini maupun bulan ini') + (it.orang === s.saya.id ? ' yang kamu catat' : '') + '.';
      return Chat.tambah({ kind: 'pilihan', data: { teks: teks + (bulan.length ? ' ' + TAWAR : ''), chips: chipBulan(Object.assign({}, it, { metric: 'kemana' }), bulan).concat(chipKeluarga(it)) } });
    }

    const blok = daftarPer.map((per) => {
      const list = ambil(it, per), total = jumlah(list), bk = barisKategori(list, total, 5);
      return { judul: per.label, kanan: total ? u.rp(total) : '', kosong: 'Belum ada pengeluaran.', baris: bk.baris, lagi: bk.lagi };
    });

    // Sorotan dari periode utama (bulan ini bila tidak disebut)
    const sorot = [];
    const totalU = jumlah(listUtama);
    if (listUtama.length) {
      const gk = grup(listUtama, (t) => t.id_kategori || '');
      const k0 = s.kat(gk[0].key);
      sorot.push('📌 Paling besar ' + (it.periode ? '' : 'bulan ini ') + 'untuk **' + k0.ikon + ' ' + k0.nama + '**: ' + u.rp(gk[0].total) + ' (' + Math.round((gk[0].total / (totalU || 1)) * 100) + '%)');
      const besar = listUtama.slice().sort((a, b) => b.nominal - a.nominal || urutBaru(a, b))[0];
      sorot.push('💰 Sekali keluar terbesar: **' + (besar.keterangan || s.kat(besar.id_kategori).nama) + '** ' + u.rp(besar.nominal) + ' · ' + u.tglPendek(besar.tanggal_transaksi) + (orangTx(besar) ? ' · ' + orangTx(besar) : ''));
      const sr = palingSering(grup(listUtama, kunciItem))[0];
      const srKat = palingSering(gk)[0];
      if (sr && sr.n >= 2) sorot.push('🔁 Paling sering: **' + sr.nama + '** ' + sr.n + ' kali, total ' + u.rp(sr.total));
      else if (srKat && srKat.n >= 2) sorot.push('🔁 Paling sering: **' + s.kat(srKat.key).ikon + ' ' + s.kat(srKat.key).nama + '** ' + srKat.n + ' kali');
    }

    const chips = [];
    if (listUtama.length) {
      const k0 = grup(listUtama, (t) => t.id_kategori || '')[0];
      chips.push({ label: 'Rincian ' + s.kat(k0.key).nama, aksi: 'rcLagi', nilai: { it: bersih(it, { metric: 'rincian', kategori: k0.key, periode: utama }) }, ikon: 'receipt-text', tetap: true });
    }
    const cb = chipBulan(Object.assign({}, it, { metric: 'kemana' }), bulan);
    return Chat.tambah({ kind: 'rincian', data: {
      judul: '💸 Uangmu ke mana saja?', sub,
      total: it.periode ? u.rp(totalU) : undefined, kelasTotal: 't-out',
      blok, sorot, catatan: kor || '',
      tawar: cb.length ? TAWAR : '',
      chips: cb.concat(chips, chipKeluarga(it))
    } });
  }

  // =============================================================
  // Rincian kategori / kata / semua pengeluaran atau pemasukan
  // =============================================================
  function rincian(it, kor) {
    const s = S(), u = U(), Chat = g.Chat;
    let catatan = kor || '';
    it = Object.assign({ jenis: 'KELUAR' }, it);
    if (it.kata && !ambil(it, null).length) {
      if (it.kategori) { catatan += 'Belum ada catatan “' + it.kata + '”, jadi ini rincian kategori ' + s.kat(it.kategori).nama + '. '; it = Object.assign({}, it, { kata: undefined }); }
      else {
        return Chat.tambah({ kind: 'pilihan', data: { teks: 'Belum ada catatan yang menyebut “' + it.kata + '”.', chips: [
          { label: 'Rincian pengeluaran bulan ini', aksi: 'rcLagi', nilai: { it: { metric: 'rincian', jenis: 'KELUAR', orang: it.orang } }, tetap: true }] } });
      }
    }
    const per = it.periode || periodeDari('bulan ini');
    const sasaran = namaSasaran(it);
    const list = ambil(it, per).sort(urutBaru);
    const bulan = bulanAda(it, per.jenis === 'bulan' ? [per.mulai] : []);
    const sub = [per.label, labelOrang(it)].filter(Boolean).join(' · ');
    const itB = Object.assign({}, it, { metric: 'rincian' });

    if (!list.length) {
      const teks = 'Belum ada catatan ' + (it.kategori || it.kata ? sasaran.nama.toLowerCase() : kata(it.jenis)) + ' di ' + kecil1(per.label) + '.';
      return Chat.tambah({ kind: 'pilihan', data: { teks: teks + (bulan.length ? ' ' + TAWAR : ''), chips: chipBulan(itB, bulan).concat(chipKeluarga(it)) } });
    }

    const total = jumlah(list), n = list.length;
    const blok = [];
    const sorot = [];
    const items = grup(list, kunciItem);
    if (!it.kategori && !it.kata) {
      const bk = barisKategori(list, total, 8);
      blok.push({ judul: 'Per kategori', baris: bk.baris, lagi: bk.lagi });
    } else if (items.length > 1) {
      blok.push({ judul: 'Per item', baris: items.slice(0, 6).map((x) => ({ l: x.nama || '(tanpa keterangan)', s: x.n + ' kali', v: u.rp(x.total), persen: (x.total / (total || 1)) * 100 })), lagi: items.length > 6 ? '+' + (items.length - 6) + ' item lain' : '' });
    }
    blok.push({ judul: 'Semua transaksi', kanan: n + '×', baris: list.slice(0, MAKS_DAFTAR).map((t) => {
      const k = s.kat(t.id_kategori);
      const ket = [u.tglPendek(t.tanggal_transaksi), !it.kategori ? k.nama : '', orangTx(t), s.fiturDompet() && t.id_dompet ? s.namaDompet(t.id_dompet) : ''].filter(Boolean).join(' · ');
      return { ikon: !it.kategori ? k.ikon : '', l: t.keterangan || k.nama, s: ket, v: u.rp(t.nominal), kelas: it.jenis === 'MASUK' ? 't-in' : '' };
    }), lagi: n > MAKS_DAFTAR ? '+' + (n - MAKS_DAFTAR) + ' transaksi lain di Riwayat' : '' });

    const besar = list.slice().sort((a, b) => b.nominal - a.nominal || urutBaru(a, b))[0];
    if (n > 1) sorot.push('💰 Paling besar: **' + (besar.keterangan || s.kat(besar.id_kategori).nama) + '** ' + u.rp(besar.nominal) + ' · ' + u.tglPendek(besar.tanggal_transaksi));
    const sr = palingSering(items)[0];
    if (sr && sr.n >= 2) sorot.push('🔁 Paling sering: **' + sr.nama + '** ' + sr.n + ' kali');
    if (per.jenis === 'bulan') {
      const lalu = periodeBulan(u.tambahBulan(per.mulai, -1));
      const tl = jumlah(ambil(it, lalu));
      if (tl > 0) {
        const selisih = total - tl, p = Math.round((Math.abs(selisih) / tl) * 100);
        sorot.push((selisih > 0 ? '📈 Naik ' : selisih < 0 ? '📉 Turun ' : '➖ Sama dengan ') + (selisih ? p + '% (' + u.rp(Math.abs(selisih)) + ') dari ' : '') + lalu.label);
      }
      if (it.kategori && !it.kata && it.jenis === 'KELUAR') {
        const ang = s.statusAnggaran(per.mulai).find((x) => x.a.id_kategori === it.kategori && (x.a.lingkup !== 'PERORANG' || x.a.id_pengguna === (it.orang || s.saya.id)));
        if (ang) sorot.push('🎯 Anggaran ' + u.rp(ang.batas) + ': ' + (total <= ang.batas ? 'sisa **' + u.rp(ang.batas - total) + '**' : 'lewat **' + u.rp(total - ang.batas) + '**'));
      }
    }

    const cb = chipBulan(itB, bulan);
    const chips = cb.concat(n > MAKS_DAFTAR ? [{ label: 'Buka Riwayat', aksi: 'buka', nilai: { halaman: 'riwayat' }, ikon: 'history', tetap: true }] : [], chipKeluarga(Object.assign({}, itB, { periode: it.periode })));
    return Chat.tambah({ kind: 'rincian', data: {
      judul: sasaran.ikon + ' Rincian ' + (it.kategori || it.kata ? sasaran.nama : kata(it.jenis)), sub,
      total: u.rp(total), kelasTotal: it.jenis === 'MASUK' ? 't-in' : 't-out',
      caption: '**' + n + ' transaksi**' + (n > 1 ? ' · rata-rata ' + u.rp(Math.round(total / n)) : ''),
      blok, sorot, catatan, tawar: cb.length ? TAWAR : '', chips
    } });
  }

  // =============================================================
  // "Paling sering beli apa"
  // =============================================================
  function sering(it, kor) {
    const s = S(), u = U(), Chat = g.Chat;
    it = Object.assign({ jenis: 'KELUAR' }, it);
    const per = it.periode || periodeDari('bulan ini');
    const list = ambil(it, per);
    const bulan = bulanAda(it, per.jenis === 'bulan' ? [per.mulai] : []);
    const itB = Object.assign({}, it, { metric: 'sering' });
    if (!list.length) {
      return Chat.tambah({ kind: 'pilihan', data: { teks: 'Belum ada catatan ' + kata(it.jenis) + ' di ' + kecil1(per.label) + '.' + (bulan.length ? ' ' + TAWAR : ''), chips: chipBulan(itB, bulan).concat(chipKeluarga(it)) } });
    }
    const items = palingSering(grup(list, kunciItem));
    const kats = palingSering(grup(list, (t) => t.id_kategori || ''));
    const blok = [
      { judul: it.jenis === 'MASUK' ? 'Pemasukan paling sering' : 'Paling sering dibeli', baris: items.slice(0, 6).map((x) => { const k = s.kat(x.contoh.id_kategori); return { ikon: k.ikon, l: x.nama || k.nama, s: k.nama + ' · total ' + u.rp(x.total), v: x.n + ' kali' }; }) },
      { judul: 'Kategori paling sering', baris: kats.slice(0, 3).map((x) => { const k = s.kat(x.key); return { ikon: k.ikon, l: k.nama, s: 'total ' + u.rp(x.total), v: x.n + ' kali' }; }) }
    ];
    const sorot = [];
    if (items[0] && items[0].n >= 2) sorot.push('🔁 Paling sering: **' + items[0].nama + '** ' + items[0].n + ' kali, rata-rata ' + u.rp(Math.round(items[0].total / items[0].n)) + ' sekali ' + (it.jenis === 'MASUK' ? 'masuk' : 'beli'));
    else sorot.push('Belum ada yang tercatat lebih dari sekali di periode ini.');
    const cb = chipBulan(itB, bulan);
    return Chat.tambah({ kind: 'rincian', data: {
      judul: '🔁 Yang paling sering ' + (it.jenis === 'MASUK' ? 'masuk' : 'dibeli'), sub: [per.label, labelOrang(it)].filter(Boolean).join(' · '),
      blok, sorot, catatan: kor || '', tawar: cb.length ? TAWAR : '', chips: chipKeluarga(Object.assign({}, itB, { periode: it.periode })).concat(cb)
    } });
  }

  // =============================================================
  R.jawab = function (it, kor) {
    if (it.metric === 'kemana') return kemana(it, kor);
    if (it.metric === 'sering') return sering(it, kor);
    return rincian(it, kor);
  };
  /** Tombol "Bulan lainnya": daftar bulan yang punya catatan */
  R.bulanLain = function (v) {
    return g.Chat.tambah({ kind: 'pilihan', data: { teks: 'Pilih bulan:', chips: v.bulan.map((b) => ({ label: U().namaBulan(b), aksi: 'rcLagi', nilai: { it: Object.assign({}, v.it, { periode: periodeBulan(b) }) }, tetap: true })) } });
  };

  function html(m) {
    const d = m.data, u = U(), esc = u.esc, ta = g.Chat.teksAman;
    let h = '<div class="sum-card rc"><div class="lbl2"><span>' + esc(d.judul) + '</span></div>';
    if (d.sub) h += '<div class="rc-sub">' + esc(d.sub) + '</div>';
    if (d.total != null) h += '<div class="big num ' + (d.kelasTotal || '') + '">' + esc(d.total) + '</div>';
    if (d.caption) h += '<p class="small muted" style="margin:0">' + ta(d.caption) + '</p>';
    (d.blok || []).forEach((b) => {
      h += '<div class="rc-sec"><div class="rc-h"><span>' + esc(b.judul) + '</span>' + (b.kanan ? '<b class="num">' + esc(b.kanan) + '</b>' : '') + '</div>';
      if (!b.baris.length) h += '<p class="small muted" style="margin:0">' + esc(b.kosong || 'Belum ada catatan.') + '</p>';
      b.baris.forEach((x) => {
        h += '<div class="rc-row"><div class="rc-top">' + (x.ikon ? '<span class="rc-ik" aria-hidden="true">' + esc(x.ikon) + '</span>' : '') +
          '<span class="rc-l"><span class="rc-n ellip">' + esc(x.l) + '</span>' + (x.s ? '<span class="rc-s ellip">' + esc(x.s) + '</span>' : '') + '</span>' +
          '<b class="num rc-v ' + (x.kelas || '') + '">' + esc(x.v) + '</b></div>' +
          (x.persen != null ? '<div class="rc-bar"><i style="width:' + Math.max(2, Math.min(100, x.persen)).toFixed(1) + '%' + (warnaAman(x.warna) ? ';background:' + x.warna : '') + '"></i></div>' : '') + '</div>';
      });
      if (b.lagi) h += '<p class="small muted" style="margin:4px 0 0">' + esc(b.lagi) + '</p>';
      h += '</div>';
    });
    if (d.sorot && d.sorot.length) h += '<div class="rc-sorot">' + d.sorot.map((x) => '<div>' + ta(x) + '</div>').join('') + '</div>';
    if (d.catatan) h += '<p class="small muted" style="margin-top:8px">' + ta(d.catatan) + '</p>';
    if (d.tawar) h += '<p class="rc-tawar">' + ta(d.tawar) + '</p>';
    h += '</div>' + g.Chat.chipsHtml(m);
    return { html: h, lebar: true };
  }
  R.html = html;
  R.pasang = function () { if (g.Chat && g.Chat.RENDER) g.Chat.RENDER.rincian = html; };
  g.Rincian = R;
  R.pasang();
})(window);
