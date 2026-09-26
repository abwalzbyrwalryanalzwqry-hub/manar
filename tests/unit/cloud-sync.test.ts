import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/optional-client", () => ({ loadCloud: async () => null }));

import {
  META_KEY,
  readMeta,
  runSync,
  stampLocalChanges,
  SYNC_MAP,
  type SyncBackend,
} from "@/lib/cloud-sync";
import { decodePayload, encodePayload, mergeEntry, type SyncEntries } from "@/lib/sync-merge";

/* ---------- أدوات ---------- */

function memoryStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

function memoryCloud(init: Record<string, unknown> = {}) {
  const rows: Record<string, unknown> = { ...init };
  const saves: string[] = [];
  const backend: SyncBackend = {
    fetch: async (t) => rows[t] ?? null,
    save: async (t, d) => {
      rows[t] = JSON.parse(JSON.stringify(d));
      saves.push(t);
    },
  };
  return { rows, saves, backend };
}

const tableOf = (key: string) => Object.keys(SYNC_MAP).find((t) => SYNC_MAP[t].includes(key))!;
const entriesOf = (cloud: ReturnType<typeof memoryCloud>, key: string): SyncEntries =>
  decodePayload(cloud.rows[tableOf(key)]);

const ACT = "manar.activity.v1";
const LOC = "manar.location.v1";
const BM = "manar.quran.bookmarks.v1";
const HIST = "manar.quran.history.v1";

const day = (prayers: string[] = [], ayahs = 0) => ({ prayers, ayahs, azkar: 0, wird: [] });
const log = (days: Record<string, unknown>, bestStreak = 0) => JSON.stringify({ days, bestStreak });

/* ---------- الدمج النقي ---------- */

describe("mergeEntry", () => {
  it("الأحدث يفوز، والتعادل للجهاز", () => {
    expect(mergeEntry(LOC, { v: "a", at: 5 }, { v: "b", at: 9 })).toEqual({ v: "b", at: 9 });
    expect(mergeEntry(LOC, { v: "a", at: 9 }, { v: "b", at: 5 })).toEqual({ v: "a", at: 9 });
    expect(mergeEntry(LOC, { v: "a", at: 0 }, { v: "b", at: 0 })).toEqual({ v: "a", at: 0 });
  });

  it("السجل اليومي: يوم سُجّل على جهاز واحد لا يضيع أبداً", () => {
    const local = { v: log({ "2026-09-22": day(["fajr"]) }, 3), at: 10 };
    const cloud = { v: log({ "2026-09-20": day(["isha"]), "2026-09-22": day() }, 5), at: 20 };
    const merged = JSON.parse(mergeEntry(ACT, local, cloud)!.v!);
    expect(Object.keys(merged.days).sort()).toEqual(["2026-09-20", "2026-09-22"]);
    // اليوم المشترك تأخذه النسخة الأحدث (السحابة هنا).
    expect(merged.days["2026-09-22"].prayers).toEqual([]);
    expect(merged.bestStreak).toBe(5);
  });

  it("سجل القراءة: الأيام تراكمية، والمسح الصريح يُحترم", () => {
    const older = {
      v: JSON.stringify({ entries: [{ at: 1 }], days: { "2026-09-01": 2 }, furthest: 50 }),
      at: 1,
    };
    const newer = {
      v: JSON.stringify({ entries: [{ at: 2 }], days: { "2026-09-02": 1 }, furthest: 40 }),
      at: 2,
    };
    const m = JSON.parse(mergeEntry(HIST, older, newer)!.v!);
    expect(m.days).toEqual({ "2026-09-01": 2, "2026-09-02": 1 });
    expect(m.furthest).toBe(50);
    expect(m.entries).toEqual([{ at: 2 }]);

    const cleared = { v: JSON.stringify({ entries: [], days: {}, furthest: 0 }), at: 3 };
    expect(JSON.parse(mergeEntry(HIST, cleared, older)!.v!)).toEqual({
      entries: [],
      days: {},
      furthest: 0,
    });
  });

  it("الصيغة القديمة تُقرأ بلا فقد وبختم ٠", () => {
    const e = decodePayload({ [LOC]: { city: "صنعاء" }, "manar.hijri.adjust.v1": "1" });
    expect(e[LOC]).toEqual({ v: JSON.stringify({ city: "صنعاء" }), at: 0 });
    expect(e["manar.hijri.adjust.v1"]).toEqual({ v: "1", at: 0 });
  });
});

/* ---------- محرّك المزامنة ---------- */

describe("runSync", () => {
  it("سيناريو الخطأ القديم: تقدّم دون اتصال لا تمسحه نسخة سحابية أقدم", async () => {
    const store = memoryStore({ [ACT]: log({ "2026-09-20": day(["fajr"]) }) });
    const cloud = memoryCloud();
    await runSync(store, cloud.backend, "u1", "merge", 1000);

    // المستخدم يصلّي دون اتصال
    store.setItem(ACT, log({ "2026-09-20": day(["fajr"]), "2026-09-21": day(["fajr", "dhuhr"]) }));
    // ثم يُعاد تشغيل التطبيق وتجري المزامنة
    await runSync(store, cloud.backend, "u1", "merge", 2000);

    const local = JSON.parse(store.getItem(ACT)!);
    expect(Object.keys(local.days)).toContain("2026-09-21");
    const up = JSON.parse(entriesOf(cloud, ACT)[ACT].v!);
    expect(up.days["2026-09-21"].prayers).toEqual(["fajr", "dhuhr"]);
  });

  it("جهازان: تعديل الجهاز الثاني يصل للأول، والأحدث يفوز", async () => {
    const cloud = memoryCloud();
    const a = memoryStore({ [LOC]: '"sanaa"' });
    await runSync(a, cloud.backend, "u1", "merge", 1000);

    const b = memoryStore();
    await runSync(b, cloud.backend, "u1", "merge", 2000);
    expect(b.getItem(LOC)).toBe('"sanaa"');

    b.setItem(LOC, '"aden"');
    await runSync(b, cloud.backend, "u1", "merge", 3000);
    await runSync(a, cloud.backend, "u1", "merge", 4000);
    expect(a.getItem(LOC)).toBe('"aden"');
  });

  it("جهاز جديد: النسخة السحابية المختومة تفوز على قيم الجهاز الافتراضية", async () => {
    const cloud = memoryCloud({
      [tableOf(LOC)]: encodePayload({ [LOC]: { v: '"makkah"', at: 500 } }),
    });
    const fresh = memoryStore({ [LOC]: '"default"' });
    stampLocalChanges(fresh, 9999); // أول رصد: عمر مجهول
    await runSync(fresh, cloud.backend, "u1", "merge", 10_000);
    expect(fresh.getItem(LOC)).toBe('"makkah"');
  });

  it("سحابة بالصيغة القديمة: الجهاز يفوز وتُرقّى الصيغة", async () => {
    const cloud = memoryCloud({ [tableOf(LOC)]: { [LOC]: "stale" } });
    const store = memoryStore({ [LOC]: '"current"' });
    await runSync(store, cloud.backend, "u1", "merge", 1000);
    expect(store.getItem(LOC)).toBe('"current"');
    expect((cloud.rows[tableOf(LOC)] as { __sync: number }).__sync).toBe(2);
  });

  it("الحذف المحلي ينتقل للسحابة ولا تعود العلامات المحذوفة", async () => {
    const cloud = memoryCloud();
    const store = memoryStore({ [BM]: '[{"id":"1:1","surah":1,"ayah":1}]' });
    await runSync(store, cloud.backend, "u1", "merge", 1000);
    store.removeItem(BM);
    await runSync(store, cloud.backend, "u1", "merge", 2000);
    expect(store.getItem(BM)).toBeNull();
    expect(entriesOf(cloud, BM)[BM].v).toBeNull();
  });

  it("لا كتابة في السحابة إن لم يتغيّر شيء", async () => {
    const cloud = memoryCloud();
    const store = memoryStore({ [LOC]: '"x"' });
    await runSync(store, cloud.backend, "u1", "merge", 1000);
    cloud.saves.length = 0;
    await runSync(store, cloud.backend, "u1", "merge", 2000);
    expect(cloud.saves).toEqual([]);
  });

  it("الاسترجاع الصريح: السحابة تفوز حتى على تعديل أحدث", async () => {
    const cloud = memoryCloud({
      [tableOf(LOC)]: encodePayload({ [LOC]: { v: '"cloud"', at: 100 } }),
    });
    const store = memoryStore({ [LOC]: '"local"' });
    await runSync(store, cloud.backend, "u1", "merge", 1000);
    expect(store.getItem(LOC)).toBe('"cloud"');

    // تعديل محلي أحدث لم يُرفع بعد، ثم «استرجاع من السحابة»
    store.setItem(LOC, '"newer-local"');
    await runSync(store, cloud.backend, "u1", "prefer-cloud", 2000);
    expect(store.getItem(LOC)).toBe('"cloud"');
  });

  it("خطأ السحابة يُرمى ولا تُسجَّل مزامنة ناجحة", async () => {
    const store = memoryStore({ [LOC]: '"x"' });
    const backend: SyncBackend = {
      fetch: async () => null,
      save: async () => {
        throw new Error("network");
      },
    };
    await expect(runSync(store, backend, "u1")).rejects.toThrow("network");
    expect(readMeta(store).lastSyncAt).toBeNull();
    expect(store.getItem(META_KEY)).not.toBeNull();
  });
});
