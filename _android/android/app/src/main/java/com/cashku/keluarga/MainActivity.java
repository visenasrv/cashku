package com.cashku.keluarga;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlarmCashKuPlugin.class);
        registerPlugin(SuaraPlugin.class);
        amankanPembaruan();
        super.onCreate(savedInstanceState);
        try { Penjadwal.jadwalkanSemua(this); } catch (Exception ignored) { }
    }

    /**
     * Pengaman pembaruan tampilan: bila versi baru belum pernah berhasil terbuka setelah 2 kali percobaan,
     * kembali otomatis ke tampilan bawaan APK (data di HP tidak hilang).
     */
    private void amankanPembaruan() {
        SharedPreferences sp = getSharedPreferences(AlarmCashKuPlugin.PREF_PERBARUAN, Context.MODE_PRIVATE);
        if (!sp.getBoolean("uji", false)) return;
        int n = sp.getInt("percobaan", 0);
        if (n >= 2) {
            getSharedPreferences(com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME, Context.MODE_PRIVATE).edit()
                    .remove(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH).apply();
            sp.edit().putBoolean("uji", false).putInt("percobaan", 0).putString("gagalVersi", sp.getString("versiUji", "")).putString("versiAktif", "").apply();
        } else {
            sp.edit().putInt("percobaan", n + 1).apply();
        }
    }
}
