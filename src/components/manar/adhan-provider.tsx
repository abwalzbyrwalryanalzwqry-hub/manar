/* Manar — Adhan Provider
 * Mounts once at root. Polls every second, tracks fired events
 * for the current day, and fires:
 *   - pre-prayer reminders (5/10/15/30 min)
 *   - Adhan at exact prayer time (per-prayer audio assignment)
 *   - Iqama notification N minutes after Adhan
 *
 * All audio is real (MP3/M4A/OGG). No synthesized fallbacks.
 *
 * داخل أندرويد لا يُطلق هذا المحرّك شيئاً: الطبقة الأصلية (AdhanScheduler)
 * تملك الجدول كلّه بمنبّهات دقيقة تعمل والتطبيق مغلق. لو أطلق الويب أيضاً
 * لتكرّر التنبيه أو الصوت حين يكون التطبيق مفتوحاً. دوره هناك: إعادة بناء
 * الجدول عند كل تغيير (المدينة، طريقة الحساب، الإعدادات، اليوم، المنطقة الزمنية).
 */

import { useEffect, useRef } from "react";
import { computePrayerTimes, PRAYER_ORDER, PRAYER_LABELS } from "@/lib/prayer";
import { useLocation, useSettings } from "@/lib/prayer";
import {
  getAdhanSettings,
  resolveAdhanForPrayer,
  resolveIqamaForPrayer,
  effectiveVolume,
} from "@/lib/adhan-settings";
import { playAdhan, playIqama, playReminder, vibrate, stopAdhan } from "@/lib/adhan-sound";
import {
  isNativeShell,
  syncNativePrayerSchedule,
  attachNativeActionListener,
} from "@/lib/native-notifications";
import { approachClipFor } from "@/lib/prayer-approach-audio";
import { buildPrayerAlarms, type ManarAlarmEvent } from "@/lib/prayer-schedule";
import { play as enginePlay } from "@/lib/audio-engine";
import { dayKey as logDayKey, readLog } from "@/lib/activity-log";

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

    /* لا قفل لإضاءة الشاشة هنا: كان يُطلب لجلسة التطبيق كلها فيستنزف البطارية.
     * في أندرويد تتولى المنبّهات الأصلية الأذان والشاشة مطفأة، وإبقاء الشاشة
     * مضاءة صار محصوراً في القراءة والتلاوة (useKeepAwake). */

    const tick = () => {
      if (cancelled) return;
      // القشرة الأصلية: المنبّهات الأصلية وحدها تُطلق — منعاً للتكرار.
      if (isNativeShell()) return;
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
                  const clip = approachClipFor(s.reminderSound, p);
                  if (clip) {
                    enginePlay(clip.url, {
                      volume: effectiveVolume(s, "reminder"),
                      usage: "notification",
                      silentOnMissing: true,
                      label: clip.name,
                    });
                  } else {
                    playReminder({
                      volume: effectiveVolume(s, "reminder"),
                      usage: "notification",
                      silentOnMissing: true,
                    });
                  }
                }
                if (s.vibrationEnabled) vibrate([120, 80, 120]);
              }
            }
          }
        }
      }

      /* الأذان والإقامة وتنبيهاتهما — من الجدول الموحّد نفسه الذي تُسلَّم منه
       * المنبّهات الأصلية، فيتطابق السلوك بين الويب وأندرويد. كل حدث بمفتاحه
       * الفريد يُطلق مرّة واحدة. */
      const events = buildPrayerAlarms({
        settings: s,
        location,
        calc,
        now: now.getTime() - 2000,
        days: 1,
      });
      for (const e of events) {
        if (Math.abs(e.at - now.getTime()) > 1000) continue;
        if (firedRef.current.has(e.key)) continue;
        firedRef.current.add(e.key);
        fireEvent(e, s);
      }
    };

    const fireEvent = (e: ManarAlarmEvent, s: ReturnType<typeof getAdhanSettings>) => {
      notify(e.title, e.body);
      if (s.vibrationEnabled) {
        vibrate(
          e.kind === "adhan"
            ? [300, 120, 300, 120, 600]
            : e.kind === "iqama"
              ? [200, 100, 200]
              : [120, 80, 120],
        );
      }
      if (!e.sound) return; // صامت أو إشعار نصّي
      if (e.role === "fajr_first_adhan") {
        playAdhan(s.fajrFirstAdhanAudio, { volume: effectiveVolume(s, "adhan") });
      } else if (e.role === "adhan") {
        playAdhan(resolveAdhanForPrayer(s, e.prayer), {
          volume: effectiveVolume(s, "adhan"),
          onEnd: () => {
            if (e.prayer === "fajr" && s.fajrTathweebEnabled) {
              playAdhan(s.fajrTathweebAudio, { volume: effectiveVolume(s, "adhan") });
            }
          },
        });
      } else if (e.role === "iqamah") {
        // صوت الإقامة من مكتبة الإقامة وحدها.
        playIqama(resolveIqamaForPrayer(s, e.prayer), { volume: effectiveVolume(s, "iqama") });
      }
    };

    const id = window.setInterval(tick, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      stopAdhan();
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
    /* تغيير صوت تذكير (أذكار/وِرد أو قبل الصلاة) يُطبَّق على الإشعارات المُجدوَلة
     * فوراً، لا عند العودة التالية للتطبيق. مؤجَّل قليلاً ليجمع النقرات المتتالية. */
    let pending: ReturnType<typeof setTimeout> | undefined;
    const onSoundSettings = () => {
      clearTimeout(pending);
      pending = setTimeout(() => void syncNativePrayerSchedule(location, calc), 800);
    };
    window.addEventListener("manar:daily-reminders", onSoundSettings);
    window.addEventListener("manar:adhan-settings", onSoundSettings);
    // مواسم منار: تغيير تفضيلات التنبيه أو تعديل التاريخ الهجري يُعيد الجدولة.
    window.addEventListener("manar:seasons", onSoundSettings);
    window.addEventListener("manar:hijri-adjust", onSoundSettings);
    // صلاة الجمعة: تفضيلات التنبيه أو إنجاز عمل (فلا يُذكَّر بما أُنجز).
    window.addEventListener("manar:jumuah", onSoundSettings);
    // ١٢/٢٤ ساعة ونوع الأرقام: نصوص الإشعارات تُكتب بالتنسيق الجديد.
    window.addEventListener("manar:display", onSoundSettings);

    /* تغيّر اليوم أو المنطقة الزمنية والتطبيق مفتوح: نافذة الأيام السبعة تتقدّم
     * يوماً، والأوقات المطلقة تُعاد حسابها. فحصٌ خفيف كل دقيقة لا يُنشئ منبّهاً. */
    let lastDay = new Date().toDateString();
    let lastOffset = new Date().getTimezoneOffset();
    const watch = window.setInterval(() => {
      const d = new Date();
      if (d.toDateString() !== lastDay || d.getTimezoneOffset() !== lastOffset) {
        lastDay = d.toDateString();
        lastOffset = d.getTimezoneOffset();
        void syncNativePrayerSchedule(location, calc);
      }
    }, 60_000);

    return () => {
      document.removeEventListener("resume", onResume);
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("manar:daily-reminders", onSoundSettings);
      window.removeEventListener("manar:adhan-settings", onSoundSettings);
      window.removeEventListener("manar:seasons", onSoundSettings);
      window.removeEventListener("manar:hijri-adjust", onSoundSettings);
      window.removeEventListener("manar:display", onSoundSettings);
      window.removeEventListener("manar:jumuah", onSoundSettings);
      window.clearInterval(watch);
      clearTimeout(pending);
    };
  }, [location, calc]);

  /* إنجاز الوِرد أو فصل أذكار يُلغي تذكير اليوم نفسه إن لم يحن بعد (تخطّي ما أُنجز).
   * السجل يتغيّر مع كل نقرة ذكر، فلا نعيد الجدولة إلا إن تغيّر ما أُنجز فعلاً.
   * أثرٌ مستقل عن مستمعي الإعدادات أعلاه، ومؤجَّل قليلاً مثلها. */
  useEffect(() => {
    if (!isNativeShell()) return;
    /* بصمة ما يُلغي تذكيراً: جلسات الوِرد وفصول الأذكار المكتملة اليوم. */
    const wirdToday = () => {
      const d = readLog().days[logDayKey()];
      const wird = (d?.wird ?? []).slice().sort().join(",");
      const chapters = Object.keys(d?.chapters ?? {})
        .sort()
        .join(",");
      return `${wird}|${chapters}`;
    };
    let lastWird = wirdToday();
    let pending: ReturnType<typeof setTimeout> | undefined;
    let check: ReturnType<typeof setTimeout> | undefined;
    /* قراءة السجل (JSON كبير) مؤجَّلة ومجمّعة: لا تُقرأ مع كل نقرة عدّاد. */
    const onActivity = () => {
      clearTimeout(check);
      check = setTimeout(() => {
        const w = wirdToday();
        if (w === lastWird) return;
        lastWird = w;
        clearTimeout(pending);
        pending = setTimeout(() => void syncNativePrayerSchedule(location, calc), 800);
      }, 1500);
    };
    window.addEventListener("manar:activity", onActivity);
    return () => {
      window.removeEventListener("manar:activity", onActivity);
      clearTimeout(pending);
      clearTimeout(check);
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
