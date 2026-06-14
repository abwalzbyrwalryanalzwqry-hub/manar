/* Manar — Adhan Provider
 * Mounts once at root. Polls every second, tracks fired events
 * for the current day, and fires:
 *   - pre-prayer reminders (5/10/15/30 min)
 *   - Adhan at exact prayer time
 *   - Iqama notification N minutes after Adhan
 * Survives tab visibility changes; uses requestWakeLock when possible.
 * Works fully offline (everything is computed locally).
 */

import { useEffect, useRef } from "react";
import { computePrayerTimes, PRAYER_ORDER, PRAYER_LABELS, type PrayerKey } from "@/lib/prayer";
import { useLocation, useSettings } from "@/lib/prayer";
import { getAdhanSettings } from "@/lib/adhan-settings";
import { playAdhan, playChime, playIqama, vibrate, stopAdhan } from "@/lib/adhan-sound";

type FiredKey = string; // `${dayKey}:${prayer}:${kind}:${minute?}`

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function notify(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, dir: "rtl", lang: "ar", tag: "manar-adhan" });
  } catch { /* ignore */ }
}

export function AdhanProvider() {
  const { location } = useLocation();
  const { settings: calc } = useSettings();
  const firedRef = useRef<Set<FiredKey>>(new Set());
  const lastDayRef = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    // Request a screen wake-lock so timers stay accurate when possible.
    let wake: WakeLockSentinel | null = null;
    const askWake = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<WakeLockSentinel> } };
        if (nav.wakeLock?.request) wake = await nav.wakeLock.request("screen");
      } catch { /* ignore */ }
    };
    void askWake();
    const onVis = () => { if (document.visibilityState === "visible") void askWake(); };
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
                if (s.soundEnabled && !s.silentMode) playChime(s.volume * 0.6);
                if (s.vibrationEnabled) vibrate([120, 80, 120]);
              }
            }
          }
        }

        // First Adhan of Fajr (e.g. 20 min before Fajr)
        if (p === "fajr" && s.fajrFirstAdhanEnabled && s.adhanEnabled) {
          const offset = Math.max(1, s.fajrFirstAdhanOffset || 20);
          if (Math.abs(diffSec - offset * 60) <= 1) {
            const k = `${dk}:fajr:first`;
            if (!firedRef.current.has(k)) {
              firedRef.current.add(k);
              notify("الأذان الأول للفجر", `${location.city} · يتبقى ${offset} دقيقة على أذان الفجر`);
              if (s.vibrationEnabled) vibrate([200, 100, 200]);
              if (!s.silentMode && s.soundEnabled) playAdhan("short", { volume: s.volume * 0.85 });
            }
          }
        }

        // Adhan
        if (s.adhanEnabled && per.adhan && Math.abs(diffSec) <= 1) {
          const k = `${dk}:${p}:adhan`;
          if (!firedRef.current.has(k)) {
            firedRef.current.add(k);
            notify(`حان الآن وقت ${PRAYER_LABELS[p].ar}`, `${location.city} · أذان ${PRAYER_LABELS[p].ar}`);
            if (s.vibrationEnabled) vibrate([300, 120, 300, 120, 600]);
            if (!s.silentMode && s.soundEnabled) {
              const variant = p === "fajr" && s.fajrUseSeparate ? s.fajrAdhan : s.selectedAdhan;
              playAdhan(variant, {
                volume: s.volume,
                onEnd: () => {
                  // Append tathweeb after Fajr adhan
                  if (p === "fajr" && s.fajrTathweebEnabled && !s.silentMode && s.soundEnabled) {
                    playAdhan("fajr_tathweeb", { volume: s.volume * 0.9 });
                  }
                },
              });
            }
          }
        }

        // Iqama — uses selected iqama variant
        if (s.iqamaEnabled && per.iqama) {
          const offset = s.iqamaOffsets[p] ?? 0;
          if (offset > 0 && Math.abs(diffSec + offset * 60) <= 1) {
            const k = `${dk}:${p}:iq`;
            if (!firedRef.current.has(k)) {
              firedRef.current.add(k);
              notify(`إقامة ${PRAYER_LABELS[p].ar}`, `حان موعد إقامة الصلاة الآن`);
              if (s.vibrationEnabled) vibrate([200, 100, 200]);
              if (s.iqamaSoundEnabled && !s.silentMode) {
                playIqama(s.iqamaVariant, { volume: s.volume * 0.85 });
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
      try { wake?.release(); } catch { /* ignore */ }
    };
  }, [location, calc]);

  return null;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") return Notification.permission;
  try { return await Notification.requestPermission(); } catch { return "denied"; }
}
