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
    /**
     * نسختا الأذان والإقامة بلا اهتزاز. اهتزاز القناة لا يتغيّر بعد إنشائها، فمن
     * أطفأ «الاهتزاز» في منار تُنشر تنبيهاته على هاتين القناتين (انظر {@link #notice}).
     */
    public static final String ADHAN_NV = "manar_adhan_nv";
    public static final String IQAMA_NV = "manar_iqama_nv";
    public static final String REMINDERS = "manar_reminders";
    public static final String SILENT = "manar_silent";
    /** Ongoing notification shown while the Adhan is actually playing. */
    /**
     * إشعار التشغيل الجاري. كان «manar_playback» بأهمية منخفضة فلا يظهر منبثقاً
     * على شاشة القفل، ولا تتغيّر أهمية قناةٍ بعد إنشائها — فقناةٌ جديدة عالية
     * الأهمية بلا صوت ولا اهتزاز، وتُحذف القديمة.
     */
    public static final String PLAYBACK = "manar_playback_v2";
    static final String PLAYBACK_LEGACY = "manar_playback";
    /** إشعار «سكينة» الجاري وأخبار تعذّرها — صامتٌ دائماً. */
    public static final String SAKINAH = "manar_sakinah";

    private ManarChannels() {}

    /** قناة تنبيه الأذان/الإقامة المكتوب بحسب إعداد «الاهتزاز» في منار. */
    public static String notice(Context context, String kind) {
        // التنبيه قبل الصلاة يحمل معرّف قناته كاملاً (manar_approach_…، manar_silent)
        // كما أنشأتها المزامنة بصوت مقطعها ودرجتها واهتزازها.
        if (kind != null && kind.startsWith("manar_")) return existing(context, kind);
        boolean vibrate = ManarVolumes.vibrate(context);
        if ("iqama".equals(kind)) return vibrate ? IQAMA : IQAMA_NV;
        return vibrate ? ADHAN : ADHAN_NV;
    }

    /** القناة إن كانت موجودة، وإلا قناة التذكيرات العامة — لا إشعار يسقط بصمت. */
    static String existing(Context context, String id) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return id;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(id) != null) return id;
        return REMINDERS;
    }

    /** هل القناة إحدى قنوات الأذان/الإقامة الأصلية (تتجاوز «عدم الإزعاج» دائماً)؟ */
    public static boolean isPrayerChannel(String id) {
        return ADHAN.equals(id) || IQAMA.equals(id) || ADHAN_NV.equals(id) || IQAMA_NV.equals(id);
    }

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
        // كالأذان: الإقامة تُسمع أثناء «سكينة» وعدم الإزعاج (صوتها من AdhanService).
        iqama.setBypassDnd(true);
        nm.createNotificationChannel(iqama);

        NotificationChannel adhanNv =
                new NotificationChannel(ADHAN_NV, "الأذان · بلا اهتزاز", NotificationManager.IMPORTANCE_HIGH);
        adhanNv.setDescription("تنبيه دخول وقت الصلاة حين يكون الاهتزاز مطفأً في منار");
        adhanNv.setSound(null, null);
        adhanNv.enableVibration(false);
        adhanNv.setBypassDnd(true);
        nm.createNotificationChannel(adhanNv);

        NotificationChannel iqamaNv =
                new NotificationChannel(IQAMA_NV, "الإقامة · بلا اهتزاز", NotificationManager.IMPORTANCE_HIGH);
        iqamaNv.setDescription("تنبيه الإقامة حين يكون الاهتزاز مطفأً في منار");
        iqamaNv.setSound(null, null);
        iqamaNv.enableVibration(false);
        iqamaNv.setBypassDnd(true);
        nm.createNotificationChannel(iqamaNv);

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
                new NotificationChannel(PLAYBACK, "تشغيل الأذان", NotificationManager.IMPORTANCE_HIGH);
        playback.setDescription("إشعار التحكم أثناء تشغيل الأذان");
        playback.setSound(null, null);
        playback.enableVibration(false);
        playback.setShowBadge(false);
        playback.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(playback);
        if (nm.getNotificationChannel(PLAYBACK_LEGACY) != null) {
            nm.deleteNotificationChannel(PLAYBACK_LEGACY);
        }

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
