package app.manar.islamic;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * مستويات صوت منار كما اختارها المستخدم في «مستوى الأصوات».
 *
 * <p>الأذان والإقامة يُشغَّلان من المنبّه والتطبيق مغلق، فلا تصل إليهما
 * إعدادات الويب لحظتها. الويب يحفظ المستويات هنا عند كل مزامنة، والخدمة
 * تقرؤها لحظة التشغيل. القيم نسب بين ٠ و١؛ الغياب يعني كامل الصوت كما
 * كان قبل هذه الميزة.
 */
public final class ManarVolumes {

    private static final String PREFS = "manar_volumes";

    private ManarVolumes() {}

    private static float clamp(double v) {
        if (Double.isNaN(v)) return 1f;
        return (float) Math.max(0d, Math.min(1d, v));
    }

    public static void save(Context context, double master, double adhan, double iqama, double reminder) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putFloat("master", clamp(master))
                .putFloat("adhan", clamp(adhan))
                .putFloat("iqama", clamp(iqama))
                .putFloat("reminder", clamp(reminder))
                .apply();
    }

    /** المستوى الفعلي لنوع التشغيل: العام × مستوى الفئة. */
    public static float forKind(Context context, String kind) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        float master = p.getFloat("master", 1f);
        if ("iqama".equals(kind)) return clamp(master * p.getFloat("iqama", 1f));
        if ("reminder".equals(kind)) return clamp(p.getFloat("reminder", 1f));
        return clamp(master * p.getFloat("adhan", 1f));
    }
}
