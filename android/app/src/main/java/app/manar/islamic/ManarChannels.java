package app.manar.islamic;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

/**
 * Manar — notification channels.
 *
 * The web layer references these ids by name (see
 * {@code src/lib/native-notifications.ts}); they must exist before the first
 * notification is posted, otherwise Android drops it silently. Channels are
 * created once at app start and are idempotent.
 */
public final class ManarChannels {

    public static final String ADHAN = "manar_adhan";
    public static final String IQAMA = "manar_iqama";
    public static final String REMINDERS = "manar_reminders";
    public static final String SILENT = "manar_silent";
    /** Ongoing notification shown while the Adhan is actually playing. */
    public static final String PLAYBACK = "manar_playback";
    /** إشعار «سكينة» الجاري وأخبار تعذّرها — صامتٌ دائماً. */
    public static final String SAKINAH = "manar_sakinah";

    private ManarChannels() {}

    public static void ensure(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;

        // Adhan and Iqama carry their own audio through AdhanService, so the
        // channel itself stays silent — this is what prevents the OS from
        // truncating a 3-4 minute recording to a notification blip.
        NotificationChannel adhan =
                new NotificationChannel(ADHAN, "الأذان", NotificationManager.IMPORTANCE_HIGH);
        adhan.setDescription("تنبيه دخول وقت الصلاة مع تشغيل الأذان");
        adhan.setSound(null, null);
        adhan.enableVibration(true);
        adhan.setBypassDnd(true);
        adhan.setShowBadge(true);
        nm.createNotificationChannel(adhan);

        NotificationChannel iqama =
                new NotificationChannel(IQAMA, "الإقامة", NotificationManager.IMPORTANCE_HIGH);
        iqama.setDescription("تنبيه موعد إقامة الصلاة");
        iqama.setSound(null, null);
        iqama.enableVibration(true);
        nm.createNotificationChannel(iqama);

        NotificationChannel reminders =
                new NotificationChannel(REMINDERS, "التذكيرات", NotificationManager.IMPORTANCE_DEFAULT);
        reminders.setDescription("تذكير قبل دخول وقت الصلاة");
        reminders.setSound(
                Uri.parse("android.resource://" + context.getPackageName() + "/raw/segment_takbir"),
                new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
        nm.createNotificationChannel(reminders);

        NotificationChannel silent =
                new NotificationChannel(SILENT, "الوضع الصامت", NotificationManager.IMPORTANCE_LOW);
        silent.setDescription("تنبيهات بلا صوت");
        silent.setSound(null, null);
        silent.enableVibration(false);
        nm.createNotificationChannel(silent);

        NotificationChannel playback =
                new NotificationChannel(PLAYBACK, "تشغيل الأذان", NotificationManager.IMPORTANCE_LOW);
        playback.setDescription("إشعار التحكم أثناء تشغيل الأذان");
        playback.setSound(null, null);
        playback.enableVibration(false);
        playback.setShowBadge(false);
        nm.createNotificationChannel(playback);

        // سكينة تُسكت الهاتف، فلا يصحّ أن يكون إشعارها هو أوّل ما يُزعج:
        // أهميّة منخفضة، بلا صوت ولا اهتزاز، ولا يحمل شارة.
        NotificationChannel sakinah =
                new NotificationChannel(SAKINAH, "سكينة", NotificationManager.IMPORTANCE_LOW);
        sakinah.setDescription("حالة الوضع الهادئ أثناء الصلاة");
        sakinah.setSound(null, null);
        sakinah.enableVibration(false);
        sakinah.setShowBadge(false);
        nm.createNotificationChannel(sakinah);
    }
}
