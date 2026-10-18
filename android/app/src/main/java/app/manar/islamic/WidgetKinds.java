package app.manar.islamic;

import android.widget.RemoteViews;

import java.util.List;
import java.util.Set;

/**
 * تخطيطات الويدجتات المتخصّصة (غير «الشامل»). كلها تُبنى من مكوّنات
 * {@link WidgetUi} بخطوط التطبيق المرسومة، وتتكيّف مع المقاس الفعلي.
 */
final class WidgetKinds {

    private WidgetKinds() {}

    /* ───────────── الصلاة القادمة (حلقة) ───────────── */

    static RemoteViews next(WidgetRender.Frame f) {
        WidgetData.State s = f.state;
        WidgetData.Prayer p = s.prayer;
        WidgetUi ui = f.ui;
        WidgetTheme th = f.th;
        RemoteViews root = ui.root(f.opacity());
        f.refresh(s.changeAt);
        f.refresh(WidgetData.nextMidnight(f.now));

        if (f.h < 92) {
            // ٢×١: الاسم والوقت والعدّ في سطرين.
            RemoteViews col = ui.box(R.layout.wd_col_fill);
            RemoteViews row = ui.box(R.layout.wd_row_center);
            row.addView(R.id.wd_box, ui.text("B", p.name, 18, th.fg, f.w * 0.55f));
            row.addView(R.id.wd_box, ui.gap(6));
            row.addView(R.id.wd_box, ui.text("M", p.time, 13, th.fg2, f.w * 0.42f));
            col.addView(R.id.wd_box, row);
            RemoteViews cd = WidgetRender.countdownLine(f, 11.5f, th.accent, f.w);
            if (cd != null) col.addView(R.id.wd_box, cd);
            else col.addView(R.id.wd_box, ui.text("R", WidgetRender.phaseLabel(s), 11, th.accent, f.w));
            root.addView(R.id.wd_content, col);
            root.setOnClickPendingIntent(R.id.wd_content, ui.open("/prayer"));
            return root;
        }

        RemoteViews col = ui.box(R.layout.wd_col_fill);
        col.addView(R.id.wd_box, ui.text("R", WidgetRender.phaseLabel(s), 10.5f, th.fg2, f.w));
        col.addView(R.id.wd_box, ui.gap(4));
        float ring = Math.max(64, Math.min(f.w, f.h - 44));
        ring = Math.min(ring, 132);
        RemoteViews r = ui.ring(ring, Math.max(3, ring / 22f), s.progress(f.now));
        r.addView(R.id.wd_box, ui.text("B", p.name, ring * 0.2f, th.fg, ring * 0.72f));
        r.addView(R.id.wd_box, ui.text("M", p.time, ring * 0.12f, th.fg2, ring * 0.7f));
        col.addView(R.id.wd_box, r);
        col.addView(R.id.wd_box, ui.gap(4));
        RemoteViews cd = WidgetRender.countdownLine(f, 11, th.accent, f.w);
        if (cd != null) col.addView(R.id.wd_box, cd);
        root.addView(R.id.wd_content, col);
        root.setOnClickPendingIntent(R.id.wd_content, ui.open("/prayer"));
        root.setContentDescription(R.id.wd_content,
                WidgetRender.phaseLabel(s) + " " + p.name + " " + p.time);
        return root;
    }

    /* ───────────── مواقيت اليوم ───────────── */

    static RemoteViews day(WidgetRender.Frame f) {
        WidgetData.State s = f.state;
        WidgetUi ui = f.ui;
        WidgetTheme th = f.th;
        RemoteViews root = ui.root(f.opacity());
        f.refresh(s.changeAt);
        f.refresh(WidgetData.nextMidnight(f.now));
        if (s.today.hijriFrom > f.now) f.refresh(s.today.hijriFrom);

        boolean header = f.h >= 96;
        if (header) {
            RemoteViews hr = ui.box(R.layout.wd_row);
            String title = s.today.weekday.isEmpty() ? WidgetWords.TODAY_TIMES : s.today.weekday;
            hr.addView(R.id.wd_box, ui.text("M", title, 13, th.fg, f.w * 0.4f));
            hr.addView(R.id.wd_box, ui.space());
            String meta = WidgetRender.metaLine(f);
            if (meta != null) hr.addView(R.id.wd_box, ui.text("R", meta, 11, th.accent, f.w * 0.58f));
            root.addView(R.id.wd_content, hr);
        }
        RemoteViews body = ui.box(R.layout.wd_col_fill);
        boolean sunrise = f.w >= 280 && f.bool("sunrise", true);
        boolean tall = f.h >= 150;
        RemoteViews row = ui.box(R.layout.wd_row);
        int soft = th.light ? R.drawable.wd_soft_ink : R.drawable.wd_soft;
        int n = sunrise ? 6 : 5;
        float colW = f.w / n - 5;
        for (WidgetData.Prayer q : s.today.prayers) {
            if (!sunrise && "sunrise".equals(q.key)) continue;
            boolean on = s.prayer != null && s.prayer.at == q.at;
            RemoteViews c = ui.box(R.layout.wd_chip);
            if (on) c.setInt(R.id.wd_box, "setBackgroundResource", soft);
            c.addView(R.id.wd_box, ui.text("R", q.name, tall ? 11.5f : 10.5f, on ? th.accent : th.fg2, colW));
            if (tall) c.addView(R.id.wd_box, ui.gap(4));
            c.addView(R.id.wd_box, ui.text("M", q.time, tall ? 13.5f : 12, th.fg, colW));
            c.setContentDescription(R.id.wd_box, q.name + " " + q.time);
            row.addView(R.id.wd_box, c);
        }
        body.addView(R.id.wd_box, row);
        if (f.h >= 120) {
            body.addView(R.id.wd_box, ui.gap(8));
            RemoteViews line = ui.box(R.layout.wd_row);
            line.addView(R.id.wd_box, ui.text("R", WidgetRender.phaseLabel(s) + " " + s.prayer.name,
                    11, th.fg2, f.w * 0.5f));
            line.addView(R.id.wd_box, ui.space());
            RemoteViews cd = WidgetRender.countdownLine(f, 11, th.accent, f.w * 0.48f);
            if (cd != null) line.addView(R.id.wd_box, cd);
            body.addView(R.id.wd_box, line);
            body.addView(R.id.wd_box, ui.gap(4));
            body.addView(R.id.wd_box, ui.bar(f.w, 3, s.progress(f.now)));
        }
        root.addView(R.id.wd_content, body);
        root.setOnClickPendingIntent(R.id.wd_content, ui.open("/prayer"));
        return root;
    }

    /* ───────────── آية اليوم ───────────── */

    static RemoteViews verse(WidgetRender.Frame f) {
        WidgetUi ui = f.ui;
        WidgetTheme th = f.th;
        RemoteViews root = ui.root(f.opacity());
        f.refresh(WidgetData.nextMidnight(f.now));
        WidgetData.Day d = f.data.dayAt(f.now);
        WidgetData.Verse v = d == null ? null : d.verse;
        if (v == null) return WidgetRender.stale(f);
        boolean header = f.h >= 110;
        if (header) {
            RemoteViews hr = ui.box(R.layout.wd_row);
            hr.addView(R.id.wd_box, ui.text("M", WidgetWords.VERSE_TODAY, 12, th.accent, f.w * 0.5f));
            root.addView(R.id.wd_content, hr);
        }
        RemoteViews body = ui.box(R.layout.wd_col_fill);
        float room = f.h - (header ? 22 : 0) - 20;
        body.addView(R.id.wd_box, ui.para(v.pk, v.text, 16, th.fg, f.w, room, true));
        body.addView(R.id.wd_box, ui.gap(4));
        body.addView(R.id.wd_box, ui.text("R", v.ref, 10.5f, th.fg2, f.w));
        root.addView(R.id.wd_content, body);
        root.setOnClickPendingIntent(R.id.wd_content, ui.open(WidgetRender.verseRoute(v)));
        return root;
    }

    /* ───────────── أذكار الصباح والمساء ───────────── */

    static RemoteViews azkar(WidgetRender.Frame f) {
        WidgetUi ui = f.ui;
        WidgetTheme th = f.th;
        WidgetData data = f.data;
        RemoteViews root = ui.root(f.opacity());
        boolean evening = data.isEvening(f.now);
        List<WidgetData.Zikr> list = evening ? data.azkarEvening : data.azkarMorning;
        String time = evening ? "evening" : "morning";
        String chapterRoute = "/azkar/" + data.azkarChapter + "?time=" + time;
        // يتبدّل الباب عند الفجر والعصر.
        WidgetData.Day d = data.dayAt(f.now);
        if (d != null) {
            WidgetData.Prayer fajr = d.get("fajr");
            WidgetData.Prayer asr = d.get("asr");
            if (fajr != null) f.refresh(fajr.at);
            if (asr != null) f.refresh(asr.at);
        }
        f.refresh(WidgetData.nextMidnight(f.now));
        if (list.isEmpty()) return WidgetRender.stale(f);

        String slot = WidgetData.dayKey(f.now) + ":" + time;
        int index = WidgetPrefs.zikrIndex(f.context, f.id, slot);
        String title = evening ? WidgetWords.AZKAR_EVENING : WidgetWords.AZKAR_MORNING;

        RemoteViews hr = ui.box(R.layout.wd_row);
        hr.addView(R.id.wd_box, ui.text("M", title, 12.5f, th.accent, f.w * 0.5f));
        hr.addView(R.id.wd_box, ui.space());
        if (index < list.size()) {
            hr.addView(R.id.wd_box, ui.text("R",
                    WidgetWords.digits(index + 1, f.latin) + " / " + WidgetWords.digits(list.size(), f.latin),
                    11, th.fg2, f.w * 0.3f));
        }
        root.addView(R.id.wd_content, hr);

        if (index >= list.size()) {
            RemoteViews done = ui.box(R.layout.wd_col_fill);
            done.addView(R.id.wd_box, ui.text("B", WidgetWords.AZKAR_DONE, 16, th.fg, f.w));
            root.addView(R.id.wd_content, done);
            root.setOnClickPendingIntent(R.id.wd_content, ui.open(chapterRoute));
            return root;
        }

        WidgetData.Zikr z = list.get(index);
        boolean footer = f.h >= 96;
        float room = f.h - 22 - (footer ? 40 : 4);
        RemoteViews body = ui.box(R.layout.wd_col_fill);
        RemoteViews para = ui.para(z.pk, z.text, z.quran ? 15 : 14, th.fg, f.w, room, true);
        body.addView(R.id.wd_box, para);
        body.setOnClickPendingIntent(R.id.wd_box, ui.open(chapterRoute + "&zikr=" + z.id));
        root.addView(R.id.wd_content, body);

        if (footer) {
            RemoteViews fr = ui.box(R.layout.wd_row);
            if (z.note != null && !z.note.isEmpty()) {
                fr.addView(R.id.wd_box, ui.text("R", z.note, 11, th.fg2, f.w * 0.5f));
            }
            fr.addView(R.id.wd_box, ui.space());
            RemoteViews btn = ui.box(R.layout.wd_col_center);
            btn.setInt(R.id.wd_box, "setBackgroundResource",
                    th.light ? R.drawable.wd_soft_ink : R.drawable.wd_soft);
            btn.setViewPadding(R.id.wd_box, ui.px(14), ui.px(6), ui.px(14), ui.px(6));
            btn.addView(R.id.wd_box, ui.text("M", WidgetWords.NEXT, 12, th.accent, f.w * 0.3f));
            btn.setOnClickPendingIntent(R.id.wd_box,
                    ui.action(WidgetActionReceiver.ACTION_ZIKR_NEXT, slot));
            btn.setContentDescription(R.id.wd_box, WidgetWords.NEXT);
            fr.addView(R.id.wd_box, btn);
            root.addView(R.id.wd_content, ui.gap(6));
            root.addView(R.id.wd_content, fr);
        } else {
            root.setOnClickPendingIntent(R.id.wd_content,
                    ui.action(WidgetActionReceiver.ACTION_ZIKR_NEXT, slot));
        }
        return root;
    }

    /* ───────────── المسبحة ───────────── */

    static RemoteViews tasbih(WidgetRender.Frame f) {
        WidgetUi ui = f.ui;
        WidgetTheme th = f.th;
        RemoteViews root = ui.root(f.opacity());
        WidgetData.Tasbih t = f.data.tasbih;
        if (t == null) {
            RemoteViews col = ui.box(R.layout.wd_col_fill);
            col.addView(R.id.wd_box, ui.icon(R.drawable.ic_wd_tasbih, th.accent));
            col.addView(R.id.wd_box, ui.gap(6));
            col.addView(R.id.wd_box, ui.text("M", WidgetWords.TASBIH, 14, th.fg, f.w));
            col.addView(R.id.wd_box, ui.text("R", WidgetWords.TASBIH_START, 10.5f, th.fg2, f.w));
            root.addView(R.id.wd_content, col);
            root.setOnClickPendingIntent(R.id.wd_content, ui.open("/tasbih"));
            return root;
        }
        int count = t.count + WidgetPrefs.taps(f.context, t.id);
        boolean goal = t.target > 0;
        boolean reached = goal && count >= t.target;

        RemoteViews hr = ui.box(R.layout.wd_row);
        hr.addView(R.id.wd_box, ui.text("M", t.name, 12, th.fg2, f.w - 30));
        hr.addView(R.id.wd_box, ui.space());
        RemoteViews open = ui.icon(R.drawable.ic_wd_tasbih, th.fg2);
        open.setOnClickPendingIntent(R.id.wd_img, ui.open("/tasbih"));
        open.setContentDescription(R.id.wd_img, WidgetWords.TASBIH);
        hr.addView(R.id.wd_box, open);
        root.addView(R.id.wd_content, hr);

        RemoteViews tapArea = ui.box(R.layout.wd_col_fill);
        String num = WidgetWords.digits(count, f.latin);
        float ring = Math.max(56, Math.min(f.w, f.h - 40));
        ring = Math.min(ring, 130);
        if (goal) {
            float frac = Math.min(1f, count / (float) t.target);
            RemoteViews r = ui.ring(ring, Math.max(3, ring / 20f), frac);
            r.addView(R.id.wd_box, ui.text("N", num, ring * 0.26f, reached ? th.accent : th.fg, ring * 0.75f));
            r.addView(R.id.wd_box, ui.text("R", WidgetWords.OF + " " + WidgetWords.digits(t.target, f.latin),
                    ring * 0.1f, th.fg2, ring * 0.7f));
            tapArea.addView(R.id.wd_box, r);
        } else {
            tapArea.addView(R.id.wd_box, ui.text("N", num, Math.min(44, ring * 0.4f), th.fg, f.w));
        }
        if (f.h >= 120) {
            tapArea.addView(R.id.wd_box, ui.gap(2));
            tapArea.addView(R.id.wd_box, ui.text("R", reached ? WidgetWords.TASBIH_GOAL : WidgetWords.TASBIH_TAP,
                    10.5f, reached ? th.accent : th.fg2, f.w));
        }
        tapArea.setOnClickPendingIntent(R.id.wd_box, ui.action(WidgetActionReceiver.ACTION_TASBIH, t.id));
        tapArea.setContentDescription(R.id.wd_box, t.name + " " + num);
        root.addView(R.id.wd_content, tapArea);
        return root;
    }

    /* ───────────── صلواتي اليوم ───────────── */

    static RemoteViews prayed(WidgetRender.Frame f) {
        WidgetData.State s = f.state;
        WidgetUi ui = f.ui;
        WidgetTheme th = f.th;
        RemoteViews root = ui.root(f.opacity());
        f.refresh(s.changeAt);
        f.refresh(WidgetData.nextMidnight(f.now));
        String day = s.today.date;
        Set<String> done = new java.util.HashSet<>();
        Set<String> fromApp = f.data.prayed.get(day);
        if (fromApp != null) done.addAll(fromApp);
        done.addAll(PrayedQueue.peek(f.context, day));

        int count = 0;
        for (WidgetData.Prayer q : s.today.prayers) {
            if (!"sunrise".equals(q.key) && done.contains(q.key)) count++;
        }
        boolean header = f.h >= 90;
        if (header) {
            RemoteViews hr = ui.box(R.layout.wd_row);
            hr.addView(R.id.wd_box, ui.text("M", WidgetWords.PRAYED_TODAY, 12.5f, th.fg, f.w * 0.5f));
            hr.addView(R.id.wd_box, ui.space());
            String sum = count >= 5 ? WidgetWords.PRAYED_ALL
                    : WidgetWords.digits(count, f.latin) + " " + WidgetWords.OF + " " + WidgetWords.digits(5, f.latin);
            hr.addView(R.id.wd_box, ui.text("R", sum, 11, th.accent, f.w * 0.48f));
            root.addView(R.id.wd_content, hr);
        }
        RemoteViews body = ui.box(R.layout.wd_col_fill);
        RemoteViews row = ui.box(R.layout.wd_row);
        int soft = th.light ? R.drawable.wd_soft_ink : R.drawable.wd_soft;
        float colW = f.w / 5f - 6;
        float dot = Math.min(22, Math.max(12, (f.h - (header ? 22 : 0)) * 0.24f));
        for (WidgetData.Prayer q : s.today.prayers) {
            if ("sunrise".equals(q.key)) continue;
            boolean ok = done.contains(q.key);
            boolean due = q.at <= f.now;
            RemoteViews c = ui.box(R.layout.wd_chip);
            c.setInt(R.id.wd_box, "setBackgroundResource", soft);
            c.addView(R.id.wd_box, ui.dot(dot, ok, ok ? th.accent : due ? th.fg : th.fg2));
            c.addView(R.id.wd_box, ui.gap(4));
            c.addView(R.id.wd_box, ui.text("R", q.name, 10.5f, ok ? th.accent : th.fg, colW));
            if (!ok && due) {
                c.setOnClickPendingIntent(R.id.wd_box,
                        ui.action(WidgetActionReceiver.ACTION_PRAYED, q.key + "|" + day));
                c.setContentDescription(R.id.wd_box, WidgetWords.PRAYED + " " + q.name);
            } else {
                c.setOnClickPendingIntent(R.id.wd_box, ui.open("/statistics"));
                c.setContentDescription(R.id.wd_box, q.name + (ok ? " " + WidgetWords.PRAYED : ""));
                if (!due) f.refresh(q.at);
            }
            row.addView(R.id.wd_box, c);
        }
        body.addView(R.id.wd_box, row);
        root.addView(R.id.wd_content, body);
        return root;
    }

    /* ───────────── التقويم الهجري ───────────── */

    static RemoteViews hijri(WidgetRender.Frame f) {
        WidgetData.State s = f.state;
        WidgetUi ui = f.ui;
        WidgetTheme th = f.th;
        RemoteViews root = ui.root(f.opacity());
        f.refresh(WidgetData.nextMidnight(f.now));
        if (s.today.hijriFrom > f.now) f.refresh(s.today.hijriFrom);
        String[] hp = s.hp != null ? s.hp : s.today.hp;
        RemoteViews col = ui.box(R.layout.wd_col_fill);
        if (hp == null) {
            col.addView(R.id.wd_box, ui.text("M", s.hijri, 14, th.fg, f.w));
        } else {
            boolean small = f.h < 110;
            if (!small) col.addView(R.id.wd_box, ui.text("R", s.today.weekday, 11.5f, th.fg2, f.w));
            if (small) {
                RemoteViews row = ui.box(R.layout.wd_row_center);
                row.addView(R.id.wd_box, ui.text("N", hp[0], 30, th.accent, f.w * 0.35f));
                row.addView(R.id.wd_box, ui.gap(8));
                RemoteViews c2 = ui.box(R.layout.wd_col);
                c2.addView(R.id.wd_box, ui.text("S", hp[1], 15, th.fg, f.w * 0.6f));
                c2.addView(R.id.wd_box, ui.text("R", hp[2] + " " + WidgetWords.HIJRI_SUFFIX, 10.5f, th.fg2, f.w * 0.6f));
                row.addView(R.id.wd_box, c2);
                col.addView(R.id.wd_box, row);
            } else {
                float big = Math.min(54, f.h * 0.34f);
                col.addView(R.id.wd_box, ui.text("N", hp[0], big, th.accent, f.w));
                col.addView(R.id.wd_box, ui.text("S", hp[1], Math.min(20, big * 0.4f), th.fg, f.w));
                col.addView(R.id.wd_box, ui.text("R", hp[2] + " " + WidgetWords.HIJRI_SUFFIX, 11, th.fg2, f.w));
                if (f.h >= 150 && !s.today.greg.isEmpty()) {
                    col.addView(R.id.wd_box, ui.gap(4));
                    col.addView(R.id.wd_box, ui.text("R", s.today.greg, 10.5f, th.fg2, f.w));
                }
            }
            if (f.h >= 130 && s.today.season != null && !s.today.season.isEmpty()
                    && f.bool("season", true)) {
                col.addView(R.id.wd_box, ui.gap(6));
                col.addView(R.id.wd_box, ui.text("R", s.today.season, 10.5f, th.accent, f.w));
            }
        }
        root.addView(R.id.wd_content, col);
        root.setOnClickPendingIntent(R.id.wd_content, ui.open("/calendar"));
        return root;
    }

    /* ───────────── القرآن: متابعة القراءة والختمة ───────────── */

    static RemoteViews quran(WidgetRender.Frame f) {
        WidgetUi ui = f.ui;
        WidgetTheme th = f.th;
        RemoteViews root = ui.root(f.opacity());
        WidgetData.LastRead lr = f.data.lastRead;
        WidgetData.Khatmah k = f.data.khatmah;
        f.refresh(WidgetData.nextMidnight(f.now));

        RemoteViews hr = ui.box(R.layout.wd_row);
        hr.addView(R.id.wd_box, ui.icon(R.drawable.ic_wd_mushaf, th.accent));
        hr.addView(R.id.wd_box, ui.gap(6));
        hr.addView(R.id.wd_box, ui.text("M", WidgetWords.CONTINUE, 12.5f, th.accent, f.w * 0.6f));
        root.addView(R.id.wd_content, hr);

        RemoteViews body = ui.box(R.layout.wd_col_fill);
        RemoteViews read = ui.box(R.layout.wd_col_wide);
        String label = lr == null ? WidgetWords.MUSHAF : lr.label;
        read.addView(R.id.wd_box, ui.text("B", label, f.h < 100 ? 15 : 18, th.fg, f.w));
        read.setOnClickPendingIntent(R.id.wd_box, ui.open(lr == null ? "/quran" : lr.route));
        body.addView(R.id.wd_box, read);

        if (f.h >= 96) {
            body.addView(R.id.wd_box, ui.gap(8));
            RemoteViews kb = ui.box(R.layout.wd_col_wide);
            if (k == null) {
                kb.addView(R.id.wd_box, ui.text("R", WidgetWords.KHATMAH_START, 11, th.fg2, f.w));
            } else {
                RemoteViews line = ui.box(R.layout.wd_row);
                line.addView(R.id.wd_box, ui.text("R", WidgetWords.KHATMAH + "، " + k.title,
                        11, th.fg2, f.w * 0.62f));
                line.addView(R.id.wd_box, ui.space());
                line.addView(R.id.wd_box, ui.text("M",
                        WidgetWords.digits(Math.round(k.progress * 100), f.latin) + "٪", 11.5f, th.accent,
                        f.w * 0.3f));
                kb.addView(R.id.wd_box, line);
                kb.addView(R.id.wd_box, ui.gap(4));
                kb.addView(R.id.wd_box, ui.bar(f.w, 3, k.progress));
                if (f.h >= 130) {
                    kb.addView(R.id.wd_box, ui.gap(6));
                    kb.addView(R.id.wd_box, ui.text("R", k.portion, 11, k.todayDone ? th.accent : th.fg, f.w));
                }
            }
            kb.setOnClickPendingIntent(R.id.wd_box, ui.open("/quran/khatmah"));
            body.addView(R.id.wd_box, kb);
        }
        root.addView(R.id.wd_content, body);
        return root;
    }
}
