package com.cashku.keluarga;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlarmCashKuPlugin.class);
        registerPlugin(SuaraPlugin.class);
        amankanPembaruan();
        super.onCreate(savedInstanceState);
        try { Penjadwal.jadwalkanSemua(this); } catch (Exception ignored) { }
        pasangTombolKembali();
    }

    /**
     * Tombol kembali bawaan HP: ditanyakan dulu ke tampilan (tutup jendela/lembar yang terbuka, atau mundur ke halaman
     * sebelumnya / chat). Bila sudah di chat, aplikasi hanya dikecilkan (tidak ditutup paksa), seperti aplikasi chat lain.
     */
    private void pasangTombolKembali() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView wv = getBridge() != null ? getBridge().getWebView() : null;
                if (wv == null) { moveTaskToBack(true); return; }
                wv.evaluateJavascript(
                        "(function(){try{return window.CashKuKembali?String(window.CashKuKembali()):'false'}catch(e){return 'false'}})()",
                        hasil -> { if (hasil == null || !hasil.contains("true")) moveTaskToBack(true); });
            }
        });
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
