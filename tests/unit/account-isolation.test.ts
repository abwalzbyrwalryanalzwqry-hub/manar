/**
 * منار — عزل بيانات الحسابات على الجهاز الواحد، وحرّاس المرحلة الحرجة لقسم «المزيد».
 *
 * الخلل الذي تحرسه هذه الاختبارات: خروج المستخدم (أ) ثم دخول (ب) على الهاتف نفسه
 * كان يرفع علامات (أ) وملاحظاته وإحصائياته إلى سحابة (ب) في أول مزامنة.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  META_KEY,
  SYNCED_KEYS,
  clearSyncedLocalData,
  hasLocalSyncedData,
  needsAccountChoice,
  readMeta,
  releaseDeviceOwnership,
  runSync,
} from "@/lib/cloud-sync";

function memStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
}
function memCloud() {
  const t: Record<string, unknown> = {};
  return {
    t,
    fetch: async (x: string) => t[x] ?? null,
    save: async (x: string, d: unknown) => {
      t[x] = d;
    },
  };
}

const BOOKMARKS = "manar.quran.bookmarks.v1";
const PRIVATE = JSON.stringify([{ s: 2, a: 255, note: "ملاحظة (أ) الخاصة" }]);

describe("ملكية بيانات الجهاز", () => {
  it("بيانات الزائر لا تحتاج سؤالاً — دمجها هو «حفظ تقدّمي»", () => {
    const store = memStore();
    store.setItem(BOOKMARKS, PRIVATE);
    expect(readMeta(store).user).toBeNull();
    expect(needsAccountChoice(store, "userA")).toBe(false);
  });

  it("الحساب نفسه بعد الخروج والعودة: لا سؤال", async () => {
    const store = memStore();
    store.setItem(BOOKMARKS, PRIVATE);
    await runSync(store, memCloud(), "userA", "merge", 1000);
    expect(needsAccountChoice(store, "userA")).toBe(false);
  });

  it("حساب مختلف على جهاز فيه بيانات حساب سابق: يجب السؤال", async () => {
    const store = memStore();
    store.setItem(BOOKMARKS, PRIVATE);
    await runSync(store, memCloud(), "userA", "merge", 1000);
    expect(needsAccountChoice(store, "userB")).toBe(true);
  });

  it("جهاز بلا بيانات متزامنة: لا سؤال حتى لو زامنه حساب آخر", async () => {
    const store = memStore();
    await runSync(store, memCloud(), "userA", "merge", 1000);
    clearSyncedLocalData(store);
    expect(hasLocalSyncedData(store)).toBe(false);
    expect(needsAccountChoice(store, "userB")).toBe(false);
  });
});

describe("خيارات المستخدم عند دخول حساب آخر", () => {
  it("«بيانات حسابي فقط»: تُمسح بيانات (أ) فلا تصل إلى سحابة (ب)", async () => {
    const store = memStore();
    store.setItem(BOOKMARKS, PRIVATE);
    await runSync(store, memCloud(), "userA", "merge", 1000);

    const removed = clearSyncedLocalData(store);
    expect(removed).toContain(BOOKMARKS);
    expect(store.getItem(META_KEY)).toBeNull();
    for (const k of SYNCED_KEYS) expect(store.getItem(k)).toBeNull();

    const b = memCloud();
    await runSync(store, b, "userB", "merge", 2000);
    expect(JSON.stringify(b.t)).not.toContain("ملاحظة (أ) الخاصة");
    expect(readMeta(store).user).toBe("userB");
  });

  it("«بيانات حسابي فقط» تستعيد نسخة (ب) من السحابة", async () => {
    const bCloud = memCloud();
    const bDevice = memStore();
    bDevice.setItem(BOOKMARKS, JSON.stringify([{ s: 1, a: 1, note: "علامة (ب)" }]));
    await runSync(bDevice, bCloud, "userB", "merge", 500);

    const shared = memStore();
    shared.setItem(BOOKMARKS, PRIVATE);
    await runSync(shared, memCloud(), "userA", "merge", 1000);
    clearSyncedLocalData(shared);
    await runSync(shared, bCloud, "userB", "merge", 2000);
    expect(shared.getItem(BOOKMARKS)).toContain("علامة (ب)");
    expect(shared.getItem(BOOKMARKS)).not.toContain("ملاحظة (أ) الخاصة");
  });

  it("«ادمج» صراحةً: تصبح بيانات الجهاز بيانات زائر ثم تُدمج", async () => {
    const store = memStore();
    store.setItem(BOOKMARKS, PRIVATE);
    await runSync(store, memCloud(), "userA", "merge", 1000);
    releaseDeviceOwnership(store);
    expect(needsAccountChoice(store, "userB")).toBe(false);
    const b = memCloud();
    await runSync(store, b, "userB", "merge", 2000);
    expect(JSON.stringify(b.t)).toContain("ملاحظة (أ) الخاصة");
  });
});

describe("حرّاس ثابتة للمرحلة الحرجة", () => {
  const root = resolve(__dirname, "../..");
  const read = (p: string) => readFileSync(resolve(root, p), "utf8");

  it("المزامنة لا تعمل قبل قرار المستخدم حين تكون البيانات لحساب آخر", () => {
    const src = read("src/lib/cloud-sync.ts");
    const body = src.slice(src.indexOf("export function syncNow"));
    expect(body.indexOf("needsAccountChoice(store, userId)")).toBeGreaterThan(-1);
    expect(body.indexOf("needsAccountChoice(store, userId)")).toBeLessThan(
      body.indexOf("runSync(store"),
    );
  });

  it("الدخول بكلمة مرور خاطئة لا يرسل بريد إعادة تعيين", () => {
    const src = read("src/lib/auth-context.tsx");
    const signIn = src.slice(src.indexOf("const signInEmail"), src.indexOf("const signUpEmail"));
    expect(signIn).not.toMatch(/resetPasswordForEmail\s*\(/);
  });

  it("وضع الزائر لا يُقرأ من التخزين في القيمة الابتدائية (سبب فشل الترطيب)", () => {
    const src = read("src/lib/auth-context.tsx");
    expect(src).not.toMatch(/useState\(\s*\(\)\s*=>[^)]*localStorage\.getItem\(GUEST_KEY\)/);
  });

  it("الخروج من كل الشاشات عبر الورقة الموحّدة، والاسترجاع بتأكيد", () => {
    for (const f of [
      "src/routes/_tabs.more.tsx",
      "src/routes/profile.tsx",
      "src/routes/settings.tsx",
    ]) {
      const src = read(f);
      expect(src, f).toContain("<SignOutSheet");
      expect(src, f).not.toMatch(/await signOut\(\)/);
    }
    expect(read("src/routes/profile.tsx")).toMatch(/onClick=\{\(\) => setConfirmRestore\(true\)\}/);
  });
});
