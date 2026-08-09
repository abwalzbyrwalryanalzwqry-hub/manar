/* Manar — Adhan / Iqama / Notification settings store
 * Persisted to localStorage and reactive via a tiny event-based hook.
 */

import { useEffect, useState } from "react";
import { PRAYER_ORDER, type PrayerKey } from "./prayer";
import {
  ADHAN_STYLE_LABELS,
  ADHAN_STYLES,
  RECITERS,
  RECITER_INFO,
  makeAdhanVariant,
  type AdhanStyle,
  type AdhanVariant,
  type IqamaVariant,
  type Reciter,
} from "./adhan-sound";

/* ----------------------------- Catalogs ----------------------------- */

export type AdhanLibraryEntry = {
  id: AdhanVariant;
  reciter: Reciter | null;
  style: AdhanStyle;
  name: string;
  styleName: string;
  origin: string;
  reciterName: string;
  tone: string;
  duration: string;
  /** true = a real supplied recording exists for this entry. */
  available: boolean;
  rightsStatus?: "UNVERIFIED";
};

/** Supplied recordings (MANAR_AUDIO_PACKAGE) mapped into the existing entry shape. */
const SUPPLIED_ENTRIES: AdhanLibraryEntry[] = ADHAN_ASSETS.filter(
  (a) => a.style !== null && (a.slot === "adhan" || a.slot === "fajr_second"),
).map<AdhanLibraryEntry>((a) => ({
  id: a.id,
  reciter: null,
  style: a.style as AdhanStyle,
  name: a.name,
  styleName: a.role,
  origin: a.region,
  reciterName: a.role,
  tone: a.format.toUpperCase(),
  duration: assetDurationLabel(a),
  available: true,
  rightsStatus: "UNVERIFIED",
}));

/** Pre-existing catalog entries — preserved with their original ids. */
const LEGACY_ENTRIES: AdhanLibraryEntry[] = RECITERS.flatMap((r) =>
  ADHAN_STYLES.map<AdhanLibraryEntry>((s) => ({
    id: makeAdhanVariant(r, s),
    reciter: r,
    style: s,
    name: RECITER_INFO[r].name,
    styleName: ADHAN_STYLE_LABELS[s].name,
    origin: RECITER_INFO[r].origin,
    reciterName: RECITER_INFO[r].reciter,
    tone: RECITER_INFO[r].tone,
    duration: ADHAN_STYLE_LABELS[s].duration,
    available: false,
  })),
).filter((e) => !LEGACY_VARIANT_MIGRATION[e.id as string]);

export const ADHAN_LIBRARY: AdhanLibraryEntry[] = [...SUPPLIED_ENTRIES, ...LEGACY_ENTRIES];

/** Tathweeb (الصلاة خير من النوم) recordings supplied by the package. */
export const TATHWEEB_LIBRARY = ADHAN_ASSETS.filter((a) => a.slot === "tathweeb");


export type IqamaCategory = {
  id: IqamaVariant;
  name: string;
  hint: string;
  duration: string;
};

export const IQAMA_CATEGORIES: IqamaCategory[] = [
  { id: "iqama_full",   name: "إقامة كاملة",       hint: "إقامة تقليدية ممتدة",     duration: "٠:٤٥" },
  { id: "iqama_qad",    name: "قد قامت الصلاة",    hint: "تنبيه قِصار للإقامة",      duration: "٠:٢٥" },
  { id: "iqama_short",  name: "تنبيه قصير",        hint: "نغمة قصيرة تَنبيهية",     duration: "٠:١٠" },
  { id: "iqama_masjid", name: "إقامة المسجد",      hint: "على طريقة الأئمة في المساجد", duration: "٠:٣٥" },
  { id: "silent",       name: "إشعار صامت",        hint: "إشعار بدون صوت",        duration: "—" },
];

export type ReminderMinutes = 5 | 10 | 15 | 30;
export const REMINDER_OPTIONS: ReminderMinutes[] = [5, 10, 15, 30];

/* ------------------------------ Shape ------------------------------- */

export type AdhanSettings = {
  /* Adhan (global default) */
  adhanEnabled: boolean;
  selectedAdhan: AdhanVariant;

  /* Per-prayer audio assignment */
  samePerPrayer: boolean;
  perPrayerAudio: Partial<Record<PrayerKey, AdhanVariant>>;

  /* Fajr */
  fajrAdhan: AdhanVariant;
  fajrUseSeparate: boolean;
  fajrFirstAdhanEnabled: boolean;
  fajrFirstAdhanOffset: number;
  fajrFirstAdhanAudio: AdhanVariant;        // dedicated audio for first call
  fajrSecondAdhanAudio: AdhanVariant;       // dedicated audio for second call (defaults to fajrAdhan)
  fajrTathweebEnabled: boolean;
  fajrTathweebAudio: AdhanVariant;          // dedicated audio for tathweeb
  fajrReminderEnabled: boolean;

  /* Reminders */
  remindersEnabled: boolean;
  reminderMinutes: ReminderMinutes[];

  /* Iqama */
  iqamaEnabled: boolean;
  iqamaSoundEnabled: boolean;
  iqamaVariant: IqamaVariant;
  iqamaOffsets: Record<PrayerKey, number>;
  perPrayerIqama: Partial<Record<PrayerKey, IqamaVariant>>;

  /* Notifications */
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  silentMode: boolean;
  volume: number;

  /* Per-prayer toggles */
  perPrayer: Record<PrayerKey, { adhan: boolean; reminder: boolean; iqama: boolean }>;
};

export const DEFAULT_IQAMA: AdhanSettings["iqamaOffsets"] = {
  fajr: 20, sunrise: 0, dhuhr: 15, asr: 15, maghrib: 10, isha: 15,
};

const DEFAULTS: AdhanSettings = {
  adhanEnabled: true,
  selectedAdhan: "makkah_full",
  samePerPrayer: true,
  perPrayerAudio: {},
  fajrAdhan: "madinah_full",
  fajrUseSeparate: true,
  fajrFirstAdhanEnabled: false,
  fajrFirstAdhanOffset: 20,
  fajrFirstAdhanAudio: "fajr_first",
  fajrSecondAdhanAudio: "fajr_second",
  fajrTathweebEnabled: true,
  fajrTathweebAudio: "fajr_tathweeb",
  fajrReminderEnabled: true,
  remindersEnabled: true,
  reminderMinutes: [15, 5],
  iqamaEnabled: true,
  iqamaSoundEnabled: true,
  iqamaVariant: "iqama_qad",
  iqamaOffsets: { ...DEFAULT_IQAMA },
  perPrayerIqama: {},
  soundEnabled: true,
  vibrationEnabled: true,
  silentMode: false,
  volume: 0.7,
  perPrayer: {
    fajr:    { adhan: true,  reminder: true,  iqama: true },
    sunrise: { adhan: false, reminder: false, iqama: false },
    dhuhr:   { adhan: true,  reminder: true,  iqama: true },
    asr:     { adhan: true,  reminder: true,  iqama: true },
    maghrib: { adhan: true,  reminder: true,  iqama: true },
    isha:    { adhan: true,  reminder: true,  iqama: true },
  },
};

/* ----------------------------- Storage ------------------------------ */

const LS_KEY = "manar.adhan-settings.v2";
const EVT = "manar:adhan-settings";

function read(): AdhanSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...parsed,
      iqamaOffsets:   { ...DEFAULT_IQAMA, ...(parsed.iqamaOffsets ?? {}) },
      perPrayer:      { ...DEFAULTS.perPrayer, ...(parsed.perPrayer ?? {}) },
      perPrayerAudio: { ...(parsed.perPrayerAudio ?? {}) },
      perPrayerIqama: { ...(parsed.perPrayerIqama ?? {}) },
      reminderMinutes: Array.isArray(parsed.reminderMinutes) ? parsed.reminderMinutes : DEFAULTS.reminderMinutes,
    };
  } catch {
    return DEFAULTS;
  }
}

function write(next: AdhanSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVT));
  } catch { /* ignore */ }
}

export function useAdhanSettings() {
  const [settings, setState] = useState<AdhanSettings>(() => read());
  useEffect(() => {
    const onChange = () => setState(read());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  const update = (patch: Partial<AdhanSettings>) => {
    const next = { ...read(), ...patch };
    write(next);
    setState(next);
  };
  const updateDeep = (mut: (s: AdhanSettings) => AdhanSettings) => {
    const next = mut(read());
    write(next);
    setState(next);
  };
  return { settings, update, updateDeep };
}

export function getAdhanSettings(): AdhanSettings {
  return read();
}

/** Resolve the Adhan audio variant for a given prayer, honoring Fajr override
 *  and per-prayer assignments. */
export function resolveAdhanForPrayer(s: AdhanSettings, p: PrayerKey): AdhanVariant {
  if (p === "fajr" && s.fajrUseSeparate) return s.fajrAdhan;
  if (!s.samePerPrayer) {
    const v = s.perPrayerAudio[p];
    if (v) return v;
  }
  return s.selectedAdhan;
}

export function resolveIqamaForPrayer(s: AdhanSettings, p: PrayerKey): IqamaVariant {
  return s.perPrayerIqama[p] ?? s.iqamaVariant;
}

export const ADJUSTABLE_PRAYERS: PrayerKey[] = PRAYER_ORDER.filter((p) => p !== "sunrise");
