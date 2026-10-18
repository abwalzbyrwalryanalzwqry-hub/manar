package app.manar.islamic;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapRegionDecoder;
import android.graphics.Rect;
import android.os.Build;
import android.util.Base64;
import android.util.LruCache;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/**
 * حزمة «فنّ الويدجت»: كلمات وأرقام وفقرات مرسومة بخطوط التطبيق (ثمانية، خط
 * المصحف) يرسمها الويب على canvas ويسلّمها صوراً (src/lib/widgets/art.ts).
 *
 * لماذا صور؟ المُشغّل يرسم الويدجت في عمليته ولا يحمّل خطاً مخصّصاً في
 * {@code TextView}، وترخيص ثمانية يمنع تحويل ملفاته. فنركّب الأسطر من صور
 * الكلمات (التشكيل داخل الكلمة، ولا وصل بين كلمتين) بلا أي ملف خط.
 *
 * التخزين: {@code files/widget-art/<hash>/s<i>.png} و{@code index.json}، ومؤشّر
 * الحزمة النافذة في التفضيلات. الصفائح تُقرأ مناطقَ ({@link BitmapRegionDecoder})
 * فلا تُفكّ صفيحة كاملة في الذاكرة.
 */
final class WidgetArt {

    /** مطابق لـ ART_SPEC_VERSION في art-spec.ts. */
    static final int SPEC = 3;

    private static final String PREFS = "manar_widget_art";
    private static final String KEY_HASH = "hash";
    private static final String DIR = "widget-art";

    static final class Line {
        float px;
        int h;
        int base;
        float space;
        final Map<String, float[]> g = new HashMap<>();
    }

    final String hash;
    final boolean thmanyah;
    private final File dir;
    private final Map<String, Line> lines = new HashMap<>();
    private final Map<String, int[]> paras = new HashMap<>();
    private final BitmapRegionDecoder[] decoders;
    private final LruCache<String, Bitmap> cache = new LruCache<String, Bitmap>(6 * 1024 * 1024) {
        @Override
        protected int sizeOf(String key, Bitmap value) {
            return value.getByteCount();
        }
    };

    private static WidgetArt current;

    private WidgetArt(File dir, String hash, JSONObject index) throws Exception {
        this.dir = dir;
        this.hash = hash;
        this.thmanyah = "thmanyah".equals(index.optString("sig"));
        JSONObject ls = index.getJSONObject("lines");
        for (Iterator<String> it = ls.keys(); it.hasNext(); ) {
            String id = it.next();
            JSONObject o = ls.getJSONObject(id);
            Line l = new Line();
            l.px = (float) o.getDouble("px");
            l.h = o.getInt("h");
            l.base = o.getInt("base");
            l.space = (float) o.getDouble("space");
            JSONObject g = o.getJSONObject("g");
            for (Iterator<String> gi = g.keys(); gi.hasNext(); ) {
                String k = gi.next();
                JSONArray a = g.getJSONArray(k);
                l.g.put(k, new float[] {
                        a.getInt(0), a.getInt(1), a.getInt(2), a.getInt(3),
                        (float) a.getDouble(4), a.getInt(5)});
            }
            lines.put(id, l);
        }
        JSONObject ps = index.optJSONObject("paras");
        if (ps != null) {
            for (Iterator<String> it = ps.keys(); it.hasNext(); ) {
                String k = it.next();
                JSONArray a = ps.getJSONArray(k);
                paras.put(k, new int[] {a.getInt(0), a.getInt(1), a.getInt(2), a.getInt(3), a.getInt(4)});
            }
        }
        int n = index.getInt("sheets");
        decoders = new BitmapRegionDecoder[n];
    }

    /** الحزمة النافذة، أو {@code null} إن لم تُرسم بعد (يُستعمل خط النظام). */
    static synchronized WidgetArt get(Context context) {
        String hash = prefs(context).getString(KEY_HASH, "");
        if (hash.isEmpty()) return null;
        if (current != null && current.hash.equals(hash)) return current;
        File dir = new File(new File(context.getFilesDir(), DIR), hash);
        try {
            String json = new String(readAll(new File(dir, "index.json")), StandardCharsets.UTF_8);
            JSONObject index = new JSONObject(json);
            if (index.optInt("v") != SPEC) return null;
            current = new WidgetArt(dir, hash, index);
            return current;
        } catch (Exception e) {
            return null;
        }
    }

    static String currentHash(Context context) {
        return prefs(context).getString(KEY_HASH, "");
    }

    /** يحفظ صفيحة في مجلد الحزمة الجديدة (لا تصير نافذة قبل {@link #commit}). */
    static boolean putSheet(Context context, String hash, int index, String base64) {
        if (!safeHash(hash) || index < 0 || index > 64) return false;
        File dir = new File(new File(context.getFilesDir(), DIR), hash);
        if (!dir.exists() && !dir.mkdirs()) return false;
        try (OutputStream out = new FileOutputStream(new File(dir, "s" + index + ".png"))) {
            out.write(Base64.decode(base64, Base64.DEFAULT));
            return true;
        } catch (IOException | IllegalArgumentException e) {
            return false;
        }
    }

    /** يجعل الحزمة نافذة إن اكتملت صفائحها، ويحذف ما سواها. */
    static synchronized boolean commit(Context context, String hash, String indexJson) {
        if (!safeHash(hash)) return false;
        File root = new File(context.getFilesDir(), DIR);
        File dir = new File(root, hash);
        try {
            JSONObject index = new JSONObject(indexJson);
            if (index.optInt("v") != SPEC || !hash.equals(index.optString("hash"))) return false;
            int n = index.getInt("sheets");
            for (int i = 0; i < n; i++) {
                if (!new File(dir, "s" + i + ".png").isFile()) return false;
            }
            try (OutputStream out = new FileOutputStream(new File(dir, "index.json"))) {
                out.write(indexJson.getBytes(StandardCharsets.UTF_8));
            }
        } catch (Exception e) {
            return false;
        }
        prefs(context).edit().putString(KEY_HASH, hash).apply();
        File[] others = root.listFiles();
        if (others != null) {
            for (File f : others) if (!f.getName().equals(hash)) deleteTree(f);
        }
        current = null;
        return true;
    }

    Line line(String style) {
        return lines.get(style);
    }

    boolean hasPara(String key) {
        return key != null && paras.containsKey(key);
    }

    int[] paraRect(String key) {
        return paras.get(key);
    }

    /** صورة كلمة أو حرف (أبيض على شفاف) بمقاس الرسم الأصلي. */
    Bitmap glyph(String style, String token) {
        Line l = lines.get(style);
        if (l == null) return null;
        float[] r = l.g.get(token);
        if (r == null) return null;
        return region(style + "\u0001" + token, (int) r[0], (int) r[1], (int) r[2], (int) r[3], l.h);
    }

    Bitmap para(String key) {
        int[] r = paras.get(key);
        if (r == null) return null;
        return region("p\u0001" + key, r[0], r[1], r[2], r[3], r[4]);
    }

    private synchronized Bitmap region(String key, int sheet, int x, int y, int w, int h) {
        Bitmap hit = cache.get(key);
        if (hit != null) return hit;
        if (sheet < 0 || sheet >= decoders.length) return null;
        try {
            if (decoders[sheet] == null) {
                String path = new File(dir, "s" + sheet + ".png").getAbsolutePath();
                decoders[sheet] = Build.VERSION.SDK_INT >= 31
                        ? BitmapRegionDecoder.newInstance(path)
                        : legacyDecoder(path);
            }
            Bitmap b = null;
            if (decoders[sheet] != null) {
                BitmapFactory.Options o = new BitmapFactory.Options();
                o.inPreferredConfig = Bitmap.Config.ARGB_8888;
                b = decoders[sheet].decodeRegion(new Rect(x, y, x + w, y + h), o);
            }
            if (b == null) {
                // بعض البيئات بلا مفكّك مناطق: الصفيحة كاملة مرة ثم القصّ منها.
                Bitmap full = fullSheet(sheet);
                if (full != null && x + w <= full.getWidth() && y + h <= full.getHeight()) {
                    b = Bitmap.createBitmap(full, x, y, w, h);
                }
            }
            if (b != null) cache.put(key, b);
            return b;
        } catch (Exception e) {
            return null;
        }
    }

    private Bitmap[] full;

    private Bitmap fullSheet(int sheet) {
        if (full == null) full = new Bitmap[decoders.length];
        if (full[sheet] == null) {
            full[sheet] = BitmapFactory.decodeFile(new File(dir, "s" + sheet + ".png").getAbsolutePath());
        }
        return full[sheet];
    }

    @SuppressWarnings("deprecation")
    private static BitmapRegionDecoder legacyDecoder(String path) throws IOException {
        return BitmapRegionDecoder.newInstance(path, false);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static boolean safeHash(String hash) {
        return hash != null && hash.matches("[0-9a-f]{8}");
    }

    private static byte[] readAll(File f) throws IOException {
        try (java.io.FileInputStream in = new java.io.FileInputStream(f)) {
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }

    private static void deleteTree(File f) {
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteTree(k);
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }
}
