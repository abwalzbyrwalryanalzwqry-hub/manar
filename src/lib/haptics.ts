// ============================================================
// Manar — الاهتزاز اللمسي للعدّادات
// ------------------------------------------------------------
// أندرويد: إضافة @capacitor/haptics (VibrationEffect بسعة محددة):
//   «خفيف» LIGHT ‏٥٠ms بسعة ١١٠، و«أقوى قليلًا» MEDIUM ‏٤٣ms بسعة ١٨٠.
// الويب/الإصدارات بلا الإضافة: Vibration API بمدد مكافئة.
// الاستدعاء لا يُنتظر (fire-and-forget) حتى لا يؤخّر العدّ مهما كثر النقر.
// ============================================================

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

export type HapticStrength = "light" | "medium";

/** مدد الاحتياط على الويب (ms). أقل من ~١٥ms لا تُحسّ على أغلب الأجهزة. */
export const WEB_VIBRATION_MS: Record<HapticStrength, number> = { light: 18, medium: 38 };

let nativeOk: boolean | null = null;

function hasNative(): boolean {
  if (nativeOk === null) {
    try {
      nativeOk = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Haptics");
    } catch {
      nativeOk = false;
    }
  }
  return nativeOk;
}

function webVibrate(ms: number) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(ms);
  } catch {
    /* ignore */
  }
}

/** اهتزاز فوري. لا يرمي ولا يُنتظر. */
export function pulse(strength: HapticStrength) {
  if (typeof window === "undefined") return;
  if (hasNative()) {
    Haptics.impact({ style: strength === "light" ? ImpactStyle.Light : ImpactStyle.Medium }).catch(
      () => webVibrate(WEB_VIBRATION_MS[strength]),
    );
    return;
  }
  webVibrate(WEB_VIBRATION_MS[strength]);
}
