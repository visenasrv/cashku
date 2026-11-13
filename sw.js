/* CashKu — service worker: aplikasi tetap terbuka offline + sinkron latar belakang (Android) */
/* global importScripts, self, caches, indexedDB, clients */
importScripts('js/config.js');

const VERSI = 'cashku-1.0.24';
const ASET = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/config.js', 'js/icons.js', 'js/util.js', 'js/db.js', 'js/api.js', 'js/state.js', 'js/parser.js', 'js/sync.js',
  'js/ui.js', 'js/charts.js', 'js/suara.js', 'js/chat.js', 'js/rincian.js', 'js/kelola.js', 'js/atur.js', 'js/penasihat-hitung.js', 'js/penasihat.js', 'js/pengingat.js', 'js/asli.js', 'js/pages-utama.js', 'js/laporan.js', 'js/pages-atur.js', 'js/app.js',
  'js/vendor/jspdf.umd.min.js', 'js/vendor/jspdf.plugin.autotable.min.js',
  'fonts/pjs-400.woff2', 'fonts/pjs-500.woff2', 'fonts/pjs-600.woff2', 'fonts/pjs-700.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-64.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSI).then((c) => c.addAll(ASET.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSI).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;               // API Google & lainnya selalu lewat jaringan

  // config.js: utamakan jaringan (agar URL server baru langsung terpakai), cadangan cache
  if (url.pathname.endsWith('/js/config.js')) {
    e.respondWith(jaringanDulu(req, 3000));
    return;
  }
  // Semua berkas aplikasi diambil HANYA dari cache versi ini (diisi lengkap saat pemasangan).
  // Dengan begitu berkas versi lama & baru tidak pernah tercampur. Versi baru datang lewat sw.js baru
  // (VERSI dinaikkan) → banner "Versi baru tersedia" → Muat ulang.
  const kunci = req.mode === 'navigate' ? 'index.html' : req;
  e.respondWith(caches.open(VERSI).then((ca) => ca.match(kunci, { ignoreSearch: true }).then((c) => c || fetch(req, { cache: 'no-cache' }).then((r) => {
    if (r.ok && r.type === 'basic') ca.put(kunci, r.clone());
    return r;
  }).catch(() => (req.mode === 'navigate' ? ca.match('./') : Response.error())))));
});

function jaringanDulu(req, ms) {
  return new Promise((resolve) => {
    let selesai = false;
    const t = setTimeout(() => { caches.match(req, { ignoreSearch: true }).then((c) => { if (c && !selesai) { selesai = true; resolve(c); } }); }, ms);
    fetch(req, { cache: 'no-store' }).then((r) => {
      clearTimeout(t);
      if (r.ok) { const cp = r.clone(); caches.open(VERSI).then((ca) => ca.put(req, cp)); }
      if (!selesai) { selesai = true; resolve(r); }
    }).catch(() => {
      clearTimeout(t);
      caches.match(req, { ignoreSearch: true }).then((c) => { if (!selesai) { selesai = true; resolve(c || Response.error()); } });
    });
  });
}

// ---------------------------------------------------------------
// Background Sync (Android/Chrome): kirim antrean walau aplikasi ditutup
// ---------------------------------------------------------------
self.addEventListener('sync', (e) => {
  if (e.tag !== 'cashku-sync') return;
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => {
    if (list.length) { list.forEach((c) => c.postMessage({ type: 'sync' })); return null; }
    return kirimAntrean();
  }));
});

function bukaDB() {
  return new Promise((res, rej) => { const r = indexedDB.open('cashku', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onupgradeneeded = () => { r.transaction.abort(); }; });
}
function req2p(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

async function kirimAntrean() {
  const db = await bukaDB();
  const sesi = await req2p(db.transaction('kv').objectStore('kv').get('sesi'));
  if (!sesi || !sesi.token) return;
  const ops = (await req2p(db.transaction('outbox').objectStore('outbox').getAll())).sort((a, b) => a.t - b.t).slice(0, 50);
  if (!ops.length) return;
  const res = await fetch(self.CASHKU_CONFIG.GAS_URL, {
    method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'sinkronKirim', token: sesi.token, reqId: 'sw-' + ops[0].op_id, data: { ops: ops.map((o) => ({ op_id: o.op_id, type: o.type, data: o.data, baseVersi: o.baseVersi })) } })
  });
  const j = await res.json();
  if (!j.success) throw new Error(j.message || 'sinkron gagal');      // browser akan mencoba lagi nanti
  const byOp = Object.fromEntries(ops.map((o) => [o.op_id, o]));
  const t = db.transaction(['outbox', 'tx'], 'readwrite');
  const ob = t.objectStore('outbox'), tx = t.objectStore('tx');
  for (const r of j.data.hasil || []) {
    const op = byOp[r.op_id];
    if (!op || (r.hasil !== 'OK' && r.hasil !== 'DUPLIKAT')) continue;      // bentrok/ditolak ditangani aplikasi saat dibuka
    ob.delete(op.key);
    if (op.type === 'tx.put') {
      const g = tx.get(op.data.id_transaksi);
      g.onsuccess = () => { const v = g.result; if (v) { v._sync = 'ok'; v.versi = r.versi || v.versi; v._base = v.versi; tx.put(v); } };
    }
  }
  await new Promise((res2) => { t.oncomplete = res2; t.onerror = res2; });
}

// ---------------------------------------------------------------
// Pengingat & alarm (Web Push): server hanya "mencolek" tanpa isi,
// lalu service worker mengambil detail pengingat dari server.
// ---------------------------------------------------------------
async function sesiSW() {
  const db = await bukaDB();
  return req2p(db.transaction('kv').objectStore('kv').get('sesi'));
}
async function apiSW(action, data, reqId) {
  const sesi = await sesiSW();
  if (!sesi || !sesi.token) return null;
  const res = await fetch(self.CASHKU_CONFIG.GAS_URL, { method: 'POST', redirect: 'follow', cache: 'no-store', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token: sesi.token, reqId: reqId || '', data: data || {} }) });
  return res.json();
}
async function tanganiPush() {
  let d = { list: [], uji: false };
  try { const j = await apiSW('pengingatBunyi', {}); if (j && j.success) d = j.data; } catch (e) { /* tetap tampilkan notifikasi umum */ }
  const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const terlihat = wins.some((w) => w.visibilityState === 'visible');
  if (terlihat && !d.uji && d.list.length) { wins.forEach((w) => w.postMessage({ type: 'alarm' })); return; }   // alarm berbunyi di layar aplikasi
  const list = d.list.length ? d.list : [{ id: d.uji ? 'uji' : 'umum', judul: d.uji ? 'Tes alarm CashKu berhasil 🎉' : 'Ada pengingat dari CashKu' }];
  await Promise.all(list.map((p) => self.registration.showNotification('⏰ ' + p.judul, {
    body: p.id === 'uji' ? 'Alarm & notifikasi sudah aktif di HP ini.' : (d.sapa ? d.sapa + ', waktunya ini. ' : '') + 'Ketuk untuk membuka CashKu' + (p.jam ? ' · ' + String(p.jam).replace(':', '.') : ''),
    tag: 'pengingat-' + p.id, renotify: true, requireInteraction: true, silent: false,
    vibrate: [900, 300, 900, 300, 900, 300, 900, 300, 900, 300, 900],
    icon: 'icons/icon-192.png', badge: 'icons/favicon-64.png', timestamp: p.berikutnya || Date.now(),
    data: { id: p.id, berikutnya: p.berikutnya || 0 },
    actions: p.id === 'uji' || p.id === 'umum' ? [] : [{ action: 'selesai', title: 'Selesai' }, { action: 'tunda', title: 'Tunda 10 menit' }]
  })));
}
self.addEventListener('push', (e) => { e.waitUntil(tanganiPush()); });
self.addEventListener('notificationclick', (e) => {
  const n = e.notification, d = n.data || {};
  n.close();
  const nyata = d.id && d.id !== 'uji' && d.id !== 'umum';
  e.waitUntil((async () => {
    if (nyata && (e.action === 'selesai' || e.action === 'tunda')) {
      const op = e.action === 'selesai'
        ? { type: 'pengingat.ack', data: { id_pengingat: d.id, berikutnya: d.berikutnya } }
        : { type: 'pengingat.tunda', data: { id_pengingat: d.id, sampai: Date.now() + 10 * 60000 } };
      const id = 'sw-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      try { await apiSW('sinkronKirim', { ops: [Object.assign({ op_id: id }, op)] }, id); } catch (x) { /* dicoba lagi saat aplikasi dibuka */ }
      return;
    }
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.length) { const w = wins[0]; try { await w.focus(); } catch (x) {} w.postMessage({ type: 'alarm' }); return; }
    await self.clients.openWindow('./#/chat' + (nyata ? '?alarm=' + encodeURIComponent(d.id) : ''));
  })());
});
