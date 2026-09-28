package app.manar.islamic;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

/**
 * Manar — حالة الأذونات التي تقرّر هل يُسمع الأذان والتطبيق مغلق، ونيّات
 * شاشات النظام التي تمنحها. مصدرٌ واحد للإضافة والمستقبِل والخدمة.
 *
 * <p>بدء خدمة الصوت من الخلفية (أندرويد ١٢+) لا يُجاز إلا بمنبّه دقيق، أو إن
 * كان التطبيق مستثنىً من تحسين البطارية. بدون أيّهما يصير الأذان إشعاراً مكتوباً.
 */
public final class ManarPermissions {

    /** سبب تعذّر التشغيل: لا منبّه دقيق ولا استثناء بطارية. */
    public static final String REASON_BACKGROUND_START = "background_start";
    /** سبب آخر (ملف، أو نظام رفض لسبب غير معروف). */
    public static final String REASON_OTHER = "other";

    private ManarPermissions() {}

    public static boolean exactAlarms(Context context) {
        return AdhanScheduler.canScheduleExact(context);
    }

    public static boolean batteryUnrestricted(Context context) {
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (pm == null) return false;
        return pm.isIgnoringBatteryOptimizations(context.getPackageName());
    }

    /** هل يُجيز النظام الآن بدء خدمة الصوت من منبّه؟ */
    public static boolean canStartPlaybackFromAlarm(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        return exactAlarms(context) || batteryUnrestricted(context);
    }

    /** شاشة «المنبّهات والتذكيرات» لمنار، أو معلومات التطبيق قبل أندرويد ١٢. */
    public static Intent exactAlarmSettingsIntent(Context context) {
        Uri pkg = Uri.parse("package:" + context.getPackageName());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkg)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        }
        return appSettingsIntent(context);
    }

    public static Intent appSettingsIntent(Context context) {
        return new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + context.getPackageName()))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    }
}
