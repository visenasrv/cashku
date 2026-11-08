package com.cashku.keluarga;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

/** Dipanggil AlarmManager tepat pada waktunya (walau aplikasi ditutup / HP terkunci / offline). */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        String id = intent.getStringExtra("id");
        if (id == null) return;
        long jatuh = System.currentTimeMillis();
        String judul;
        if (Penjadwal.ID_UJI.equals(id)) {
            judul = "Tes alarm CashKu";
        } else {
            JSONObject p = Penjadwal.cari(c, id);
            if (p == null || !"AKTIF".equals(p.optString("status", "AKTIF"))) return;
            judul = p.optString("judul", "Pengingat");
            Penjadwal.prefs(c).edit().remove("tunda_" + id).apply();
            // Langsung jadwalkan kejadian berikutnya (pengingat berulang tetap jalan walau alarm ini diabaikan)
            long t = Penjadwal.berikutnya(p, jatuh + 1000, Penjadwal.offset(c));
            if (t > 0) Penjadwal.jadwalkan(c, id, t); else Penjadwal.prefs(c).edit().remove("waktu_" + id).apply();
            try { p.put("berikutnya", t > 0 ? t : 0); if (t <= 0) p.put("status", "SELESAI"); Penjadwal.perbarui(c, p); } catch (Exception ignored) { }
        }
        Intent s = new Intent(c, AlarmService.class).setAction(AlarmService.AKSI_BUNYI)
                .putExtra("id", id).putExtra("judul", judul).putExtra("jatuh", jatuh);
        try {
            ContextCompat.startForegroundService(c, s);
        } catch (Exception e) {
            // Android menolak layanan latar (mis. izin alarm tepat dicabut) → tampilkan notifikasi layar penuh saja
            AlarmService.siapkanKanal(c);
            Intent layar = new Intent(c, AlarmActivity.class).putExtra("id", id).putExtra("judul", judul).putExtra("jatuh", jatuh)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent pi = PendingIntent.getActivity(c, Penjadwal.kode(id), layar, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            NotificationCompat.Builder b = new NotificationCompat.Builder(c, AlarmService.KANAL_INFO)
                    .setSmallIcon(R.drawable.ic_stat_alarm).setContentTitle("⏰ " + judul).setContentText("Pengingat CashKu")
                    .setCategory(NotificationCompat.CATEGORY_ALARM).setPriority(NotificationCompat.PRIORITY_MAX)
                    .setFullScreenIntent(pi, true).setContentIntent(pi).setAutoCancel(true);
            try { ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(AlarmService.NOTIF_INFO + Penjadwal.kode(id) % 1000, b.build()); } catch (SecurityException ignored) { }
        }
    }
}
