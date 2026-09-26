/* Manar — Adhan / Iqama / Reminder asset library.
 *
 * No synthesized audio. All playback is delegated to the real audio
 * engine and points at real MP3/WAV/OGG files served from /audio/*.
 * If a file is missing, the engine shows an Arabic toast and aborts —
 * we never play a placeholder tone.
 */

import {
  play as enginePlay,
  stop as engineStop,
  vibrate as engineVibrate,
  type PlayOptions,
} from "./audio-engine";
import {
  LEGACY_VARIANT_MIGRATION,
  getAdhanAsset,
  isAdhanAssetId,
  type AdhanAssetId,
} from "./adhan-library-assets";
import { getIqamahSound, type IqamahId } from "./iqamah-library";

/* ----------------------------- Reciters ------------------------------ */

export const RECITERS = [
  "makkah",
  "madinah",
  "aqsa",
  "gulf",
  "egyptian",
  "turkish",
  "hijazi",
  "yemeni",
] as const;
export type Reciter = (typeof RECITERS)[number];

export const ADHAN_STYLES = ["full", "short", "takbir"] as const;
export type AdhanStyle = (typeof ADHAN_STYLES)[number];

export type AdhanVariant =
  | `${Reciter}_${AdhanStyle}`
  | "fajr_first"
  | "fajr_second"
  | "fajr_tathweeb"
  | "silent"
  | AdhanAssetId;

/** صوت الإقامة — من مكتبة الإقامة وحدها (`iqamah-library.ts`)، لا من الأذان. */
export type IqamaVariant = IqamahId;

export type ReminderVariant = "reminder_default" | "reminder_chime";

/* ------------------------ Reciter metadata --------------------------- */

export type ReciterInfo = {
  id: Reciter;
  name: string; // Arabic display name
  origin: string;
  reciter: string;
  tone: string;
};

export const RECITER_INFO: Record<Reciter, ReciterInfo> = {
  makkah: {
    id: "makkah",
    name: "أذان مكة المكرمة",
    origin: "المسجد الحرام",
    reciter: "الشيخ علي ملا",
    tone: "مَقام حجاز",
  },
  madinah: {
    id: "madinah",
    name: "أذان المدينة المنوّرة",
    origin: "المسجد النبوي",
    reciter: "الشيخ عبدالمجيد السريحي",
    tone: "مَقام بياتي",
  },
  aqsa: {
    id: "aqsa",
    name: "أذان المسجد الأقصى",
    origin: "القدس الشريف",
    reciter: "الشيخ فراس قزموز",
    tone: "مَقام حجاز",
  },
  gulf: {
    id: "gulf",
    name: "أذان خليجي",
    origin: "الكويت",
    reciter: "الشيخ مشاري العفاسي",
    tone: "مَقام نهاوند",
  },
  egyptian: {
    id: "egyptian",
    name: "أذان مصري",
    origin: "القاهرة",
    reciter: "الشيخ محمد رفعت",
    tone: "مَقام صبا",
  },
  turkish: {
    id: "turkish",
    name: "أذان تركي",
    origin: "إسطنبول",
    reciter: "أئمة ديانت",
    tone: "مَقام صبا",
  },
  hijazi: {
    id: "hijazi",
    name: "أذان حجازي",
    origin: "الحجاز",
    reciter: "تراث الحجاز",
    tone: "مَقام حجاز",
  },
  yemeni: {
    id: "yemeni",
    name: "أذان يمني",
    origin: "صنعاء",
    reciter: "تراث اليمن",
    tone: "مَقام بياتي",
  },
};

export const ADHAN_STYLE_LABELS: Record<
  AdhanStyle,
  { name: string; hint: string; duration: string }
> = {
  full: { name: "أذان كامل", hint: "الأذان كاملاً", duration: "٣:٠٠" },
  short: { name: "أذان مختصر", hint: "نسخة مختصرة من الأذان", duration: "١:١٠" },
  takbir: { name: "تكبير فقط", hint: "التكبيرات الأربع فقط", duration: "٠:٢٠" },
};

/* --------------------------- URL mapping ----------------------------- */

/** Resolve any legacy id (أذان/فجر/إقامة/تنبيه) to a bundled recording, or null. */
function assetUrlFor(id: string): string | null {
  const direct = getAdhanAsset(id);
  if (direct) return direct.url;
  const mapped = LEGACY_VARIANT_MIGRATION[id];
  const asset = mapped ? getAdhanAsset(mapped) : null;
  return asset ? asset.url : null;
}

/** Migrate a legacy synthetic variant id to a supplied recording when one exists. */
export function migrateAdhanVariant(v: AdhanVariant): AdhanVariant {
  if (typeof v !== "string") return v;
  if (isAdhanAssetId(v)) return v;
  return (LEGACY_VARIANT_MIGRATION[v] as AdhanVariant | undefined) ?? v;
}

export function adhanVariantUrl(v: AdhanVariant): string | null {
  if (v === "silent") return null;
  const asset = getAdhanAsset(v);
  if (asset) return asset.url;
  const migrated = migrateAdhanVariant(v);
  const migratedAsset = migrated === v ? null : getAdhanAsset(migrated);
  if (migratedAsset) return migratedAsset.url;
  return assetUrlFor(v);
}

/**
 * مسار صوت الإقامة. يُحلّ من مكتبة الإقامة وحدها — لا يمرّ بـ`assetUrlFor`
 * ولا بمكتبة الأذان، فلا يمكن أن يُعاد ملفّ أذانٍ لحدث إقامة مهما كانت القيمة.
 */
export function iqamaVariantUrl(v: IqamaVariant | string | null | undefined): string | null {
  return getIqamahSound(v)?.url ?? null;
}

export function reminderUrl(v: ReminderVariant = "reminder_default"): string | null {
  return assetUrlFor(v);
}

export function makeAdhanVariant(reciter: Reciter, style: AdhanStyle): AdhanVariant {
  return `${reciter}_${style}`;
}

export function parseAdhanVariant(v: AdhanVariant): { reciter: Reciter; style: AdhanStyle } | null {
  if (v === "silent" || v === "fajr_first" || v === "fajr_second" || v === "fajr_tathweeb")
    return null;
  const asset = getAdhanAsset(v);
  if (asset) return asset.style ? { reciter: "makkah", style: asset.style } : null;
  const [reciter, style] = v.split("_") as [Reciter, AdhanStyle];
  return { reciter, style };
}

export function adhanVariantLabel(v: AdhanVariant): string {
  if (v === "silent") return "إشعار صامت";
  const asset = getAdhanAsset(v);
  if (asset) return `${asset.name} · ${asset.role}`;
  if (v === "fajr_first") return "الأذان الأول للفجر";
  if (v === "fajr_second") return "الأذان الثاني للفجر";
  if (v === "fajr_tathweeb") return "الصلاة خير من النوم";
  const p = parseAdhanVariant(v);
  if (!p) return "أذان";
  return `${RECITER_INFO[p.reciter].name} · ${ADHAN_STYLE_LABELS[p.style].name}`;
}

/* ------------------------------ API ---------------------------------- */

export type AudioOptions = PlayOptions;

export function stopAdhan() {
  engineStop();
}

export function playAdhan(variant: AdhanVariant, opts: AudioOptions = {}): () => void {
  if (variant === "silent") {
    opts.onEnd?.();
    return () => {};
  }
  const url = adhanVariantUrl(variant);
  if (!url) {
    opts.onEnd?.();
    return () => {};
  }
  return enginePlay(url, { ...opts, label: adhanVariantLabel(variant) });
}

export function playIqama(variant: IqamaVariant, opts: AudioOptions = {}): () => void {
  const sound = getIqamahSound(variant);
  if (!sound) {
    /* معرّف مجهول: نُسجّل ونتوقّف بأمان — ولا نستبدله بصوت أذان أبداً. */
    console.error(`[manar] صوت إقامة غير معروف: ${String(variant)}`);
    opts.onError?.("صوت الإقامة غير متوفر");
    return () => {};
  }
  return enginePlay(sound.url, { ...opts, label: sound.name });
}

export function playReminder(opts: AudioOptions & { variant?: ReminderVariant } = {}): () => void {
  const url = reminderUrl(opts.variant ?? "reminder_default");
  if (!url) {
    opts.onEnd?.();
    return () => {};
  }
  return enginePlay(url, { ...opts, label: "تنبيه قبل الصلاة" });
}

export const vibrate = engineVibrate;
