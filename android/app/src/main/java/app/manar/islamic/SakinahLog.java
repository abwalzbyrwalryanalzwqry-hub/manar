package app.manar.islamic;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * منار — سجل «سكينة».
 *
 * <p>حلقةٌ محدودة (٢٠٠ مدخلة) في تفضيلات التطبيق. لا شبكة ولا خادم: السجل
 * محليّ بحتٌ، وهو الوسيلة الوحيدة لمعرفة سببٍ حقيقيّ لما جرى — هل بدأ الهدوء؟
 * هل سُحب الإذن؟ هل أُعيد تشغيل الهاتف في وسط الفترة؟ — بدلاً من التخمين.
 *
 * <p>الأنواع التقنية ({@code schedule_created} … ) للمطوّر، وطبقة الويب هي من
 * تُحوّلها إلى جُملٍ عربية تُعرض للمستخدم في «سجل سكينة».
 */
public final class SakinahLog {

    private static final String KEY = "log";
    private static final int LIMIT = 200;

    public static final String SCHEDULE_CREATED = "schedule_created";
    public static final String SCHEDULE_UPDATED = "schedule_updated";
    public static final String QUIET_STARTED = "quiet_started";
    public static final String QUIET_ENDED = "quiet_ended";
    public static final String QUIET_SKIPPED = "quiet_skipped";
    public static final String QUIET_STOPPED = "quiet_stopped_by_user";
    public static final String QUIET_FAILED = "quiet_failed";
    public static final String PERMISSION_MISSING = "permission_missing";
    public static final String PERMISSION_RESTORED = "permission_restored";
    public static final String DEVICE_RESTARTED = "device_restarted";
    public static final String TIMEZONE_CHANGED = "timezone_changed";
    public static final String PRAYER_TIME_UPDATED = "prayer_time_updated";
    public static final String STATE_RESTORED = "state_restored";
    public static final String ADHAN_MUTED = "adhan_muted_by_sakinah";
    public static final String MANAR_ONLY_APPLIED = "manar_only_applied";
    public static final String MANAR_AUDIO_ALLOWED = "manar_audio_allowed";

    private SakinahLog() {}

    public static void add(Context context, String type, String prayer, String detail) {
        try {
            JSONArray array = read(context);
            JSONArray next = new JSONArray();
            // نُبقي الأحدث ونُسقط الأقدم حين نتجاوز الحد
            int skip = Math.max(0, array.length() + 1 - LIMIT);
            for (int i = skip; i < array.length(); i++) next.put(array.get(i));
            next.put(new JSONObject()
                    .put("at", System.currentTimeMillis())
                    .put("type", type)
                    .put("prayer", prayer == null ? "" : prayer)
                    .put("detail", detail == null ? "" : detail));
            SakinahStore.prefs(context).edit().putString(KEY, next.toString()).apply();
        } catch (JSONException ignored) {
            // السجل مساعدٌ للتشخيص؛ فشلُه لا يجوز أن يُسقط الميزة
        }
    }

    public static JSONArray read(Context context) {
        String raw = SakinahStore.prefs(context).getString(KEY, null);
        if (raw == null) return new JSONArray();
        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    public static void clear(Context context) {
        SakinahStore.prefs(context).edit().remove(KEY).apply();
    }
}
