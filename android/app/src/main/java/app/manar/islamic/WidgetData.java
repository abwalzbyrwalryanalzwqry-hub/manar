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
        /** مولَّد أصلياً بعد نهاية اللقطة. */
        boolean generated;

        @Nullable Prayer get(String key) {
            for (Prayer p : prayers) if (p.key.equals(key)) return p;
            return null;
        }
    }

    /** ذكر من باب الصباح والمساء كما يحمله المحتوى الإضافي. */
    static final class Zikr {
        int id;
        String text;
        int repeat;
        boolean quran;
        String note;
        String pk;
    }

    static final class Tasbih {
        String id;
        String name;
        int count;
        int target;
    }

    static final class Khatmah {
        String title;
        String portion;
        float progress;
        boolean todayDone;
    }

    static final class LastRead {
        String label;
        String route;
    }

    final List<Zikr> azkarMorning = new ArrayList<>();
    final List<Zikr> azkarEvening = new ArrayList<>();
    int azkarChapter = 27;
    @Nullable Tasbih tasbih;
    @Nullable Khatmah khatmah;
    @Nullable LastRead lastRead;
    /** الصلوات المؤدّاة: اليوم ← المفاتيح. */
    final java.util.Map<String, java.util.Set<String>> prayed = new java.util.HashMap<>();

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
    /** الحساب الأصلي لما بعد اللقطة (null في اللقطات القديمة). */
    @Nullable final Calc calc;

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
        calc = Calc.parse(o.optJSONObject("calc"));
        parseExtras();
    }

    private void parseExtras() {
        JSONObject az = extras.optJSONObject("azkar");
        if (az != null) {
            azkarChapter = az.optInt("chapter", 27);
            zikrList(az.optJSONArray("morning"), azkarMorning);
            zikrList(az.optJSONArray("evening"), azkarEvening);
        }
        JSONObject t = extras.optJSONObject("tasbih");
        if (t != null && !t.optString("id").isEmpty()) {
            tasbih = new Tasbih();
            tasbih.id = t.optString("id");
            tasbih.name = t.optString("name", "");
            tasbih.count = Math.max(0, t.optInt("count", 0));
            tasbih.target = Math.max(0, t.optInt("target", 0));
        }
        JSONObject k = extras.optJSONObject("khatmah");
        if (k != null) {
            khatmah = new Khatmah();
            khatmah.title = k.optString("title", "");
            khatmah.portion = k.optString("portion", "");
            khatmah.progress = (float) Math.max(0, Math.min(1, k.optDouble("progress", 0)));
            khatmah.todayDone = k.optBoolean("todayDone", false);
        }
        JSONObject lr = extras.optJSONObject("lastRead");
        if (lr != null && !lr.optString("label").isEmpty()) {
            lastRead = new LastRead();
            lastRead.label = lr.optString("label");
            lastRead.route = lr.optString("route", "/quran");
        }
        JSONObject pr = extras.optJSONObject("prayed");
        if (pr != null) {
            java.util.Iterator<String> it = pr.keys();
            while (it.hasNext()) {
                String day = it.next();
                JSONArray a = pr.optJSONArray(day);
                if (a == null) continue;
                java.util.Set<String> set = new java.util.HashSet<>();
                for (int i = 0; i < a.length(); i++) set.add(a.optString(i));
                prayed.put(day, set);
            }
        }
    }

    private static void zikrList(@Nullable JSONArray a, List<Zikr> out) {
        if (a == null) return;
        for (int i = 0; i < a.length(); i++) {
            JSONObject z = a.optJSONObject(i);
            if (z == null || z.optString("text").isEmpty()) continue;
            Zikr x = new Zikr();
            x.id = z.optInt("id", 0);
            x.text = z.optString("text");
            x.repeat = Math.max(1, z.optInt("repeat", 1));
            x.quran = z.optBoolean("q", false);
            x.note = z.optString("note", "");
            x.pk = z.optString("pk", "");
            out.add(x);
        }
    }

    /** اليوم في اللقطة (أو null خارج نطاقها). */
    @Nullable
    Day dayAt(long now) {
        ensureDays(now);
        String key = dayKey(now);
        for (Day d : days) if (d.date.equals(key)) return d;
        return null;
    }

    /** المساء من العصر حتى الفجر (كـ azkarTimeNow في الويب)، وبالساعة احتياطاً. */
    boolean isEvening(long now) {
        Day d = dayAt(now);
        Prayer fajr = d == null ? null : d.get("fajr");
        Prayer asr = d == null ? null : d.get("asr");
        if (fajr == null || asr == null) {
            int h = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY);
            return h >= 15 || h < 4;
        }
        return now >= asr.at || now < fajr.at;
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
        ensureDays(now);
        String today = dayKey(now);
        if (calc != null && day(today) != null) return Math.max(0, daysBetween(today, calc.until));
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
        ensureDays(now);
        String key = dayKey(now);
        int idx = -1;
        for (int i = 0; i < days.size(); i++) if (days.get(i).date.equals(key)) { idx = i; break; }
        if (idx < 0) return null;
        State s = new State();
        s.today = days.get(idx);
        s.shown = s.today;
        s.daysLeft = calc != null ? Math.max(0, daysBetween(key, calc.until)) : days.size() - 1 - idx;
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

    /* ─────────────── أيام مولَّدة أصلياً بعد نهاية اللقطة ─────────────── */

    static final class HijriMark {
        String from;
        int d;
        int n;
        String m;
        /** اسم الشهر في التاريخ الكامل إن اختلف. */
        String mf;
        int y;
    }

    static final class Calc {
        double lat;
        double lng;
        PrayerCalc.Params params;
        boolean ramadanIsha;
        int[] iq = new int[5];
        int jumua;
        final List<HijriMark> hijri = new ArrayList<>();
        boolean atMaghrib;
        String until;

        @Nullable
        static Calc parse(@Nullable JSONObject o) {
            if (o == null) return null;
            JSONObject spec = o.optJSONObject("spec");
            JSONArray hj = o.optJSONArray("hijri");
            String until = o.optString("until", "");
            if (spec == null || hj == null || hj.length() == 0 || until.isEmpty()) return null;
            Calc c = new Calc();
            c.lat = spec.optDouble("lat", Double.NaN);
            c.lng = spec.optDouble("lng", Double.NaN);
            if (Double.isNaN(c.lat) || Double.isNaN(c.lng)) return null;
            PrayerCalc.Params p = new PrayerCalc.Params();
            p.method = spec.optString("method", "Other");
            p.fajrAngle = spec.optDouble("fajrAngle", 0);
            p.ishaAngle = spec.optDouble("ishaAngle", 0);
            p.ishaInterval = spec.optInt("ishaInterval", 0);
            p.maghribAngle = spec.optDouble("maghribAngle", 0);
            p.shadow = spec.optInt("shadow", 1) == 2 ? 2 : 1;
            p.rounding = spec.optString("rounding", "nearest");
            p.shafaq = spec.optString("shafaq", "general");
            JSONArray adj = spec.optJSONArray("adj");
            for (int i = 0; i < 6 && adj != null; i++) p.adj[i] = adj.optDouble(i, 0);
            c.params = p;
            c.ramadanIsha = spec.optBoolean("ramadanIsha", false);
            JSONArray iq = o.optJSONArray("iq");
            for (int i = 0; i < 5 && iq != null; i++) c.iq[i] = Math.max(0, iq.optInt(i, 0));
            c.jumua = Math.max(0, o.optInt("jumua", 0));
            for (int i = 0; i < hj.length(); i++) {
                JSONObject h = hj.optJSONObject(i);
                if (h == null) continue;
                HijriMark m = new HijriMark();
                m.from = h.optString("from", "");
                m.d = h.optInt("d", 1);
                m.n = h.optInt("n", 1);
                m.m = h.optString("m", "");
                m.mf = h.optString("mf", m.m);
                m.y = h.optInt("y", 0);
                if (!m.from.isEmpty()) c.hijri.add(m);
            }
            if (c.hijri.isEmpty()) return null;
            c.atMaghrib = o.optBoolean("hm", false);
            c.until = until;
            return c;
        }

        /** الهجري ليوم: {يوم، رقم الشهر، اسم الشهر، السنة، اسمه في التاريخ الكامل}، أو null خارج الجدول. */
        @Nullable
        Object[] hijriOf(String key) {
            HijriMark at = null;
            for (HijriMark m : hijri) if (m.from.compareTo(key) <= 0) at = m;
            if (at == null) return null;
            int day = at.d + daysBetween(at.from, key);
            if (day > 30) return null;
            return new Object[] {day, at.n, at.m, at.y, at.mf};
        }
    }

    static final String[] WEEKDAYS = {"الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"};
    private static final String[] NAMES = {"الفجر", "الشروق", "الظهر", "العصر", "المغرب", "العشاء"};

    /** أيام بين مفتاحين `YYYY-MM-DD` (b − a). */
    static int daysBetween(String a, String b) {
        return (int) (epochDay(b) - epochDay(a));
    }

    static long epochDay(String key) {
        String[] p = key.split("-");
        return PrayerCalc.daysFromCivil(Long.parseLong(p[0]), Long.parseLong(p[1]), Long.parseLong(p[2]));
    }

    private String digits(String s) {
        if (latinDigits) return s;
        StringBuilder b = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            b.append(ch >= '0' && ch <= '9' ? (char) ('٠' + (ch - '0')) : ch);
        }
        return b.toString();
    }

    /** وقت بصيغة اللقطة: «٤:٤٢ ص» أو «١٦:٠٥». */
    String clock(long at) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(at);
        int h = c.get(Calendar.HOUR_OF_DAY);
        int m = c.get(Calendar.MINUTE);
        int shown = clock24 ? h : ((h + 11) % 12) + 1;
        String t = digits(shown + ":" + (m < 10 ? "0" : "") + m);
        return clock24 ? t : t + " " + (h < 12 ? "ص" : "م");
    }

    private void setHijri(Day day, Object[] h) {
        String d = digits(String.valueOf(h[0]));
        String y = digits(String.valueOf(h[3]));
        day.hp = new String[] {d, (String) h[2], y};
        day.hijri = d + " " + h[4] + " " + y + " " + WidgetWords.HIJRI_SUFFIX;
    }

    /** يولّد يوماً من الحساب الأصلي، أو null إن تعذّر (خارج المدى). */
    @Nullable
    Day generate(String key) {
        if (calc == null || key.compareTo(calc.until) > 0) return null;
        Object[] h = calc.hijriOf(key);
        if (h == null) return null;
        String[] ymd = key.split("-");
        int y = Integer.parseInt(ymd[0]), mo = Integer.parseInt(ymd[1]) - 1, dd = Integer.parseInt(ymd[2]);
        PrayerCalc.Params p = calc.params;
        if (calc.ramadanIsha && ((Integer) h[1]) == 9) {
            p = p.copy();
            p.ishaInterval = 120;
        }
        long[] t = PrayerCalc.compute(calc.lat, calc.lng, PrayerCalc.LDate.noon(y, mo, dd), p);
        for (long v : t) if (v == Long.MIN_VALUE) return null;
        Calendar c = Calendar.getInstance();
        c.clear();
        c.set(y, mo, dd, 12, 0, 0);
        int dow = c.get(Calendar.DAY_OF_WEEK) - 1;
        boolean friday = dow == 5;
        Day day = new Day();
        day.date = key;
        day.weekday = WEEKDAYS[dow];
        setHijri(day, h);
        if (calc.atMaghrib) {
            c.add(Calendar.DAY_OF_MONTH, 1);
            Object[] next = calc.hijriOf(dayKey(c.getTimeInMillis()));
            if (next != null) {
                Day tmp = new Day();
                setHijri(tmp, next);
                day.hijriFrom = t[4];
                day.hijriEvening = tmp.hijri;
                day.hpEvening = tmp.hp;
            }
        }
        day.season = "";
        for (int i = 0; i < 6; i++) {
            Prayer pr = new Prayer();
            pr.key = PrayerCalc.KEYS[i];
            pr.name = i == 2 && friday ? "الجمعة" : NAMES[i];
            pr.at = t[i];
            pr.time = clock(t[i]);
            if (i != 1) {
                int idx = i == 0 ? 0 : i - 1;
                int off = i == 2 && friday ? calc.jumua : calc.iq[idx];
                if (off > 0) pr.iq = t[i] + off * 60_000L;
            }
            day.prayers.add(pr);
        }
        /* آيات اللقطة بالتناوب: كلها مرسومة مسبقاً بخط المصحف. */
        List<Verse> verses = new ArrayList<>();
        for (Day d : days) if (d.verse != null && d.date.compareTo(key) < 0 && !d.generated) verses.add(d.verse);
        if (!verses.isEmpty()) day.verse = verses.get((int) Math.floorMod(epochDay(key), (long) verses.size()));
        day.generated = true;
        return day;
    }

    /** يضمن وجود أمس واليوم والغد في القائمة بعد نهاية اللقطة. */
    void ensureDays(long now) {
        if (calc == null || days.isEmpty()) return;
        String last = days.get(days.size() - 1).date;
        String today = dayKey(now);
        if (today.compareTo(last) < 0) return;
        boolean added = false;
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(now);
        c.add(Calendar.DAY_OF_MONTH, -1);
        for (int i = 0; i < 3; i++) {
            String key = dayKey(c.getTimeInMillis());
            if (key.compareTo(last) > 0 && day(key) == null) {
                Day d = generate(key);
                if (d != null) {
                    days.add(d);
                    added = true;
                }
            }
            c.add(Calendar.DAY_OF_MONTH, 1);
        }
        if (added) java.util.Collections.sort(days, (a, b) -> a.date.compareTo(b.date));
    }
}
