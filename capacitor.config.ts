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
    // منذ أندرويد ١٦ (الاستهداف ٣٦) لا يمكن إلغاء وضع الحواف الكاملة
    // (edge-to-edge)، وقيمة Capacitor الافتراضية "disable" تجعل الويب فيو يرسم
    // تحت شريط الحالة وشريط التنقل، فيختفي أعلى الواجهة خلف الساعة.
    // "auto" يطبّق هوامش أشرطة النطاق تلقائياً على أندرويد ١٥+.
    adjustMarginsForEdgeToEdge: "auto",
    // Offline-first: everything the core experience needs is bundled.
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      // يُخفي النظام شاشة البداية تلقائيًا بعد ٣ ثوانٍ كحدٍّ أقصى، حتى لو تعطّل
      // الويب قبل أن يطلب إخفاءها — وهذا ما كان يُبقي الشاشة الخضراء ظاهرة.
      launchAutoHide: true,
      launchShowDuration: 3000,
      launchFadeOutDuration: 250,
      backgroundColor: "#0B1F1A",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_manar",
      iconColor: "#C9A227",
      sound: "adhan",
    },
  },
};

export default config;
