package com.cashku.keluarga;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.TimeZone;

/**
 * Penyimpanan & penjadwalan alarm CashKu (tanpa internet).
 * Daftar pengingat dikirim dari aplikasi (sinkron) dan disimpan di SharedPreferences,
 * lalu dijadwalkan sebagai alarm tepat waktu (AlarmManager.setAlarmClock).
 * Hitungan "berikutnya" sama persis dengan Jadwal.berikutnya di pengingat.js (zona waktu tetap, tanggal 31 → akhir bulan).
 */
public final class Penjadwal {
    static final String PREF = "cashku_alarm";
    static final String AKSI_ALARM = "com.cashku.keluarga.ALARM";
    static final String ID_UJI = "uji";
    static final int MAKS_ULANG = 3;          // alarm diulang otomatis bila tidak ditanggapi
    static final int MENIT_ULANG = 5;
    static final int MENIT_TUNDA = 10;

    private Penjadwal() {}

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREF, Context.MODE_PRIVATE); }

    static JSONArray daftar(Context c) {
        try { return new JSONArray(prefs(c).getString("daftar", "[]")); } catch (JSONException e) { return new JSONArray(); }
    }

    static void simpanDaftar(Context c, JSONArray a, int offsetJam) {
        prefs(c).edit().putString("daftar", a.toString()).putInt("offset", offsetJam).apply();
    }

    static int offset(Context c) { return prefs(c).getInt("offset", 8); }

    static JSONObject cari(Context c, String id) {
        JSONArray a = daftar(c);
        for (int i = 0; i < a.length(); i++) {
            JSONObject p = a.optJSONObject(i);
            if (p != null && id.equals(p.optString("id_pengingat"))) return p;
        }
        return null;
    }

    static void perbarui(Context c, JSONObject baru) {
        JSONArray a = daftar(c), b = new JSONArray();
        String id = baru.optString("id_pengingat");
        for (int i = 0; i < a.length(); i++) {
            JSONObject p = a.optJSONObject(i);
            if (p != null && !id.equals(p.optString("id_pengingat"))) b.put(p);
        }
        b.put(baru);
        prefs(c).edit().putString("daftar", b.toString()).apply();
    }

    static int kode(String id) { return id.hashCode() & 0x7fffffff; }

    // ------------------------------------------------------------------
    // Hitung waktu bunyi berikutnya (ms) setelah `sejak`; -1 bila tidak ada lagi
    // ------------------------------------------------------------------
    static long berikutnya(JSONObject p, long sejak, int offJam) {
        String[] hm = p.optString("jam", "07:00").split(":");
        int hh = angka(hm.length > 0 ? hm[0] : "7", 7), mm = angka(hm.length > 1 ? hm[1] : "0", 0);
        long geser = offJam * 3600000L;
        Calendar L = utc(); L.setTimeInMillis(sejak + geser);
        int Ly = L.get(Calendar.YEAR), Lm = L.get(Calendar.MONTH) + 1, Ld = L.get(Calendar.DAY_OF_MONTH);
        String pola = p.optString("pola", "SEKALI");
        long t;
        switch (pola) {
            case "SEKALI": {
                int[] a = tgl(p.optString("tanggal", ""));
                return a == null ? -1 : cek(a[0], a[1], a[2], hh, mm, geser, sejak);
            }
            case "HARIAN":
                for (int i = 0; i < 3; i++) {
                    int[] x = hariKe(Ly, Lm, Ld, i);
                    t = cek(x[0], x[1], x[2], hh, mm, geser, sejak);
                    if (t > 0) return t;
                }
                return -1;
            case "MINGGUAN": {
                String hs = "," + p.optString("hari_minggu", "").replace(" ", "") + ",";
                if (hs.length() <= 2) return -1;
                for (int i = 0; i < 15; i++) {
                    int[] x = hariKe(Ly, Lm, Ld, i);
                    if (!hs.contains("," + x[3] + ",")) continue;
                    t = cek(x[0], x[1], x[2], hh, mm, geser, sejak);
                    if (t > 0) return t;
                }
                return -1;
            }
            case "BULANAN": {
                String hb = p.optString("hari_bulan", "1");
                for (int i = 0; i < 14; i++) {
                    int y = Ly, m = Lm + i;
                    while (m > 12) { m -= 12; y++; }
                    int n = jumlahHari(y, m);
                    int d = "AKHIR".equalsIgnoreCase(hb) ? n : Math.min(Math.max(angka(hb, 1), 1), n);
                    t = cek(y, m, d, hh, mm, geser, sejak);
                    if (t > 0) return t;
                }
                return -1;
            }
            case "TAHUNAN": {
                String[] s = p.optString("tanggal", "").split("-");
                int mo = s.length == 3 ? angka(s[1], 0) : (s.length >= 1 ? angka(s[0], 0) : 0);
                int da = s.length == 3 ? angka(s[2], 0) : (s.length >= 2 ? angka(s[1], 0) : 0);
                if (mo < 1 || da < 1) return -1;
                for (int i = 0; i < 3; i++) {
                    t = cek(Ly + i, mo, Math.min(da, jumlahHari(Ly + i, mo)), hh, mm, geser, sejak);
                    if (t > 0) return t;
                }
                return -1;
            }
            default:
                return -1;
        }
    }

    private static Calendar utc() {
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        c.clear();
        return c;
    }
    private static long cek(int y, int m, int d, int hh, int mm, long geser, long sejak) {
        Calendar c = utc();
        c.set(y, m - 1, d, hh, mm, 0);
        long t = c.getTimeInMillis() - geser;
        return t > sejak ? t : -1;
    }
    /** {tahun, bulan, tanggal, hari (1=Senin..7=Minggu)} untuk hari ke-i setelah tanggal lokal */
    private static int[] hariKe(int y, int m, int d, int i) {
        Calendar c = utc();
        c.set(y, m - 1, d, 12, 0, 0);
        c.add(Calendar.DAY_OF_MONTH, i);
        int dow = c.get(Calendar.DAY_OF_WEEK); // 1=Minggu
        return new int[] { c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH), dow == Calendar.SUNDAY ? 7 : dow - 1 };
    }
    private static int jumlahHari(int y, int m) {
        Calendar c = utc();
        c.set(y, m - 1, 1, 12, 0, 0);
        return c.getActualMaximum(Calendar.DAY_OF_MONTH);
    }
    private static int[] tgl(String s) {
        String[] a = s.split("-");
        if (a.length != 3) return null;
        int y = angka(a[0], 0), m = angka(a[1], 0), d = angka(a[2], 0);
        return y > 0 && m > 0 && d > 0 ? new int[] { y, m, d } : null;
    }
    static int angka(String s, int bawaan) {
        try { return Integer.parseInt(s.trim()); } catch (Exception e) { return bawaan; }
    }

    // ------------------------------------------------------------------
    // Penjadwalan
    // ------------------------------------------------------------------
    static PendingIntent piAlarm(Context c, String id) {
        Intent i = new Intent(c, AlarmReceiver.class).setAction(AKSI_ALARM).putExtra("id", id);
        return PendingIntent.getBroadcast(c, kode(id), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static boolean bisaTepat(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        return Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
    }

    static void jadwalkan(Context c, String id, long waktu) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent op = piAlarm(c, id);
        if (bisaTepat(c)) {
            Intent buka = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent tampil = PendingIntent.getActivity(c, kode(id), buka, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(waktu, tampil), op);
        } else {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, waktu, op);   // cadangan bila izin alarm tepat dicabut
        }
        prefs(c).edit().putLong("waktu_" + id, waktu).apply();
    }

    static void batal(Context c, String id) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        am.cancel(piAlarm(c, id));
        prefs(c).edit().remove("waktu_" + id).remove("ulang_" + id).apply();
    }

    /** Jadwalkan ulang semua pengingat (setelah sinkron, HP dinyalakan ulang, aplikasi diperbarui, jam diubah) */
    static int jadwalkanSemua(Context c) {
        SharedPreferences sp = prefs(c);
        JSONArray a = daftar(c);
        int off = offset(c);
        long now = System.currentTimeMillis();
        // Batalkan alarm lama yang sudah tidak ada di daftar
        String lama = sp.getString("terjadwal", "");
        StringBuilder baru = new StringBuilder();
        int n = 0;
        for (int i = 0; i < a.length(); i++) {
            JSONObject p = a.optJSONObject(i);
            if (p == null) continue;
            String id = p.optString("id_pengingat");
            if (id.isEmpty()) continue;
            if (!"AKTIF".equals(p.optString("status", "AKTIF"))) { batal(c, id); continue; }
            long t = p.optLong("berikutnya", 0);
            long tunda = sp.getLong("tunda_" + id, 0);
            if (tunda > now && (t <= now || tunda < t)) t = tunda;           // tunda yang dipilih di layar alarm
            if (t <= now) t = berikutnya(p, now, off);
            if (t <= 0) { batal(c, id); continue; }
            jadwalkan(c, id, t);
            baru.append(id).append('\n');
            n++;
        }
        for (String id : lama.split("\n")) {
            if (!id.isEmpty() && baru.indexOf(id + "\n") < 0 && !ID_UJI.equals(id)) batal(c, id);
        }
        sp.edit().putString("terjadwal", baru.toString()).apply();
        return n;
    }

    // ------------------------------------------------------------------
    // Nada alarm
    // ------------------------------------------------------------------
    static Uri nada(Context c) {
        String s = prefs(c).getString("nada", null);
        if (s != null && !s.isEmpty()) return Uri.parse(s);
        Uri u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (u == null) u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        if (u == null) u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        return u;
    }
    static String namaNada(Context c) {
        try {
            Uri u = nada(c);
            android.media.Ringtone r = u == null ? null : RingtoneManager.getRingtone(c, u);
            return r == null ? "Bawaan" : r.getTitle(c);
        } catch (Exception e) { return "Bawaan"; }
    }

    // ------------------------------------------------------------------
    // Aksi dari layar alarm → dikirim ke server saat aplikasi dibuka
    // ------------------------------------------------------------------
    static synchronized void catatAksi(Context c, String id, String aksi, long jatuh, long sampai) {
        if (ID_UJI.equals(id)) return;
        try {
            JSONArray a = new JSONArray(prefs(c).getString("aksi", "[]"));
            JSONObject o = new JSONObject();
            o.put("id", id); o.put("aksi", aksi); o.put("jatuh", jatuh); o.put("sampai", sampai); o.put("waktu", System.currentTimeMillis());
            JSONObject p = cari(c, id);
            if (p != null) o.put("judul", p.optString("judul"));
            a.put(o);
            prefs(c).edit().putString("aksi", a.toString()).apply();
        } catch (JSONException ignored) { }
    }
    static synchronized JSONArray ambilAksi(Context c) {
        JSONArray a;
        try { a = new JSONArray(prefs(c).getString("aksi", "[]")); } catch (JSONException e) { a = new JSONArray(); }
        prefs(c).edit().putString("aksi", "[]").apply();
        return a;
    }

    /** Tanggapan pengguna: matikan / tunda / bayar / lihat (HP dibuka) */
    static void tangani(Context c, String id, String aksi, long jatuh) {
        long now = System.currentTimeMillis();
        SharedPreferences.Editor e = prefs(c).edit();
        e.remove("ulang_" + id);
        if ("tunda".equals(aksi)) {
            long sampai = now + MENIT_TUNDA * 60000L;
            e.putLong("tunda_" + id, sampai).apply();
            jadwalkan(c, id, sampai);
            catatAksi(c, id, "tunda", jatuh, sampai);
            return;
        }
        e.remove("tunda_" + id).apply();
        catatAksi(c, id, aksi, jatuh, 0);
        if (ID_UJI.equals(id)) return;
        JSONObject p = cari(c, id);
        if (p != null) {
            long t = berikutnya(p, Math.max(now, jatuh) + 1000, offset(c));
            if (t > 0) jadwalkan(c, id, t); else batal(c, id);
        }
    }
}
