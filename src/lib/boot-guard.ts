/* منار — الطرف الآخر من درع الإقلاع (scripts/boot-guard.mjs).
 *
 * الدرع لا يستطيع أن يستدلّ على عمل التطبيق من محتوى الصفحة: HTML المبني مسبقاً
 * يحمل شاشة «جارٍ استعادة بياناتك…» حتى لو لم يعمل سطرٌ واحد من الحزمة. لذلك
 * يُعلن React تركيبه صراحةً هنا، ويُزيل رسالة الدرع لو ظهرت على جهاز بطيء ثم أقلع. */

export const BOOT_GUARD_KEY = "manar.bootguard.v1";

type BootWindow = Window & { __manarMounted?: boolean; __manarBootGuard?: string };

export function markAppMounted(): void {
  if (typeof window === "undefined") return;
  const w = window as BootWindow;
  w.__manarMounted = true;
  if (w.__manarBootGuard) {
    document.getElementById("manar-boot-error")?.remove();
    delete w.__manarBootGuard;
  }
  try {
    localStorage.removeItem(BOOT_GUARD_KEY);
  } catch {
    /* التخزين غير متاح — لا شيء نُزيله */
  }
}
