/* CashKu — pembaca kalimat chat (berjalan di HP, tanpa server, tanpa AI).
 * Membaca: nominal, jenis (KELUAR/MASUK/PINDAH), kategori (kamus), dompet, tanggal,
 * pertanyaan ringkasan, unduh laporan, batal, serta salah ketik ringan. */
(function (g) {
  'use strict';

  const BULAN = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
  const BULAN_SINGKAT = { jan: 1, feb: 2, febr: 2, mar: 3, apr: 4, jun: 6, jul: 7, agu: 8, agt: 8, agus: 8, ags: 8, sep: 9, sept: 9, okt: 10, nov: 11, nop: 11, des: 12 };
  const ABBR = {
    bln: 'bulan', mgg: 'minggu', mg: 'minggu', thn: 'tahun', th: 'tahun', tgl: 'tanggal', hr: 'hari', lap: 'laporan', rkp: 'rekap',
    ni: 'ini', kmrn: 'kemarin', kmarin: 'kemarin', kemaren: 'kemarin', kmren: 'kemarin', yg: 'yang', utk: 'untuk', dr: 'dari',
    brp: 'berapa', berpa: 'berapa', donlod: 'download', donload: 'download', dl: 'download', pengluaran: 'pengeluaran',
    pemasukkan: 'pemasukan', sd: 'sampai', 'smp': 'sampai', blnini: 'bulan ini', tf: 'tf', ato: 'atau', gk: 'tidak', ga: 'tidak', gak: 'tidak',
    tdk: 'tidak', sy: 'saya', sdh: 'sudah', udh: 'sudah', blm: 'belum', jg: 'juga', bsk: 'besok', besuk: 'besok', skrg: 'sekarang', skrng: 'sekarang',
    jm: 'jam', mnt: 'menit', pkl: 'pukul', tlg: 'tolong', gmn: 'gimana', kpn: 'kapan', hrg: 'harga', dmn: 'dimana', nmr: 'nomor', nomer: 'nomor',
    nmer: 'nomor', norek: 'nomor rekening', klo: 'kalau', kalo: 'kalau', ingetin: 'ingatkan', ingatin: 'ingatkan', ingetkan: 'ingatkan', ingatkn: 'ingatkan',
    inget: 'ingat', simpen: 'simpan', catet: 'catat'
  };
  // Kata umum yang sah (tidak boleh "dikoreksi" menjadi kata lain)
  const UMUM = ['apa', 'apaan', 'kapan', 'mana', 'dimana', 'gimana', 'bagaimana', 'siapa', 'kenapa', 'mengapa', 'apakah', 'berapakah', 'kah', 'itu', 'ini',
    'tau', 'tahu', 'mau', 'sudah', 'belum', 'lagi', 'juga', 'kok', 'deh', 'sih', 'dong', 'nih', 'tuh', 'kan', 'loh', 'lho', 'kalau', 'kalo', 'jadi', 'sama',
    'terus', 'trus', 'lalu', 'habis', 'abis', 'udah', 'pas', 'tapi', 'tetapi', 'karena', 'biar', 'supaya', 'agar', 'bisa', 'boleh', 'harus', 'perlu', 'ada',
    'tidak', 'nggak', 'enggak', 'bukan', 'jangan', 'masih', 'baru', 'lama', 'cuma', 'hanya', 'semua', 'tiap', 'setiap', 'nanti', 'sekarang', 'besok', 'lusa',
    'pagi', 'siang', 'sore', 'malam', 'jam', 'menit', 'detik', 'pukul', 'detik', 'kali', 'termasuk', 'masuk', 'kategori', 'kategorinya', 'harga', 'harganya',
    'tolong', 'mohon', 'coba', 'ingat', 'ingatkan', 'simpan', 'catat', 'lupakan', 'hapus', 'nomor', 'rekening', 'alamat', 'kode', 'password', 'akun',
    'pengingat', 'alarm', 'notifikasi', 'ulang', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'ahad', 'kita', 'kamu', 'dia', 'mereka', 'punya',
    'milik', 'kasih', 'minta', 'lihat', 'liat', 'cek', 'biasanya', 'terakhir', 'sekali', 'dulu', 'aja', 'saja', 'ya', 'iya', 'oke', 'ok', 'sip', 'hari',
    'awal', 'akhir', 'tengah', 'depan', 'kemarin', 'tadi', 'pak', 'bu', 'mas', 'mbak', 'kak', 'bang', 'adik', 'anak', 'istri', 'suami', 'ibu', 'ayah', 'bapak',
    'bunda', 'nenek', 'kakek', 'tante', 'om', 'paman', 'bibi', 'teman', 'kantor', 'rumah', 'sekolah', 'warung', 'toko', 'pasar', 'bulan', 'tahun', 'minggu'];
  // Kata kerja transaksi (boleh dikoreksi lebih longgar bila berada di awal kalimat: "bli kopi", "byar listrik")
  const VERBA = ['beli', 'bayar', 'isi', 'jajan', 'makan', 'minum', 'belanja', 'transfer', 'kirim', 'tarik', 'setor', 'nabung', 'gaji', 'terima', 'dapat',
    'servis', 'ganti', 'sewa', 'pesan', 'order', 'cicil', 'langganan', 'topup', 'top', 'ambil', 'catat', 'lunasi', 'bensin', 'ngopi', 'parkir'];
  const VERBA_SET = new Set(VERBA);
  // Bobot & ambang bawaan — bisa ditimpa dari sheet "Aturan_Parser"
  const ATURAN_BAWAAN = {
    bobot_kata_tanya: 3, bobot_tanda_tanya: 2, bobot_frasa_kategori: 5, bobot_frasa_harga: 4, bobot_nominal: 3, bobot_kata_kerja: 2,
    ambang_tanya: 3, typo_ambang_yakin: 0.85, typo_ambang_ragu: 0.65, typo_min_huruf: 3, ingatan_ambang: 0.66,
    alarm_ulang: 5, alarm_jeda_menit: 1, alarm_tunda_menit: 10
  };
  function aturan(ctx) {
    const a = Object.assign({}, ATURAN_BAWAAN);
    const src = (ctx && ctx.aturan) || {};
    Object.keys(src).forEach((k) => { const v = Number(String(src[k]).replace(',', '.')); if (isFinite(v) && String(src[k]).trim() !== '') a[k] = v; });
    return a;
  }
  const VOCAB = ['unduh', 'download', 'cetak', 'print', 'ekspor', 'export', 'laporan', 'rekap', 'ringkasan', 'bulan', 'minggu', 'tahun',
    'hari', 'lalu', 'kemarin', 'terakhir', 'pengeluaran', 'pemasukan', 'saldo', 'sisa', 'anggaran', 'berapa', 'total', 'batal',
    'bantuan', 'tanggal', 'sampai', 'semua', 'saja', 'transaksi', 'rata', 'rerata', 'terbesar', 'terkecil', 'tertinggi', 'terendah',
    'termahal', 'termurah', 'paling', 'besar', 'kecil', 'banyak', 'boros', 'hemat', 'harian', 'mingguan', 'bulanan', 'tahunan', 'setiap',
    'tiap', 'pekan', 'sehari', 'seminggu', 'sebulan', 'setahun', 'kategori', 'siapa', 'belakangan', 'average', 'satu', 'dua', 'tiga',
    'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas', 'belas', 'puluh',
    'rincian', 'perincian', 'rinci', 'detail', 'sering', 'tersering', 'kemana', 'uangku', 'duitku', 'pengeluaranku'].concat(BULAN);
  const VOCAB_SET = new Set(VOCAB);
  const STOP = ['beli', 'membeli', 'dibeli', 'bayar', 'bayarin', 'membayar', 'dibayar', 'buat', 'untuk', 'tadi', 'sebesar', 'seharga',
    'harga', 'rp', 'sih', 'ya', 'dong', 'nih', 'aja', 'saja', 'yang', 'barusan', 'td'];
  const KATA_MASUK_HAPUS = ['masuk', 'dapat', 'dapet', 'terima', 'diterima', 'menerima', 'cair'];
  const PREP = ['dari', 'ke', 'di', 'pakai', 'pake', 'via', 'lewat', 'dengan', 'pakai saldo', 'pake saldo', 'dgn'];
  const TIPE_KATA = {
    TUNAI: ['tunai', 'cash', 'kas', 'kes', 'kontan', 'uang tunai', 'uang cash', 'duit tunai'],
    REKENING: ['rekening', 'rek', 'bank', 'atm', 'debit', 'm-banking', 'mbanking'],
    EWALLET: ['e-wallet', 'ewallet', 'e wallet', 'dompet digital', 'dompet online'],
    TABUNGAN: ['tabungan', 'tabunganku', 'uang tabungan', 'celengan', 'simpanan', 'dana darurat']
  };
  // Kata umum yang tidak menentukan kategori ("belanja mainan" → mainan; "belanja 200rb" → ditanyakan)
  const KAT_UMUM = /^(belanja|belanjaan|blanja|shopping|beli|bayar|pengeluaran|pemasukan|uang masuk|masuk|pemasukan lain|pindah saldo|transaksi|lain lain|lain-lain)$/;
  const kataUmum = (f) => KAT_UMUM.test(String(f || '').trim().toLowerCase());
  // Penanda pindah saldo bawaan (selalu berlaku walau database lama belum punya kata ini)
  const PINDAH_BAWAAN = ['nabung', 'menabung', 'pindah dana', 'pindah uang', 'pindahin', 'pindahkan', 'mindahin', 'memindahkan', 'dipindah',
    'transfer dana', 'transfer dari', 'tf dari', 'tf ke', 'kirim ke', 'isi rekening', 'isi rek', 'isi tabungan', 'isi celengan', 'isi e-wallet',
    'isi ewallet', 'isi linkaja', 'masukin ke', 'masukkan ke', 'simpan ke', 'ambil tabungan', 'tarik tabungan', 'ambil dari tabungan',
    'bongkar celengan', 'ambil uang', 'tarik uang', 'setor ke', 'top-up'];
  // Penanda yang hanya berarti pindah bila ada nama dompet (sesudahnya untuk "... ke")
  const PINDAH_PERLU_DOMPET = /^(transfer ke|setor|pindah|pindah dana|pindah uang|pindahin|pindahkan|mindahin|memindahkan|dipindah|transfer dana|transfer dari|tf dari|tf ke|kirim ke|masukin ke|masukkan ke|simpan ke|ambil uang|tarik uang)$/;
  // Penanda uang masuk yang umum: bila menyebut dompet, bisa jadi pemasukan ATAU pindahan → ditanyakan
  const MASUK_UMUM = /^(masuk|uang masuk|transfer masuk|dana masuk|saldo masuk|terima transfer|diterima|terima|menerima)$/;
  // QRIS bisa dibayar dari rekening (m-banking) maupun e-wallet → bila tidak disebut dompetnya, ditanyakan
  const KATA_QRIS = ['qris', 'scan qris', 'scan qr', 'qr code', 'kode qr'];
  // Kata e-commerce: selalu berarti Belanja Online walau ada kata kategori lain ("belanja di shopee")
  const KAT_PRIORITAS = (id, k) => id === 'KAT-ONLINE' || /^belanja online$/i.test((k && k.nama) || '');
  const SEP_KONJ = /\s+(?:dan|sama|terus|trus|lalu juga|plus|&|\+)\s+/;

  // Kata bermakna ganda: tidak boleh ditebak dari katanya saja. Kategori dipilih dari kata pendamping (ciri),
  // kata kerja, nominal, riwayat transaksi, dan kamus. Bila masih ragu → ditanyakan.
  // bawaan = pilihan bila tidak ada petunjuk apa pun; min/maks = petunjuk nominal.
  const KATA_GANDA = [
    { kata: ['air'], tanya: 'Air yang mana nih?', opsi: [
      { kat: 'KAT-TAGIHAN', label: 'Tagihan air PDAM', ciri: ['pdam', 'tagihan', 'meteran', 'langganan', 'perumda', 'leding', 'ledeng'], kerja: ['bayar', 'bayarin', 'membayar', 'lunasi', 'lunas'], min: 75000 },
      { kat: 'KAT-BULANAN', label: 'Air minum / galon', ciri: ['galon', 'minum', 'mineral', 'aqua', 'le minerale', 'botol', 'isi ulang', 'refill', 'kemasan', 'dus', 'cleo', 'depot', 'ades', 'vit', 'pristine', 'gelas'], kerja: ['beli', 'membeli', 'isi', 'borong'], maks: 75000 }] },
    { kata: ['token'], tanya: 'Token apa nih?', opsi: [
      { kat: 'KAT-TAGIHAN', label: 'Token listrik', ciri: ['listrik', 'pln', 'meteran', 'kwh', 'prabayar'], bawaan: true },
      { kat: 'KAT-HIBURAN', label: 'Top up game', ciri: ['game', 'ml', 'mobile legend', 'mobile legends', 'ff', 'free fire', 'pubg', 'diamond', 'roblox', 'genshin', 'steam'] }] },
    { kata: ['obat'], tanya: 'Obat apa nih?', opsi: [
      { kat: 'KAT-KESEHATAN', label: 'Obat sakit', ciri: ['sakit', 'demam', 'panas', 'batuk', 'pilek', 'flu', 'pusing', 'maag', 'diare', 'mencret', 'luka', 'salep', 'sirup', 'resep', 'apotek', 'apotik', 'dokter', 'tablet', 'kapsul', 'paracetamol', 'panadol', 'bodrex', 'promag', 'antangin', 'tolak angin', 'tetes', 'gatal'], bawaan: true },
      { kat: 'KAT-RUMAH', label: 'Obat nyamuk / serangga', ciri: ['nyamuk', 'serangga', 'kecoa', 'semut', 'tikus', 'rayap', 'lalat', 'baygon', 'hit', 'autan', 'soffell', 'bakar', 'elektrik'] },
      { kat: 'KAT-HOBI', label: 'Obat ikan / tanaman', ciri: ['ikan', 'tanaman', 'bunga', 'rumput', 'pupuk', 'hama', 'aquarium', 'akuarium', 'burung', 'kucing'] }] },
    { kata: ['servis', 'service', 'servise', 'serpis'], tanya: 'Servis apa nih?', opsi: [
      { kat: 'KAT-KENDARAAN', label: 'Servis kendaraan', ciri: ['motor', 'mobil', 'bengkel', 'oli', 'ban', 'rem', 'karbu', 'injeksi', 'kendaraan', 'berkala', 'ahass', 'cvt'] },
      { kat: 'KAT-RUMAH', label: 'Servis alat rumah', ciri: ['ac', 'kulkas', 'mesin cuci', 'tv', 'televisi', 'kipas', 'pompa', 'dispenser', 'kompor', 'magic com', 'magicom', 'rice cooker', 'laptop', 'hp', 'handphone', 'komputer', 'printer', 'elektronik', 'jam'] }] },
    { kata: ['minyak'], tanya: 'Minyak apa nih?', opsi: [
      { kat: 'KAT-BULANAN', label: 'Minyak goreng', ciri: ['goreng', 'sayur', 'masak', 'bimoli', 'filma', 'sania', 'fortune', 'sunco', 'tropical', 'curah', 'kelapa', 'sawit'], bawaan: true },
      { kat: 'KAT-KENDARAAN', label: 'Oli / minyak kendaraan', ciri: ['motor', 'mobil', 'rem', 'pelumas', 'mesin', 'gardan', 'samping', 'kopling'] },
      { kat: 'KAT-KESEHATAN', label: 'Minyak urut / angin', ciri: ['urut', 'angin', 'telon', 'gosok', 'tawon', 'kapak', 'zaitun'] }] },
    { kata: ['kopi'], tanya: 'Kopi yang mana nih?', opsi: [
      { kat: 'KAT-JAJAN', label: 'Ngopi / kopi jadi', ciri: ['es', 'susu', 'gelas', 'cup', 'kenangan', 'janji jiwa', 'fore', 'starbucks', 'cafe', 'kafe', 'warung', 'warkop', 'kedai', 'ngopi', 'latte', 'americano', 'cappuccino', 'kapucino', 'tubruk'], bawaan: true },
      { kat: 'KAT-BULANAN', label: 'Kopi bubuk / sachet', ciri: ['bubuk', 'sachet', 'saset', 'renceng', 'kapal api', 'abc', 'torabika', 'luwak', 'good day', 'nescafe', 'kiloan', 'sekilo', 'toples', 'biji', 'kemasan', 'pak'] }] },
    { kata: ['susu'], tanya: 'Susu untuk apa nih?', opsi: [
      { kat: 'KAT-BULANAN', label: 'Susu belanja rumah', ciri: ['kaleng', 'kental manis', 'skm', 'frisian', 'bendera', 'indomilk', 'ultra', 'liter', 'karton', 'dus', 'cair', 'uht'], bawaan: true },
      { kat: 'KAT-KELUARGA', label: 'Susu anak / bayi', ciri: ['anak', 'bayi', 'balita', 'formula', 'sgm', 'bebelac', 'lactogen', 'dancow', 'chil kid', 'pediasure', 'morinaga', 'nutrilon', 'bebelove', 'prenagen', 'hamil'] },
      { kat: 'KAT-JAJAN', label: 'Minuman susu', ciri: ['kotak', 'es', 'boba', 'kocok', 'segar', 'jahe', 'cup', 'kopi', 'milkshake'] }] },
    { kata: ['paket'], tanya: 'Paket apa nih?', opsi: [
      { kat: 'KAT-PULSA', label: 'Paket data / internet', ciri: ['data', 'internet', 'kuota', 'telkomsel', 'xl', 'indosat', 'im3', 'tri', 'axis', 'smartfren', 'unlimited', 'nelpon', 'telepon', 'sms', 'combo'] },
      { kat: 'KAT-ONLINE', label: 'Paket kiriman / online', ciri: ['kiriman', 'kirim', 'kurir', 'cod', 'jne', 'jnt', 'j&t', 'sicepat', 'anteraja', 'pos', 'ekspedisi', 'resi', 'ongkir', 'shopee', 'tokopedia', 'lazada', 'olshop'] },
      { kat: 'KAT-MAKAN', label: 'Paket makanan', ciri: ['nasi', 'ayam', 'makan', 'hemat', 'kfc', 'mcd', 'geprek', 'lunch', 'bento'] }] },
    { kata: ['iuran'], tanya: 'Iuran untuk apa nih?', opsi: [
      { kat: 'KAT-TAGIHAN', label: 'Iuran RT / lingkungan', ciri: ['rt', 'rw', 'sampah', 'keamanan', 'kebersihan', 'komplek', 'kompleks', 'perumahan', 'lingkungan', 'satpam', 'ronda', 'air', 'listrik'] },
      { kat: 'KAT-PENDIDIKAN', label: 'Iuran sekolah', ciri: ['sekolah', 'kelas', 'komite', 'osis', 'spp', 'tk', 'paud', 'kampus', 'kuliah', 'guru', 'pramuka', 'ekskul', 'murid', 'siswa'] },
      { kat: 'KAT-SOSIAL', label: 'Iuran sosial / kegiatan warga', ciri: ['masjid', 'musholla', 'mushola', 'musala', 'pengajian', 'majelis', 'arisan', 'kas', 'kematian', 'duka', 'qurban', 'kurban', 'yasinan', 'gereja', 'sosial', 'santunan', 'takziah'] },
      { kat: 'KAT-HOBI', label: 'Iuran klub / komunitas', ciri: ['klub', 'club', 'komunitas', 'futsal', 'badminton', 'gowes', 'member', 'grup', 'group', 'touring'] }] },
    { kata: ['tiket'], tanya: 'Tiket apa nih?', opsi: [
      { kat: 'KAT-TRANSPORT', label: 'Tiket perjalanan', ciri: ['bus', 'pesawat', 'kapal', 'kereta', 'travel', 'speedboat', 'klotok', 'ferry', 'feri', 'damri', 'mudik', 'pulang kampung'] },
      { kat: 'KAT-HIBURAN', label: 'Tiket hiburan / wisata', ciri: ['bioskop', 'nonton', 'film', 'konser', 'masuk', 'wisata', 'kolam', 'renang', 'taman', 'museum', 'pantai', 'pameran', 'event', 'show', 'xxi', 'cgv'] }] },
    { kata: ['sewa', 'rental'], tanya: 'Sewa apa nih?', opsi: [
      { kat: 'KAT-TAGIHAN', label: 'Sewa rumah / kos', ciri: ['rumah', 'kontrakan', 'kos', 'kost', 'kamar', 'ruko'] },
      { kat: 'KAT-TRANSPORT', label: 'Sewa kendaraan', ciri: ['mobil', 'motor', 'sopir', 'supir', 'carter', 'charter', 'bus', 'pickup', 'pick up'] },
      { kat: 'KAT-HOBI', label: 'Sewa lapangan / alat olahraga', ciri: ['lapangan', 'futsal', 'badminton', 'gor', 'raket', 'sepeda', 'kolam renang'] },
      { kat: 'KAT-HIBURAN', label: 'Sewa tempat main / liburan', ciri: ['villa', 'vila', 'tenda', 'ps', 'playstation', 'perahu', 'pelampung', 'gazebo', 'kolam', 'karaoke'] }] },
    { kata: ['pajak'], tanya: 'Pajak apa nih?', opsi: [
      { kat: 'KAT-KENDARAAN', label: 'Pajak kendaraan', ciri: ['motor', 'mobil', 'kendaraan', 'stnk', 'samsat', 'plat', 'nopol'] },
      { kat: 'KAT-TAGIHAN', label: 'Pajak rumah / tanah (PBB)', ciri: ['pbb', 'rumah', 'tanah', 'bumi', 'bangunan', 'sppt', 'properti'] }] },
    { kata: ['pulsa'], tanya: 'Pulsa apa nih?', opsi: [
      { kat: 'KAT-PULSA', label: 'Pulsa HP', ciri: ['hp', 'telkomsel', 'xl', 'indosat', 'im3', 'tri', 'axis', 'smartfren', 'nelpon', 'telepon'], bawaan: true },
      { kat: 'KAT-TAGIHAN', label: 'Pulsa listrik', ciri: ['listrik', 'pln', 'meteran', 'kwh'] }] },
    { kata: ['ongkos', 'ongkosnya'], tanya: 'Ongkos apa nih?', opsi: [
      { kat: 'KAT-TRANSPORT', label: 'Ongkos jalan / transport', ciri: ['ojek', 'ojol', 'angkot', 'naik', 'jalan', 'pulang', 'travel', 'bus', 'taksi', 'becak', 'perahu'] },
      { kat: 'KAT-ONLINE', label: 'Ongkos kirim', ciri: ['kirim', 'paket', 'kurir', 'jne', 'jnt', 'ekspedisi'] },
      { kat: 'KAT-RUMAH', label: 'Ongkos tukang', ciri: ['tukang', 'bangunan', 'renovasi', 'pasang', 'perbaikan'] }] },
    { kata: ['buku'], tanya: 'Buku apa nih?', opsi: [
      { kat: 'KAT-PENDIDIKAN', label: 'Buku sekolah / tulis', ciri: ['sekolah', 'tulis', 'pelajaran', 'paket', 'lks', 'tugas', 'catatan', 'gambar', 'anak', 'kuliah'], bawaan: true },
      { kat: 'KAT-HOBI', label: 'Buku bacaan / hobi', ciri: ['novel', 'komik', 'bacaan', 'cerita', 'majalah', 'manga', 'resep'] }] }
  ];

  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
  const reCache = new Map();
  function frasaRe(f, global) {
    const k = f + (global ? '#g' : '');
    let r = reCache.get(k);
    if (!r) { r = new RegExp('(^|[^a-z0-9])(' + escRe(f) + ')(?=$|[^a-z0-9])', global ? 'g' : ''); reCache.set(k, r); }
    if (global) r.lastIndex = 0;
    return r;
  }
  function cari(text, f) { const m = frasaRe(f).exec(text); return m ? { index: m.index + m[1].length, len: f.length, frasa: f } : null; }
  function ada(text, f) { return frasaRe(f).test(text); }

  function normal(s) {
    s = String(s || '').toLowerCase().replace(/[‘’`]/g, "'").replace(/[“”]/g, '"').replace(/[−–—]/g, '-');
    s = s.replace(/\s+/g, ' ').trim();
    // "dibank", "kerekening" → "di bank", "ke rekening"
    s = s.replace(/\b(di|ke)(bank|rekening|rek|atm|tabungan|gopay|ovo|dana|shopeepay|tunai|kas|dompet)\b/g, '$1 $2');
    return s.split(' ').map((w) => ABBR[w] || w).join(' ');
  }

  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }

  // ----------------------------------------------------------------
  // Indeks kamus (dibangun ulang hanya bila master berubah)
  // ----------------------------------------------------------------
  let IDX = null, IDX_KEY = '';
  function siapkan(ctx) {
    const key = (ctx.versi || (ctx.kamus.length + ':' + ctx.dompet.length + ':' + ctx.anggota.length + ':' + ctx.kategori.length)) +
      ':' + (ctx.typo || []).length + ':' + (ctx.ingatan || []).map((x) => x.label).join('|') + ':' + (ctx.aliasCatatan || []).length;
    if (IDX && IDX_KEY === key) return IDX;
    const katAktif = {};
    ctx.kategori.forEach((k) => { if (k.aktif !== false) katAktif[k.id_kategori] = k; });
    const byLen = (a, b) => b.frasa.length - a.frasa.length;
    const kat = [], masuk = [], pindah = [];
    ctx.kamus.forEach((k) => {
      const f = normal(k.frasa);
      if (!f) return;
      if (k.tipe === 'KATEGORI' && katAktif[k.target]) kat.push({ frasa: f, target: k.target, jenis: katAktif[k.target].jenis, sumber: k.sumber || 'BAWAAN' });
      else if (k.tipe === 'JENIS_MASUK') masuk.push({ frasa: f });
      else if (k.tipe === 'JENIS_PINDAH') pindah.push({ frasa: f });
    });
    const dompet = [];
    ctx.dompet.forEach((d) => {
      if (d.aktif === false) return;
      const fr = [d.nama].concat(String(d.alias || '').split(',')).map((x) => normal(x)).filter((x) => x && KATA_QRIS.indexOf(x) < 0);
      Array.from(new Set(fr)).forEach((f) => dompet.push({ frasa: f, id: d.id_dompet, tipe: d.tipe }));
    });
    // Kata umum per jenis dompet ("kas", "rek", "bank", "dompet digital"...). Bila jenisnya punya >1 dompet → ditanyakan.
    const sudah = new Set(dompet.map((e) => e.frasa));
    const idsTipe = (tp) => ctx.dompet.filter((d) => d.aktif !== false && d.tipe === tp).map((d) => d.id_dompet);
    Object.keys(TIPE_KATA).forEach((tp) => {
      let ids = idsTipe(tp);
      if (!ids.length && tp === 'TABUNGAN') ids = idsTipe('REKENING');
      if (ids.length) TIPE_KATA[tp].forEach((f) => { if (!sudah.has(f)) ids.forEach((id) => dompet.push({ frasa: f, id, tipe: tp, umum: true })); });
    });
    const idsQris = ctx.dompet.filter((d) => d.aktif !== false && (d.tipe === 'REKENING' || d.tipe === 'EWALLET')).map((d) => d.id_dompet);
    KATA_QRIS.forEach((f) => { if (!sudah.has(f)) idsQris.forEach((id) => dompet.push({ frasa: f, id, tipe: 'QRIS', umum: true })); });
    const anggota = [];
    ctx.anggota.forEach((a) => {
      [a.nama, a.username].filter(Boolean).forEach((x) => anggota.push({ frasa: normal(x), id: a.id }));
    });
    // Penanda bawaan yang selalu berlaku walau database dibuat sebelum kata ini ada
    PINDAH_BAWAAN.forEach((f) => { if (!pindah.some((e) => e.frasa === f)) pindah.push({ frasa: f }); });
    kat.sort(byLen); masuk.sort(byLen); pindah.sort(byLen); dompet.sort(byLen); anggota.sort(byLen);
    const known = new Set(VOCAB.concat(STOP, KATA_MASUK_HAPUS, PREP, Object.keys(ABBR), Object.values(ABBR),
      ['ini', 'itu', 'yang', 'dan', 'atau', 'saya', 'aku', 'kami', 'keluarga', 'semua', 'anggota', 'pdf', 'per', 'orang']));
    [kat, masuk, pindah, dompet, anggota].forEach((arr) => arr.forEach((e) => e.frasa.split(/[^a-z0-9]+/).forEach((w) => w && known.add(w))));
    UMUM.concat(VERBA, Object.keys(BULAN_SINGKAT)).forEach((w) => known.add(w));
    (ctx.ingatan || []).forEach((x) => normal(x.label).split(/[^a-z0-9]+/).forEach((w) => w && known.add(w)));
    Object.keys(petaAlias(ctx).peta).forEach((w) => known.add(w));
    // Kamus typo (sheet Kamus_Typo): "salah" → "benar"
    const typo = {};
    (ctx.typo || []).forEach((x) => { const a = normal(x.salah), b = normal(x.benar); if (a && b && a !== b) { typo[a] = b; b.split(' ').forEach((w) => known.add(w)); } });
    const vocab = Array.from(known).filter((w) => /^[a-z]{2,}$/.test(w));
    const ganda = KATA_GANDA.map((x) => ({ kata: x.kata, tanya: x.tanya, opsi: x.opsi.filter((o) => katAktif[o.kat] && katAktif[o.kat].jenis === 'KELUAR') }));
    IDX = { kat, masuk, pindah, dompet, anggota, katAktif, known, ganda, typo, vocab, dompetById: Object.fromEntries(ctx.dompet.map((d) => [d.id_dompet, d])) };
    IDX_KEY = key;
    return IDX;
  }

  // ----------------------------------------------------------------
  // Nominal
  // ----------------------------------------------------------------
  const RE_AMT = /(^|[^a-z0-9])(rp\.?\s?)?(\d+(?:[.,]\d+)*)(\s?(?:juta|jt|ribu|rb|rbu|k)(?:an)?)?(\d{1,3})?(?=$|[^a-z0-9])/g;
  function nilaiNominal(num, unit, trail) {
    const u = unit ? unit.trim().replace(/an$/, '') : '';
    const mult = /^(juta|jt)$/.test(u) ? 1e6 : /^(ribu|rb|rbu|k)$/.test(u) ? 1e3 : 1;
    let v;
    if (mult > 1) {
      v = /^\d+[.,]\d{1,2}$/.test(num) ? parseFloat(num.replace(',', '.')) : parseFloat(num.replace(/[.,]/g, ''));
      v *= mult;
      if (trail) v += parseFloat('0.' + trail) * mult;
    } else if (/^\d{1,3}([.,]\d{3})+$/.test(num)) v = parseFloat(num.replace(/[.,]/g, ''));
    else if (/^\d+[.,]\d{1,2}$/.test(num)) v = parseFloat(num.replace(',', '.'));
    else v = parseFloat(num.replace(/[.,]/g, ''));
    return { v: Math.round(v), mult };
  }
  // 1.0.19: nominal majemuk berspasi — "1 juta 550" (= 1.550.000), "2 juta 750 ribu", "1 juta 2 ratus", "15 ribu 500".
  // Angka 1–2 digit sesudah satuan ("2 juta 50") bisa berarti 2.500.000 atau 2.050.000 → ditanyakan, tidak ditebak.
  const RE_SATUAN_QTY = /^\s*(?:kali|x|gelas|cup|pcs|buah|bh|biji|bungkus|bks|porsi|orang|org|liter|ltr|kg|gram|gr|ons|lembar|lbr|botol|btl|kotak|dus|pak|pack|unit|ekor|butir|sachet|saset|renteng|meter|lusin|kodi|batang|bulan(?!\s+(?:ini|lalu|kemarin|depan))|hari(?!\s+(?:ini|lalu|kemarin))|minggu(?!\s+(?:ini|lalu|kemarin|depan))|tahun(?!\s+(?:ini|lalu|kemarin|depan))|%|persen)\b/;
  const RE_SESUDAH_BEBAS = /^\s*(?:$|[,;.!?)]|(?:dan|dari|ke|di|untuk|utk|buat|bwt|pakai|pake|via|lewat|masuk|keluar|tunai|cash|transfer|tf|ya|yah|aja|saja|dong|deh|tadi|kemarin|barusan|hari ini|rupiah|rp)\b)/;
  function sambungNominal(s, akhir, r) {
    if (r.mult !== 1e6 && r.mult !== 1e3) return null;
    const sisa = s.slice(akhir);
    let x;
    if (r.mult === 1e6 && (x = /^\s+(\d{1,3})\s*(?:ribu|rb|rbu|k)(?=$|[^a-z0-9])/.exec(sisa))) return { tambah: Number(x[1]) * 1e3, len: x[0].length };
    if (r.mult === 1e6 && (x = /^\s+([1-9])\s*ratus(?:\s*(?:ribu|rb|rbu))?(?=$|[^a-z0-9])/.exec(sisa))) return { tambah: Number(x[1]) * 1e5, len: x[0].length };
    if (r.mult === 1e3 && (x = /^\s+([1-9])\s*ratus(?=$|[^a-z0-9])/.exec(sisa))) return { tambah: Number(x[1]) * 100, len: x[0].length };
    if (!(x = /^\s+(\d{1,3})(?=$|[^a-z0-9.,]|[.,](?!\d))/.exec(sisa))) return null;
    const lanjut = sisa.slice(x[0].length);
    if (RE_SATUAN_QTY.test(lanjut)) return null;
    const y = x[1];
    if (y.length === 3) return { tambah: Number(y) * (r.mult / 1e3), len: x[0].length };
    if (!RE_SESUDAH_BEBAS.test(lanjut)) return null;        // "25 ribu 3 roti" → 3 = jumlah barang berikutnya
    // Ragu: "2 juta 50" = 2.500.000 (seperti 2jt50) atau 2.050.000?
    const pecahan = Math.round(parseFloat('0.' + y) * r.mult);       // "1 juta 5" = 1.500.000 (seperti 1jt5)
    if (y.length === 1) return { tambah: pecahan, len: x[0].length };
    return { tambah: pecahan, len: x[0].length, opsi: [r.v + pecahan, r.v + Number(y) * (r.mult / 1e3)] };
  }
  function cariNominal(s) {
    const out = [];
    RE_AMT.lastIndex = 0;
    let m;
    while ((m = RE_AMT.exec(s))) {
      const start = m.index + m[1].length;
      let teks = m[0].slice(m[1].length);
      const r = nilaiNominal(m[3], m[4], m[4] ? m[5] : '');
      if (!(r.v > 0)) continue;
      const kuat = r.mult > 1 || !!m[2] || /[.,]\d{3}(?!\d)/.test(m[3]) || r.v >= 1000;
      const o = { nilai: r.v, kuat, index: start, len: teks.length, teks };
      const sb = !m[5] ? sambungNominal(s, m.index + m[0].length, r) : null;
      if (sb) {
        o.nilai = r.v + sb.tambah;
        o.teks = s.slice(start, m.index + m[0].length + sb.len); o.len = o.teks.length;
        if (sb.opsi && sb.opsi[0] !== sb.opsi[1]) o.opsi = sb.opsi;
        RE_AMT.lastIndex = m.index + m[0].length + sb.len;
      }
      out.push(o);
    }
    return out;
  }
  // Ekspresi tanggal/periode yang mengandung angka tapi bukan nominal
  const NAMA_BULAN_RE = '(?:' + BULAN.join('|') + '|' + Object.keys(BULAN_SINGKAT).join('|') + ')';
  const RE_BUKAN_NOMINAL = [
    /\b(?:tanggal)\s*\d{1,2}(?:\s*(?:-|sampai|s\/d|hingga)\s*\d{1,2})?/g,
    /\b\d+\s*hari\s*(?:yang\s*)?lalu\b/g,
    /\bke-?\s?\d+\b/g,
    /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g,
    /\b\d{1,2}\/\d{4}\b/g,
    /\bbulan\s*\d{1,2}\b/g,
    /\btahun\s*\d{4}\b/g,
    /\b\d+\s*bulan\s*terakhir\b/g,
    new RegExp('\\b\\d{1,2}(?:\\s*(?:-|sampai|s\\/d|hingga)\\s*\\d{1,2})?\\s+' + NAMA_BULAN_RE + '\\b(?:\\s+\\d{4})?', 'g'),
    new RegExp('\\b' + NAMA_BULAN_RE + '\\s+\\d{4}\\b', 'g')
  ];
  function tutupBukanNominal(s) {
    RE_BUKAN_NOMINAL.forEach((re) => { re.lastIndex = 0; s = s.replace(re, (x) => ' '.repeat(x.length)); });
    return s;
  }

  /** Untuk balasan klarifikasi: "25rb" → 25000 (null bila bukan nominal saja) */
  function nominalSaja(text) {
    const t = angkaDariKata(normal(text));
    const a = cariNominal(t);
    if (a.length !== 1) return null;
    const sisa = (t.slice(0, a[0].index) + t.slice(a[0].index + a[0].len)).replace(/\b(rp|aja|saja|ya|kok|harganya|harga)\b/g, '').trim();
    return sisa ? null : a[0].nilai;
  }

  // ----------------------------------------------------------------
  // Tanggal transaksi & periode laporan
  // ----------------------------------------------------------------
  const p2 = (n) => (n < 10 ? '0' : '') + n;
  const ymd = (y, m, d) => y + '-' + p2(m) + '-' + p2(d);
  const pd = (s) => { const a = s.split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); };
  const fd = (d) => ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const addD = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return fd(d); };
  const hariDlmBulan = (y, m) => new Date(y, m, 0).getDate();
  const senin = (s) => { const d = pd(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return fd(d); };
  const BLN_LABEL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const BLN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const tglLabel = (s) => { const d = pd(s); return d.getDate() + ' ' + BLN_PENDEK[d.getMonth()] + ' ' + d.getFullYear(); };

  function tanggalTransaksi(t, hariIni) {
    let m;
    if ((m = /\bkemarin\s+lusa\b/.exec(t))) return { tanggal: addD(hariIni, -2), frasa: m[0], index: m.index };
    if ((m = /\bkemarin\b/.exec(t))) return { tanggal: addD(hariIni, -1), frasa: m[0], index: m.index };
    if ((m = /\b(\d{1,2})\s*hari\s*(?:yang\s*)?lalu\b/.exec(t))) return { tanggal: addD(hariIni, -Number(m[1])), frasa: m[0], index: m.index };
    // "tanggal 5 oktober", "5 okt", "tgl 3 september 2026", "5/10"
    const reTB = new RegExp('\\b(?:(?:tanggal|tgl)\\s*)?(\\d{1,2})\\s+(' + NAMA_BULAN_RE + ')\\b(?:\\s+(20\\d{2}))?');
    if ((m = reTB.exec(t)) || (m = /\b(?:(?:tanggal|tgl)\s*)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(t))) {
      const d = Number(m[1]); const h = pd(hariIni);
      const nb = /^\d+$/.test(m[2]) ? Number(m[2]) : (BULAN.indexOf(m[2]) > -1 ? BULAN.indexOf(m[2]) + 1 : BULAN_SINGKAT[m[2]]);
      let y = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : h.getFullYear();
      if (nb >= 1 && nb <= 12) {
        if (!m[3] && ymd(y, nb, Math.min(d, 28)) > hariIni) y--;           // tanpa tahun: tanggal yang sudah lewat
        if (d >= 1 && d <= hariDlmBulan(y, nb)) return { tanggal: ymd(y, nb, d), frasa: m[0], index: m.index };
      }
    }
    if ((m = /\btanggal\s*(\d{1,2})\b(?!\s*(?:-|sampai|hingga))/.exec(t))) {
      const d = Number(m[1]); const h = pd(hariIni);
      let y = h.getFullYear(), mo = h.getMonth() + 1;
      if (d > h.getDate()) { mo--; if (mo < 1) { mo = 12; y--; } }
      if (d >= 1 && d <= hariDlmBulan(y, mo)) return { tanggal: ymd(y, mo, d), frasa: m[0], index: m.index };
    }
    if ((m = /\b(tadi|barusan)\b/.exec(t))) return { tanggal: hariIni, frasa: '', index: -1 };
    return null;
  }

  function bulanDari(word) {
    const i = BULAN.indexOf(word);
    if (i > -1) return i + 1;
    return BULAN_SINGKAT[word] || 0;
  }

  // Angka dalam kata: "dua", "tiga belas", "dua puluh lima", "se-" (seminggu)
  const ANGKA = { se: 1, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11 };
  const SATUAN_RE = '(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)';
  const RE_BERGULIR = new RegExp('(?:^|\\s)(\\d{1,3}|' + SATUAN_RE + ' puluh(?: ' + SATUAN_RE + ')?|' + SATUAN_RE + ' belas|' + SATUAN_RE + '|sepuluh|sebelas|se)\\s*(hari|minggu|pekan|bulan|tahun)\\s*(?:ini|terakhir|belakangan|ke ?belakang)\\b');
  function angkaKata(s) {
    s = String(s || '').trim();
    if (/^\d+$/.test(s)) return Number(s);
    let m;
    if ((m = /^(\w+) belas$/.exec(s))) return ANGKA[m[1]] < 10 ? 10 + ANGKA[m[1]] : null;
    if ((m = /^(\w+) puluh(?: (\w+))?$/.exec(s))) return ANGKA[m[1]] < 10 ? ANGKA[m[1]] * 10 + (m[2] ? ANGKA[m[2]] || 0 : 0) : null;
    return ANGKA[s] || null;
  }

  /** Periode untuk pertanyaan & laporan. Mengembalikan {ok, mulai, sampai, label, jenis} atau {ok:false, err, pesan, saran} */
  function periode(t, hariIni) {
    const h = pd(hariIni), Y = h.getFullYear(), M = h.getMonth() + 1;
    let m;
    const bulanPenuh = (y, mo, extra) => Object.assign({ ok: true, mulai: ymd(y, mo, 1), sampai: ymd(y, mo, hariDlmBulan(y, mo)), label: BLN_LABEL[mo - 1] + ' ' + y, jenis: 'bulan', kunci: 'B' + y + p2(mo) }, extra || {});
    const cekMasaDepan = (r, saran) => {
      if (r.ok && r.mulai > hariIni) return { ok: false, err: 'future', pesan: r.label + ' belum berjalan.', label: r.label, saran: saran || [] };
      return r;
    };
    if ((m = RE_BERGULIR.exec(t))) {
      const n = angkaKata(m[1]), sat = m[2] === 'pekan' ? 'minggu' : m[2];
      if (n && n >= 1 && n <= 3650 && !(sat === 'bulan' && n > 1)) {
        const hari = sat === 'hari' ? n : sat === 'minggu' ? n * 7 : sat === 'bulan' ? 30 : n * 365;
        if (hari === 1) return { ok: true, mulai: hariIni, sampai: hariIni, label: 'Hari ini (' + tglLabel(hariIni) + ')', jenis: 'hari' };
        const mulai = addD(hariIni, -(hari - 1));
        const nama = sat === 'bulan' ? '30 hari terakhir' : (n === 1 ? (sat === 'minggu' ? '7 hari terakhir' : '1 tahun terakhir') : n + ' ' + sat + ' terakhir');
        return { ok: true, mulai, sampai: hariIni, label: U_huruf1(nama) + ' (' + tglLabel(mulai).replace(mulai.slice(0, 4) === hariIni.slice(0, 4) ? / \d{4}$/ : /$^/, '') + '–' + tglLabel(hariIni) + ')', jenis: 'rentang', hari };
      }
    }
    if (/\bhari ini\b/.test(t)) return { ok: true, mulai: hariIni, sampai: hariIni, label: 'Hari ini (' + tglLabel(hariIni) + ')', jenis: 'hari' };
    if (/(?<!(?:bulan|minggu|pekan|tahun) )\bkemarin\b/.test(t)) { const k = addD(hariIni, -1); return { ok: true, mulai: k, sampai: k, label: 'Kemarin (' + tglLabel(k) + ')', jenis: 'hari' }; }
    if (/\b(?:minggu|pekan) ini\b/.test(t)) { const s = senin(hariIni); return { ok: true, mulai: s, sampai: addD(s, 6), label: 'Minggu ini (' + tglLabel(s).replace(/ \d{4}$/, '') + '–' + tglLabel(addD(s, 6)) + ')', jenis: 'minggu' }; }
    if (/\b(?:minggu|pekan) (?:lalu|kemarin)\b/.test(t)) { const s = addD(senin(hariIni), -7); return { ok: true, mulai: s, sampai: addD(s, 6), label: 'Minggu lalu (' + tglLabel(s).replace(/ \d{4}$/, '') + '–' + tglLabel(addD(s, 6)) + ')', jenis: 'minggu' }; }
    if (/\bbulan ini\b/.test(t)) return bulanPenuh(Y, M);
    if (/\bbulan (?:lalu|kemarin)\b/.test(t)) { let y = Y, mo = M - 1; if (mo < 1) { mo = 12; y--; } return bulanPenuh(y, mo); }
    if (/\btahun ini\b/.test(t)) return { ok: true, mulai: ymd(Y, 1, 1), sampai: ymd(Y, 12, 31), label: 'Tahun ' + Y, jenis: 'tahun', tahun: Y };
    if (/\btahun (?:lalu|kemarin)\b/.test(t)) return { ok: true, mulai: ymd(Y - 1, 1, 1), sampai: ymd(Y - 1, 12, 31), label: 'Tahun ' + (Y - 1), jenis: 'tahun', tahun: Y - 1 };
    if ((m = /\b(\d{1,2})\s*bulan\s*terakhir\b/.exec(t))) {
      const n = Math.max(1, Math.min(24, Number(m[1])));
      let y = Y, mo = M - (n - 1); while (mo < 1) { mo += 12; y--; }
      return { ok: true, mulai: ymd(y, mo, 1), sampai: ymd(Y, M, hariDlmBulan(Y, M)), label: n + ' bulan terakhir', jenis: 'rentang' };
    }
    // Rentang tanggal: "1-15 oktober 2026", "tanggal 1 sampai 15 oktober"
    const reRentang = new RegExp('(?:tanggal\\s*)?(\\d{1,2})\\s*(?:-|sampai|s\\/d|hingga)\\s*(?:tanggal\\s*)?(\\d{1,2})(?:\\s+(' + NAMA_BULAN_RE + '))?(?:\\s+(\\d{4}))?');
    if ((m = reRentang.exec(t)) && (m[3] || /tanggal/.test(m[0]))) {
      const a = Number(m[1]), b = Number(m[2]);
      let mo = m[3] ? bulanDari(m[3]) : M, y = m[4] ? Number(m[4]) : Y;
      if (!m[4] && ymd(y, mo, 1) > hariIni) y--;
      const maks = hariDlmBulan(y, mo);
      if (a < 1 || b < 1 || a > maks || b > maks) return { ok: false, err: 'invalid', pesan: 'Tanggal ' + (a > maks ? a : b) + ' tidak ada di ' + BLN_LABEL[mo - 1] + ' ' + y + '.', saran: ['bulan ini'] };
      const mulai = ymd(y, mo, Math.min(a, b)), sampai = ymd(y, mo, Math.max(a, b));
      return cekMasaDepan({ ok: true, mulai, sampai, label: Math.min(a, b) + '–' + Math.max(a, b) + ' ' + BLN_LABEL[mo - 1] + ' ' + y, jenis: 'rentang' });
    }
    // Nama bulan (+ tahun)
    const reBulan = new RegExp('\\b(' + NAMA_BULAN_RE + ')\\b(?:\\s+(?:tahun\\s+)?(\\d{4}))?');
    if ((m = reBulan.exec(t))) {
      const mo = bulanDari(m[1]);
      if (m[2]) {
        const y = Number(m[2]);
        return cekMasaDepan(bulanPenuh(y, mo), [{ label: 'Bulan ini sampai hari ini', teks: 'bulan ini' }, { label: BLN_LABEL[mo - 1] + ' ' + (y - 1), teks: BULAN[mo - 1] + ' ' + (y - 1) }]);
      }
      const y = mo > M ? Y - 1 : Y;
      return bulanPenuh(y, mo, { tahunTebakan: mo > M });
    }
    // "bulan 3", "bulan 3 tahun 2025", "03/2026"
    if ((m = /\bbulan\s*(\d{1,2})\b(?:\s+(?:tahun\s*)?(\d{4}))?/.exec(t)) || (m = /\b(\d{1,2})\/(\d{4})\b/.exec(t))) {
      const mo = Number(m[1]);
      if (mo < 1 || mo > 12) return { ok: false, err: 'invalid', pesan: 'Bulan ' + mo + ' tidak ada.', saran: [{ label: 'Bulan ini', teks: 'bulan ini' }, { label: BLN_LABEL[(M + 10) % 12] + ' ' + (M === 1 ? Y - 1 : Y), teks: 'bulan lalu' }] };
      if (m[2]) return cekMasaDepan(bulanPenuh(Number(m[2]), mo));
      const y = mo > M ? Y - 1 : Y;
      return bulanPenuh(y, mo, { tahunTebakan: mo > M });
    }
    if ((m = /\btahun\s*(\d{4})\b/.exec(t)) || (m = /(?:^|\s)(20\d{2})(?:\s|$)/.exec(t))) {
      const y = Number(m[1]);
      if (y > Y) return { ok: false, err: 'future', pesan: 'Tahun ' + y + ' belum berjalan.', saran: [{ label: 'Tahun ini', teks: 'tahun ini' }] };
      return { ok: true, mulai: ymd(y, 1, 1), sampai: ymd(y, 12, 31), label: 'Tahun ' + y, jenis: 'tahun', tahun: y };
    }
    if ((m = /\btanggal\s*(\d{1,2})\b/.exec(t))) {
      const d = Number(m[1]);
      if (d < 1 || d > hariDlmBulan(Y, M)) return { ok: false, err: 'invalid', pesan: 'Tanggal ' + d + ' tidak ada di bulan ini.', saran: [{ label: 'Hari ini', teks: 'hari ini' }] };
      const s = ymd(Y, M, d);
      return cekMasaDepan({ ok: true, mulai: s, sampai: s, label: tglLabel(s), jenis: 'hari' });
    }
    return { ok: false, err: 'none' };
  }

  // ----------------------------------------------------------------
  // Pencarian entitas
  // ----------------------------------------------------------------
  function cariSemua(text, entries) {
    const hasil = [], terpakai = [];
    entries.forEach((e) => {
      const re = frasaRe(e.frasa, true);
      let m;
      while ((m = re.exec(text))) {
        const s = m.index + m[1].length, en = s + e.frasa.length;
        if (!terpakai.some((r) => s < r[1] && en > r[0])) { hasil.push(Object.assign({ index: s, len: e.frasa.length }, e)); terpakai.push([s, en]); }
        if (re.lastIndex === m.index) re.lastIndex++;
      }
    });
    return hasil.sort((a, b) => a.index - b.index);
  }
  function kataSebelum(text, idx) {
    const m = /([a-z]+(?:\s+saldo)?)\s*$/.exec(text.slice(0, idx));
    return m ? m[1] : '';
  }
  function cariAnggota(t, idx, ctx) {
    if (/\b(saya|aku|punyaku|milikku|ku)\b/.test(t)) return { id: ctx.saya.id, sendiri: true };
    const a = cariSemua(t, idx.anggota)[0];
    return a ? { id: a.id } : null;
  }
  function cariDompetQ(t, idx) {
    const hits = cariSemua(t, idx.dompet);
    if (!hits.length) return null;
    const f = hits[0].frasa;
    const ids = Array.from(new Set(idx.dompet.filter((e) => e.frasa === f).map((e) => e.id)));
    return ids.length > 1 ? { ambigu: ids, frasa: f } : { id: ids[0], frasa: f };
  }

  function koreksiTypo(t, idx) {
    const perubahan = [];
    const out = t.split(' ').map((w) => {
      if (w.length < 4 || !/^[a-z]+$/.test(w) || idx.known.has(w)) return w;
      let best = null, bd = 99;
      VOCAB.forEach((v) => {
        if (Math.abs(v.length - w.length) > 2) return;
        const d = lev(w, v);
        if (d < bd) { bd = d; best = v; }
      });
      const maks = w.length >= 5 ? 2 : 1;
      if (best && bd <= maks) { perubahan.push({ dari: w, ke: best }); return best; }
      return w;
    }).join(' ');
    return { teks: out, perubahan };
  }

  // ----------------------------------------------------------------
  // Angka dalam kata (hasil input suara): "dua puluh lima ribu" → 25000 (angkaKata lama di atas khusus periode), "satu setengah juta" → 1500000
  // ----------------------------------------------------------------
  const SATUAN_KATA = { nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9 };
  const SKALA_KATA = { ribu: 1e3, rb: 1e3, juta: 1e6, jt: 1e6, miliar: 1e9, milyar: 1e9 };
  const SE_KATA = { sepuluh: [10, 0], sebelas: [11, 0], seratus: [100, 0], seribu: [0, 1e3], sejuta: [0, 1e6], semiliar: [0, 1e9] };
  function angkaDariKata(teks) {
    const w = String(teks).split(' ');
    const out = [];
    let i = 0;
    while (i < w.length) {
      const k = w[i];
      const mulai = SATUAN_KATA[k] !== undefined || SE_KATA[k] || k === 'setengah';
      if (!mulai) { out.push(k); i++; continue; }
      let total = 0, h = 0, u = null, frac = 0, setengah = 0, j = i, kuat = false, koma = false, skalaAkhir = 0, hanyaSatuan = true;
      for (; j < w.length; j++) {
        const x = w[j];
        if (SATUAN_KATA[x] !== undefined) {
          if (koma) { frac = SATUAN_KATA[x] / 10; koma = false; continue; }
          if (u !== null) break;
          u = SATUAN_KATA[x]; continue;
        }
        if (x === 'koma' && u !== null && SATUAN_KATA[w[j + 1]] !== undefined && SKALA_KATA[w[j + 2]]) { koma = true; continue; }
        if (SE_KATA[x]) {
          if (u !== null) break;
          const s = SE_KATA[x]; kuat = true;
          if (s[1]) { total += (h || 1) * s[1]; h = 0; } else h += s[0];
          continue;
        }
        if (x === 'belas' && u !== null) { h += 10 + u; u = null; kuat = true; hanyaSatuan = false; continue; }
        if (x === 'puluh' && u !== null) { h += u * 10; u = null; kuat = true; hanyaSatuan = false; continue; }
        if (x === 'ratus' && u !== null) { h += u * 100; u = null; kuat = true; hanyaSatuan = false; continue; }
        if (x === 'setengah') { setengah = 0.5; continue; }
        if (SKALA_KATA[x] && (u !== null || h || setengah || frac)) {
          const g = h + (u || 0) + frac + setengah;
          total += (g || 0.5) * SKALA_KATA[x];
          h = 0; u = null; frac = 0; setengah = 0; kuat = true; skalaAkhir = SKALA_KATA[x]; hanyaSatuan = true; continue;
        }
        break;
      }
      let sisa = h + (u || 0);
      // "satu juta lima ratus lima puluh" = 1.550.000 (kata "ribu" sering tidak diucapkan); "satu juta lima" = 1.500.000
      if (sisa > 0 && sisa < 1000 && skalaAkhir >= 1e6) sisa = hanyaSatuan && sisa < 10 ? sisa * (skalaAkhir / 10) : sisa * (skalaAkhir / 1e3);
      // "jam tujuh", "tanggal lima" → angka
      if (!kuat && u !== null && j === i + 1 && /^(jam|pukul|tanggal|tgl)$/.test(out[out.length - 1] || '')) { out.push(String(u)); i = j; continue; }
      if (!kuat || (setengah && !total && !sisa)) { out.push(k); i++; continue; }
      out.push(String(Math.round(total + sisa)));
      if (setengah && j === w.length) { /* "setengah" di ujung tanpa skala diabaikan */ }
      i = j;
    }
    return out.join(' ');
  }

  // ----------------------------------------------------------------
  // Transaksi
  // ----------------------------------------------------------------
  function pecahSegmen(t) {
    // Koma yang bukan pemisah angka, titik koma, baris baru
    const kasar = [];
    let buf = '', i = 0;
    while (i < t.length) {
      const c = t[i];
      if (c === '\n' || c === ';' || (c === ',' && !(/\d/.test(t[i - 1] || '') && /\d/.test(t[i + 1] || '')))) {
        if (buf.trim()) kasar.push({ teks: buf.trim(), sep: 'koma' }); buf = ''; i++; continue;
      }
      buf += c; i++;
    }
    if (buf.trim()) kasar.push({ teks: buf.trim(), sep: 'koma' });
    // Kata sambung
    const seg = [];
    kasar.forEach((k, ki) => {
      const parts = k.teks.split(SEP_KONJ);
      parts.forEach((p, pi) => seg.push({ teks: p.trim(), sepSesudah: pi < parts.length - 1 ? 'konj' : (ki < kasar.length - 1 ? 'koma' : null) }));
    });
    // Segmen tanpa nominal yang disambung "dan" → gabung ke segmen berikutnya
    const gab = [];
    for (let j = 0; j < seg.length; j++) {
      let s = seg[j];
      while (s.sepSesudah === 'konj' && !cariNominal(tutupBukanNominal(s.teks)).length && seg[j + 1]) {
        s = { teks: s.teks + ' dan ' + seg[j + 1].teks, sepSesudah: seg[j + 1].sepSesudah }; j++;
      }
      gab.push(s);
    }
    // Satu segmen dengan beberapa nominal kuat → pecah di setiap nominal
    const akhir = [];
    gab.forEach((s) => {
      const nom = cariNominal(tutupBukanNominal(s.teks)).filter((a) => a.kuat);
      if (nom.length < 2) { akhir.push(s.teks); return; }
      let start = 0;
      nom.forEach((a, k) => {
        const end = k === nom.length - 1 ? s.teks.length : a.index + a.len;
        // kata penghubung di awal potongan ("… 100rb lalu bayar parkir 2rb") dibuang
        akhir.push(s.teks.slice(start, end).trim().replace(k ? /^(?:lalu|kemudian|habis itu|abis itu|setelah itu|terus|trus)\s+/ : /^$/, ''));
        start = end;
      });
    });
    return akhir.filter(Boolean);
  }

  function hapusRentang(text, ranges) {
    const arr = text.split('');
    ranges.forEach((r) => { for (let i = r[0]; i < r[1] && i < arr.length; i++) arr[i] = ' '; });
    return arr.join('');
  }

  function bersihkanKet(text, jenis) {
    let w = text.replace(/[^a-z0-9.\- ]/g, ' ').split(/\s+/).filter(Boolean);
    w = w.filter((x) => STOP.indexOf(x) < 0 && !/^[.\-]+$/.test(x));
    if (jenis === 'MASUK') w = w.filter((x) => KATA_MASUK_HAPUS.indexOf(x) < 0);
    while (w.length && PREP.indexOf(w[0]) > -1) w.shift();
    while (w.length && PREP.indexOf(w[w.length - 1]) > -1) w.pop();
    return w.join(' ').trim();
  }

  function segmenTransaksi(seg, ctx, idx, tglPesan) {
    const tg = tanggalTransaksi(seg, ctx.hariIni) || tglPesan;
    let s = seg;
    const buang = [];
    if (tg && tg.frasa && s.indexOf(tg.frasa) > -1) { const i = s.indexOf(tg.frasa); buang.push([i, i + tg.frasa.length]); }
    const nominal = cariNominal(tutupBukanNominal(hapusRentang(s, buang)));
    const kuat = nominal.filter((a) => a.kuat);
    const pilih = kuat[0] || nominal[0] || null;
    if (pilih) buang.push([pilih.index, pilih.index + pilih.len]);
    const tanpaNominal = hapusRentang(s, buang);

    // Jenis
    // 1.0.19: kata satuan sesudah angka ("kopi 2 gelas", "teh 3 botol") bukan petunjuk kategori, kecuali hanya itu yang ada
    const katMentah = cariSemua(tanpaNominal, idx.kat).filter((k) => !kataUmum(k.frasa));
    const satuanQty = (k) => /\d\s*$/.test(tanpaNominal.slice(0, k.index)) && RE_SATUAN_QTY.test(k.frasa);
    const katSemua = katMentah.some((k) => !satuanQty(k)) ? katMentah.filter((k) => !satuanQty(k)) : katMentah;
    const katTerpanjang = katSemua.slice().sort((a, b) => b.len - a.len)[0];
    // Fitur dompet nonaktif: hanya Tabungan yang dikenali (Tunai/Rekening/E-wallet digabung jadi satu)
    let dompetHits = ctx.fiturDompet ? cariSemua(tanpaNominal, idx.dompet) : cariSemua(tanpaNominal, idx.dompet).filter((h) => idx.dompetById[h.id] && idx.dompetById[h.id].tipe === 'TABUNGAN');
    // "pindah dana", "transfer dana", "dana masuk": di sini "dana" = uang, bukan e-wallet DANA
    const danaUmum = (hh) => hh.frasa === 'dana' && /\b(pindah|pindahin|pindahkan|transfer|tf|kirim|uang|sumber)\s+$/.test(tanpaNominal.slice(0, hh.index)) ||
      hh.frasa === 'dana' && /^\s+(masuk|keluar|darurat|cair)\b/.test(tanpaNominal.slice(hh.index + hh.len));
    dompetHits = dompetHits.filter((hh) => !danaUmum(hh));
    let pindahM = null;
    for (const e of idx.pindah) {
      const h = cari(tanpaNominal, e.frasa);
      if (!h) continue;
      // Frasa kategori yang lebih panjang & menutupi penanda (mis. "top up game") → bukan pindah
      if (katTerpanjang && katTerpanjang.len > h.len && katTerpanjang.index <= h.index && katTerpanjang.index + katTerpanjang.len >= h.index + h.len) continue;
      if (PINDAH_PERLU_DOMPET.test(e.frasa)) {
        if (!dompetHits.length) continue;
        // "kirim ke ibu 500rb via bank" bukan pindah: untuk penanda "... ke", dompet harus tepat sesudahnya
        if (/ ke$/.test(e.frasa) && !dompetHits.some((hh) => hh.index >= h.index + h.len && hh.index <= h.index + h.len + 1)) continue;
      }
      pindahM = h; break;
    }
    const awalKeluar = /^(beli|bayar|bayarin|membeli|membayar|kasih|kirim|transfer ke)\b/.test(tanpaNominal.trim());
    let masukM = null;
    if (!awalKeluar) for (const e of idx.masuk) { const h = cari(tanpaNominal, e.frasa); if (h) { masukM = h; break; } }

    let jenis = 'KELUAR';
    if (pindahM) jenis = 'PINDAH';
    else if (masukM) jenis = 'MASUK';
    else if (katTerpanjang && katTerpanjang.jenis === 'MASUK' && !awalKeluar) jenis = 'MASUK';

    const d = { teks: seg, jenis, nominal: pilih ? pilih.nilai : 0, nominalRagu: !!(pilih && !pilih.kuat), tanpaNominal: !pilih, tanggal: (tg && tg.tanggal) || ctx.hariIni };
    if (pilih && pilih.opsi) d.nominalOpsi = pilih.opsi;

    if (jenis === 'PINDAH') {
      if (!ctx.fiturDompet) {
        // Dompet digabung: yang tetap dicatat hanya nabung (Uang → Tabungan) & ambil tabungan (Tabungan → Uang)
        const tabs = ctx.dompet.filter((x) => x.aktif !== false && x.tipe === 'TABUNGAN').map((x) => x.id_dompet);
        const f0 = pindahM.frasa;
        const keTab = /nabung|celeng/.test(f0) || dompetHits.some((hh) => /\b(ke|kedalam|masuk|di|dalam)$/.test(kataSebelum(tanpaNominal, hh.index)));
        const dariTab = !keTab && /tarik|ambil|bongkar|pakai|pake/.test(f0) && (/tabungan|celengan/.test(f0) || dompetHits.length > 0);
        if (!tabs.length || !ctx.dompetUtama || (!keTab && !dariTab)) { d.pindahNonaktif = true; return d; }
        const tab = dompetHits[0] ? dompetHits[0].id : tabs[0];
        d.id_dompet = keTab ? ctx.dompetUtama : tab; d.id_dompet_tujuan = keTab ? tab : ctx.dompetUtama;
        const k0 = bersihkanKet(hapusRentang(tanpaNominal, dompetHits.map((hh) => [hh.index, hh.index + hh.len])), jenis);
        d.keterangan = U_huruf1(k0 && !/^(nabung|menabung|tarik|ambil|bongkar|simpan|masukin|ke|dari)$/.test(k0) ? k0 : keTab ? 'Nabung' : 'Ambil tabungan');
        return d;
      }
      const dk = (id) => idx.dompetById[id];
      const tipe = (tp) => ctx.dompet.filter((x) => x.aktif !== false && x.tipe === tp).map((x) => x.id_dompet);
      let tujuan = null, sumber = null;
      const f = pindahM.frasa;
      const nabung = /nabung/.test(f);
      // Dompet yang namanya bagian dari penanda ("ambil tabungan", "isi rekening") tetap dihitung
      dompetHits.forEach((hh) => {
        const prep = kataSebelum(tanpaNominal, hh.index);
        if ((/\b(ke|kedalam|masuk)$/.test(prep) || (nabung && /\b(di|dalam)$/.test(prep))) && !tujuan) tujuan = hh.id;
        else if (/\b(dari|pakai|pake|via|lewat|pakai saldo|uang|saldo)$/.test(prep) && !sumber && hh.id !== tujuan) sumber = hh.id;
      });
      const sisa = dompetHits.map((hh) => hh.id).filter((id) => id !== tujuan && id !== sumber);
      const satu = (ids) => (ids.length === 1 ? ids[0] : null);
      if (/tarik|ambil|bongkar/.test(f)) {
        // Tarik / ambil: uang keluar dari rekening / tabungan menjadi tunai
        const dariTab = /tabungan|celengan/.test(f) ? (tipe('TABUNGAN')[0] || null) : null;
        sumber = sumber || dariTab || sisa.find((id) => id !== tujuan && dk(id) && dk(id).tipe !== 'TUNAI') || null;
        tujuan = tujuan || sisa.find((id) => id !== sumber) || tipe('TUNAI')[0] || null;
        if (!sumber) sumber = satu(tipe('REKENING'));
      } else if (nabung) {
        // Nabung: masuk ke dompet Tabungan (bila ada); asal uangnya ditanyakan bila tidak disebut
        sisa.forEach((id) => { const tp = dk(id) && dk(id).tipe; if (tp === 'TABUNGAN' && !tujuan) tujuan = id; else if (!sumber && id !== tujuan) sumber = id; });
        tujuan = tujuan || tipe('TABUNGAN')[0] || tipe('REKENING')[0] || null;
      } else if (/setor/.test(f)) {
        // Setor tunai: tunai masuk ke rekening
        sumber = sumber || tipe('TUNAI')[0] || null;
        tujuan = tujuan || sisa.find((id) => id !== sumber) || satu(tipe('REKENING')) || null;
      } else {
        // top up / isi / pindah / transfer / kirim ke: tujuan = dompet sesudah penanda; asal ditanyakan bila tidak disebut
        if (!tujuan) {
          const isiDari = /^(isi|top)/.test(f) ? dompetHits.find((hh) => hh.index >= pindahM.index && hh.index <= pindahM.index + pindahM.len + 1 && hh.id !== sumber) : null;
          const sesudah = isiDari || dompetHits.find((hh) => hh.index >= pindahM.index + pindahM.len && hh.id !== sumber);
          tujuan = sesudah ? sesudah.id : (sisa[0] || null);
        }
        if (!sumber) sumber = dompetHits.map((hh) => hh.id).find((id) => id !== tujuan) || null;
      }
      d.id_dompet = sumber; d.id_dompet_tujuan = tujuan;
      d.sumberDitanya = !sumber;
      if (!tujuan || !sumber || tujuan === sumber) d.dompetRagu = true;
      const ketP = bersihkanKet(hapusRentang(tanpaNominal, dompetHits.map((hh) => {
        const prep = kataSebelum(tanpaNominal, hh.index);
        const pakaiPrep = /\b(pakai|pake|via|lewat|dari|ke|di|dengan|pakai saldo)$/.test(prep);
        return [hh.index - (pakaiPrep ? prep.length + 1 : 0), hh.index + hh.len];
      })), jenis);
      // Keterangan yang mudah dibaca bila isinya hanya kata kerja ("isi", "tarik", "pindahin")
      const nm = (id) => (dk(id) ? dk(id).nama : '');
      const verba = /^(isi|top up|topup|top-up|pindah dana|transfer dana|dana|pindah|pindahin|pindahkan|mindahin|memindahkan|dipindah|kirim|tf|transfer|tarik|ambil|ambil uang|tarik uang|setor|bongkar|masukin|masukkan|simpan|nabung|menabung|pindah uang|pindah saldo)$/;
      let label = ketP;
      if (!label || verba.test(label)) {
        const tpS = sumber && dk(sumber) ? dk(sumber).tipe : '', tpT = tujuan && dk(tujuan) ? dk(tujuan).tipe : '';
        label = nabung || tpT === 'TABUNGAN' ? 'Nabung' : tpS === 'TABUNGAN' ? 'Ambil tabungan' : /setor/.test(f) ? 'Setor tunai'
          : /tarik|ambil/.test(f) && tpT === 'TUNAI' ? 'Tarik tunai' : /^(isi|top)/.test(f) && tujuan ? 'Top up ' + nm(tujuan) : 'Pindah saldo';
      }
      d.keterangan = U_huruf1(label);
      return d;
    }

    // Kategori sesuai jenis (frasa terpanjang menang)
    const kandidat = katSemua.filter((k) => k.jenis === jenis).sort((a, b) => b.len - a.len);
    const kat = kandidat.find((k) => KAT_PRIORITAS(k.target, idx.katAktif[k.target])) || kandidat[0];
    d.id_kategori = kat ? kat.target : (jenis === 'MASUK' ? ctx.kategoriDefaultMasuk : ctx.kategoriDefaultKeluar);
    d.kategoriDikenal = !!kat;
    d.frasaKategori = kat ? kat.frasa : '';
    if (jenis === 'KELUAR') urusGanda(tanpaNominal, kat, d, idx, ctx);
    if (kat && !d.ganda && d.nominal > 0 && !d.nominalRagu) {
      // Nominal jauh dari kebiasaan ("kopi 500rb" padahal biasanya 25rb) → dikonfirmasi
      const xs = riwayatNominal(ctx, kat.frasa, d.id_kategori);
      if (xs.length >= 3) { const m = median(xs); if (d.nominal >= m * 10 || d.nominal * 10 <= m) d.nominalJanggal = { biasa: m }; }
    }

    // Dompet
    if (ctx.fiturDompet) {
      let pilihD = dompetHits[0] || null;
      const pref = dompetHits.find((hh) => /\b(pakai|pake|via|lewat|dari|ke|di|dengan|pakai saldo)$/.test(kataSebelum(tanpaNominal, hh.index)));
      if (pref) pilihD = pref;
      if (pilihD && idsFrasa(idx, pilihD.frasa).length > 1) {
        const amb = idsFrasa(idx, pilihD.frasa);
        const tunggal = dompetHits.find((hh) => { const x = idsFrasa(idx, hh.frasa); return x.length === 1 && amb.indexOf(x[0]) > -1; });
        if (tunggal) pilihD = tunggal;
      }
      d.dompetDisebut = !!pilihD;
      if (pilihD) {
        const ids = idsFrasa(idx, pilihD.frasa);
        if (ids.length > 1) { d.id_dompet = ''; d.dompetPilihan = ids; }        // mis. "bank" padahal ada 2 rekening
        else d.id_dompet = pilihD.id;
      } else if (ctx.saya.id_dompet_default === 'TANYA') {
        d.id_dompet = ''; d.tanyaDompet = true;                                    // default "Tanya dulu"
      } else {
        d.id_dompet = ctx.saya.id_dompet_default && idx.dompetById[ctx.saya.id_dompet_default] ? ctx.saya.id_dompet_default : (ctx.dompet.find((x) => x.aktif !== false && x.tipe !== 'TABUNGAN') || {}).id_dompet || '';
      }
      // "masuk rekening 2jt": bisa pemasukan, bisa pindahan dari tunai → ditanyakan
      if (jenis === 'MASUK' && (!kat || kat.target === ctx.kategoriDefaultMasuk) && masukM && MASUK_UMUM.test(masukM.frasa) && d.dompetDisebut && d.id_dompet) d.tanyaJenis = true;
    } else d.id_dompet = (dompetHits[0] && dompetHits[0].id) || ctx.dompetUtama || '';

    const rangesDompet = (ctx.fiturDompet ? dompetHits : cariSemua(tanpaNominal, idx.dompet)).map((hh) => {
      const prep = kataSebelum(tanpaNominal, hh.index);
      const pakaiPrep = /\b(pakai|pake|via|lewat|dari|ke|di|dengan|pakai saldo)$/.test(prep);
      return [hh.index - (pakaiPrep ? prep.length + 1 : 0), hh.index + hh.len];
    });
    let ket = bersihkanKet(hapusRentang(tanpaNominal, rangesDompet), jenis);
    if (!ket) {
      const kk = idx.katAktif[d.id_kategori];
      ket = kat ? kat.frasa : (kk ? kk.nama : 'Transaksi');
    }
    d.keterangan = U_huruf1(ket);
    d.frasaBelajar = ket.split(' ').slice(0, 3).join(' ');
    if (!kat && (kataUmum(d.frasaBelajar) || kataUmum(ket))) d.frasaBelajar = 'belanja';
    if (d.ganda) d.frasaBelajar = d.frasaKonteks || '';
    return d;
  }
  // ----------------------------------------------------------------
  // Kata bermakna ganda ("air", "token", "obat"...)
  // ----------------------------------------------------------------
  const median = (xs) => { const a = xs.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
  function riwayatNominal(ctx, kata, katId) {
    if (typeof ctx.riwayat !== 'function') return [];
    return (ctx.riwayat(kata) || []).filter((x) => x.kat === katId && x.nominal > 0).map((x) => x.nominal);
  }
  const ABAIKAN_KONTEKS = ['ini', 'itu', 'dan', 'buat', 'untuk', 'sama', 'lagi', 'tadi', 'juga', 'yang', 'aja', 'saja', 'dong', 'nih', 'ya', 'sih', 'pagi', 'siang', 'sore', 'malam'];
  /** Frasa berkonteks untuk diingat: kata sesudahnya ("air depot") atau kata kerja sebelumnya ("beli air") */
  function frasaKonteks(teks, w, idx) {
    const kata = teks.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    const i = kata.indexOf(w);
    if (i < 0) return '';
    const nx = kata[i + 1];
    const bukan = (x) => !x || x.length < 2 || /\d/.test(x) || STOP.indexOf(x) > -1 || PREP.indexOf(x) > -1 || ABAIKAN_KONTEKS.indexOf(x) > -1 || VOCAB.indexOf(x) > -1 ||
      idx.dompet.some((e) => e.frasa === x) || idx.anggota.some((e) => e.frasa === x);
    if (!bukan(nx)) return w + ' ' + nx;
    const verba = kata.slice(0, i).reverse().find((x) => /^(beli|membeli|bayar|bayarin|membayar|isi|lunasi|borong)$/.test(x));
    return verba ? verba + ' ' + w : '';
  }
  function urusGanda(teks, kat, d, idx, ctx) {
    const hits = idx.ganda.filter((x) => x.kata.some((w) => ada(teks, w)));
    if (!hits.length) return;
    let gx = kat ? hits.find((h) => h.kata.some((w) => ada(kat.frasa, w))) : null;
    if (!gx) {
      // Kategori sudah ditentukan kata lain yang tidak berhubungan → biarkan
      if (kat && !hits.some((h) => h.opsi.some((o) => o.kat === kat.target))) return;
      gx = hits[0];
    }
    const w = gx.kata.find((x) => ada(teks, x));
    const opsi = gx.opsi.map((o) => Object.assign({}, o, { skor: 0 }));
    const opsiDari = (id, tambah) => {
      let o = opsi.find((x) => x.kat === id);
      if (!o && tambah && idx.katAktif[id] && idx.katAktif[id].jenis === 'KELUAR') { o = { kat: id, label: idx.katAktif[id].nama, ciri: [], kerja: [], skor: 0 }; opsi.push(o); }
      return o;
    };
    // Kamus: frasa yang memuat kata ini (hasil belajar = kuat), kata lain yang menunjuk salah satu pilihan
    const dipakai = new Set();
    idx.kat.forEach((e) => {
      if (dipakai.has(e.frasa + '>' + e.target) || !ada(teks, e.frasa)) return;
      dipakai.add(e.frasa + '>' + e.target);
      if (ada(e.frasa, w)) { const o = opsiDari(e.target, true); if (o) o.skor += e.frasa === w ? 1 : (e.sumber === 'BELAJAR' || e.sumber === 'MANUAL' ? 4 : 2); }
      else if (!kataUmum(e.frasa)) { const o = opsiDari(e.target, false); if (o) o.skor += 2; }
    });
    if (opsi.length < 2) return;
    const adaCiri = opsi.some((o) => (o.ciri || []).some((c) => c !== w && ada(teks, c)));
    opsi.forEach((o) => {
      if ((o.ciri || []).some((c) => c !== w && ada(teks, c))) o.skor += 4;
      if ((o.kerja || []).some((k) => ada(teks, k))) o.skor += 2;
      if (d.nominal > 0 && ((o.min && d.nominal >= o.min) || (o.maks && d.nominal <= o.maks))) o.skor += 1;
      if (o.bawaan && !adaCiri) o.skor += 2;
      // Riwayat: nominal mirip kebiasaan di kategori ini → menguatkan; jauh berbeda → melemahkan
      const xs = d.nominal > 0 ? riwayatNominal(ctx, w, o.kat) : [];
      if (xs.length) {
        const m = median(xs);
        if (d.nominal >= m / 2.5 && d.nominal <= m * 2.5) o.skor += 3;
        else if (d.nominal < m / 4 || d.nominal > m * 4) o.skor -= 1;
      }
    });
    opsi.sort((a, b) => b.skor - a.skor);
    const a = opsi[0], b = opsi[1];
    d.ganda = w;
    d.frasaKonteks = frasaKonteks(teks, w, idx);
    d.id_kategori = a.kat; d.kategoriDikenal = true;
    if (a.skor >= 2 && a.skor - b.skor >= 2) return;
    d.kategoriRagu = { kata: w, tanya: gx.tanya, opsi: opsi.slice(0, 4).map((o) => ({ kat: o.kat, label: o.label })) };
  }

  /** Nama kategori dari teks bebas ("bulanan", "tagihan", "transport") → daftar id */
  function cariKategoriNama(s, ctx) {
    const idx = siapkan(ctx);
    s = normal(s).replace(/["“”']/g, '').replace(/^(kategori|ke|jadi|dalam)\s+/, '').replace(/(\s+(ya|yah|dong|aja|saja|selalu|terus|kategori|nya|deh|ok|oke))+$/, '').trim();
    if (!s) return [];
    const aktif = Object.values(idx.katAktif);
    const nk = (k) => normal(k.nama).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    let r = aktif.filter((k) => nk(k) === s);
    if (r.length) return r.map((k) => k.id_kategori);
    const ws = s.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !/^(dan|yang|untuk|buat)$/.test(w));
    r = aktif.filter((k) => ws.length && ws.every((w) => nk(k).split(' ').some((x) => x === w || (w.length >= 4 && x.indexOf(w) === 0) || (w.length >= 5 && lev(x, w) <= (w.length >= 7 ? 2 : 1)))));
    if (r.length) return r.map((k) => k.id_kategori);
    return Array.from(new Set(idx.kat.filter((e) => e.frasa === s).map((e) => e.target)));
  }

  /** Frasa yang dipakai untuk belajar dari koreksi: analisis ulang teks asli transaksinya */
  function frasaIngat(teksAsli, keterangan, ctx) {
    const fallback = { frasa: normal(keterangan).split(' ').slice(0, 3).join(' '), ganda: '' };
    if (!teksAsli) return fallback;
    try {
      const r = analisis(teksAsli, ctx);
      if (r.type !== 'transaksi' || !r.drafts.length) return fallback;
      const d = r.drafts.find((x) => normal(x.keterangan) === normal(keterangan)) || (r.drafts.length === 1 ? r.drafts[0] : null);
      if (!d) return fallback;
      if (d.ganda) return { frasa: d.frasaKonteks || '', ganda: d.ganda };
      return { frasa: d.frasaBelajar || fallback.frasa, ganda: '' };
    } catch (e) { return fallback; }
  }

  function idsFrasa(idx, f) { return Array.from(new Set(idx.dompet.filter((e) => e.frasa === f).map((e) => e.id))); }

  /** Pernyataan saldo: "saldo bank sekarang 5jt", "kas saya tinggal 300rb", "uang tunai ada 1,2jt" */
  const ISI_SALDO = /^(saya|aku|ku|gue|gw|kita|kami|di|ke|dalam|yang|punya|milik|dompet|uang|duit|uangku|duitku|uangnya|duitnya|nya|ini|itu|sudah|udah|sdh|masih|sekarang|skrg|skg|saat|tinggal|tersisa|sisa|sisanya|ada|jadi|menjadi|totalnya|total|cuma|hanya|tersedia|terkini|lagi|kok|nih|ya|dong|sih|pas|sekitar|kurang|lebih|semua|jumlah|rp|rupiah|kas|tunai)$/;
  function pernyataanSaldo(t0, ctx, idx) {
    if (/\b(berapa|brp)\b/.test(t0)) return null;
    if (/^(beli|bayar|bayarin|membeli|membayar|kasih|kirim|transfer)\b/.test(t0)) return null;
    if (idx.pindah.some((e) => ada(t0, e.frasa))) return null;                   // "isi saldo", "top up", "pindah saldo"
    const kataKeadaan = /\b(sekarang|skrg|skg|saat ini|tinggal|tersisa|sisa|sisanya|ada|jadi|menjadi|totalnya|total|cuma|hanya|masih|tersedia|terkini)\b/.test(t0);
    const kataSaldo = /\bsaldo(ku|nya)?\b/.test(t0) || (/\bkas\b/.test(t0) && kataKeadaan);
    const kataUang = /\b(uang|duit|uangku|duitku|uangnya|duitnya)\b/.test(t0) && kataKeadaan;
    // Tanpa kata "saldo/uang": cukup nama dompet + kata keadaan ("rekening saya sekarang 5jt", "di bank ada 5jt", "tunai sisa 200rb")
    const adaKat = cariSemua(t0, idx.kat).some((k) => !/^(uang|duit|saldo|tabungan|kas)$/.test(k.frasa));
    const adaMasuk = idx.masuk.some((e) => ada(t0, e.frasa));
    // Tanpa kata "saldo": selain dompet, nominal & kata keadaan tidak boleh ada kata lain ("biaya admin rekening jadi 10rb" = transaksi)
    const polos = () => {
      const rentang = cariNominal(tutupBukanNominal(t0)).map((x) => [x.index, x.index + x.len]).concat(cariSemua(t0, idx.dompet).map((h) => [h.index, h.index + h.len]));
      return hapusRentang(t0, rentang).split(/[^a-z0-9]+/).filter((w) => w && !ISI_SALDO.test(w)).length === 0;
    };
    const kataDompet = kataKeadaan && !adaKat && !adaMasuk && cariSemua(t0, idx.dompet).length > 0 && polos();
    if (!kataSaldo && !kataUang && !kataDompet) return null;
    if (!kataSaldo && (adaKat || adaMasuk || !polos())) return null;                          // "uang jajan sisa 20rb", "uang masuk ada 1jt" bukan saldo
    const items = [];
    pecahSegmen(t0).forEach((sg) => {
      const nom = cariNominal(tutupBukanNominal(sg)).filter((a) => a.kuat);
      if (!nom.length) return;
      const tanpa = hapusRentang(sg, [[nom[0].index, nom[0].index + nom[0].len]]);
      const hit = cariSemua(tanpa, idx.dompet)[0];
      const it = { nominal: nom[0].nilai, teks: sg };
      if (hit) { const ids = idsFrasa(idx, hit.frasa); if (ids.length > 1) it.pilihan = ids; else it.id_dompet = hit.id; }
      items.push(it);
    });
    if (!items.length) return null;
    if (!kataSaldo && !kataUang && items.some((x) => !x.id_dompet && !x.pilihan)) return null;
    return { type: 'saldo_set', items };
  }

  /** Dompet yang disebut dalam jawaban singkat ("tunai", "pakai bri") */
  function dompetDari(text, ctx) {
    const idx = siapkan(ctx);
    const hit = cariSemua(normal(text), idx.dompet)[0];
    return hit ? idsFrasa(idx, hit.frasa) : [];
  }
  function U_huruf1(s) { s = String(s || '').trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; }

  // ----------------------------------------------------------------
  // Obrolan ringan & mengajari CashKu
  // ----------------------------------------------------------------
  const EKOR = '(?:\\s+(?:ya|yah|ya cashku|cashku|kak|bang|banget|bgt|sekali|deh|dong|nih|kamu|sayang|bos|min))*';
  const RE_OBROL = [
    ['makasih', new RegExp('^(?:makasih|makasi|makasihh+|mksh|mkasih|terima ?kasih|trimakasih|terimakasih banyak|trims|tq|ty|thx|thanks|thank you|thankyou|tengkyu|nuhun|matur nuwun)(?:\\s+banyak)?' + EKOR + '$')],
    ['salam', new RegExp("^(?:assalamu ?'?alaikum|asalamualaikum|assalamualaikum warahmatullahi wabarakatuh|ass?alamu'?alaikum wr wb|salam)" + EKOR + '$')],
    ['sapa', new RegExp('^(?:halo+|hallo+|helo+|hai+|hi+|hey+|hei+|pagi|siang|sore|malam|met (?:pagi|siang|sore|malam)|selamat (?:pagi|siang|sore|malam))' + EKOR + '$')],
    ['siapa', /^(?:kamu siapa|siapa kamu|kamu itu apa|kamu apa|nama kamu(?: siapa)?|siapa namamu|namamu siapa|kenalan(?: dong)?|kamu bisa apa(?: aja| saja)?|bisa apa(?: aja| saja)?)\??$/],
    ['kabar', /^(?:apa kabar|gimana kabar(?:mu|nya)?|kabarmu gimana|kabar(?:nya)? gimana|how are you)\??$/],
    ['puji', new RegExp('^(?:pintar|pinter|hebat|keren|mantap jiwa|good job|cerdas|top|luar biasa|kamu (?:pintar|pinter|hebat|keren))' + EKOR + '$')],
    ['ok', new RegExp('^(?:ok|oke+|okey|okay|okeh|sip+|siap|mantap|mantab|mantul|good|nice|baik|baiklah|yap|yup|noted|wkwk+|haha+|hehe+|hihi+|👍+|🙏+)' + EKOR + '$')]
  ];
  function obrolan(t0) {
    const s = t0.replace(/[!.,~]+/g, ' ').replace(/\s+/g, ' ').trim();
    for (const [jenis, re] of RE_OBROL) if (re.test(s)) return { type: 'obrolan', jenis, waktu: (/(pagi|siang|sore|malam)/.exec(s) || [])[1] || '' };
    return null;
  }
  const RE_AJARI = [
    { re: /^(?:tolong\s+)?(?:ingat(?:kan|in)?|inget(?:in)?|catat|simpan)\s+(?:ya\s+|yah\s+|bahwa\s+|kalau\s+|kalo\s+|kata\s+)*(.+?)\s+(?:itu\s+|tuh\s+|tu\s+)?(?:masuk(?:nya|in|kan)?(?:\s+(?:ke|kategori|ke kategori))?|sebagai|ke|termasuk|jadi|=)\s+(.+)$/, tegas: /^(?:tolong\s+)?(?:ingat|inget)/ },
    { re: /^(?:mulai sekarang\s+|nanti\s+|lain kali\s+|besok besok\s+)?(?:kalau|kalo|jika|setiap|tiap)\s+(?:ada\s+|aku\s+|saya\s+)?(?:tulis\s+|ketik\s+|chat\s+|bilang\s+)?(.+?)\s+(?:itu\s+|tuh\s+)?(?:masuk(?:nya|in|kan)?(?:\s+(?:ke|kategori|ke kategori))?|ke kategori|termasuk)\s+(.+)$/ },
    { re: /^(.+?)\s+(?:itu|tuh)\s+(?:masuk(?:nya)?\s+(?:ke\s+)?)?(?:kategori|termasuk)\s+(.+)$/, tegas: /./ }
  ];
  function ajari(t0, ctx) {
    if (cariNominal(tutupBukanNominal(t0)).some((a) => a.kuat)) return null;
    let m;
    if ((m = /^(?:tolong\s+)?(?:lupakan|lupain|lupakanlah|hapus kata|hapus ingatan|jangan ingat)\s+(?:kata\s+)?(.+?)(?:\s+(?:ya|yah|dong|aja|saja|lagi))*$/.exec(t0))) {
      const f = m[1].replace(/["“”']/g, '').trim();
      return f ? { type: 'lupakan', frasa: f } : null;
    }
    for (const r of RE_AJARI) {
      if (!(m = r.re.exec(t0))) continue;
      const frasa = m[1].replace(/["“”']/g, '').replace(/^(kata|yang|kalau|kalo)\s+/, '').replace(/\s+(itu|tuh|tu)$/, '').trim();
      if (!frasa || frasa.split(' ').length > 5) continue;
      if (/^(apa|apaan|mana|yang mana)\b/.test(m[2])) return { type: 'tanyaKata', frasa };
      const kandidat = cariKategoriNama(m[2], ctx);
      if (!kandidat.length && !(r.tegas && r.tegas.test(t0))) continue;
      return { type: 'ajari', frasa, kandidat, namaKat: m[2].replace(/(\s+(ya|yah|dong|aja|saja|selalu|terus|deh))+$/, '').trim() };
    }
    return null;
  }

  // ----------------------------------------------------------------
  // Toleransi salah ketik (tanpa AI): kemiripan kata
  // ----------------------------------------------------------------
  /** Huruf berulang ("beliii", "brpppp") dan kamus typo hasil belajar */
  function rapikan(t, idx) {
    t = t.replace(/([a-z])\1{2,}/g, '$1');
    if (!idx.typo) return t;
    return t.split(' ').map((w) => idx.typo[w] || w).join(' ');
  }
  /** Jarak Damerau–Levenshtein (huruf tertukar dihitung 1) */
  function osa(a, b) {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 3) return 9;
    const d = [];
    for (let i = 0; i <= m; i++) { d[i] = [i]; }
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[m][n];
  }
  const rangka = (w) => w.replace(/[aiueo]/g, '');
  function urutanBagian(w, c) { let j = 0; for (let i = 0; i < c.length && j < w.length; i++) if (c[i] === w[j]) j++; return j === w.length; }
  /** "bnsin" → "bensin", "byr" → "bayar", "pengeluran" → "pengeluaran": huruf hidup dihilangkan */
  const vokalHilang = (w, c) => w.length < c.length && rangka(w) === rangka(c) && rangka(w).length >= 2 && urutanBagian(w, c);
  const BARIS_KEY = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  function tetangga(x, y) {
    for (let r = 0; r < 3; r++) {
      const i = BARIS_KEY[r].indexOf(x);
      if (i < 0) continue;
      if (BARIS_KEY[r][i - 1] === y || BARIS_KEY[r][i + 1] === y) return true;
      const atas = BARIS_KEY[r - 1] || '', bawah = BARIS_KEY[r + 1] || '';
      return [atas[i], atas[i + 1], bawah[i], bawah[i - 1]].indexOf(y) > -1;
    }
    return false;
  }
  /** Skor 0–1: seberapa yakin kata w adalah salah ketik dari kata c */
  function skorKandidat(w, c, verba) {
    if (w === c) return 1;
    if (w[0] !== c[0] && !(w[0] === c[1] && w[1] === c[0])) return 0;   // huruf pertama jarang salah
    if (vokalHilang(w, c)) return c.length - w.length <= 2 || w.length >= 5 ? 0.95 : 0.88;
    const d = osa(w, c);
    if (d === 1) {
      if (w.length === c.length + 1) return verba ? 0.9 : (w.length >= 5 ? 0.9 : 0.78);                    // huruf lebih: "kopii"
      if (w.length === c.length - 1) return verba ? 0.9 : (w.length >= 5 ? 0.88 : w.length === 4 ? 0.75 : 0.6); // huruf kurang: "listrk"
      let k = 0; while (k < w.length && w[k] === c[k]) k++;
      if (k < w.length - 1 && w[k] === c[k + 1] && w[k + 1] === c[k]) return verba ? 0.9 : (w.length >= 5 ? 0.88 : 0.75); // tertukar: "kpoi"
      // Huruf diganti: untuk kata benda TIDAK dipaksa ("pentol" bukan "pentil") — hanya kata kerja di awal kalimat & kata laporan
      if (verba) return 0.9;
      if (VOCAB_SET.has(c) && w.length >= 5) return tetangga(w[k], c[k]) ? 0.9 : 0.8;
      return w.length >= 7 && tetangga(w[k], c[k]) ? 0.7 : 0.5;
    }
    if (d === 2 && w.length >= 7) return verba || VOCAB_SET.has(c) ? 0.8 : 0.66;
    return 0;
  }
  /** Koreksi per kata: yakin → langsung diganti; setengah yakin → dikumpulkan untuk ditanyakan */
  function koreksi(t, idx, at, abaikan) {
    const kata = t.split(' ');
    const yakin = [], ragu = [];
    const out = kata.map((w, i) => {
      if (!/^[a-z]+$/.test(w) || w.length < at.typo_min_huruf || idx.known.has(w) || (abaikan && abaikan.indexOf(w) > -1)) return w;
      const awal = i === 0 || /^(tolong|tadi|barusan|habis|abis|sudah|saya|aku|mau|baru)$/.test(kata[i - 1]);
      const lanjut = kata.slice(i + 1).some((x) => /^[a-z]{2,}$/.test(x));
      let best = null, second = null;
      for (const c of idx.vocab) {
        if (Math.abs(c.length - w.length) > 3) continue;
        const sk = skorKandidat(w, c, awal && lanjut && VERBA_SET.has(c));
        if (sk <= 0) continue;
        if (!best || sk > best.s) { second = best; best = { c, s: sk }; } else if (!second || sk > second.s) second = { c, s: sk };
      }
      if (!best) return w;
      let sk = best.s;
      if (second && second.s >= sk - 0.05) sk -= 0.15;                     // dua kandidat sama kuat → kurang yakin
      if (sk >= at.typo_ambang_yakin) { yakin.push({ dari: w, ke: best.c, skor: +sk.toFixed(2) }); return best.c; }
      if (sk >= at.typo_ambang_ragu) ragu.push({ dari: w, ke: best.c, skor: +sk.toFixed(2), i });
      return w;
    });
    return { teks: out.join(' '), yakin, ragu, kata: out };
  }
  function kualitas(r) {
    if (!r) return 0;
    if (r.type === 'transaksi') return r.drafts.reduce((a, d) => a + (d.kategoriDikenal && !d.kategoriRagu ? 3 : d.kategoriDikenal ? 2 : 0) + (d.nominal > 0 ? 1 : 0), 0) / Math.max(1, r.drafts.length);
    if (r.type === 'tanya') return r.metric === 'kurang' ? 1 : 3;
    if (r.type === 'tidak_dikenal' || r.type === 'kosong') return 0;
    if (r.type === 'maksud') return r.dikenal ? 2 : 0.5;
    return 2.5;
  }

  // ----------------------------------------------------------------
  // Maksud pesan: pertanyaan kategori / harga
  // ----------------------------------------------------------------
  const KATA_TANYA_RE = /\b(berapa|brapa|berapakah|apa|apaan|apakah|kapan|mana|dimana|gimana|bagaimana|siapa|kenapa|mengapa)\b/;
  const EKOR_TANYA = /^(ya|sih|dong|kah|aja|saja|nih|tuh|yah|ini|itu|sekarang)$/;
  const RE_FRASA_KAT = [
    /^(?:kalau\s+|kata\s+)?(.+?)\s+(?:itu\s+|tuh\s+|tu\s+|ini\s+)?(?:termasuk|masuk|tergolong|ikut|kategori(?:nya)?)\s+(?:ke\s+|dalam\s+|di\s+)?(?:kategori\s+)?(?:apa|apaan|mana|yang mana)\b/,
    /^(?:kategori(?:nya)?|masuk kategori|termasuk kategori)\s+(?:apa|mana)\s+(?:sih\s+)?(?:untuk\s+|buat\s+)?(.+?)$/,
    /^(.+?)\s+(?:itu\s+)?kategorinya\s+(?:apa|mana)\b/
  ];
  function frasaKategoriQ(t) {
    const s = t.replace(/[?!.]+/g, ' ').replace(/\s+/g, ' ').trim();
    for (const re of RE_FRASA_KAT) {
      const m = re.exec(s);
      if (!m) continue;
      const f = m[1].replace(/^(beli|bayar|kata|kalau)\s+/, '').replace(/\s+(itu|tuh|ini|sih|ya)$/, '').trim();
      if (f && f.split(' ').length <= 4 && !/\d/.test(f)) return f;
    }
    return '';
  }
  function frasaHargaQ(t) {
    if (!/\bharga(?:nya)?\b/.test(t)) return '';
    if (!KATA_TANYA_RE.test(t) && !/\?/.test(t) && !/\b(biasanya|terakhir|rata)/.test(t)) return '';
    const item = t.replace(/\b(harga(?:nya)?|berapa|brapa|apa|sih|ya|kah|biasanya|terakhir|rata(?:\s*-?\s*rata)?|sekarang|dong|nih|kalau|beli|untuk|buat|satu|se|sebuah|per|biasa)\b/g, ' ')
      .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    return item && item.split(' ').length <= 4 && !/\d/.test(item) ? item : '';
  }

  // ----------------------------------------------------------------
  // Catatan data (ingatan): "ingat rekening bri istri 1111", "rek istri", "no listrik"
  // Label dipecah jadi kata kunci (jenis, lembaga, pemilik); urutan bebas, kata sambung diabaikan,
  // singkatan dari sheet Alias_Catatan, salah ketik ditoleransi.
  // ----------------------------------------------------------------
  // [kata baku, kelompok, alias...]  (sheet Alias_Catatan menambah/menimpa daftar ini)
  const ALIAS_BAWAAN = [
    ['rekening', 'JENIS', 'rek', 'norek', 'rekening', 'rekn', 'reking'], ['nomor', 'UMUM', 'no', 'nmr', 'nomer', 'nmor', 'nomor', 'nomr', 'nombor'],
    ['pln', 'JENIS', 'pln', 'listrik', 'token', 'meteran', 'idpel'], ['telepon', 'JENIS', 'hp', 'telp', 'telpon', 'telepon', 'handphone', 'nohp', 'wa', 'whatsapp', 'ponsel'],
    ['password', 'JENIS', 'password', 'pass', 'pw', 'sandi', 'katasandi'], ['email', 'JENIS', 'email', 'mail', 'surel', 'gmail'], ['alamat', 'JENIS', 'alamat', 'almt'],
    ['pdam', 'JENIS', 'pdam'], ['wifi', 'JENIS', 'wifi', 'wi-fi'], ['pin', 'JENIS', 'pin'], ['ktp', 'JENIS', 'ktp'], ['nik', 'JENIS', 'nik'], ['npwp', 'JENIS', 'npwp'], ['kk', 'JENIS', 'kk'],
    ['bpjs', 'JENIS', 'bpjs'], ['stnk', 'JENIS', 'stnk'], ['bpkb', 'JENIS', 'bpkb'], ['plat', 'JENIS', 'plat', 'nopol'], ['akun', 'JENIS', 'akun', 'username', 'user'],
    ['kartu', 'JENIS', 'kartu'], ['polis', 'JENIS', 'polis'], ['va', 'JENIS', 'va'], ['pelanggan', 'JENIS', 'pelanggan'], ['kode', 'JENIS', 'kode'],
    ['bri', 'LEMBAGA', 'bri', 'brimo'], ['bca', 'LEMBAGA', 'bca'], ['bni', 'LEMBAGA', 'bni'], ['mandiri', 'LEMBAGA', 'mandiri', 'mdr'], ['bsi', 'LEMBAGA', 'bsi'],
    ['btn', 'LEMBAGA', 'btn'], ['cimb', 'LEMBAGA', 'cimb'], ['permata', 'LEMBAGA', 'permata'], ['danamon', 'LEMBAGA', 'danamon'], ['jago', 'LEMBAGA', 'jago'],
    ['seabank', 'LEMBAGA', 'seabank'], ['blu', 'LEMBAGA', 'blu'], ['jenius', 'LEMBAGA', 'jenius'], ['ocbc', 'LEMBAGA', 'ocbc'], ['muamalat', 'LEMBAGA', 'muamalat'],
    ['bjb', 'LEMBAGA', 'bjb'], ['bpd', 'LEMBAGA', 'bpd'], ['dana', 'LEMBAGA', 'dana'], ['ovo', 'LEMBAGA', 'ovo'], ['gopay', 'LEMBAGA', 'gopay'],
    ['shopeepay', 'LEMBAGA', 'shopeepay', 'spay'], ['linkaja', 'LEMBAGA', 'linkaja'], ['telkomsel', 'LEMBAGA', 'telkomsel', 'tsel'], ['indosat', 'LEMBAGA', 'indosat', 'im3'],
    ['xl', 'LEMBAGA', 'xl'], ['smartfren', 'LEMBAGA', 'smartfren'], ['indihome', 'LEMBAGA', 'indihome'], ['biznet', 'LEMBAGA', 'biznet'],
    ['saya', 'PEMILIK', 'saya', 'aku', 'ku', 'sendiri', 'gue', 'gw', 'sy'], ['istri', 'PEMILIK', 'istri', 'istriku', 'bini', 'nyonya'], ['suami', 'PEMILIK', 'suami', 'suamiku'],
    ['ayah', 'PEMILIK', 'ayah', 'bapak', 'papa', 'papah', 'abah', 'abi', 'bapa'], ['ibu', 'PEMILIK', 'ibu', 'bunda', 'mama', 'mamah', 'umi', 'emak', 'mamak'],
    ['anak', 'PEMILIK', 'anak'], ['kakak', 'PEMILIK', 'kakak', 'kak'], ['adik', 'PEMILIK', 'adik', 'adek', 'dek'], ['nenek', 'PEMILIK', 'nenek'], ['kakek', 'PEMILIK', 'kakek'],
    ['mertua', 'PEMILIK', 'mertua']
  ];
  const HURUF_BESAR = new Set(['pln', 'pdam', 'pin', 'ktp', 'nik', 'npwp', 'kk', 'bpjs', 'stnk', 'bpkb', 'va', 'xl', 'id']);
  const LEMAH = new Set(['nomor', 'data', 'catatan', 'info', 'informasi']);       // boleh tidak cocok
  // kata sambung yang diabaikan (punya, milik, atas nama, yang, si, ...)
  const SAMBUNG = /^(punya|punyaku|punyanya|milik|milikku|miliknya|atas|nama|an|yang|si|sang|untuk|buat|di|ke|dari|ya|dong|tolong|nya|kamu|sih|tuh|itu|ini|berapa|brp|apa|mana|lihat|liat|cek|minta|kasih|kasi|sebutkan|tau|tahu|lagi|sekarang|coba|deh|nih|dong|ingat|inget|ada|tidak|nggak|gak|ga|dan|atau|kita|kami|mohon|please|plis|bang|min)$/;
  let ALIAS = null, ALIAS_KEY = '';
  function petaAlias(ctx) {
    const rows = (ctx && ctx.aliasCatatan) || [];
    const key = rows.length + ':' + rows.map((r) => r.alias + '=' + r.kata).join('|');
    if (ALIAS && ALIAS_KEY === key) return ALIAS;
    const peta = {}, kel = {};
    ALIAS_BAWAAN.forEach((r) => { kel[r[0]] = r[1]; r.slice(2).forEach((a) => { peta[a] = r[0]; }); peta[r[0]] = r[0]; });
    rows.forEach((r) => {
      const a = normal(r.alias), k = normal(r.kata);
      if (!a || !k || r.aktif === false) return;
      peta[a] = k; if (!peta[k]) peta[k] = k;
      if (r.kelompok) kel[k] = String(r.kelompok).toUpperCase(); else if (!kel[k]) kel[k] = 'JENIS';
    });
    ALIAS = { peta, kel, kunci: Object.keys(peta).filter((w) => w.length >= 5) }; ALIAS_KEY = key;
    return ALIAS;
  }
  /** Kata → bentuk baku. "rekeningku" → rekening, "rekning" → rekening (salah ketik) */
  function bakuKata(w, A) {
    if (A.peta[w]) return A.peta[w];
    const m = /^(.{3,}?)(ku|nya|mu)$/.exec(w);
    if (m && A.peta[m[1]]) return A.peta[m[1]];
    if (w.length >= 5) { const k = A.kunci.find((a) => a[0] === w[0] && osa(a, w) <= 1); if (k) return A.peta[k]; }
    return w;
  }
  /** Teks → kata kunci baku [{k, g}] (angka & kata sambung dibuang) */
  function kataKunci(s, A) {
    const t = normal(s).replace(/\ba\s*\.?\s*n\b\.?/g, ' ').replace(/\batas\s+nama\b/g, ' ').replace(/\bno\s*\.\s*/g, 'no ').replace(/[^a-z0-9 \-]/g, ' ');
    return t.split(/\s+/).filter((w) => w && w.length >= 2 && !/\d/.test(w) && !SAMBUNG.test(w)).map((w) => {
      const k = bakuKata(w, A);
      return { k, g: LEMAH.has(k) ? 'UMUM' : (A.kel[k] || 'LAIN') };
    });
  }
  /** Struktur catatan dari labelnya */
  function strukturCatatan(label, ctx) {
    const A = petaAlias(ctx), kk = kataKunci(label, A);
    const ambil = (g) => kk.filter((x) => x.g === g).map((x) => x.k);
    const pemilik = ambil('PEMILIK').filter((w) => w !== 'saya').concat(ambil('LAIN'));
    return { jenis: ambil('JENIS'), lembaga: ambil('LEMBAGA'), pemilik, saya: kk.some((x) => x.k === 'saya'), kata: kk.map((x) => x.k),
      kunci: Array.from(new Set(kk.filter((x) => x.g !== 'UMUM' && x.k !== 'saya').map((x) => x.k))).sort().join(' ') };
  }
  const miripKata = (q, n) => q === n || (q.length >= 4 && n.indexOf(q) === 0) || (q.length >= 4 && n.length >= 4 && q[0] === n[0] && osa(q, n) <= 1);
  /** Tampilan rapi: "rek bri istri" → "Rekening BRI istri" */
  function tampilCatatan(label, ctx) {
    const A = petaAlias(ctx);
    const kata = kataKunci(label, A).map((x) => (x.g === 'LEMBAGA' || HURUF_BESAR.has(x.k) ? x.k.toUpperCase() : x.k));
    const s = kata.filter((w, i) => kata.indexOf(w) === i).join(' ');
    return s ? s[0].toUpperCase() + s.slice(1) : U_huruf1(label);
  }
  /**
   * Cari catatan. Semua kata kunci pertanyaan harus ada di catatan (urutan bebas); kata lemah ("nomor") boleh tidak ada.
   * "saya" hanya menyaring catatan milik orang lain. Hasil: { ids, kata, sebagian }
   */
  function cariCatatan(teks, daftar, ctx) {
    const A = petaAlias(ctx);
    const q = kataKunci(teks, A);
    const adaSaya = q.some((x) => x.k === 'saya');
    let wajib = q.filter((x) => x.g !== 'UMUM' && x.k !== 'saya').map((x) => x.k);
    if (!wajib.length) wajib = q.filter((x) => x.k !== 'saya').map((x) => x.k);
    wajib = Array.from(new Set(wajib));
    const hasil = [], sebagian = [];
    if (!wajib.length) return { ids: [], kata: [], sebagian: [] };
    (daftar || []).forEach((x) => {
      const st = strukturCatatan(x.label, ctx);
      const kena = wajib.filter((w) => st.kata.some((n) => miripKata(w, n)));
      if (kena.length === wajib.length) {
        if (adaSaya && st.pemilik.some((p) => A.kel[p] === 'PEMILIK')) return;       // "rek bri saya" ≠ rekening istri
        const tutup = st.kata.filter((n) => LEMAH.has(n) || n === 'saya' || wajib.some((w) => miripKata(w, n))).length / Math.max(st.kata.length, 1);
        hasil.push({ id: x.id_ingatan, tutup, tanpaPemilik: !st.pemilik.length });
      } else if (kena.length) sebagian.push({ id: x.id_ingatan, skor: kena.length / wajib.length });
    });
    hasil.sort((a, b) => b.tutup - a.tutup);
    // "... saya": utamakan catatan tanpa nama pemilik; bila tidak ada, tanyakan dulu (jangan langsung menjawab milik orang lain)
    let pilih = false;
    if (adaSaya && hasil.length) {
      const milikku = hasil.filter((h) => h.tanpaPemilik);
      if (milikku.length) hasil.splice(0, hasil.length, ...milikku); else pilih = true;
    }
    // Satu catatan yang persis sama dengan yang ditanyakan dipilih langsung ("rekening bri" ↔ "rekening bri" vs "rekening bri istri")
    const persis = hasil.filter((h) => h.tutup === 1);
    const ids = persis.length === 1 && hasil.length > 1 && wajib.length >= 2 ? [persis[0].id] : hasil.map((h) => h.id);
    return { ids, kata: wajib, pilih, sebagian: sebagian.sort((a, b) => b.skor - a.skor).map((s) => s.id).slice(0, 3) };
  }
  /** Apakah teks memuat kata khas catatan (rekening, password, nomor ...)? */
  const KATA_CATATAN = new Set(['rekening', 'password', 'email', 'alamat', 'ktp', 'nik', 'npwp', 'kk', 'bpjs', 'stnk', 'bpkb', 'plat', 'pin', 'akun', 'polis', 'va', 'nomor', 'pelanggan', 'kode']);
  function adaKataCatatan(teks, ctx) { const A = petaAlias(ctx); return kataKunci(teks, A).some((x) => KATA_CATATAN.has(x.k) || x.g === 'LEMBAGA'); }
  // Pertahankan untuk kompatibilitas (dipakai uji lama)
  const tokenLabel = (s) => kataKunci(s, petaAlias(null)).map((x) => x.k);
  function cariIngatan(t, daftar) { return cariCatatan(t, daftar, null).ids.map((id) => ({ id, skor: 1 })); }

  const LABEL_KUAT = /\b(nomor|no|norek|nik|npwp|nisn|nim|nip|id|idpel|kode|pin|password|pass|sandi|akun|username|email|e-mail|alamat|plat|nopol|ukuran|golongan|wifi|polis|bpjs|ktp|kk|resi|pelanggan|meteran|kartu|va|virtual account|tanggal lahir|ultah|ulang tahun)\b/;
  const RE_SIMPAN = /^(?:tolong\s+|mohon\s+|coba\s+)?(?:ingat|ingatlah|inget|simpan|catat)(?:\s+(?:ya|yah|baik baik|baik-baik|dong))?\s+(.+)$/i;
  const RE_KERJA_TX = /\b(beli|bayar|isi|jajan|makan|minum|belanja|transfer|kirim|setor|tarik|nabung|gaji|terima|dapat|top ?up|topup)\b/;
  function pisahLabel(body) {
    // body dari teks asli (huruf besar/kecil dipertahankan untuk isinya)
    let m = /^(.+?)\s*(?::|=|\s(?:adalah|yaitu|ialah|yakni)\s)\s*(.+)$/i.exec(body);
    if (m) return { label: m[1], nilai: m[2] };
    const tok = body.split(/\s+/);
    const iAngka = tok.findIndex((w, i) => i > 0 && /\d/.test(w));
    if (iAngka > 0) return { label: tok.slice(0, iAngka).join(' '), nilai: tok.slice(iAngka).join(' ') };
    m = /^(.+?\b(?:saya|aku|ku|kami|kita|ayah|bunda|ibu|bapak|kakak|adik))\s+(.+)$/i.exec(body);
    if (m && !/^(saya|aku)$/i.test(m[2].trim())) return { label: m[1], nilai: m[2] };
    return { label: body, nilai: '' };
  }
  function bersihLabel(l) {
    return normal(l).replace(/[^a-z0-9 \-]/g, ' ').split(/\s+/).filter(Boolean)
      .filter((w, i, a) => !/^(saya|aku|ku|punya|punyaku|milik|milikku|yang|itu|ini|nya|si|atas|an)$/.test(w)).join(' ').trim();
  }
  const adaUang = (t) => cariNominal(tutupBukanNominal(t)).some((a) => a.kuat && (/rb|ribu|jt|juta|k\b|rp/.test(a.teks)));
  function ingatanDari(t0, raw, ctx, at) {
    let m;
    const daftar = ctx.ingatan || [];
    const A = petaAlias(ctx);
    // Daftar semua catatan
    if (/^(?:apa\s+(?:saja|aja)\s+(?:yang\s+)?(?:kamu\s+|cashku\s+)?(?:ingat|simpan|catat)|(?:daftar|lihat|tampilkan|semua)\s+(?:ingatan|catatan(?:\s+data)?|data(?:\s+yang)?\s+(?:di)?simpan|catatan data)|catatan(?:\s+(?:saya|ku|aku))?\s+apa\s+(?:saja|aja)|ingatan(?:mu| saya| ku)?|data (?:saya|ku) apa (?:saja|aja))\??$/.test(t0)) return { type: 'ingatanDaftar' };
    // "semua rekening", "daftar rekening", "lihat semua catatan pln"
    if ((m = /^(?:(?:lihat|tampilkan|liat)\s+)?(?:semua|daftar|seluruh)\s+(?:catatan\s+|data\s+)?(.+?)(?:\s+(?:saya|ku|aku))?\??$/.exec(t0))) {
      const kk = kataKunci(m[1], A);
      if (kk.length && kk.every((x) => x.g !== 'LAIN') && !RE_KERJA_TX.test(m[1])) {
        const c = cariCatatan(m[1], daftar, ctx);
        return { type: 'ingatanDaftar', kata: c.kata, ids: c.ids };
      }
    }
    // Hapus: "hapus catatan pln", "hapus rek bri istri"
    if ((m = /^(?:tolong\s+)?(?:hapus|lupakan|buang)\s+(?:ingatan\s+|data\s+|catatan\s+)?(.+?)(?:\s+(?:ya|dong|saja|aja))*$/.exec(t0)) && !/^kata\s/.test(m[1])) {
      const c = cariCatatan(m[1], daftar, ctx);
      if (c.ids.length) return { type: 'ingatanHapus', ids: c.ids, kata: c.kata };
      if (/^(?:hapus|buang)\s+(?:catatan|ingatan)\s/.test(t0) && adaKataCatatan(m[1], ctx)) return { type: 'ingatanHapus', ids: [], kata: c.kata };
    }
    // Ubah: "ganti rek bri istri jadi 5555"
    const rawRapi = String(raw).trim().replace(/\s+/g, ' ');
    if ((m = /^(?:tolong\s+)?(?:ganti|ubah|update|perbarui|ubahlah|gantilah)\s+(?:catatan\s+|data\s+|isi\s+)?(.+?)\s+(?:jadi|menjadi)\s+(.+)$/.exec(t0))) {
      const c = cariCatatan(m[1], daftar, ctx);
      const rm2 = /\s(?:jadi|menjadi)\s+(.+)$/i.exec(rawRapi);
      if (c.ids.length && rm2) return { type: 'ingatanUbah', ids: c.ids, kata: c.kata, nilai: rm2[1].trim() };
    }
    // Simpan
    const rm = RE_SIMPAN.exec(rawRapi);
    if ((m = RE_SIMPAN.exec(t0)) && rm) {
      const body = m[1];
      if (/^kata\s/.test(body)) return null;
      if (/\s(?:masuk(?:nya)?|sebagai|termasuk)\s+(?:ke\s+)?(?:kategori\s+)?[a-z]/.test(body) && !/\d{4,}/.test(body)) return null;   // "ingat X masuk Y" = ajari
      if (adaUang(body)) return null;           // ada uang → transaksi
      if (/^(?:beli|bayar|jajan|makan|belanja|transfer|kirim|setor|tarik|nabung|top ?up)\b/.test(body)) return null;
      const kk = kataKunci(body, A);
      const kuat = LABEL_KUAT.test(body) || /[:=]|\s(adalah|yaitu|ialah|yakni)\s/.test(body) ||
        (kk.some((x) => x.g === 'JENIS' || x.g === 'LEMBAGA' || KATA_CATATAN.has(x.k)) && /\d{3,}/.test(body)) ||
        (/\b(rekening|rek|hp|wa|whatsapp|telepon)\b/.test(body) && /\d{5,}/.test(body));
      if (!kuat) return null;
      let rawBody = rm[1];
      let lingkup = 'PRIBADI';
      const reKel = /\s*\b(?:untuk|buat)\s+(?:semua|keluarga|bersama|semua orang)\b/i;
      if (reKel.test(rawBody)) { lingkup = 'KELUARGA'; rawBody = rawBody.replace(reKel, ' ').trim(); }
      const pl = pisahLabel(rawBody);
      const label = bersihLabel(pl.label);
      if (!label) return null;
      return { type: 'ingatanSimpan', label, nilai: pl.nilai.trim().replace(/^(?:nya|adalah|yaitu)\s+/i, ''), lingkup };
    }
    // Tanya: semua kata kunci harus cocok dengan catatan
    if (adaUang(t0)) return null;
    if (RE_KERJA_TX.test(t0) || /\b(bulan|minggu|tahun|kemarin|hari ini|pengeluaran|pemasukan|total|rata|saldo|sisa|uang|anggaran|laporan|kategori|harga|termasuk)\b/.test(t0)) return null;
    const kk = kataKunci(t0, A);
    if (!kk.length || kk.length > 6) return null;
    const c = cariCatatan(t0, daftar, ctx);
    if (c.ids.length) return c.pilih ? { type: 'ingatanTanya', ids: c.ids, kata: c.kata, pilih: true } : { type: 'ingatanTanya', ids: c.ids, kata: c.kata };
    // Tidak ada yang cocok, tetapi jelas menanyakan catatan ("rekening bca") → tawarkan menyimpan
    const lain = kk.filter((x) => x.g === 'LAIN');
    const khas = kk.some((x) => KATA_CATATAN.has(x.k) && x.k !== 'kode') && kk.some((x) => x.g !== 'UMUM' || kk.length === 1);
    if (khas && lain.length <= 1 && !/\d/.test(t0)) return { type: 'ingatanTanya', ids: [], kata: c.kata, label: bersihLabel(t0.replace(/\b(berapa|brp|apa|mana|lihat|liat|cek|minta|kasih|sebutkan|dong|ya)\b/g, ' ')), mirip: c.sebagian };
    return null;
  }

  // ----------------------------------------------------------------
  // Sapaan nama: "saya Dani", "nama saya Dani", "panggil saya Bang Dani"
  // ----------------------------------------------------------------
  const HORMAT = { pak: 'Pak', bapak: 'Pak', bpk: 'Pak', bu: 'Bu', ibu: 'Bu', bang: 'Bang', abang: 'Bang', kak: 'Kak', kakak: 'Kak', mas: 'Mas', mbak: 'Mbak', mba: 'Mbak',
    om: 'Om', tante: 'Tante', dek: 'Dek', adik: 'Dek', teh: 'Teh', aa: 'Aa', kang: 'Kang', uda: 'Uda', uni: 'Uni', bli: 'Bli', daeng: 'Daeng', koh: 'Koh', cik: 'Cik',
    cak: 'Cak', ning: 'Ning', bro: 'Bro', sis: 'Sis', nak: 'Nak', pakde: 'Pakde', bude: 'Bude', eyang: 'Eyang', opa: 'Opa', oma: 'Oma' };
  const BUKAN_NAMA = /^(lapar|laper|capek|capai|lelah|bingung|sakit|senang|sedih|bosan|pusing|ngantuk|sibuk|pulang|pergi|mau|ingin|pengen|pingin|sudah|udah|belum|blm|lagi|lg|tidak|nggak|gak|ga|enggak|baru|juga|bisa|tadi|kira|rasa|pikir|lupa|ingat|inget|tahu|tau|suka|setuju|siap|oke|ok|sedang|masih|harus|perlu|butuh|punya|cuma|hanya|minta|tanya|mohon|kerja|bekerja|di|ke|dari|yang|dan|sendiri|kan|kok|dong|deh|aja|saja|nih|ya|yah|sih|bukan|benar|betul|salah|paham|ngerti|mengerti|bingung|mulai|selesai|dulu|nanti|kemarin|besok|sekarang|baik|sehat|kenyang|haus|kangen|marah|kesal|takut|malu|bangga|yakin|ragu|heran|kaget|terima|makasih|tidur|bangun|mandi|jalan|keluar|masuk|pakai|pake|disini|sini|situ|pusing|bener|beneran|serius|kecewa|puas|stres|stress|galau|happy|bahagia|siapa|apa|mana|kapan|berapa|bagaimana|gimana|kenapa|mengapa)$/;
  // "siapa saya", "saya siapa", "kamu tahu saya siapa", "kenal aku?", "nama saya apa", "panggilan aku apa"
  const SY = '(?:saya|aku|sy|gue|gw|ane|ku)';
  const RE_NAMA_TANYA = new RegExp('^(?:(?:coba\\s+)?(?:kamu|km|cashku|kau)\\s+)?(?:(?:tahu|tau|tahu\\s+gak|tau\\s+gak|tau\\s+nggak|kenal|ingat|inget|masih\\s+ingat|masih\\s+inget)\\s+)?(?:' +
    'siapa\\s+(?:nama\\s+)?' + SY + '|' + SY + '\\s+(?:ini\\s+)?siapa|nama\\s*' + SY + '\\s+(?:siapa|apa)|namaku\\s+(?:siapa|apa)|siapa\\s+namaku|panggilan\\s*' + SY + '\\s+(?:siapa|apa)|' +
    '(?:kamu|cashku)\\s+panggil\\s+' + SY + '\\s+(?:apa|siapa)|(?:masih\\s+)?(?:kenal|tahu|tau|ingat|inget)\\s+' + SY + '|(?:kenal|tahu|tau|ingat|inget)\\s+(?:nama\\s*)?' + SY + '(?:\\s+(?:gak|nggak|ga|tidak|kan|nggak sih))?|' + SY + '\\s+siapa\\s+(?:ya|sih|hayo|coba))' +
    '(?:\\s+(?:ya|sih|hayo|coba|dong|kan|gak|nggak|ga|tidak))*$');
  function sapaanDari(t0, raw, ctx, idx) {
    if (RE_NAMA_TANYA.test(t0.replace(/[?!.]+/g, ' ').replace(/\s+/g, ' ').trim())) return { type: 'namaTanya' };
    if (adaUang(t0) || /\d/.test(t0)) return null;
    const rawRapi = normal(raw).replace(/^(?:tolong\s+)?(?:ingat|ingatlah|inget)\s+/, '');
    const awal = String(raw).trim().replace(/\s+/g, ' ').replace(/^(?:tolong\s+)?(?:ingat|ingatlah|inget)\s+/i, '');
    let m, sisa, kuat = true;
    const reKuat = /^(?:nama\s+(?:panggilan\s+)?(?:saya|aku|ku|gue|gw)|namaku|nama\s+panggilanku|panggilan\s+(?:saya|aku|ku)|panggilanku|panggil(?:lah)?\s+(?:saya|aku|gue|gw)|sebut\s+(?:saya|aku)|(?:per)?kenalkan(?:\s+(?:nama\s+)?(?:saya|aku))?|(?:saya|aku)\s+dipanggil|ganti\s+(?:panggilan|sapaan|nama\s+panggilan)(?:\s+(?:saya|aku|ku))?|ubah\s+(?:panggilan|sapaan)(?:\s+(?:saya|aku|ku))?)(?:\s+(?:jadi|menjadi|ke|dengan|adalah|ialah))?\s*:?\s+(.+)$/;
    if ((m = reKuat.exec(rawRapi))) sisa = m[1];
    else if ((m = /^(?:saya|aku|sy|gue|gw)\s+(?:ini\s+|adalah\s+)?([a-z][a-z'\-]*(?:\s+[a-z][a-z'\-]*)?)$/.exec(rawRapi))) { sisa = m[1]; kuat = false; }
    else return null;
    const namaSaja = /\s(?:saja|aja)\b/.test(' ' + sisa);
    sisa = sisa.replace(/(?:\s+(?:saja|aja|ya|yah|dong|deh|lah|yaa|nya|please|plis))+$/, '').replace(/^(?:dengan|sebagai)\s+/, '').trim();
    const kata = sisa.split(' ').filter(Boolean);
    if (!kata.length || kata.length > 3) return null;
    if (RE_KERJA_TX.test(sisa) || kata.some((w) => VERBA_SET.has(w))) return null;
    let sapaan = '';
    if (HORMAT[kata[0]]) { sapaan = HORMAT[kata[0]]; kata.shift(); }
    else if (namaSaja) sapaan = 'NAMA';
    if (kata.some((w) => BUKAN_NAMA.test(w))) return null;
    // Kata dari kamus (bukan nama anggota) → bukan nama, kecuali ditulis dengan huruf besar
    const namaAnggota = new Set((ctx.anggota || []).map((a) => normal(a.nama || '')).concat((ctx.anggota || []).map((a) => normal(a.username || ''))));
    const dikenal = kata.filter((w) => idx.known.has(w) && !namaAnggota.has(w));
    const kapital = kata.length && kata.every((w) => new RegExp('(?:^|\\s)' + w[0].toUpperCase() + w.slice(1).replace(/[-']/g, '.'), '').test(awal));
    let ragu = false;
    if (!kuat) {
      if (dikenal.length && !kapital) return null;
      if (!kata.length) return null;
      ragu = !kapital || dikenal.length > 0;
    } else if (dikenal.length && !kapital && kata.length) ragu = true;
    const nama = kata.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
    if (!nama && !sapaan) return null;
    return { type: 'namaSet', nama, sapaan, ragu };
  }

  // ----------------------------------------------------------------
  // Pengaturan lewat chat: akun, anggaran, kategori, dompet, target tabungan
  // ----------------------------------------------------------------
  const PERAN_KATA = [['ADMIN', /\b(admin|pengelola|kepala(?:\s+keluarga)?|kk)\b/], ['DEWASA', /\b(dewasa|orang tua|ortu)\b/], ['SUAMI', /\b(suami|ayah|bapak|papa|papi|abi|abah)\b/], ['ISTRI', /\b(istri|ibu|bunda|mama|mami|umi|bini)\b/],
    ['ANAK', /\b(anak|putra|putri|anakku)\b/], ['LAINNYA', /\b(lainnya|lain|nenek|kakek|om|tante|saudara|keponakan|asisten|art|pembantu|mertua)\b/]];
  function peranDari(t) { t = normal(t); const x = PERAN_KATA.find((p) => p[1].test(t)); return x ? x[0] : ''; }
  const TIPE_DOMPET = [['REKENING', /\b(rekening|rek|bank|atm|debit|bri|bca|bni|mandiri|bsi|btn|jago|seabank|blu|cimb|permata|danamon)\b/], ['EWALLET', /\b(e-?wallet|dompet digital|gopay|ovo|dana|shopeepay|spay|linkaja)\b/],
    ['TABUNGAN', /\b(tabungan|celengan|simpanan)\b/], ['TUNAI', /\b(tunai|cash|kas|kontan|dompet fisik)\b/]];
  function tipeDompetDari(t) { t = normal(t); const x = TIPE_DOMPET.find((p) => p[1].test(t)); return x ? x[0] : ''; }
  const huruf1Kata = (s) => s.split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  /** "desember", "desember 2027", "24 bulan", "2 tahun", "akhir tahun", "tahun depan", "20/12/2027" → { tanggal: 'YYYY-MM-DD', bulan: n } */
  function tenggatDari(teks, hariIni) {
    const t = normal(teks), hi = hariIni.split('-').map(Number);
    const akhir = (y, b) => y + '-' + p2j(b) + '-' + p2j(new Date(y, b, 0).getDate());
    const jarak = (y, b) => (y - hi[0]) * 12 + (b - hi[1]);
    let m;
    if ((m = /\b(\d{1,3}|se|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|dua belas)\s*(bulan|bln|tahun|thn)\b(?:\s+lagi)?/.exec(t))) {
      const n = /^\d+$/.test(m[1]) ? Number(m[1]) : ANGKA_KATA[m[1]] || 1;
      const bl = /^t/.test(m[2]) ? n * 12 : n;
      let b = hi[1] + bl, y = hi[0]; while (b > 12) { b -= 12; y++; }
      return { tanggal: akhir(y, b), bulan: bl };
    }
    if (/\bakhir\s+tahun(?:\s+ini)?\b/.test(t)) return { tanggal: hi[0] + '-12-31', bulan: Math.max(1, jarak(hi[0], 12)) };
    if (/\btahun\s+depan\b/.test(t)) return { tanggal: (hi[0] + 1) + '-12-31', bulan: jarak(hi[0] + 1, 12) };
    if ((m = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/.exec(t))) { const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return { tanggal: y + '-' + p2j(Number(m[2])) + '-' + p2j(Number(m[1])), bulan: Math.max(1, jarak(y, Number(m[2]))) }; }
    const reBln = new RegExp('\\b(' + BULAN.concat(Object.keys(BULAN_SINGKAT)).join('|') + ')\\b(?:\\s+(\\d{4}))?');
    if ((m = reBln.exec(t))) {
      const b = bulanAngka(m[1]);
      let y = m[2] ? Number(m[2]) : hi[0];
      if (!m[2] && b < hi[1]) y++;
      return { tanggal: akhir(y, b), bulan: Math.max(1, jarak(y, b)) };
    }
    if ((m = /\b(20\d\d)\b/.exec(t))) { const y = Number(m[1]); return { tanggal: y + '-12-31', bulan: Math.max(1, jarak(y, 12)) }; }
    return null;
  }
  function aturDari(t0, raw, ctx, idx) {
    let m;
    const rawRapi = String(raw).trim().replace(/\s+/g, ' ');
    const sisaRaw = (re) => { const r = re.exec(rawRapi.toLowerCase()); return r ? rawRapi.slice(r.index + r[0].length).trim() : ''; };
    const t = t0.replace(/[?!.]+$/, '').trim();
    if (/^(?:menu\s+|buka\s+)?(?:pengaturan|setelan|setting|settings)(?:\s+(?:lewat|via|di)\s+chat)?$|^(?:atur|pengaturan)\s+apa\s+(?:saja|aja)$|^bisa\s+atur\s+apa\s+(?:saja|aja)$/.test(t)) return { type: 'aturMenu' };
    // Akun
    const reTambahAkun = /^(?:tolong\s+)?(?:tambah(?:kan)?|buat(?:kan)?|bikin(?:in)?|daftarkan|daftar)\s+(?:akun|anggota|pengguna|user)(?:\s+(?:baru|keluarga))?\b/;
    if ((m = reTambahAkun.exec(t))) {
      let sisa = sisaRaw(reTambahAkun).replace(/^(?:untuk|buat|atas nama|bernama|namanya|nama)\s+/i, '');
      const data = {};
      const pr = peranDari(sisa);
      if (pr) { data.peran = pr; sisa = sisa.replace(PERAN_KATA.find((p) => p[0] === pr)[1], ' ').replace(/\b(?:sebagai|jadi|peran|perannya)\b/gi, ' '); }
      const nm = sisa.replace(/[^A-Za-zÀ-ÿ' \-]/g, ' ').replace(/\s+/g, ' ').trim();
      if (nm && nm.split(' ').length <= 3) data.nama = huruf1Kata(nm.toLowerCase());
      return { type: 'atur', alur: 'akun', data };
    }
    const cariOrang = (s) => { const n = normal(s).trim(); const a = (ctx.anggota || []).filter((x) => normal(x.nama) === n || normal(x.username || '') === n || normal(x.nama).split(' ')[0] === n); return a.length === 1 ? a[0].id : ''; };
    if ((m = /^(?:tolong\s+)?(?:ubah|ganti|jadikan|set|atur)\s+peran(?:\s+(?:akun|anggota))?\s+(.+?)\s+(?:jadi|menjadi|ke|sebagai)\s+(.+)$/.exec(t)) || (m = /^(?:tolong\s+)?jadikan\s+(.+?)\s+(?:sebagai\s+)?(kepala keluarga|suami|istri|anak|lainnya|admin|dewasa)$/.exec(t))) {
      return { type: 'atur', alur: 'ubahAkun', data: { orang: cariOrang(m[1]), orangTeks: m[1], ubah: 'peran', peran: peranDari(m[2]) } };
    }
    if ((m = /^(?:tolong\s+)?(?:ubah|ganti)\s+nama\s+(?:akun|anggota|pengguna)\s+(.+?)\s+(?:jadi|menjadi)\s+(.+)$/.exec(t))) {
      const nb = /\s(?:jadi|menjadi)\s+(.+)$/i.exec(rawRapi);
      return { type: 'atur', alur: 'ubahAkun', data: { orang: cariOrang(m[1]), orangTeks: m[1], ubah: 'nama', nama: nb ? nb[1].trim().slice(0, 30) : '' } };
    }
    if ((m = /^(?:tolong\s+)?(?:ubah|ganti|atur|edit)\s+(?:akun|anggota|pengguna)(?:\s+(.+))?$/.exec(t))) return { type: 'atur', alur: 'ubahAkun', data: m[1] ? { orang: cariOrang(m[1]), orangTeks: m[1] } : {} };
    if ((m = /^(?:tolong\s+)?(?:hapus|nonaktifkan|matikan|blokir|keluarkan|hilangkan)\s+(?:akun|anggota|pengguna|user)(?:\s+(.+))?$/.exec(t))) return { type: 'atur', alur: 'nonaktif', data: m[1] ? { orang: cariOrang(m[1]), orangTeks: m[1] } : {} };
    if ((m = /^(?:tolong\s+)?(?:aktifkan|hidupkan|pulihkan)\s+(?:lagi\s+)?(?:akun|anggota|pengguna|user)(?:\s+(.+?))?(?:\s+lagi)?$/.exec(t))) return { type: 'atur', alur: 'aktifkan', data: m[1] ? { orang: cariOrang(m[1]), orangTeks: m[1] } : {} };
    // Anggaran: "anggaran jajan 500rb", "ubah anggaran makan jadi 1jt", "atur anggaran"
    if ((m = /^(?:tolong\s+)?(?:(?:atur|set|buat|bikin|ubah|ganti|tambah|pasang|tetapkan)\s+)?(?:anggaran|budget|batas belanja)\b(.*)$/.exec(t))) {
      let s = m[1].trim();
      const verb = /^(?:tolong\s+)?(?:atur|set|buat|bikin|ubah|ganti|tambah|pasang|tetapkan)\s/.test(t);
      const nom = cariNominal(tutupBukanNominal(s)).filter((a) => a.kuat);
      if (verb || nom.length) {
        const data = {};
        if (nom.length) { data.batas = nom[nom.length - 1].nilai; s = (s.slice(0, nom[nom.length - 1].index) + ' ' + s.slice(nom[nom.length - 1].index + nom[nom.length - 1].len)); }
        if (/\b(mingguan|per\s*minggu|seminggu|tiap\s+minggu)\b/.test(s)) data.periode = 'MINGGUAN';
        s = s.replace(/\b(?:per\s*bulan|sebulan|tiap\s+bulan|setiap\s+bulan|bulanan|mingguan|per\s*minggu|seminggu|tiap\s+minggu|jadi|menjadi|sebesar|rp|kategori|untuk|buat|ya|dong|saja|aja)\b/g, ' ').replace(/\s+/g, ' ').trim();
        // "... buat rafi" → anggaran per orang
        const ang = (ctx.anggota || []).find((a) => s.split(' ').some((w) => w.length >= 3 && (normal(a.nama).split(' ')[0] === w || normal(a.username || '') === w)));
        if (ang) { data.orang = ang.id; s = s.split(' ').filter((w) => normal(ang.nama).split(' ')[0] !== w && normal(ang.username || '') !== w).join(' '); }
        if (/^(?:total|semua|keseluruhan|pengeluaran|semua kategori|total pengeluaran)$/.test(s)) data.kategori = 'SEMUA';
        else if (s) { const k = cariKategoriNama(s, ctx); if (k.length === 1) data.kategori = k[0]; else data.kategoriTeks = s; }
        return { type: 'atur', alur: 'anggaran', data };
      }
    }
    // Kategori
    const reTambahKat = /^(?:tolong\s+)?(?:tambah(?:kan)?|buat(?:kan)?|bikin(?:in)?)\s+kategori(?:\s+baru)?\b/;
    if (reTambahKat.test(t)) {
      let sisa = sisaRaw(reTambahKat).replace(/^(?:bernama|namanya|nama|untuk)\s+/i, '');
      const data = {};
      if (/\b(pemasukan|pendapatan|masuk)\b/i.test(sisa)) data.jenis = 'MASUK';
      else if (/\b(pengeluaran|keluar|belanja)\b/i.test(sisa)) data.jenis = 'KELUAR';
      sisa = sisa.replace(/\b(?:untuk|jenis|kategori)?\s*(?:pemasukan|pendapatan|pengeluaran|masuk|keluar)\b/gi, ' ').replace(/\s+/g, ' ').trim();
      if (sisa) data.nama = sisa.slice(0, 40).replace(/^./, (c) => c.toUpperCase());
      return { type: 'atur', alur: 'kategori', data };
    }
    if ((m = /^(?:tolong\s+)?(?:ubah|ganti)\s+(?:nama\s+)?kategori\s+(.+?)\s+(?:jadi|menjadi)\s+(.+)$/.exec(t))) {
      const k = cariKategoriNama(m[1], ctx);
      const nb = /\s(?:jadi|menjadi)\s+(.+)$/i.exec(rawRapi);
      return { type: 'atur', alur: 'ubahKategori', data: { kat: k.length === 1 ? k[0] : '', katTeks: m[1], nama: nb ? nb[1].trim().slice(0, 40).replace(/^./, (c) => c.toUpperCase()) : '' } };
    }
    if (/^(?:tolong\s+)?(?:ubah|ganti)\s+(?:nama\s+)?kategori$/.test(t)) return { type: 'atur', alur: 'ubahKategori', data: {} };
    // Dompet
    const reTambahDompet = /^(?:tolong\s+)?(?:tambah(?:kan)?|buat(?:kan)?|bikin(?:in)?)\s+dompet(?:\s+baru)?\b/;
    if (reTambahDompet.test(t)) {
      let sisa = sisaRaw(reTambahDompet);
      const data = {};
      const nom = cariNominal(tutupBukanNominal(normal(sisa))).filter((a) => a.kuat);
      if (nom.length) { data.saldo = nom[0].nilai; sisa = sisa.replace(/\b(?:saldo(?:nya)?|isi(?:nya)?|sebesar)\b.*$/i, '').replace(/\s\d[\d.,]*\s*(?:rb|ribu|jt|juta|k)?\b.*$/i, ''); }
      sisa = sisa.replace(/\b(?:bernama|namanya|nama|tipe|jenis)\b/gi, ' ').replace(/\s+/g, ' ').trim();
      const tp = tipeDompetDari(sisa);
      if (tp) data.tipe = tp;
      const nm = sisa.replace(/^(?:rekening|e-?wallet|tabungan|tunai)\s+/i, '').trim();
      if (nm) data.nama = nm.length <= 4 ? nm.toUpperCase() : nm.replace(/^./, (c) => c.toUpperCase());
      return { type: 'atur', alur: 'dompet', data };
    }
    // Target tabungan
    if (/^(?:(?:lihat|daftar|cek|tampilkan)\s+)?(?:semua\s+)?target(?:\s+(?:tabungan|nabung|menabung))?(?:\s+(?:saya|ku|kita|keluarga))?(?:\s+apa\s+(?:saja|aja))?$/.test(t) && !/^target$/.test(t) || /^(?:daftar|lihat)\s+target$/.test(t) || /^target$/.test(t)) return { type: 'targetDaftar' };
    if ((m = /^(?:tolong\s+)?(?:hapus|batalkan|nonaktifkan|buang)\s+target(?:\s+(?:tabungan|nabung))?(?:\s+(.+))?$/.exec(t))) return { type: 'targetHapus', kata: (m[1] || '').trim() };
    const reTarget = /^(?:tolong\s+)?(?:(?:buat|bikin|tambah|atur|set|pasang|pengen|ingin|mau)\s+)?target\s*(?:tabungan|nabung|menabung)?\b/;
    if (reTarget.test(t)) {
      let s = t.replace(reTarget, ' ');
      const data = {};
      const nom = cariNominal(tutupBukanNominal(s)).filter((a) => a.kuat && a.nilai >= 1000);
      if (nom.length) { data.nominal = nom[0].nilai; s = s.slice(0, nom[0].index) + ' ' + s.slice(nom[0].index + nom[0].len); }
      const tg = tenggatDari(s, ctx.hariIni);
      if (tg) {
        data.tenggat = tg.tanggal;
        s = s.replace(/\b(\d{1,3}|se|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|dua belas)\s*(bulan|bln|tahun|thn)\b(\s+lagi)?/, ' ').replace(/\bakhir\s+tahun(\s+ini)?\b|\btahun\s+depan\b/, ' ')
          .replace(new RegExp('\\b(' + BULAN.concat(Object.keys(BULAN_SINGKAT)).join('|') + ')\\b(\\s+\\d{4})?'), ' ').replace(/\b20\d\d\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/, ' ');
      }
      s = s.replace(/\b(?:untuk|buat|dalam|sampai|hingga|pada|bulan|tanggal|sebesar|rp|ya|dong|di|ke|tercapai|selama|waktu|jangka)\b/g, ' ').replace(/\s+/g, ' ').trim();
      if (s && s.split(' ').length <= 4) data.nama = s.replace(/^./, (c) => c.toUpperCase());
      return { type: 'atur', alur: 'target', data };
    }
    return null;
  }

  // ----------------------------------------------------------------
  // Penasihat keuangan: pemicu ("bagi gaji 5jt"), perubahan kondisi ("cicilan nambah 400rb"), tujuan ("motor 15jt 24 bulan")
  // ----------------------------------------------------------------
  const PEMICU_BAWAAN = ['mulai penasihat', 'penasihat keuangan', 'penasihat', 'saran keuangan', 'atur keuangan', 'bagi gaji', 'bagi pendapatan', 'bagi penghasilan',
    'alokasi gaji', 'alokasi pendapatan', 'rencana keuangan', 'perencanaan keuangan', 'konsultasi keuangan', 'atur gaji', 'pembagian gaji', 'pembagian pendapatan',
    'budgeting', 'kelola gaji', 'kelola keuangan', 'rencanakan keuangan', 'nasihat keuangan'];
  const PN_ISI = /^(tolong|dong|ya|yuk|ayo|saya|aku|kami|kita|keluarga|bulan|ini|per|sebulan|untuk|buat|mau|ingin|pengen|pingin|minta|coba|bisa|kasih|beri|berikan|nih|deh|sih|gimana|bagaimana|cara|caranya|yang|baik|bagus|benar|tiap|setiap|bulanan|rp|kak|min|nya|ku|mu|dari|ke|di|dengan|jadi|sekarang|cashku|fitur|menu|buka)$/;
  const PN_INTI = /^(penasihat|penasehat|keuangan|gaji|gajian|pendapatan|penghasilan|budget|budgeting|finansial|uang|duit|pemasukan)$/;
  const PN_KERJA = /^(bagi|bagikan|membagi|pembagian|atur|mengatur|aturan|saran|sarankan|bantu|bantuin|rencana|rencanakan|perencanaan|alokasi|alokasikan|kelola|mengelola|konsultasi|rancang|susun|hitung|hitungkan|nasihat|nasehat|ngatur)$/;
  const rangkaKata = (w) => w.replace(/[aiueo]/g, '');
  const pnMirip = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && osa(a, b) <= 1) || (a.length >= 3 && rangkaKata(a) === rangkaKata(b) && rangkaKata(a).length >= 2 && a[0] === b[0] && Math.abs(a.length - b.length) <= 2);
  const pnToken = (s) => normal(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w && !PN_ISI.test(w) && !/\d/.test(w));
  function penasihatDari(t0, raw, ctx) {
    let m;
    const t = t0.replace(/[?!.]+$/, '').trim();
    if (/^(?:bayar|beli|lunasi|cicil|setor|transfer|kirim)\b/.test(t)) return null;
    const nomDari = (s) => { const a = cariNominal(tutupBukanNominal(s)).filter((x) => x.kuat); return a.length ? a[a.length - 1].nilai : null; };
    // ---- Perubahan kondisi ----
    const ANGKA = '(\\d+|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)';
    const angka = (s) => (/^\d+$/.test(s) ? Number(s) : ANGKA_KATA[s] || 0);
    if ((m = new RegExp('^(?:jumlah\\s+)?tanggungan(?:\\s+(?:saya|kami|keluarga|kita))?\\s+(?:jadi|menjadi|sekarang|skrg|kini|tinggal|ada)\\s+' + ANGKA + '(?:\\s+orang)?$').exec(t))) return { type: 'penasihatUbah', ubah: { field: 'tanggungan', mode: 'set', nilai: angka(m[1]) } };
    if ((m = new RegExp('^(?:jumlah\\s+)?tanggungan(?:\\s+(?:saya|kami|keluarga|kita))?\\s+(nambah|bertambah|tambah|naik|berkurang|kurang|turun)(?:\\s+' + ANGKA + ')?(?:\\s+orang)?$').exec(t))) {
      return { type: 'penasihatUbah', ubah: { field: 'tanggungan', mode: /kurang|turun/.test(m[1]) ? 'kurang' : 'tambah', nilai: m[2] ? angka(m[2]) : 1 } };
    }
    if (/^cicilan\b/.test(t)) {
      const nom = nomDari(t);
      if (/\blunas\b/.test(t)) return { type: 'penasihatUbah', ubah: { field: 'cicilan', mode: 'lunas', nilai: nom } };
      if ((m = /^cicilan(?:\s+[a-z]+){0,2}?\s+(nambah|bertambah|tambah|naik|berkurang|kurang|turun|jadi|menjadi|sekarang|skrg)\b/.exec(t)) && nom) {
        return { type: 'penasihatUbah', ubah: { field: 'cicilan', mode: /kurang|turun/.test(m[1]) ? 'kurang' : /nambah|tambah|naik/.test(m[1]) ? 'tambah' : 'set', nilai: nom } };
      }
    }
    if ((m = /^(?:gaji|pendapatan|penghasilan|pemasukan|gajian)(?:\s+(?:saya|aku|kami|keluarga|bulanan|suami|istri))?\s+(naik|turun|nambah|bertambah|berkurang|jadi|menjadi|sekarang|skrg)\b(?:\s+(jadi|menjadi|ke))?/.exec(t))) {
      const nom = nomDari(t);
      if (nom) {
        const set = /jadi|menjadi|sekarang|skrg|ke/.test(m[1]) || !!m[2];
        return { type: 'penasihatUbah', ubah: { field: 'pendapatan', mode: set ? 'set' : /turun|kurang/.test(m[1]) ? 'kurang' : 'tambah', nilai: nom } };
      }
    }
    if ((m = /^dana\s+darurat(?:\s+(?:saya|kami|keluarga|kita))?\s+(?:sudah\s+|udah\s+|sekarang\s+|jadi\s+|masih\s+|baru\s+)?(cukup|sebagian|belum(?:\s+ada)?|habis|kosong|terpakai)$/.exec(t))) {
      return { type: 'penasihatUbah', ubah: { field: 'dana_darurat', mode: 'set', nilai: /cukup/.test(m[1]) ? 'CUKUP' : /sebagian/.test(m[1]) ? 'SEBAGIAN' : 'BELUM' } };
    }
    // ---- Pemicu ----
    if (/\b(beli|bayar|isi|jajan|makan|minum|belanja|transfer|kirim|setor|tarik|terima|dapat|top ?up|topup|nabung)\b/.test(t)) return null;
    const tok = pnToken(t);
    if (!tok.length || tok.length > 6) return null;
    const pendapatan = nomDari(t);
    const daftar = PEMICU_BAWAAN.concat((ctx.pemicu || []).map((x) => (typeof x === 'string' ? x : x.frasa)).filter(Boolean));
    for (const f of daftar) {
      const ft = pnToken(f);
      if (!ft.length) continue;
      const pakai = new Set();
      const ok = ft.every((w) => { const i = tok.findIndex((x, j) => !pakai.has(j) && pnMirip(x, w)); if (i < 0) return false; pakai.add(i); return true; });
      if (ok && tok.length - pakai.size <= 1 && !(ft.length === 1 && tok.length > 1 && tok.length - pakai.size > 0 && !PN_INTI.test(tok.find((x, j) => !pakai.has(j)) || ''))) {
        return { type: 'penasihat', pendapatan: pendapatan || undefined, frasa: f };
      }
    }
    // Ragu: ada kata inti + kata kerja, tapi belum ada di daftar → tanya dulu, lalu simpan frasanya
    if (tok.some((w) => PN_INTI.test(w)) && tok.some((w) => PN_KERJA.test(w)) && tok.length <= 5 && !/\b(berapa|total|laporan|sisa|saldo)\b/.test(t)) {
      return { type: 'penasihatRagu', frasa: tok.join(' '), pendapatan: pendapatan || undefined };
    }
    return null;
  }
  const JENIS_TUJUAN = [['KENDARAAN', /\b(motor|mobil|sepeda|kendaraan|vespa)\b/, 'Kendaraan'], ['RUMAH', /\b(rumah|tanah|kpr|renovasi|kavling|apartemen)\b/, 'Rumah/tanah'],
    ['PENDIDIKAN', /\b(pendidikan|sekolah|kuliah|les|kursus)\b/, 'Pendidikan'], ['IBADAH', /\b(ibadah|umroh|umrah|haji|qurban|kurban)\b/, 'Ibadah'],
    ['USAHA', /\b(usaha|modal|bisnis|toko|dagang|jualan)\b/, 'Usaha'], ['UTANG', /\b(utang|hutang|pinjaman|lunasi|kartu kredit|paylater)\b/, 'Lunasi utang']];
  /** "motor 15jt 24 bulan, umroh 40jt 3 tahun" → [{ jenis, nama, target, bulan }] (target/bulan bisa kosong) */
  function tujuanDari(teks, hariIni) {
    return normal(teks).split(/\s*(?:,|;|\n|\bdan\b|\bserta\b|\+)\s*/).map((bag) => bag.trim()).filter(Boolean).map((bag) => {
      const j = JENIS_TUJUAN.find((x) => x[1].test(bag));
      const nom = cariNominal(tutupBukanNominal(bag)).filter((a) => a.kuat && a.nilai >= 10000);
      let s = bag;
      const o = { jenis: j ? j[0] : 'LAIN' };
      if (nom.length) { o.target = nom[0].nilai; s = s.slice(0, nom[0].index) + ' ' + s.slice(nom[0].index + nom[0].len); }
      const tg = tenggatDari(s, hariIni || '2026-01-01');
      if (tg) {
        o.bulan = tg.bulan;
        s = s.replace(/\b(\d{1,3}|se|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|dua belas)\s*(bulan|bln|tahun|thn)\b(\s+lagi)?/, ' ').replace(/\bakhir\s+tahun(\s+ini)?\b|\btahun\s+depan\b/, ' ')
          .replace(new RegExp('\\b(' + BULAN.concat(Object.keys(BULAN_SINGKAT)).join('|') + ')\\b(\\s+\\d{4})?'), ' ').replace(/\b20\d\d\b/, ' ');
      }
      s = s.replace(/\b(untuk|buat|beli|target|tujuan|dalam|selama|nabung|menabung|tabungan|sampai|ya|rp|biaya|dana|kebutuhan|jangka|waktu|lagi)\b/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
      o.nama = s && s.split(' ').length <= 4 ? s.replace(/^./, (c) => c.toUpperCase()) : (j ? j[2] : 'Tabungan');
      return o;
    }).filter((x) => x.target || x.jenis !== 'LAIN' || x.nama !== 'Tabungan');
  }

  // ----------------------------------------------------------------
  // Pengingat & alarm: "ingatkan saya bayar air setiap tanggal 20 jam 9"
  // ----------------------------------------------------------------
  const HARI = { senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, "jum'at": 5, sabtu: 6, minggu: 7, ahad: 7 };
  const RE_HARI = "(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|ahad)";
  const ANGKA_KATA = { se: 1, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11, 'dua belas': 12, 'lima belas': 15, 'dua puluh': 20, 'tiga puluh': 30, 'empat puluh lima': 45, setengah: 0.5 };
  const p2j = (n) => (n < 10 ? '0' : '') + n;
  /** "jam 9", "jam 7 malam", "pukul 08.30", "setengah 8", "21:15" → "HH:mm" (null bila tidak ada) */
  function jamDari(t) {
    let m = /\b(?:jam|pukul)\s*(?:(setengah)\s*)?(\d{1,2})(?:\s*[.:]\s*(\d{2}))?(?:\s*(?:lewat|lebih)\s*(\d{1,2})(?:\s*menit)?)?(?:\s*(pagi|siang|sore|malam|subuh|petang))?\b/.exec(t)
      || /\b(?:(setengah)\s+)?(\d{1,2})(?:[.:](\d{2}))?()\s*(pagi|siang|sore|malam|subuh|petang)\b/.exec(t)
      || /(?:^|\s)(?:())(\d{1,2})[:.](\d{2})()()(?=$|\s)/.exec(t);
    if (!m) return null;
    let h = Number(m[2]), mnt = m[3] ? Number(m[3]) : 0;
    if (m[1]) { h -= 1; mnt = 30; }
    if (m[4]) mnt = Number(m[4]);
    const w = m[5];
    if (w === 'siang' && h <= 5) h += 12;
    if ((w === 'sore' || w === 'petang') && h < 12) h += 12;
    if (w === 'malam' && h >= 6 && h < 12) h += 12;
    if (w === 'malam' && h === 12) h = 0;
    if (w === 'pagi' && h === 12) h = 0;
    if (h > 23 || mnt > 59 || h < 0) return null;
    return { jam: p2j(h) + ':' + p2j(mnt), teks: m[0], index: m.index, adaWaktu: !!w };
  }
  function bulanAngka(w) { const i = BULAN.indexOf(w); return i > -1 ? i + 1 : BULAN_SINGKAT[w] || 0; }
  /** Bagian jadwal dari kalimat. hariIni = 'YYYY-MM-DD'. Mengembalikan pola + apa saja yang masih perlu ditanyakan. */
  function jadwalDari(teks, hariIni) {
    let s = ' ' + teks + ' ';
    const buang = (re) => { s = s.replace(re, ' '); };
    const j = { pola: '', tanggal: '', hari_bulan: '', hari_minggu: '', jam: '', relatifMenit: 0, perlu: [] };
    let m;
    // Relatif: "30 menit lagi", "2 jam lagi", "sejam lagi"
    const reRel = new RegExp('\\b(\\d+|' + Object.keys(ANGKA_KATA).sort((a, b) => b.length - a.length).join('|') + ')\\s*(menit|jam)\\s*(?:lagi|kemudian|dari sekarang|ke depan)\\b');
    if ((m = reRel.exec(s))) {
      const n = /^\d+$/.test(m[1]) ? Number(m[1]) : ANGKA_KATA[m[1]];
      j.relatifMenit = Math.round(n * (m[2] === 'jam' ? 60 : 1));
      j.pola = 'SEKALI'; buang(reRel);
      return Object.assign(j, { sisa: s.trim() });
    }
    const jm = jamDari(s);
    if (jm) { j.jam = jm.jam; s = s.slice(0, jm.index) + ' '.repeat(jm.teks.length) + s.slice(jm.index + jm.teks.length); }
    const reBln = '(' + BULAN.concat(Object.keys(BULAN_SINGKAT)).join('|') + ')';
    let tglBulan = null, tglSaja = 0;
    if ((m = new RegExp('\\b(?:tanggal\\s*)?(\\d{1,2})\\s+' + reBln + '\\b(?:\\s+(\\d{4}))?').exec(s))) {
      tglBulan = { d: Number(m[1]), b: bulanAngka(m[2]), y: m[3] ? Number(m[3]) : 0 }; s = s.replace(m[0], ' ');
    } else if ((m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(s))) {
      tglBulan = { d: Number(m[1]), b: Number(m[2]), y: m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : 0 }; s = s.replace(m[0], ' ');
    } else if ((m = /\b(?:setiap|tiap)\s+(?:bulan\s+)?(?:pada\s+)?tanggal\s*(\d{1,2})\b/.exec(s))) {
      j.pola = 'BULANAN'; j.hari_bulan = String(Number(m[1])); s = s.replace(m[0], ' ');
    } else if ((m = /\btanggal\s*(\d{1,2})\b/.exec(s))) { tglSaja = Number(m[1]); s = s.replace(m[0], ' '); }
    if (!j.pola && /\b(?:setiap|tiap)\s+(?:bulan\s+)?(?:pada\s+)?tanggal\b/.test(s)) { j.pola = 'BULANAN'; j.perlu.push('tanggal'); buang(/\b(?:setiap|tiap)\s+(?:bulan\s+)?(?:pada\s+)?tanggal\b/g); }
    const setiapTahun = /\b(?:setiap|tiap)\s+tahun\b/.test(s); buang(/\b(?:setiap|tiap)\s+tahun\w*\b/g);
    const setiapBulan = /\b(?:setiap|tiap)\s+(?:awal\s+)?bulan\b/.test(s);
    const awalBulan = /\b(?:awal\s+bulan)\b/.test(s), akhirBulan = /\bakhir\s+bulan\b/.test(s);
    buang(/\b(?:setiap|tiap)\s+(?:awal\s+|akhir\s+)?bulan\w*\b/g); buang(/\b(?:awal|akhir)\s+bulan\b/g);
    // Hari dalam minggu
    const reSetiapHari = new RegExp('\\b(?:setiap|tiap)\\s+(?:hari\\s+)?' + RE_HARI + '(?:\\s*(?:,|dan|&)\\s*' + RE_HARI + ')*', 'g');
    const hariList = [];
    let mh;
    while ((mh = reSetiapHari.exec(s))) { (mh[0].match(new RegExp(RE_HARI, 'g')) || []).forEach((h) => hariList.push(HARI[h])); }
    if (hariList.length) { j.pola = 'MINGGUAN'; j.hari_minggu = Array.from(new Set(hariList)).sort().join(','); buang(reSetiapHari); }
    else if (/\b(?:setiap|tiap)\s+minggu\b/.test(s) || /\bmingguan\b/.test(s)) { j.pola = 'MINGGUAN'; j.perlu.push('hari'); buang(/\b(?:setiap|tiap)\s+minggu\b|\bmingguan\b/g); }
    if (!j.pola && /\b(?:setiap|tiap)\s+(?:hari|pagi|siang|sore|malam)\b|\bharian\b|\bsetiap\s+hari\b/.test(s)) { j.pola = 'HARIAN'; buang(/\b(?:setiap|tiap)\s+(?:hari|pagi|siang|sore|malam)\b|\bharian\b/g); }
    // Bulanan / tahunan / tanggal tertentu
    if (!j.pola && (setiapBulan || akhirBulan)) {
      j.pola = 'BULANAN';
      if (akhirBulan) j.hari_bulan = 'AKHIR';
      else if (awalBulan) j.hari_bulan = '1';
      else if (tglSaja) j.hari_bulan = String(tglSaja);
      else if (tglBulan) j.hari_bulan = String(tglBulan.d);
      else j.perlu.push('tanggal');
    }
    if (!j.pola && setiapTahun && tglBulan) { j.pola = 'TAHUNAN'; j.tanggal = p2j(tglBulan.b) + '-' + p2j(tglBulan.d); }
    if (!j.pola && tglBulan) {
      const hi = hariIni.split('-').map(Number);
      let y = tglBulan.y || hi[0];
      if (!tglBulan.y && (tglBulan.b < hi[1] || (tglBulan.b === hi[1] && tglBulan.d < hi[2]))) y++;
      j.pola = 'SEKALI'; j.tanggal = y + '-' + p2j(tglBulan.b) + '-' + p2j(tglBulan.d);
      if (!tglBulan.y) j.perlu.push('ulang');
    }
    if (!j.pola && tglSaja) {
      const hi = hariIni.split('-').map(Number);
      let y = hi[0], b = hi[1];
      if (tglSaja < hi[2]) { b++; if (b > 12) { b = 1; y++; } }
      j.pola = 'SEKALI'; j.tanggal = y + '-' + p2j(b) + '-' + p2j(Math.min(tglSaja, new Date(y, b, 0).getDate())); j.hari_bulan = String(tglSaja);
      j.perlu.push('ulang');
    }
    // Hari relatif / hari tertentu
    if (!j.pola) {
      const tambah = (n) => { const d = new Date(hariIni + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + p2j(d.getMonth() + 1) + '-' + p2j(d.getDate()); };
      if (/\blusa\b/.test(s)) { j.pola = 'SEKALI'; j.tanggal = tambah(2); buang(/\blusa\b/g); }
      else if (/\bbesok\b/.test(s)) { j.pola = 'SEKALI'; j.tanggal = tambah(1); buang(/\bbesok\b/g); }
      else if (/\b(hari ini|nanti|malam ini|pagi ini|sore ini|siang ini)\b/.test(s)) { j.pola = 'SEKALI'; j.tanggal = hariIni; buang(/\b(hari ini|nanti)\b/g); }
      else if ((m = new RegExp('\\b(?:hari\\s+)?' + RE_HARI + '(?:\\s+(?:depan|ini|nanti))?\\b').exec(s))) {
        const target = HARI[m[1]], d = new Date(hariIni + 'T00:00:00');
        const now = ((d.getDay() + 6) % 7) + 1;
        let beda = (target - now + 7) % 7; if (beda === 0 && /depan/.test(m[0])) beda = 7;
        j.pola = 'SEKALI'; j.tanggal = tambah(beda); s = s.replace(m[0], ' ');
      }
    }
    // Waktu tanpa angka: "nanti malam" → jam ditanyakan dengan saran
    const bagian = /\b(pagi|siang|sore|malam)\b/.exec(s);
    if (bagian && !j.jam) j.saranJam = bagian[1];
    buang(/\b(?:nanti\s+)?(?:pagi|siang|sore|malam)(?:\s+(?:ini|nanti|hari))?\b/g);
    if (!j.pola) {
      if (j.jam) { j.pola = 'SEKALI'; j.tanggal = ''; j.perluHariIni = true; }
      else j.perlu.push('kapan');
    }
    if (!j.jam && j.pola) j.perlu.push('jam');
    return Object.assign(j, { sisa: s.replace(/\s+/g, ' ').trim() });
  }
  const RE_INGATKAN = /^(?:tolong\s+|mohon\s+|please\s+|coba\s+)?(?:ingatkan(?:\s+lagi)?|remind(?:\s+me)?|pasang\s+(?:alarm|pengingat)|buat(?:kan)?\s+(?:alarm|pengingat)|bikin(?:in)?\s+(?:alarm|pengingat)|set(?:el)?\s+alarm|alarm|bangunkan|bangunin)\b\s*(.*)$/;
  /** Salah ketik kata kunci pengingat: "ingetin", "ingatkn", "pengingt", "alrm" */
  function rapikanPengingat(t) {
    return t.split(' ').map((w) => {
      if (/^(ingetin|ingatin|ingetkan|ingatkn|ingtkan|ingetkn|ingatkam|ingatkn|ingetinn|ingatinn|ingatkn|ingtin|ingtkn|ingetin)$/.test(w)) return 'ingatkan';
      if (w !== 'ingatkan' && /kan$/.test(w) && w[0] === 'i' && w.length >= 7 && osa(w, 'ingatkan') <= 1) return 'ingatkan';
      if (w !== 'pengingat' && w[0] === 'p' && w.length >= 8 && w.length <= 10 && osa(w, 'pengingat') <= 1) return 'pengingat';
      if (/^(alrm|alaram|alarem|alarmm|allarm|alram|alarn)$/.test(w)) return 'alarm';
      return w;
    }).join(' ');
  }
  function pengingatDari(t0, ctx) {
    let m;
    t0 = rapikanPengingat(t0);
    const sebutPg = /\b(?:pengingat|alarm)(?:nya|ku)?\b/.test(t0);
    if (sebutPg) {
      // urutan bebas: "pengingat saya apa saja", "lihat semua alarm"
      const sisaD = t0.replace(/\b(?:daftar|lihat|liat|cek|semua|tampilkan|apa|saja|aja|saya|ku|aku|yang|ada|mana|pengingat|alarm|pengingatnya|alarmnya|pengingatku|alarmku|dong|ya|tolong|coba)\b|\?/g, ' ').trim();
      if (!sisaD && !/^(?:pengingat|alarm)$/.test(t0)) return { type: 'pengingatDaftar' };
      if (/^(?:pengingat|alarm)(?:\s+(?:saya|ku|aku))?\??$/.test(t0)) return { type: 'pengingatDaftar' };
      // hapus di mana saja: "pengingat bayar air hapus", "tolong matikan alarm jam 5"
      if (/\b(?:hapus|batalkan|batal|matikan|stop|hentikan|nonaktifkan|buang|hilangkan)\b/.test(t0)) {
        const kata = t0.replace(/\b(?:tolong|mohon|hapus|batalkan|batal|matikan|stop|hentikan|nonaktifkan|buang|hilangkan|pengingat|alarm|pengingatnya|alarmnya|pengingatku|alarmku|saya|aku|yang|untuk|buat|ya|dong|saja|aja|itu|ini)\b/g, ' ').replace(/\s+/g, ' ').trim();
        return { type: 'pengingatHapus', kata };
      }
    }
    if (/^(?:tes|test|uji|coba)\s+(?:alarm|notifikasi|pengingat|bunyi)(?:\s+(?:dong|ya))?$/.test(t0)) return { type: 'pengingatUji' };
    // Kata perintah di tengah/akhir kalimat → pindah ke depan ("bayar air tanggal 20 ingatkan saya")
    if (!RE_INGATKAN.test(t0)) {
      const mp = /\b(?:tolong\s+|jangan lupa\s+)?(ingatkan(?:\s+lagi)?|(?:pasang|buat(?:kan)?|bikin(?:in)?|set(?:el)?)\s+(?:alarm|pengingat))\b/.exec(t0);
      if (mp) t0 = (mp[1] + ' ' + t0.slice(0, mp.index) + ' ' + t0.slice(mp.index + mp[0].length)).replace(/\s+/g, ' ').trim();
    }
    if (!(m = RE_INGATKAN.exec(t0))) return null;
    let body = m[1].replace(/^(?:saya|aku|ku|kami|kita|ya|dong)\b\s*/, '').trim();
    const jd = jadwalDari(body, ctx.hariIni);
    const judul = jd.sisa.replace(/\b(saya|aku|ya|dong|tolong|pada|pukul|jam|tanggal|tgl|setiap|tiap|nanti|mulai|lagi)\b/g, ' ')
      .replace(/^\s*(?:untuk|buat|agar|supaya|soal|tentang|kalau|bahwa|biar|harus|wajib|mesti)\s+/, '').replace(/[,.;!?]+/g, ' ').replace(/\s+/g, ' ').trim()
      .replace(/^(?:untuk|buat|agar|supaya|soal|tentang|kalau|bahwa|biar)\s+/, '').replace(/\s+(?:di|pada|ke)$/, '');
    let jdl = judul;
    if (!jdl && /\b(alarm|bangunkan|bangunin)\b/.test(t0)) jdl = /bangun/.test(t0) ? 'Bangun' : 'Alarm';
    if (!jdl) jd.perlu.unshift('judul');
    return { type: 'pengingat', judul: U_huruf1(jdl), jadwal: jd };
  }

  // ----------------------------------------------------------------
  // Analisis utama
  // ----------------------------------------------------------------
  /**
   * opsi.abaikan: kata yang tidak boleh dikoreksi (pengguna menjawab "Bukan")
   * opsi.tanpaRagu: jangan tanyakan koreksi setengah yakin
   */
  function analisis(raw, ctx, opsi) {
    opsi = opsi || {};
    const idx = siapkan(ctx), at = aturan(ctx);
    const t00 = angkaDariKata(normal(raw));
    if (!t00) return { type: 'kosong' };
    const t0 = rapikan(t00, idx);

    let m;
    // Pengingat & ingatan data diperiksa sebelum koreksi typo agar isi data (nomor, nama) tidak diubah
    const pg = pengingatDari(t0, ctx);
    if (pg) return pg;
    const sp = sapaanDari(t0, raw, ctx, idx);
    if (sp) return sp;
    const klo = kelolaDari(t0, ctx, idx);
    if (klo) return klo;
    const atr = aturDari(t0, raw, ctx, idx);
    if (atr) return atr;
    const pn = penasihatDari(t0, raw, ctx);
    if (pn) return pn;
    const ig = ingatanDari(t0, raw, ctx, at);
    if (ig) return ig;
    if ((m = /^(?:batal(?:kan)?|undo|cancel|hapus terakhir|salah catat|salah)\b(.*)$/.exec(t0))) return { type: 'batal', kata: m[1].trim() };
    if (/^(bantuan|help|tolong|cara pakai|caranya|contoh|menu|\?+)$/.test(t0)) return { type: 'bantuan' };
    const ob = obrolan(t0);
    if (ob) return ob;
    const aj = ajari(t0, ctx);
    if (aj) return aj;

    // Salah ketik: yakin → langsung dibaca benar; setengah yakin → ditanyakan bila hasilnya jelas lebih masuk akal
    const kr = koreksi(t0, idx, at, opsi.abaikan);
    const r = inti(kr.teks, ctx, idx, at);
    if (kr.yakin.length) { r.perubahan = (r.perubahan || []).concat(kr.yakin); r.teksKoreksi = kr.teks; }
    if (kr.ragu.length && !opsi.tanpaRagu) {
      const kata2 = kr.kata.slice();
      kr.ragu.forEach((x) => { kata2[x.i] = x.ke; });
      const t2 = kata2.join(' ');
      const r2 = inti(t2, ctx, idx, at);
      if (kualitas(r2) > kualitas(r)) {
        return { type: 'konfirmasiTypo', teks: t2, perubahan: kr.yakin.concat(kr.ragu.map((x) => ({ dari: x.dari, ke: x.ke, skor: x.skor }))),
          ragu: kr.ragu.map((x) => ({ dari: x.dari, ke: x.ke })), hasil: r2, abaikan: kr.ragu.map((x) => x.dari) };
      }
    }
    return r;
  }

  // =============================================================
  // 1.0.17 — Rincian & "uang habis ke mana"
  // =============================================================
  const RE_RINCI = /\b(rincian(?:nya)?|rinci(?:kan|annya)?|perincian(?:nya)?|merinci|detail(?:nya)?|detil(?:nya)?|breakdown)\b/;
  const RE_APA_SAJA = /\b(?:apa|mana)\s*(?:saja|aja|aj|sj|sja)\b|\bapa(?:\s*-\s*|\s+)apa\b|\bapa2\b/;
  const RE_UANG = /\b(uang|uangku|uangnya|uang\s*mu|duit|duitku|duitnya|gaji|gajiku|gajinya|pengeluaran|pengeluaranku|belanjaan|belanjaanku|dana|keuangan|keuanganku)\b/;
  const RE_KEMANA = /\b(ke\s?mana|kmn|kmana|kemana|larinya|lari|perginya)\b/;
  const RE_BUAT_APA = /\b(buat|untuk|utk|bwt|dipakai|dipake|kepakai|kepake|terpakai|habis|abis|keluar)\s+(?:apa|ap)\b/;
  const RE_SERING = /\b(paling\s+sering|tersering|sering(?:nya)?\s+(?:beli|bayar|belanja|jajan|keluar|keluarin|habis|dibeli|dibayar)|yang\s+sering(?:\s+(?:dibeli|dibayar|keluar))?)\b/;
  const RE_DARI_MANA = /\bdari\s?(?:mana|mn)\b/;
  const RE_MASUK_Q = /\b(pemasukan|pemasukanku|pendapatan|pendapatanku|penghasilan|penghasilanku|uang\s+masuk|duit\s+masuk)\b/;
  const RE_DIRI = /\b(uangku|duitku|gajiku|pengeluaranku|belanjaanku|jajanku|pemasukanku|pendapatanku|penghasilanku|keuanganku)\b/;
  const RINCI_SISA = /\b(rincian|rinciannya|rinci|rincikan|perincian|perinciannya|merinci|detail|detailnya|detil|detilnya|breakdown|lihat|liat|lihatin|tampilkan|tunjukkan|tunjukin|kasih|tolong|dong|ya|yah|deh|sih|nih|apa|ap|saja|aja|aj|sj|sja|mana|pengeluaran|pengeluaranku|pemasukan|pemasukanku|untuk|buat|utk|bwt|semua|minggu|pekan|bulan|tahun|hari|ini|lalu|kemarin|terakhir|tanggal|sampai|hingga|saya|aku|ku|kami|kita|keluarga|transaksi|catatan|yang|di|ke|dari|kategori|nya|mau|ingin|pengen|coba|bisa|data|jumlah|total|berapa|kali|sering|paling|tersering|beli|bayar|belanja|kapan|dalam|selama|per)\b/g;

  function rincianDari(t, ctx, idx, per, adaPeriode, nominalKuat) {
    if (nominalKuat) return null;
    const masukQ = RE_MASUK_Q.test(t) || (RE_DARI_MANA.test(t) && /\b(uang|duit|rezeki|rejeki|gaji)\b/.test(t) && !/\b(ke\s?mana|kemana|keluar|habis|abis)\b/.test(t));
    let mode = '';
    if (RE_SERING.test(t)) mode = 'sering';
    else if (!masukQ && ((RE_KEMANA.test(t) && (RE_UANG.test(t) || /\b(habis|abis)\b/.test(t))) ||
      (RE_BUAT_APA.test(t) && (RE_UANG.test(t) || /\b(habis|abis)\b/.test(t))) ||
      /\bboros\b.*\b(di\s?mana|dimana|ke\s?mana|kemana|apa|nya)\b/.test(t) ||
      /\b(kok|kenapa|knp|mengapa|napa|kenapa ya)\b.*\b(cepat|cepet|cpt|cpet|gampang|mudah)\s+(habis|abis|menipis|tipis)\b/.test(t) ||
      /\b(analisa|analisis|analisi|cek|periksa)\b.*\b(pengeluaran|pengeluaranku|keuangan|keuanganku|uang|uangku|belanja)\b/.test(t))) mode = 'kemana';
    else if (RE_RINCI.test(t) || (masukQ && RE_DARI_MANA.test(t))) mode = 'rincian';
    else if (RE_APA_SAJA.test(t) && (RE_UANG.test(t) || masukQ || /\b(beli|belanja|bayar|jajan)\b/.test(t) ||
      cariSemua(t, idx.kat).some((k) => !kataUmum(k.frasa)))) mode = 'rincian';
    if (!mode) return null;
    // "detail transaksi hari ini" tanpa sasaran → tetap daftar transaksi (masuk & keluar)
    if (mode === 'rincian' && !masukQ && /\b(transaksi|catatan|riwayat)\b/.test(t) && !/\b(pengeluaran|belanja|beli|bayar|jajan)\b/.test(t) &&
      !cariSemua(t, idx.kat).some((k) => !kataUmum(k.frasa))) return null;

    const q = { type: 'tanya', metric: mode, jenis: masukQ ? 'MASUK' : 'KELUAR' };
    if (per.ok) q.periode = per; else if (adaPeriode) q.periodeError = per;
    const ang = cariAnggota(t, idx, ctx);
    if (ang) q.orang = ang.id; else if (RE_DIRI.test(t)) q.orang = ctx.saya.id;
    if (mode === 'kemana') return q;

    // Sasaran rincian: kategori ("jajan"), kata yang lebih spesifik ("bensin", "kopi"), atau semua pengeluaran/pemasukan
    let sisa = t.replace(/[?!.,]/g, ' ');
    idx.anggota.forEach((e) => { if (e.frasa && new RegExp('\\b' + e.frasa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(sisa)) sisa = sisa.replace(e.frasa, ' '); });
    const katHit = cariSemua(sisa, idx.kat).filter((k) => !kataUmum(k.frasa) && !/^(belanja|pengeluaran|pemasukan|uang masuk|uang|duit)$/.test(k.frasa)).sort((a, b) => b.len - a.len)[0];
    if (katHit && (!masukQ || katHit.jenis === 'MASUK')) {
      q.kategori = katHit.target; q.jenis = katHit.jenis;
      const nk = normal((idx.katAktif[katHit.target] || {}).nama || '');
      if (nk.split(/[^a-z0-9]+/).indexOf(katHit.frasa) < 0 && nk !== katHit.frasa) q.kata = katHit.frasa;
      return q;
    }
    const kata = sisa.replace(RINCI_SISA, ' ').replace(new RegExp('\\b' + NAMA_BULAN_RE + '\\b', 'g'), ' ').replace(/\b\d+\b/g, ' ')
      .replace(/\b(uang|uangku|uangnya|duit|duitku|gaji|gajiku|masuk|keluar|pendapatan|penghasilan|habis|abis|dong|nya)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (kata && /^[a-z][a-z ]{2,30}$/.test(kata) && kata.split(' ').length <= 3) {
      const ids = cariKategoriNama(kata, ctx);
      if (ids.length === 1 && idx.katAktif[ids[0]]) { q.kategori = ids[0]; q.jenis = idx.katAktif[ids[0]].jenis; return q; }
      q.kata = kata;                                   // dicari di keterangan transaksi ("rincian kopi susu")
    }
    return q;
  }

  // =============================================================
  // 1.0.19 — Atur ulang saldo (Admin) & nonaktif/aktifkan anggaran lewat chat
  // =============================================================
  const RE_RESET_KATA = '(?:reset|riset|atur\\s*ulang|setel\\s*ulang|set\\s*ulang|nol\\s*kan|nolin|nolkan|di\\s*nol\\s*kan|dinolkan|kosongkan|kosongin|dikosongkan|bersihkan|hapus|hilangkan|mulai\\s+(?:dari\\s+)?(?:0|nol))';
  const RE_SALDO_ULANG_1 = new RegExp('^(?:tolong\\s+|mau\\s+|saya\\s+mau\\s+|coba\\s+)?' + RE_RESET_KATA + '\\s+(?:semua\\s+)?saldo(?:nya)?\\b(.*)$');
  const RE_SALDO_ULANG_2 = new RegExp('^(?:tolong\\s+)?(?:semua\\s+)?saldo(?:nya)?\\b(.*?)\\b(?:di\\s*)?' + RE_RESET_KATA + '\\b(.*)$');
  const RE_SALDO_NOL = /^(?:tolong\s+)?(?:semua\s+)?saldo(?:nya)?\b(.*?)\b(?:jadi|jadikan|dijadikan|menjadi|diubah jadi|ubah jadi|sekarang|skrg)\s+(?:0|nol|kosong|rp\s?0)\b(.*)$/;
  const RE_ANGGARAN_MATI = /^(?:tolong\s+|mau\s+|saya\s+mau\s+|coba\s+)?(?:hapus|apus|hapuskan|nonaktifkan|nonaktifin|nonaktif|non aktifkan|matikan|matiin|hentikan|stop|stopkan|batalkan|buang|hilangkan|tiadakan)\s+(?:semua\s+|seluruh\s+)?(?:anggaran|budget|batas belanja)(?:nya)?\b(.*)$/;
  const RE_ANGGARAN_MATI_2 = /^(?:semua\s+|seluruh\s+)?(?:anggaran|budget|batas belanja)(?:nya)?\b(.*?)\b(?:di\s*hapus|dihapus|di\s*nonaktifkan|dinonaktifkan|nonaktifkan|nonaktif|non aktif|dimatikan|matikan|di\s*stop|distop|stop|dibatalkan|batalkan|hapus|ga usah|gak usah|nggak usah|tidak usah|tidak perlu|ga perlu|gak perlu)\b(.*)$/;
  const RE_ANGGARAN_HIDUP = /^(?:tolong\s+)?(?:aktifkan|aktifin|hidupkan|nyalakan|pakai|pake)\s+(?:lagi\s+|kembali\s+)?(?:semua\s+|seluruh\s+)?(?:anggaran|budget|batas belanja)(?:nya)?\b(.*)$/;
  function kelolaDari(t0, ctx, idx) {
    let m;
    const t = t0.replace(/[?!.]+$/, '').trim();
    // ---- Reset seluruh aplikasi → diarahkan ke Pengaturan (wajib password) ----
    if (/^(?:tolong\s+|mau\s+|saya\s+mau\s+|cara\s+|gimana\s+(?:cara\s+)?|bagaimana\s+(?:cara\s+)?)?(?:reset|riset|atur\s*ulang|kosongkan|hapus|bersihkan|ulang)\s+(?:semua\s+)?(?:cashku|aplikasi|aplikasinya|semua data|semuanya|seluruh data|data(?:nya)?(?:\s+semua)?)\b/.test(t) ||
      /^(?:mulai\s+(?:dari\s+)?(?:nol|awal|0)\s+lagi|cashku\s+(?:di\s*)?reset)$/.test(t)) return { type: 'resetInfo' };
    // ---- Atur ulang saldo ----
    if (!/\b(berapa|brp|cek|lihat)\b/.test(t) && ((m = RE_SALDO_ULANG_1.exec(t)) || (m = RE_SALDO_ULANG_2.exec(t)) || (m = RE_SALDO_NOL.exec(t)))) {
      const sisa = (m[1] || '') + ' ' + (m[2] || '');
      const r = { type: 'saldoUlang', target: 0, dompet: [], semua: /\b(semua|seluruh|semuanya|all)\b/.test(t) };
      const nom = cariNominal(tutupBukanNominal(sisa)).filter((a) => a.kuat);
      if (nom.length && !RE_SALDO_NOL.test(t)) r.target = nom[0].nilai;
      const hits = cariSemua(sisa, idx.dompet);
      hits.forEach((h) => idsFrasa(idx, h.frasa).forEach((id) => { if (r.dompet.indexOf(id) < 0) r.dompet.push(id); }));
      if (!r.dompet.length) r.semua = true;
      return r;
    }
    // ---- Anggaran: nonaktifkan / aktifkan lagi ----
    let mode = '';
    if ((m = RE_ANGGARAN_HIDUP.exec(t))) mode = 'aktif';
    else if ((m = RE_ANGGARAN_MATI.exec(t)) || (m = RE_ANGGARAN_MATI_2.exec(t))) mode = 'nonaktif';
    if (!mode) return null;
    const sisa = ((m[1] || '') + ' ' + (m[2] || '')).replace(/\b(saja|aja|ya|dong|deh|lagi|kembali|yang|untuk|buat|kategori|anggaran|budget|nya)\b/g, ' ');
    const r = { type: 'anggaranStatus', mode, semua: /\b(semua|seluruh|semuanya|all)\b/.test(t), kategori: [], kata: [] };
    if (/\b(total|semua pengeluaran|keseluruhan)\b/.test(sisa) && !r.semua) r.kategori.push('SEMUA');
    const ang = cariAnggota(sisa, idx, ctx);
    if (ang && !ang.sendiri) r.orang = ang.id;
    let rest = sisa;
    idx.anggota.forEach((e) => { if (e.frasa && new RegExp('\\b' + e.frasa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(rest)) rest = rest.replace(e.frasa, ' '); });
    rest.split(/\s*(?:,|&|\bdan\b|\bserta\b|\bsama\b|\+)\s*/).map((x) => x.replace(/\b(semua|seluruh|semuanya|total|saya|aku|keluarga|per orang|bulanan|mingguan)\b/g, ' ').trim()).filter(Boolean).forEach((bag) => {
      const hit = cariSemua(bag, idx.kat).filter((k) => !kataUmum(k.frasa)).sort((a, b) => b.len - a.len)[0];
      let ids = hit ? [hit.target] : cariKategoriNama(bag, ctx);
      ids = ids.filter((id) => idx.katAktif[id] && idx.katAktif[id].jenis === 'KELUAR');
      if (ids.length) ids.forEach((id) => { if (r.kategori.indexOf(id) < 0) r.kategori.push(id); });
      else if (/^[a-z][a-z ]{1,30}$/.test(bag)) r.kata.push(bag);
    });
    if (/\bmingguan\b/.test(sisa)) r.periode = 'MINGGUAN'; else if (/\bbulanan\b/.test(sisa) && !r.kategori.includes('KAT-BULANAN')) r.periode = 'BULANAN';
    return r;
  }

  function inti(t0, ctx, idx, at) {
    let m;
    const nomAwal = cariNominal(tutupBukanNominal(t0));
    const nominalKuat = nomAwal.some((a) => a.kuat);
    const kor = { teks: t0, perubahan: [] };
    const t = t0;

    const kataUnduh = /\b(unduh|download|cetak|print|ekspor|export|simpan|kirim|minta)\b/.test(t);
    const kataLaporan = /\b(laporan|rekap|pdf)\b/.test(t);
    const per = periode(t, ctx.hariIni);
    const adaPeriode = per.ok || per.err === 'invalid' || per.err === 'future';

    // ---- Unduh laporan ----
    if ((kataUnduh && kataLaporan) || (/\blaporan\b/.test(t) && adaPeriode && !nominalKuat) || /\bpdf\b/.test(t)) {
      const r = { type: 'unduh', periode: adaPeriode ? per : null, perubahan: kor.perubahan, teksKoreksi: t };
      const ang = cariAnggota(t, idx, ctx);
      if (ang) r.orang = ang.id;
      const dq = cariDompetQ(t, idx);
      if (dq && dq.ambigu) r.dompetAmbigu = dq.ambigu; else if (dq) r.dompet = dq.id;
      if (/\bpengeluaran\b/.test(t)) r.jenis = 'KELUAR';
      else if (/\bpemasukan\b/.test(t)) r.jenis = 'MASUK';
      // Kata sisa yang tidak dikenali di posisi nama orang ("laporan om bulan ini")
      if (!ang && !dq) {
        const sisa = t.replace(/\b(unduh|download|cetak|print|ekspor|export|simpan|kirim|minta|laporan|rekap|pdf|keuangan|saya|tolong|dong|ya|untuk|buat|semua|anggota|dompet|pengeluaran|pemasukan|saja|aja|hari|ini|kemarin|minggu|bulan|tahun|lalu|terakhir|tanggal|sampai|hingga|per|orang|keluarga)\b/g, ' ')
          .replace(new RegExp('\\b' + NAMA_BULAN_RE + '\\b', 'g'), ' ').replace(/[0-9/\-–]+/g, ' ').trim().split(/\s+/).filter(Boolean);
        if (sisa.length === 1 && sisa[0].length >= 2) r.orangTakDikenal = sisa[0];
      }
      return r;
    }
    if (/^(laporan|rekap laporan|lihat laporan)$/.test(t)) return { type: 'laporan_ambigu' };

    // ---- 1.0.17: rincian per kategori/kata, "uangku habis ke mana", "paling sering beli apa" ----
    const rq = rincianDari(t, ctx, idx, per, adaPeriode, nominalKuat);
    if (rq) { rq.perubahan = kor.perubahan; rq.teksKoreksi = t; return rq; }

    // ---- Maksud pesan: dinilai dari beberapa petunjuk sekaligus (bobot di sheet Aturan_Parser) ----
    const fk = frasaKategoriQ(t), fh = frasaHargaQ(t);
    if (fk && !nominalKuat) return { type: 'tanyaKata', frasa: fk };
    const reRata = /\b(rata(?:\s*-\s*rata|\s+rata|2)?|rerata|average)\b/;
    const reBesar = /\b(terbesar|tertinggi|termahal|terboros|paling (?:besar|banyak|tinggi|mahal|boros|gede))\b/;
    const reKecil = /\b(terkecil|terendah|termurah|terhemat|paling (?:kecil|sedikit|rendah|murah|hemat))\b/;
    const kt = KATA_TANYA_RE.exec(t);
    let skorTanya = 0;
    if (kt) {
      // Bersama nominal, kata tanya hanya dihitung bila di awal/akhir ("berapa ...", "... berapa"), bukan "di warung mana 30rb"
      const sesudah = t.slice(kt.index + kt[0].length).replace(/[?!.]/g, ' ').trim().split(/\s+/).filter((w) => w && !EKOR_TANYA.test(w));
      if (!nominalKuat || kt.index === 0 || !sesudah.length) skorTanya += at.bobot_kata_tanya;
    }
    if (/\?/.test(t)) skorTanya += at.bobot_tanda_tanya;
    if (fh) skorTanya += at.bobot_frasa_harga;
    const kataLaporan2 = /\b(total|rekap|ringkasan|habis|sisa|saldo|pengeluaran|pemasukan|pendapatan|anggaran|riwayat|histori|history)\b/.test(t) ||
      (/\brata\b/.test(t) ? /\brata(?:\s*-\s*|\s+)rata\b/.test(t) : reRata.test(t)) || reBesar.test(t) || reKecil.test(t);
    if (!nominalKuat && kataLaporan2) skorTanya += at.bobot_kata_tanya;
    const skorTx = (nominalKuat ? at.bobot_nominal : 0) + (/^(beli|bayar|isi|jajan|makan|belanja|transfer|kirim|setor|tarik|nabung|gaji|terima|dapat|catat)\b/.test(t) ? at.bobot_kata_kerja : 0);
    const kataTanya = skorTanya >= at.ambang_tanya && (skorTanya >= skorTx || skorTanya >= at.ambang_tanya + at.bobot_tanda_tanya);
    const katHit = cariSemua(t, idx.kat).filter((k) => !kataUmum(k.frasa)).sort((a, b) => b.len - a.len)[0];
    if (kataTanya || (!nominalKuat && adaPeriode && (katHit || /\b(transaksi|catatan|riwayat)\b/.test(t) || per.jenis === 'hari'))) {
      const q = { type: 'tanya', perubahan: kor.perubahan, teksKoreksi: t, skor: { tanya: skorTanya, transaksi: skorTx } };
      if (fh) { q.metric = 'harga'; q.kata = fh; const kh = cariSemua(fh, idx.kat)[0]; if (kh) q.kategori = kh.target; return q; }
      if (per.ok) q.periode = per; else if (adaPeriode) q.periodeError = per;
      const ang = cariAnggota(t, idx, ctx); if (ang) q.orang = ang.id;
      const jenisQ = /\b(pemasukan|pendapatan|penghasilan|uang masuk)\b/.test(t) ? 'MASUK' : 'KELUAR';
      const katSpesifik = katHit && !/^(belanja|pengeluaran|pemasukan|uang masuk)$/.test(katHit.frasa) ? katHit : null;   // "belanja" di pertanyaan = pengeluaran umum
      if (fk) { q.metric = 'kategori'; }
      if (!/\bsaldo\b/.test(t) && reRata.test(t) && (!/\brata\b/.test(t) || /\brata(?:\s*-\s*|\s+)rata\b/.test(t))) {
        // Rata-rata: "rata-rata pengeluaran per hari (bulan ini)", "rata2 belanja mingguan"
        q.metric = 'rata'; q.jenis = jenisQ;
        const sm = /\b(?:per|setiap|tiap(?:\s*-?\s*tiap|2)?|se)\s*(hari|minggu|pekan|bulan|tahun)\b(?!\s*(?:ini|terakhir|belakangan|lalu|kemarin|ke ?belakang))/.exec(t)
          || (() => { const x = /\b(harian|mingguan|bulanan|tahunan)\b/.exec(t); return x && !(katHit && katHit.frasa.indexOf(x[1]) > -1) ? x : null; })();
        const SAT = { harian: 'hari', mingguan: 'minggu', bulanan: 'bulan', tahunan: 'tahun', pekan: 'minggu' };
        q.satuan = sm ? (SAT[sm[1]] || sm[1]) : 'hari';
        const per2 = periode(sm ? t.slice(0, sm.index) + ' ' + t.slice(sm.index + sm[0].length) : t, ctx.hariIni);
        delete q.periode; delete q.periodeError;
        if (per2.ok) q.periode = per2; else if (per2.err === 'invalid' || per2.err === 'future') q.periodeError = per2;
        if (katSpesifik && katSpesifik.jenis === jenisQ) q.kategori = katSpesifik.target;
        return q;
      }
      if (!/\bsaldo\b/.test(t) && (reBesar.test(t) || reKecil.test(t))) {
        // Terbesar/terkecil: "pengeluaran terbesar 3 hari ini", "kategori paling boros bulan ini", "hari paling boros minggu ini"
        q.metric = 'ekstrem'; q.jenis = jenisQ; q.arah = reBesar.test(t) ? 'besar' : 'kecil';
        q.kelompok = /\bkategori\b/.test(t) ? 'kategori' : /\bsiapa\b/.test(t) ? 'orang'
          : /\b(hari apa|hari yang|hari paling|hari ter(?!akhir)\w+|tanggal berapa|tanggal (?:yang|paling))\b/.test(t) ? 'hari' : 'transaksi';
        if (katSpesifik && katSpesifik.jenis === jenisQ && q.kelompok !== 'kategori') q.kategori = katSpesifik.target;
        return q;
      }
      // Pindah saldo: "bulan kemarin nabung berapa", "top up gopay bulan ini", "tarik tunai bulan lalu"
      const pq = /\b(me)?nabung\b/.test(t) ? 'nabung' : /\b(ambil|tarik|bongkar|pakai) (tabungan|celengan)\b/.test(t) ? 'ambiltab'
        : /\b(top ?up|topup|isi saldo|isi (gopay|ovo|dana|e-?wallet|shopeepay|linkaja))\b/.test(t) ? 'topup'
        : /\b(tarik tunai|ambil (uang|di atm|atm)|tarik (uang|di atm))\b/.test(t) ? 'tarik' : /\bsetor\b/.test(t) ? 'setor'
        : /\b(pindah|transfer|tf) (saldo|dana|uang)\b/.test(t) ? 'semua' : '';
      if (pq) { q.metric = 'pindah'; q.pindah = pq; return q; }
      // "kapan terakhir beli bensin"
      if (katHit && /\b(kapan|terakhir (kali )?(beli|bayar|isi|makan|ke|servis|ganti|ngopi|jajan)|terakhir kali)\b/.test(t)) {
        q.metric = 'terakhir'; q.kategori = katHit.target; q.kata = katHit.frasa; return q;
      }
      // Saldo dompet tanpa kata "saldo": "berapa tabungan sekarang", "uang di rekening berapa", "tunai tinggal berapa"
      const dq0 = cariDompetQ(t, idx);
      if (!/\bsaldo\b/.test(t) && dq0 && !katHit && !/\b(pengeluaran|pemasukan|keluar|masuk|transaksi|riwayat|bayar|beli|belanja)\b/.test(t)) {
        q.metric = 'saldo'; if (dq0.id) q.dompet = dq0.id; else q.dompetAmbigu = dq0.ambigu; return q;
      }
      // "sisa uang?", "uangku tinggal berapa", "uang saya berapa" → saldo (bukan anggaran)
      if (/\b(uang|uangku|uangnya|uang saya|duit|duitku|duitnya|duit saya)\b/.test(t) && /\b(sisa|tinggal|tersisa|berapa|brp|ada|sekarang|skrg|masih)\b/.test(t) &&
        (!katHit || /^(uang|duit|uangku|duitku)$/.test(katHit.frasa)) && !/\b(pengeluaran|pemasukan|keluar|masuk|habis|jajan|saku|makan|bulanan)\b/.test(t)) {
        q.metric = 'saldo'; delete q.orang; return q;
      }
      if (/\bsaldo\b/.test(t)) {
        q.metric = 'saldo';
        const dq = cariDompetQ(t, idx); if (dq && dq.id) q.dompet = dq.id; else if (dq) q.dompetAmbigu = dq.ambigu;
      } else if (/\b(anggaran|budget)\b/.test(t) || (/\bsisa\b/.test(t) && katHit)) {
        q.metric = 'anggaran'; if (katHit) q.kategori = katHit.target;
      } else if (/\b(pemasukan|pendapatan|penghasilan|uang masuk)\b/.test(t)) {
        q.metric = 'masuk'; if (katHit && katHit.jenis === 'MASUK') q.kategori = katHit.target;
      } else if (katHit) {
        q.metric = 'kategori'; q.kategori = katHit.target;
        // kata yang lebih spesifik dari kategorinya ("listrik" di Tagihan, "kopi" di Jajan) → saring per kata
        const nk = normal((idx.katAktif[katHit.target] || {}).nama || '');
        if (nk.split(/[^a-z0-9]+/).indexOf(katHit.frasa) < 0 && nk !== katHit.frasa) q.kata = katHit.frasa;
      } else if (/\b(pengeluaran|keluar|habis|spending)\b/.test(t)) q.metric = 'keluar';
      else if (/\b(transaksi|catatan|riwayat)\b/.test(t) || (per.ok && per.jenis === 'hari')) q.metric = 'daftar';
      else if (/\b(ringkasan|rekap|total)\b/.test(t) || per.ok) q.metric = 'ringkasan';
      else q.metric = 'kurang';
      return q;
    }

    // ---- Pernyataan saldo dompet ----
    if (nominalKuat) { const ps = pernyataanSaldo(t0, ctx, idx); if (ps) return ps; }

    // ---- Transaksi ----
    if (nomAwal.length) {
      const tglPesan = tanggalTransaksi(t0, ctx.hariIni);
      const segs = pecahSegmen(t0);
      const drafts = segs.map((sg) => segmenTransaksi(sg, ctx, idx, tglPesan)).filter((d) => d.nominal > 0 || d.keterangan);
      return { type: 'transaksi', drafts };
    }

    // Kata kunci tanpa nominal → minta nominal; satu kata saja ("kopi") → tanyakan maksudnya
    if (/\b(me)?nabung\b/.test(t0)) return { type: 'butuh_nominal', keterangan: 'Nabung', jenis: 'PINDAH', teks: t0 };
    const isi = t0.replace(/[?!.,]/g, ' ').split(/\s+/).filter((w) => w && STOP.indexOf(w) < 0 && !/^(dong|ya|nih|deh|sih)$/.test(w));
    const adaKerja = /\b(beli|bayar|isi|jajan|belanja|catat|pesan|order|servis|ganti|sewa|makan|minum)\b/.test(t0);
    if (katHit && !adaKerja && !kt && isi.length <= 3) return { type: 'maksud', kata: isi.join(' '), kategori: katHit.target, jenis: katHit.jenis, dikenal: true, teks: t0 };
    if (!katHit && !kt && isi.length >= 1 && isi.length <= 2 && isi.every((w) => /^[a-z]{3,}$/.test(w) && (w.match(/[aiueo]/g) || []).length / w.length >= 0.3) && !idx.known.has(isi[0])) return { type: 'maksud', kata: isi.join(' '), dikenal: false, teks: t0 };
    if (katHit) return { type: 'butuh_nominal', keterangan: U_huruf1(bersihkanKet(t0, katHit.jenis) || katHit.frasa), kategori: katHit.target, jenis: katHit.jenis, teks: t0 };
    if (/\b(hari ini|kemarin)\b/.test(t)) return { type: 'tanya', metric: 'daftar', periode: per };

    // Tidak dikenali → rekomendasi
    const saran = [];
    if (/\b(laporan|unduh|download)\b/.test(t)) saran.push({ label: 'Unduh laporan bulan ini', teks: 'unduh laporan bulan ini' });
    if (/\b(saldo|dompet|uang)\b/.test(t)) saran.push({ label: 'Saldo semua dompet', teks: 'saldo' });
    saran.push({ label: 'Catat jajan — contoh: es teh 5rb', teks: 'es teh 5rb', contoh: true });
    saran.push({ label: 'Pengeluaran bulan ini', teks: 'pengeluaran bulan ini' });
    saran.push({ label: 'Bantuan', teks: 'bantuan' });
    return { type: 'tidak_dikenal', saran: saran.slice(0, 3).concat(saran.length > 3 ? [saran[saran.length - 1]] : []) };
  }

  const Parser = { analisis, periode, nominalSaja, normal, cariNominal, siapkan, lev, BULAN, dompetDari, kataUmum, KATA_GANDA, cariKategoriNama, frasaIngat, frasaKonteks,
    aturan, ATURAN_BAWAAN, koreksi, skorKandidat, osa, jamDari, jadwalDari, cariIngatan, tokenLabel,
    tenggatDari, peranDari, tipeDompetDari, tujuanDari, angkaKata: angkaDariKata, JENIS_TUJUAN, PEMICU_BAWAAN,
    catatan: { struktur: strukturCatatan, cari: cariCatatan, tampil: tampilCatatan, kataKunci: (t, ctx) => kataKunci(t, petaAlias(ctx)), adaKata: adaKataCatatan, ALIAS_BAWAAN, miripKata } };
  g.Parser = Parser;
  if (typeof module !== 'undefined') module.exports = Parser;
})(typeof window !== 'undefined' ? window : globalThis);
