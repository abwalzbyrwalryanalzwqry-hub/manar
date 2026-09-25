/**
 * منار — حرّاس أمان ثابتة.
 *
 * - عمود الاشتراك plan لا يكتبه المستخدم (صلاحيات العمود في Supabase).
 * - سجلّ المصادقة لا يُطبع في الإصدار (البريد ومعرّف المستخدم).
 * - خطوة الإصدار في CI تشترط مفتاح التوقيع.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("حماية عمود plan", () => {
  const dir = resolve(root, "supabase/migrations");
  const file = readdirSync(dir).find((f) => f.endsWith("_protect_profile_plan.sql"));
  const sql = file ? readFileSync(resolve(dir, file), "utf8") : "";

  it("يوجد ترحيل يسحب الكتابة العامة ويمنح أعمدة محدّدة", () => {
    expect(file).toBeTruthy();
    expect(sql).toMatch(/REVOKE INSERT, UPDATE ON public\.profiles FROM authenticated;/);
  });

  it("plan ليس ضمن أعمدة INSERT ولا UPDATE الممنوحة", () => {
    const grants = [...sql.matchAll(/GRANT (INSERT|UPDATE) \(([^)]+)\)/g)];
    expect(grants.length).toBe(2);
    for (const [, , cols] of grants) {
      const list = cols.split(",").map((c) => c.trim());
      expect(list).not.toContain("plan");
      expect(list).not.toContain("created_at");
    }
  });

  it("التطبيق لا يرسل plan عند تعديل الملف", () => {
    const ctx = read("src/lib/auth-context.tsx");
    expect(ctx).toMatch(/updateProfile: \(patch: EditableProfile\)/);
    expect(ctx).not.toMatch(/Pick<\s*Profile,[^>]*"plan"/);
  });
});

describe("سجلّ المصادقة في وضع التطوير فقط", () => {
  it("LOG محروس بـ import.meta.env.DEV", () => {
    expect(read("src/lib/auth-context.tsx")).toMatch(
      /const LOG = \(\.\.\.a: unknown\[\]\) => \{\s*if \(import\.meta\.env\.DEV\) console\.log/,
    );
  });
});

describe("توقيع الإصدار", () => {
  it("Gradle يوقف البناء عند اشتراط المفتاح وغيابه", () => {
    const gradle = read("android/app/build.gradle");
    expect(gradle).toContain('System.getenv("MANAR_REQUIRE_RELEASE_SIGNING")');
    expect(gradle).toContain("throw new GradleException");
  });

  it("خطوة الإصدار الموقَّع في CI تشترط المفتاح", () => {
    expect(read(".github/workflows/android.yml")).toContain(
      'MANAR_REQUIRE_RELEASE_SIGNING: "true"',
    );
  });
});
