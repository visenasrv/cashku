package com.cashku.keluarga;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** HP dinyalakan ulang, aplikasi diperbarui, atau jam/zona waktu diubah → pasang ulang semua alarm. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        try { Penjadwal.jadwalkanSemua(c); } catch (Exception ignored) { }
    }
}
