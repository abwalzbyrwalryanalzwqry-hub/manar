package app.manar.islamic;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registered before super.onCreate so the bridge exposes it on the very
        // first JS tick — the web layer calls ManarAdhan during start-up.
        registerPlugin(ManarAdhanPlugin.class);
        super.onCreate(savedInstanceState);

        // Channels must exist before any notification is posted, including ones
        // posted by a broadcast receiver while the app is closed.
        ManarChannels.ensure(this);

        // يحوّل صفحة خطأ WebView الإنجليزية الفارغة إلى لوحة عربية تحمل رمز
        // الخطأ والعنوان، ويُسجّل السبب في logcat بوسم ManarBoot.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setWebViewClient(new ManarWebViewDiagnostics(getBridge(), this));
        }
    }
}
