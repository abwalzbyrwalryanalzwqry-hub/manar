/**
 * منار — حرّاس سلسلة الإصدار (المرحلة ٣١).
 *
 * - versionCode مصدره واحد (عدد الالتزامات) فلا يتراجع بين البناء المحلي وCI.
 * - كل سير عمل يشغّل Gradle يجلب التاريخ كاملاً، وإلا صار الرقم ١.
 * - ملف قفل واحد، وإصدار Node واحد لكل البيئات.
 * - فحص أندرويد غير مطفأ.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const gradle = read("android/app/build.gradle");
const workflows = readdirSync(resolve(root, ".github/workflows"))
  .filter((f) => f.endsWith(".yml"))
  .map((f) => ({ name: f, text: read(`.github/workflows/${f}`) }));

/** كود Groovy بلا تعليقات، حتى لا يُحسب ذكرُ المتغيّر في الشرح استعمالاً له. */
const gradleCode = gradle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("versionCode", () => {
  it("لا يعتمد على رقم تشغيل GitHub (يبدأ من ١ لكل سير عمل)", () => {
    expect(gradleCode).not.toMatch(/GITHUB_RUN_NUMBER/);
  });

  it("مصدره عدد الالتزامات، ويرفض النسخة السطحية", () => {
    expect(gradleCode).toMatch(/'rev-list', '--count', 'HEAD'/);
    expect(gradleCode).toMatch(/--is-shallow-repository/);
  });

  it("بناء الإصدار يتوقف بدل أن يُخرج رقماً خاطئاً", () => {
    const block = gradleCode.slice(gradleCode.indexOf("def resolvedVersionCode"));
    expect(block).toMatch(/MANAR_REQUIRE_RELEASE_SIGNING/);
    expect(block).toMatch(/throw new GradleException/);
  });

  it("كل سير عمل يشغّل Gradle يجلب التاريخ كاملاً", () => {
    const withGradle = workflows.filter((w) => /\.\/gradlew/.test(w.text));
    expect(withGradle.length).toBeGreaterThan(0);
    for (const w of withGradle) {
      expect(w.text, w.name).toMatch(/fetch-depth:\s*0/);
    }
  });
});

describe("فحص أندرويد", () => {
  it("مفعّل في بناء الإصدار", () => {
    const lint = gradleCode.match(/lint\s*\{[\s\S]*?\}/)?.[0] ?? "";
    expect(lint).toMatch(/abortOnError\s+true/);
    expect(lint).toMatch(/checkReleaseBuilds\s+true/);
  });
});

describe("بيئة واحدة", () => {
  it("ملف قفل واحد: package-lock.json", () => {
    expect(existsSync(resolve(root, "package-lock.json"))).toBe(true);
    expect(existsSync(resolve(root, "bun.lock"))).toBe(false);
    expect(read(".gitignore")).toMatch(/^bun\.lock$/m);
  });

  it("إصدار Node من .nvmrc في كل سير عمل، ومطابق لـ engines", () => {
    const nvmrc = read(".nvmrc").trim();
    const pkg = JSON.parse(read("package.json")) as { engines?: { node?: string } };
    const min = Number(pkg.engines?.node?.match(/(\d+)/)?.[1]);
    expect(Number(nvmrc)).toBeGreaterThanOrEqual(min);
    for (const w of workflows) {
      expect(w.text, w.name).not.toMatch(/node-version:\s*\d/);
      if (/setup-node/.test(w.text)) expect(w.text, w.name).toMatch(/node-version-file:\s*\.nvmrc/);
    }
  });
});
