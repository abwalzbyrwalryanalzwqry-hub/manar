package app.manar.islamic;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.os.Build;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextDirectionHeuristics;
import android.text.TextPaint;

import java.util.ArrayList;
import java.util.List;

/**
 * يركّب أسطر الويدجت وفقراته صوراً بقناع شفافية (ALPHA_8) — يلوّنها
 * {@link WidgetUi} حسب النمط، فتبقى الصور صغيرة لعبور الـBinder.
 *
 * السطر: كلمات من حزمة الفن مرتّبة من اليمين، والأرقام حرفاً حرفاً من اليسار
 * (كما تعرضها خوارزمية الاتجاه)، وما لا يوجد في الحزمة يُرسم بخط النظام
 * احتياطاً فلا يختفي نص أبداً.
 */
final class WidgetPaint {

    private WidgetPaint() {}

    static final String DIGIT_CHARS = "٠١٢٣٤٥٦٧٨٩0123456789:/.٪%+−-×";

    /** قطعة من السطر بعرضها بوحدات الرسم الأصلية (قبل التحجيم). */
    private static final class Piece {
        final List<Bitmap> imgs = new ArrayList<>();
        final List<float[]> metas = new ArrayList<>(); // [advance, pad]
        String fallback;
        float width;
        boolean ltr;
    }

    static boolean isDigitRun(String w) {
        if (w.isEmpty()) return false;
        for (int i = 0; i < w.length(); i++) if (DIGIT_CHARS.indexOf(w.charAt(i)) < 0) return false;
        return true;
    }

    static boolean hasLatin(String s) {
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')) return true;
        }
        return false;
    }

    /**
     * سطر واحد بارتفاع {@code sizePx} (حجم الخط بالبكسل) لا يتجاوز عرضه
     * {@code maxW} (يُصغَّر ليتّسع بدل القصّ).
     */
    static Bitmap line(WidgetArt art, String style, String text, float sizePx, int maxW, int density) {
        if (text == null) text = "";
        WidgetArt.Line l = art == null ? null : art.line(style);
        List<Piece> pieces = new ArrayList<>();
        float space;
        float unitH;
        float base;
        float px;
        Paint fb = fallbackPaint(style);
        if (l != null) {
            px = l.px;
            space = l.space;
            unitH = l.h;
            base = l.base;
        } else {
            px = 100f;
            fb.setTextSize(px);
            Paint.FontMetrics fm = fb.getFontMetrics();
            space = fb.measureText(" ");
            unitH = (-fm.ascent + fm.descent) + 4;
            base = -fm.ascent + 2;
        }
        fb.setTextSize(px);

        if (l != null && l.g.containsKey(text.trim()) && (hasLatin(text) || text.indexOf(' ') < 0)) {
            pieces.add(glyphPiece(art, style, l, text.trim()));
        } else if (l != null && hasLatin(text)) {
            Piece p = new Piece();
            p.fallback = text;
            p.width = fb.measureText(text);
            pieces.add(p);
        } else {
            for (String w : text.trim().split("\\s+")) {
                if (w.isEmpty()) continue;
                pieces.add(wordPiece(art, style, l, w, fb));
            }
        }
        float total = 0;
        for (int i = 0; i < pieces.size(); i++) total += pieces.get(i).width + (i > 0 ? space : 0);
        float s = sizePx / px;
        if (total * s > maxW && total > 0) s = maxW / total;
        int w = Math.max(1, (int) Math.ceil(total * s));
        int h = Math.max(1, (int) Math.ceil(unitH * s));
        Bitmap out = Bitmap.createBitmap(w, h, Bitmap.Config.ALPHA_8);
        out.setDensity(density);
        Canvas c = new Canvas(out);
        Paint draw = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.ANTI_ALIAS_FLAG);
        float x = w;
        for (Piece p : pieces) {
            x -= p.width * s;
            drawPiece(c, p, x, s, unitH, base, fb, draw);
            x -= space * s;
        }
        return out;
    }

    private static Piece glyphPiece(WidgetArt art, String style, WidgetArt.Line l, String token) {
        Piece p = new Piece();
        float[] r = l.g.get(token);
        Bitmap b = art.glyph(style, token);
        if (b == null || r == null) {
            p.fallback = token;
            p.width = 0;
            return p;
        }
        p.imgs.add(b);
        p.metas.add(new float[] {r[4], r[5]});
        p.width = r[4];
        return p;
    }

    private static Piece wordPiece(WidgetArt art, String style, WidgetArt.Line l, String w, Paint fb) {
        if (l != null) {
            if (l.g.containsKey(w)) {
                Piece p = glyphPiece(art, style, l, w);
                if (p.fallback == null) return p;
            }
            if (isDigitRun(w)) {
                Piece p = digitsPiece(art, style, l, w);
                if (p != null) return p;
            }
            /* «و» لا تتّصل بما بعدها: «و١٥» و«ودقيقتين» = «و» + الباقي بلا فراغ. */
            if (w.length() > 1 && w.charAt(0) == 'و' && l.g.containsKey("و")) {
                String rest = w.substring(1);
                Piece tail = l.g.containsKey(rest) ? glyphPiece(art, style, l, rest)
                        : isDigitRun(rest) ? digitsPiece(art, style, l, rest) : null;
                Piece head = glyphPiece(art, style, l, "و");
                if (tail != null && tail.fallback == null && head.fallback == null) {
                    Piece p = new Piece();
                    /* RTL: «و» يميناً ثم الباقي يساره — نخزّنها من اليسار لليمين. */
                    p.imgs.addAll(tail.imgs);
                    p.metas.addAll(tail.metas);
                    p.imgs.addAll(head.imgs);
                    p.metas.addAll(head.metas);
                    p.width = tail.width + head.width;
                    p.ltr = true;
                    return p;
                }
            }
            /* فاصلة عربية ملتصقة بآخر الكلمة: «هـ،» = الكلمة + «،» يسارها. */
            if (w.length() > 1 && w.charAt(w.length() - 1) == '،' && l.g.containsKey("،")) {
                String head = w.substring(0, w.length() - 1);
                Piece body = wordPiece(art, style, l, head, fb);
                Piece comma = glyphPiece(art, style, l, "،");
                if (body.fallback == null && comma.fallback == null) {
                    Piece p = new Piece();
                    // الصور تُرسم من اليسار: الفاصلة ثم الكلمة يمينها.
                    p.imgs.addAll(comma.imgs);
                    p.metas.addAll(comma.metas);
                    p.imgs.addAll(body.imgs);
                    p.metas.addAll(body.metas);
                    p.width = body.width + comma.width;
                    p.ltr = true;
                    return p;
                }
            }
        }
        Piece p = new Piece();
        p.fallback = w;
        p.width = fb.measureText(w);
        return p;
    }

    /** الأرقام تُعرض من اليسار لليمين حتى داخل سطر عربي. */
    private static Piece digitsPiece(WidgetArt art, String style, WidgetArt.Line l, String w) {
        Piece p = new Piece();
        p.ltr = true;
        for (int i = 0; i < w.length(); i++) {
            String ch = String.valueOf(w.charAt(i));
            float[] r = l.g.get(ch);
            Bitmap b = art.glyph(style, ch);
            if (r == null || b == null) return null;
            p.imgs.add(b);
            p.metas.add(new float[] {r[4], r[5]});
            p.width += r[4];
        }
        return p;
    }

    private static void drawPiece(Canvas c, Piece p, float x, float s, float unitH, float base,
                                  Paint fb, Paint draw) {
        if (p.fallback != null) {
            c.save();
            c.translate(x, 0);
            c.scale(s, s);
            fb.setTextAlign(Paint.Align.LEFT);
            c.drawText(p.fallback, 0, base, fb);
            c.restore();
            return;
        }
        float cx = x;
        for (int i = 0; i < p.imgs.size(); i++) {
            Bitmap b = p.imgs.get(i);
            float adv = p.metas.get(i)[0];
            float pad = p.metas.get(i)[1];
            RectF dst = new RectF(cx - pad * s, 0, cx - pad * s + b.getWidth() * s, unitH * s);
            c.drawBitmap(b, null, dst, draw);
            cx += adv * s;
        }
    }

    private static Paint fallbackPaint(String style) {
        TextPaint p = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        int weight = "B".equals(style) || "N".equals(style) || "S".equals(style) ? 700
                : "M".equals(style) ? 500 : 400;
        Typeface base = "S".equals(style) ? Typeface.SERIF : Typeface.SANS_SERIF;
        p.setTypeface(Build.VERSION.SDK_INT >= 28
                ? Typeface.create(base, weight, false)
                : Typeface.create(base, weight >= 600 ? Typeface.BOLD : Typeface.NORMAL));
        return p;
    }

    /**
     * فقرة (آية أو ذكر): الصورة المرسومة بخط المصحف/العرض مصغّرةً لتتّسع في
     * {@code maxW × maxH} دون أن تتجاوز {@code sizePx} لحجم الخط. بلا حزمة:
     * StaticLayout بخط النظام، بالحجم نفسه، مقصوصة عند حدّ السطر.
     */
    static Bitmap para(WidgetArt art, String key, String text, float sizePx, int maxW, int maxH,
                       int density, boolean center) {
        Bitmap src = art != null && art.hasPara(key) ? art.para(key) : null;
        if (src != null) {
            float renderPx = key.startsWith("Q") ? 46f : 42f;
            float s = Math.min(sizePx / renderPx, Math.min(maxW / (float) src.getWidth(),
                    maxH / (float) src.getHeight()));
            int w = Math.max(1, Math.round(src.getWidth() * s));
            int h = Math.max(1, Math.round(src.getHeight() * s));
            Bitmap out = Bitmap.createBitmap(w, h, Bitmap.Config.ALPHA_8);
            out.setDensity(density);
            new Canvas(out).drawBitmap(src, null, new Rect(0, 0, w, h),
                    new Paint(Paint.FILTER_BITMAP_FLAG | Paint.ANTI_ALIAS_FLAG));
            return out;
        }
        TextPaint p = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        p.setTypeface(Typeface.SERIF);
        float size = sizePx;
        StaticLayout layout = null;
        for (int i = 0; i < 6; i++) {
            p.setTextSize(size);
            layout = staticLayout(text, p, maxW, center);
            if (layout.getHeight() <= maxH) break;
            size *= 0.88f;
        }
        int h = Math.max(1, Math.min(maxH, layout.getHeight()));
        Bitmap out = Bitmap.createBitmap(Math.max(1, maxW), h, Bitmap.Config.ALPHA_8);
        out.setDensity(density);
        Canvas c = new Canvas(out);
        layout.draw(c);
        return out;
    }

    private static StaticLayout staticLayout(String text, TextPaint p, int w, boolean center) {
        Layout.Alignment a = center ? Layout.Alignment.ALIGN_CENTER : Layout.Alignment.ALIGN_NORMAL;
        return StaticLayout.Builder.obtain(text, 0, text.length(), p, Math.max(1, w))
                .setAlignment(a)
                .setTextDirection(TextDirectionHeuristics.RTL)
                .setLineSpacing(0, 1.25f)
                .build();
    }

    /** حلقة تقدّم (قوس من الأعلى باتجاه عقارب الساعة)؛ fraction=1 دائرة كاملة. */
    static Bitmap ring(int size, float stroke, float fraction, int density) {
        Bitmap out = Bitmap.createBitmap(Math.max(1, size), Math.max(1, size), Bitmap.Config.ALPHA_8);
        out.setDensity(density);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(stroke);
        p.setStrokeCap(Paint.Cap.ROUND);
        float f = Math.max(0f, Math.min(1f, fraction));
        RectF r = new RectF(stroke / 2, stroke / 2, size - stroke / 2, size - stroke / 2);
        if (f >= 0.999f) new Canvas(out).drawOval(r, p);
        else if (f > 0.001f) new Canvas(out).drawArc(r, -90, 360 * f, false, p);
        return out;
    }

    /** شريط تقدّم مستدير الطرفين يملأ من اليمين (RTL). */
    static Bitmap bar(int w, int h, float fraction, int density) {
        Bitmap out = Bitmap.createBitmap(Math.max(1, w), Math.max(1, h), Bitmap.Config.ALPHA_8);
        out.setDensity(density);
        float f = Math.max(0f, Math.min(1f, fraction));
        if (f > 0.001f) {
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
            float fw = Math.max(h, w * f);
            new Canvas(out).drawRoundRect(new RectF(w - fw, 0, w, h), h / 2f, h / 2f, p);
        }
        return out;
    }

    /** نقطة/دائرة ممتلئة أو حلقة (لويدجت الصلوات). */
    static Bitmap dot(int size, boolean filled, float stroke, int density) {
        Bitmap out = Bitmap.createBitmap(Math.max(1, size), Math.max(1, size), Bitmap.Config.ALPHA_8);
        out.setDensity(density);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        if (filled) {
            new Canvas(out).drawCircle(size / 2f, size / 2f, size / 2f, p);
        } else {
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(stroke);
            new Canvas(out).drawCircle(size / 2f, size / 2f, size / 2f - stroke / 2, p);
        }
        return out;
    }
}
