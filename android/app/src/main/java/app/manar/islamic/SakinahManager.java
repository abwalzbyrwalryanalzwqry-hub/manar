package app.manar.islamic;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import androidx.core.app.NotificationCompat;

/**
 * منار — تطبيق الوضع الهادئ ورفعه.
 *
 * <p>الآلة الرسمية الوحيدة التي تُسكت الهاتف لتطبيقٍ خارجيّ هي
 * {@link NotificationManager#setInterruptionFilter(int)} بعد أن يمنح المستخدم
 * «الوصول إلى عدم الإزعاج». ولا نتلاعب بمستويات الصوت: لو أنزلنا الصوت إلى صفر
 * ثم أعدناه، لأفسدنا إعداد المستخدم كلّما تعارض توقيتٌ أو قُتل التطبيق. فنستخدم
 * ما تضمنه المنصّة، ونُعيد ما كان عليه الهاتف بعد الفترة — لا ما نفترضه.
 *
 * <p>والاستعادة مشروطة: إن كان المستخدم قد غيّر النمط بنفسه أثناء الفترة، فلا
 * نلمس اختياره.
 */
public final class SakinahManager {

    static final int NOTIFICATION_ID = 40991;

    private SakinahManager() {}

    /** هل مُنح منار الوصول إلى «عدم الإزعاج»؟ بدونه لا يمكن تشغيل الميزة. */
    public static boolean hasPolicyAccess(Context context) {
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return false;
        try {
            return nm.isNotificationPolicyAccessGranted();
        } catch (Exception e) {
            return false;
        }
    }

    public static int currentFilter(Context context) {
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return NotificationManager.INTERRUPTION_FILTER_UNKNOWN;
        try {
            return nm.getCurrentInterruptionFilter();
        } catch (Exception e) {
            return NotificationManager.INTERRUPTION_FILTER_UNKNOWN;
        }
    }

    static int filterFor(String mode) {
        if ("none".equals(mode)) return NotificationManager.INTERRUPTION_FILTER_NONE;
        if ("alarms".equals(mode)) return NotificationManager.INTERRUPTION_FILTER_ALARMS;
        return NotificationManager.INTERRUPTION_FILTER_PRIORITY;
    }

    /**
     * يبدأ الهدوء لفترة بعينها.
     *
     * @return صحيحٌ إن تحقّق الهدوء فعلاً؛ وخطأٌ إن منعه النظام — وحينها لا
     *         نُظهر للمستخدم أن الميزة عملت، بل نُسجّل السبب.
     */
    public static boolean start(Context context, SakinahStore.Window window) {
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) {
            SakinahLog.add(context, SakinahLog.QUIET_FAILED, window.prayer, "no_notification_manager");
            return false;
        }
        if (!hasPolicyAccess(context)) {
            SakinahLog.add(context, SakinahLog.PERMISSION_MISSING, window.prayer, "dnd_access");
            notifyFailure(context, window);
            return false;
        }

        int previous = currentFilter(context);
        int target = filterFor(window.filter);
        try {
            nm.setInterruptionFilter(target);
        } catch (Exception e) {
            SakinahLog.add(context, SakinahLog.QUIET_FAILED, window.prayer, "set_filter_rejected");
            notifyFailure(context, window);
            return false;
        }

        SakinahStore.rememberPrevious(context, previous, target);
        SakinahStore.setActiveWindow(context, window.id);
        SakinahLog.add(context, SakinahLog.QUIET_STARTED, window.prayer,
                "filter=" + window.filter + ";until=" + window.endMillis);
        showOngoing(context, window);
        return true;
    }

    /** ينهي الفترة الجارية ويُعيد حالة الهاتف السابقة. */
    public static void end(Context context, String reason) {
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        int active = SakinahStore.activeWindow(context);
        SakinahStore.Window window = active >= 0 ? SakinahStore.windowById(context, active) : null;

        if (nm != null && hasPolicyAccess(context)) {
            int applied = SakinahStore.appliedFilter(context);
            int previous = SakinahStore.previousFilter(context);
            int now = currentFilter(context);
            // إن كان المستخدم قد غيّر النمط بنفسه أثناء الفترة فاختياره أحقّ
            if (applied < 0 || now == applied) {
                int restoreTo = previous >= 0 && previous != NotificationManager.INTERRUPTION_FILTER_UNKNOWN
                        ? previous
                        : NotificationManager.INTERRUPTION_FILTER_ALL;
                try {
                    nm.setInterruptionFilter(restoreTo);
                    SakinahLog.add(context, SakinahLog.STATE_RESTORED,
                            window != null ? window.prayer : "", "filter=" + restoreTo);
                } catch (Exception ignored) {
                    SakinahLog.add(context, SakinahLog.QUIET_FAILED,
                            window != null ? window.prayer : "", "restore_rejected");
                }
            } else {
                SakinahLog.add(context, SakinahLog.STATE_RESTORED,
                        window != null ? window.prayer : "", "user_changed_filter");
            }
        }

        SakinahStore.forgetPrevious(context);
        SakinahStore.clearActiveWindow(context);
        clearOngoing(context);
        SakinahLog.add(context,
                "user".equals(reason) ? SakinahLog.QUIET_STOPPED : SakinahLog.QUIET_ENDED,
                window != null ? window.prayer : "", reason == null ? "" : reason);
    }

    /** «إيقاف الآن»: يُنهي الفترة الجارية وحدها ولا يُعطّل الميزة. */
    public static void stopNow(Context context) {
        int active = SakinahStore.activeWindow(context);
        if (active >= 0) {
            SakinahStore.skip(context, active);
            SakinahScheduler.cancelWindow(context, active);
        }
        end(context, "user");
    }

    /** «تخطّي هذه الفترة»: قبل أن تبدأ. */
    public static void skip(Context context, int id) {
        SakinahStore.skip(context, id);
        SakinahScheduler.cancelWindow(context, id);
        SakinahStore.Window w = SakinahStore.windowById(context, id);
        SakinahLog.add(context, SakinahLog.QUIET_SKIPPED, w != null ? w.prayer : "", "id=" + id);
        if (SakinahStore.activeWindow(context) == id) end(context, "skipped");
    }

    /* --------------------------- الإشعارات --------------------------- */

    private static void showOngoing(Context context, SakinahStore.Window window) {
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;
        ManarChannels.ensure(context);

        PendingIntent open = PendingIntent.getActivity(
                context,
                60,
                new Intent(context, MainActivity.class)
                        .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        PendingIntent stop = PendingIntent.getBroadcast(
                context,
                61,
                new Intent(context, SakinahReceiver.class)
                        .setAction(SakinahReceiver.ACTION_STOP_NOW)
                        .setData(Uri.parse("manar://sakinah/stop")),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification n = new NotificationCompat.Builder(context, ManarChannels.SAKINAH)
                .setSmallIcon(R.drawable.ic_stat_manar)
                .setColor(0xFFC9A227)
                .setContentTitle("سكينة — الهدوء فعّال")
                .setContentText(window.label + " · ينتهي " + Clock.hhmm(window.endMillis))
                .setContentIntent(open)
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setOngoing(true)
                .addAction(R.drawable.ic_stat_manar, "إيقاف الآن", stop)
                .build();
        try {
            nm.notify(NOTIFICATION_ID, n);
        } catch (SecurityException ignored) {
            // إذن الإشعارات مسحوب — الهدوء نفسه يعمل، والإشعار زينةٌ عليه
        }
    }

    static void clearOngoing(Context context) {
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm != null) nm.cancel(NOTIFICATION_ID);
    }

    /** رسالة الفشل كما طلبها صاحب التطبيق: بلا لغةٍ تقنية وبلا انهيار. */
    private static void notifyFailure(Context context, SakinahStore.Window window) {
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;
        ManarChannels.ensure(context);

        PendingIntent open = PendingIntent.getActivity(
                context,
                62,
                new Intent(context, MainActivity.class)
                        .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification n = new NotificationCompat.Builder(context, ManarChannels.SAKINAH)
                .setSmallIcon(R.drawable.ic_stat_manar)
                .setColor(0xFFC9A227)
                .setContentTitle("لم يتمكن منار من تفعيل الوضع الهادئ هذه المرة")
                .setContentText("السبب: لم يُسمح لمنار بالتحكم في وضع عدم الإزعاج — اضغط للإصلاح")
                .setStyle(new NotificationCompat.BigTextStyle().bigText(
                        "فترة " + window.label + " لم تبدأ. السبب: لم يُسمح لمنار بالتحكم في وضع"
                                + " عدم الإزعاج. اضغط هنا لفتح سكينة ومنح الإذن."))
                .setContentIntent(open)
                .setAutoCancel(true)
                .setSilent(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .build();
        try {
            nm.notify(NOTIFICATION_ID + 1, n);
        } catch (SecurityException ignored) {
            // لا شيء أكثر يمكن فعله
        }
    }

    /** يفتح شاشة النظام التي يُمنح فيها الوصول إلى «عدم الإزعاج». */
    public static boolean openPolicyAccessSettings(Context context) {
        try {
            context.startActivity(new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            return true;
        } catch (Exception e) {
            try {
                context.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                        .setData(Uri.parse("package:" + context.getPackageName()))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                return true;
            } catch (Exception ignored) {
                return false;
            }
        }
    }

    /** أداةٌ صغيرة للوقت داخل نصوص الإشعارات. */
    static final class Clock {
        private Clock() {}

        static String hhmm(long millis) {
            java.util.Calendar c = java.util.Calendar.getInstance();
            c.setTimeInMillis(millis);
            return String.format(
                    java.util.Locale.US,
                    "%02d:%02d",
                    c.get(java.util.Calendar.HOUR_OF_DAY),
                    c.get(java.util.Calendar.MINUTE));
        }
    }
}
