/* Manar — Native (Android) scheduled prayer notifications
 * ---------------------------------------------------------------
 * Bridges the EXISTING local prayer schedule + adhan settings to the native
 * layer, WITHOUT touching the web in-app engine (`adhan-provider.tsx` /
 * `audio-engine.ts`).
 *
 * Two native surfaces are used, each for what it is actually good at:
 *
 *   • `ManarAdhan` (custom plugin, android/app/src/main/java/app/manar/islamic)
 *     — Adhan and Iqama. Exact alarms (`setExactAndAllowWhileIdle`) fire a
 *       foreground service that plays the FULL recording with audio focus and
 *       lock-screen controls. A plain notification sound gets truncated by
 *       Android after a few seconds, which is useless for a 3-4 minute Adhan.
 *   • `LocalNotifications` — pre-prayer reminders, which are ordinary short
 *     notifications and need nothing special.
 *
 * Both are reached through the runtime bridge (`window.Capacitor.Plugins`) so
 * the web build carries zero extra dependencies and every call is a no-op in a
 * browser.
 *
 * Everything is computed offline: prayer times come from `computePrayerTimes`,
 * never from the network.
 */

import {
  computePrayerTimes,
  PRAYER_ORDER,
  PRAYER_LABELS,
  type LocationState,
  type Settings,
} from "@/lib/prayer";
import {
  getAdhanSettings,
  resolveAdhanForPrayer,
  resolveIqamaForPrayer,
} from "@/lib/adhan-settings";
import { adhanVariantUrl, iqamaVariantUrl } from "@/lib/adhan-sound";
import { readReminders, reminderTimeOn, toneUrl } from "@/lib/daily-reminders";

type LocalNotificationsPlugin = {
  requestPermissions: () => Promise<{ display: string }>;
  checkPermissions: () => Promise<{ display: string }>;
  registerActionTypes: (o: unknown) => Promise<void>;
  getPending: () => Promise<{ notifications: { id: number }[] }>;
  cancel: (o: { notifications: { id: number }[] }) => Promise<void>;
  schedule: (o: { notifications: unknown[] }) => Promise<void>;
  addListener: (event: string, cb: (e: unknown) => void) => Promise<unknown>;
};

export type ManarAdhanEvent = {
  id: number;
  /** Epoch milliseconds. */
  at: number;
  /** res/raw resource name, or "" for silent mode. */
  sound: string;
  title: string;
  body: string;
  kind: "adhan" | "iqama";
};

export type NativeAdhanStatus = {
  exactAlarms: boolean;
  batteryUnrestricted: boolean;
  pending: number;
  sdk: number;
};

type ManarAdhanPlugin = {
  schedule: (o: {
    events: ManarAdhanEvent[];
  }) => Promise<{ scheduled: number; exactAlarms: boolean }>;
  cancelAll: () => Promise<void>;
  stop: () => Promise<void>;
  preview: (o: { sound: string; title?: string; body?: string }) => Promise<void>;
  status: () => Promise<NativeAdhanStatus>;
  requestExactAlarmPermission: () => Promise<{ granted: boolean; opened?: boolean }>;
  requestIgnoreBatteryOptimizations: () => Promise<{ granted: boolean; opened?: boolean }>;
  openNotificationSettings: () => Promise<void>;
};

const DAYS_AHEAD = 7;
const ID_BASE = 41000;

function capacitor() {
  if (typeof window === "undefined") return null;
  const cap = (
    window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> };
    }
  ).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap;
}

function plugin(): LocalNotificationsPlugin | null {
  const cap = capacitor();
  if (!cap) return null;
  return (cap.Plugins?.["LocalNotifications"] as LocalNotificationsPlugin) ?? null;
}

function adhanPlugin(): ManarAdhanPlugin | null {
  const cap = capacitor();
  if (!cap) return null;
  return (cap.Plugins?.["ManarAdhan"] as ManarAdhanPlugin) ?? null;
}

export function isNativeShell(): boolean {
  return capacitor() !== null;
}

/** Stable, collision-free id per (day, prayer, kind). */
function idFor(dayIndex: number, prayerIndex: number, kind: number, extra = 0) {
  return ID_BASE + dayIndex * 100 + prayerIndex * 10 + kind + extra * 1000;
}

/* مدى معرّفات تذكيرات الأذكار والوِرد — منفصل تماماً عن مدى تنبيهات الصلاة
 * أعلاه، فلا يُلغي أحدهما جدولة الآخر عند إعادة المزامنة. */
const DAILY_ID_BASE = ID_BASE + 100000;

function dailyIdFor(dayIndex: number, reminderIndex: number) {
  return DAILY_ID_BASE + dayIndex * 100 + reminderIndex;
}

/**
 * Android resource name of a bundled sound.
 *
 * `res/raw` names may only contain [a-z0-9_], so `/audio/library/makkah-mulla-full-1.mp3`
 * resolves to `makkah_mulla_full_1`. Mirrors `rawResourceName` in
 * `scripts/sync-android-raw-audio.mjs` — keep the two in sync.
 */
export function rawResourceName(url: string | undefined): string {
  if (!url) return "";
  const file = url.split("/").pop();
  if (!file) return "";
  return file
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "a$1");
}

export async function ensureNativePermission(): Promise<boolean> {
  const p = plugin();
  if (!p) return false;
  try {
    const current = await p.checkPermissions();
    if (current.display === "granted") return true;
    const asked = await p.requestPermissions();
    return asked.display === "granted";
  } catch {
    return false;
  }
}

/** Exact-alarm + battery state, so the UI can nudge the user when needed. */
export async function nativeAdhanStatus(): Promise<NativeAdhanStatus | null> {
  const p = adhanPlugin();
  if (!p) return null;
  try {
    return await p.status();
  } catch {
    return null;
  }
}

/**
 * Opens the Android 12+ "Alarms & reminders" screen. Without this permission the
 * OS downgrades our alarms to inexact ones and the Adhan drifts by minutes.
 */
export async function requestExactAlarms(): Promise<boolean> {
  const p = adhanPlugin();
  if (!p) return false;
  try {
    const r = await p.requestExactAlarmPermission();
    return r.granted;
  } catch {
    return false;
  }
}

/**
 * Asks to be excluded from battery optimisation. On Doze-aggressive OEM builds
 * this is the difference between the Adhan firing on time and not firing at all.
 */
export async function requestBatteryExemption(): Promise<boolean> {
  const p = adhanPlugin();
  if (!p) return false;
  try {
    const r = await p.requestIgnoreBatteryOptimizations();
    return r.granted;
  } catch {
    return false;
  }
}

export async function openNativeNotificationSettings(): Promise<void> {
  const p = adhanPlugin();
  if (!p) return;
  try {
    await p.openNotificationSettings();
  } catch {
    /* ignore */
  }
}

/** Stops an Adhan that is currently playing through the native service. */
export async function stopNativeAdhan(): Promise<void> {
  const p = adhanPlugin();
  if (!p) return;
  try {
    await p.stop();
  } catch {
    /* ignore */
  }
}

/** Plays a recording immediately through the native service (settings preview). */
export async function previewNativeAdhan(
  url: string | undefined,
  title = "معاينة الأذان",
): Promise<boolean> {
  const p = adhanPlugin();
  const sound = rawResourceName(url);
  if (!p || !sound) return false;
  try {
    await p.preview({ sound, title });
    return true;
  } catch {
    return false;
  }
}

let actionsRegistered = false;

async function registerActions(p: LocalNotificationsPlugin) {
  if (actionsRegistered) return;
  actionsRegistered = true;
  try {
    await p.registerActionTypes({
      types: [
        {
          id: "STOP_ADHAN",
          actions: [{ id: "stop", title: "إيقاف الأذان", destructive: true }],
        },
      ],
    });
  } catch {
    /* ignore */
  }
}

/**
 * Rebuild the whole native schedule from the local prayer computation.
 * Everything is computed offline — no network involved.
 *
 * @returns the number of scheduled items (adhan + iqama + reminders).
 */
export async function syncNativePrayerSchedule(
  location: LocationState,
  calc: Settings,
): Promise<number> {
  if (!isNativeShell()) return 0;
  if (!(await ensureNativePermission())) return 0;

  const p = plugin();
  const adhan = adhanPlugin();
  if (p) await registerActions(p);

  const s = getAdhanSettings();
  const now = Date.now();
  const reminders: unknown[] = [];
  const adhanEvents: ManarAdhanEvent[] = [];

  for (let d = 0; d < DAYS_AHEAD; d++) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + d);
    const times = computePrayerTimes(location, calc, date);

    PRAYER_ORDER.forEach((prayer, pi) => {
      if (prayer === "sunrise") return;
      const per = s.perPrayer[prayer];
      const at = times[prayer].getTime();
      const label = PRAYER_LABELS[prayer].ar;

      // Adhan — native exact alarm + foreground playback.
      if (s.adhanEnabled && per.adhan && at > now) {
        const variant = resolveAdhanForPrayer(s, prayer);
        adhanEvents.push({
          id: idFor(d, pi, 1) - ID_BASE,
          at,
          sound:
            s.silentMode || !s.soundEnabled
              ? ""
              : rawResourceName(adhanVariantUrl(variant) ?? undefined),
          title: `حان الآن وقت ${label}`,
          body: `${location.city} · أذان ${label}`,
          kind: "adhan",
        });
      }

      // Pre-prayer reminders — ordinary short notifications.
      if (s.remindersEnabled && per.reminder) {
        s.reminderMinutes.forEach((m, mi) => {
          const t = at - m * 60_000;
          if (t <= now) return;
          reminders.push({
            id: idFor(d, pi, 2, mi + 1),
            title: "تذكير الصلاة",
            body: `تبقى ${m} دقيقة على صلاة ${label}`,
            schedule: { at: new Date(t), allowWhileIdle: true },
            smallIcon: "ic_stat_manar",
            channelId: s.silentMode ? "manar_silent" : "manar_reminders",
            extra: { kind: "reminder", prayer, minutes: m },
          });
        });
      }

      // Iqama — native too, so the recording plays in full.
      if (s.iqamaEnabled && per.iqama) {
        const offset = s.iqamaOffsets[prayer] ?? 0;
        const t = at + offset * 60_000;
        if (offset > 0 && t > now) {
          adhanEvents.push({
            id: idFor(d, pi, 3) - ID_BASE,
            at: t,
            sound:
              s.silentMode || !s.iqamaSoundEnabled
                ? ""
                : rawResourceName(iqamaVariantUrl(resolveIqamaForPrayer(s, prayer)) ?? undefined),
            title: `إقامة ${label}`,
            body: "حان موعد إقامة الصلاة الآن",
            kind: "iqama",
          });
        }
      }
    });
  }

  /* ---------- تذكيرات الأذكار والوِرد ---------- */

  const daily = readReminders();
  if (daily.enabled) {
    const active = daily.items.filter((r) => r.enabled);
    for (let d = 0; d < DAYS_AHEAD; d++) {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() + d);
      const times = computePrayerTimes(location, calc, date);

      active.forEach((r, ri) => {
        const at = reminderTimeOn(r, date, (p) => times[p]);
        if (!at || at.getTime() <= now) return;
        const url = s.silentMode || !s.soundEnabled ? "" : toneUrl(r.tone);
        reminders.push({
          id: dailyIdFor(d, ri),
          title: r.name,
          body: r.body,
          schedule: { at, allowWhileIdle: true },
          smallIcon: "ic_stat_manar",
          channelId: url ? "manar_reminders" : "manar_silent",
          /* الصوت يُمرَّر باسم المورد الأصلي؛ نغمات التذكير القصيرة (٢–٦ ثوانٍ)
           * تصلح لإشعار عادي، بخلاف الأذان الذي يحتاج خدمةً أمامية. */
          sound: url ? rawResourceName(url) : undefined,
          extra: { kind: "daily-reminder", reminder: r.id, route: r.route },
        });
      });
    }
  }

  let scheduled = 0;

  if (adhan) {
    try {
      const r = await adhan.schedule({ events: adhanEvents });
      scheduled += r.scheduled;
    } catch {
      /* the reminders below are still worth scheduling */
    }
  }

  if (p) {
    // Clear our previous reminder notifications only (ids in our own range).
    try {
      const pending = await p.getPending();
      const ours = pending.notifications.filter(
        (n) => n.id >= ID_BASE && n.id < DAILY_ID_BASE + 100000,
      );
      if (ours.length) await p.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
    } catch {
      /* ignore */
    }
    if (reminders.length) {
      try {
        await p.schedule({ notifications: reminders });
        scheduled += reminders.length;
      } catch {
        /* ignore */
      }
    }
  }

  return scheduled;
}

/** Cancels every native alarm and notification Manar owns. */
export async function cancelNativeSchedule(): Promise<void> {
  const adhan = adhanPlugin();
  if (adhan) {
    try {
      await adhan.cancelAll();
    } catch {
      /* ignore */
    }
  }
  const p = plugin();
  if (!p) return;
  try {
    const pending = await p.getPending();
    const ours = pending.notifications.filter(
      (n) => n.id >= ID_BASE && n.id < DAILY_ID_BASE + 100000,
    );
    if (ours.length) await p.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  } catch {
    /* ignore */
  }
}

/** Wire the "إيقاف الأذان" action to the existing audio engine. */
export async function attachNativeActionListener(onStop: () => void) {
  const p = plugin();
  if (!p) return;
  try {
    await p.addListener("localNotificationActionPerformed", (e) => {
      const action = (e as { actionId?: string }).actionId;
      if (action === "stop") {
        void stopNativeAdhan();
        onStop();
      }
    });
  } catch {
    /* ignore */
  }
}
