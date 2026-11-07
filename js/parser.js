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
    'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas', 'belas', 'puluh'].concat(BULAN);
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
      ':' + (ctx.typo || []).length + ':' + (ctx.ingatan || []).map((x) => x.label).join('|');
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
  function cariNominal(s) {
    const out = [];
    RE_AMT.lastIndex = 0;
    let m;
    while ((m = RE_AMT.exec(s))) {
      const start = m.index + m[1].length, teks = m[0].slice(m[1].length);
      const r = nilaiNominal(m[3], m[4], m[4] ? m[5] : '');
      if (!(r.v > 0)) continue;
      const kuat = r.mult > 1 || !!m[2] || /[.,]\d{3}(?!\d)/.test(m[3]) || r.v >= 1000;
      out.push({ nilai: r.v, kuat, index: start, len: teks.length, teks });
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
    const t = normal(text);
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
        akhir.push(s.teks.slice(start, end).trim());
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
    const katSemua = cariSemua(tanpaNominal, idx.kat).filter((k) => !kataUmum(k.frasa));
    const katTerpanjang = katSemua.slice().sort((a, b) => b.len - a.len)[0];
    let dompetHits = ctx.fiturDompet ? cariSemua(tanpaNominal, idx.dompet) : [];
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

    if (jenis === 'PINDAH') {
      if (!ctx.fiturDompet) { d.pindahNonaktif = true; return d; }
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
    } else d.id_dompet = '';

    const rangesDompet = dompetHits.map((hh) => {
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
  // Ingatan data: "ingat nomor listrik saya 1234567890"
  // ----------------------------------------------------------------
  const SINONIM = { no: 'nomor', nmr: 'nomor', nomer: 'nomor', nmor: 'nomor', nomor: 'nomor', rek: 'rekening', rekening: 'rekening', pln: 'listrik',
    listrik: 'listrik', pdam: 'air', wa: 'whatsapp', whatsapp: 'whatsapp', hp: 'hp', handphone: 'hp', telp: 'telepon', telpon: 'telepon',
    telepon: 'telepon', pass: 'password', pw: 'password', sandi: 'password', password: 'password', 'e-mail': 'email', email: 'email', mail: 'email',
    ktp: 'ktp', nik: 'nik', alamat: 'alamat', almt: 'alamat', id: 'id', idpel: 'pelanggan', pelanggan: 'pelanggan', meteran: 'meteran',
    nopol: 'plat', plat: 'plat', kendaraan: 'kendaraan', motor: 'motor', mobil: 'mobil', bpjs: 'bpjs', wifi: 'wifi', akun: 'akun', user: 'username', username: 'username' };
  const ISI_KOSONG = /^(saya|aku|ku|punya|punyaku|milik|milikku|kita|kami|yang|untuk|buat|di|ke|ya|dong|tolong|nya|kamu|sih|tuh|itu|ini|si|berapa|brp|apa|mana|lihat|liat|cek|minta|kasih|kasi|sebutkan|tau|tahu|dong|lagi|sekarang|coba|deh)$/;
  const tokenLabel = (s) => normal(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w && !ISI_KOSONG.test(w) && !/^\d+$/.test(w)).map((w) => SINONIM[w] || w);
  function cariIngatan(t, daftar, ambang) {
    const q = tokenLabel(t);
    if (!q.length) return [];
    const hasil = [];
    (daftar || []).forEach((x) => {
      const L = Array.from(new Set(tokenLabel(x.label)));
      if (!L.length) return;
      const kena = L.filter((w) => q.some((v) => v === w || (w.length >= 5 && v.length >= 5 && lev(v, w) <= 1))).length;
      const skor = kena / L.length;
      const sisa = q.filter((v) => !L.some((w) => v === w || (w.length >= 5 && lev(v, w) <= 1))).length;
      if (skor >= ambang && kena >= 1) hasil.push({ id: x.id_ingatan, skor: skor - sisa * 0.05, kena });
    });
    return hasil.sort((a, b) => b.skor - a.skor);
  }
  const LABEL_KUAT = /\b(nomor|no|norek|nik|npwp|nisn|nim|nip|id|idpel|kode|pin|password|pass|sandi|akun|username|email|e-mail|alamat|plat|nopol|ukuran|golongan|wifi|polis|bpjs|ktp|kk|resi|pelanggan|meteran|kartu|va|virtual account|tanggal lahir|ultah|ulang tahun)\b/;
  const RE_SIMPAN = /^(?:tolong\s+|mohon\s+|coba\s+)?(?:ingat|ingatlah|simpan|catat)(?:\s+(?:ya|yah|baik baik|baik-baik|dong))?\s+(.+)$/i;
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
      .filter((w, i, a) => !/^(saya|aku|ku|punya|punyaku|milik|milikku|yang|itu|ini|nya)$/.test(w)).join(' ').trim();
  }
  function ingatanDari(t0, raw, ctx, at) {
    let m;
    if (/^(?:apa\s+(?:saja|aja)\s+(?:yang\s+)?(?:kamu\s+|cashku\s+)?(?:ingat|simpan|catat)|(?:daftar|lihat|tampilkan|semua)\s+(?:ingatan|data(?:\s+yang)?\s+(?:di)?simpan|catatan data)|ingatan(?:mu| saya| ku)?|data (?:saya|ku) apa (?:saja|aja))\??$/.test(t0)) return { type: 'ingatanDaftar' };
    if ((m = /^(?:tolong\s+)?(?:hapus|lupakan|buang)\s+(?:ingatan\s+|data\s+|catatan\s+)?(.+?)(?:\s+(?:ya|dong|saja|aja))*$/.exec(t0)) && !/^kata\s/.test(m[1])) {
      const c = cariIngatan(m[1], ctx.ingatan, 0.99);
      if (c.length) return { type: 'ingatanHapus', ids: c.filter((x) => x.skor >= c[0].skor - 0.01).map((x) => x.id) };
    }
    const rm = RE_SIMPAN.exec(String(raw).trim().replace(/\s+/g, ' '));
    if ((m = RE_SIMPAN.exec(t0)) && rm) {
      const body = m[1];
      if (/^kata\s/.test(body)) return null;
      if (/\s(?:masuk(?:nya)?|sebagai|termasuk)\s+(?:ke\s+)?(?:kategori\s+)?[a-z]/.test(body) && !/\d{4,}/.test(body)) return null;   // "ingat X masuk Y" = ajari
      if (cariNominal(tutupBukanNominal(body)).some((a) => a.kuat && (/rb|ribu|jt|juta|k\b|rp/.test(a.teks)))) return null;           // ada uang → transaksi
      const kuat = LABEL_KUAT.test(body) || /[:=]|\s(adalah|yaitu|ialah|yakni)\s/.test(body) || (/\b(rekening|rek|hp|wa|whatsapp|telepon)\b/.test(body) && /\d{5,}/.test(body));
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
    if (!ctx.ingatan || !ctx.ingatan.length) return null;
    if (cariNominal(tutupBukanNominal(t0)).some((a) => a.kuat && (/rb|ribu|jt|juta|k\b|rp/.test(a.teks)))) return null;
    if (/\b(bulan|minggu|tahun|kemarin|hari ini|pengeluaran|pemasukan|bayar|beli|total|rata)\b/.test(t0)) return null;   // laporan, bukan ingatan
    const c = cariIngatan(t0, ctx.ingatan, at.ingatan_ambang);
    if (!c.length) return null;
    const tanya = /\b(berapa|brp|apa|mana|lihat|liat|cek|minta|kasih|kasi|sebutkan|tau|tahu|ingat)\b|\?/.test(t0);
    if (!tanya && c[0].skor < 0.99) return null;
    return { type: 'ingatanTanya', ids: c.filter((x) => x.skor >= c[0].skor - 0.01).map((x) => x.id) };
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
  function pengingatDari(t0, ctx) {
    let m;
    if (/^(?:(?:daftar|lihat|liat|cek|semua|tampilkan)\s+(?:pengingat|alarm)|(?:pengingat|alarm)(?:\s+(?:saya|ku|aku))?(?:\s+apa\s+(?:saja|aja))?|apa\s+(?:saja|aja)\s+pengingat(?:\s+(?:saya|ku))?)\??$/.test(t0)) return { type: 'pengingatDaftar' };
    if ((m = /^(?:tolong\s+)?(?:hapus|batalkan|batal|matikan|stop|hentikan|nonaktifkan)\s+(?:pengingat|alarm)(?:\s+(.+))?$/.exec(t0))) return { type: 'pengingatHapus', kata: (m[1] || '').trim() };
    if (/^(?:tes|test|uji|coba)\s+(?:alarm|notifikasi|pengingat|bunyi)(?:\s+(?:dong|ya))?$/.test(t0)) return { type: 'pengingatUji' };
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
    const t00 = normal(raw);
    if (!t00) return { type: 'kosong' };
    const t0 = rapikan(t00, idx);

    let m;
    // Pengingat & ingatan data diperiksa sebelum koreksi typo agar isi data (nomor, nama) tidak diubah
    const pg = pengingatDari(t0, ctx);
    if (pg) return pg;
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
    aturan, ATURAN_BAWAAN, koreksi, skorKandidat, osa, jamDari, jadwalDari, cariIngatan, tokenLabel };
  g.Parser = Parser;
  if (typeof module !== 'undefined') module.exports = Parser;
})(typeof window !== 'undefined' ? window : globalThis);
