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
  ADHAN_ASSETS,
  LEGACY_VARIANT_MIGRATION,
  assetDurationLabel,
  getAdhanAsset,
  isAdhanAssetId,
  type AdhanAsset,
  type AdhanAssetId,
} from "./adhan-library-assets";

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

export type IqamaVariant = "iqama_full" | "iqama_qad" | "iqama_short" | "iqama_masjid" | "silent";

export type ReminderVariant = "reminder_default" | "reminder_chime";

/* ------------------------ Reciter metadata --------------------------- */

export type ReciterInfo = {
  id: Reciter;
  name: string; // Arabic display name
  origin: string;
  reciter: string;
  tone: string;
};

/**
 * كل مدخل هنا يوصف التسجيل المربوط فعليًا في `LEGACY_VARIANT_MIGRATION`.
 * البيانات مشتقّة من مكتبة الأصوات نفسها — لا أسماء مؤذنين مكتوبة يدويًا —
 * حتى لا تختلف الواجهة عن الملف الذي يُسمعه المستخدم.
 */
/** كلمات تدلّ على وصف للتسجيل لا على اسم مؤذّن. */
const ROLE_WORDS = [
  "أذان",
  "كامل",
  "قصير",
  "مختصر",
  "تكبير",
  "تكبيرتان",
  "خشوع",
  "الأول",
  "الثاني",
  "تثويب",
  "حي على الصلاة",
];

/** اسم المؤذّن كما يظهر في اسم الملف، أو وصف التسجيل إن لم يُسمَّ مؤذّن. */
function reciterNameOf(a: AdhanAsset): string {
  const dash = a.name.indexOf("—");
  if (dash === -1) return a.name.trim();
  const before = a.name.slice(0, dash).trim();
  const after = a.name.slice(dash + 1).trim();
  const isRole = (t: string) => ROLE_WORDS.some((w) => t.includes(w));
  if (!isRole(after)) return after;
  if (!isRole(before)) return before;
  return before;
}

function infoFor(id: Reciter): ReciterInfo {
  const mapped = LEGACY_VARIANT_MIGRATION[`${id}_full`];
  const asset = mapped ? getAdhanAsset(mapped) : null;
  if (!asset) {
    return { id, name: "أذان", origin: "—", reciter: "—", tone: "—" };
  }
  return {
    id,
    name: asset.name,
    origin: asset.region,
    reciter: reciterNameOf(asset),
    tone: `${assetDurationLabel(asset)} · ${asset.format.toUpperCase()}`,
  };
}

export const RECITER_INFO: Record<Reciter, ReciterInfo> = RECITERS.reduce(
  (acc, r) => {
    acc[r] = infoFor(r);
    return acc;
  },
  {} as Record<Reciter, ReciterInfo>,
);

/** نطاق المدد الحقيقي للتسجيلات المتوفرة لكل نمط (أقصر–أطول). */
function styleDurationLabel(style: AdhanStyle): string {
  const pool = ADHAN_ASSETS.filter((a) => a.slot === "adhan" && a.style === style);
  if (!pool.length) return "—";
  const sorted = [...pool].sort((a, b) => a.durationSec - b.durationSec);
  const lo = assetDurationLabel(sorted[0]);
  const hi = assetDurationLabel(sorted[sorted.length - 1]);
  return lo === hi ? lo : `${lo} – ${hi}`;
}

export const ADHAN_STYLE_LABELS: Record<
  AdhanStyle,
  { name: string; hint: string; duration: string }
> = {
  full: { name: "أذان كامل", hint: "الأذان كاملاً", duration: styleDurationLabel("full") },
  short: {
    name: "أذان مختصر",
    hint: "نسخة مختصرة من الأذان",
    duration: styleDurationLabel("short"),
  },
  takbir: { name: "تكبير فقط", hint: "التكبيرات فقط", duration: styleDurationLabel("takbir") },
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

export function iqamaVariantUrl(v: IqamaVariant): string | null {
  if (v === "silent") return null;
  return assetUrlFor(v);
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
  const migrated = migrateAdhanVariant(v);
  const migratedAsset = migrated === v ? null : getAdhanAsset(migrated);
  if (migratedAsset) return `${migratedAsset.name} · ${migratedAsset.role}`;
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
  if (variant === "silent") {
    opts.onEnd?.();
    return () => {};
  }
  const url = iqamaVariantUrl(variant);
  if (!url) {
    opts.onEnd?.();
    return () => {};
  }
  const asset = getAdhanAsset(LEGACY_VARIANT_MIGRATION[variant] ?? "");
  return enginePlay(url, { ...opts, label: asset ? `الإقامة · ${asset.name}` : "الإقامة" });
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
