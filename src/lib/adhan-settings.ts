/* Manar — Adhan / Iqama / Notification settings store
 * Persisted to localStorage and reactive via a tiny event-based hook.
 */

import { useEffect, useState } from "react";
import type { PrayerKey } from "./prayer";
import type { AdhanVariant, IqamaVariant } from "./adhan-sound";

export type AdhanCategory = {
  id: AdhanVariant;
  name: string;
  reciter: string;
  origin: string;
  tone: string;
  duration: string;
};

export const ADHAN_CATEGORIES: AdhanCategory[] = [
  { id: "makkah",        name: "أذان مكة المكرمة",        reciter: "الشيخ علي ملا",            origin: "المسجد الحرام",  tone: "مَقام حجاز",   duration: "٣:١٢" },
  { id: "madinah",       name: "أذان المدينة المنوّرة",     reciter: "الشيخ عبدالمجيد السريحي",   origin: "المسجد النبوي",  tone: "مَقام بياتي",  duration: "٣:٤٥" },
  { id: "aqsa",          name: "أذان المسجد الأقصى",       reciter: "الشيخ فراس قزموز",         origin: "القدس الشريف",   tone: "مَقام حجاز",   duration: "٢:٥٨" },
  { id: "gulf",          name: "أذان خليجي",              reciter: "الشيخ مشاري العفاسي",      origin: "الكويت",         tone: "مَقام نهاوند", duration: "٢:٤٠" },
  { id: "egyptian",      name: "أذان مصري",               reciter: "الشيخ محمد رفعت",          origin: "القاهرة",        tone: "مَقام صبا",    duration: "٤:٠٢" },
  { id: "fajr_tathweeb", name: "الصلاة خير من النوم",      reciter: "تثويب الفجر",              origin: "—",             tone: "مَقام حجاز",   duration: "٠:٤٠" },
  { id: "takbir",        name: "تكبير فقط",               reciter: "—",                       origin: "—",             tone: "—",            duration: "٠:٢٠" },
  { id: "short",         name: "أذان مختصر",              reciter: "—",                       origin: "—",             tone: "—",            duration: "٠:٣٠" },
  { id: "silent",        name: "إشعار صامت",              reciter: "—",                       origin: "—",             tone: "—",            duration: "—" },
];

export type IqamaCategory = {
  id: IqamaVariant;
  name: string;
  hint: string;
  duration: string;
};

export const IQAMA_CATEGORIES: IqamaCategory[] = [
  { id: "iqama_full",  name: "إقامة كاملة",              hint: "إقامة تقليدية ممتدة",        duration: "٠:٤٥" },
  { id: "iqama_qad",   name: "قد قامت الصلاة",            hint: "تنبيه قِصار للإقامة",         duration: "٠:٢٥" },
  { id: "iqama_short", name: "تنبيه قصير",                hint: "نغمة قصيرة تَنبيهية",         duration: "٠:١٠" },
  { id: "iqama_chime", name: "نغمة ناعمة",                hint: "تنبيه لطيف غير مزعج",        duration: "٠:٠٦" },
  { id: "silent",      name: "إشعار صامت",                hint: "إشعار بدون صوت",            duration: "—" },
];

export type ReminderMinutes = 5 | 10 | 15 | 30;
export const REMINDER_OPTIONS: ReminderMinutes[] = [5, 10, 15, 30];

export type AdhanSettings = {
  /* Adhan */
  adhanEnabled: boolean;
  selectedAdhan: AdhanVariant;
  fajrAdhan: AdhanVariant;
  fajrUseSeparate: boolean;
  fajrFirstAdhanEnabled: boolean;     // First Adhan (about 20 min before Fajr)
  fajrFirstAdhanOffset: number;       // minutes before Fajr
  fajrTathweebEnabled: boolean;       // الصلاة خير من النوم
  fajrReminderEnabled: boolean;

  /* Reminders */
  remindersEnabled: boolean;
  reminderMinutes: ReminderMinutes[];

  /* Iqama */
  iqamaEnabled: boolean;
  iqamaSoundEnabled: boolean;
  iqamaVariant: IqamaVariant;
  iqamaOffsets: Record<PrayerKey, number>;

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
  selectedAdhan: "makkah",
  fajrAdhan: "madinah",
  fajrUseSeparate: true,
  fajrFirstAdhanEnabled: false,
  fajrFirstAdhanOffset: 20,
  fajrTathweebEnabled: true,
  fajrReminderEnabled: true,
  remindersEnabled: true,
  reminderMinutes: [15, 5],
  iqamaEnabled: true,
  iqamaSoundEnabled: true,
  iqamaVariant: "iqama_qad",
  iqamaOffsets: { ...DEFAULT_IQAMA },
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

const LS_KEY = "manar.adhan-settings.v1";
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
      iqamaOffsets: { ...DEFAULT_IQAMA, ...(parsed.iqamaOffsets ?? {}) },
      perPrayer: { ...DEFAULTS.perPrayer, ...(parsed.perPrayer ?? {}) },
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
