/* Manar — native shell bridge component.
 *
 * Mounted once at the root. It owns the parts of the Android experience that
 * only make sense inside the Capacitor WebView:
 *
 *   - hardware back button behaviour
 *   - status-bar colour following light/dark
 *   - hiding the splash screen once the first screen is painted
 *   - a one-time, dismissible prompt for the two permissions that decide whether
 *     the Adhan really fires while the app is closed (exact alarms on Android
 *     12+, battery-optimisation exemption on Doze-aggressive OEM builds)
 *   - re-syncing the seven-day schedule every time the app comes back to the
 *     foreground
 *
 * In a browser every effect short-circuits and nothing renders.
 */

import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import {
  applyStatusBar,
  hideSplash,
  isNativeApp,
  onResume,
  setupBackButton,
} from "@/lib/native-shell";
import {
  attachSeasonTapListener,
  nativeAdhanStatus,
  requestBatteryExemption,
  requestExactAlarms,
  syncNativePrayerSchedule,
  type NativeAdhanStatus,
} from "@/lib/native-notifications";
import { useLocation, useSettings } from "@/lib/prayer";
import { SAKINAH_EVENT } from "@/lib/sakinah";
import { syncSakinahSchedule } from "@/lib/sakinah-native";
import { Icon, icons } from "@/components/manar/shell";

const DISMISS_KEY = "manar.native.reliabilityPromptDismissed";

export function NativeBridge() {
  const { location } = useLocation();
  const { settings: calc } = useSettings();
  const [status, setStatus] = useState<NativeAdhanStatus | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const router = useRouter();

  // النقر على تنبيه «مواسم منار» يفتح صفحة الموسم.
  useEffect(() => {
    if (!isNativeApp()) return;
    void attachSeasonTapListener((season) => {
      void router.navigate({ to: "/seasons/$season", params: { season } });
    });
  }, [router]);

  // Back button + splash + status bar.
  //
  // Every step is individually guarded: `launchAutoHide` is false, so any
  // exception thrown here would leave the splash screen (a solid dark-green
  // surface) covering the app forever — the "green screen" symptom. The splash
  // is therefore hidden from a `finally`-style watchdog that runs no matter what
  // happens above it.
  useEffect(() => {
    if (!isNativeApp()) return;

    let detach: () => void = () => {};
    let media: MediaQueryList | null = null;
    let syncBar: (() => void) | null = null;

    try {
      detach = setupBackButton((message) => {
        toast(message, { duration: 1800 });
      });

      media = window.matchMedia("(prefers-color-scheme: dark)");
      syncBar = () => void applyStatusBar(media!.matches);
      syncBar();
      media.addEventListener("change", syncBar);
    } catch (err) {
      console.error("native shell setup failed", err);
    }

    // Give the first screen one frame to paint before removing the splash,
    // and keep a hard watchdog in case anything else stalls start-up.
    const t = setTimeout(() => void hideSplash(), 350);
    const watchdog = setTimeout(() => void hideSplash(), 4000);

    return () => {
      try {
        detach();
        if (media && syncBar) media.removeEventListener("change", syncBar);
      } catch {
        /* ignore */
      }
      clearTimeout(t);
      clearTimeout(watchdog);
    };
  }, []);

  // Reliability status + prompt.
  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    void (async () => {
      const s = await nativeAdhanStatus();
      if (cancelled) return;
      setStatus(s);
      const alreadyDismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
      const needsAttention = !!s && (!s.exactAlarms || !s.batteryUnrestricted);
      setDismissed(alreadyDismissed || !needsAttention);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-sync the schedule on resume: the seven-day window keeps sliding forward,
  // and a reboot may have dropped alarms the receiver could not restore.
  useEffect(() => {
    if (!isNativeApp()) return;
    return onResume(() => {
      void syncNativePrayerSchedule(location, calc);
      void nativeAdhanStatus().then(setStatus);
    });
  }, [location, calc]);

  /* سكينة: يُعاد بناء فترات الهدوء عند كل استئناف، وعند تغيّر الموقع أو
     طريقة الحساب، وعند تغيّر إعدادات سكينة نفسها. الاستئناف هو أول لحظة
     نكتشف فيها أن اليوم تغيّر أو المنطقة الزمنية اختلفت بعد سفر. */
  useEffect(() => {
    if (!isNativeApp()) return;
    const sync = () => void syncSakinahSchedule(location, calc);
    sync();
    const offResume = onResume(sync);
    window.addEventListener(SAKINAH_EVENT, sync);
    return () => {
      offResume();
      window.removeEventListener(SAKINAH_EVENT, sync);
    };
  }, [location, calc]);

  if (!isNativeApp() || dismissed || !status) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const fixExact = async () => {
    await requestExactAlarms();
    toast("بعد السماح بالتنبيهات الدقيقة، ارجع إلى منار", { duration: 3000 });
  };

  const fixBattery = async () => {
    await requestBatteryExemption();
    toast("من «البطارية» اختر «غير مقيّد» (أو «عدم التحسين» حسب جهازك)، ثم ارجع إلى منار", {
      duration: 5000,
    });
  };

  return (
    <div className="fixed inset-x-0 bottom-24 z-50 px-4" dir="rtl">
      <div className="glass rounded-[24px] border border-gold/30 p-4 shadow-elegant">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
            <Icon d={icons.bell} size={18} />
          </span>
          <div className="flex-1">
            <div className="text-sm font-medium">لضمان وصول الأذان في وقته</div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              يحتاج منار إذنين من النظام حتى يعمل الأذان والتطبيق مغلق.
            </p>

            <div className="mt-3 space-y-2">
              {!status.exactAlarms && (
                <button
                  onClick={fixExact}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-start"
                >
                  <span className="text-xs font-medium">السماح بالتنبيهات الدقيقة</span>
                  <span className="text-[10px] text-muted-foreground">مطلوب</span>
                </button>
              )}
              {!status.batteryUnrestricted && (
                <button
                  onClick={fixBattery}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-start"
                >
                  <span className="text-xs font-medium">استثناء من تحسين البطارية</span>
                  <span className="text-[10px] text-muted-foreground">موصى به</span>
                </button>
              )}
            </div>

            <button onClick={dismiss} className="mt-3 text-[11px] text-muted-foreground underline">
              لاحقاً
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
