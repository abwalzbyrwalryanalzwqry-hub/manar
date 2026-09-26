package app.manar.islamic;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * منار — مخزن «سكينة» على القرص.
 *
 * <p>تُحسب فترات الهدوء في طبقة الويب من مواقيت الصلاة نفسها (بلا أوقات ساعة
 * ثابتة)، ثم تُسلَّم إلى هنا لتُخزَّن كما هي. التخزين شرطٌ لا زينة: بعد إعادة
 * التشغيل أو تحديث التطبيق تُفقد كل المنبّهات، ويجب أن يُعاد تسليحها من غير أن
 * يفتح المستخدم التطبيق ومن غير أن تكون شاشة الويب حيّة.
 *
 * <p>ويحفظ المخزن كذلك ما كان عليه الهاتف قبل الهدوء ({@code previousFilter})
 * حتى تُعاد حالته هو لا حالةٌ نفترضها نحن.
 */
public final class SakinahStore {

    private static final String PREFS = "manar_sakinah";

    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_WINDOWS = "windows";
    private static final String KEY_SKIPPED = "skipped";
    private static final String KEY_ACTIVE = "activeWindow";
    private static final String KEY_PREV_FILTER = "previousFilter";
    private static final String KEY_APPLIED_FILTER = "appliedFilter";
    /* «أصوات منار فقط»: سياسة عدم الإزعاج قبل الفترة، والقنوات التي فتحناها. */
    private static final String KEY_PREV_POLICY = "previousPolicy";
    private static final String KEY_APPLIED_MODE = "appliedMode";
    private static final String KEY_BYPASS_CHANNELS = "bypassChannels";
    private static final String KEY_AUDIO_HOLD = "audioHold";

    private SakinahStore() {}

    /** فترة هدوء واحدة: من وقتٍ مشتقٍّ من صلاة إلى وقتٍ مشتقٍّ منها. */
    public static final class Window {
        public final int id;
        public final long startMillis;
        public final long endMillis;
        /** مفتاح الصلاة (fajr…isha) أو "jumuah" لصلاة الجمعة. */
        public final String prayer;
        /** الاسم كما يُعرض للمستخدم، بالعربية. */
        public final String label;
        /** نمط المنع: priority / alarms / none. */
        public final String filter;
        /** هل يُكتم أذان منار نفسه داخل الفترة؟ */
        public final boolean muteAdhan;

        Window(int id, long startMillis, long endMillis, String prayer, String label,
               String filter, boolean muteAdhan) {
            this.id = id;
            this.startMillis = startMillis;
            this.endMillis = endMillis;
            this.prayer = prayer;
            this.label = label;
            this.filter = filter;
            this.muteAdhan = muteAdhan;
        }

        static Window fromJson(JSONObject o) {
            return new Window(
                    o.optInt("id"),
                    o.optLong("start"),
                    o.optLong("end"),
                    o.optString("prayer", ""),
                    o.optString("label", "سكينة"),
                    o.optString("filter", "priority"),
                    o.optBoolean("muteAdhan", false));
        }

        JSONObject toJson() throws JSONException {
            return new JSONObject()
                    .put("id", id)
                    .put("start", startMillis)
                    .put("end", endMillis)
                    .put("prayer", prayer)
                    .put("label", label)
                    .put("filter", filter)
                    .put("muteAdhan", muteAdhan);
        }
    }

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static boolean isEnabled(Context context) {
        return prefs(context).getBoolean(KEY_ENABLED, false);
    }

    public static void setEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply();
    }

    public static List<Window> parse(JSONArray array) {
        List<Window> out = new ArrayList<>();
        if (array == null) return out;
        for (int i = 0; i < array.length(); i++) {
            JSONObject o = array.optJSONObject(i);
            if (o != null) out.add(Window.fromJson(o));
        }
        return out;
    }

    public static void saveWindows(Context context, List<Window> windows) {
        JSONArray array = new JSONArray();
        for (Window w : windows) {
            try {
                array.put(w.toJson());
            } catch (JSONException ignored) {
                // نُسقط المدخلة الواحدة المعطوبة ولا نُسقط الجدول كلّه
            }
        }
        prefs(context).edit().putString(KEY_WINDOWS, array.toString()).apply();
    }

    public static List<Window> windows(Context context) {
        String raw = prefs(context).getString(KEY_WINDOWS, null);
        if (raw == null) return new ArrayList<>();
        try {
            return parse(new JSONArray(raw));
        } catch (JSONException e) {
            return new ArrayList<>();
        }
    }

    public static Window windowById(Context context, int id) {
        for (Window w : windows(context)) if (w.id == id) return w;
        return null;
    }

    /** الفترة التي يقع «الآن» داخلها، مع تجاهل ما تخطّاه المستخدم. */
    public static Window currentWindow(Context context) {
        long now = System.currentTimeMillis();
        for (Window w : windows(context)) {
            if (now >= w.startMillis && now < w.endMillis && !isSkipped(context, w.id)) return w;
        }
        return null;
    }

    public static Window nextWindow(Context context) {
        long now = System.currentTimeMillis();
        Window best = null;
        for (Window w : windows(context)) {
            if (w.startMillis <= now || isSkipped(context, w.id)) continue;
            if (best == null || w.startMillis < best.startMillis) best = w;
        }
        return best;
    }

    /* ----------------------- التخطّي ----------------------- */

    public static void skip(Context context, int id) {
        List<Integer> ids = skipped(context);
        if (!ids.contains(id)) ids.add(id);
        StringBuilder sb = new StringBuilder();
        for (int i : ids) sb.append(i).append(',');
        prefs(context).edit().putString(KEY_SKIPPED, sb.toString()).apply();
    }

    public static boolean isSkipped(Context context, int id) {
        return skipped(context).contains(id);
    }

    public static List<Integer> skipped(Context context) {
        List<Integer> out = new ArrayList<>();
        String raw = prefs(context).getString(KEY_SKIPPED, "");
        if (raw == null || raw.isEmpty()) return out;
        for (String part : raw.split(",")) {
            if (part.isEmpty()) continue;
            try {
                out.add(Integer.parseInt(part));
            } catch (NumberFormatException ignored) {
                // مدخلة قديمة معطوبة
            }
        }
        return out;
    }

    public static void clearSkipped(Context context) {
        prefs(context).edit().remove(KEY_SKIPPED).apply();
    }

    /* ------------------ الحالة السابقة للهاتف ------------------ */

    public static void rememberPrevious(Context context, int previousFilter, int appliedFilter) {
        prefs(context).edit()
                .putInt(KEY_PREV_FILTER, previousFilter)
                .putInt(KEY_APPLIED_FILTER, appliedFilter)
                .apply();
    }

    public static int previousFilter(Context context) {
        return prefs(context).getInt(KEY_PREV_FILTER, -1);
    }

    public static int appliedFilter(Context context) {
        return prefs(context).getInt(KEY_APPLIED_FILTER, -1);
    }

    public static void forgetPrevious(Context context) {
        prefs(context).edit().remove(KEY_PREV_FILTER).remove(KEY_APPLIED_FILTER).apply();
    }

    public static void setActiveWindow(Context context, int id) {
        prefs(context).edit().putInt(KEY_ACTIVE, id).apply();
    }

    public static int activeWindow(Context context) {
        return prefs(context).getInt(KEY_ACTIVE, -1);
    }

    public static void clearActiveWindow(Context context) {
        prefs(context).edit().remove(KEY_ACTIVE).apply();
    }

    /* ------------- «أصوات منار فقط»: السياسة والقنوات ------------- */

    /** السياسة السابقة كـ «فئات،متصلون،رسائل،تأثيرات،محادثات». */
    public static void rememberPolicy(Context context, String encoded) {
        prefs(context).edit().putString(KEY_PREV_POLICY, encoded).apply();
    }

    public static String previousPolicy(Context context) {
        return prefs(context).getString(KEY_PREV_POLICY, null);
    }

    public static void forgetPolicy(Context context) {
        prefs(context).edit().remove(KEY_PREV_POLICY).remove(KEY_AUDIO_HOLD).apply();
    }

    /** نمط الفترة المطبّق فعلاً ("manar" …) — ليُعاد تطبيقه إن تغيّر أثناءها. */
    public static void setAppliedMode(Context context, String mode) {
        prefs(context).edit().putString(KEY_APPLIED_MODE, mode).apply();
    }

    public static String appliedMode(Context context) {
        return prefs(context).getString(KEY_APPLIED_MODE, null);
    }

    public static void clearAppliedMode(Context context) {
        prefs(context).edit().remove(KEY_APPLIED_MODE).apply();
    }

    /** قنوات منار التي فعّلنا لها تجاوز عدم الإزعاج مؤقتاً (لإرجاعها كما كانت). */
    public static void setBypassChannels(Context context, java.util.Set<String> ids) {
        prefs(context).edit().putStringSet(KEY_BYPASS_CHANNELS, new java.util.HashSet<>(ids)).apply();
    }

    public static java.util.Set<String> bypassChannels(Context context) {
        java.util.Set<String> v = prefs(context).getStringSet(KEY_BYPASS_CHANNELS, null);
        return v == null ? new java.util.HashSet<>() : new java.util.HashSet<>(v);
    }

    public static void clearBypassChannels(Context context) {
        prefs(context).edit().remove(KEY_BYPASS_CHANNELS).apply();
    }

    public static void setAudioHold(Context context, boolean on) {
        prefs(context).edit().putBoolean(KEY_AUDIO_HOLD, on).apply();
    }

    public static boolean audioHold(Context context) {
        return prefs(context).getBoolean(KEY_AUDIO_HOLD, false);
    }
}
