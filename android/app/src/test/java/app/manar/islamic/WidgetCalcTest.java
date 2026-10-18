package app.manar.islamic;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
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
 * الأيام المولَّدة أصلياً بعد نهاية لقطة قصيرة تطابق أيام لقطة طويلة بناها الويب
 * (المواقيت والإقامة واسم الجمعة والهجري وهجري المساء وعشاء رمضان). الملف
 * المرجعي يكتبه {@code tests/unit/widget-calc.test.ts}.
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34)
public class WidgetCalcTest {

    private final TimeZone original = TimeZone.getDefault();

    @After
    public void restore() {
        TimeZone.setDefault(original);
    }

    private static JSONObject fixture() throws Exception {
        try (InputStream in = WidgetCalcTest.class.getClassLoader().getResourceAsStream("widget/extend.json");
             Scanner s = new Scanner(in, StandardCharsets.UTF_8.name()).useDelimiter("\\A")) {
            return new JSONObject(s.next());
        }
    }

    @Test
    public void generatedDaysMatchWeb() throws Exception {
        JSONObject f = fixture();
        TimeZone.setDefault(TimeZone.getTimeZone(f.getString("tz")));
        WidgetData data = WidgetData.parse(f.getJSONObject("short").toString());
        assertNotNull(data);
        assertNotNull(data.calc);
        JSONArray full = f.getJSONObject("full").getJSONArray("days");
        int ramadanIsha = 0;
        for (int i = 10; i < full.length(); i++) {
            JSONObject want = full.getJSONObject(i);
            String key = want.getString("date");
            WidgetData.Day got = data.generate(key);
            assertNotNull(key, got);
            assertEquals(key, want.getString("weekday"), got.weekday);
            assertEquals(key, want.getString("hijri"), got.hijri);
            JSONObject hp = want.getJSONObject("hp");
            assertEquals(key, hp.getString("d"), got.hp[0]);
            assertEquals(key, hp.getString("m"), got.hp[1]);
            assertEquals(key, hp.getString("y"), got.hp[2]);
            assertEquals(key, want.getString("hijriEvening"), got.hijriEvening);
            assertEquals(key, want.getLong("hijriFrom"), got.hijriFrom);
            JSONArray ps = want.getJSONArray("prayers");
            assertEquals(ps.length(), got.prayers.size());
            for (int k = 0; k < ps.length(); k++) {
                JSONObject wp = ps.getJSONObject(k);
                WidgetData.Prayer gp = got.prayers.get(k);
                String at = key + " " + wp.getString("key");
                assertEquals(at, wp.getString("key"), gp.key);
                assertEquals(at, wp.getString("name"), gp.name);
                assertEquals(at, wp.getLong("at"), gp.at);
                assertEquals(at, wp.getString("time"), gp.time);
                assertEquals(at, wp.optLong("iq", 0), gp.iq);
            }
            if ("رمضان".equals(hp.getString("m"))) {
                WidgetData.Prayer m = got.get("maghrib"), isha = got.get("isha");
                if (isha.at - m.at == 120 * 60_000L) ramadanIsha++;
            }
        }
        assertTrue("رمضان في الأيام المولَّدة", ramadanIsha > 0);
    }

    @Test
    public void stateContinuesAfterSnapshotEnds() throws Exception {
        JSONObject f = fixture();
        TimeZone.setDefault(TimeZone.getTimeZone(f.getString("tz")));
        WidgetData data = WidgetData.parse(f.getJSONObject("short").toString());
        JSONObject day25 = f.getJSONObject("full").getJSONArray("days").getJSONObject(25);
        long dhuhr = day25.getJSONArray("prayers").getJSONObject(2).getLong("at");
        WidgetData.State s = data.state(dhuhr - 30 * 60_000L);
        assertNotNull(s);
        assertEquals(day25.getString("date"), s.today.date);
        assertEquals("dhuhr", s.prayer.key);
        assertEquals(dhuhr, s.target);
        /* المدى: ٦٠ يوماً من بداية اللقطة، فلا تنبيه «افتح منار» بعد. */
        assertTrue(s.daysLeft > 4);
        /* بعد نهاية المدى: لا حالة. */
        assertNull(data.state(dhuhr + 60L * 86_400_000L));
    }

    @Test
    public void lastSnapshotDayGetsTomorrowFajr() throws Exception {
        JSONObject f = fixture();
        TimeZone.setDefault(TimeZone.getTimeZone(f.getString("tz")));
        WidgetData data = WidgetData.parse(f.getJSONObject("short").toString());
        JSONArray days = f.getJSONObject("full").getJSONArray("days");
        long isha = days.getJSONObject(9).getJSONArray("prayers").getJSONObject(5).getLong("at");
        long fajr = days.getJSONObject(10).getJSONArray("prayers").getJSONObject(0).getLong("at");
        WidgetData.State s = data.state(isha + 3 * 3_600_000L);
        assertNotNull(s);
        assertEquals("fajr", s.prayer.key);
        assertEquals(fajr, s.target);
    }
}
