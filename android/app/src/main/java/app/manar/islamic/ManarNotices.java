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
            Context context, int eventId, String channelKind, String title, String body,
            NoticeMeta meta) {
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
                fix, "إصلاح", meta);
    }

    public static void post(
            Context context,
            int eventId,
            String channelKind,
            String title,
            String body,
            String subText,
            boolean silent) {
        postInternal(context, eventId, channelKind, title, body, subText, silent, null, null,
                NoticeMeta.NONE);
    }

    public static void post(
            Context context,
            int eventId,
            String channelKind,
            String title,
            String body,
            String subText,
            boolean silent,
            NoticeMeta meta) {
        postInternal(context, eventId, channelKind, title, body, subText, silent, null, null, meta);
    }

    /** معرّف إشعار الحدث — لإزالته من زرّ «صلّيت» أو «ذكّرني لاحقاً». */
    static int notificationId(int eventId) {
        return ID_BASE + Math.max(0, eventId);
    }

    /** نيّة فتح التطبيق على مسار (افتراضياً شاشة الصلاة لتنبيهات الصلاة). */
    static PendingIntent openIntent(Context context, int requestCode, String route) {
        Intent open = new Intent(context, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        String safe = NoticeMeta.safeRoute(route);
        if (!safe.isEmpty()) {
            open.putExtra(MainActivity.EXTRA_ROUTE, safe);
            // بيانات مميّزة لكل مسار: الإضافات وحدها لا تميّز النيّات عند المقارنة.
            open.setData(android.net.Uri.parse("manar://open" + safe));
        }
        return PendingIntent.getActivity(context, requestCode, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
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
            String actionLabel,
            NoticeMeta meta) {
        if (meta == null) meta = NoticeMeta.NONE;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;
        ManarChannels.ensure(context);
        if (!nm.areNotificationsEnabled()) {
            Log.w("ManarSchedule", "notifications disabled — notice dropped: " + title);
            ManarLog.add(context, ManarLog.NOTICE_DROPPED, String.valueOf(eventId), "disabled");
            return;
        }

        String channel = ManarChannels.notice(context, channelKind);
        int id = notificationId(eventId);
        boolean prayerChannel = !(channelKind != null && channelKind.startsWith("manar_"));
        String route = !meta.route.isEmpty() ? meta.route : (prayerChannel ? "/prayer" : "");
        PendingIntent openPi = openIntent(context, id, route);

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
        // «صلّيت» يسجّل الصلاة دون فتح التطبيق.
        if (meta.canMarkPrayed()) {
            Intent prayed = new Intent(context, ManarActionReceiver.class)
                    .setAction(ManarActionReceiver.ACTION_PRAYED)
                    .setData(android.net.Uri.parse("manar://prayed/" + id))
                    .putExtra(ManarActionReceiver.EXTRA_NOTIFICATION_ID, id)
                    .putExtra(ManarActionReceiver.EXTRA_PRAYER, meta.prayer)
                    .putExtra(ManarActionReceiver.EXTRA_DAY, meta.prayedDay);
            b.addAction(0, "صلّيت", PendingIntent.getBroadcast(context, id, prayed,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
        // «ذكّرني لاحقاً» بمستقبِلٍ أصلي — لا يفتح التطبيق.
        if (meta.snooze > 0) {
            Intent snooze = new Intent(context, ManarActionReceiver.class)
                    .setAction(ManarActionReceiver.ACTION_SNOOZE)
                    .setData(android.net.Uri.parse("manar://snooze-action/" + id))
                    .putExtra(ManarActionReceiver.EXTRA_NOTIFICATION_ID, id)
                    .putExtra(AdhanScheduler.EXTRA_EVENT_ID, eventId)
                    .putExtra(AdhanService.EXTRA_TITLE, title)
                    .putExtra(AdhanService.EXTRA_BODY, body)
                    .putExtra(AdhanService.EXTRA_CHANNEL, channelKind)
                    .putExtra(ManarActionReceiver.EXTRA_META, meta.toJson());
            b.addAction(0, "ذكّرني بعد " + ManarText.minutesGen(meta.snooze),
                    PendingIntent.getBroadcast(context, id, snooze,
                            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
        // تنبيهات الصلاة الواحدة (الأذان، الإقامة، دخول الوقت) في مجموعة واحدة.
        if (!meta.prayer.isEmpty()) b.setGroup("manar_prayer_" + meta.prayer);
        Notification n = b.build();
        try {
            nm.notify(id, n);
        } catch (SecurityException e) {
            Log.w("ManarSchedule", "notification permission revoked", e);
        }
    }
}
