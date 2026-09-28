package app.manar.islamic;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** مسارٌ داخلي يفتحه النقر على إشعار (/prayer، /azkar …) — تسلّمه الإضافة للويب. */
    public static final String EXTRA_ROUTE = "manar_route";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registered before super.onCreate so the bridge exposes it on the very
        // first JS tick — the web layer calls ManarAdhan during start-up.
        registerPlugin(ManarAdhanPlugin.class);
        super.onCreate(savedInstanceState);

        // Channels must exist before any notification is posted, including ones
        // posted by a broadcast receiver while the app is closed.
        ManarChannels.ensure(this);
    }
}
