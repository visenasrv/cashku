/* CashKu — penyimpanan di HP (IndexedDB) dengan cadangan memori bila IndexedDB tidak tersedia */
(function (g) {
  'use strict';
  const NAMA = 'cashku', VERSI = 1;
  const STORES = ['kv', 'tx', 'outbox', 'chat'];
  let dbp = null, mem = null;

  function buka() {
    if (dbp) return dbp;
    dbp = new Promise((resolve) => {
      if (!g.indexedDB) { mem = {}; return resolve(null); }
      let req;
      try { req = g.indexedDB.open(NAMA, VERSI); } catch (e) { mem = {}; return resolve(null); }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('tx')) db.createObjectStore('tx', { keyPath: 'id_transaksi' });
        if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('chat')) db.createObjectStore('chat', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { mem = {}; resolve(null); };
      req.onblocked = () => { /* tab lain memegang versi lama */ };
    });
    return dbp;
  }
  function memStore(s) { mem[s] = mem[s] || new Map(); return mem[s]; }
  function kunci(store, v) { return store === 'tx' ? v.id_transaksi : store === 'outbox' ? v.key : v.id; }
  function prom(req) { return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }

  const DB = {
    async get(store, key) {
      const db = await buka();
      if (!db) return memStore(store).get(key);
      return prom(db.transaction(store).objectStore(store).get(key));
    },
    async all(store) {
      const db = await buka();
      if (!db) return Array.from(memStore(store).values());
      return prom(db.transaction(store).objectStore(store).getAll());
    },
    async put(store, val, key) {
      const db = await buka();
      if (!db) { memStore(store).set(key !== undefined ? key : kunci(store, val), val); return; }
      const os = db.transaction(store, 'readwrite').objectStore(store);
      return prom(key !== undefined ? os.put(val, key) : os.put(val));
    },
    async putMany(store, vals) {
      if (!vals.length) return;
      const db = await buka();
      if (!db) { vals.forEach((v) => memStore(store).set(kunci(store, v), v)); return; }
      return new Promise((res, rej) => {
        const t = db.transaction(store, 'readwrite'), os = t.objectStore(store);
        vals.forEach((v) => os.put(v));
        t.oncomplete = () => res(); t.onerror = () => rej(t.error);
      });
    },
    async del(store, key) {
      const db = await buka();
      if (!db) { memStore(store).delete(key); return; }
      return prom(db.transaction(store, 'readwrite').objectStore(store).delete(key));
    },
    async delMany(store, keys) {
      if (!keys.length) return;
      const db = await buka();
      if (!db) { keys.forEach((k) => memStore(store).delete(k)); return; }
      return new Promise((res, rej) => {
        const t = db.transaction(store, 'readwrite'), os = t.objectStore(store);
        keys.forEach((k) => os.delete(k));
        t.oncomplete = () => res(); t.onerror = () => rej(t.error);
      });
    },
    async clearAll() {
      const db = await buka();
      if (!db) { mem = {}; return; }
      return new Promise((res) => {
        const t = db.transaction(STORES, 'readwrite');
        STORES.forEach((s) => t.objectStore(s).clear());
        t.oncomplete = () => res(); t.onerror = () => res();
      });
    },
    async mintaPermanen() {
      try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) {}
      return false;
    },
    async perkiraanRuang() {
      try { if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); } catch (e) {}
      return null;
    },
    pakaiMemori: () => !!mem
  };
  g.DB = DB;
})(window);
