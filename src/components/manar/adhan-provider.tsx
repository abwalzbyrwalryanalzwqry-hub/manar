/* Manar — Adhan Provider
 * Mounts once at root. Polls every second, tracks fired events
 * for the current day, and fires:
 *   - pre-prayer reminders (5/10/15/30 min)
 *   - Adhan at exact prayer time (per-prayer audio assignment)
 *   - Iqama notification N minutes after Adhan
 *
 * All audio is real (MP3/WAV/OGG). No synthesized fallbacks.
 */

import { useEffect, useRef } from "react";
import { computePrayerTimes, PRAYER_ORDER, PRAYER_LABELS } from "@/lib/prayer";
import { useLocation, useSettings } from "@/lib/prayer";
import {
  getAdhanSettings,
  resolveAdhanForPrayer,
  resolveIqamaForPrayer,
} from "@/lib/adhan-settings";
import { playAdhan, playIqama, playReminder, vibrate, stopAdhan } from "@/lib/adhan-sound";
import {
  isNativeShell,
  syncNativePrayerSchedule,
  attachNativeActionListener,
} from "@/lib/native-notifications";

type FiredKey = string;

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function notify(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, dir: "rtl", lang: "ar", tag: "manar-adhan" });
  } catch {
    /* ignore */
  }
}

export function AdhanProvider() {
  const { location } = useLocation();
  const { settings: calc } = useSettings();
  const firedRef = useRef<Set<FiredKey>>(new Set());
  const lastDayRef = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    let wake: WakeLockSentinel | null = null;
    const askWake = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (t: string) => Promise<WakeLockSentinel> };
        };
        if (nav.wakeLock?.request) wake = await nav.wakeLock.request("screen");
      } catch {
        /* ignore */
      }
    };
    void askWake();
    const onVis = () => {
      if (document.visibilityState === "visible") void askWake();
    };
    document.addEventListener("visibilitychange", onVis);

    const tick = () => {
      if (cancelled) return;
      const s = getAdhanSettings();
      const now = new Date();
      const dk = dayKey(now);
      if (dk !== lastDayRef.current) {
        firedRef.current.clear();
        lastDayRef.current = dk;
      }
      const times = computePrayerTimes(location, calc, now);

      for (const p of PRAYER_ORDER) {
        if (p === "sunrise") continue;
        const at = times[p].getTime();
        const diffSec = Math.round((at - now.getTime()) / 1000);
        const per = s.perPrayer[p];

        // Reminders
        if (s.remindersEnabled && per.reminder) {
          for (const m of s.reminderMinutes) {
            if (Math.abs(diffSec - m * 60) <= 1) {
              const k = `${dk}:${p}:rem:${m}`;
              if (!firedRef.current.has(k)) {
                firedRef.current.add(k);
                notify("تذكير الصلاة", `تبقى ${m} دقيقة على صلاة ${PRAYER_LABELS[p].ar}`);
                if (s.soundEnabled && !s.silentMode) {
                  playReminder({ volume: s.volume * 0.6, silentOnMissing: true });
                }
                if (s.vibrationEnabled) vibrate([120, 80, 120]);
              }
            }
          }
        }

        // First Adhan of Fajr
        if (p === "fajr" && s.fajrFirstAdhanEnabled && s.adhanEnabled) {
          const offset = Math.max(1, s.fajrFirstAdhanOffset || 20);
          if (Math.abs(diffSec - offset * 60) <= 1) {
            const k = `${dk}:fajr:first`;
            if (!firedRef.current.has(k)) {
              firedRef.current.add(k);
              notify(
                "الأذان الأول للفجر",
                `${location.city} · يتبقى ${offset} دقيقة على أذان الفجر`,
              );
              if (s.vibrationEnabled) vibrate([200, 100, 200]);
              if (!s.silentMode && s.soundEnabled) {
                playAdhan(s.fajrFirstAdhanAudio, { volume: s.volume * 0.85 });
              }
            }
          }
        }

        // Adhan
        if (s.adhanEnabled && per.adhan && Math.abs(diffSec) <= 1) {
          const k = `${dk}:${p}:adhan`;
          if (!firedRef.current.has(k)) {
            firedRef.current.add(k);
            notify(
              `حان الآن وقت ${PRAYER_LABELS[p].ar}`,
              `${location.city} · أذان ${PRAYER_LABELS[p].ar}`,
            );
            if (s.vibrationEnabled) vibrate([300, 120, 300, 120, 600]);
            if (!s.silentMode && s.soundEnabled && !isNativeShell()) {
              const variant = resolveAdhanForPrayer(s, p);
              playAdhan(variant, {
                volume: s.volume,
                onEnd: () => {
                  if (p === "fajr" && s.fajrTathweebEnabled && !s.silentMode && s.soundEnabled) {
                    playAdhan(s.fajrTathweebAudio, { volume: s.volume * 0.9 });
                  }
                },
              });
            }
          }
        }

        // Iqama
        if (s.iqamaEnabled && per.iqama) {
          const offset = s.iqamaOffsets[p] ?? 0;
          if (offset > 0 && Math.abs(diffSec + offset * 60) <= 1) {
            const k = `${dk}:${p}:iq`;
            if (!firedRef.current.has(k)) {
              firedRef.current.add(k);
              notify(`إقامة ${PRAYER_LABELS[p].ar}`, `حان موعد إقامة الصلاة الآن`);
              if (s.vibrationEnabled) vibrate([200, 100, 200]);
              if (s.iqamaSoundEnabled && !s.silentMode && !isNativeShell()) {
                const iv = resolveIqamaForPrayer(s, p);
                playIqama(iv, { volume: s.volume * 0.85 });
              }
            }
          }
        }
      }
    };

    const id = window.setInterval(tick, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      stopAdhan();
      try {
        wake?.release();
      } catch {
        /* ignore */
      }
    };
  }, [location, calc]);

  /* Native shell (Android/iOS): hand the schedule to the OS so alerts fire
     even when the app is closed. No-op in the browser. */
  useEffect(() => {
    if (!isNativeShell()) return;
    void attachNativeActionListener(() => stopAdhan());
    void syncNativePrayerSchedule(location, calc);
    const onResume = () => {
      void syncNativePrayerSchedule(location, calc);
    };
    document.addEventListener("resume", onResume);
    document.addEventListener("visibilitychange", onResume);
    return () => {
      document.removeEventListener("resume", onResume);
      document.removeEventListener("visibilitychange", onResume);
    };
  }, [location, calc]);

  return null;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied")
    return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}
