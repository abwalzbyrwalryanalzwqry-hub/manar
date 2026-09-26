import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/optional-client", () => ({ loadCloud: async () => null }));

import { KEY_EVENTS, runSync, SYNC_MAP, SYNCED_KEYS, type SyncBackend } from "@/lib/cloud-sync";

/**
 * حارس تغطية المزامنة: كل مفتاح `manar.*.vN` يكتبه التطبيق إمّا أن يُزامَن مع
 * السحابة، أو أن يكون مذكوراً صراحةً هنا بأنه خاصّ بالجهاز. فلا يُضاف إعداد
 * جديد ثم يضيع بصمت عند تغيير الهاتف أو إعادة التثبيت.
 */
const DEVICE_ONLY = new Set([
  "manar.bootguard.v1", // تشخيص إقلاع هذا الجهاز
  "manar.onboarded.v1", // الترحيب يظهر مرة على كل جهاز
  "manar.prayer-cache.v1", // ذاكرة مؤقتة تُعاد حسابها
  "manar.quran.recitation.downloads.v1", // ملفات صوتية محمَّلة على هذا الجهاز فقط
  "manar.quran.search.recent.v1", // سجل بحث محلي
  "manar.sync.meta.v1", // بيانات المزامنة نفسها
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

describe("تغطية المزامنة السحابية", () => {
  const used = new Set<string>();
  for (const f of walk(join(__dirname, "../../src"))) {
    for (const m of readFileSync(f, "utf8").matchAll(/"(manar[.:-][a-z0-9.-]+\.v\d+)"/g)) {
      used.add(m[1]);
    }
  }

  it("كل مفتاح دائم إمّا مُزامَن أو مصنَّف خاصاً بالجهاز", () => {
    const orphan = [...used].filter((k) => !SYNCED_KEYS.includes(k) && !DEVICE_ONLY.has(k));
    expect(orphan).toEqual([]);
  });

  it("لا يُزامَن مفتاح خاص بالجهاز، ولا يتكرّر مفتاح في جدولين", () => {
    for (const k of DEVICE_ONLY) expect(SYNCED_KEYS).not.toContain(k);
    expect(new Set(SYNCED_KEYS).size).toBe(SYNCED_KEYS.length);
  });

  it("كل مفتاح مُزامَن له حدث يُعيد تحميل وحدته بعد الاستعادة", () => {
    for (const k of SYNCED_KEYS) expect(KEY_EVENTS[k], k).toMatch(/^manar:/);
  });

  it("التذكيرات وسكينة والمواسم وموضع القارئ تُستعاد على جهاز جديد", async () => {
    const keys = [
      "manar.daily-reminders.v1",
      "manar.sakinah.v1",
      "manar.seasons.v1",
      "manar.quran.reader.v1",
      "manar.quran.recitation.prefs.v1",
      "manar.quran.tafsir.edition.v1",
      "manar.quran.tafsir.font.v1",
    ];
    const rows: Record<string, unknown> = {};
    const backend: SyncBackend = {
      fetch: async (t) => rows[t] ?? null,
      save: async (t, d) => void (rows[t] = JSON.parse(JSON.stringify(d))),
    };
    const store = (init: Record<string, string> = {}) => {
      const m = new Map(Object.entries(init));
      return {
        getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
        setItem: (k: string, v: string) => void m.set(k, v),
        removeItem: (k: string) => void m.delete(k),
      };
    };
    const oldPhone = store(Object.fromEntries(keys.map((k) => [k, `{"from":"${k}"}`])));
    await runSync(oldPhone, backend, "u1", "merge", 1_000);
    // تعديل لاحق على الجهاز القديم يأخذ ختماً فيفوز على جهاز جديد فارغ.
    for (const k of keys) oldPhone.setItem(k, `{"v":2,"k":"${k}"}`);
    await runSync(oldPhone, backend, "u1", "merge", 2_000);

    const newPhone = store();
    const res = await runSync(newPhone, backend, "u1", "merge", 3_000);
    for (const k of keys) {
      expect(newPhone.getItem(k)).toBe(`{"v":2,"k":"${k}"}`);
      expect(res.updatedLocal).toContain(k);
      expect(Object.keys(SYNC_MAP).some((t) => SYNC_MAP[t].includes(k))).toBe(true);
    }
  });
});
