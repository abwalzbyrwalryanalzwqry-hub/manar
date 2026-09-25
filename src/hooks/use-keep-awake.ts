// ============================================================
// Manar — إبقاء الشاشة مضاءة أثناء القراءة والتلاوة
// ------------------------------------------------------------
// أندرويد: إضافة @capacitor-community/keep-awake (FLAG_KEEP_SCREEN_ON).
// الويب: الإضافة نفسها تستعمل Screen Wake Lock API إن توفّر.
// عدّاد مشترك: تبقى الشاشة مضاءة ما دام مستعمل واحد على الأقل نشطاً.
// ============================================================

import { useEffect } from "react";

let holders = 0;

async function apply(): Promise<void> {
  try {
    // لا تُعاد الإضافة من دالة async مباشرة: وكيل Capacitor يُعامَل كـ thenable.
    const { KeepAwake: k } = await import("@capacitor-community/keep-awake");
    const { isSupported } = await k.isSupported();
    if (!isSupported) return;
    if (holders > 0) await k.keepAwake();
    else await k.allowSleep();
  } catch {
    /* اختياري: لا يُعطّل القراءة إن لم يتوفّر */
  }
}

// قفل الويب يُحرَّر تلقائياً عند إخفاء الصفحة، فيُطلب من جديد عند العودة.
function onVisible() {
  if (document.visibilityState === "visible" && holders > 0) void apply();
}

/** يبقي الشاشة مضاءة ما دام `active` صحيحاً والمكوّن معروضاً. */
export function useKeepAwake(active: boolean): void {
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    holders += 1;
    if (holders === 1) document.addEventListener("visibilitychange", onVisible);
    void apply();
    return () => {
      holders = Math.max(0, holders - 1);
      if (holders === 0) document.removeEventListener("visibilitychange", onVisible);
      void apply();
    };
  }, [active]);
}
