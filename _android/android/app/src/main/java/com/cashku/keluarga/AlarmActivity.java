package com.cashku.keluarga;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.content.ContextCompat;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Layar penuh alarm (tampil di atas layar kunci): [Matikan] [Tunda 10 menit] [Sudah bayar]. */
public class AlarmActivity extends Activity {
    private String id;
    private long jatuh;
    private BroadcastReceiver penerimaSelesai;
    private boolean menanggapi = false;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        tampil(getIntent());
        penerimaSelesai = new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent i) { if (!menanggapi) finish(); }
        };
        ContextCompat.registerReceiver(this, penerimaSelesai, new IntentFilter(AlarmService.SIARAN_SELESAI), ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        tampil(intent);
    }

    private int dp(float v) { return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()); }

    private Button tombol(String teks, int latar, int warnaTeks) {
        Button t = new Button(this);
        t.setText(teks);
        t.setAllCaps(false);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setTextColor(warnaTeks);
        GradientDrawable g = new GradientDrawable();
        g.setColor(latar);
        g.setCornerRadius(dp(16));
        t.setBackground(g);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(58));
        lp.topMargin = dp(12);
        t.setLayoutParams(lp);
        return t;
    }

    private void tampil(Intent i) {
        id = i.getStringExtra("id");
        jatuh = i.getLongExtra("jatuh", System.currentTimeMillis());
        String judul = i.getStringExtra("judul");
        LinearLayout akar = new LinearLayout(this);
        akar.setOrientation(LinearLayout.VERTICAL);
        akar.setGravity(Gravity.CENTER);
        akar.setPadding(dp(28), dp(48), dp(28), dp(40));
        akar.setBackgroundColor(Color.parseColor("#0B3D2E"));

        TextView ikon = new TextView(this);
        ikon.setText("⏰");
        ikon.setTextSize(TypedValue.COMPLEX_UNIT_SP, 64);
        ikon.setGravity(Gravity.CENTER);
        akar.addView(ikon);

        TextView jam = new TextView(this);
        jam.setText(new SimpleDateFormat("HH.mm", new Locale("id", "ID")).format(new Date(jatuh)));
        jam.setTextColor(Color.WHITE);
        jam.setTextSize(TypedValue.COMPLEX_UNIT_SP, 56);
        jam.setTypeface(Typeface.DEFAULT_BOLD);
        jam.setGravity(Gravity.CENTER);
        akar.addView(jam);

        TextView j = new TextView(this);
        j.setText(judul == null ? "Pengingat" : judul);
        j.setTextColor(Color.WHITE);
        j.setTextSize(TypedValue.COMPLEX_UNIT_SP, 26);
        j.setTypeface(Typeface.DEFAULT_BOLD);
        j.setGravity(Gravity.CENTER);
        j.setPadding(0, dp(8), 0, dp(4));
        akar.addView(j);

        TextView sub = new TextView(this);
        sub.setText("Pengingat CashKu");
        sub.setTextColor(Color.parseColor("#B7E4D4"));
        sub.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        sub.setGravity(Gravity.CENTER);
        akar.addView(sub);

        View jarak = new View(this);
        akar.addView(jarak, new LinearLayout.LayoutParams(1, dp(36)));

        Button matikan = tombol("Matikan", Color.parseColor("#FFFFFF"), Color.parseColor("#0B3D2E"));
        Button tunda = tombol("Tunda " + Penjadwal.MENIT_TUNDA + " menit", Color.parseColor("#1F6F55"), Color.WHITE);
        Button bayar = tombol("Sudah bayar", Color.parseColor("#25D366"), Color.parseColor("#06301F"));
        matikan.setOnClickListener(v -> tanggapi("matikan"));
        tunda.setOnClickListener(v -> tanggapi("tunda"));
        bayar.setOnClickListener(v -> tanggapi("bayar"));
        akar.addView(matikan);
        akar.addView(tunda);
        if (!Penjadwal.ID_UJI.equals(id)) akar.addView(bayar);
        setContentView(akar);
    }

    private void tanggapi(String aksi) {
        menanggapi = true;
        if (id != null) {
            Intent s = new Intent(this, AlarmService.class).setAction(AlarmService.AKSI_TANGGAPI)
                    .putExtra("id", id).putExtra("aksi", aksi).putExtra("jatuh", jatuh);
            try { startService(s); } catch (Exception e) { Penjadwal.tangani(this, id, aksi, jatuh); }
        }
        if ("bayar".equals(aksi)) {
            // Buka CashKu agar pembayaran bisa langsung dicatat
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            Intent buka = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            if (km != null && km.isKeyguardLocked() && Build.VERSION.SDK_INT >= 26) {
                km.requestDismissKeyguard(this, new KeyguardManager.KeyguardDismissCallback() {
                    @Override public void onDismissSucceeded() { startActivity(buka); finish(); }
                    @Override public void onDismissCancelled() { finish(); }
                    @Override public void onDismissError() { finish(); }
                });
                return;
            }
            startActivity(buka);
        }
        finish();
    }

    @Override
    protected void onDestroy() {
        if (penerimaSelesai != null) { try { unregisterReceiver(penerimaSelesai); } catch (Exception ignored) { } }
        super.onDestroy();
    }
}
