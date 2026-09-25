import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyReset,
  applyTap,
  completedChapterKeys,
  normalizeProgress,
  rollDay,
} from "@/lib/azkar/progress";
import type { AzkarBook } from "@/lib/azkar/types";
import { azkarForTime, isZikrDone, progressKey } from "@/lib/azkar/variant";
import {
  DEFAULT_REMINDERS,
  REMINDER_ROUTES,
  isDoneToday,
  type DailyReminder,
} from "@/lib/daily-reminders";
import { WIRD_SESSIONS } from "@/lib/wird/data";
import {
  WIRD_LAYOUT,
  applyIncrement,
  emptySession,
  isWirdComplete,
  readSession,
} from "@/lib/wird/progress";

/* منطق التقدّم (المرحلة الثانية): فصل الصباح عن المساء، والتصفير اليومي،
 * وإكمال الوِرد عند اكتمال كل أذكاره لا آخرها. */

const book = JSON.parse(readFileSync("public/data/azkar/hisn-al-muslim.json", "utf8")) as AzkarBook;
const ch27 = book.chapters.find((c) => c.id === 27)!;
const DAY = "2026-09-25";

describe("عدّادات الأذكار", () => {
  it("المساء له مفتاح مستقل، والصباح وبقية الأبواب بالرقم وحده", () => {
    expect(progressKey(77, "evening")).toBe("77:e");
    expect(progressKey(77, "morning")).toBe("77");
    expect(progressKey(4, null)).toBe("4");
  });

  it("ذكر أُتمّ صباحًا لا يظهر تامًّا مساءً", () => {
    let p = normalizeProgress({}, DAY);
    for (let i = 0; i < 3; i++) p = applyTap(p, progressKey(76, "morning"), 3);
    expect(p.counters["76"]).toBe(3);
    expect(p.counters["76:e"]).toBeUndefined();
    expect(p.completed).toEqual(["76"]);
    expect(isZikrDone(new Set(p.completed), 76)).toBe(true);
  });

  it("العدّ لا يتجاوز التكرار ولا يكرّر المكتمل", () => {
    let p = normalizeProgress({}, DAY);
    for (let i = 0; i < 5; i++) p = applyTap(p, "20", 1);
    expect(p.counters["20"]).toBe(1);
    expect(p.completed).toEqual(["20"]);
  });

  it("التصفير يحذف المفاتيح المحددة فقط", () => {
    let p = normalizeProgress({}, DAY);
    p = applyTap(applyTap(p, "20", 1), "20:e", 1);
    p = applyReset(p, ["20:e"]);
    expect(p.counters).toEqual({ "20": 1 });
    expect(p.completed).toEqual(["20"]);
  });

  it("الحالة القديمة (المكتمل أرقامًا) تُقرأ مفاتيحَ نصية", () => {
    const p = normalizeProgress({ day: DAY, counters: { 4: 1 }, completed: [4, 4] }, DAY);
    expect(p.completed).toEqual(["4"]);
    expect(p.counters).toEqual({ "4": 1 });
  });

  it("تغيّر اليوم يصفّر العدّادات ويبقي المحفوظات وآخر موضع", () => {
    const old = normalizeProgress(
      {
        day: "2026-09-24",
        counters: { "4": 1 },
        completed: ["4"],
        bookmarks: [9],
        last: { chapter: 1, zikr: 4, at: 1 },
      },
      "2026-09-24",
    );
    const p = rollDay(old, DAY);
    expect(p.counters).toEqual({});
    expect(p.completed).toEqual([]);
    expect(p.bookmarks).toEqual([9]);
    expect(p.last?.zikr).toBe(4);
    expect(p.day).toBe(DAY);
    expect(normalizeProgress(old, DAY).counters).toEqual({});
  });

  it("باب الصباح والمساء يُسجَّل بمفتاحين مستقلين", () => {
    const morning = azkarForTime(ch27, "morning").map((z) => progressKey(z.id, "morning"));
    const evening = azkarForTime(ch27, "evening").map((z) => progressKey(z.id, "evening"));
    expect(completedChapterKeys(book, morning)).toContain("27:m");
    expect(completedChapterKeys(book, morning)).not.toContain("27:e");
    expect(completedChapterKeys(book, evening)).toEqual(["27:e"]);
    const ch1 = book.chapters.find((c) => c.id === 1)!;
    expect(
      completedChapterKeys(
        book,
        ch1.azkar.map((z) => String(z.id)),
      ),
    ).toEqual(["1"]);
  });
});

describe("تقدّم الوِرد", () => {
  const items = WIRD_SESSIONS.morning.items.map(({ order, repeat }) => ({ order, repeat }));

  it("يُصفَّر يوميًا ومع تغيّر ترتيب الأذكار", () => {
    const today = { ...emptySession(DAY), counts: { 1: 1 } };
    expect(readSession(today, DAY).counts).toEqual({ 1: 1 });
    expect(readSession(today, "2026-09-26").counts).toEqual({});
    expect(readSession({ ...today, day: undefined }, DAY).counts).toEqual({});
    expect(readSession({ ...today, layout: WIRD_LAYOUT - 1 }, DAY).counts).toEqual({});
  });

  it("إتمام آخر ذكر لا يعني إتمام الوِرد", () => {
    const last = items[items.length - 1];
    let p = emptySession(DAY);
    for (let i = 0; i < last.repeat; i++) p = applyIncrement(p, last.order, last.repeat, items);
    expect(p.done).toBe(false);
  });

  it("الوِرد يكتمل عند اكتمال كل أذكاره بأي ترتيب", () => {
    let p = emptySession(DAY);
    for (const it of [...items].reverse()) {
      for (let i = 0; i < it.repeat; i++) p = applyIncrement(p, it.order, it.repeat, items);
    }
    expect(isWirdComplete(p, items)).toBe(true);
    expect(p.done).toBe(true);
  });
});

describe("التذكيرات", () => {
  const byId = (id: string) => DEFAULT_REMINDERS.find((r) => r.id === id)!;

  it("كل تذكير مبنيّ يفتح وجهته الدقيقة", () => {
    expect(byId("azkar-morning").route).toBe("/azkar/27?time=morning");
    expect(byId("azkar-evening").route).toBe("/azkar/27?time=evening");
    expect(byId("sleep-azkar").route).toBe("/azkar/28");
    expect(byId("wake-azkar").route).toBe("/azkar/1");
    expect(byId("wird").route).toBe("/wird/morning");
    expect(byId("wird").body).not.toContain("القرآن");
    for (const r of DEFAULT_REMINDERS) expect(REMINDER_ROUTES).toContain(r.route);
  });

  it("إتمام أذكار الصباح لا يُلغي تذكير المساء والعكس", () => {
    const m: DailyReminder = byId("azkar-morning");
    const e: DailyReminder = byId("azkar-evening");
    const asr = { asr: new Date(2026, 8, 25, 15, 10) };
    expect(isDoneToday(m, { wird: [], chapters: { "27:m": 1 } }, asr)).toBe(true);
    expect(isDoneToday(e, { wird: [], chapters: { "27:m": 1 } }, asr)).toBe(false);
    expect(isDoneToday(e, { wird: [], chapters: { "27:e": 1 } }, asr)).toBe(true);
    expect(isDoneToday(m, { wird: [], chapters: { "27:e": 1 } }, asr)).toBe(false);
  });
});
