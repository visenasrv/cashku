package com.cashku.keluarga;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Tombol pada notifikasi alarm (Matikan / Tunda 10 menit / Sudah bayar). */
public class AksiReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        String id = intent.getStringExtra("id"), aksi = intent.getStringExtra("aksi");
        long jatuh = intent.getLongExtra("jatuh", System.currentTimeMillis());
        if (id == null || aksi == null) return;
        if (AlarmService.berjalan) {
            Intent s = new Intent(c, AlarmService.class).setAction(AlarmService.AKSI_TANGGAPI).putExtra("id", id).putExtra("aksi", aksi).putExtra("jatuh", jatuh);
            try { c.startService(s); return; } catch (Exception ignored) { /* layanan sudah berhenti → tangani langsung */ }
        }
        Penjadwal.tangani(c, id, aksi, jatuh);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.cancel(AlarmService.NOTIF_INFO + Penjadwal.kode(id) % 1000);
        c.sendBroadcast(new Intent(AlarmService.SIARAN_SELESAI).setPackage(c.getPackageName()));
    }
}
