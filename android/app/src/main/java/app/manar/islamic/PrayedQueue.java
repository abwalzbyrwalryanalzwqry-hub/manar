package app.manar.islamic;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * طابور «صلّيت» من الإشعار والتطبيق مغلق. سجل النشاط ملك الويب (localStorage)،
 * فيُكتب هنا صغيراً، ويدمجه الويب في `activity-log` عند الفتح ثم يفرّغه.
 */
final class PrayedQueue {

    private static final String PREFS = "manar_prayed";
    private static final String KEY = "queue";
    private static final int MAX = 60;

    private PrayedQueue() {}

    static synchronized void add(Context context, String prayer, String day) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray a = new JSONArray(p.getString(KEY, "[]"));
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.optJSONObject(i);
                if (o != null && prayer.equals(o.optString("prayer")) && day.equals(o.optString("day"))) {
                    return;
                }
            }
            a.put(new JSONObject().put("prayer", prayer).put("day", day)
                    .put("at", System.currentTimeMillis()));
            JSONArray trimmed = new JSONArray();
            for (int i = Math.max(0, a.length() - MAX); i < a.length(); i++) trimmed.put(a.get(i));
            p.edit().putString(KEY, trimmed.toString()).apply();
        } catch (Exception ignored) {
            // طابورٌ تالف لا يمنع شيئاً: يُستبدل في الإضافة التالية
            p.edit().remove(KEY).apply();
        }
    }

    /** صلوات يوم بعينه في الطابور (دون تفريغه) — ليعرضها الويدجت فوراً. */
    static synchronized java.util.Set<String> peek(Context context, String day) {
        java.util.Set<String> out = new java.util.HashSet<>();
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray a = new JSONArray(p.getString(KEY, "[]"));
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.optJSONObject(i);
                if (o != null && day.equals(o.optString("day"))) out.add(o.optString("prayer"));
            }
        } catch (Exception ignored) {
            // طابور تالف: لا شيء معلّق.
        }
        return out;
    }

    /** يعيد الطابور ويفرّغه. */
    static synchronized JSONArray take(Context context) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONArray a;
        try {
            a = new JSONArray(p.getString(KEY, "[]"));
        } catch (Exception e) {
            a = new JSONArray();
        }
        p.edit().remove(KEY).apply();
        return a;
    }
}
