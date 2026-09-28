package app.manar.islamic;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

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
        // «manar» و«priority» كلاهما نمط الأولوية؛ الفرق في السياسة المطبّقة معه.
        return NotificationManager.INTERRUPTION_FILTER_PRIORITY;
    }

    /** نمط «أصوات منار فقط». */
    static final String MODE_MANAR = "manar";

    /** قنوات منار التي لا تُصدر صوتاً فلا معنى لتجاوزها عدم الإزعاج. */
    private static final Set<String> NO_BYPASS = new HashSet<>(Arrays.asList(
            ManarChannels.SILENT, ManarChannels.PLAYBACK, ManarChannels.SAKINAH));

    /** هل الفترة الجارية الآن بنمط «أصوات منار فقط»؟ */
    public static boolean isManarQuietActive(Context context) {
        return SakinahStore.activeWindow(context) >= 0
                && MODE_MANAR.equals(SakinahStore.appliedMode(context));
    }

    /**
     * سياسة «أصوات منار فقط»: لا مكالمات ولا رسائل ولا تذكيرات ولا أحداث ولا
     * وسائط ولا أصوات نظام — وتمرّ قنوات منار وحدها لأنها «تتجاوز عدم الإزعاج».
     * {@code allowAlarms}: صوت الأذان والإقامة يُشغَّل على مسار المنبّه، فيُفتح
     * مسار المنبّهات لحظة تشغيل منار فقط ثم يُغلق، فلا يرنّ منبّه تطبيق آخر.
     */
    static NotificationManager.Policy manarPolicy(boolean allowAlarms) {
        int categories = 0;
        if (allowAlarms && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            categories |= NotificationManager.Policy.PRIORITY_CATEGORY_ALARMS;
        }
        int effects = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? NotificationManager.Policy.SUPPRESSED_EFFECT_PEEK
                        | NotificationManager.Policy.SUPPRESSED_EFFECT_LIGHTS
                        | NotificationManager.Policy.SUPPRESSED_EFFECT_FULL_SCREEN_INTENT
                        | NotificationManager.Policy.SUPPRESSED_EFFECT_AMBIENT
                : NotificationManager.Policy.SUPPRESSED_EFFECT_SCREEN_ON;
        int senders = NotificationManager.Policy.PRIORITY_SENDERS_STARRED;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return new NotificationManager.Policy(categories, senders, senders, effects,
                    NotificationManager.Policy.CONVERSATION_SENDERS_NONE);
        }
        return new NotificationManager.Policy(categories, senders, senders, effects);
    }

    static String encodePolicy(NotificationManager.Policy p) {
        if (p == null) return "";
        int conversations = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? p.priorityConversationSenders : -1;
        return p.priorityCategories + "," + p.priorityCallSenders + ","
                + p.priorityMessageSenders + "," + p.suppressedVisualEffects + "," + conversations;
    }

    static NotificationManager.Policy decodePolicy(String raw) {
        if (raw == null || raw.isEmpty()) return null;
        try {
            String[] v = raw.split(",");
            int cats = Integer.parseInt(v[0]);
            int calls = Integer.parseInt(v[1]);
            int msgs = Integer.parseInt(v[2]);
            int effects = Integer.parseInt(v[3]);
            int conv = v.length > 4 ? Integer.parseInt(v[4]) : -1;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && conv >= 0) {
                return new NotificationManager.Policy(cats, calls, msgs, effects, conv);
            }
            return new NotificationManager.Policy(cats, calls, msgs, effects);
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean setPolicy(NotificationManager nm, NotificationManager.Policy p) {
        if (p == null) return false;
        try {
            nm.setNotificationPolicy(p);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** يُعيد سياسة عدم الإزعاج التي كانت قبل الفترة (إن كنّا غيّرناها). */
    private static void restorePolicy(Context context, NotificationManager nm) {
        String saved = SakinahStore.previousPolicy(context);
        if (saved == null) return;
        setPolicy(nm, decodePolicy(saved));
        SakinahStore.forgetPolicy(context);
    }

    /**
     * يفتح قنوات منار الصوتية لتتجاوز عدم الإزعاج أثناء الفترة: الأذان والإقامة
     * وتذكيرات الأذكار والوِرد وما قبل الصلاة. يُحفظ ما فتحناه لنُرجعه بعدها.
     * أندرويد لا يقبل هذا إلا من تطبيقٍ مُنح «الوصول إلى عدم الإزعاج» وقبل أن
     * يعدّل المستخدم القناة بنفسه — فنقرأ النتيجة الفعلية بدل افتراضها.
     */
    static void openManarChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;
        Set<String> opened = SakinahStore.bypassChannels(context);
        try {
            List<NotificationChannel> channels = nm.getNotificationChannels();
            for (NotificationChannel ch : channels) {
                String id = ch.getId();
                if (id == null || !id.startsWith("manar_") || NO_BYPASS.contains(id)) continue;
                if (ch.getImportance() == NotificationManager.IMPORTANCE_NONE) continue;
                if (ch.canBypassDnd()) continue;
                ch.setBypassDnd(true);
                nm.createNotificationChannel(ch);
                NotificationChannel after = nm.getNotificationChannel(id);
                if (after != null && after.canBypassDnd()) opened.add(id);
            }
        } catch (Exception ignored) {
            // قناةٌ واحدة لا تُفشل الهدوء كلّه
        }
        SakinahStore.setBypassChannels(context, opened);
    }

    /** يُرجع القنوات التي فتحناها كما كانت. الأذان والإقامة يتجاوزان دائماً. */
    static void closeManarChannels(Context context) {
        Set<String> opened = SakinahStore.bypassChannels(context);
        SakinahStore.clearBypassChannels(context);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || opened.isEmpty()) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;
        for (String id : opened) {
            if (ManarChannels.isPrayerChannel(id)) continue;
            try {
                NotificationChannel ch = nm.getNotificationChannel(id);
                if (ch == null || !ch.canBypassDnd()) continue;
                ch.setBypassDnd(false);
                nm.createNotificationChannel(ch);
            } catch (Exception ignored) {
                // نكمل بقية القنوات
            }
        }
    }

    /**
     * الويب يعيد إنشاء قنوات التذكير عند كل مزامنة، وذلك يمسح «التجاوز».
     * يُنادى بعدها ليبقى «أصوات منار فقط» صحيحاً إن كانت فترةٌ جارية.
     */
    public static void refreshIfActive(Context context) {
        if (!isManarQuietActive(context) || !hasPolicyAccess(context)) return;
        ManarChannels.ensure(context);
        openManarChannels(context);
    }

    /**
     * يُفتح مسار المنبّه لحظة تشغيل أذان منار أو إقامتها أثناء «أصوات منار
     * فقط». بلا أثر في الأنماط الأخرى (حيث المنبّهات مسموحة أصلاً أو ممنوعة).
     */
    public static void holdManarAudio(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return;
        if (!isManarQuietActive(context) || !hasPolicyAccess(context)) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (setPolicy(nm, manarPolicy(true))) {
            SakinahStore.setAudioHold(context, true);
            SakinahLog.add(context, SakinahLog.MANAR_AUDIO_ALLOWED, "", "");
        }
    }

    /** يُغلق مسار المنبّه بعد انتهاء صوت منار. */
    public static void releaseManarAudio(Context context) {
        if (!SakinahStore.audioHold(context)) return;
        SakinahStore.setAudioHold(context, false);
        if (!isManarQuietActive(context) || !hasPolicyAccess(context)) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm != null) setPolicy(nm, manarPolicy(false));
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

        // فترةٌ بدأناها نحن ولم تنتهِ (إعادة تطبيق بعد تعديل الإعداد أو إعادة
        // الجدولة): «الحالة السابقة» هي ما قبلها، لا نمطنا نحن.
        boolean ours = SakinahStore.activeWindow(context) >= 0
                && SakinahStore.appliedFilter(context) >= 0;
        int previous = ours ? SakinahStore.previousFilter(context) : currentFilter(context);
        int target = filterFor(window.filter);
        boolean manar = MODE_MANAR.equals(window.filter);

        // القنوات تُنشأ من جديد وقد صار لمنار إذن عدم الإزعاج، فيُحفظ «التجاوز».
        ManarChannels.ensure(context);
        if (manar) {
            if (SakinahStore.previousPolicy(context) == null) {
                try {
                    SakinahStore.rememberPolicy(context, encodePolicy(nm.getNotificationPolicy()));
                } catch (Exception ignored) {
                    SakinahStore.rememberPolicy(context, "");
                }
            }
            if (!setPolicy(nm, manarPolicy(SakinahStore.audioHold(context)))) {
                SakinahLog.add(context, SakinahLog.QUIET_FAILED, window.prayer, "set_policy_rejected");
            }
            openManarChannels(context);
        } else {
            // تحوّل من «أصوات منار فقط» إلى نمطٍ آخر أثناء الفترة
            restorePolicy(context, nm);
            closeManarChannels(context);
        }

        try {
            nm.setInterruptionFilter(target);
        } catch (Exception e) {
            if (manar) {
                restorePolicy(context, nm);
                closeManarChannels(context);
            }
            SakinahLog.add(context, SakinahLog.QUIET_FAILED, window.prayer, "set_filter_rejected");
            notifyFailure(context, window);
            return false;
        }

        SakinahStore.rememberPrevious(context, previous, target);
        SakinahStore.setActiveWindow(context, window.id);
        SakinahStore.setAppliedMode(context, window.filter);
        if (manar) SakinahLog.add(context, SakinahLog.MANAR_ONLY_APPLIED, window.prayer, "");
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
            // «أصوات منار فقط»: السياسة والقنوات تعود كما كانت قبل الفترة
            restorePolicy(context, nm);
            closeManarChannels(context);
            int applied = SakinahStore.appliedFilter(context);
            int previous = SakinahStore.previousFilter(context);
            int now = currentFilter(context);
            // إن كان المستخدم قد غيّر النمط بنفسه أثناء الفترة فاختياره أحقّ
            if (applied < 0 || now == applied) {
                // أندرويد ١٥ فأعلى: هدوء منار «قاعدةٌ» خاصة بالتطبيق مستقلة عن
                // عدم إزعاج المستخدم، فإنهاؤها يكون دائماً بـ ALL ولا يمسّ وضعه.
                int restoreTo = Build.VERSION.SDK_INT >= 35
                        || previous < 0
                        || previous == NotificationManager.INTERRUPTION_FILTER_UNKNOWN
                        ? NotificationManager.INTERRUPTION_FILTER_ALL
                        : previous;
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
        SakinahStore.forgetPolicy(context);
        SakinahStore.clearBypassChannels(context);
        SakinahStore.clearAppliedMode(context);
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
