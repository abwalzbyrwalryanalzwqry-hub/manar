import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_BOOKMARK_LOG, mergeAzkarProgress, pruneBookmarkLog } from "@/lib/azkar/merge";
import { applyToggleBookmark, completedChapterKeys, normalizeProgress } from "@/lib/azkar/progress";
import { timeFromPrayers } from "@/lib/azkar/time";
import type { AzkarBook } from "@/lib/azkar/types";
import { DAILY_ONCE, azkarForTime, isDailyOnce, progressKey } from "@/lib/azkar/variant";
import { mergeEntry } from "@/lib/sync-merge";
import { WIRD_SESSIONS } from "@/lib/wird/data";
import { dailyCarryOver, linkedAzkarEntries } from "@/lib/wird/link";
import { withDailyCarry, emptySession } from "@/lib/wird/progress";

/* المرحلة الثانية: دمج المحفوظات في المزامنة (B8)، والاستغفار اليومي (C3)،
 * والصباح/المساء من مواقيت الصلاة (C6). */

const book = JSON.parse(readFileSync("public/data/azkar/hisn-al-muslim.json", "utf8")) as AzkarBook;
const ch27 = book.chapters.find((c) => c.id === 27)!;
const DAY = "2026-09-26";
const KEY = "manar.azkar.progress.v1";

const raw = (o: object) =>
  JSON.stringify({ counters: {}, completed: [], last: null, day: DAY, ...o });
const merged = (newer: object, older: object) =>
  JSON.parse(mergeAzkarProgress(raw(newer), raw(older)));

describe("B8 — المحفوظات لا تضيع في المزامنة", () => {
  it("حفظ على الهاتف ثم عدّ على جهاز آخر لاحقًا: المحفوظ يبقى", () => {
    const phone = { bookmarks: [12], bookmarkLog: { "12": { on: true, at: 100 } }, updatedAt: 100 };
    const tablet = { bookmarks: [], counters: { "75": 1 }, completed: ["75"], updatedAt: 200 };
    const out = merged(tablet, phone);
    expect(out.bookmarks).toEqual([12]);
    expect(out.counters).toEqual({ "75": 1 });
  });

  it("الحذف الأحدث يفوز لذلك الذكر وحده، والإضافة على الجهاز الآخر تبقى", () => {
    const a = {
      bookmarks: [7],
      bookmarkLog: { "5": { on: false, at: 300 }, "7": { on: true, at: 150 } },
    };
    const b = {
      bookmarks: [5, 9],
      bookmarkLog: { "5": { on: true, at: 100 }, "9": { on: true, at: 250 } },
    };
    expect(merged(a, b).bookmarks).toEqual([7, 9]);
    expect(merged(b, a).bookmarks.sort()).toEqual([7, 9]);
  });

  it("نسخة قديمة بلا سجل: محفوظاتها تُعامل محفوظة بختم ٠", () => {
    const legacy = { bookmarks: [3, 4] };
    const modern = { bookmarks: [], bookmarkLog: { "3": { on: false, at: 50 } } };
    expect(merged(modern, legacy).bookmarks).toEqual([4]);
  });

  it("العدّادات: اليوم الأحدث يفوز، وفي اليوم نفسه الأكبر واتحاد المكتمل", () => {
    const old = { day: "2026-09-25", counters: { "91": 100 }, completed: ["91"] };
    const now = { counters: { "75": 1 }, completed: ["75"] };
    expect(merged(old, now)).toMatchObject({ day: DAY, counters: { "75": 1 }, completed: ["75"] });
    const a = { counters: { "96": 40, "75": 1 }, completed: ["75"] };
    const b = { counters: { "96": 70 }, completed: [] };
    expect(merged(a, b)).toMatchObject({ counters: { "96": 70, "75": 1 }, completed: ["75"] });
  });

  it("آخر موضع: الأحدث بوقته", () => {
    const a = { last: { chapter: 27, zikr: 80, at: 10 } };
    const b = { last: { chapter: 28, zikr: 101, at: 20 } };
    expect(merged(a, b).last.chapter).toBe(28);
  });

  it("المزامنة تستعمل الدمج البنيوي لهذا المفتاح", () => {
    const local = { v: raw({ bookmarks: [1], bookmarkLog: { "1": { on: true, at: 5 } } }), at: 5 };
    const cloud = { v: raw({ bookmarks: [2], bookmarkLog: { "2": { on: true, at: 9 } } }), at: 9 };
    const out = JSON.parse(mergeEntry(KEY, local, cloud)!.v!);
    expect(out.bookmarks.sort()).toEqual([1, 2]);
  });

  it("الحفظ والحذف يسجّلان الفعل ووقته، والقراءة تحفظ السجل", () => {
    let p = normalizeProgress({}, DAY);
    p = applyToggleBookmark(p, 42, 1000);
    expect(p.bookmarkLog["42"]).toEqual({ on: true, at: 1000 });
    p = applyToggleBookmark(p, 42, 2000);
    expect(p.bookmarks).toEqual([]);
    expect(normalizeProgress(JSON.parse(JSON.stringify(p)), DAY).bookmarkLog["42"]).toEqual({
      on: false,
      at: 2000,
    });
  });

  it("سجل المحفوظات محدود: المحذوف القديم يُنسى، والمحفوظ لا", () => {
    const log: Record<string, { on: boolean; at: number }> = { "1": { on: true, at: 1 } };
    for (let i = 2; i < MAX_BOOKMARK_LOG + 50; i++) log[String(i)] = { on: false, at: i };
    const out = pruneBookmarkLog(log);
    expect(Object.keys(out).length).toBe(MAX_BOOKMARK_LOG);
    expect(out["1"]).toEqual({ on: true, at: 1 });
    expect(out["2"]).toBeUndefined();
  });
});

describe("C3 — الاستغفار مائة مرة في اليوم عدّاد واحد", () => {
  it("#96 وحده يومي، ومفتاحه واحد صباحًا ومساءً", () => {
    expect([...DAILY_ONCE]).toEqual([96]);
    expect(progressKey(96, "evening")).toBe("96");
    expect(progressKey(96, "morning")).toBe("96");
    expect(progressKey(97, "evening")).toBe("97:e");
    expect(isDailyOnce(96) && !isDailyOnce(75) && !isDailyOnce(undefined)).toBe(true);
  });

  it("#96 موجود في أذكار الصباح والمساء كليهما، فيكفي قوله مرة لإتمام الوقتين", () => {
    const m = azkarForTime(ch27, "morning").map((z) => z.id);
    const e = azkarForTime(ch27, "evening").map((z) => z.id);
    expect(m).toContain(96);
    expect(e).toContain(96);
    const completed = [
      ...azkarForTime(ch27, "morning").map((z) => progressKey(z.id, "morning")),
      ...azkarForTime(ch27, "evening").map((z) => progressKey(z.id, "evening")),
    ];
    expect(completed.filter((k) => k.startsWith("96"))).toEqual(["96", "96"]);
    expect(completedChapterKeys(book, [...new Set(completed)])).toEqual(
      expect.arrayContaining(["27:m", "27:e"]),
    );
  });

  it("الوِرد: الاستغفار في ورد الصباح يُحتسب في ورد المساء", () => {
    const m = WIRD_SESSIONS.morning.items;
    const e = WIRD_SESSIONS.evening.items;
    const mi = m.find((it) => it.hisn === 96)!;
    const ei = e.find((it) => it.hisn === 96)!;
    const out = dailyCarryOver(e, {}, m, { [mi.order]: 100 }, new Set());
    expect(out).toEqual({ [ei.order]: 100 });
    expect(dailyCarryOver(e, {}, m, { [mi.order]: 99 }, new Set())).toBeNull();
  });

  it("الوِرد: الاستغفار المقول في الأذكار يُحتسب في الوِردين", () => {
    const store = { morning: emptySession(DAY), evening: emptySession(DAY) };
    const out = withDailyCarry(store, new Set(["96"]));
    const mi = WIRD_SESSIONS.morning.items.find((it) => it.hisn === 96)!;
    const ei = WIRD_SESSIONS.evening.items.find((it) => it.hisn === 96)!;
    expect(out.morning.counts[mi.order]).toBe(100);
    expect(out.evening.counts[ei.order]).toBe(100);
    expect(out.morning.done).toBe(false);
    /* لا شيء آخر يُحتسب. */
    expect(Object.keys(out.evening.counts)).toEqual([String(ei.order)]);
  });

  it("إتمامه في ورد المساء يُتمّ مفتاح الاستغفار اليومي في الأذكار", () => {
    const e = WIRD_SESSIONS.evening.items;
    const ei = e.find((it) => it.hisn === 96)!;
    expect(linkedAzkarEntries("evening", e, { [ei.order]: 100 })).toEqual([
      { key: "96", repeat: 100 },
    ]);
  });
});

describe("C6 — الصباح والمساء من مواقيت الصلاة", () => {
  const at = (h: number, m = 0) => new Date(2026, 0, 15, h, m);
  const fajr = at(5, 10);
  const asr = at(15, 40);
  it("الصباح من الفجر إلى العصر، والمساء من العصر إلى الفجر", () => {
    expect(timeFromPrayers(at(5, 9), fajr, asr)).toBe("evening");
    expect(timeFromPrayers(at(5, 10), fajr, asr)).toBe("morning");
    expect(timeFromPrayers(at(15, 20), fajr, asr)).toBe("morning"); // الساعة وحدها كانت تقول «مساء»
    expect(timeFromPrayers(at(15, 40), fajr, asr)).toBe("evening");
    expect(timeFromPrayers(at(23), fajr, asr)).toBe("evening");
  });

  it("في الصيف المبكر: الفجر ٣:٣٠ صباح (الساعة وحدها كانت تقول «مساء»)", () => {
    expect(timeFromPrayers(at(3, 45), at(3, 30), at(17, 10))).toBe("morning");
    expect(timeFromPrayers(at(16, 30), at(3, 30), at(17, 10))).toBe("morning");
  });
});
