package app.manar.islamic;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import java.util.ArrayList;
import java.util.List;

/**
 * منار — تسليح فترات «سكينة» بمنبّهات النظام.
 *
 * <p>لكل فترة منبّهان دقيقان: واحدٌ لبدايتها وآخر لنهايتها، كلاهما
 * {@code setExactAndAllowWhileIdle} فيمرّان من Doze. ولا حلقة ولا مؤقّت في
 * الويب ولا خدمةٌ تنتظر: الويب لا يعمل إلا وهو مفتوح، والمطلوب أن يعمل الهدوء
 * والتطبيق مغلقٌ والشاشة مطفأة.
 *
 * <p>الفترات محفوظة في {@link SakinahStore}، فتُعاد تسليحها بعد الإقلاع أو
 * تحديث التطبيق أو تغيّر المنطقة الزمنية من {@link BootReceiver} دون أن يفتح
 * المستخدم التطبيق.
 */
public final class SakinahScheduler {

    /** مدى أرقام الطلبات المخصّص لسكينة — بعيدٌ عن مدى الأذان (٤١٠٠٠). */
    private static final int REQUEST_START = 43000;
    private static final int REQUEST_END = 44000;

    private SakinahScheduler() {}

    /** يستبدل الجدول كلّه: يُلغي ما سلّحناه سابقاً ثم يُسلّح الجديد. */
    public static int replaceAll(Context context, List<SakinahStore.Window> windows) {
        cancelAll(context);

        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        long now = System.currentTimeMillis();
        List<SakinahStore.Window> kept = new ArrayList<>();

        for (SakinahStore.Window w : windows) {
            if (w.endMillis <= now) continue; // فترة انتهت
            kept.add(w);
        }
        SakinahStore.saveWindows(context, kept);

        // الفترة الجارية بعد تعديل الإعداد: إن حُذفت أو صارت بدايتها لاحقة
        // (كأن اختار المستخدم «بعد الأذان») أو تُخطّيت — يُرفع الهدوء الآن، وإلا
        // بقي الهاتف صامتاً بلا منبّه نهاية (أُلغي مع الجدول القديم). وإن تغيّر
        // نمط الصوت أثناءها يُطبَّق الجديد فوراً.
        int active = SakinahStore.activeWindow(context);
        if (active >= 0) {
            SakinahStore.Window current = null;
            for (SakinahStore.Window w : kept) {
                if (w.id == active) current = w;
            }
            if (current == null || SakinahStore.isSkipped(context, active)
                    || current.startMillis > now || current.endMillis <= now) {
                SakinahManager.end(context, "rescheduled");
            } else if (!current.filter.equals(SakinahStore.appliedMode(context))) {
                SakinahManager.start(context, current);
            } else {
                SakinahManager.refreshIfActive(context);
            }
        }

        if (am == null) return 0;

        int armed = 0;
        for (SakinahStore.Window w : kept) {
            if (SakinahStore.isSkipped(context, w.id)) continue;
            if (w.startMillis > now) {
                if (arm(am, context, w, true)) armed++;
            } else if (SakinahStore.activeWindow(context) != w.id) {
                // فترةٌ بدأت بينما كان الجهاز مطفأً أو التطبيق مقتولاً:
                // نُدخل الهدوء الآن بدل أن نتظاهر بأنها ستبدأ.
                SakinahManager.start(context, w);
            }
            if (w.endMillis > now) {
                if (arm(am, context, w, false)) armed++;
            }
        }

        SakinahLog.add(context, SakinahLog.SCHEDULE_UPDATED, "",
                "windows=" + kept.size() + ";alarms=" + armed);
        return armed;
    }

    private static boolean arm(
            AlarmManager am, Context context, SakinahStore.Window w, boolean isStart) {
        PendingIntent pi = pendingIntentFor(context, w.id, isStart, PendingIntent.FLAG_UPDATE_CURRENT);
        if (pi == null) return false;
        long at = isStart ? w.startMillis : w.endMillis;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            }
            return true;
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            return true;
        }
    }

    public static void cancelAll(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        for (SakinahStore.Window w : SakinahStore.windows(context)) {
            cancelOne(am, context, w.id, true);
            cancelOne(am, context, w.id, false);
        }
    }

    /** يُلغي منبّهي فترةٍ واحدة — للتخطّي أو للإيقاف الآن. */
    public static void cancelWindow(Context context, int id) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        cancelOne(am, context, id, true);
        cancelOne(am, context, id, false);
    }

    private static void cancelOne(AlarmManager am, Context context, int id, boolean isStart) {
        PendingIntent pi = pendingIntentFor(context, id, isStart, PendingIntent.FLAG_NO_CREATE);
        if (pi != null) {
            am.cancel(pi);
            pi.cancel();
        }
    }

    /** يُعاد التسليح بعد الإقلاع أو التحديث أو تغيّر الوقت. */
    public static int rearm(Context context) {
        List<SakinahStore.Window> stored = SakinahStore.windows(context);
        if (stored.isEmpty() || !SakinahStore.isEnabled(context)) return 0;
        return replaceAll(context, stored);
    }

    public static int pendingCount(Context context) {
        long now = System.currentTimeMillis();
        int n = 0;
        for (SakinahStore.Window w : SakinahStore.windows(context)) {
            if (w.startMillis > now && !SakinahStore.isSkipped(context, w.id)) n++;
        }
        return n;
    }

    private static PendingIntent pendingIntentFor(
            Context context, int id, boolean isStart, int extraFlags) {
        Intent intent = new Intent(context, SakinahReceiver.class)
                .setAction(isStart ? SakinahReceiver.ACTION_START : SakinahReceiver.ACTION_END)
                // عنوان بيانات مميّز لكل منبّه: أندرويد يتجاهل الإضافات وحدها
                // في المقارنة، فلولا العنوان لتداخلت الطلبات.
                .setData(Uri.parse("manar://sakinah/" + (isStart ? "start/" : "end/") + id))
                .putExtra(SakinahReceiver.EXTRA_ID, id);

        return PendingIntent.getBroadcast(
                context,
                (isStart ? REQUEST_START : REQUEST_END) + id,
                intent,
                extraFlags | PendingIntent.FLAG_IMMUTABLE);
    }
}
