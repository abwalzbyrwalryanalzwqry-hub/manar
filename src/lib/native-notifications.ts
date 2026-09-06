/* Manar — Native (Android/iOS) scheduled prayer notifications
 * ---------------------------------------------------------------
 * Bridges the EXISTING local prayer schedule + adhan settings to the
 * Capacitor LocalNotifications plugin, WITHOUT touching the web
 * in-app engine (`adhan-provider.tsx` / `audio-engine.ts`).
 *
 * The plugin is reached through the runtime bridge
 * (`window.Capacitor.Plugins.LocalNotifications`) so the web build has
 * zero extra dependencies and every call is a no-op in the browser.
 *
 * Schedules the next 7 days of: pre-prayer reminders, Adhan (with a
 * "إيقاف الأذان" action) and Iqama. Called on app start, on settings /
 * location change, and after a reboot (the plugin re-registers pending
 * alarms; the app also re-schedules on next launch).
 */

import { computePrayerTimes, PRAYER_ORDER, PRAYER_LABELS, type LocationState, type Settings } from "@/lib/prayer";
import { getAdhanSettings, resolveAdhanForPrayer, resolveIqamaForPrayer } from "@/lib/adhan-settings";
import { adhanVariantUrl, iqamaVariantUrl } from "@/lib/adhan-sound";

type LocalNotificationsPlugin = {
  requestPermissions: () => Promise<{ display: string }>;
  checkPermissions: () => Promise<{ display: string }>;
  registerActionTypes: (o: unknown) => Promise<void>;
  getPending: () => Promise<{ notifications: { id: number }[] }>;
  cancel: (o: { notifications: { id: number }[] }) => Promise<void>;
  schedule: (o: { notifications: unknown[] }) => Promise<void>;
  addListener: (event: string, cb: (e: unknown) => void) => Promise<unknown>;
};

const DAYS_AHEAD = 7;
const ID_BASE = 41000;

function plugin(): LocalNotificationsPlugin | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> };
  }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return (cap.Plugins?.["LocalNotifications"] as LocalNotificationsPlugin) ?? null;
}

export function isNativeShell(): boolean {
  return plugin() !== null;
}

/** Stable, collision-free id per (day, prayer, kind). */
function idFor(dayIndex: number, prayerIndex: number, kind: number, extra = 0) {
  return ID_BASE + dayIndex * 100 + prayerIndex * 10 + kind + extra * 1000;
}

/** Bare file name of a bundled sound — Android resolves res/raw/<name>. */
function soundName(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const file = url.split("/").pop();
  return file ? file.replace(/\.[a-z0-9]+$/i, "") : undefined;
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
 */
export async function syncNativePrayerSchedule(location: LocationState, calc: Settings): Promise<number> {
  const p = plugin();
  if (!p) return 0;
  if (!(await ensureNativePermission())) return 0;
  await registerActions(p);

  // Clear our previous alarms only (ids in our own range).
  try {
    const pending = await p.getPending();
    const ours = pending.notifications.filter((n) => n.id >= ID_BASE && n.id < ID_BASE + 100000);
    if (ours.length) await p.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  } catch {
    /* ignore */
  }

  const s = getAdhanSettings();
  const now = Date.now();
  const notifications: unknown[] = [];

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

      // Adhan
      if (s.adhanEnabled && per.adhan && at > now) {
        const variant = resolveAdhanForPrayer(s, prayer);
        notifications.push({
          id: idFor(d, pi, 1),
          title: `حان الآن وقت ${label}`,
          body: `${location.city} · أذان ${label}`,
          schedule: { at: new Date(at), allowWhileIdle: true },
          actionTypeId: "STOP_ADHAN",
          sound: s.silentMode || !s.soundEnabled ? undefined : soundName(adhanAudioUrl(variant)),
          smallIcon: "ic_stat_manar",
          channelId: s.silentMode ? "manar_silent" : "manar_adhan",
          extra: { kind: "adhan", prayer, variant },
        });
      }

      // Pre-prayer reminders
      if (s.remindersEnabled && per.reminder) {
        s.reminderMinutes.forEach((m, mi) => {
          const t = at - m * 60_000;
          if (t <= now) return;
          notifications.push({
            id: idFor(d, pi, 2, mi + 1),
            title: "تذكير الصلاة",
            body: `تبقى ${m} دقيقة على صلاة ${label}`,
            schedule: { at: new Date(t), allowWhileIdle: true },
            smallIcon: "ic_stat_manar",
            channelId: "manar_reminders",
            extra: { kind: "reminder", prayer, minutes: m },
          });
        });
      }

      // Iqama
      if (s.iqamaEnabled && per.iqama) {
        const offset = s.iqamaOffsets[prayer] ?? 0;
        const t = at + offset * 60_000;
        if (offset > 0 && t > now) {
          notifications.push({
            id: idFor(d, pi, 3),
            title: `إقامة ${label}`,
            body: "حان موعد إقامة الصلاة الآن",
            schedule: { at: new Date(t), allowWhileIdle: true },
            sound:
              s.silentMode || !s.iqamaSoundEnabled
                ? undefined
                : soundName(iqamaAudioUrl(resolveIqamaForPrayer(s, prayer))),
            smallIcon: "ic_stat_manar",
            channelId: "manar_iqama",
            extra: { kind: "iqama", prayer },
          });
        }
      }
    });
  }

  if (!notifications.length) return 0;
  try {
    await p.schedule({ notifications });
    return notifications.length;
  } catch {
    return 0;
  }
}

/** Wire the "إيقاف الأذان" action to the existing audio engine. */
export async function attachNativeActionListener(onStop: () => void) {
  const p = plugin();
  if (!p) return;
  try {
    await p.addListener("localNotificationActionPerformed", (e) => {
      const action = (e as { actionId?: string }).actionId;
      if (action === "stop") onStop();
    });
  } catch {
    /* ignore */
  }
}
