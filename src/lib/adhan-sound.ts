/* Manar — Adhan / Iqama / Reminder asset library.
 *
 * No synthesized audio. All playback is delegated to the real audio
 * engine and points at real MP3/WAV/OGG files served from /audio/*.
 * If a file is missing, the engine shows an Arabic toast and aborts —
 * we never play a placeholder tone.
 */

import { play as enginePlay, stop as engineStop, vibrate as engineVibrate, type PlayOptions } from "./audio-engine";

/* ----------------------------- Reciters ------------------------------ */

export const RECITERS = [
  "makkah", "madinah", "aqsa", "gulf", "egyptian", "turkish", "hijazi", "yemeni",
] as const;
export type Reciter = (typeof RECITERS)[number];

export const ADHAN_STYLES = ["full", "short", "takbir"] as const;
export type AdhanStyle = (typeof ADHAN_STYLES)[number];

export type AdhanVariant =
  | `${Reciter}_${AdhanStyle}`
  | "fajr_first"
  | "fajr_second"
  | "fajr_tathweeb"
  | "silent";

export type IqamaVariant =
  | "iqama_full"
  | "iqama_qad"
  | "iqama_short"
  | "iqama_masjid"
  | "silent";

export type ReminderVariant = "reminder_default" | "reminder_chime";

/* ------------------------ Reciter metadata --------------------------- */

export type ReciterInfo = {
  id: Reciter;
  name: string;     // Arabic display name
  origin: string;
  reciter: string;
  tone: string;
};

export const RECITER_INFO: Record<Reciter, ReciterInfo> = {
  makkah:   { id: "makkah",   name: "أذان مكة المكرمة",      origin: "المسجد الحرام",  reciter: "الشيخ علي ملا",          tone: "مَقام حجاز"   },
  madinah:  { id: "madinah",  name: "أذان المدينة المنوّرة",   origin: "المسجد النبوي",  reciter: "الشيخ عبدالمجيد السريحي", tone: "مَقام بياتي"  },
  aqsa:     { id: "aqsa",     name: "أذان المسجد الأقصى",     origin: "القدس الشريف",  reciter: "الشيخ فراس قزموز",       tone: "مَقام حجاز"   },
  gulf:     { id: "gulf",     name: "أذان خليجي",            origin: "الكويت",        reciter: "الشيخ مشاري العفاسي",    tone: "مَقام نهاوند" },
  egyptian: { id: "egyptian", name: "أذان مصري",             origin: "القاهرة",       reciter: "الشيخ محمد رفعت",        tone: "مَقام صبا"   },
  turkish:  { id: "turkish",  name: "أذان تركي",             origin: "إسطنبول",       reciter: "أئمة ديانت",            tone: "مَقام صبا"   },
  hijazi:   { id: "hijazi",   name: "أذان حجازي",            origin: "الحجاز",        reciter: "تراث الحجاز",           tone: "مَقام حجاز"   },
  yemeni:   { id: "yemeni",   name: "أذان يمني",             origin: "صنعاء",         reciter: "تراث اليمن",            tone: "مَقام بياتي"  },
};

export const ADHAN_STYLE_LABELS: Record<AdhanStyle, { name: string; hint: string; duration: string }> = {
  full:   { name: "أذان كامل",  hint: "الأذان كاملاً",            duration: "٣:٠٠" },
  short:  { name: "أذان مختصر", hint: "نسخة مختصرة من الأذان",    duration: "١:١٠" },
  takbir: { name: "تكبير فقط",  hint: "التكبيرات الأربع فقط",     duration: "٠:٢٠" },
};

/* --------------------------- URL mapping ----------------------------- */

const FAJR_URL: Record<"fajr_first" | "fajr_second" | "fajr_tathweeb", string> = {
  fajr_first:    "/audio/fajr/fajr-first.mp3",
  fajr_second:   "/audio/fajr/fajr-second.mp3",
  fajr_tathweeb: "/audio/fajr/fajr-tathweeb.mp3",
};

const IQAMA_URL: Record<Exclude<IqamaVariant, "silent">, string> = {
  iqama_full:   "/audio/iqama/iqama-full.mp3",
  iqama_qad:    "/audio/iqama/iqama-qad.mp3",
  iqama_short:  "/audio/iqama/iqama-short.mp3",
  iqama_masjid: "/audio/iqama/iqama-masjid.mp3",
};

const REMINDER_URL: Record<ReminderVariant, string> = {
  reminder_default: "/audio/reminders/reminder-default.mp3",
  reminder_chime:   "/audio/reminders/reminder-chime.mp3",
};

export function adhanVariantUrl(v: AdhanVariant): string | null {
  if (v === "silent") return null;
  if (v === "fajr_first" || v === "fajr_second" || v === "fajr_tathweeb") return FAJR_URL[v];
  const [reciter, style] = v.split("_") as [Reciter, AdhanStyle];
  return `/audio/adhan/${reciter}-${style}.mp3`;
}

export function iqamaVariantUrl(v: IqamaVariant): string | null {
  if (v === "silent") return null;
  return IQAMA_URL[v];
}

export function reminderUrl(v: ReminderVariant = "reminder_default"): string {
  return REMINDER_URL[v];
}

export function makeAdhanVariant(reciter: Reciter, style: AdhanStyle): AdhanVariant {
  return `${reciter}_${style}`;
}

export function parseAdhanVariant(v: AdhanVariant): { reciter: Reciter; style: AdhanStyle } | null {
  if (v === "silent" || v === "fajr_first" || v === "fajr_second" || v === "fajr_tathweeb") return null;
  const [reciter, style] = v.split("_") as [Reciter, AdhanStyle];
  return { reciter, style };
}

export function adhanVariantLabel(v: AdhanVariant): string {
  if (v === "silent") return "إشعار صامت";
  if (v === "fajr_first") return "الأذان الأول للفجر";
  if (v === "fajr_second") return "الأذان الثاني للفجر";
  if (v === "fajr_tathweeb") return "الصلاة خير من النوم";
  const p = parseAdhanVariant(v)!;
  return `${RECITER_INFO[p.reciter].name} · ${ADHAN_STYLE_LABELS[p.style].name}`;
}

/* ------------------------------ API ---------------------------------- */

export type AudioOptions = PlayOptions;

export function stopAdhan() {
  engineStop();
}

export function playAdhan(variant: AdhanVariant, opts: AudioOptions = {}): () => void {
  if (variant === "silent") { opts.onEnd?.(); return () => {}; }
  const url = adhanVariantUrl(variant);
  if (!url) { opts.onEnd?.(); return () => {}; }
  return enginePlay(url, { ...opts, label: adhanVariantLabel(variant) });
}

export function playIqama(variant: IqamaVariant, opts: AudioOptions = {}): () => void {
  if (variant === "silent") { opts.onEnd?.(); return () => {}; }
  const url = iqamaVariantUrl(variant);
  if (!url) { opts.onEnd?.(); return () => {}; }
  return enginePlay(url, { ...opts, label: "الإقامة" });
}

export function playReminder(opts: AudioOptions & { variant?: ReminderVariant } = {}): () => void {
  const url = reminderUrl(opts.variant ?? "reminder_default");
  return enginePlay(url, { ...opts, label: "تنبيه قبل الصلاة" });
}

export const vibrate = engineVibrate;
