/* منار — رقم الإصدار من مصدر واحد.
 *
 * `package.json` هو المصدر: يحقنه Vite وقت البناء في `__APP_VERSION__`، ومنه
 * يقرأ `android/app/build.gradle` قيمة `versionName`. على أندرويد نقرأ من النظام
 * نفسه (`App.getInfo`) الاسم ورقم البناء (`versionCode`)، فيطابق ما يعرضه
 * Google Play وإعدادات الجهاز.
 */

import { Capacitor } from "@capacitor/core";

declare const __APP_VERSION__: string | undefined;

/** الإصدار المضمَّن وقت البناء، مثل «1.0.0». */
export const BUILD_VERSION: string =
  typeof __APP_VERSION__ === "string" && __APP_VERSION__ ? __APP_VERSION__ : "";

export type AppVersion = { name: string; build: string | null };

/** نص العرض: «1.0.0» أو «1.0.0 (11)» حين يُعرف رقم البناء. */
export function formatAppVersion(v: AppVersion): string {
  if (!v.name) return "";
  return v.build ? `${v.name} (${v.build})` : v.name;
}

/** الإصدار الفعلي: من النظام على أندرويد، ومما ضُمِّن وقت البناء على الويب. */
export async function readAppVersion(): Promise<AppVersion> {
  const fallback: AppVersion = { name: BUILD_VERSION, build: null };
  if (!Capacitor.isNativePlatform()) return fallback;
  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    return { name: info.version || BUILD_VERSION, build: info.build || null };
  } catch {
    return fallback;
  }
}
