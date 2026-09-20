/// <reference types="node" />
/**
 * Manar — Capacitor (Android) configuration.
 *
 * This is the single, canonical native wrapper for Manar. Do not add a
 * second Android architecture (Cordova, Bubblewrap/TWA, WebView shell).
 *
 * The web UI stays exactly as it is; native services (scheduled Adhan
 * notifications, background audio, media session, reboot rescheduling,
 * notification actions, audio focus) are provided by the Capacitor
 * plugins listed in docs/android/README.md.
 *
 * `webDir` expects a static client build produced by `vite build`
 * (see docs/android/README.md for the exact command and the remaining
 * signing step — no APK is produced inside Lovable).
 */
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.manar.islamic",
  appName: "منار",
  webDir: "dist/client",
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
    captureInput: true,
    // Offline-first: everything the core experience needs is bundled.
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      // يجب أن تبقى true: لو فشل الويب في الإقلاع لأي سبب، يخفي النظام شاشة
      // البداية تلقائيًا بدل أن يبقى التطبيق عالقًا على شاشة خضراء لا تستجيب.
      launchAutoHide: true,
      launchShowDuration: 2500,
      launchFadeOutDuration: 250,
      backgroundColor: "#0B1F1A",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_manar",
      iconColor: "#C9A227",
      sound: "adhan",
    },
  },
};

export default config;
