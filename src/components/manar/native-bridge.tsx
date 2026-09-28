/* Manar — native shell bridge component.
 *
 * Mounted once at the root. It owns the parts of the Android experience that
 * only make sense inside the Capacitor WebView:
 *
 *   - hardware back button behaviour
 *   - status-bar colour following light/dark
 *   - hiding the splash screen once the first screen is painted
 *   - a dismissible prompt for the three permissions that decide whether the
 *     Adhan really fires while the app is closed (notifications, exact alarms,
 *     battery). «لاحقاً» remembers what was missing at that moment; the prompt
 *     returns only if something NEW goes missing (e.g. a permission revoked).
 *   - re-syncing the seven-day schedule every time the app comes back to the
 *     foreground
 *
 * In a browser every effect short-circuits and nothing renders.
 */

import { useEffect, useState } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { toast } from "@/lib/toast";

import {
  applyStatusBar,
  hideSplash,
  isNativeApp,
  onResume,
  setupBackButton,
} from "@/lib/native-shell";
import { attachSeasonTapListener, syncNativePrayerSchedule } from "@/lib/native-notifications";
import {
  adhanVerdict,
  dismissValue,
  missingPermissions,
  shouldShowReliabilityPrompt,
} from "@/lib/alert-permissions";
import { AlertPermissionRows } from "@/components/manar/alert-permissions-card";
import { useAlertPermissions } from "@/lib/use-alert-permissions";
import { useLocation, useSettings } from "@/lib/prayer";
import { SAKINAH_EVENT } from "@/lib/sakinah";
import { syncSakinahSchedule } from "@/lib/sakinah-native";
import { Icon, icons } from "@/components/manar/shell";

const DISMISS_KEY = "manar.native.reliabilityPromptDismissed";

export function NativeBridge() {
  const { location } = useLocation();
  const { settings: calc } = useSettings();
  const { perms, refresh } = useAlertPermissions();
  const [stored, setStored] = useState<string | null>(null);
  const [storedRead, setStoredRead] = useState(false);
  const pathname = useRouterState({ select: (st) => st.location.pathname });
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

  // ما كان ناقصاً عند آخر «لاحقاً».
  useEffect(() => {
    if (!isNativeApp()) return;
    try {
      setStored(window.localStorage.getItem(DISMISS_KEY));
    } catch {
      setStored(null);
    }
    setStoredRead(true);
  }, []);

  // Re-sync the schedule on resume: the seven-day window keeps sliding forward,
  // and a reboot may have dropped alarms the receiver could not restore.
  useEffect(() => {
    if (!isNativeApp()) return;
    return onResume(() => {
      void syncNativePrayerSchedule(location, calc);
      void refresh();
    });
  }, [location, calc, refresh]);

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

  if (!isNativeApp() || !perms || !storedRead) return null;
  // شريحة التعريف تعرض الأذونات نفسها؛ لا نافذتان فوق بعضهما.
  if (pathname === "/onboarding") return null;
  const missing = missingPermissions(perms);
  if (!shouldShowReliabilityPrompt(missing, stored)) return null;
  const silent = adhanVerdict(perms) === "silent";

  const dismiss = () => {
    const v = dismissValue(missing);
    try {
      window.localStorage.setItem(DISMISS_KEY, v);
    } catch {
      /* يبقى الإخفاء لهذه الجلسة */
    }
    setStored(v);
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
              {silent
                ? "بدون هذه الأذونات لن يُسمع الأذان والتطبيق مغلق — يصل إشعاراً مكتوباً فقط."
                : "يحتاج منار هذه الأذونات من النظام حتى يعمل الأذان والتطبيق مغلق."}
            </p>

            <div className="mt-3">
              <AlertPermissionRows perms={perms} onlyMissing onChanged={() => void refresh()} />
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
