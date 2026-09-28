package app.manar.islamic;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * Manar — إشعارات الصلاة النصّية (بلا صوت منار).
 *
 * <p>تُستعمل لثلاث حالات، وكلها لا تمسّ مشغّل الصوت إطلاقاً:
 * <ul>
 *   <li>إشعار دخول الوقت حين يكون الأذان معطّلاً (حدث {@code notice} على قناة الأذان).</li>
 *   <li>«اقتربت الإقامة» قبل موعدها بدقائق (حدث {@code notice} على قناة الإقامة).</li>
 *   <li>إشعار يبقى بعد انتهاء الأذان، أو بدلاً من الصوت إن تعذّر تشغيله — فلا تضيع
 *       الصلاة على المستخدم بسبب ملفٍّ أو إذنٍ ناقص.</li>
 * </ul>
 *
 * <p>القنوات نفسها ({@link ManarChannels#ADHAN} و{@link ManarChannels#IQAMA})
 * صامتة بطبيعتها: الصوت ملك {@link AdhanService} وحده، فلا يُسمَع صوتان معاً.
 */
public final class ManarNotices {

    /** مدى معرّفات إشعارات الأحداث — بعيدٌ عن معرّفات الخدمة والتذكيرات. */
    private static final int ID_BASE = 300000;

    private ManarNotices() {}

    /** طلب «إصلاح» في إشعار تعذّر التشغيل — بعيد عن طلب فتح التطبيق (4). */
    private static final int REQUEST_FIX = 5;

    /**
     * إشعار الصلاة حين منع النظام صوت الأذان: العنوان نفسه، وسطر يشرح السبب،
     * وزرّ «إصلاح» يفتح شاشة «المنبّهات والتذكيرات» لمنار.
     */
    public static void postPlaybackBlocked(
            Context context, int eventId, String channelKind, String title, String body) {
        String why = "لم يُشغَّل صوت "
                + ("iqama".equals(channelKind) ? "الإقامة" : "الأذان")
                + ": اسمح لمنار بالمنبّهات الدقيقة.";
        String text = body == null || body.isEmpty() ? why : body + "\n" + why;
        PendingIntent fix = PendingIntent.getActivity(
                context,
                REQUEST_FIX,
                ManarPermissions.exactAlarmSettingsIntent(context),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        postInternal(context, eventId, channelKind, title, text, "لم يُسمع الصوت", false,
                fix, "إصلاح");
    }

    public static void post(
            Context context,
            int eventId,
            String channelKind,
            String title,
            String body,
            String subText,
            boolean silent) {
        postInternal(context, eventId, channelKind, title, body, subText, silent, null, null);
    }

    private static void postInternal(
            Context context,
            int eventId,
            String channelKind,
            String title,
            String body,
            String subText,
            boolean silent,
            PendingIntent action,
            String actionLabel) {
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;
        ManarChannels.ensure(context);
        if (!nm.areNotificationsEnabled()) {
            Log.w("ManarSchedule", "notifications disabled — notice dropped: " + title);
            return;
        }

        String channel = ManarChannels.notice(context, channelKind);
        Intent open = new Intent(context, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(
                context, 4, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(context, channel)
                .setSmallIcon(R.drawable.ic_stat_manar)
                .setColor(0xFFC9A227)
                .setContentTitle(title == null ? "منار" : title)
                .setContentText(body == null ? "" : body)
                .setContentIntent(openPi)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setSilent(silent)
                .setAutoCancel(true);
        if (subText != null && !subText.isEmpty()) b.setSubText(subText);
        if (body != null && body.contains("\n")) {
            b.setStyle(new NotificationCompat.BigTextStyle().bigText(body));
        }
        if (action != null && actionLabel != null) b.addAction(0, actionLabel, action);
        Notification n = b.build();
        try {
            nm.notify(ID_BASE + Math.max(0, eventId), n);
        } catch (SecurityException e) {
            Log.w("ManarSchedule", "notification permission revoked", e);
        }
    }
}
