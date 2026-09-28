package app.manar.islamic;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

/**
 * أزرار إشعارات منار التي لا تفتح التطبيق:
 *
 * <ul>
 *   <li>«صلّيت»: يُسجَّل في {@link PrayedQueue} ويُزال الإشعار.</li>
 *   <li>«ذكّرني بعد ١٠ دقائق»: يُزال الإشعار ويُضبط منبّهٌ واحد يعيد نشره بنصّه
 *       وقناته — بلا فتح التطبيق (كان زرّ LocalNotifications يفتحه).</li>
 * </ul>
 */
public class ManarActionReceiver extends BroadcastReceiver {

    static final String ACTION_PRAYED = "app.manar.islamic.action.PRAYED";
    static final String ACTION_SNOOZE = "app.manar.islamic.action.SNOOZE";

    static final String EXTRA_NOTIFICATION_ID = "notification_id";
    static final String EXTRA_PRAYER = "prayer";
    static final String EXTRA_DAY = "day";
    static final String EXTRA_META = "meta";

    /** من يُبلَّغ فوراً إن كانت الواجهة حيّة. */
    interface PrayedListener {
        void onPrayed(String prayer, String day);
    }

    @androidx.annotation.Nullable static volatile PrayedListener prayedListener;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        int notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0);
        NotificationManager nm = context.getSystemService(NotificationManager.class);

        if (ACTION_PRAYED.equals(intent.getAction())) {
            String prayer = intent.getStringExtra(EXTRA_PRAYER);
            String day = intent.getStringExtra(EXTRA_DAY);
            if (prayer == null || day == null) return;
            PrayedQueue.add(context, prayer, day);
            ManarLog.add(context, ManarLog.PRAYED, prayer, day);
            Log.i("ManarSchedule", "prayed " + prayer + " " + day);
            if (nm != null && notificationId != 0) nm.cancel(notificationId);
            PrayedListener l = prayedListener;
            if (l != null) {
                try {
                    l.onPrayed(prayer, day);
                } catch (Exception ignored) {
                    // الواجهة في طريقها إلى الإغلاق — الطابور يكفي
                }
            }
            return;
        }

        if (ACTION_SNOOZE.equals(intent.getAction())) {
            if (nm != null && notificationId != 0) nm.cancel(notificationId);
            NoticeMeta meta = NoticeMeta.parse(intent.getStringExtra(EXTRA_META));
            int minutes = meta.snooze > 0 ? meta.snooze : 10;
            int eventId = intent.getIntExtra(AdhanScheduler.EXTRA_EVENT_ID, 0);
            long at = System.currentTimeMillis() + minutes * 60_000L;
            Intent fire = new Intent(context, AdhanAlarmReceiver.class)
                    .setAction(AdhanAlarmReceiver.ACTION_FIRE)
                    .setData(android.net.Uri.parse("manar://snooze/" + eventId))
                    .putExtra(AdhanService.EXTRA_KIND, AdhanScheduler.KIND_NOTICE)
                    .putExtra(AdhanService.EXTRA_KEY, "snooze_" + eventId + "_" + at)
                    .putExtra(AdhanService.EXTRA_TITLE, intent.getStringExtra(AdhanService.EXTRA_TITLE))
                    .putExtra(AdhanService.EXTRA_BODY, intent.getStringExtra(AdhanService.EXTRA_BODY))
                    .putExtra(AdhanService.EXTRA_CHANNEL, intent.getStringExtra(AdhanService.EXTRA_CHANNEL))
                    .putExtra(AdhanService.EXTRA_META, meta.toJson())
                    .putExtra(AdhanScheduler.EXTRA_AT, at)
                    .putExtra(AdhanScheduler.EXTRA_EVENT_ID, eventId);
            PendingIntent pi = PendingIntent.getBroadcast(context, 0, fire,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    if (AdhanScheduler.canScheduleExact(context)) {
                        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                    } else {
                        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                    }
                } else {
                    am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
                }
                Log.i("ManarSchedule", "snoozed " + eventId + " for " + minutes + "m");
                ManarLog.add(context, ManarLog.SNOOZED, String.valueOf(eventId), String.valueOf(minutes));
            } catch (SecurityException e) {
                am.set(AlarmManager.RTC_WAKEUP, at, pi);
            }
        }
    }
}
