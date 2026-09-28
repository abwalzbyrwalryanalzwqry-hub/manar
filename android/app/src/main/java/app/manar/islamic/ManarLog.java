package app.manar.islamic;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * منار — سجل التنبيهات (على نمط {@link SakinahLog}).
 *
 * <p>حلقةٌ محليّة من ٢٠٠ مدخلة: متى ضُبط الجدول، ومتى أُطلق كل حدث وكم تأخّر،
 * ولماذا صمت الأذان، ومتى رُفض إشعار. لا شبكة ولا خادم؛ يعرضه «مركز التنبيهات»
 * بجملٍ عربية ويُنسخ للشكوى.
 */
public final class ManarLog {

    private static final String PREFS = "manar_alert_log";
    private static final String KEY = "log";
    private static final int LIMIT = 200;

    public static final String SCHEDULED = "scheduled";
    public static final String FIRED = "fired";
    public static final String DUPLICATE = "duplicate";
    public static final String SILENCED = "silenced";
    public static final String PLAYBACK_FAILED = "playback_failed";
    public static final String NOTICE_DROPPED = "notice_dropped";
    public static final String PRAYED = "prayed";
    public static final String SNOOZED = "snoozed";
    public static final String REARMED = "rearmed";
    public static final String ZONE_CHANGED = "zone_changed";
    public static final String TEST_SCHEDULED = "test_scheduled";

    private ManarLog() {}

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static synchronized void add(Context context, String type, String key, String detail) {
        try {
            JSONArray array = read(context);
            JSONArray next = new JSONArray();
            int skip = Math.max(0, array.length() + 1 - LIMIT);
            for (int i = skip; i < array.length(); i++) next.put(array.get(i));
            next.put(new JSONObject()
                    .put("at", System.currentTimeMillis())
                    .put("type", type)
                    .put("key", key == null ? "" : key)
                    .put("detail", detail == null ? "" : detail));
            prefs(context).edit().putString(KEY, next.toString()).apply();
        } catch (Exception ignored) {
            // السجل للتشخيص؛ فشلُه لا يُسقط التنبيه
        }
    }

    public static synchronized JSONArray read(Context context) {
        String raw = prefs(context).getString(KEY, null);
        if (raw == null) return new JSONArray();
        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    public static synchronized void clear(Context context) {
        prefs(context).edit().remove(KEY).apply();
    }
}
