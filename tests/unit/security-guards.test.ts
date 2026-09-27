/**
 * منار — حرّاس أمان ثابتة.
 *
 * - لا خدمة سحابية: لا Supabase ولا Lovable Cloud في الشجرة ولا في البناء.
 * - خطوة الإصدار في CI تشترط مفتاح التوقيع.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("لا خدمة سحابية", () => {
  it("مجلّدا Supabase وتكامل Lovable Cloud محذوفان", () => {
    for (const d of ["supabase", "src/integrations"]) {
      expect(existsSync(resolve(root, d)), d).toBe(false);
    }
  });

  it("لا اعتماد على مكتبات السحابة", () => {
    const pkg = JSON.parse(read("package.json"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => /^@supabase\/|^@lovable\.dev\/cloud-auth/.test(d))).toEqual([]);
  });

  it("لا متغيرات Supabase في البناء", () => {
    expect(read(".github/workflows/android.yml")).not.toMatch(/SUPABASE/);
    expect(read("src/start.ts")).not.toMatch(/supabase/i);
    expect(read("vite.config.capacitor.ts")).not.toMatch(/supabase/i);
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
