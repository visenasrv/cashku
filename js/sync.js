/* CashKu — mesin sinkron: kirim antrean (push) lalu tarik perubahan (pull) */
(function (g) {
  'use strict';
  const S = g.S, U = g.U;
  const BATCH = 50, INTERVAL = 60000;

  const Sync = {
    status: navigator.onLine === false ? 'offline' : 'ok',   // ok | offline | sinkron | error
    pesanError: '',
    _jalan: false, _lagi: false, _timer: null, _interval: null,

    mulai() {
      addEventListener('online', () => { Sync.setStatus('ok'); Sync.jadwal(300); });
      addEventListener('offline', () => Sync.setStatus('offline'));
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') Sync.jadwal(400); });
      clearInterval(Sync._interval);
      Sync._interval = setInterval(() => { if (document.visibilityState === 'visible') Sync.sekarang(); }, INTERVAL);
      if (navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.type === 'sync') Sync.jadwal(100); });
      }
    },
    setStatus(s, pesan) { Sync.status = s; Sync.pesanError = pesan || ''; S.emit('sync', s); },
    jadwal(ms) {
      ms = ms == null ? 800 : ms;
      const due = Date.now() + ms;
      if (Sync._timer && Sync._due <= due) return;          // sudah ada jadwal yang lebih awal — jangan ditunda terus
      clearTimeout(Sync._timer);
      Sync._due = due;
      Sync._timer = setTimeout(() => { Sync._timer = null; Sync.sekarang(); }, ms);
      if (navigator.onLine === false) Sync.daftarLatar();
    },
    daftarLatar() {
      // Android/Chrome: sinkron di latar belakang walau aplikasi ditutup
      try {
        if (S.outbox.size && navigator.serviceWorker && 'SyncManager' in g) {
          navigator.serviceWorker.ready.then((reg) => reg.sync && reg.sync.register('cashku-sync')).catch(() => {});
        }
      } catch (e) {}
    },

    /** Menjalankan sinkron; bila sedang berjalan, menunggu putaran yang sedang berjalan selesai. */
    sekarang() {
      if (!S.token) return Promise.resolve();
      if (Sync._jalan) { Sync._lagi = true; return Sync._p; }
      if (navigator.onLine === false) { Sync.setStatus('offline'); return Promise.resolve(); }
      Sync._jalan = true; Sync.setStatus('sinkron');
      Sync._p = (async () => {
        try {
          const okKirim = await Sync.kirim();
          if (!okKirim) return;
          const okTarik = await Sync.tarik();
          if (!okTarik) return;
          S.meta.lastSync = Date.now();
          await S.simpanMeta();
          Sync.setStatus(S.outbox.size ? 'sinkron' : 'ok');
          if (S.outbox.size) Sync._lagi = true;
        } catch (e) {
          console.error(e);
          Sync.setStatus('error', e.message);
        } finally {
          Sync._jalan = false;
          if (Sync._lagi) { Sync._lagi = false; Sync.jadwal(1500); }
          S.emit('sync', Sync.status);
        }
      })();
      return Sync._p;
    },

    async kirim() {
      let putaran = 0;
      while (S.outbox.size && putaran++ < 20) {
        const ops = Array.from(S.outbox.values()).sort((a, b) => a.t - b.t).slice(0, BATCH);
        const res = await g.API.api('sinkronKirim', { ops: ops.map((o) => ({ op_id: o.op_id, type: o.type, data: o.data, baseVersi: o.baseVersi })) });
        if (!res.success) {
          if (res.network) { Sync.setStatus(navigator.onLine === false ? 'offline' : 'error', res.message); Sync.daftarLatar(); }
          else Sync.setStatus('error', res.message);
          return false;
        }
        await Sync.prosesHasil(ops, res.data.hasil || []);
      }
      S.emit('outbox');
      return true;
    },

    async prosesHasil(ops, hasil) {
      const byOp = Object.fromEntries(ops.map((o) => [o.op_id, o]));
      const berubah = [];
      let perluMaster = false;
      for (const r of hasil) {
        const op = byOp[r.op_id];
        if (!op) continue;
        const isTx = op.type === 'tx.put';
        const id = isTx ? op.data.id_transaksi : null;
        if (r.hasil === 'OK' || r.hasil === 'DUPLIKAT') {
          if (isTx) {
            const t = S.tx.get(id);
            if (t && S.outbox.get(op.key) && S.outbox.get(op.key).op_id === op.op_id) {
              t._sync = 'ok'; t.versi = r.versi || t.versi; t._base = t.versi;
              await g.DB.put('tx', t); berubah.push(id);
            } else if (t) { t._base = r.versi || t._base; await g.DB.put('tx', t); }
          }
          await S.hapusOp(op.key, op.op_id);
        } else if (r.hasil === 'BENTROK') {
          await S.hapusOp(op.key, op.op_id);
          if (isTx && r.server) {
            const sv = r.server; sv._sync = 'ok'; sv._base = sv.versi;
            if (sv.status === 'DIHAPUS') { S.tx.delete(id); await g.DB.del('tx', id); } else { S.tx.set(id, sv); await g.DB.put('tx', sv); }
            berubah.push(id);
            if (g.Chat) g.Chat.sistem('Transaksi “' + (sv.keterangan || op.data.keterangan) + '” juga diubah oleh ' + (r.pesan || 'anggota lain').replace(/^Diubah oleh /, '') + '. Versi terbaru yang dipakai.', true);
          }
        } else {
          // DITOLAK: kembalikan ke versi server
          await S.hapusOp(op.key, op.op_id);
          if (isTx) {
            if (r.server) { const sv = r.server; sv._sync = 'ok'; sv._base = sv.versi; S.tx.set(id, sv); await g.DB.put('tx', sv); }
            else { S.tx.delete(id); await g.DB.del('tx', id); }
            berubah.push(id);
          } else perluMaster = true;
          if (g.Chat) g.Chat.sistem('⚠️ Perubahan tidak tersimpan: ' + (r.pesan || 'ditolak server') + (isTx ? ' (“' + (op.data.keterangan || '') + '”)' : ''), true);
        }
      }
      if (perluMaster) S.meta.verMaster = '';
      if (berubah.length) S.emit('tx', berubah);
    },

    async tarik() {
      const res = await g.API.api('sinkronTarik', { sejak: S.meta.sejak || 0, verMaster: S.meta.verMaster || '' });
      if (!res.success) {
        if (res.network) Sync.setStatus(navigator.onLine === false ? 'offline' : 'error', res.message);
        else Sync.setStatus('error', res.message);
        return false;
      }
      const d = res.data;
      const hasil = await S.terimaTxServer(d.tx || []);
      if (d.master) { S.meta.verMaster = d.verMaster; await S.gantiMasterDariServer(d.master, d.saya); }
      S.meta.sejak = Number(d.serverNow) - 120000;
      // Peringatan anggaran karena transaksi anggota lain
      const dariLain = hasil.baru.some((t) => t.id_pengguna !== S.saya.id);
      const baru = S.cekPeringatan();
      if (dariLain && baru.length && g.Chat) {
        baru.forEach((x) => {
          const l = S.labelAnggaran(x.a);
          g.Chat.sistem((x.level === 2 ? '🚨 ' : '⚠️ ') + 'Setelah sinkron: ' + l.lengkap + ' kini ' + Math.round(x.persen) + '% (' + U.rp(x.terpakai) + ' dari ' + U.rp(x.batas) + ').', true);
        });
      }
      return true;
    },

    /** Tarik data terbaru sebelum membuat PDF (bila online) */
    async segarkanSebelumLaporan() {
      if (navigator.onLine === false) return false;
      await Sync.sekarang();
      return Sync.status === 'ok';
    }
  };

  g.Sync = Sync;
})(window);
