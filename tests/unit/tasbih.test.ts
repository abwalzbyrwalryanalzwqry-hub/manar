// @vitest-environment jsdom
/* المسبحة: نموذج الجلسات، والإعدادات، والمكتبة الموثّقة. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HISTORY_MAX,
  activeSession,
  emptyTasbihStore,
  endSession,
  endedSessions,
  mergeTasbihStores,
  normalizeTasbihStore,
  pausedSessions,
  progressRatio,
  resetCount,
  resumeSession,
  setTarget,
  startSession,
  tap,
  undo,
  type StartInput,
  type TasbihStore,
} from "@/lib/tasbih/session";
import { DEFAULT_TASBIH_PREFS, normalizeTasbihPrefs, TASBIH_PREFS_KEY } from "@/lib/tasbih/prefs";
import { TASBIH_CATEGORIES, TASBIH_LIBRARY } from "@/lib/tasbih/library";
import { TASBIH_KEY } from "@/lib/tasbih/store";
import { BACKUP_KEYS, KEY_EVENTS } from "@/lib/local-backup";

const L = (id: string, target: number | null): StartInput => ({
  ref: { kind: "library", id },
  name: id,
  text: id,
  target,
});

function taps(store: TasbihStore, n: number) {
  let s = store;
  let reached = 0;
  for (let i = 0; i < n; i++) {
    const r = tap(s, 1000 + i);
    s = r.store;
    if (r.reachedNow) reached++;
  }
  return { store: s, reached };
}

describe("جلسة المسبحة", () => {
  it("هدف ثابت: يبلغه مرة واحدة، ويستمر العدّ بعده بلا دورة جديدة تلقائية", () => {
    const s0 = startSession(emptyTasbihStore(), L("subhanallah", 33), 1, "t-1");
    const { store, reached } = taps(s0, 40);
    const a = activeSession(store)!;
    expect(a.count).toBe(40);
    expect(reached).toBe(1);
    expect(a.reachedAt).not.toBeNull();
    expect(a.mode).toBe("target");
    expect(progressRatio(a)).toBe(1);
  });

  it("عدّاد مفتوح صريح في النموذج (mode=open، target=null) بلا نسبة", () => {
    const s = startSession(emptyTasbihStore(), L("x", null), 1, "t-1");
    const a = activeSession(s)!;
    expect(a.mode).toBe("open");
    expect(a.target).toBeNull();
    expect(progressRatio(a)).toBeNull();
    expect(taps(s, 5000).reached).toBe(0);
  });

  it("دقة العدّ مع نقرات سريعة متتالية (١٠٠٠٠ نقرة)", () => {
    const s = startSession(emptyTasbihStore(), L("x", 1000), 1, "t-1");
    expect(activeSession(taps(s, 10_000).store)!.count).toBe(10_000);
  });

  it("التراجع لا ينزل تحت الصفر ويُلغي بلوغ الهدف إن نزل تحته", () => {
    let s = startSession(emptyTasbihStore(), L("x", 3), 1, "t-1");
    s = taps(s, 3).store;
    s = undo(s);
    expect(activeSession(s)!.count).toBe(2);
    expect(activeSession(s)!.reachedAt).toBeNull();
    for (let i = 0; i < 10; i++) s = undo(s);
    expect(activeSession(s)!.count).toBe(0);
  });

  it("التصفير يعيد العدّ إلى صفر ويبقي الجلسة", () => {
    let s = startSession(emptyTasbihStore(), L("x", 3), 1, "t-1");
    s = resetCount(taps(s, 5).store);
    expect(activeSession(s)).toMatchObject({ count: 0, reachedAt: null, status: "active" });
  });

  it("بدء جلسة جديدة لا يمسح الجارية: تُحفظ موقوفة وتُتابَع لاحقًا بعددها", () => {
    let s = startSession(emptyTasbihStore(), L("a", 33), 1, "t-a");
    s = taps(s, 7).store;
    s = startSession(s, L("b", 100), 2, "t-b");
    expect(activeSession(s)!.id).toBe("t-b");
    expect(pausedSessions(s).map((x) => [x.id, x.count])).toEqual([["t-a", 7]]);
    s = resumeSession(taps(s, 2).store, "t-a", 3);
    expect(activeSession(s)!.count).toBe(7);
    expect(pausedSessions(s).map((x) => [x.id, x.count])).toEqual([["t-b", 2]]);
  });

  it("جلسة فارغة (بلا عدّ) تُستبدل بلا أثر", () => {
    let s = startSession(emptyTasbihStore(), L("a", 33), 1, "t-a");
    s = startSession(s, L("b", 33), 2, "t-b");
    expect(s.sessions.map((x) => x.id)).toEqual(["t-b"]);
  });

  it("إنهاء الجلسة يضعها في السجل، والسجل محدود", () => {
    let s = emptyTasbihStore();
    for (let i = 0; i < HISTORY_MAX + 5; i++) {
      s = startSession(s, L(`z${i}`, null), i * 10, `t-${i}`);
      s = taps(s, 1).store;
      s = endSession(s, i * 10 + 5);
    }
    expect(activeSession(s)).toBeNull();
    expect(endedSessions(s)).toHaveLength(HISTORY_MAX);
  });

  it("تغيير الهدف لا يمسّ العدّ", () => {
    let s = startSession(emptyTasbihStore(), L("x", 100), 1, "t-1");
    s = setTarget(taps(s, 40).store, 33);
    expect(activeSession(s)).toMatchObject({ count: 40, target: 33, mode: "target" });
    s = setTarget(s, null);
    expect(activeSession(s)).toMatchObject({ count: 40, target: null, mode: "open" });
  });

  it("تطبيع بيانات تالفة: لا أعداد سالبة ولا أهداف غير صالحة ولا أكثر من جلسة نشطة", () => {
    const s = normalizeTasbihStore({
      activeId: "t-2",
      sessions: [
        { id: "t-1", ref: { kind: "library", id: "a" }, count: -5, target: 0, status: "active" },
        {
          id: "t-2",
          ref: { kind: "personal", id: "u-1" },
          count: 3,
          target: 1e12,
          status: "active",
        },
        { id: 7, ref: {} },
      ],
    });
    expect(s.sessions).toHaveLength(2);
    expect(s.sessions.filter((x) => x.status === "active")).toHaveLength(1);
    expect(activeSession(s)!.id).toBe("t-2");
    expect(activeSession(s)!.target).toBeNull();
    expect(s.sessions.find((x) => x.id === "t-1")!.count).toBe(0);
  });

  it("الدمج من نسخة احتياطية لا يُنشئ جلستين نشطتين", () => {
    const a = taps(startSession(emptyTasbihStore(), L("a", 3), 1, "t-a"), 1).store;
    const b = taps(startSession(emptyTasbihStore(), L("b", 3), 2, "t-b"), 1).store;
    const m = mergeTasbihStores(a, b);
    expect(activeSession(m)!.id).toBe("t-a");
    expect(pausedSessions(m).map((x) => x.id)).toEqual(["t-b"]);
  });

  it("المفاتيح ضمن النسخة الاحتياطية", () => {
    for (const k of [TASBIH_KEY, TASBIH_PREFS_KEY]) {
      expect(BACKUP_KEYS).toContain(k);
      expect(KEY_EVENTS[k]).toBeTruthy();
    }
  });
});

describe("إعدادات المسبحة", () => {
  it("الصوت مطفأ افتراضيًا", () => {
    expect(DEFAULT_TASBIH_PREFS.soundGoal).toBe(false);
    expect(normalizeTasbihPrefs(null).soundGoal).toBe(false);
  });
  it("تطبيع القيم الخاطئة", () => {
    const p = normalizeTasbihPrefs({ hapticTap: "yes", defaultTarget: -1, progressStyle: "x" });
    expect(p.hapticTap).toBe(DEFAULT_TASBIH_PREFS.hapticTap);
    expect(p.defaultTarget).toBe(DEFAULT_TASBIH_PREFS.defaultTarget);
    expect(p.progressStyle).toBe("ring");
    expect(normalizeTasbihPrefs({ defaultTarget: null }).defaultTarget).toBeNull();
  });
});

describe("مكتبة الأذكار الموثّقة", () => {
  it("كل ذكر له معرّف فريد وتصنيف معروف ومصدر واحد على الأقل برابط موثوق", () => {
    const ids = new Set<string>();
    const cats = new Set(TASBIH_CATEGORIES.map((c) => c.key));
    for (const z of TASBIH_LIBRARY) {
      expect(ids.has(z.id), z.id).toBe(false);
      ids.add(z.id);
      expect(cats.has(z.category)).toBe(true);
      expect(z.text.trim()).toBe(z.text);
      expect(z.sources.length).toBeGreaterThan(0);
      for (const s of z.sources) expect(s.url).toMatch(/^https:\/\/(sunnah\.com|quran\.com)\//);
      for (const d of z.documented ?? []) {
        expect(Number.isSafeInteger(d.count) && d.count > 0).toBe(true);
        expect(d.context.length).toBeGreaterThan(0);
      }
    }
    /* كل تصنيف فيه ذكر واحد على الأقل */
    for (const c of cats)
      expect(
        TASBIH_LIBRARY.some((z) => z.category === c),
        c,
      ).toBe(true);
  });

  it("الدرجة تُذكر لغير الصحيحين فقط، وأحاديث الصحيحين بلا درجة", () => {
    for (const z of TASBIH_LIBRARY)
      for (const s of z.sources) {
        if (/sunnah\.com\/(bukhari|muslim):/.test(s.url)) expect(s.grade).toBeUndefined();
        if (/sunnah\.com\/(abudawud|tirmidhi):/.test(s.url)) expect(s.grade).toBeTruthy();
      }
  });

  it("النص القرآني مطابق حرفيًا لمصحف تنزيل المضمّن", () => {
    const quranItems = TASBIH_LIBRARY.filter((z) => z.quran);
    expect(quranItems.length).toBeGreaterThan(0);
    for (const z of quranItems) {
      const file = resolve(__dirname, "../../public/data/quran/uthmani", `${z.quran!.surah}.json`);
      const data = JSON.parse(readFileSync(file, "utf8")) as { ayahs: { n: number; t: string }[] };
      const ayah = data.ayahs.find((a) => a.n === z.quran!.ayah)!;
      expect(ayah.t.endsWith(z.text), z.id).toBe(true);
    }
  });

  it("لا يحوي ما استُبعد لضعفه", () => {
    expect(TASBIH_LIBRARY.some((z) => z.text.includes("الْعَظِيمِ وَبِحَمْدِهِ"))).toBe(false);
  });

  it("الصلاة الإبراهيمية تطابق نص حصن المسلم المضمّن", () => {
    const hisn = readFileSync(
      resolve(__dirname, "../../public/data/azkar/hisn-al-muslim.json"),
      "utf8",
    );
    const z = TASBIH_LIBRARY.find((x) => x.id === "salat-ibrahimiyya")!;
    const firstHalf = z.text.split("، اللَّهُمَّ بَارِكْ")[0];
    expect(hisn).toContain(firstHalf);
  });
});
