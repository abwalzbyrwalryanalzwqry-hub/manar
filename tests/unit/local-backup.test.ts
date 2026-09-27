/**
 * منار — «بياناتي»: النسخ الاحتياطي المحلي بعد حذف الحساب والمزامنة السحابية.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyBackup,
  BACKUP_KEYS,
  backupFileName,
  buildBackup,
  clearUserData,
  DEVICE_ONLY_KEYS,
  KEY_EVENTS,
  parseBackup,
  summarizeBackup,
} from "@/lib/local-backup";
import { cleanName, USER_NAME_KEY } from "@/lib/user-name";

const root = resolve(__dirname, "../..");

function mem(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

const BM = "manar.quran.bookmarks.v1";
const bm = (id: string, note = "") => ({
  id,
  surah: 1,
  ayah: 1,
  page: 1,
  juz: 1,
  note,
  createdAt: 1,
});

describe("تغطية النسخة الاحتياطية", () => {
  const used = new Set<string>();
  for (const f of walk(join(root, "src"))) {
    for (const m of readFileSync(f, "utf8").matchAll(/"(manar[.:-][a-z0-9.-]+\.v\d+)"/g)) {
      used.add(m[1]);
    }
  }

  it("كل مفتاح دائم إمّا في النسخة أو مصنَّف خاصاً بالجهاز", () => {
    const orphan = [...used].filter(
      (k) => !BACKUP_KEYS.includes(k) && !DEVICE_ONLY_KEYS.has(k) && k !== "manar.sync.meta.v1",
    );
    expect(orphan).toEqual([]);
  });

  it("لا تكرار، ولا مفتاح خاص بالجهاز في النسخة، ولكل مفتاح حدث", () => {
    expect(new Set(BACKUP_KEYS).size).toBe(BACKUP_KEYS.length);
    for (const k of DEVICE_ONLY_KEYS) expect(BACKUP_KEYS).not.toContain(k);
    for (const k of BACKUP_KEYS) expect(KEY_EVENTS[k], k).toMatch(/^manar:/);
    expect(BACKUP_KEYS).toContain(USER_NAME_KEY);
  });
});

describe("التصدير ثم الاستيراد على جهاز جديد", () => {
  it("كل شيء يعود كما كان", () => {
    const old = mem({
      "manar.settings.v1": '{"method":"umm"}',
      [BM]: JSON.stringify([bm("2:255", "آية الكرسي")]),
      [USER_NAME_KEY]: '"أحمد"',
      "manar.onboarded.v1": "1",
    });
    const file = JSON.stringify(buildBackup(old, 1_000, "1.0.0"));
    const parsed = parseBackup(file);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.data).not.toHaveProperty("manar.onboarded.v1");

    const fresh = mem();
    applyBackup(fresh, parsed.backup, "replace");
    expect(fresh.getItem("manar.settings.v1")).toBe('{"method":"umm"}');
    expect(fresh.getItem(BM)).toContain("آية الكرسي");
    expect(fresh.getItem(USER_NAME_KEY)).toBe('"أحمد"');
  });

  it("اسم الملف بتاريخ التصدير", () => {
    expect(backupFileName(new Date(2026, 8, 7).getTime())).toBe("manar-backup-2026-09-07.json");
  });

  it("الملخّص يعدّ العلامات", () => {
    const b = buildBackup(mem({ [BM]: JSON.stringify([bm("1:1"), bm("1:2")]) }), 5, "");
    expect(summarizeBackup(b)).toMatchObject({ keys: 1, bookmarks: 2, exportedAt: 5 });
  });
});

describe("الدمج والاستبدال", () => {
  const backup = () =>
    buildBackup(
      mem({
        "manar.settings.v1": '{"method":"file"}',
        "manar.khatmah.v1": '{"from":"file"}',
        [BM]: JSON.stringify([bm("1:1", "ملف"), bm("2:2", "ملف")]),
      }),
      1,
      "",
    );

  it("الدمج: الجهاز يفوز، ويُضاف الناقص، وتُضمّ العلامات", () => {
    const dev = mem({
      "manar.settings.v1": '{"method":"device"}',
      [BM]: JSON.stringify([bm("1:1", "جهاز")]),
    });
    const changed = applyBackup(dev, backup(), "merge");
    expect(dev.getItem("manar.settings.v1")).toBe('{"method":"device"}');
    expect(dev.getItem("manar.khatmah.v1")).toBe('{"from":"file"}');
    const marks = JSON.parse(dev.getItem(BM)!);
    expect(marks.map((x: { id: string }) => x.id)).toEqual(["1:1", "2:2"]);
    expect(marks[0].note).toBe("جهاز");
    expect(changed.sort()).toEqual([BM, "manar.khatmah.v1"].sort());
  });

  it("الاستبدال: النسخة تحلّ محلّ كل شيء، وما ليس فيها يُمسح", () => {
    const dev = mem({ "manar.settings.v1": '{"method":"device"}', "manar.seasons.v1": "{}" });
    applyBackup(dev, backup(), "replace");
    expect(dev.getItem("manar.settings.v1")).toBe('{"method":"file"}');
    expect(dev.getItem("manar.seasons.v1")).toBeNull();
  });

  it("إعادة الضبط تمسح بيانات المستخدم وتبقي علامة التعريف", () => {
    const dev = mem({
      "manar.settings.v1": "{}",
      [USER_NAME_KEY]: '"س"',
      "manar.onboarded.v1": "1",
      "manar.sync.meta.v1": "{}",
    });
    clearUserData(dev);
    expect(dev.getItem("manar.settings.v1")).toBeNull();
    expect(dev.getItem(USER_NAME_KEY)).toBeNull();
    expect(dev.getItem("manar.sync.meta.v1")).toBeNull();
    expect(dev.getItem("manar.onboarded.v1")).toBe("1");
  });
});

describe("ملف مستورد من مصدر مجهول", () => {
  const wrap = (data: unknown, extra: object = {}) =>
    JSON.stringify({ app: "manar", format: 1, exportedAt: 1, appVersion: "x", data, ...extra });

  it("يرفض ما ليس نسخة منار", () => {
    expect(parseBackup("not json").ok).toBe(false);
    expect(parseBackup("[]").ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: "other", format: 1, data: {} })).ok).toBe(false);
    expect(parseBackup(wrap({}, { format: 99 })).ok).toBe(false);
    expect(parseBackup(wrap({})).ok).toBe(false);
  });

  it("يتجاهل المفاتيح الغريبة والقيم التالفة", () => {
    const r = parseBackup(
      wrap({
        "manar.settings.v1": '{"ok":1}',
        "manar.khatmah.v1": "{broken",
        "manar.onboarded.v1": "1",
        "sb-x-auth-token": "{}",
        "manar.seasons.v1": 5,
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.backup.data)).toEqual(["manar.settings.v1"]);
  });

  it("يرفض الملفات الضخمة", () => {
    expect(parseBackup(" ".repeat(5 * 1024 * 1024 + 1)).ok).toBe(false);
  });
});

describe("الاسم الاختياري", () => {
  it("يُنظَّف ويُقصّ", () => {
    expect(cleanName("  أحمد   علي \n")).toBe("أحمد علي");
    expect(cleanName("x".repeat(50))).toHaveLength(30);
  });
});

describe("لا حساب ولا تسجيل دخول", () => {
  it("شاشات الحساب والمزامنة محذوفة", () => {
    for (const f of [
      "src/routes/login.tsx",
      "src/routes/register.tsx",
      "src/routes/forgot-password.tsx",
      "src/routes/reset-password.tsx",
      "src/routes/delete-account.tsx",
      "src/routes/profile.tsx",
      "src/lib/auth-context.tsx",
      "src/lib/cloud-sync.ts",
    ]) {
      expect(existsSync(join(root, f)), f).toBe(false);
    }
  });

  it("لا يستورد التطبيق المصادقة ولا عميل السحابة", () => {
    const offenders = walk(join(root, "src")).filter((f) =>
      /auth-context|cloud-sync|integrations\/supabase|integrations\/lovable|@supabase\/|"\/login"|"\/profile"/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
