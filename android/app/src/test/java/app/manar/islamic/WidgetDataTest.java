package app.manar.islamic;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/** منطق حالة الويدجت (يطابق src/lib/widgets/state.ts واختباراته). */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34)
public class WidgetDataTest {

    private WidgetData data;
    private JSONArray today;

    @Before
    public void load() throws Exception {
        // اللقطة المرجعية مولّدة بتوقيت UTC.
        java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("UTC"));
        String snap;
        try (java.io.InputStream in = getClass().getClassLoader()
                .getResourceAsStream("widget/snapshot.json")) {
            snap = new String(in.readAllBytes(), "UTF-8");
        }
        data = WidgetData.parse(snap);
        assertNotNull(data);
        today = new JSONObject(snap).getJSONArray("days").getJSONObject(0).getJSONArray("prayers");
    }

    private long at(int i) throws Exception {
        return today.getJSONObject(i).getLong("at");
    }

    @Test
    public void nextPrayerSkipsSunrise() throws Exception {
        WidgetData.State s = data.state(at(2) - 3_600_000L);
        assertNotNull(s);
        assertEquals(WidgetData.Phase.NEXT, s.phase);
        assertEquals("dhuhr", s.prayer.key);
        assertEquals(at(0), s.from);
        float p = s.progress(at(2) - 3_600_000L);
        assertTrue(p > 0f && p < 1f);
    }

    @Test
    public void nowWindowThenNext() throws Exception {
        assertEquals(WidgetData.Phase.NOW, data.state(at(3) + 60_000L).phase);
        WidgetData.State later = data.state(at(3) + WidgetData.NOW_WINDOW_MS + 1000);
        assertEquals(WidgetData.Phase.NEXT, later.phase);
        assertEquals("maghrib", later.prayer.key);
    }

    @Test
    public void iqamaCountdown() throws Exception {
        JSONObject isha = today.getJSONObject(5);
        if (!isha.has("iq")) return; // اللقطة بلا إقامة
        WidgetData.State s = data.state(at(5) + 60_000L);
        assertEquals(WidgetData.Phase.IQAMA, s.phase);
        assertEquals(isha.getLong("iq"), s.target);
    }

    @Test
    public void outOfRangeHasNoState() throws Exception {
        assertNull(data.state(at(5) + 10L * 24 * 3_600_000L));
    }

    @Test
    public void arabicCountdownPhrases() {
        assertEquals("بعد ساعة واحدة و٢٤ دقيقة", WidgetWords.afterPhrase(84 * 60_000L, false));
        assertEquals("بعد ساعتين", WidgetWords.afterPhrase(120 * 60_000L, false));
        assertEquals("بعد ١٠ دقائق", WidgetWords.afterPhrase(570_000L, false));
        assertEquals("بعد أقل من دقيقة", WidgetWords.afterPhrase(30_000L, false));
        assertEquals("بعد 5 دقائق", WidgetWords.afterPhrase(300_000L, true));
    }

    @Test
    public void corruptSnapshotIsRejected() {
        assertNull(WidgetData.parse("{"));
        assertNull(WidgetData.parse(""));
    }
}
