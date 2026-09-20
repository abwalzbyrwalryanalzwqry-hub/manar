/* Manar — native shell integration (Android)
 * -----------------------------------------------------------------
 * Everything the Capacitor WebView needs that the web app cannot do on its own:
 * hardware back button, status-bar styling, splash hand-off, and the one-time
 * reliability prompts (exact alarms + battery exemption) that decide whether the
 * Adhan actually fires while the app is closed.
 *
 * Plugins are reached through the runtime bridge, so every function here is a
 * no-op in a normal browser and the web bundle gains no dependency.
 */

type BackButtonEvent = { canGoBack: boolean };

type AppPlugin = {
  addListener: (
    event: "backButton" | "appStateChange" | "resume" | "pause",
    cb: (e: never) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
  exitApp: () => Promise<void>;
};

type StatusBarPlugin = {
  setStyle: (o: { style: "DARK" | "LIGHT" }) => Promise<void>;
  setBackgroundColor: (o: { color: string }) => Promise<void>;
  setOverlaysWebView: (o: { overlay: boolean }) => Promise<void>;
};

type SplashScreenPlugin = {
  hide: (o?: { fadeOutDuration?: number }) => Promise<void>;
};

function plugins(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> };
  }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins ?? null;
}

export function isNativeApp(): boolean {
  return plugins() !== null;
}

/** Routes where pressing back should ask to exit instead of navigating away. */
const ROOT_PATHS = new Set(["/", "/home", "/prayer", "/quran", "/azkar", "/more", "/onboarding", "/login"]);

let backHandlerAttached = false;

/**
 * Hardware back button.
 *
 * Without this listener Capacitor closes the Activity on every back press, from
 * any screen — the single most jarring bug in a wrapped web app. Behaviour now:
 * inner screens go back in history; tab roots require a second press within two
 * seconds to leave the app (with an Arabic hint in between).
 */
export function setupBackButton(onHint: (message: string) => void): () => void {
  const p = plugins();
  const app = p?.["App"] as AppPlugin | undefined;
  if (!app || backHandlerAttached) return () => {};
  backHandlerAttached = true;

  let exitArmed = false;
  let armTimer: ReturnType<typeof setTimeout> | null = null;
  let remove: (() => Promise<void>) | null = null;

  void app
    .addListener("backButton", ((event: BackButtonEvent) => {
      const path = window.location.pathname.replace(/\/+$/, "") || "/";
      const atRoot = ROOT_PATHS.has(path) || !event.canGoBack;

      if (!atRoot) {
        window.history.back();
        return;
      }

      if (exitArmed) {
        void app.exitApp();
        return;
      }

      exitArmed = true;
      onHint("اضغط مرة أخرى للخروج من منار");
      if (armTimer) clearTimeout(armTimer);
      armTimer = setTimeout(() => {
        exitArmed = false;
      }, 2000);
    }) as (e: never) => void)
    .then((handle) => {
      remove = handle.remove;
    });

  return () => {
    if (armTimer) clearTimeout(armTimer);
    backHandlerAttached = false;
    void remove?.();
  };
}

/** Matches the status bar to the app's current light/dark surface. */
export async function applyStatusBar(dark: boolean): Promise<void> {
  const bar = plugins()?.["StatusBar"] as StatusBarPlugin | undefined;
  if (!bar) return;
  try {
    await bar.setOverlaysWebView({ overlay: false });
    await bar.setStyle({ style: dark ? "DARK" : "LIGHT" });
    await bar.setBackgroundColor({ color: dark ? "#0B1117" : "#F8F9FA" });
  } catch {
    /* status bar styling is cosmetic — never block start-up on it */
  }
}

/**
 * Hides the splash screen. `launchAutoHide` is false so the splash stays up
 * until the first real screen is painted, avoiding a white flash.
 */
export async function hideSplash(): Promise<void> {
  const splash = plugins()?.["SplashScreen"] as SplashScreenPlugin | undefined;
  if (!splash) return;
  try {
    await splash.hide({ fadeOutDuration: 250 });
  } catch {
    /* ignore */
  }
}

/** Runs `cb` whenever the app returns to the foreground. */
export function onResume(cb: () => void): () => void {
  const app = plugins()?.["App"] as AppPlugin | undefined;
  if (!app) return () => {};
  let remove: (() => Promise<void>) | null = null;
  void app
    .addListener("appStateChange", ((state: { isActive: boolean }) => {
      if (state.isActive) cb();
    }) as (e: never) => void)
    .then((handle) => {
      remove = handle.remove;
    });
  return () => {
    void remove?.();
  };
}
