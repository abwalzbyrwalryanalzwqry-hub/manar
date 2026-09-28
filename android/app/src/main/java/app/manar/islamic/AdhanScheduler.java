package app.manar.islamic;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Manar — exact-alarm scheduler for Adhan and Iqama.
 *
 * The web layer computes prayer times locally (no network) and hands this class
 * a flat list of events. Each event becomes one exact alarm that survives Doze
 * ({@code setExactAndAllowWhileIdle}) and fires {@link AdhanAlarmReceiver},
 * which starts {@link AdhanService} to play the full recording.
 *
 * The list is persisted verbatim so {@link BootReceiver} can re-arm everything
 * after a reboot, an app update, or a timezone change — without needing the
 * WebView to be alive.
 *
 * <p><b>نافذة الضبط:</b> الويب يسلّم جدولاً طويلاً (أسابيع)، فيُحفظ كله، لكن لا
 * يُضبط منه في {@link AlarmManager} إلا ما يقع خلال {@link #ARM_WINDOW_MS}. منبّه
 * «تعبئة» خفيف ({@link #ACTION_TOP_UP}) وكلُّ إطلاق حدث يُقدّمان النافذة من
 * الجدول المحفوظ. هكذا يستمر الأذان أسابيع دون فتح التطبيق، ويبقى عدد
 * المنبّهات المعلّقة صغيراً بعيداً عن حدّ النظام (٥٠٠ منبّه للتطبيق).
 *
 * <p>منع التكرار على ثلاث طبقات:
 * <ol>
 *   <li>لكل حدث مفتاح فريد ({@code fajr_iqamah_2026_09_23}). القائمة الواردة
 *       تُصفّى بالمفتاح قبل الضبط، فلا يُضبط منبّهان لحدثٍ واحد.</li>
 *   <li>{@link #replaceAll} يُلغي كل ما ضُبط قبله ثم يضبط الجديد — استبدالٌ لا
 *       إضافة، مهما تكرّرت المزامنة (فتح التطبيق، تغيير الإعدادات، إعادة التشغيل).</li>
 *   <li>{@link #markFired} يحفظ مفاتيح ما أُطلق فعلاً؛ فلو أعاد النظام حدثاً بعد
 *       إرجاع الساعة أو إعادة الضبط، يُتجاهل ولا يُسمَع الأذان أو الإقامة مرّتين.</li>
 * </ol>
 */
public final class AdhanScheduler {

    private static final String PREFS = "manar_adhan_schedule";
    private static final String KEY_EVENTS = "events";
    private static final String KEY_FIRED = "fired";
    private static final String KEY_LAST_SCHEDULED = "last_scheduled";
    /** منطقة الجهاز الزمنية لحظة حساب الجدول — لتنبيه «تغيّرت منطقتك» بعد السفر. */
    private static final String KEY_ZONE = "zone";
    private static final String KEY_ZONE_OFFSET = "zone_offset";
    /** معرّف إشعار «تغيّرت منطقتك الزمنية» (ضمن ManarNotices، بعيدٌ عن معرّفات الأحداث). */
    static final int ZONE_NOTICE_EVENT = 99_990;
    private static final String KEY_FAILED_AT = "playback_failed_at";
    private static final String KEY_FAILED_REASON = "playback_failed_reason";
    /** كم مفتاحاً مُطلَقاً نتذكّر — أكثر من يومين من الأحداث بهامشٍ واسع. */
    private static final int FIRED_MEMORY = 96;

    /** Request-code range reserved for Manar alarms. */
    private static final int REQUEST_BASE = 41000;

    static final String EXTRA_EVENT_ID = "event_id";

    /** تُضبط منبّهات الأحداث الواقعة خلال هذه المدة فقط (٤٨ ساعة). */
    static final long ARM_WINDOW_MS = 48L * 60 * 60 * 1000;
    /** منبّه التعبئة يُقدّم النافذة كل ١٢ ساعة على الأكثر. */
    static final long TOP_UP_EVERY_MS = 12L * 60 * 60 * 1000;
    /** رمز طلب منبّه التعبئة — خارج مدى الأحداث (REQUEST_BASE + id). */
    private static final int TOP_UP_REQUEST = REQUEST_BASE - 1;
    public static final String ACTION_TOP_UP = "app.manar.islamic.action.ADHAN_TOP_UP";

    private AdhanScheduler() {}

    public static final String KIND_ADHAN = "adhan";
    public static final String KIND_IQAMA = "iqama";
    /** إشعار نصّي بلا صوت: دخول الوقت حين يكون الأذان معطّلاً، أو «اقتربت الإقامة». */
    public static final String KIND_NOTICE = "notice";

    /** موعد الحدث المجدول في المنبّه — ليحسب السجل كم تأخّر الإطلاق. */
    public static final String EXTRA_AT = "at";

    /** One scheduled Adhan / Iqama / notice event. */
    public static final class Event {
        public final int id;
        /** مفتاح فريد مقروء، مثل {@code fajr_iqamah_2026_09_23}. */
        public final String key;
        public final long atMillis;
        public final String sound;
        public final String title;
        public final String body;
        public final String kind;
        /** قناة الإشعار لحدث notice: "adhan" أو "iqama". */
        public final String channel;
        /** بعد انتهاء الأذان يبقى إشعار دخول الوقت. */
        public final boolean notice;
        /** مقطعٌ يُشغَّل بعد الصوت الرئيسي مباشرة (التثويب بعد أذان الفجر)، أو "". */
        public final String follow;
        /** {@link NoticeMeta} نصّاً: المسار، و«صلّيت»، و«ذكّرني لاحقاً»، أو "". */
        public final String meta;

        Event(int id, String key, long atMillis, String sound, String title, String body,
              String kind, String channel, boolean notice) {
            this(id, key, atMillis, sound, title, body, kind, channel, notice, "", "");
        }

        Event(int id, String key, long atMillis, String sound, String title, String body,
              String kind, String channel, boolean notice, String follow, String meta) {
            this.id = id;
            this.key = key == null || key.isEmpty() ? (kind + "_" + id) : key;
            this.atMillis = atMillis;
            this.sound = sound;
            this.title = title;
            this.body = body;
            this.kind = kind;
            this.channel = channel == null ? "" : channel;
            this.notice = notice;
            this.follow = follow == null ? "" : follow;
            this.meta = meta == null ? "" : meta;
        }

        static Event fromJson(JSONObject o) {
            return new Event(
                    o.optInt("id"),
                    o.optString("key", ""),
                    o.optLong("at"),
                    o.optString("sound", ""),
                    o.optString("title", "منار"),
                    o.optString("body", ""),
                    o.optString("kind", KIND_ADHAN),
                    o.optString("channel", ""),
                    o.optBoolean("notice", false),
                    o.optString("follow", ""),
                    metaOf(o));
        }

        /** الويب يرسل meta كائناً، والمحفوظ نصّاً — كلاهما يُقبل. */
        private static String metaOf(JSONObject o) {
            JSONObject m = o.optJSONObject("meta");
            if (m != null) return NoticeMeta.parse(m.toString()).toJson();
            return NoticeMeta.parse(o.optString("meta", "")).toJson();
        }

        JSONObject toJson() throws JSONException {
            return new JSONObject()
                    .put("id", id)
                    .put("key", key)
                    .put("at", atMillis)
                    .put("sound", sound == null ? "" : sound)
                    .put("title", title)
                    .put("body", body)
                    .put("kind", kind)
                    .put("channel", channel)
                    .put("notice", notice)
                    .put("follow", follow)
                    .put("meta", meta);
        }
    }

    public static List<Event> parse(JSONArray array) {
        List<Event> events = new ArrayList<>();
        if (array == null) return events;
        for (int i = 0; i < array.length(); i++) {
            JSONObject o = array.optJSONObject(i);
            if (o != null) events.add(Event.fromJson(o));
        }
        return events;
    }

    /** يُصفّي القائمة بالمفتاح والمعرّف: الأوّل يبقى، والمكرّر يُسقط. */
    static List<Event> dedupe(List<Event> events) {
        Map<String, Event> byKey = new LinkedHashMap<>();
        Set<Integer> ids = new HashSet<>();
        for (Event e : events) {
            if (byKey.containsKey(e.key) || ids.contains(e.id)) continue;
            byKey.put(e.key, e);
            ids.add(e.id);
        }
        return new ArrayList<>(byKey.values());
    }

    /**
     * Replaces the whole schedule: cancels what we armed before, stores every
     * future event, then arms only the next {@link #ARM_WINDOW_MS}.
     *
     * @return عدد الأحداث القادمة المحفوظة (المضبوط منها وما ينتظر النافذة).
     */
    public static synchronized int replaceAll(Context context, List<Event> events) {
        cancelAll(context);

        long now = System.currentTimeMillis();
        Set<String> fired = firedKeys(context);
        List<Event> pending = new ArrayList<>();
        for (Event e : dedupe(events)) {
            if (e.atMillis <= now) continue;
            if (fired.contains(e.key)) continue;
            pending.add(e);
        }

        persist(context, pending);
        prefs(context).edit()
                .putLong(KEY_LAST_SCHEDULED, now)
                .putString(KEY_ZONE, java.util.TimeZone.getDefault().getID())
                .putInt(KEY_ZONE_OFFSET, java.util.TimeZone.getDefault().getOffset(now))
                .apply();
        int armed = armWindow(context, pending, now);
        ManarLog.add(context, ManarLog.SCHEDULED, "",
                pending.size() + "/" + armed + (canScheduleExact(context) ? "/exact" : "/inexact"));
        android.util.Log.i("ManarSchedule", "stored " + pending.size() + " of " + events.size()
                + ", armed " + armed + " exact=" + canScheduleExact(context));
        return pending.size();
    }

    /**
     * يُقدّم النافذة من الجدول المحفوظ دون إلغاء شيء ولا حذف: يضبط ما دخل
     * النافذة فقط. إعادة ضبط منبّه قائم بالنيّة نفسها تستبدله، فلا تكرار. الماضي
     * يبقى في المحفوظ (يقرؤه {@link #find}) حتى يستبدل التطبيق الجدول كله.
     */
    public static synchronized int topUp(Context context) {
        long now = System.currentTimeMillis();
        List<Event> stored = restore(context);
        int armed = armWindow(context, stored, now);
        android.util.Log.i("ManarSchedule", "top-up: armed " + armed + " of " + stored.size());
        return armed;
    }

    /** يضبط أحداث النافذة، ثم منبّه التعبئة التالي إن بقي ما بعدها. */
    private static int armWindow(Context context, List<Event> pending, long now) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return 0;

        Set<String> fired = firedKeys(context);
        long windowEnd = now + ARM_WINDOW_MS;
        boolean beyond = false;
        int armed = 0;
        for (Event e : pending) {
            if (e.atMillis <= now || fired.contains(e.key)) continue;
            if (e.atMillis > windowEnd) {
                beyond = true;
                continue;
            }
            PendingIntent pi = pendingIntentFor(context, e, PendingIntent.FLAG_UPDATE_CURRENT);
            if (pi == null) continue;
            setAlarm(am, e.atMillis, pi, true);
            armed++;
        }

        PendingIntent topUp = topUpIntent(context, PendingIntent.FLAG_UPDATE_CURRENT);
        if (beyond && topUp != null) {
            // غير دقيق عمداً: لا يحتاج إذن المنبّهات الدقيقة، والنافذة (٤٨ ساعة)
            // أوسع كثيراً من أي تأخير يفرضه وضع توفير الطاقة.
            setAlarm(am, now + TOP_UP_EVERY_MS, topUp, false);
        } else if (topUp != null) {
            am.cancel(topUp);
        }
        return armed;
    }

    private static void setAlarm(AlarmManager am, long at, PendingIntent pi, boolean exact) {
        try {
            if (exact && (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms())) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } else {
                // Without the exact-alarm permission the OS would reject the
                // exact call outright; an inexact alarm still fires, just later.
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            }
        } catch (SecurityException ignored) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    private static PendingIntent topUpIntent(Context context, int extraFlags) {
        Intent intent = new Intent(context, AdhanAlarmReceiver.class)
                .setAction(ACTION_TOP_UP)
                .setData(android.net.Uri.parse("manar://adhan/top-up"));
        return PendingIntent.getBroadcast(
                context, TOP_UP_REQUEST, intent, extraFlags | PendingIntent.FLAG_IMMUTABLE);
    }

    /* ------------------------- منع الإطلاق المكرّر ------------------------- */

    /**
     * يُسجّل أن الحدث أُطلق. يُرجع false إن كان قد أُطلق من قبل — فيتوقّف
     * المستقبِل ولا يُشغّل شيئاً.
     */
    public static synchronized boolean markFired(Context context, String key) {
        if (key == null || key.isEmpty()) return true;
        SharedPreferences p = prefs(context);
        JSONArray list;
        try {
            list = new JSONArray(p.getString(KEY_FIRED, "[]"));
        } catch (JSONException e) {
            list = new JSONArray();
        }
        for (int i = 0; i < list.length(); i++) {
            if (key.equals(list.optString(i))) return false;
        }
        list.put(key);
        JSONArray trimmed = new JSONArray();
        int start = Math.max(0, list.length() - FIRED_MEMORY);
        for (int i = start; i < list.length(); i++) trimmed.put(list.optString(i));
        p.edit().putString(KEY_FIRED, trimmed.toString()).apply();
        return true;
    }

    static Set<String> firedKeys(Context context) {
        Set<String> out = new HashSet<>();
        try {
            JSONArray list = new JSONArray(prefs(context).getString(KEY_FIRED, "[]"));
            for (int i = 0; i < list.length(); i++) out.add(list.optString(i));
        } catch (JSONException ignored) {
            // سجلّ تالف: نبدأ من جديد
        }
        return out;
    }

    /** حدث مُجدوَل بمفتاحه — يقرؤه المستقبِل ليتأكّد أن الحدث ما زال قائماً. */
    public static Event find(Context context, String key) {
        if (key == null) return null;
        for (Event e : restore(context)) if (key.equals(e.key)) return e;
        return null;
    }

    /**
     * يُسجَّل تعذّر تشغيل صوت الأذان أو الإقامة، فتعرضه بطاقة الحالة بسببه بدل
     * أن يمرّ صامتاً. {@code commit}: نحن داخل مستقبِل قد يُنهى بعده مباشرة.
     */
    public static void recordPlaybackFailure(Context context, String reason) {
        prefs(context).edit()
                .putLong(KEY_FAILED_AT, System.currentTimeMillis())
                .putString(KEY_FAILED_REASON, reason == null ? "" : reason)
                .commit();
    }

    public static long playbackFailedAt(Context context) {
        return prefs(context).getLong(KEY_FAILED_AT, 0L);
    }

    public static String playbackFailedReason(Context context) {
        return prefs(context).getString(KEY_FAILED_REASON, "");
    }

    public static long lastScheduledAt(Context context) {
        return prefs(context).getLong(KEY_LAST_SCHEDULED, 0L);
    }

    /** المُجدوَل القادم لنوعٍ معيّن. */
    public static int pendingCount(Context context, String kind) {
        long now = System.currentTimeMillis();
        int count = 0;
        for (Event e : restore(context)) if (e.atMillis > now && kind.equals(e.kind)) count++;
        return count;
    }

    /** أقرب حدث قادم، أو null. */
    public static Event next(Context context) {
        long now = System.currentTimeMillis();
        Event best = null;
        for (Event e : restore(context)) {
            if (e.atMillis <= now) continue;
            if (best == null || e.atMillis < best.atMillis) best = e;
        }
        return best;
    }

    public static void cancelAll(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        List<Event> stored = restore(context);
        if (am != null) {
            for (Event e : stored) {
                PendingIntent pi = pendingIntentFor(context, e, PendingIntent.FLAG_NO_CREATE);
                if (pi != null) {
                    am.cancel(pi);
                    pi.cancel();
                }
            }
        }
        if (am != null) {
            PendingIntent topUp = topUpIntent(context, PendingIntent.FLAG_NO_CREATE);
            if (topUp != null) {
                am.cancel(topUp);
                topUp.cancel();
            }
        }
        prefs(context).edit().remove(KEY_EVENTS).apply();
    }

    /** Re-arms the persisted schedule — used after reboot / update / time change. */
    public static int rearm(Context context) {
        List<Event> stored = restore(context);
        if (stored.isEmpty()) return 0;
        return replaceAll(context, stored);
    }

    public static boolean canScheduleExact(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        return am != null && am.canScheduleExactAlarms();
    }

    public static int pendingCount(Context context) {
        long now = System.currentTimeMillis();
        int count = 0;
        for (Event e : restore(context)) if (e.atMillis > now) count++;
        return count;
    }

    private static PendingIntent pendingIntentFor(Context context, Event e, int extraFlags) {
        Intent intent = new Intent(context, AdhanAlarmReceiver.class)
                .setAction(AdhanAlarmReceiver.ACTION_FIRE)
                // A distinct data URI keeps every PendingIntent unique, since
                // extras alone are ignored when Android compares intents.
                .setData(android.net.Uri.parse("manar://adhan/" + e.id))
                .putExtra(AdhanService.EXTRA_SOUND, e.sound)
                .putExtra(AdhanService.EXTRA_TITLE, e.title)
                .putExtra(AdhanService.EXTRA_BODY, e.body)
                .putExtra(AdhanService.EXTRA_KIND, e.kind)
                .putExtra(AdhanService.EXTRA_KEY, e.key)
                .putExtra(AdhanService.EXTRA_CHANNEL, e.channel)
                .putExtra(AdhanService.EXTRA_NOTICE, e.notice)
                .putExtra(AdhanService.EXTRA_FOLLOW, e.follow)
                .putExtra(AdhanService.EXTRA_META, e.meta)
                .putExtra(EXTRA_AT, e.atMillis)
                .putExtra(EXTRA_EVENT_ID, e.id);

        return PendingIntent.getBroadcast(
                context, REQUEST_BASE + e.id, intent, extraFlags | PendingIntent.FLAG_IMMUTABLE);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static void persist(Context context, List<Event> events) {
        JSONArray array = new JSONArray();
        for (Event e : events) {
            try {
                array.put(e.toJson());
            } catch (JSONException ignored) {
                // skip the single malformed entry rather than losing the schedule
            }
        }
        prefs(context).edit().putString(KEY_EVENTS, array.toString()).apply();
    }

    private static List<Event> restore(Context context) {
        String raw = prefs(context).getString(KEY_EVENTS, null);
        if (raw == null) return new ArrayList<>();
        try {
            return parse(new JSONArray(raw));
        } catch (JSONException e) {
            return new ArrayList<>();
        }
    }

    /**
     * بعد تغيّر المنطقة الزمنية: الجدول المحفوظ حُسب لمدينةٍ ومنطقةٍ سابقتين. إن
     * تغيّر فرق التوقيت فعلاً (سفر، لا تغيير اسمٍ لنفس الفرق) وفي الجدول أحداث،
     * نُنبّه مرّة: «افتح منار لتحديث المواقيت». الأذان يبقى مضبوطاً بلحظاته
     * المطلقة حتى يُفتح التطبيق.
     */
    public static boolean zoneChangedSinceSchedule(Context context) {
        SharedPreferences p = prefs(context);
        String zone = p.getString(KEY_ZONE, null);
        if (zone == null || restore(context).isEmpty()) return false;
        long now = System.currentTimeMillis();
        java.util.TimeZone tz = java.util.TimeZone.getDefault();
        if (zone.equals(tz.getID())) return false;
        int before = p.getInt(KEY_ZONE_OFFSET, Integer.MIN_VALUE);
        return before == Integer.MIN_VALUE || before != tz.getOffset(now);
    }

    public static void postZoneChangedNotice(Context context) {
        ManarNotices.post(context, ZONE_NOTICE_EVENT, "adhan",
                "تغيّرت منطقتك الزمنية",
                "افتح منار لتحديث مواقيت الصلاة حسب موقعك الجديد.",
                null, false);
    }
}
