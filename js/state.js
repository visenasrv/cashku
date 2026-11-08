/* CashKu — state aplikasi, perhitungan, dan perubahan data lokal (offline-first) */
(function (g) {
  'use strict';
  const U = g.U;

  const S = {
    token: '', saya: null,
    master: { kategori: [], kamus: [], dompet: [], anggaran: [], usulan: [], pengaturan: {}, anggota: [] },
    meta: { verMaster: '', sejak: 0, jendelaMulai: '', basisSaldo: {}, lastSync: 0, warn: {} },
    tx: new Map(), outbox: new Map(), chat: [],
    _ev: {}, _peta: null
  };

  // ---------- Event sederhana ----------
  S.on = (ev, fn) => { (S._ev[ev] = S._ev[ev] || []).push(fn); };
  S.emit = (ev, data) => { (S._ev[ev] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); };

  // ---------- Muat & simpan ----------
  S.muat = async function () {
    const sesi = await g.DB.get('kv', 'sesi');
    if (!sesi || !sesi.token) return false;
    S.token = sesi.token; S.saya = sesi.saya;
    S.master = (await g.DB.get('kv', 'master')) || S.master;
    S.meta = Object.assign(S.meta, (await g.DB.get('kv', 'meta')) || {});
    const [txs, ops, chat] = await Promise.all([g.DB.all('tx'), g.DB.all('outbox'), g.DB.all('chat')]);
    S.tx = new Map(txs.map((t) => [t.id_transaksi, t]));
    S.outbox = new Map(ops.map((o) => [o.key, o]));
    S.chat = chat.filter((c) => c.u === S.saya.id).sort((a, b) => a.t - b.t || (a.id > b.id ? 1 : -1));
    S._peta = null;
    return true;
  };
  S.simpanSesi = () => g.DB.put('kv', { token: S.token, saya: S.saya }, 'sesi');
  S.simpanMaster = () => { S._peta = null; return g.DB.put('kv', S.master, 'master'); };
  S.simpanMeta = () => g.DB.put('kv', S.meta, 'meta');

  /** Terapkan hasil login/bootstrap penuh */
  S.terapkanBoot = async function (token, boot) {
    if (token) S.token = token;
    S.saya = boot.saya;
    S.master = boot.master;
    S.meta.verMaster = boot.verMaster;
    S.meta.sejak = Number(boot.serverNow) - 120000;
    S.meta.jendelaMulai = boot.jendelaMulai;
    S.meta.basisSaldo = boot.basisSaldo || {};
    S.meta.lastSync = Date.now();
    const lokal = Array.from(S.tx.values()).filter((t) => S.outbox.has('tx:' + t.id_transaksi));
    S.tx = new Map();
    boot.tx.forEach((t) => { t._sync = 'ok'; t._base = t.versi; S.tx.set(t.id_transaksi, t); });
    lokal.forEach((t) => S.tx.set(t.id_transaksi, t));      // perubahan lokal yang belum terkirim tetap menang
    S._peta = null;
    await g.DB.putMany('tx', Array.from(S.tx.values()));
    await Promise.all([S.simpanSesi(), S.simpanMaster(), S.simpanMeta()]);
  };

  S.keluar = async function () {
    S.token = ''; S.saya = null; S.tx = new Map(); S.outbox = new Map(); S.chat = [];
    S.master = { kategori: [], kamus: [], dompet: [], anggaran: [], usulan: [], pengaturan: {}, anggota: [], typo: [], aturan: {}, ingatan: [], pengingat: [], alias: [], target: [], penasihat: {} };
    S.meta = { verMaster: '', sejak: 0, jendelaMulai: '', basisSaldo: {}, lastSync: 0, warn: {} };
    await g.DB.clearAll();
  };

  // ---------- Peta pencarian cepat ----------
  S.peta = function () {
    if (S._peta) return S._peta;
    const m = S.master;
    S._peta = {
      kat: Object.fromEntries(m.kategori.map((k) => [k.id_kategori, k])),
      dompet: Object.fromEntries(m.dompet.map((d) => [d.id_dompet, d])),
      orang: Object.fromEntries(m.anggota.map((a) => [a.id, a]))
    };
    return S._peta;
  };
  S.kat = (id) => S.peta().kat[id] || { id_kategori: id, nama: 'Lain-lain', ikon: '📦', warna: '#94A3B8', jenis: 'KELUAR' };
  S.dompet = (id) => S.peta().dompet[id] || null;
  S.orang = (id) => S.peta().orang[id] || { id, nama: 'Anggota', warna: '#64748B', peran: 'DEWASA' };
  S.namaDompet = (id) => { const d = S.dompet(id); return d ? d.nama : '—'; };

  // ---------- Hak akses ----------
  S.isAdmin = () => !!S.saya && S.saya.peran === 'ADMIN';
  S.bolehKelola = () => !!S.saya && (S.saya.peran === 'ADMIN' || S.saya.peran === 'DEWASA');
  S.lihatSemua = () => !!S.saya && (S.saya.peran !== 'ANAK' || S.saya.izin_lihat === 'SEMUA');
  S.bolehUbahTx = (t) => !!S.saya && (t.id_pengguna === S.saya.id || S.isAdmin());
  S.fiturDompet = () => String(S.master.pengaturan.fitur_dompet || 'ON') === 'ON';
  S.namaKeluarga = () => 'Keluarga';                 // tampilan cukup "Keluarga", tanpa nama keluarga
  /** Judul transaksi untuk tampilan: pindah saldo dari nabung ditampilkan sebagai "Nabung" */
  S.judulTx = (t) => t.jenis === 'SALDO' ? 'Penyesuaian saldo' : t.jenis !== 'PINDAH' ? t.keterangan
    : /\b(me)?nabung\b/i.test(t.keterangan || '') ? 'Nabung'
    : /^(tarik tunai|ambil tabungan|setor tunai|top up .+)$/i.test(t.keterangan || '') ? U.huruf1(t.keterangan) : 'Pindah saldo';
  S.kelasJenis = (j) => (j === 'MASUK' ? 't-in' : j === 'KELUAR' ? 't-out' : 't-tr');
  S.ikonTx = (t) => t.jenis === 'SALDO' ? '\u2696\ufe0f' : t.jenis === 'PINDAH' ? (S.judulTx(t) === 'Nabung' ? '\ud83d\udc37' : '\ud83d\udd04') : S.kat(t.id_kategori).ikon;
  S.dompetAktif = () => S.master.dompet.filter((d) => d.aktif !== false);
  S.anggotaAktif = () => S.master.anggota.filter((a) => a.aktif !== false);
  S.kategoriAktif = (jenis) => S.master.kategori.filter((k) => k.aktif !== false && (!jenis || k.jenis === jenis)).sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
  S.kategoriDefault = (jenis) => {
    const ks = S.kategoriAktif(jenis);
    const def = jenis === 'MASUK' ? 'KAT-MASUKLAIN' : 'KAT-LAIN';
    return (ks.find((k) => k.id_kategori === def) || ks[ks.length - 1] || {}).id_kategori || def;
  };

  // ---------- Konteks untuk pembaca chat ----------
  S.ctxParser = function () {
    return {
      versi: S.meta.verMaster + ':' + S.master.kamus.length + ':' + S.master.kategori.length + ':' + S.master.dompet.length + ':' + (S.master.typo || []).length,
      kategori: S.master.kategori, kamus: S.master.kamus, dompet: S.dompetAktif(), anggota: S.master.anggota,
      saya: S.saya, fiturDompet: S.fiturDompet(), hariIni: U.hariIni(),
      kategoriDefaultKeluar: S.kategoriDefault('KELUAR'), kategoriDefaultMasuk: S.kategoriDefault('MASUK'),
      riwayat: S.riwayatKata,
      typo: S.master.typo || [], aturan: S.master.aturan || {}, ingatan: S.ingatanSaya(), aliasCatatan: S.master.alias || [], pemicu: (S.master.penasihat || {}).pemicu || []
    };
  };
  /** Sapaan: 'Pak' / 'Bu' / '' (nama saja) / sapaan pilihan sendiri; null = belum diketahui (perlu ditanya sekali) */
  S.hormat = function (u) {
    u = u || S.saya || {};
    if (u.sapaan) return u.sapaan === 'NAMA' ? '' : u.sapaan;
    const h = String(u.hubungan || '').toUpperCase();
    if (h === 'SUAMI') return 'Pak';
    if (h === 'ISTRI') return 'Bu';
    if (h === 'ANAK' || u.peran === 'ANAK') return '';
    return null;
  };
  /** "Pak Dani", "Bu Sinta", "Ibu" (tanpa nama), "Rafi" (anak) */
  S.sapa = function (u) {
    u = u || S.saya || {};
    const n = String(u.panggilan || '').trim(), h = S.hormat(u);
    if (h === null) return n || u.nama || '';
    if (!n) return h === 'Bu' ? 'Ibu' : h === 'Pak' ? 'Bapak' : (u.nama || '');
    return h ? h + ' ' + n : n;
  };
  /** Simpan panggilan/sapaan sendiri (jalan offline, dikirim saat online) */
  S.simpanSapaan = async function (patch) {
    S.saya = Object.assign({}, S.saya, patch);
    const a = (S.master.anggota || []).find((x) => x.id === S.saya.id);
    if (a) Object.assign(a, patch);
    await S.simpanSesi();
    const lama = S.outbox.get('profil:' + S.saya.id);
    await S.antre('profil.put', Object.assign({}, lama ? lama.data : {}, patch), 'profil:' + S.saya.id);
  };
  /** Ingatan data yang boleh dilihat: milik sendiri + yang dibagikan ke keluarga */
  S.ingatanSaya = function () {
    const id = S.saya && S.saya.id;
    return (S.master.ingatan || []).filter((x) => x.id_pengguna === id || x.lingkup === 'KELUARGA');
  };
  /** Riwayat nominal per kategori untuk transaksi yang keterangannya memuat kata ini (dipakai untuk menebak kata bermakna ganda) */
  S.riwayatKata = function (kata) {
    const P = g.Parser, k = P.normal(kata);
    if (!k) return [];
    const re = new RegExp('(^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])');
    const out = [];
    S.tx.forEach((t) => {
      if (t.status !== 'AKTIF' || (t.jenis !== 'KELUAR' && t.jenis !== 'MASUK') || !t.id_kategori || !(t.nominal > 0)) return;
      if (re.test(P.normal(t.keterangan))) out.push({ kat: t.id_kategori, nominal: t.nominal });
    });
    return out;
  };

  // ---------- Status sinkron per transaksi ----------
  S.statusTx = (id) => {
    const t = S.tx.get(id);
    if (!t) return 'hilang';
    if (t._sync === 'gagal') return 'gagal';
    if (S.outbox.has('tx:' + id)) return 'pending';
    return 'ok';
  };
  S.jumlahAntre = () => S.outbox.size;

  // ---------- Antrean operasi (outbox) ----------
  S.antre = async function (type, data, key, extra) {
    const op = Object.assign({ key: key || (type + ':' + U.uuid()), op_id: U.uuid(), type, data, t: Date.now(), tries: 0 }, extra || {});
    S.outbox.set(op.key, op);
    await g.DB.put('outbox', op);
    S.emit('outbox');
    if (g.Sync) g.Sync.jadwal();
    return op;
  };
  S.hapusOp = async function (key, opId) {
    const op = S.outbox.get(key);
    if (!op || (opId && op.op_id !== opId)) return;
    S.outbox.delete(key);
    await g.DB.del('outbox', key);
  };

  // ---------- Transaksi ----------
  S.buatIdTx = (tanggal) => 'TRX-' + String(tanggal || U.hariIni()).replace(/-/g, '') + '-' + S.saya.id.replace(/^USR-/, '') + '-' + U.rand(6);

  /** Simpan transaksi lokal + antre kirim. tx boleh baru (tanpa id) atau perubahan. */
  S.simpanTx = async function (tx) {
    const lama = tx.id_transaksi ? S.tx.get(tx.id_transaksi) : null;
    const now = U.isoSekarang();
    let t;
    if (!lama) {
      t = Object.assign({
        id_transaksi: S.buatIdTx(tx.tanggal_transaksi), id_batch: '', waktu_catat: now, tanggal_transaksi: U.hariIni(),
        id_pengguna: S.saya.id, jenis: 'KELUAR', nominal: 0, keterangan: '', id_kategori: '', id_dompet: '', id_dompet_tujuan: '',
        teks_asli: '', sumber: 'CHAT', status: 'AKTIF'
      }, tx);
      t.versi = 1; t._base = 0;
    } else {
      t = Object.assign({}, lama, tx);
      const base = lama._base || 0;
      t.versi = base + 1;
    }
    t.diubah_oleh = S.saya.id; t.diubah_pada = now; t._sync = 'pending';
    if (t.jenis !== 'PINDAH') t.id_dompet_tujuan = '';
    if (t.jenis === 'PINDAH' || t.jenis === 'SALDO') t.id_kategori = '';
    S.tx.set(t.id_transaksi, t);
    await g.DB.put('tx', t);
    await S.antre('tx.put', S.bersihTx(t), 'tx:' + t.id_transaksi, { baseVersi: t._base || 0 });
    S.emit('tx', [t.id_transaksi]);
    return t;
  };
  S.bersihTx = (t) => { const o = {}; Object.keys(t).forEach((k) => { if (k[0] !== '_') o[k] = t[k]; }); return o; };

  /** Batalkan/hapus: transaksi yang belum pernah terkirim cukup dihapus dari HP & antrean */
  S.ubahStatusTx = async function (id, status) {
    const t = S.tx.get(id);
    if (!t) return;
    if (!t._base && S.outbox.has('tx:' + id)) {
      S.tx.delete(id);
      await g.DB.del('tx', id);
      await S.hapusOp('tx:' + id);
      S.emit('tx', [id]); S.emit('outbox');
      return;
    }
    await S.simpanTx({ id_transaksi: id, status });
  };

  S.terimaTxServer = async function (arr) {
    const simpan = [], hapus = [];
    arr.forEach((t) => {
      if (S.outbox.has('tx:' + t.id_transaksi)) return;          // perubahan lokal belum terkirim tetap menang
      if (t.status === 'DIHAPUS') { if (S.tx.has(t.id_transaksi)) { S.tx.delete(t.id_transaksi); hapus.push(t.id_transaksi); } return; }
      const lama = S.tx.get(t.id_transaksi);
      if (lama && lama._sync === 'ok' && (lama.versi || 0) > (t.versi || 0)) return;
      t._sync = 'ok'; t._base = t.versi;
      S.tx.set(t.id_transaksi, t); simpan.push(t);
    });
    await g.DB.putMany('tx', simpan);
    await g.DB.delMany('tx', hapus);
    if (simpan.length || hapus.length) S.emit('tx', simpan.map((t) => t.id_transaksi).concat(hapus));
    return { baru: simpan, hapus };
  };

  // ---------- Perubahan master lokal (kamus, kategori, anggaran, usulan) ----------
  S.terapkanOpMaster = function (op) {
    const m = S.master, x = op.data;
    if (op.type === 'kamus.put') {
      const f = String(x.frasa).toLowerCase().trim();
      let k = m.kamus.find((e) => (x.id_kamus && e.id_kamus === x.id_kamus) || (e.frasa === f && e.tipe === (x.tipe || 'KATEGORI')));
      if (k) Object.assign(k, { frasa: f, target: x.target, tipe: x.tipe || 'KATEGORI', sumber: x.sumber || k.sumber });
      else m.kamus.push({ id_kamus: x.id_kamus, frasa: f, tipe: x.tipe || 'KATEGORI', target: x.target, sumber: x.sumber || 'MANUAL' });
    } else if (op.type === 'kamus.del') {
      m.kamus = m.kamus.filter((e) => e.id_kamus !== x.id_kamus);
    } else if (op.type === 'kategori.put') {
      const k = m.kategori.find((e) => e.id_kategori === x.id_kategori);
      if (k) Object.assign(k, x); else m.kategori.push(Object.assign({ aktif: true }, x));
    } else if (op.type === 'anggaran.put') {
      const a = m.anggaran.find((e) => e.id_anggaran === x.id_anggaran);
      if (a) Object.assign(a, x); else m.anggaran.push(Object.assign({ aktif: true }, x));
    } else if (op.type === 'usulan.put') {
      if (!m.usulan.find((e) => e.id_usulan === x.id_usulan)) m.usulan.push(Object.assign({ status: 'MENUNGGU', id_pengguna: S.saya.id }, x));
    } else if (op.type === 'typo.put') {
      m.typo = m.typo || [];
      const sl = String(x.salah).toLowerCase().trim(), t = m.typo.find((e) => e.salah === sl);
      if (t) t.benar = x.benar; else m.typo.push({ salah: sl, benar: String(x.benar).toLowerCase().trim() });
    } else if (op.type === 'ingatan.put') {
      m.ingatan = m.ingatan || [];
      const t = m.ingatan.find((e) => e.id_ingatan === x.id_ingatan);
      if (t) Object.assign(t, x); else m.ingatan.push(Object.assign({ id_pengguna: S.saya.id, lingkup: 'PRIBADI' }, x));
    } else if (op.type === 'penasihat.profil') {
      m.penasihat = m.penasihat || {};
      m.penasihat.profil = Object.assign({}, x);
    } else if (op.type === 'pemicu.put') {
      m.penasihat = m.penasihat || {};
      m.penasihat.pemicu = (m.penasihat.pemicu || []).filter((f) => f !== x.frasa).concat([x.frasa]);
    } else if (op.type === 'pemetaan.put') {
      m.penasihat = m.penasihat || {};
      m.penasihat.pemetaan = Object.assign({}, m.penasihat.pemetaan || {}, { [x.id_kategori]: x.kelompok });
    } else if (op.type === 'target.put') {
      m.target = m.target || [];
      const t = m.target.find((e) => e.id_target === x.id_target);
      if (t) Object.assign(t, x); else m.target.push(Object.assign({}, x));
    } else if (op.type === 'ingatan.del') {
      m.ingatan = (m.ingatan || []).filter((e) => e.id_ingatan !== x.id_ingatan);
    } else if (/^pengingat\./.test(op.type)) {
      m.pengingat = m.pengingat || [];
      const J = g.Pengingat && g.Pengingat.Jadwal;
      let p = m.pengingat.find((e) => e.id_pengingat === x.id_pengingat);
      if (op.type === 'pengingat.put') {
        if (p) Object.assign(p, x, { status: x.berikutnya ? 'AKTIF' : 'SELESAI' });
        else m.pengingat.push(Object.assign({ id_pengguna: S.saya.id, status: x.berikutnya ? 'AKTIF' : 'SELESAI' }, x));
      } else if (p && op.type === 'pengingat.del') {
        m.pengingat = m.pengingat.filter((e) => e !== p);
      } else if (p && op.type === 'pengingat.tunda') {
        p.berikutnya = x.sampai; p.status = 'AKTIF';
      } else if (p && op.type === 'pengingat.ack' && (p.berikutnya || 0) <= (x.berikutnya || 0) + 1000 && J) {
        const nb = J.berikutnya(p, Math.max(x.berikutnya || 0, Date.now()) + 1000);
        if (nb) p.berikutnya = nb; else p.status = 'SELESAI';
      }
    } else if (op.type === 'profil.put') {
      if (S.saya) Object.assign(S.saya, x);
      const a = (m.anggota || []).find((e) => S.saya && e.id === S.saya.id);
      if (a) Object.assign(a, x);
    } else if (op.type === 'usulan.putuskan') {
      const u = m.usulan.find((e) => e.id_usulan === x.id_usulan);
      if (u) {
        u.status = x.status;
        if (x.status === 'DISETUJUI') S.terapkanOpMaster({ type: 'kamus.put', data: { frasa: u.frasa, tipe: 'KATEGORI', target: x.id_kategori || u.id_kategori_usulan, sumber: 'BELAJAR' } });
      }
    }
    S._peta = null;
  };
  S.ubahMaster = async function (type, data) {
    const op = { type, data };
    S.terapkanOpMaster(op);
    await S.simpanMaster();
    const key = type === 'kamus.put' || type === 'kamus.del' ? 'kamus:' + (data.id_kamus || data.frasa)
      : type === 'kategori.put' ? 'kategori:' + data.id_kategori
      : type === 'anggaran.put' ? 'anggaran:' + data.id_anggaran
      : type === 'typo.put' ? 'typo:' + data.salah
      : type === 'target.put' ? 'target:' + data.id_target
      : type === 'penasihat.profil' ? 'penasihat:profil'
      : type === 'pemicu.put' ? 'pemicu:' + data.frasa
      : type === 'pemetaan.put' ? 'pemetaan:' + data.id_kategori
      : /^ingatan\./.test(type) ? 'ingatan:' + data.id_ingatan
      : type === 'pengingat.put' || type === 'pengingat.del' ? 'pengingat:' + data.id_pengingat
      : /^pengingat\./.test(type) ? 'pengingat:' + data.id_pengingat + ':' + type + ':' + Date.now()
      : 'usulan:' + data.id_usulan + ':' + type;
    await S.antre(type, data, key);
    S.emit('master');
  };
  S.gantiMasterDariServer = async function (master, saya) {
    S.master = master;
    // Perubahan master lokal yang belum terkirim diterapkan lagi di atas data server
    Array.from(S.outbox.values()).filter((o) => /^(kamus|kategori|anggaran|usulan|typo|ingatan|pengingat|profil|target|penasihat|pemicu|pemetaan)\./.test(o.type)).forEach((o) => S.terapkanOpMaster(o));
    if (saya) {
      S.saya = Object.assign({}, S.saya, saya);
      Array.from(S.outbox.values()).filter((o) => o.type === 'profil.put').forEach((o) => Object.assign(S.saya, o.data));
      await S.simpanSesi();
    }
    S._peta = null;
    await S.simpanMaster();
    S.emit('master');
  };

  // ---------- Perhitungan ----------
  S.txTerlihat = function (f) {
    f = f || {};
    const out = [];
    const st = f.status || 'AKTIF';          // AKTIF | TAMPIL (aktif + dibatalkan) | SEMUA
    S.tx.forEach((t) => {
      if (st === 'AKTIF' && t.status !== 'AKTIF') return;
      if (st === 'TAMPIL' && t.status === 'DIHAPUS') return;
      if (f.mulai && t.tanggal_transaksi < f.mulai) return;
      if (f.sampai && t.tanggal_transaksi > f.sampai) return;
      if (f.orang && t.id_pengguna !== f.orang) return;
      if (f.dompet && t.id_dompet !== f.dompet && t.id_dompet_tujuan !== f.dompet) return;
      if (f.jenis && t.jenis !== f.jenis) return;
      if (f.kategori && t.id_kategori !== f.kategori) return;
      out.push(t);
    });
    return out;
  };

  S.ringkasan = function (f) {
    const list = S.txTerlihat(Object.assign({}, f, { jenis: undefined, kategori: undefined }));
    let masuk = 0, keluar = 0, n = 0;
    const perKat = {}, perKatMasuk = {};
    list.forEach((t) => {
      if (t.jenis === 'SALDO') return;                          // penyesuaian saldo bukan pemasukan/pengeluaran
      if (t.jenis === 'PINDAH') {
        if (f && f.dompet) { if (t.id_dompet_tujuan === f.dompet) masuk += t.nominal; else if (t.id_dompet === f.dompet) keluar += t.nominal; }
        return;
      }
      n++;
      if (t.jenis === 'MASUK') { masuk += t.nominal; perKatMasuk[t.id_kategori] = (perKatMasuk[t.id_kategori] || 0) + t.nominal; }
      else { keluar += t.nominal; perKat[t.id_kategori] = (perKat[t.id_kategori] || 0) + t.nominal; }
    });
    const susun = (obj, total) => Object.keys(obj).map((id) => { const k = S.kat(id); return { id, nama: k.nama, ikon: k.ikon, warna: k.warna, total: obj[id], persen: total ? (obj[id] / total) * 100 : 0 }; }).sort((a, b) => b.total - a.total);
    return { masuk, keluar, selisih: masuk - keluar, jumlah: n, perKategori: susun(perKat, keluar), perKategoriMasuk: susun(perKatMasuk, masuk), list };
  };

  S.seriBulanan = function (n, refTgl, f) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const awal = U.tambahBulan(U.awalBulan(refTgl || U.hariIni()), -i);
      const r = S.ringkasan(Object.assign({}, f, { mulai: awal, sampai: U.akhirBulan(awal) }));
      const d = U.parseTgl(awal);
      out.push({ label: U.BLN[d.getMonth()], bulan: awal, masuk: r.masuk, keluar: r.keluar });
    }
    return out;
  };

  S.saldoDompet = function () {
    const mulaiJendela = S.meta.jendelaMulai || '0000-00-00';
    const basis = S.meta.basisSaldo || {};
    return S.dompetAktif().map((d) => {
      const batas = d.tanggal_saldo_awal && d.tanggal_saldo_awal > mulaiJendela ? d.tanggal_saldo_awal : mulaiJendela;
      let s = (Number(d.saldo_awal) || 0) + (Number(basis[d.id_dompet]) || 0);
      S.tx.forEach((t) => {
        if (t.status !== 'AKTIF' || t.tanggal_transaksi < batas) return;
        if (t.jenis === 'MASUK' && t.id_dompet === d.id_dompet) s += t.nominal;
        else if (t.jenis === 'KELUAR' && t.id_dompet === d.id_dompet) s -= t.nominal;
        else if (t.jenis === 'PINDAH') { if (t.id_dompet === d.id_dompet) s -= t.nominal; if (t.id_dompet_tujuan === d.id_dompet) s += t.nominal; }
        else if (t.jenis === 'SALDO' && t.id_dompet === d.id_dompet) s += t.nominal;
      });
      return { dompet: d, saldo: s };
    });
  };

  S.rentangAnggaran = function (a, ref) {
    ref = ref || U.hariIni();
    if (a.periode === 'MINGGUAN') { const s = U.awalMinggu(ref); return { mulai: s, sampai: U.tambahHari(s, 6), kunci: 'W' + s }; }
    return { mulai: U.awalBulan(ref), sampai: U.akhirBulan(ref), kunci: 'M' + ref.slice(0, 7) };
  };
  S.statusAnggaran = function (ref) {
    return S.master.anggaran.filter((a) => a.aktif !== false && Number(a.batas) > 0).map((a) => {
      const r = S.rentangAnggaran(a, ref);
      let terpakai = 0;
      S.tx.forEach((t) => {
        if (t.status !== 'AKTIF' || t.jenis !== 'KELUAR' || t.tanggal_transaksi < r.mulai || t.tanggal_transaksi > r.sampai) return;
        if (a.id_kategori && a.id_kategori !== 'SEMUA' && t.id_kategori !== a.id_kategori) return;
        if (a.lingkup === 'PERORANG' && t.id_pengguna !== a.id_pengguna) return;
        terpakai += t.nominal;
      });
      const batas = Number(a.batas), persen = batas ? (terpakai / batas) * 100 : 0, ambang = Number(a.ambang_peringatan) || 80;
      return { a, terpakai, batas, sisa: batas - terpakai, persen, level: persen >= 100 ? 2 : persen >= ambang ? 1 : 0, rentang: r };
    });
  };
  /** Anggaran yang relevan untuk pemberitahuan: keluarga (semua), per orang (dirinya; Admin juga anak-anak) */
  S.anggaranUntukSaya = (st) => st.filter((x) => x.a.lingkup !== 'PERORANG' || x.a.id_pengguna === S.saya.id || S.isAdmin());
  S.labelAnggaran = (a) => {
    const kat = a.id_kategori && a.id_kategori !== 'SEMUA' ? S.kat(a.id_kategori) : { nama: 'Total Pengeluaran', ikon: '💸' };
    const lingkup = a.lingkup === 'PERORANG' ? S.orang(a.id_pengguna).nama : 'keluarga';
    return { ikon: kat.ikon, nama: kat.nama, lingkup, lengkap: 'Anggaran ' + kat.nama + ' ' + lingkup };
  };
  /** Cek ambang anggaran setelah perubahan; mengembalikan peringatan baru (level naik) */
  S.cekPeringatan = function (filterFn) {
    const st = S.anggaranUntukSaya(S.statusAnggaran());
    const baru = [];
    st.forEach((x) => {
      const k = x.a.id_anggaran + ':' + x.rentang.kunci;
      const lama = S.meta.warn[k] || 0;
      if (x.level > lama && (!filterFn || filterFn(x))) baru.push(x);
      S.meta.warn[k] = x.level;             // turun lagi (mis. setelah batal) → bisa diperingatkan ulang
    });
    S.simpanMeta();
    return baru;
  };

  g.S = S;
})(window);
