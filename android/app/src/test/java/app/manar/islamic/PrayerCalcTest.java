package app.manar.islamic;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Scanner;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/**
 * تطابق {@link PrayerCalc} مع مكتبة adhan في الويب. القيم المرجعية يولّدها
 * {@code tests/unit/prayer-golden.test.ts} من {@code computePrayerTimes} نفسها.
 * المعيار: لا فرق يتجاوز دقيقة واحدة في أي وقت، والغالبية العظمى مطابقة تماماً.
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34)
public class PrayerCalcTest {

    private final TimeZone original = TimeZone.getDefault();

    @After
    public void restore() {
        TimeZone.setDefault(original);
    }

    static JSONObject golden() throws Exception {
        try (InputStream in = PrayerCalcTest.class.getClassLoader().getResourceAsStream("prayer/golden.json");
             Scanner s = new Scanner(in, StandardCharsets.UTF_8.name()).useDelimiter("\\A")) {
            return new JSONObject(s.next());
        }
    }

    static PrayerCalc.Params params(JSONObject spec) {
        PrayerCalc.Params p = new PrayerCalc.Params();
        p.method = spec.optString("method", "Other");
        p.fajrAngle = spec.optDouble("fajrAngle", 0);
        p.ishaAngle = spec.optDouble("ishaAngle", 0);
        p.ishaInterval = spec.optInt("ishaInterval", 0);
        p.maghribAngle = spec.optDouble("maghribAngle", 0);
        p.shadow = spec.optInt("shadow", 1);
        p.rounding = spec.optString("rounding", "nearest");
        p.shafaq = spec.optString("shafaq", "general");
        JSONArray adj = spec.optJSONArray("adj");
        for (int i = 0; i < 6 && adj != null; i++) p.adj[i] = adj.optDouble(i, 0);
        return p;
    }

    @Test
    public void matchesAdhanJs() throws Exception {
        JSONObject g = golden();
        JSONArray dates = g.getJSONArray("dates");
        JSONArray cities = g.getJSONArray("cities");
        int total = 0, exact = 0;
        long worst = 0;
        String worstAt = "";
        for (int c = 0; c < cities.length(); c++) {
            JSONObject city = cities.getJSONObject(c);
            TimeZone.setDefault(TimeZone.getTimeZone(city.getString("tz")));
            JSONObject spec = city.getJSONObject("spec");
            PrayerCalc.Params base = params(spec);
            JSONArray ramadan = city.getJSONArray("ramadan");
            JSONArray times = city.getJSONArray("times");
            for (int i = 0; i < dates.length(); i++) {
                String[] ymd = dates.getString(i).split("-");
                PrayerCalc.Params p = base;
                if (spec.optBoolean("ramadanIsha") && contains(ramadan, i)) {
                    p = base.copy();
                    p.ishaInterval = 120;
                }
                long[] got = PrayerCalc.compute(spec.getDouble("lat"), spec.getDouble("lng"),
                        PrayerCalc.LDate.noon(Integer.parseInt(ymd[0]), Integer.parseInt(ymd[1]) - 1,
                                Integer.parseInt(ymd[2])), p);
                JSONArray want = times.getJSONArray(i);
                for (int k = 0; k < 6; k++) {
                    total++;
                    if (want.isNull(k)) {
                        assertEquals(city.getString("name") + " " + dates.getString(i), Long.MIN_VALUE, got[k]);
                        exact++;
                        continue;
                    }
                    long diff = Math.abs(got[k] - want.getLong(k));
                    if (diff == 0) exact++;
                    if (diff > worst) {
                        worst = diff;
                        worstAt = city.getString("name") + " " + dates.getString(i) + " " + PrayerCalc.KEYS[k];
                    }
                }
            }
        }
        System.out.println("PrayerCalc: " + exact + "/" + total + " exact, worst " + worst + "ms at " + worstAt);
        assertTrue("worst " + worst + "ms at " + worstAt, worst <= 60_000);
        assertTrue("exact " + exact + "/" + total, exact >= total * 0.99);
    }

    private static boolean contains(JSONArray a, int v) {
        for (int i = 0; i < a.length(); i++) if (a.optInt(i) == v) return true;
        return false;
    }
}
