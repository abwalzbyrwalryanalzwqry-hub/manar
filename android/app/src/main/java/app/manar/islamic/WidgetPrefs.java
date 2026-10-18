package app.manar.islamic;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

/**
 * حالة الويدجتات المحلية التي لا تأتي من اللقطة: موضع «الذكر التالي» لكل
 * نسخة، وضغطات المسبحة بانتظار التطبيق.
 */
final class WidgetPrefs {

    private WidgetPrefs() {}

    private static final String PREFS = "manar_widget_state";
    private static final String KEY_TAPS = "tasbih_taps";

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void forget(Context c, int[] ids) {
        SharedPreferences.Editor e = prefs(c).edit();
        for (int id : ids) e.remove("zikr_" + id).remove("zikr_slot_" + id).remove("shown_" + id);
        e.apply();
    }

    /** رُسمت النسخة مرة على الأقل (فليست إضافة جديدة). */
    static boolean wasShown(Context c, int id) {
        return prefs(c).getBoolean("shown_" + id, false);
    }

    static void markShown(Context c, int id) {
        SharedPreferences p = prefs(c);
        if (!p.getBoolean("shown_" + id, false)) p.edit().putBoolean("shown_" + id, true).apply();
    }

    /** موضع الذكر في النسخة لهذا الوقت ({@code slot} = اليوم+الصباح/المساء). */
    static int zikrIndex(Context c, int id, String slot) {
        SharedPreferences p = prefs(c);
        if (!slot.equals(p.getString("zikr_slot_" + id, ""))) return 0;
        return p.getInt("zikr_" + id, 0);
    }

    static void setZikrIndex(Context c, int id, String slot, int index) {
        prefs(c).edit().putString("zikr_slot_" + id, slot).putInt("zikr_" + id, index).apply();
    }

    /** ضغطات المسبحة المعلّقة لجلسة. */
    static synchronized int taps(Context c, String session) {
        try {
            return new JSONObject(prefs(c).getString(KEY_TAPS, "{}")).optInt(session, 0);
        } catch (Exception e) {
            return 0;
        }
    }

    static synchronized void addTap(Context c, String session) {
        try {
            JSONObject o = new JSONObject(prefs(c).getString(KEY_TAPS, "{}"));
            o.put(session, o.optInt(session, 0) + 1);
            prefs(c).edit().putString(KEY_TAPS, o.toString()).apply();
        } catch (Exception ignored) {
            // ضغطة ضائعة أهون من انهيار.
        }
    }

    /** يُفرغ الضغطات ويعيدها (التطبيق يضيفها إلى الجلسة). الكتابة متزامنة عمداً
     *  كي لا تُحتسب ضغطة مرتين إن قُتلت العملية قبل الحفظ. */
    @android.annotation.SuppressLint("ApplySharedPref")
    static synchronized String takeTaps(Context c) {
        String v = prefs(c).getString(KEY_TAPS, "{}");
        prefs(c).edit().remove(KEY_TAPS).commit();
        return v;
    }
}
