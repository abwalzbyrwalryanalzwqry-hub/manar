package app.manar.islamic;

import android.content.Context;
import android.widget.RemoteViews;

import androidx.annotation.Nullable;

import org.json.JSONObject;

/**
 * رسم الويدجتات: كل نوع دالة تبني شجرة {@link RemoteViews} من الحالة والمقاس
 * الفعلي (dp). القرار «ماذا يتّسع؟» هنا لا في ملفات تخطيط لكل مقاس.
 */
final class WidgetRender {

    private WidgetRender() {}

    /** سياق رسم نسخة واحدة. */
    static final class Frame {
        final Context context;
        final int id;
        final String kind;
        @Nullable final WidgetData data;
        @Nullable final WidgetData.State state;
        final JSONObject cfg;
        final WidgetUi ui;
        final WidgetTheme th;
        final long now;
        /** مساحة المحتوى (بعد الحشوة) بالـdp. */
        final float w;
        final float h;
        final boolean latin;
        /** أقرب لحظة يجب أن يُعاد فيها رسم هذه النسخة. */
        long refreshAt = Long.MAX_VALUE;
        /** هل يعرض عدّاً بالدقائق (يُحدَّث كل دقيقة والشاشة مضاءة)؟ */
        boolean minuteTicks;

        Frame(Context context, int id, String kind, @Nullable WidgetData data, long now,
              float widthDp, float heightDp) {
            this.context = context;
            this.id = id;
            this.kind = kind;
            this.data = data;
            this.now = now;
            this.state = data == null ? null : data.state(now);
            this.cfg = data == null ? new JSONObject() : data.config(id);
            boolean dark = data == null || data.appDark;
            String themeId = data == null ? "night" : data.optString(cfg, "theme", "night");
            this.th = WidgetTheme.resolve(context, themeId, dark);
            this.ui = new WidgetUi(context, WidgetArt.get(context), th,
                    data == null ? 1f : data.scale, id);
            this.w = Math.max(60, widthDp - 28);
            this.h = Math.max(30, heightDp - 24);
            this.latin = data != null && data.latinDigits;
        }

        void refresh(long at) {
            if (at > now && at < refreshAt) refreshAt = at;
        }

        boolean bool(String key, boolean fb) {
            return data != null && data.optBool(cfg, key, fb);
        }

        int opacity() {
            return data == null ? 100 : data.opacity(cfg);
        }

        String countdown() {
            return data == null ? "minutes" : data.countdownMode(cfg);
        }
    }

    static RemoteViews render(Frame f) {
        if (f.data == null) return stale(f);
        // أنواع لا تحتاج المواقيت.
        switch (f.kind) {
            case "tasbih":
                return WidgetKinds.tasbih(f);
            case "quran":
                return WidgetKinds.quran(f);
            case "azkar":
                return WidgetKinds.azkar(f);
            case "verse":
                return WidgetKinds.verse(f);
            default:
                break;
        }
        if (f.state == null || f.state.prayer == null) return stale(f);
        switch (f.kind) {
            case "next":
                return WidgetKinds.next(f);
            case "day":
                return WidgetKinds.day(f);
            case "prayed":
                return WidgetKinds.prayed(f);
            case "hijri":
                return WidgetKinds.hijri(f);
            default:
                return hub(f);
        }
    }

    /* ───────────── «افتح منار» ───────────── */

    static RemoteViews stale(Frame f) {
        RemoteViews root = f.ui.root(f.opacity());
        RemoteViews col = f.ui.box(R.layout.wd_col_center);
        col.addView(R.id.wd_box, f.ui.text("B", WidgetWords.MANAR, 20, f.th.fg, f.w));
        col.addView(R.id.wd_box, f.ui.gap(4));
        col.addView(R.id.wd_box, f.ui.text("R", WidgetWords.OPEN_APP, 12, f.th.fg2, f.w));
        root.addView(R.id.wd_content, col);
        root.setOnClickPendingIntent(R.id.wd_content, f.ui.open("/"));
        f.refresh(WidgetData.nextMidnight(f.now));
        return root;
    }

    /* ───────────── مكوّنات مشتركة ───────────── */

    /** سطر العدّ تحت الوقت: «بعد ساعتين و١٥ دقيقة» / «الإقامة بعد ٨ دقائق» / عدّاد حيّ. */
    @Nullable
    static RemoteViews countdownLine(Frame f, float size, int color, float maxW) {
        WidgetData.State s = f.state;
        String mode = f.countdown();
        if ("off".equals(mode)) return null;
        if (s.phase == WidgetData.Phase.NOW) {
            return null;
        }
        long left = s.target - f.now;
        if ("seconds".equals(mode)) {
            RemoteViews row = f.ui.box(R.layout.wd_col_end);
            if (s.phase == WidgetData.Phase.IQAMA) {
                row.addView(R.id.wd_box, f.ui.text("R", WidgetWords.IQAMA_IN, size * 0.85f, f.th.fg2, maxW));
            }
            row.addView(R.id.wd_box, f.ui.chrono(s.target, size + 3, color));
            return row;
        }
        f.minuteTicks = true;
        String text = s.phase == WidgetData.Phase.IQAMA
                ? WidgetWords.IQAMA_IN + " " + WidgetWords.minutesWord(
                        Math.max(1, (long) Math.ceil(left / 60000.0)), f.latin)
                : WidgetWords.afterPhrase(left, f.latin);
        return f.ui.text("R", text, size, color, maxW);
    }

    /** وصف الحالة فوق اسم الصلاة. */
    static String phaseLabel(WidgetData.State s) {
        switch (s.phase) {
            case NOW:
            case IQAMA:
                return WidgetWords.NOW;
            default:
                return WidgetWords.NEXT_PRAYER;
        }
    }

    /** سطر الهجري/الموسم · المدينة (أو تنبيه قرب نفاد المواقيت). */
    @Nullable
    static String metaLine(Frame f) {
        WidgetData.State s = f.state;
        if (s.daysLeft >= 0 && s.daysLeft <= 4) return WidgetWords.RENEW;
        StringBuilder b = new StringBuilder();
        String season = s.today.season;
        if (f.bool("season", true) && season != null && !season.isEmpty()) b.append(season);
        else if (f.bool("hijri", true) && !s.hijri.isEmpty()) b.append(s.hijri);
        if (f.bool("city", true) && f.data.city != null && !f.data.city.isEmpty()) {
            if (b.length() > 0) b.append("، ");
            b.append(f.data.city);
        }
        return b.length() == 0 ? null : b.toString();
    }

    static String verseRoute(WidgetData.Verse v) {
        if (v == null || v.surah <= 0) return "/quran";
        return "/quran/mushaf?surah=" + v.surah + (v.ayah > 0 ? "&ayah=" + v.ayah : "");
    }

    /* ───────────── الويدجت الشامل (ManarWidget) ───────────── */

    static RemoteViews hub(Frame f) {
        WidgetData.State s = f.state;
        WidgetData.Prayer p = s.prayer;
        WidgetUi ui = f.ui;
        WidgetTheme th = f.th;
        RemoteViews root = ui.root(f.opacity());
        f.refresh(s.changeAt);
        f.refresh(WidgetData.nextMidnight(f.now));
        if (s.today.hijriFrom > f.now) f.refresh(s.today.hijriFrom);

        boolean compact = f.h < 76;
        boolean wide = f.w >= 230;
        String pRoute = "/prayer";

        if (compact) {
            RemoteViews row = ui.box(R.layout.wd_row);
            RemoteViews right = ui.box(R.layout.wd_col);
            right.addView(R.id.wd_box, ui.text("B", p.name, 19, th.fg, f.w * 0.5f));
            right.addView(R.id.wd_box, ui.text("M", p.time, 13, th.fg2, f.w * 0.5f));
            row.addView(R.id.wd_box, right);
            row.addView(R.id.wd_box, ui.space());
            RemoteViews left = ui.box(R.layout.wd_col_end);
            if (s.phase != WidgetData.Phase.NEXT) {
                left.addView(R.id.wd_box, ui.text("M", WidgetWords.NOW, 13, th.accent, f.w * 0.48f));
            }
            RemoteViews cd = countdownLine(f, 12, th.accent, f.w * 0.48f);
            if (cd != null) left.addView(R.id.wd_box, cd);
            row.addView(R.id.wd_box, left);
            root.addView(R.id.wd_content, row);
            root.setOnClickPendingIntent(R.id.wd_content, ui.open(pRoute));
            return root;
        }

        String meta = metaLine(f);
        float used = 0;
        if (meta != null) {
            RemoteViews m = ui.text("R", meta, 11.5f, th.accent, f.w, true);
            m.setOnClickPendingIntent(R.id.wd_img, ui.open("/calendar"));
            RemoteViews mr = ui.box(R.layout.wd_row);
            mr.addView(R.id.wd_box, m);
            root.addView(R.id.wd_content, mr);
            root.addView(R.id.wd_content, ui.gap(2));
            used += 22;
        }

        RemoteViews main = ui.box(R.layout.wd_row);
        RemoteViews right = ui.box(R.layout.wd_col);
        right.addView(R.id.wd_box, ui.text("R", phaseLabel(s), 10.5f, th.fg2, f.w * 0.55f));
        right.addView(R.id.wd_box, ui.text("B", p.name, wide ? 25 : 22, th.fg, f.w * 0.55f));
        main.addView(R.id.wd_box, right);
        main.addView(R.id.wd_box, ui.space());
        RemoteViews left = ui.box(R.layout.wd_col_end);
        left.addView(R.id.wd_box, ui.text("M", p.time, wide ? 17 : 15, th.fg, f.w * 0.45f));
        RemoteViews cd = countdownLine(f, 11.5f, th.accent, f.w * 0.45f);
        if (cd != null) left.addView(R.id.wd_box, cd);
        main.addView(R.id.wd_box, left);
        main.setOnClickPendingIntent(R.id.wd_box, ui.open(pRoute));
        root.addView(R.id.wd_content, main);
        used += 56;

        root.addView(R.id.wd_content, ui.gap(6));
        root.addView(R.id.wd_content, ui.bar(f.w, 3, s.progress(f.now)));
        used += 9;
        boolean shortcuts = f.bool("shortcuts", true) && f.h - used >= 150;
        float shortcutsH = shortcuts ? 58 : 0;
        WidgetData.Verse v = s.shown.verse;
        float room = f.h - used - shortcutsH - (shortcuts ? 8 : 0);
        boolean wantTimes = f.bool("times", true) && f.w >= 200;
        boolean wantVerse = f.bool("verse", true) && v != null;
        // الأولوية: الآية حين تتسع لها، ومواقيت اليوم حين تضيق المساحة أو تفيض.
        boolean verse = wantVerse && room >= (wantTimes ? 70 : 40);
        boolean times = wantTimes && room >= STRIP_H + 8 && (!verse || room >= 70 + STRIP_H + 10);
        if (verse) {
            float verseRoom = room - 8 - 16 - (times ? STRIP_H + 10 : 0);
            root.addView(R.id.wd_content, ui.gap(8));
            RemoteViews vb = ui.box(R.layout.wd_col_fill);
            vb.addView(R.id.wd_box, ui.para(v.pk, v.text, 15, th.fg, f.w, verseRoom, true));
            vb.addView(R.id.wd_box, ui.gap(2));
            vb.addView(R.id.wd_box, ui.text("R", v.ref, 10, th.fg2, f.w));
            vb.setOnClickPendingIntent(R.id.wd_box, ui.open(verseRoute(v)));
            root.addView(R.id.wd_content, vb);
        } else {
            root.addView(R.id.wd_content, ui.vspace());
        }
        if (times) {
            root.addView(R.id.wd_content, ui.gap(verse ? 8 : 4));
            root.addView(R.id.wd_content, dayStrip(f, s.today, p));
        }

        if (shortcuts) {
            root.addView(R.id.wd_content, ui.gap(8));
            root.addView(R.id.wd_content, shortcutsRow(f));
        }
        return root;
    }

    static final float STRIP_H = 40;

    /** مواقيت اليوم الخمس في صف، مع تمييز الصلاة المعروضة. */
    static RemoteViews dayStrip(Frame f, WidgetData.Day day, WidgetData.Prayer current) {
        WidgetUi ui = f.ui;
        RemoteViews row = ui.box(R.layout.wd_row);
        int soft = f.th.light ? R.drawable.wd_soft_ink : R.drawable.wd_soft;
        float colW = f.w / 5f - 6;
        for (WidgetData.Prayer q : day.prayers) {
            if ("sunrise".equals(q.key)) continue;
            boolean on = current != null && current.at == q.at;
            RemoteViews c = ui.box(R.layout.wd_chip);
            if (on) c.setInt(R.id.wd_box, "setBackgroundResource", soft);
            c.addView(R.id.wd_box, ui.text("R", q.name, 10, on ? f.th.accent : f.th.fg2, colW));
            c.addView(R.id.wd_box, ui.text("M", q.time, 11.5f, f.th.fg, colW));
            c.setContentDescription(R.id.wd_box, q.name + " " + q.time);
            row.addView(R.id.wd_box, c);
        }
        row.setOnClickPendingIntent(R.id.wd_box, ui.open("/prayer"));
        return row;
    }

    static RemoteViews shortcutsRow(Frame f) {
        WidgetUi ui = f.ui;
        RemoteViews row = ui.box(R.layout.wd_row);
        String[][] items = {
                {WidgetWords.MUSHAF, "/quran"},
                {WidgetWords.AZKAR, "/azkar"},
                {WidgetWords.QIBLA, "/qibla"},
                {WidgetWords.TASBEEH, "/tasbih"},
        };
        int[] icons = {R.drawable.ic_wd_mushaf, R.drawable.ic_wd_azkar, R.drawable.ic_wd_qibla,
                R.drawable.ic_wd_tasbih};
        int soft = f.th.light ? R.drawable.wd_soft_ink : R.drawable.wd_soft;
        for (int i = 0; i < items.length; i++) {
            RemoteViews chip = ui.box(R.layout.wd_chip);
            chip.setInt(R.id.wd_box, "setBackgroundResource", soft);
            chip.addView(R.id.wd_box, ui.icon(icons[i], f.th.accent));
            chip.addView(R.id.wd_box, ui.gap(2));
            chip.addView(R.id.wd_box, ui.text("M", items[i][0], 10.5f, f.th.fg, f.w / 4f - 8));
            chip.setOnClickPendingIntent(R.id.wd_box, ui.open(items[i][1]));
            chip.setContentDescription(R.id.wd_box, items[i][0]);
            row.addView(R.id.wd_box, chip);
        }
        return row;
    }
}
