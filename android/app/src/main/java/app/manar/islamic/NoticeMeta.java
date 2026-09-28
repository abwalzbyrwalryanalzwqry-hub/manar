package app.manar.islamic;

import androidx.annotation.Nullable;

import org.json.JSONObject;

/**
 * ما يرافق إشعار الحدث غير نصّه: أين يفتح النقر، وأي صلاةٍ يسجّلها «صلّيت»،
 * وهل فيه «ذكّرني لاحقاً». يُحمَل نصّاً (JSON) في الحدث المحفوظ وفي المنبّه،
 * فلا يتغيّر شكل {@link AdhanScheduler.Event} مع كل ميزة.
 */
final class NoticeMeta {

    static final NoticeMeta NONE = new NoticeMeta("", "", "", 0);

    /** مسار داخل التطبيق يبدأ بـ«/» (/prayer، /azkar …)، أو "". */
    final String route;
    /** مفتاح الصلاة (fajr…isha) لزرّ «صلّيت»، أو "". */
    final String prayer;
    /** يوم الصلاة بصيغة سجل النشاط (2026-09-23). */
    final String prayedDay;
    /** دقائق «ذكّرني لاحقاً» (٠ = بلا زرّ). */
    final int snooze;

    NoticeMeta(String route, String prayer, String prayedDay, int snooze) {
        this.route = safeRoute(route);
        this.prayer = prayer == null ? "" : prayer;
        this.prayedDay = prayedDay == null ? "" : prayedDay;
        this.snooze = Math.max(0, Math.min(120, snooze));
    }

    /** مسار داخلي فقط: لا مخطّط ولا نطاق، فلا يفتح الإشعار رابطاً خارجياً. */
    static String safeRoute(@Nullable String r) {
        if (r == null || r.isEmpty() || r.charAt(0) != '/' || r.startsWith("//")) return "";
        if (r.contains(":") || r.contains("\\")) return "";
        return r.length() > 120 ? "" : r;
    }

    boolean canMarkPrayed() {
        return !prayer.isEmpty() && prayedDay.matches("\\d{4}-\\d{2}-\\d{2}");
    }

    static NoticeMeta parse(@Nullable String json) {
        if (json == null || json.isEmpty()) return NONE;
        try {
            JSONObject o = new JSONObject(json);
            return new NoticeMeta(
                    o.optString("route", ""),
                    o.optString("prayer", ""),
                    o.optString("prayedDay", ""),
                    o.optInt("snooze", 0));
        } catch (Exception e) {
            return NONE;
        }
    }

    String toJson() {
        try {
            JSONObject o = new JSONObject();
            if (!route.isEmpty()) o.put("route", route);
            if (!prayer.isEmpty()) o.put("prayer", prayer);
            if (!prayedDay.isEmpty()) o.put("prayedDay", prayedDay);
            if (snooze > 0) o.put("snooze", snooze);
            return o.length() == 0 ? "" : o.toString();
        } catch (Exception e) {
            return "";
        }
    }
}
