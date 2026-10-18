package app.manar.islamic;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.Nullable;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * لقطة الويدجتات (src/lib/widget-snapshot.ts) وحالتها في لحظة ما: الصلاة
 * القادمة، «حان الآن» والإقامة، اليوم الهجري، آية اليوم. منطق نقي يُختبر على
 * JVM (WidgetDataTest).
 */
final class WidgetData {

    static final String PREFS = "manar_widget";
    static final String KEY_SNAPSHOT = "snapshot";

    /** نافذة «حان الآن» بعد الأذان حين لا إقامة. */
    static final long NOW_WINDOW_MS = 15 * 60_000L;

    static final class Prayer {
        String key;
        String name;
        long at;
        String time;
        long iq;
    }

    static final class Verse {
        String text;
        String ref;
        String pk;
        int surah;
        int ayah;
    }

    static final class Day {
        String date;
        String weekday = "";
        String greg = "";
        String hijri = "";
        String[] hp;
        long hijriFrom;
        String hijriEvening;
        String[] hpEvening;
        String season;
        final List<Prayer> prayers = new ArrayList<>();
        Verse verse;

        @Nullable Prayer get(String key) {
            for (Prayer p : prayers) if (p.key.equals(key)) return p;
            return null;
        }
    }

    final JSONObject raw;
    final int version;
    final String city;
    final boolean latinDigits;
    final boolean clock24;
    final float scale;
    final boolean appDark;
    final List<Day> days = new ArrayList<>();
    final JSONObject options;
    final JSONObject configs;
    final JSONObject extras;

    private WidgetData(JSONObject o) throws Exception {
        raw = o;
        version = o.optInt("v", 1);
        city = o.optString("city", "");
        JSONObject d = o.optJSONObject("display");
        latinDigits = d != null && "latn".equals(d.optString("digits"));
        clock24 = d != null && "24".equals(d.optString("clock"));
        scale = d == null ? 1f : (float) d.optDouble("scale", 1);
        appDark = d == null || d.optBoolean("dark", true);
        options = o.optJSONObject("options") == null ? new JSONObject() : o.optJSONObject("options");
        configs = o.optJSONObject("configs") == null ? new JSONObject() : o.optJSONObject("configs");
        extras = o.optJSONObject("extras") == null ? new JSONObject() : o.optJSONObject("extras");
        JSONArray arr = o.getJSONArray("days");
        for (int i = 0; i < arr.length(); i++) {
            JSONObject j = arr.getJSONObject(i);
            Day day = new Day();
            day.date = j.getString("date");
            day.weekday = j.optString("weekday", "");
            day.greg = j.optString("greg", "");
            day.hijri = j.optString("hijri", "");
            day.hp = parts(j.optJSONObject("hp"));
            day.hijriFrom = j.optLong("hijriFrom", 0);
            day.hijriEvening = j.optString("hijriEvening", "");
            day.hpEvening = parts(j.optJSONObject("hpEvening"));
            day.season = j.optString("season", "");
            JSONArray ps = j.getJSONArray("prayers");
            for (int k = 0; k < ps.length(); k++) {
                JSONObject pj = ps.getJSONObject(k);
                Prayer p = new Prayer();
                p.key = pj.getString("key");
                p.name = pj.getString("name");
                p.at = pj.getLong("at");
                p.time = pj.optString("time", "");
                p.iq = pj.optLong("iq", 0);
                day.prayers.add(p);
            }
            JSONObject vj = j.optJSONObject("verse");
            if (vj != null) {
                Verse v = new Verse();
                v.text = vj.optString("text", "");
                v.ref = vj.optString("ref", "");
                v.pk = vj.optString("pk", "");
                v.surah = vj.optInt("surah", 0);
                v.ayah = vj.optInt("ayah", 0);
                day.verse = v.text.isEmpty() ? null : v;
            }
            days.add(day);
        }
    }

    private static String[] parts(@Nullable JSONObject o) {
        if (o == null) return null;
        return new String[] {o.optString("d"), o.optString("m"), o.optString("y")};
    }

    @Nullable
    static WidgetData parse(@Nullable String json) {
        if (json == null || json.isEmpty()) return null;
        try {
            JSONObject o = new JSONObject(json);
            int v = o.optInt("v", 0);
            if (v != 1 && v != 2) return null;
            return new WidgetData(o);
        } catch (Exception e) {
            return null;
        }
    }

    @Nullable
    static WidgetData load(Context context) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return parse(p.getString(KEY_SNAPSHOT, ""));
    }

    static void save(Context context, String json) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(KEY_SNAPSHOT, json == null ? "" : json).apply();
    }

    /** إعدادات نسخة: الخاصة إن وُجدت، وإلا الافتراضية. */
    JSONObject config(int widgetId) {
        JSONObject c = configs.optJSONObject(String.valueOf(widgetId));
        return c != null ? c : options;
    }

    static String dayKey(long millis) {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        return f.format(new Date(millis));
    }

    @Nullable
    Day day(String key) {
        for (Day d : days) if (d.date.equals(key)) return d;
        return null;
    }

    /** الأيام المتبقية في اللقطة بعد اليوم (للتنبيه قبل النفاد). */
    int daysLeft(long now) {
        String today = dayKey(now);
        int n = 0;
        boolean seen = false;
        for (Day d : days) {
            if (d.date.equals(today)) seen = true;
            else if (seen) n++;
        }
        return seen ? n : -1;
    }

    /* ─────────────── الحالة في لحظة ─────────────── */

    enum Phase { NEXT, NOW, IQAMA }

    static final class State {
        Day today;
        /** اليوم الذي تُعرض آيته وهجريّه (اليوم دائماً). */
        Day shown;
        Phase phase = Phase.NEXT;
        /** الصلاة المعروضة: القادمة، أو الحاضرة في NOW/IQAMA. */
        Prayer prayer;
        /** بداية الفترة (الصلاة السابقة) لشريط التقدّم. */
        long from;
        /** موعد الحدث التالي في العدّ (الأذان أو الإقامة). */
        long target;
        /** اللحظة التي تتغيّر فيها الحالة (لضبط منبّه التحديث). */
        long changeAt;
        String hijri = "";
        String[] hp;
        int daysLeft;

        float progress(long now) {
            if (target <= from) return 0f;
            return Math.max(0f, Math.min(1f, (now - from) / (float) (target - from)));
        }
    }

    /** الصلوات الخمس من اليوم وغده بالترتيب (بلا الشروق). */
    private List<Prayer> timeline(int todayIndex) {
        List<Prayer> out = new ArrayList<>();
        for (int i = Math.max(0, todayIndex - 1); i <= Math.min(days.size() - 1, todayIndex + 1); i++) {
            for (Prayer p : days.get(i).prayers) if (!"sunrise".equals(p.key)) out.add(p);
        }
        return out;
    }

    @Nullable
    State state(long now) {
        String key = dayKey(now);
        int idx = -1;
        for (int i = 0; i < days.size(); i++) if (days.get(i).date.equals(key)) { idx = i; break; }
        if (idx < 0) return null;
        State s = new State();
        s.today = days.get(idx);
        s.shown = s.today;
        s.daysLeft = days.size() - 1 - idx;
        List<Prayer> line = timeline(idx);

        Prayer current = null;
        Prayer next = null;
        Prayer prev = null;
        for (Prayer p : line) {
            if (p.at <= now) { current = p; }
            else { next = p; break; }
        }
        for (Prayer p : line) {
            if (current != null && p.at < current.at) prev = p;
        }
        if (current != null) {
            long nowEnd = current.iq > current.at
                    ? Math.max(current.iq, current.at + 60_000L)
                    : current.at + NOW_WINDOW_MS;
            if (now < nowEnd) {
                s.prayer = current;
                boolean iqPending = current.iq > now;
                s.phase = iqPending ? Phase.IQAMA : Phase.NOW;
                s.from = current.at;
                s.target = iqPending ? current.iq : nowEnd;
                s.changeAt = iqPending ? current.iq : nowEnd;
                if (current.iq > current.at && !iqPending) {
                    // بعد الإقامة مباشرة: «أُقيمت الصلاة» حتى نهاية النافذة.
                    s.phase = Phase.NOW;
                }
                if (next != null && s.changeAt > next.at) s.changeAt = next.at;
            }
        }
        if (s.prayer == null) {
            if (next == null) return withHijri(s, now);
            s.prayer = next;
            s.phase = Phase.NEXT;
            s.from = current != null ? current.at : (prev != null ? prev.at : now);
            s.target = next.at;
            s.changeAt = next.at;
        }
        return withHijri(s, now);
    }

    private State withHijri(State s, long now) {
        Day d = s.today;
        boolean evening = d.hijriFrom > 0 && now >= d.hijriFrom && d.hijriEvening != null
                && !d.hijriEvening.isEmpty();
        s.hijri = evening ? d.hijriEvening : d.hijri;
        s.hp = evening && d.hpEvening != null ? d.hpEvening : d.hp;
        return s;
    }

    /** منتصف الليل التالي (ms). */
    static long nextMidnight(long now) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(now);
        c.add(Calendar.DAY_OF_YEAR, 1);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 1);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    boolean optBool(JSONObject cfg, String key, boolean fb) {
        return cfg.has(key) ? cfg.optBoolean(key, fb) : options.optBoolean(key, fb);
    }

    String optString(JSONObject cfg, String key, String fb) {
        String v = cfg.optString(key, "");
        if (!v.isEmpty()) return v;
        v = options.optString(key, "");
        return v.isEmpty() ? fb : v;
    }

    /** وضع العدّ: الإصدار ١ كان منطقياً (true ← بالدقائق). */
    String countdownMode(JSONObject cfg) {
        Object v = cfg.opt("countdown");
        if (v == null) v = options.opt("countdown");
        if (v instanceof Boolean) return ((Boolean) v) ? "minutes" : "off";
        if ("seconds".equals(v) || "off".equals(v) || "minutes".equals(v)) return (String) v;
        return "minutes";
    }

    int opacity(JSONObject cfg) {
        int v = cfg.has("opacity") ? cfg.optInt("opacity", 100) : options.optInt("opacity", 100);
        return Math.max(0, Math.min(100, v));
    }
}
