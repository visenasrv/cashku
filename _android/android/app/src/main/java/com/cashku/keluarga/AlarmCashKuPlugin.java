package com.cashku.keluarga;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Jembatan aplikasi CashKu ↔ Android:
 * alarm asli (sinkron, tes, izin, nada, aksi), info versi, dan pembaruan tampilan tanpa APK baru.
 */
@CapacitorPlugin(name = "AlarmCashKu", permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifikasi") })
public class AlarmCashKuPlugin extends Plugin {

    // ------------------------------------------------------------------ Alarm
    @PluginMethod
    public void sinkron(PluginCall call) {
        JSArray d = call.getArray("daftar", new JSArray());
        int off = call.getInt("offset", 8);
        Context c = getContext();
        Penjadwal.simpanDaftar(c, d, off);
        int n = Penjadwal.jadwalkanSemua(c);
        JSObject r = new JSObject();
        r.put("terjadwal", n);
        call.resolve(r);
    }

    @PluginMethod
    public void tes(PluginCall call) {
        int detik = call.getInt("detik", 5);
        Penjadwal.jadwalkan(getContext(), Penjadwal.ID_UJI, System.currentTimeMillis() + Math.max(1, detik) * 1000L);
        call.resolve();
    }

    @PluginMethod
    public void ambilAksi(PluginCall call) {
        JSObject r = new JSObject();
        try { r.put("aksi", new JSArray(Penjadwal.ambilAksi(getContext()).toString())); } catch (Exception e) { r.put("aksi", new JSArray()); }
        call.resolve(r);
    }

    // ------------------------------------------------------------------ Izin
    @PluginMethod
    public void cekIzin(PluginCall call) {
        Context c = getContext();
        JSObject r = new JSObject();
        boolean notif = Build.VERSION.SDK_INT < 33 || getPermissionState("notifikasi") == PermissionState.GRANTED;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notif && Build.VERSION.SDK_INT >= 24) notif = nm.areNotificationsEnabled();
        boolean layarPenuh = Build.VERSION.SDK_INT < 34 || nm.canUseFullScreenIntent();
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        boolean baterai = pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName());
        r.put("notifikasi", notif);
        r.put("alarmTepat", Penjadwal.bisaTepat(c));
        r.put("layarPenuh", layarPenuh);
        r.put("baterai", baterai);
        r.put("merek", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
        r.put("model", Build.MODEL == null ? "" : Build.MODEL);
        r.put("android", Build.VERSION.SDK_INT);
        r.put("nada", Penjadwal.namaNada(c));
        call.resolve(r);
    }

    @PluginMethod
    public void mintaNotifikasi(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifikasi") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifikasi", call, "izinNotifikasi");
            return;
        }
        JSObject r = new JSObject();
        r.put("notifikasi", true);
        call.resolve(r);
    }

    @PermissionCallback
    private void izinNotifikasi(PluginCall call) {
        JSObject r = new JSObject();
        r.put("notifikasi", getPermissionState("notifikasi") == PermissionState.GRANTED);
        call.resolve(r);
    }

    /** jenis: notifikasi | alarmTepat | layarPenuh | baterai | autostart | aplikasi */
    @PluginMethod
    public void bukaIzin(PluginCall call) {
        String jenis = call.getString("jenis", "aplikasi");
        Context c = getContext();
        String pkg = c.getPackageName();
        Intent i;
        switch (jenis) {
            case "notifikasi":
                i = Build.VERSION.SDK_INT >= 26 ? new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg) : detailAplikasi(pkg);
                break;
            case "alarmTepat":
                i = Build.VERSION.SDK_INT >= 31 ? new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + pkg)) : detailAplikasi(pkg);
                break;
            case "layarPenuh":
                i = Build.VERSION.SDK_INT >= 34 ? new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + pkg)) : detailAplikasi(pkg);
                break;
            case "baterai":
                i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + pkg));
                break;
            case "autostart":
                if (bukaAutostart()) { call.resolve(); return; }
                i = detailAplikasi(pkg);
                break;
            default:
                i = detailAplikasi(pkg);
        }
        try {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
        } catch (Exception e) {
            try { c.startActivity(detailAplikasi(pkg).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { }
        }
        call.resolve();
    }

    private Intent detailAplikasi(String pkg) {
        return new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
    }

    /** Halaman "mulai otomatis" khusus merek HP (Xiaomi, Oppo/Realme, Vivo, Huawei, Asus) */
    private boolean bukaAutostart() {
        String[][] kandidat = {
                { "com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity" },
                { "com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity" },
                { "com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity" },
                { "com.oplus.safecenter", "com.oplus.safecenter.permission.startup.StartupAppListActivity" },
                { "com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity" },
                { "com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity" },
                { "com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity" },
                { "com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity" }
        };
        for (String[] k : kandidat) {
            try {
                Intent i = new Intent().setComponent(new ComponentName(k[0], k[1])).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                return true;
            } catch (ActivityNotFoundException | SecurityException ignored) { }
        }
        return false;
    }

    // ------------------------------------------------------------------ Nada alarm
    @PluginMethod
    public void pilihNada(PluginCall call) {
        Intent i = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER)
                .putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALARM | RingtoneManager.TYPE_RINGTONE)
                .putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Nada alarm CashKu")
                .putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false)
                .putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
                .putExtra(RingtoneManager.EXTRA_RINGTONE_DEFAULT_URI, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM))
                .putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Penjadwal.nada(getContext()));
        startActivityForResult(call, i, "nadaDipilih");
    }

    @ActivityCallback
    private void nadaDipilih(PluginCall call, ActivityResult hasil) {
        if (call == null) return;
        if (hasil.getResultCode() == Activity.RESULT_OK && hasil.getData() != null) {
            Uri u = hasil.getData().getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
            Penjadwal.prefs(getContext()).edit().putString("nada", u == null ? "" : u.toString()).apply();
        }
        JSObject r = new JSObject();
        r.put("nada", Penjadwal.namaNada(getContext()));
        call.resolve(r);
    }

    // ------------------------------------------------------------------ Versi & pembaruan tampilan
    static final String PREF_PERBARUAN = "cashku_perbaruan";

    @PluginMethod
    public void info(PluginCall call) {
        Context c = getContext();
        JSObject r = new JSObject();
        try {
            PackageInfo pi = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            r.put("versiApk", pi.versionName);
            r.put("buildApk", Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode);
        } catch (Exception e) {
            r.put("versiApk", "");
            r.put("buildApk", 0);
        }
        SharedPreferences sp = c.getSharedPreferences(PREF_PERBARUAN, Context.MODE_PRIVATE);
        r.put("urlPembaruan", getConfig().getString("urlPembaruan", ""));
        r.put("repo", getConfig().getString("repo", ""));
        r.put("versiWeb", sp.getString("versiAktif", ""));
        r.put("gagalVersi", sp.getString("gagalVersi", ""));
        r.put("paket", c.getPackageName());
        call.resolve(r);
    }

    /** Unduh semua berkas tampilan versi baru ke penyimpanan aplikasi (tidak dipakai sebelum lengkap). */
    @PluginMethod
    public void unduhVersi(PluginCall call) {
        final String url = call.getString("url", "");
        final String versi = call.getString("versi", "").replaceAll("[^0-9A-Za-z._-]", "");
        final JSArray berkas = call.getArray("berkas", new JSArray());
        if (url.isEmpty() || versi.isEmpty() || berkas.length() == 0) { call.reject("Data pembaruan tidak lengkap."); return; }
        new Thread(() -> {
            File akar = new File(getContext().getFilesDir(), "web");
            File sementara = new File(akar, versi + ".unduh");
            File tujuan = new File(akar, versi);
            try {
                hapus(sementara);
                for (int i = 0; i < berkas.length(); i++) {
                    String jalur = berkas.getString(i);
                    if (jalur.contains("..") || jalur.startsWith("/")) throw new Exception("Jalur tidak valid: " + jalur);
                    File f = new File(sementara, jalur);
                    File induk = f.getParentFile();
                    if (induk != null && !induk.exists() && !induk.mkdirs()) throw new Exception("Gagal membuat folder");
                    unduh(url + jalur + "?v=" + Uri.encode(versi), f);
                }
                if (!new File(sementara, "index.html").exists()) throw new Exception("index.html tidak ada");
                hapus(tujuan);
                if (!sementara.renameTo(tujuan)) throw new Exception("Gagal menyimpan versi");
                JSObject r = new JSObject();
                r.put("path", tujuan.getAbsolutePath());
                call.resolve(r);
            } catch (Exception e) {
                hapus(sementara);
                call.reject("Pembaruan gagal diunduh: " + e.getMessage());
            }
        }).start();
    }

    private static void unduh(String alamat, File ke) throws Exception {
        HttpURLConnection k = (HttpURLConnection) new URL(alamat).openConnection();
        k.setConnectTimeout(15000);
        k.setReadTimeout(30000);
        k.setUseCaches(false);
        int kode = k.getResponseCode();
        if (kode != 200) throw new Exception("HTTP " + kode + " " + alamat);
        try (InputStream in = k.getInputStream(); OutputStream out = new FileOutputStream(ke)) {
            byte[] b = new byte[16384];
            int n;
            long total = 0;
            while ((n = in.read(b)) > 0) { out.write(b, 0, n); total += n; }
            if (total == 0) throw new Exception("Berkas kosong: " + alamat);
        } finally {
            k.disconnect();
        }
    }

    static void hapus(File f) {
        if (f == null || !f.exists()) return;
        File[] isi = f.listFiles();
        if (isi != null) for (File x : isi) hapus(x);
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }

    /** Pakai versi yang sudah diunduh: dicoba dulu; bila gagal terbuka 2 kali, otomatis kembali ke versi bawaan APK. */
    @PluginMethod
    public void pakaiVersi(PluginCall call) {
        String path = call.getString("path", "");
        String versi = call.getString("versi", "");
        boolean sekarang = Boolean.TRUE.equals(call.getBoolean("sekarang", false));
        if (path.isEmpty() || !new File(path, "index.html").exists()) { call.reject("Versi belum lengkap."); return; }
        Context c = getContext();
        c.getSharedPreferences(com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME, Context.MODE_PRIVATE).edit()
                .putString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, path).apply();
        c.getSharedPreferences(PREF_PERBARUAN, Context.MODE_PRIVATE).edit()
                .putBoolean("uji", true).putInt("percobaan", 0).putString("versiUji", versi).apply();
        call.resolve();
        if (sekarang) getActivity().runOnUiThread(() -> getBridge().setServerBasePath(path));
    }

    /** Dipanggil tampilan setelah berhasil terbuka: versi dianggap sehat, versi lama dibersihkan. */
    @PluginMethod
    public void versiSehat(PluginCall call) {
        Context c = getContext();
        SharedPreferences sp = c.getSharedPreferences(PREF_PERBARUAN, Context.MODE_PRIVATE);
        String aktif = c.getSharedPreferences(com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME, Context.MODE_PRIVATE)
                .getString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, "");
        SharedPreferences.Editor e = sp.edit().putBoolean("uji", false).putInt("percobaan", 0);
        if (sp.getBoolean("uji", false)) e.putString("versiAktif", sp.getString("versiUji", ""));
        e.apply();
        File akar = new File(c.getFilesDir(), "web");
        File[] isi = akar.listFiles();
        if (isi != null) for (File f : isi) if (aktif == null || !aktif.equals(f.getAbsolutePath())) hapus(f);
        call.resolve();
    }

    @PluginMethod
    public void kembaliBawaan(PluginCall call) {
        Context c = getContext();
        c.getSharedPreferences(com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME, Context.MODE_PRIVATE).edit()
                .remove(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH).apply();
        c.getSharedPreferences(PREF_PERBARUAN, Context.MODE_PRIVATE).edit().putBoolean("uji", false).putString("versiAktif", "").apply();
        call.resolve();
        getActivity().runOnUiThread(() -> getBridge().setServerAssetPath("public"));
    }
}
