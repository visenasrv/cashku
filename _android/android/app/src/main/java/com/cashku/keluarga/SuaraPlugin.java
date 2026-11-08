package com.cashku.keluarga;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

/**
 * Pengenal suara bawaan Android (id-ID). Hanya TEKS hasilnya yang dikirim ke aplikasi; rekaman tidak disimpan.
 * Event: "sebagian" {teks}, "hasil" {teks}, "galat" {kode}.
 */
@CapacitorPlugin(name = "SuaraCashKu", permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "mikrofon") })
public class SuaraPlugin extends Plugin {
    private SpeechRecognizer pengenal;

    @PluginMethod
    public void periksaIzin(PluginCall call) {
        JSObject r = new JSObject();
        r.put("mikrofon", getPermissionState("mikrofon").toString());
        call.resolve(r);
    }

    @PluginMethod
    public void mintaIzin(PluginCall call) {
        if (getPermissionState("mikrofon") == PermissionState.GRANTED) { periksaIzin(call); return; }
        requestPermissionForAlias("mikrofon", call, "izinMikrofon");
    }

    @PermissionCallback
    private void izinMikrofon(PluginCall call) { periksaIzin(call); }

    @PluginMethod
    public void mulai(PluginCall call) {
        final String bahasa = call.getString("bahasa", "id-ID");
        final boolean offline = Boolean.TRUE.equals(call.getBoolean("utamakanOffline", false));
        getActivity().runOnUiThread(() -> {
            try {
                if (!SpeechRecognizer.isRecognitionAvailable(getContext())) { kirimGalat("tidak_didukung"); call.resolve(); return; }
                hancurkan();
                pengenal = SpeechRecognizer.createSpeechRecognizer(getContext());
                pengenal.setRecognitionListener(new Pendengar());
                Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                        .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                        .putExtra(RecognizerIntent.EXTRA_LANGUAGE, bahasa)
                        .putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, bahasa)
                        .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                        .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                        .putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
                if (offline) i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
                pengenal.startListening(i);
                call.resolve();
            } catch (Exception e) {
                kirimGalat("umum");
                call.resolve();
            }
        });
    }

    @PluginMethod
    public void berhenti(PluginCall call) {
        getActivity().runOnUiThread(() -> { if (pengenal != null) { try { pengenal.stopListening(); } catch (Exception ignored) { } } });
        call.resolve();
    }

    private void hancurkan() {
        if (pengenal != null) { try { pengenal.destroy(); } catch (Exception ignored) { } pengenal = null; }
    }

    private void kirimGalat(String kode) {
        JSObject d = new JSObject();
        d.put("kode", kode);
        notifyListeners("galat", d);
    }

    private static String teksDari(Bundle b) {
        if (b == null) return "";
        ArrayList<String> a = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return a == null || a.isEmpty() ? "" : a.get(0);
    }

    private class Pendengar implements RecognitionListener {
        @Override public void onReadyForSpeech(Bundle params) { }
        @Override public void onBeginningOfSpeech() { }
        @Override public void onRmsChanged(float rmsdB) { }
        @Override public void onBufferReceived(byte[] buffer) { }
        @Override public void onEndOfSpeech() { }
        @Override public void onEvent(int eventType, Bundle params) { }

        @Override
        public void onPartialResults(Bundle b) {
            String t = teksDari(b);
            if (t.isEmpty()) return;
            JSObject d = new JSObject();
            d.put("teks", t);
            notifyListeners("sebagian", d);
        }

        @Override
        public void onResults(Bundle b) {
            JSObject d = new JSObject();
            d.put("teks", teksDari(b));
            notifyListeners("hasil", d);
            hancurkan();
        }

        @Override
        public void onError(int e) {
            String kode;
            switch (e) {
                case SpeechRecognizer.ERROR_NO_MATCH:
                case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: kode = "sunyi"; break;
                case SpeechRecognizer.ERROR_NETWORK:
                case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                case SpeechRecognizer.ERROR_SERVER: kode = "jaringan"; break;
                case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: kode = "izin"; break;
                case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: kode = "sibuk"; break;
                case SpeechRecognizer.ERROR_AUDIO: kode = "audio-capture"; break;
                case SpeechRecognizer.ERROR_CLIENT: kode = "aborted"; break;
                default: kode = "umum";
            }
            kirimGalat(kode);
            hancurkan();
        }
    }
}
