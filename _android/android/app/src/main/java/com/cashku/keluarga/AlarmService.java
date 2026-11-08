package com.cashku.keluarga;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/**
 * Membunyikan alarm: nada alarm (volume alarm) berulang + getar + layar penuh di layar kunci.
 * Berhenti saat HP dibuka kuncinya (ACTION_USER_PRESENT), saat [Matikan]/[Tunda]/[Sudah bayar],
 * atau setelah 2 menit (lalu diulang otomatis 5 menit kemudian, maksimal 3 kali).
 */
public class AlarmService extends Service {
    static final String AKSI_BUNYI = "com.cashku.keluarga.BUNYI";
    static final String AKSI_TANGGAPI = "com.cashku.keluarga.TANGGAPI";
    static final String SIARAN_SELESAI = "com.cashku.keluarga.ALARM_SELESAI";
    static final String KANAL = "alarm_cashku";
    static final String KANAL_INFO = "pengingat_cashku";
    static final int NOTIF_ALARM = 7001;
    static final int NOTIF_INFO = 8000;
    static final long LAMA_BUNYI_MS = 2 * 60 * 1000L;

    static volatile boolean berjalan = false;

    private MediaPlayer pemutar;
    private Vibrator getar;
    private final Handler h = new Handler(Looper.getMainLooper());
    private BroadcastReceiver penerimaBuka;
    private String id = null, judul = "";
    private long jatuh = 0;

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        berjalan = true;
        String aksi = intent == null ? null : intent.getAction();
        if (AKSI_TANGGAPI.equals(aksi)) {
            String idA = intent.getStringExtra("id");
            String jenis = intent.getStringExtra("aksi");
            if (idA != null && jenis != null) Penjadwal.tangani(this, idA, jenis, intent.getLongExtra("jatuh", jatuh));
            selesai(false);
            return START_NOT_STICKY;
        }
        if (intent == null || !AKSI_BUNYI.equals(aksi)) { selesai(false); return START_NOT_STICKY; }
        if (id != null) hentikanBunyi();      // alarm baru menggantikan yang sedang berbunyi
        id = intent.getStringExtra("id");
        judul = intent.getStringExtra("judul");
        jatuh = intent.getLongExtra("jatuh", System.currentTimeMillis());
        siapkanKanal(this);
        Notification n = notifAlarm();
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF_ALARM, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        else startForeground(NOTIF_ALARM, n);
        mulaiBunyi();
        pantauBukaKunci();
        h.postDelayed(this::tidakDitanggapi, LAMA_BUNYI_MS);
        return START_NOT_STICKY;
    }

    static void siapkanKanal(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(KANAL) == null) {
            NotificationChannel k = new NotificationChannel(KANAL, "Alarm pengingat", NotificationManager.IMPORTANCE_HIGH);
            k.setDescription("Alarm tagihan & pengingat CashKu (layar penuh di layar kunci)");
            k.setSound(null, null);            // bunyi diputar sendiri dengan volume alarm
            k.enableVibration(false);
            k.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            k.setBypassDnd(true);
            nm.createNotificationChannel(k);
        }
        if (nm.getNotificationChannel(KANAL_INFO) == null) {
            NotificationChannel k = new NotificationChannel(KANAL_INFO, "Pengingat terlewat", NotificationManager.IMPORTANCE_DEFAULT);
            k.setDescription("Pengingat yang sudah berbunyi tetapi belum ditanggapi");
            nm.createNotificationChannel(k);
        }
    }

    private PendingIntent piAksi(String jenis, int urut) {
        Intent i = new Intent(this, AksiReceiver.class).putExtra("id", id).putExtra("aksi", jenis).putExtra("jatuh", jatuh);
        return PendingIntent.getBroadcast(this, Penjadwal.kode(id) % 100000 * 10 + urut, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Notification notifAlarm() {
        Intent layar = new Intent(this, AlarmActivity.class)
                .putExtra("id", id).putExtra("judul", judul).putExtra("jatuh", jatuh)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent piLayar = PendingIntent.getActivity(this, Penjadwal.kode(id), layar, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, KANAL)
                .setSmallIcon(R.drawable.ic_stat_alarm)
                .setContentTitle("⏰ " + judul)
                .setContentText("Pengingat CashKu · ketuk untuk membuka")
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setFullScreenIntent(piLayar, true)
                .setContentIntent(piLayar)
                .addAction(0, "Matikan", piAksi("matikan", 1))
                .addAction(0, "Tunda 10 menit", piAksi("tunda", 2))
                .addAction(0, "Sudah bayar", piAksi("bayar", 3))
                .build();
    }

    private void mulaiBunyi() {
        try {
            pemutar = new MediaPlayer();
            pemutar.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            Uri u = Penjadwal.nada(this);
            try { pemutar.setDataSource(this, u); }
            catch (Exception e) { pemutar.reset(); pemutar.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()); pemutar.setDataSource(this, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)); }
            pemutar.setLooping(true);
            pemutar.prepare();
            pemutar.start();
        } catch (Exception e) {
            pemutar = null;
        }
        try {
            getar = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (getar != null && getar.hasVibrator()) {
                long[] pola = { 0, 900, 700 };
                if (Build.VERSION.SDK_INT >= 26) getar.vibrate(VibrationEffect.createWaveform(pola, 0));
                else getar.vibrate(pola, 0);
            }
        } catch (Exception ignored) { }
    }

    private void hentikanBunyi() {
        h.removeCallbacksAndMessages(null);
        if (pemutar != null) { try { pemutar.stop(); } catch (Exception ignored) { } pemutar.release(); pemutar = null; }
        if (getar != null) { try { getar.cancel(); } catch (Exception ignored) { } getar = null; }
    }

    private void pantauBukaKunci() {
        if (penerimaBuka != null) return;
        penerimaBuka = new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent i) {
                // HP dibuka kuncinya → alarm dianggap sudah dilihat: bunyi berhenti, pengingat tetap tampil di notifikasi
                if (id == null) return;
                Penjadwal.catatAksi(AlarmService.this, id, "lihat", jatuh, 0);
                Penjadwal.prefs(AlarmService.this).edit().remove("ulang_" + id).apply();
                notifInfo("Ketuk untuk membuka CashKu", true);
                selesai(false);
            }
        };
        ContextCompat.registerReceiver(this, penerimaBuka, new IntentFilter(Intent.ACTION_USER_PRESENT), ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    /** 2 menit tanpa tanggapan → bunyi berhenti, diulang 5 menit lagi (maks 3 kali) */
    private void tidakDitanggapi() {
        if (id == null) return;
        if (!Penjadwal.ID_UJI.equals(id)) {
            int ulang = Penjadwal.prefs(this).getInt("ulang_" + id, 0);
            if (ulang < Penjadwal.MAKS_ULANG) {
                long t = System.currentTimeMillis() + Penjadwal.MENIT_ULANG * 60000L;
                Penjadwal.prefs(this).edit().putInt("ulang_" + id, ulang + 1).putLong("tunda_" + id, t).apply();
                Penjadwal.jadwalkan(this, id, t);
                notifInfo("Belum ditanggapi — berbunyi lagi " + Penjadwal.MENIT_ULANG + " menit lagi", true);
            } else {
                Penjadwal.prefs(this).edit().remove("ulang_" + id).apply();
                notifInfo("Pengingat terlewat", true);
            }
        }
        selesai(false);
    }

    private void notifInfo(String teks, boolean denganTombol) {
        Intent buka = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, Penjadwal.kode(id) % 100000 * 10 + 9, buka, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, KANAL_INFO)
                .setSmallIcon(R.drawable.ic_stat_alarm)
                .setContentTitle("⏰ " + judul)
                .setContentText(teks)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(pi);
        if (denganTombol && !Penjadwal.ID_UJI.equals(id)) {
            b.addAction(0, "Tunda 10 menit", piAksi("tunda", 5)).addAction(0, "Sudah bayar", piAksi("bayar", 6));
        }
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        try { nm.notify(NOTIF_INFO + Penjadwal.kode(id) % 1000, b.build()); } catch (SecurityException ignored) { }
    }

    private void selesai(boolean hapusInfo) {
        hentikanBunyi();
        sendBroadcast(new Intent(SIARAN_SELESAI).setPackage(getPackageName()));
        if (hapusInfo && id != null) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            nm.cancel(NOTIF_INFO + Penjadwal.kode(id) % 1000);
        }
        id = null;
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE); else stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        hentikanBunyi();
        if (penerimaBuka != null) { try { unregisterReceiver(penerimaBuka); } catch (Exception ignored) { } penerimaBuka = null; }
        berjalan = false;
        super.onDestroy();
    }
}
