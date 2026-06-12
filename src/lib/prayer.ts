import { useEffect, useMemo, useState } from "react";
import {
  CalculationMethod,
  Coordinates,
  Madhab,
  PrayerTimes,
  SunnahTimes,
  type CalculationParameters,
} from "adhan";

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

export type PrayerKey = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";

export const PRAYER_LABELS: Record<PrayerKey, { ar: string; en: string }> = {
  fajr: { ar: "الفجر", en: "Fajr" },
  sunrise: { ar: "الشروق", en: "Shuruq" },
  dhuhr: { ar: "الظهر", en: "Dhuhr" },
  asr: { ar: "العصر", en: "Asr" },
  maghrib: { ar: "المغرب", en: "Maghrib" },
  isha: { ar: "العشاء", en: "Isha" },
};

export const PRAYER_ORDER: PrayerKey[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

export type LocationState = {
  lat: number;
  lng: number;
  city: string;
  country?: string;
  source: "gps" | "manual" | "default";
};

export type CalcMethodKey =
  | "MuslimWorldLeague"
  | "Egyptian"
  | "Karachi"
  | "UmmAlQura"
  | "Dubai"
  | "Qatar"
  | "Kuwait"
  | "MoonsightingCommittee"
  | "Singapore"
  | "Turkey"
  | "Tehran"
  | "NorthAmerica";

export type Settings = {
  method: CalcMethodKey;
  madhab: "shafi" | "hanafi";
};

/* ------------------------------------------------------------------ */
/*  Defaults & storage                                                 */
/* ------------------------------------------------------------------ */

const DEFAULT_LOCATION: LocationState = {
  lat: 24.7136,
  lng: 46.6753,
  city: "الرياض",
  country: "المملكة العربية السعودية",
  source: "default",
};

const DEFAULT_SETTINGS: Settings = { method: "UmmAlQura", madhab: "shafi" };

const LS_LOCATION = "manar.location.v1";
const LS_SETTINGS = "manar.settings.v1";
const LS_CACHE = "manar.prayer-cache.v1";

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function safeSet(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/*  Calculation helpers                                                */
/* ------------------------------------------------------------------ */

function buildParams(method: CalcMethodKey, madhab: Settings["madhab"]): CalculationParameters {
  const params = (CalculationMethod[method] ?? CalculationMethod.UmmAlQura)();
  params.madhab = madhab === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  return params;
}

export function computePrayerTimes(loc: LocationState, settings: Settings, date = new Date()): PrayerTimes {
  const coords = new Coordinates(loc.lat, loc.lng);
  return new PrayerTimes(coords, date, buildParams(settings.method, settings.madhab));
}

export function computeSunnahTimes(times: PrayerTimes): SunnahTimes {
  return new SunnahTimes(times);
}

export function pickNextPrayer(times: PrayerTimes, now = new Date()) {
  const entries: { key: PrayerKey; at: Date }[] = PRAYER_ORDER.map((k) => ({ key: k, at: times[k] }));
  // current
  let current: { key: PrayerKey; at: Date } = entries[0];
  for (const e of entries) if (e.at <= now) current = e;
  // next
  const next = entries.find((e) => e.at > now);
  return { current, next };
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useLocation() {
  const [location, setLocationState] = useState<LocationState>(() => safeGet(LS_LOCATION, DEFAULT_LOCATION));
  const [status, setStatus] = useState<"idle" | "requesting" | "granted" | "denied" | "unsupported">(
    location.source === "gps" ? "granted" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const setLocation = (next: LocationState) => {
    setLocationState(next);
    safeSet(LS_LOCATION, next);
  };

  const requestGps = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      setError("المتصفح لا يدعم تحديد الموقع");
      return;
    }
    setStatus("requesting");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: LocationState = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          city: location.city || "موقعي",
          country: location.country,
          source: "gps",
        };
        setLocation(next);
        setStatus("granted");
      },
      (err) => {
        setStatus("denied");
        setError(err.message || "تم رفض إذن الموقع");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  };

  return { location, setLocation, requestGps, status, error };
}

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(() => safeGet(LS_SETTINGS, DEFAULT_SETTINGS));
  const setSettings = (next: Settings) => {
    setSettingsState(next);
    safeSet(LS_SETTINGS, next);
  };
  return { settings, setSettings };
}

/* ------------------------------------------------------------------ */
/*  Master hook: combines all of the above + offline cache             */
/* ------------------------------------------------------------------ */

export function usePrayerSchedule() {
  const { location, setLocation, requestGps, status: locStatus, error: locError } = useLocation();
  const { settings, setSettings } = useSettings();
  const now = useNow(1000);

  const today = useMemo(() => computePrayerTimes(location, settings, now), [location, settings, now.toDateString()]); // eslint-disable-line react-hooks/exhaustive-deps
  const tomorrow = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return computePrayerTimes(location, settings, d);
  }, [location, settings, now.toDateString()]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cache last successful schedule for offline fallback
  useEffect(() => {
    try {
      safeSet(LS_CACHE, {
        date: now.toDateString(),
        location,
        settings,
        times: PRAYER_ORDER.reduce<Record<string, string>>((acc, k) => {
          acc[k] = today[k].toISOString();
          return acc;
        }, {}),
      });
    } catch {
      /* ignore */
    }
  }, [today, location, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const { current, next } = useMemo(() => {
    const t = pickNextPrayer(today, now);
    if (!t.next) {
      return { current: t.current, next: { key: "fajr" as PrayerKey, at: tomorrow.fajr } };
    }
    return { current: t.current, next: t.next };
  }, [today, tomorrow, now]);

  const remainingMs = Math.max(0, next.at.getTime() - now.getTime());

  // Progress between current prayer and next prayer (0..1)
  const intervalMs = Math.max(1, next.at.getTime() - current.at.getTime());
  const elapsedMs = Math.max(0, now.getTime() - current.at.getTime());
  const progress = Math.max(0, Math.min(1, elapsedMs / intervalMs));

  return {
    now,
    location,
    setLocation,
    requestGps,
    locStatus,
    locError,
    settings,
    setSettings,
    today,
    tomorrow,
    current,
    next,
    remainingMs,
    progress,
  };
}
