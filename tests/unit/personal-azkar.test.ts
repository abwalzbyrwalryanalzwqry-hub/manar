// @vitest-environment jsdom
/* الأذكار الشخصية: التحقق، والحماية، والربط بالوِردين، والتخزين، والدمج في الوِرد. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PERSONAL_NAME,
  NOT_FOUND_ERROR,
  PROTECTED_ERROR,
  REPEAT_MAX,
  TEXT_MAX,
  checkText,
  createPersonal,
  displayName,
  emptyPersonalStore,
  isPersonalId,
  mergePersonalStores,
  normalizePersonalStore,
  parseCount,
  personalForWird,
  removePersonal,
  togglePinned,
  unlinkFromWird,
  updatePersonal,
  type PersonalAzkarStore,
} from "@/lib/personal-azkar/model";
import {
  PERSONAL_AZKAR_KEY,
  SAVE_FAILED,
  personalAzkar,
  readPersonalStore,
} from "@/lib/personal-azkar/store";
import { WIRD_SESSIONS } from "@/lib/wird/data";
import { buildWirdEntries, personalRefs } from "@/lib/wird/entries";
import {
  WIRD_LAYOUT,
  applyPersonalDecrement,
  applyPersonalIncrement,
  applyPersonalReset,
  emptySession,
  isWirdComplete,
  readSession,
  wirdCompletion,
} from "@/lib/wird/progress";
import { BACKUP_KEYS, KEY_EVENTS, applyBackup } from "@/lib/local-backup";

const TEXT = "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ";

function add(store: PersonalAzkarStore, input: Parameters<typeof createPersonal>[1], now = 1000) {
  const r = createPersonal(store, input, now);
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe("التحقق من الحقول", () => {
  it("يرفض النص الفارغ أو الفراغات فقط", () => {
    expect(checkText("").ok).toBe(false);
    expect(checkText("   \n\t ").ok).toBe(false);
    expect(checkText("\u200f\u200e ").ok).toBe(false);
  });

  it("يحفظ النص بتشكيله وأسطره كما هو (يزيل الفراغ في الطرفين فقط)", () => {
    const multi = `  ${TEXT}\nاللَّهُمَّ اغْفِرْ لِي  `;
    const r = checkText(multi);
    expect(r.ok && r.value).toBe(`${TEXT}\nاللَّهُمَّ اغْفِرْ لِي`);
  });

  it("يرفض النص الأطول من الحد", () => {
    expect(checkText("ا".repeat(TEXT_MAX)).ok).toBe(true);
    expect(checkText("ا".repeat(TEXT_MAX + 1)).ok).toBe(false);
  });

  it("عدد التكرار: الفارغ مفتوح، ويقبل الأرقام العربية، ويرفض الصفر والسالب والنص والضخم", () => {
    expect(parseCount("")).toEqual({ ok: true, value: null });
    expect(parseCount("  ")).toEqual({ ok: true, value: null });
    expect(parseCount(null)).toEqual({ ok: true, value: null });
    expect(parseCount("33")).toEqual({ ok: true, value: 33 });
    expect(parseCount("١٠٠")).toEqual({ ok: true, value: 100 });
    for (const bad of [
      "0",
      "-3",
      "abc",
      "3.5",
      "1e3",
      String(REPEAT_MAX + 1),
      "99999999999999999999",
    ]) {
      expect(parseCount(bad).ok, bad).toBe(false);
    }
  });

  it("الاسم الفارغ يُعرض «ذكر مخصص»", () => {
    const { zikr } = add(emptyPersonalStore(), { text: TEXT, sessions: ["morning"] });
    expect(zikr.name).toBe("");
    expect(displayName(zikr)).toBe(DEFAULT_PERSONAL_NAME);
  });
});

describe("الإنشاء والربط بالوِردين", () => {
  it("ذكر واحد مرتبط بالصباح والمساء: سجل واحد لا نسختان", () => {
    const { store, zikr } = add(emptyPersonalStore(), {
      text: TEXT,
      name: "تسبيح",
      wirdRepeat: "10",
      sessions: ["morning", "evening"],
    });
    expect(store.items).toHaveLength(1);
    expect(isPersonalId(zikr.id)).toBe(true);
    expect(personalForWird(store.items, "morning").map((z) => z.id)).toEqual([zikr.id]);
    expect(personalForWird(store.items, "evening").map((z) => z.id)).toEqual([zikr.id]);
    /* تعديل واحد يظهر في الوِردين */
    const u = updatePersonal(store, zikr.id, { text: "لَا إِلَهَ إِلَّا اللَّهُ" }, 2000);
    expect(u.ok).toBe(true);
    if (!u.ok) return;
    expect(personalForWird(u.store.items, "morning")[0].text).toBe("لَا إِلَهَ إِلَّا اللَّهُ");
    expect(personalForWird(u.store.items, "evening")[0].text).toBe("لَا إِلَهَ إِلَّا اللَّهُ");
  });

  it("العدد المفتوح يُخزَّن null صريحًا لا رقمًا كبيرًا", () => {
    const { zikr } = add(emptyPersonalStore(), {
      text: TEXT,
      wirdRepeat: "",
      sessions: ["evening"],
    });
    expect(zikr.wird.repeat).toBeNull();
  });

  it("يرفض الحفظ إن كان العدد غير صالح ولا يغيّر المخزن", () => {
    const s = emptyPersonalStore();
    const r = createPersonal(s, { text: TEXT, wirdRepeat: "0", sessions: ["morning"] });
    expect(r.ok).toBe(false);
    expect(s.items).toHaveLength(0);
  });

  it("إزالة من وِرد واحد تُبقيه في الآخر، والحذف يزيله من الاثنين", () => {
    const { store, zikr } = add(emptyPersonalStore(), {
      text: TEXT,
      sessions: ["morning", "evening"],
    });
    const u = unlinkFromWird(store, zikr.id, "morning");
    expect(u.ok).toBe(true);
    if (!u.ok) return;
    expect(personalForWird(u.store.items, "morning")).toHaveLength(0);
    expect(personalForWird(u.store.items, "evening")).toHaveLength(1);
    const d = removePersonal(u.store, zikr.id);
    expect(d.ok && d.store.items).toEqual([]);
  });

  it("التمييز يُبدَّل ويُحفظ", () => {
    const { store, zikr } = add(emptyPersonalStore(), { text: TEXT });
    const p = togglePinned(store, zikr.id);
    expect(p.ok && p.zikr.pinned).toBe(true);
  });
});

describe("حماية الأذكار الأصلية (إلزامي)", () => {
  const originalIds: unknown[] = [
    1,
    27,
    "1",
    "27",
    "o:3",
    "hisn-27-3",
    "morning",
    "",
    null,
    undefined,
    {},
  ];

  it("ترفض التعديل والحذف والإزالة والتمييز لأي معرّف غير شخصي", () => {
    const { store } = add(emptyPersonalStore(), { text: TEXT, sessions: ["morning"] });
    for (const id of originalIds) {
      for (const r of [
        updatePersonal(store, id, { text: "x" }),
        removePersonal(store, id),
        unlinkFromWird(store, id, "morning"),
        togglePinned(store, id),
      ]) {
        expect(r.ok, String(id)).toBe(false);
        if (!r.ok) expect(r.error).toBe(PROTECTED_ERROR);
      }
    }
    expect(store.items).toHaveLength(1);
  });

  it("الأذكار الأصلية في بيانات الوِرد ليست معرّفات شخصية", () => {
    for (const s of Object.values(WIRD_SESSIONS))
      for (const it of s.items) expect(isPersonalId(String(it.order))).toBe(false);
  });

  it("معرّف شخصي غير موجود يعطي «غير موجود» لا خطأ صامتًا", () => {
    const r = removePersonal(emptyPersonalStore(), "u-zzz");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(NOT_FOUND_ERROR);
  });

  it("الطبقة المخزّنة ترفض أيضًا المعرّف الأصلي", () => {
    window.localStorage.clear();
    expect(personalAzkar.remove("12").ok).toBe(false);
    expect(personalAzkar.update("12", { text: "x" }).ok).toBe(false);
  });
});

describe("الدمج في قائمة الوِرد", () => {
  const items = WIRD_SESSIONS.morning.items;

  it("بلا أذكار شخصية: القائمة مطابقة للأصل حرفيًا", () => {
    const entries = buildWirdEntries("morning", items, []);
    expect(entries.map((e) => (e.kind === "original" ? e.item.order : -1))).toEqual(
      items.map((i) => i.order),
    );
  });

  it("الذكر الشخصي في الآخر افتراضيًا، أو بعد الذكر المختار، أو في الأول — دون تغيير ترتيب الأصلية", () => {
    let s = emptyPersonalStore();
    const a = add(s, { text: "أ", sessions: ["morning"] }, 1);
    s = a.store;
    const b = add(s, { text: "ب", sessions: ["morning"], after: { morning: 3 } }, 2);
    s = b.store;
    const c = add(s, { text: "ج", sessions: ["morning"], after: { morning: 0 } }, 3);
    s = c.store;
    const d = add(s, { text: "د", sessions: ["morning"], after: { morning: 99999 } }, 4);
    s = d.store;
    const e = add(s, { text: "هـ", sessions: ["evening"] }, 5);
    s = e.store;
    const entries = buildWirdEntries("morning", items, s.items);
    const keys = entries.map((x) => (x.kind === "original" ? `o${x.item.order}` : x.zikr.text));
    expect(keys[0]).toBe("ج");
    expect(keys[keys.indexOf("o3") + 1]).toBe("ب");
    expect(keys.slice(-2)).toEqual(["أ", "د"]);
    expect(keys).not.toContain("هـ");
    const originals = entries.flatMap((x) => (x.kind === "original" ? [x.item.order] : []));
    expect(originals).toEqual(items.map((i) => i.order));
    expect(entries).toHaveLength(items.length + 4);
  });
});

describe("عدّاد الذكر الشخصي في الوِرد", () => {
  const items = WIRD_SESSIONS.evening.items;
  const full = () => {
    const p = emptySession();
    for (const it of items) p.counts[it.order] = it.repeat;
    return p;
  };

  it("يزيد حتى عدده ثم يتوقف، والتراجع لا ينزل تحت الصفر", () => {
    let p = emptySession();
    for (let i = 0; i < 5; i++) p = applyPersonalIncrement(p, "u-a", 3);
    expect(p.personal?.["u-a"]).toBe(3);
    for (let i = 0; i < 5; i++) p = applyPersonalDecrement(p, "u-a");
    expect(p.personal?.["u-a"] ?? 0).toBe(0);
    p = applyPersonalIncrement(p, "u-a", 3);
    expect(applyPersonalReset(p, "u-a").personal?.["u-a"]).toBeUndefined();
  });

  it("المفتوح يزيد بلا سقف ولا يمنع إتمام الوِرد", () => {
    let p = full();
    for (let i = 0; i < 250; i++) p = applyPersonalIncrement(p, "u-open", null);
    expect(p.personal?.["u-open"]).toBe(250);
    expect(isWirdComplete(full(), items, [{ id: "u-open", repeat: null }])).toBe(true);
  });

  it("ذو العدد يدخل الإتمام والنسبة، ولا تتغير عدّادات الأصلية", () => {
    const p = full();
    const refs = [{ id: "u-c", repeat: 10 }];
    expect(isWirdComplete(p, items, refs)).toBe(false);
    const before = { ...p.counts };
    let q = p;
    for (let i = 0; i < 10; i++) q = applyPersonalIncrement(q, "u-c", 10);
    expect(q.counts).toEqual(before);
    expect(isWirdComplete(q, items, refs)).toBe(true);
    const c = wirdCompletion(q, items, refs);
    expect(c.ratio).toBe(1);
    expect(c.completedItems).toBe(items.length + 1);
  });

  it("readSession ينظّف عدّادات شخصية تالفة", () => {
    const p = readSession(
      {
        layout: WIRD_LAYOUT,
        day: "2026-10-09",
        counts: {},
        current: 1,
        done: false,
        updatedAt: null,
        personal: { "u-a": 4, "u-b": -2, "u-c": "x" as never, "u-d": 1.5 },
      } as never,
      "2026-10-09",
    );
    expect(p.personal).toEqual({ "u-a": 4 });
  });

  it("personalRefs تأخذ الأذكار الشخصية فقط", () => {
    const { store } = add(emptyPersonalStore(), {
      text: TEXT,
      wirdRepeat: 7,
      sessions: ["evening"],
    });
    const refs = personalRefs(buildWirdEntries("evening", items, store.items));
    expect(refs).toEqual([{ id: store.items[0].id, repeat: 7 }]);
  });
});

describe("التخزين الدائم", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("يُحفظ ويُقرأ بعد «إعادة التشغيل» (قراءة جديدة من التخزين)", () => {
    const r = personalAzkar.add({
      text: TEXT,
      name: "ذكري",
      wirdRepeat: "٣",
      sessions: ["morning", "evening"],
    });
    expect(r.ok).toBe(true);
    const again = readPersonalStore();
    expect(again.items).toHaveLength(1);
    expect(again.items[0]).toMatchObject({
      text: TEXT,
      name: "ذكري",
      wird: { repeat: 3, sessions: ["morning", "evening"] },
    });
  });

  it("فشل التخزين يعيد خطأً واضحًا ولا يدّعي النجاح", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    const r = personalAzkar.add({ text: TEXT, sessions: ["morning"] });
    expect(r).toEqual({ ok: false, error: SAVE_FAILED });
  });

  it("بيانات تالفة لا تكسر التطبيق", () => {
    window.localStorage.setItem(PERSONAL_AZKAR_KEY, "{not json");
    expect(readPersonalStore().items).toEqual([]);
    expect(
      normalizePersonalStore({
        v: 1,
        items: [{ id: "12", text: "x" }, { id: "u-1", text: "  " }, 5],
      }).items,
    ).toEqual([]);
  });

  it("ضمن النسخة الاحتياطية، والدمج يضمّ الأذكار ويُبقي الأحدث", () => {
    expect(BACKUP_KEYS).toContain(PERSONAL_AZKAR_KEY);
    expect(KEY_EVENTS[PERSONAL_AZKAR_KEY]).toBe("manar:custom-azkar");
    const a = add(emptyPersonalStore(), { text: "أ" }, 1);
    const b = add(emptyPersonalStore(), { text: "ب" }, 2);
    const merged = mergePersonalStores(a.store, b.store);
    expect(merged.items.map((z) => z.text)).toEqual(["أ", "ب"]);
    const kv = new Map<string, string>([[PERSONAL_AZKAR_KEY, JSON.stringify(a.store)]]);
    const store = {
      getItem: (k: string) => kv.get(k) ?? null,
      setItem: (k: string, v: string) => void kv.set(k, v),
      removeItem: (k: string) => void kv.delete(k),
    };
    applyBackup(
      store as never,
      { data: { [PERSONAL_AZKAR_KEY]: JSON.stringify(b.store) } } as never,
      "merge",
    );
    expect(normalizePersonalStore(JSON.parse(kv.get(PERSONAL_AZKAR_KEY)!)).items).toHaveLength(2);
  });
});
