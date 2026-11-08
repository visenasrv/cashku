#!/usr/bin/env node
/* Menyalin tampilan CashKu (akar repo) ke _android/www untuk dibundel di APK,
 * lalu menulis alamat pembaruan (GitHub Pages) ke capacitor.config.json.
 * Pemakaian: node skrip/siapkan-www.js --url https://nama.github.io/repo/ --repo nama/repo */
const fs = require('fs');
const path = require('path');
const arg = (k) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : ''; };
const AKAR = path.resolve(__dirname, '..', '..');
const WWW = path.resolve(__dirname, '..', 'www');
const LEWATI = new Set(['_android', '.github', '.git', 'node_modules', 'test', 'out']);
function salin(dari, ke) {
  fs.mkdirSync(ke, { recursive: true });
  for (const n of fs.readdirSync(dari)) {
    if (LEWATI.has(n) || n.startsWith('.') || /\.md$/i.test(n)) continue;
    const a = path.join(dari, n), b = path.join(ke, n);
    if (fs.statSync(a).isDirectory()) salin(a, b); else fs.copyFileSync(a, b);
  }
}
fs.rmSync(WWW, { recursive: true, force: true });
salin(AKAR, WWW);
if (!fs.existsSync(path.join(WWW, 'index.html'))) { console.error('index.html tidak ditemukan di akar repo. Pastikan folder _android ada di dalam repo tampilan CashKu.'); process.exit(1); }
if (!fs.existsSync(path.join(WWW, 'js', 'config.js'))) console.warn('PERINGATAN: js/config.js tidak ada — aplikasi tidak tahu alamat server.');
const cfgPath = path.resolve(__dirname, '..', 'capacitor.config.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
let url = arg('url');
if (url && !url.endsWith('/')) url += '/';
cfg.plugins = cfg.plugins || {};
cfg.plugins.AlarmCashKu = Object.assign({}, cfg.plugins.AlarmCashKu, { urlPembaruan: url, repo: arg('repo') });
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
console.log('Tampilan disalin ke www/. Alamat pembaruan:', url || '(kosong)');
