/**
 * منار — حارس أذونات أندرويد.
 *
 * يثبّت قرارات سياسة Google Play في `AndroidManifest.xml` حتى لا تعود بالخطأ:
 * - الأذونات المقيّدة في Play لا تُعلن.
 * - إذن «عدم الإزعاج» (ACCESS_NOTIFICATION_POLICY) باقٍ لسكينة، ويمنحه المستخدم
 *   بنفسه من شاشة النظام؛ لا يوجد في الكود أي طلب تلقائي له.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const manifest = readFileSync(resolve(root, "android/app/src/main/AndroidManifest.xml"), "utf8");
/** الأذونات المعلنة فعلاً (بلا التعليقات). */
const declared = new Set(
  [
    ...manifest
      .replace(/<!--[\s\S]*?-->/g, "")
      .matchAll(/<uses-permission\s+android:name="([^"]+)"/g),
  ].map((m) => m[1]),
);

describe("AndroidManifest — أذونات متوافقة مع Google Play", () => {
  it("لا يعلن الأذونات المقيّدة في Play", () => {
    expect(declared.has("android.permission.USE_EXACT_ALARM")).toBe(false);
    expect(declared.has("android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS")).toBe(false);
  });

  it("يُبقي المنبّهات الدقيقة بإذن يمنحه المستخدم", () => {
    expect(declared.has("android.permission.SCHEDULE_EXACT_ALARM")).toBe(true);
    expect(manifest).toContain("android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED");
  });

  it("يُبقي إذن «عدم الإزعاج» لسكينة", () => {
    expect(declared.has("android.permission.ACCESS_NOTIFICATION_POLICY")).toBe(true);
  });
});

describe("إذن «عدم الإزعاج» باختيار المستخدم وحده", () => {
  const sakinahScreen = readFileSync(resolve(root, "src/routes/sakinah.tsx"), "utf8");
  const plugin = readFileSync(
    resolve(root, "android/app/src/main/java/app/manar/islamic/ManarAdhanPlugin.java"),
    "utf8",
  );

  it("شاشة سكينة تعرض حالة الإذن وزرّ منحه أو إدارته", () => {
    expect(sakinahScreen).toContain("إذن «عدم الإزعاج»: ممنوح");
    expect(sakinahScreen).toContain("إذن «عدم الإزعاج»: غير ممنوح");
    expect(sakinahScreen).toContain("openSakinahPolicyAccessSettings");
  });

  it("الطبقة الأصلية تفتح شاشة النظام للمنح والسحب", () => {
    expect(plugin).toContain("public void sakinahOpenPolicyAccessSettings(PluginCall call)");
    expect(plugin).toContain("public void sakinahRequestPolicyAccess(PluginCall call)");
  });
});
