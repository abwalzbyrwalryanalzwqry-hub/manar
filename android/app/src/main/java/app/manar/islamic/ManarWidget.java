package app.manar.islamic;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

/**
 * منار — ويدجت الشاشة الرئيسية: الصلاة القادمة بعدّ تنازلي حيّ، والتاريخ الهجري،
 * وآية اليوم.
 *
 * <p>الويب يحسب لقطة لسبعة أيام ({@code src/lib/widget-snapshot.ts}) ويسلّمها عبر
 * {@link ManarAdhanPlugin#updateWidget}. هذه الطبقة لا تحسب مواقيت: تختار من
 * اللقطة الصلاةَ القادمة وفق الساعة، وتعرض العدّ التنازلي بـ {@code Chronometer}
 * (يتحرّك وحده بلا تحديثات)، وتضبط منبّهاً غير موقظ يعيد الرسم عند كل أذان
 * وعند منتصف الليل — فيبقى الويدجت صحيحاً والتطبيق مغلق طوال أسبوع.
 */
public class ManarWidget extends AppWidgetProvider {

    private static final String PREFS = "manar_widget";
    private static final String KEY_SNAPSHOT = "snapshot";
    static final String ACTION_REFRESH = "app.manar.islamic.WIDGET_REFRESH";
    private static final int REQUEST_REFRESH = 42500;
    private static final int REQUEST_OPEN = 42501;

    /* ---------------- التخزين ---------------- */

    static void saveSnapshot(Context context, String json) {
        prefs(context).edit().putString(KEY_SNAPSHOT, json == null ? "" : json).apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /* ---------------- دورة الحياة ---------------- */

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        render(context, manager, ids);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (intent != null && ACTION_REFRESH.equals(intent.getAction())) {
            updateAll(context);
        }
    }

    @Override
    public void onDisabled(Context context) {
        // لا ويدجت على الشاشة: لا داعي لأي منبّه.
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(refreshIntent(context));
    }

    /** يعيد رسم كل نسخ الويدجت. يعيد عددها (٠ إن لم يضف المستخدم أياً منها). */
    static int updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, ManarWidget.class));
        if (ids == null || ids.length == 0) return 0;
        render(context, manager, ids);
        return ids.length;
    }

    /* ---------------- الرسم ---------------- */

    private static void render(Context context, AppWidgetManager manager, int[] ids) {
        long now = System.currentTimeMillis();
        String json = prefs(context).getString(KEY_SNAPSHOT, "");
        Pick pick = pick(json, now);
        Options opts = options(json);

        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_manar);
            views.setOnClickPendingIntent(R.id.widget_root, openAppIntent(context));
            views.setInt(R.id.widget_root, "setBackgroundResource",
                    opts.emerald ? R.drawable.widget_background_emerald : R.drawable.widget_background);

            if (pick == null) {
                views.setTextViewText(R.id.widget_prayer, context.getString(R.string.widget_open_app));
                views.setTextViewText(R.id.widget_time, "");
                views.setViewVisibility(R.id.widget_countdown, View.GONE);
                views.setViewVisibility(R.id.widget_countdown_label, View.GONE);
                views.setTextViewText(R.id.widget_meta, context.getString(R.string.app_name));
                views.setViewVisibility(R.id.widget_meta, View.VISIBLE);
                views.setViewVisibility(R.id.widget_verse_block, View.GONE);
            } else {
                views.setTextViewText(R.id.widget_prayer, pick.name);
                views.setTextViewText(R.id.widget_time, pick.time);
                String meta = opts.hijri ? pick.hijri : "";
                if (opts.city && !pick.city.isEmpty()) {
                    meta = meta.isEmpty() ? pick.city : meta + "  ·  " + pick.city;
                }
                views.setTextViewText(R.id.widget_meta, meta);
                views.setViewVisibility(R.id.widget_meta, meta.isEmpty() ? View.GONE : View.VISIBLE);
                if (opts.countdown) {
                    // Chronometer يعدّ تنازلياً وحده من القاعدة إلى الصفر.
                    long base = SystemClock.elapsedRealtime() + (pick.at - now);
                    views.setChronometer(R.id.widget_countdown, base, null, true);
                    views.setChronometerCountDown(R.id.widget_countdown, true);
                    views.setViewVisibility(R.id.widget_countdown, View.VISIBLE);
                    views.setViewVisibility(R.id.widget_countdown_label, View.VISIBLE);
                } else {
                    views.setChronometer(R.id.widget_countdown, SystemClock.elapsedRealtime(), null, false);
                    views.setViewVisibility(R.id.widget_countdown, View.GONE);
                    views.setViewVisibility(R.id.widget_countdown_label, View.GONE);
                }

                if (!opts.verse || pick.verse.isEmpty()) {
                    views.setViewVisibility(R.id.widget_verse_block, View.GONE);
                } else {
                    views.setViewVisibility(R.id.widget_verse_block, View.VISIBLE);
                    views.setTextViewText(R.id.widget_verse, pick.verse);
                    views.setTextViewText(R.id.widget_verse_ref, pick.verseRef);
                }
            }
            manager.updateAppWidget(id, views);
        }

        scheduleRefresh(context, pick == null ? 0 : pick.at, now);
    }

    /* ---------------- اختيار الصلاة القادمة ---------------- */

    static final class Pick {
        String name = "";
        String time = "";
        String meta = "";
        String verse = "";
        String verseRef = "";
        String hijri = "";
        String city = "";
        long at;
    }

    /** إعدادات العرض من شاشة «ويدجت الشاشة الرئيسية» ({@code snapshot.options}). */
    static final class Options {
        boolean verse = true;
        boolean countdown = true;
        boolean hijri = true;
        boolean city = true;
        boolean emerald = false;
    }

    static Options options(String json) {
        Options o = new Options();
        if (json == null || json.isEmpty()) return o;
        try {
            JSONObject opts = new JSONObject(json).optJSONObject("options");
            if (opts == null) return o;
            o.verse = opts.optBoolean("verse", true);
            o.countdown = opts.optBoolean("countdown", true);
            o.hijri = opts.optBoolean("hijri", true);
            o.city = opts.optBoolean("city", true);
            o.emerald = "emerald".equals(opts.optString("theme", "night"));
        } catch (Exception ignored) {
            // لقطة تالفة: الافتراضيات.
        }
        return o;
    }

    /** مفتاح اليوم المحلي بصيغة الويب {@code YYYY-MM-DD}. */
    static String dayKey(long millis) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(millis);
        return String.format(
                Locale.US,
                "%04d-%02d-%02d",
                c.get(Calendar.YEAR),
                c.get(Calendar.MONTH) + 1,
                c.get(Calendar.DAY_OF_MONTH));
    }

    /**
     * التاريخ الهجري المعروض: بعد مغرب اليوم — إن كان «اليوم الهجري يبدأ عند
     * المغرب» مفعّلاً في التطبيق (المرحلة ٣٣) — تاريخ الغد الهجري.
     */
    static String hijriFor(JSONObject day, long now) {
        long from = day.optLong("hijriFrom", 0L);
        String evening = day.optString("hijriEvening", "");
        if (from > 0 && now >= from && !evening.isEmpty()) return evening;
        return day.optString("hijri", "");
    }

    /** أول صلاة بعد {@code now} في اللقطة، مع بيانات «اليوم» للعرض. {@code null} إن نفدت. */
    static Pick pick(String json, long now) {
        if (json == null || json.isEmpty()) return null;
        try {
            JSONObject snap = new JSONObject(json);
            JSONArray days = snap.optJSONArray("days");
            if (days == null) return null;
            String city = snap.optString("city", "");
            String today = dayKey(now);

            JSONObject todayObj = null;
            for (int i = 0; i < days.length(); i++) {
                JSONObject d = days.optJSONObject(i);
                if (d != null && today.equals(d.optString("date"))) todayObj = d;
            }

            for (int i = 0; i < days.length(); i++) {
                JSONObject d = days.optJSONObject(i);
                if (d == null) continue;
                JSONArray prayers = d.optJSONArray("prayers");
                if (prayers == null) continue;
                for (int j = 0; j < prayers.length(); j++) {
                    JSONObject p = prayers.optJSONObject(j);
                    if (p == null) continue;
                    long at = p.optLong("at");
                    if (at <= now) continue;

                    Pick out = new Pick();
                    out.at = at;
                    out.name = p.optString("name");
                    out.time = p.optString("time");
                    JSONObject shown = todayObj != null ? todayObj : d;
                    String hijri = hijriFor(shown, now);
                    out.meta = city.isEmpty() ? hijri : hijri + "  ·  " + city;
                    out.hijri = hijri;
                    out.city = city;
                    JSONObject verse = shown.optJSONObject("verse");
                    if (verse != null) {
                        out.verse = verse.optString("text", "");
                        out.verseRef = verse.optString("ref", "");
                    }
                    return out;
                }
            }
        } catch (Exception ignored) {
            // لقطة تالفة: نعرض «افتح منار» بدل الانهيار.
        }
        return null;
    }

    /* ---------------- المنبّهات والنوايا ---------------- */

    private static PendingIntent refreshIntent(Context context) {
        Intent intent = new Intent(context, ManarWidget.class).setAction(ACTION_REFRESH);
        return PendingIntent.getBroadcast(
                context,
                REQUEST_REFRESH,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent openAppIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
                context,
                REQUEST_OPEN,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /**
     * منبّه غير موقظ عند أقرب «الأذان القادم» أو «منتصف الليل». غير الموقظ يكفي:
     * لا أحد يرى الويدجت والشاشة مطفأة، ويُسلَّم فور استيقاظ الجهاز. و{@code setWindow}
     * لا يحتاج إذن المنبّهات الدقيقة.
     */
    private static void scheduleRefresh(Context context, long nextPrayerAt, long now) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        Calendar midnight = Calendar.getInstance();
        midnight.setTimeInMillis(now);
        midnight.add(Calendar.DAY_OF_MONTH, 1);
        midnight.set(Calendar.HOUR_OF_DAY, 0);
        midnight.set(Calendar.MINUTE, 0);
        midnight.set(Calendar.SECOND, 5);
        midnight.set(Calendar.MILLISECOND, 0);

        long at = midnight.getTimeInMillis();
        if (nextPrayerAt > now && nextPrayerAt + 1000 < at) at = nextPrayerAt + 1000;

        am.setWindow(AlarmManager.RTC, at, 15_000L, refreshIntent(context));
    }
}
