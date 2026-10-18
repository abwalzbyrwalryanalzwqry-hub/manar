package app.manar.islamic;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.util.Base64;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.RemoteViews;

import androidx.test.core.app.ApplicationProvider;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.file.Files;

/**
 * يرسم الويدجتات فعلياً (RemoteViews ← View ← PNG) بحزمة فن حقيقية مولّدة من
 * الويب. يعمل حين يُمرَّر WIDGET_LAB_DIR (مجلد فيه snapshot.json وindex.json
 * وصفائح s*.png)، وإلا يُتخطّى. الصور في {@code <lab>/render} للمراجعة البصرية.
 */
@RunWith(RobolectricTestRunner.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = 34, qualifiers = "w411dp-h891dp-xxhdpi")
public class WidgetRenderTest {

    private static String read(File f) throws Exception {
        return new String(Files.readAllBytes(f.toPath()), "UTF-8");
    }

    @Test
    public void renderGallery() throws Exception {
        String tz = System.getenv("WIDGET_LAB_TZ");
        java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone(tz == null || tz.isEmpty() ? "UTC" : tz));
        String lab = System.getProperty("widgetLab", "");
        Context ctx = ApplicationProvider.getApplicationContext();
        File dir;
        String snap;
        if (lab != null && !lab.isEmpty()) {
            // مختبر محلي: حزمة فن حقيقية بخطوط التطبيق.
            dir = new File(lab);
            String index = read(new File(dir, "index.json"));
            JSONObject ij = new JSONObject(index);
            String hash = ij.getString("hash");
            for (int i = 0; i < ij.getInt("sheets"); i++) {
                byte[] png = Files.readAllBytes(new File(dir, "s" + i + ".png").toPath());
                assertTrue(WidgetArt.putSheet(ctx, hash, i, Base64.encodeToString(png, Base64.NO_WRAP)));
            }
            assertTrue(WidgetArt.commit(ctx, hash, index));
            assertNotNull(WidgetArt.get(ctx));
            snap = read(new File(dir, "snapshot.json"));
        } else {
            // CI: بلا حزمة فن (احتياط خط النظام) — يكفي لضمان أن كل تخطيط يُنفخ ويُرسم.
            dir = new File(System.getProperty("java.io.tmpdir"), "manar-widget-render");
            try (java.io.InputStream in = getClass().getClassLoader()
                    .getResourceAsStream("widget/snapshot.json")) {
                assertNotNull(in);
                snap = new String(in.readAllBytes(), "UTF-8");
            }
        }

        JSONObject base = new JSONObject(snap);
        JSONArray days = base.getJSONArray("days");
        JSONArray prayers = days.getJSONObject(0).getJSONArray("prayers");
        long dhuhr = prayers.getJSONObject(2).getLong("at");
        long isha = prayers.getJSONObject(5).getLong("at");

        File out = new File(dir, "render");
        //noinspection ResultOfMethodCallIgnored
        out.mkdirs();
        String scenarios = System.getProperty("widgetScenarios", "");
        String[][] list = {
                // name, kind, w, h, offsetFrom, theme, countdown
                {"hub_4x2_night", "hub", "320", "170", "dhuhr-5000000", "night", "minutes"},
                {"hub_4x3_sand", "hub", "320", "260", "dhuhr-600000", "sand", "minutes"},
                {"hub_4x4_emerald", "hub", "320", "380", "dhuhr-5000000", "emerald", "minutes"},
                {"hub_4x1_clear", "hub", "320", "70", "dhuhr-2000000", "clear", "minutes"},
                {"hub_3x2_iqama", "hub", "240", "170", "isha+120000", "night", "minutes"},
                {"hub_4x2_seconds", "hub", "320", "170", "dhuhr-5000000", "night", "seconds"},
                {"next_2x2_night", "next", "160", "170", "dhuhr-5000000", "night", "minutes"},
                {"next_2x1_sand", "next", "160", "70", "dhuhr-5000000", "sand", "minutes"},
                {"day_4x1_night", "day", "320", "70", "dhuhr-5000000", "night", "minutes"},
                {"day_4x2_emerald", "day", "320", "170", "dhuhr-5000000", "emerald", "minutes"},
                {"verse_4x2_sand", "verse", "320", "170", "dhuhr-5000000", "sand", "minutes"},
                {"azkar_4x2_night", "azkar", "320", "170", "dhuhr-5000000", "night", "minutes"},
                {"azkar_4x2_evening", "azkar", "320", "170", "isha+3600000", "emerald", "minutes"},
                {"tasbih_2x2_night", "tasbih", "160", "170", "dhuhr-5000000", "night", "minutes"},
                {"tasbih_2x2_sand", "tasbih", "160", "170", "dhuhr-5000000", "sand", "minutes"},
                {"prayed_4x1_night", "prayed", "320", "70", "dhuhr+3600000", "night", "minutes"},
                {"prayed_4x2_sand", "prayed", "320", "130", "dhuhr+3600000", "sand", "minutes"},
                {"hijri_2x2_emerald", "hijri", "160", "170", "dhuhr-5000000", "emerald", "minutes"},
                {"hijri_2x1_night", "hijri", "160", "70", "dhuhr-5000000", "night", "minutes"},
                {"quran_4x2_night", "quran", "320", "170", "dhuhr-5000000", "night", "minutes"},
                {"quran_4x1_sand", "quran", "320", "70", "dhuhr-5000000", "sand", "minutes"},
        };
        for (String[] sc : list) {
            if (!scenarios.isEmpty() && !scenarios.contains(sc[0])) continue;
            JSONObject s = new JSONObject(snap);
            s.getJSONObject("options").put("theme", sc[5]).put("countdown", sc[6]);
            WidgetData data = WidgetData.parse(s.toString());
            assertNotNull(data);
            long now = sc[4].startsWith("dhuhr") ? dhuhr + Long.parseLong(sc[4].substring(5))
                    : isha + Long.parseLong(sc[4].substring(4));
            render(ctx, out, sc[0], sc[1], Float.parseFloat(sc[2]), Float.parseFloat(sc[3]), data, now);
        }
    }

    static void render(Context ctx, File out, String name, String kind, float w, float h,
                       WidgetData data, long now) throws Exception {
        WidgetRender.Frame f = new WidgetRender.Frame(ctx, 1, kind, data, now, w, h);
        RemoteViews rv = WidgetRender.render(f);
        FrameLayout parent = new FrameLayout(ctx);
        View v = rv.apply(ctx, parent);
        float d = ctx.getResources().getDisplayMetrics().density;
        int wp = Math.round(w * d);
        int hp = Math.round(h * d);
        int pad = Math.round(16 * d);
        v.measure(View.MeasureSpec.makeMeasureSpec(wp, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(hp, View.MeasureSpec.EXACTLY));
        v.layout(0, 0, wp, hp);
        Bitmap b = Bitmap.createBitmap(wp + pad * 2, hp + pad * 2, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        c.drawColor(Color.rgb(96, 120, 140));
        c.translate(pad, pad);
        v.draw(c);
        try (FileOutputStream fo = new FileOutputStream(new File(out, name + ".png"))) {
            b.compress(Bitmap.CompressFormat.PNG, 100, fo);
        }
    }
}
