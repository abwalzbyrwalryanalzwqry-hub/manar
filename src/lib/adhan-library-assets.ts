/* Manar — Supplied Adhan audio package (MANAR_AUDIO_PACKAGE v1.1.0)
 * -----------------------------------------------------------------
 * Offline-first: every recording is bundled locally under
 * `public/audio/library/*.mp3` (mono, 32 kHz, ~56 kbps) so playback
 * never touches the network. The existing audio engine
 * (src/lib/audio-engine.ts) plays these paths unchanged.
 *
 * ⚠ RIGHTS: every recording below is `UNVERIFIED`. The package did not
 * ship license evidence. Nothing here may be treated as royalty-free,
 * copyright-free or cleared for commercial publication.
 */

const LIB = "/audio/library";

/* ------------------------------- Types ------------------------------- */

export type AssetRegion = "مكة" | "المدينة" | "الأقصى" | "خليجي" | "عام" | "الفجر";

/** Role, verbatim from the supplied metadata. */
export type AssetRole =
  | "أذان كامل"
  | "أذان قصير"
  | "تكبيرتان"
  | "تكبير"
  | "حي على الصلاة"
  | "الصلاة خير من النوم"
  | "الأذان الثاني للفجر";

/** Which part of the existing Manar adhan architecture the file plugs into. */
export type AssetSlot = "adhan" | "tathweeb" | "fajr_second" | "segment";

export type AdhanAssetId = `asset:${string}`;

export type AdhanAsset = {
  id: AdhanAssetId;
  url: string;
  /** Arabic display name derived from the supplied filename. */
  name: string;
  region: AssetRegion;
  role: AssetRole;
  slot: AssetSlot;
  /** Maps onto the existing full / short / takbir style filter. */
  style: "full" | "short" | "takbir" | null;
  durationSec: number;
  format: "mp3" | "m4a";
  rightsStatus: "UNVERIFIED";
};

/* ------------------------------ Catalog ------------------------------ */

export const ADHAN_ASSETS: AdhanAsset[] = [
  {
    id: "asset:makkah-mulla-1",
    url: `${LIB}/makkah-mulla-full-1.mp3`,
    name: "أذان مكي — علي أحمد الملا",
    region: "مكة",
    role: "أذان كامل",
    slot: "adhan",
    style: "full",
    durationSec: 205,
    format: "mp3",
    rightsStatus: "UNVERIFIED",
  },
  {
    id: "asset:makkah-mulla-2",
    url: `${LIB}/makkah-mulla-full-2.mp3`,
    name: "أذان مكي — علي ملا",
    region: "مكة",
    role: "أذان كامل",
    slot: "adhan",
    style: "full",
    durationSec: 248,
    format: "mp3",
    rightsStatus: "UNVERIFIED",
  },
  {
    id: "asset:madinah-qassas",
    url: `${LIB}/madinah-qassas-full.mp3`,
    name: "المسجد النبوي — محمد القصاص",
    region: "المدينة",
    role: "أذان كامل",
    slot: "adhan",
    style: "full",
    durationSec: 234,
    format: "mp3",
    rightsStatus: "UNVERIFIED",
  },
  {
    id: "asset:aqsa-full",
    url: `${LIB}/aqsa-full.mp3`,
    name: "أذان المسجد الأقصى",
    region: "الأقصى",
    role: "أذان كامل",
    slot: "adhan",
    style: "full",
    durationSec: 220,
    format: "mp3",
    rightsStatus: "UNVERIFIED",
  },
  {
    id: "asset:gulf-khushoo",
    url: `${LIB}/gulf-khushoo-full.mp3`,
    name: "أذان خليجي — خشوع",
    region: "خليجي",
    role: "أذان كامل",
    slot: "adhan",
    style: "full",
    durationSec: 214,
    format: "mp3",
    rightsStatus: "UNVERIFIED",
  },
  {
    id: "asset:afasy-1",
    url: `${LIB}/afasy-full-1.mp3`,
    name: "العفاسي — أذان كامل ١",
    region: "عام",
    role: "أذان كامل",
    slot: "adhan",
    style: "full",
    durationSec: 215,
    format: "mp3",
    rightsStatus: "UNVERIFIED",
  },
  {
    id: "asset:afasy-2",
    url: `${LIB}/afasy-full-2.mp3`,
    name: "العفاسي — أذان كامل ٢",
    region: "عام",
    role: "أذان كامل",
    slot: "adhan",
    style: "full",
    durationSec: 243,
    format: "mp3",
    rightsStatus: "UNVERIFIED",
  },
  {
    id: "asset:omar-hashim",
    url: `${LIB}/omar-hashim-full.mp3`,
    name: "عمر هاشم",
    region: "عام",
    role: "أذان كامل",
    slot: "adhan",
    style: "full",
    durationSec: 180,
    format: "mp3",
    rightsStatus: "UNVERIFIED",
  },
  {
    id: "asset:qatami",
    url: `${LIB}/qatami-full.mp3`,
    name: "ناصر القطامي",
    region: "عام",
    role: "أذان كامل",
    slot: "adhan",
    style: "full",
    durationSec: 127,
    format: "mp3",
    rightsStatus: "UNVERIFIED",
  },

  {
    id: "asset:aqsa-short",
    url: `${LIB}/aqsa-short.mp3`,
    name: "أذان المسجد الأقصى — قصير",
    region: "الأقصى",
    role: "أذان قصير",
    slot: "adhan",
    style: "short",
    durationSec: 29,
    format: "mp3",
    rightsStatus: "UNVERIFIED",
  },
  {
    id: "asset:madinah-short",
    url: `${LIB}/madinah-short.mp3`,
    name: "أذان مدني — قصير",
    region: "المدينة",
    role: "أذان قصير",
    slot: "adhan",
    style: "short",
    durationSec: 13,
    format: "mp3",
    rightsStatus: "UNVERIFIED",
  },
  {
    id: "asset:dossary-short",
    url: `${LIB}/dossary-short.mp3`,
    name: "ياسر الدوسري — قصير",
    region: "عام",
    role: "أذان قصير",
    slot: "adhan",
    style: "short",
    durationSec: 60,
    format: "mp3",
    rightsStatus: "UNVERIFIED",
  },

  {
    id: "asset:madinah-takbir",
    url: `${LIB}/madinah-takbir.mp3`,
    name: "أذان مدني — تكبيرتان",
    region: "المدينة",
    role: "تكبيرتان",
    slot: "adhan",
    style: "takbir",
    durationSec: 14,
    format: "mp3",
    rightsStatus: "UNVERIFIED",
  },
  {
    id: "asset:segment-takbir",
    url: `${LIB}/segment-takbir.mp3`,
    name: "الله أكبر — تكبير",
    region: "عام",
    role: "تكبير",
    slot: "adhan",
    style: "takbir",
    durationSec: 15,
    format: "mp3",
    rightsStatus: "UNVERIFIED",
  },

  {
    id: "asset:fajr-dossary-second",
    url: `${LIB}/fajr-dossary-second.mp3`,
    name: "ياسر الدوسري — الأذان الثاني للفجر",
    region: "الفجر",
    role: "الأذان الثاني للفجر",
    slot: "fajr_second",
    style: "full",
    durationSec: 195,
    format: "mp3",
    rightsStatus: "UNVERIFIED",
  },

  {
    id: "asset:tathweeb-madinah",
    url: `${LIB}/madinah-tathweeb.mp3`,
    name: "الصلاة خير من النوم — الحرم المدني",
    region: "المدينة",
    role: "الصلاة خير من النوم",
    slot: "tathweeb",
    style: null,
    durationSec: 17,
    format: "mp3",
    rightsStatus: "UNVERIFIED",
  },
  {
    id: "asset:tathweeb-makkah",
    url: `${LIB}/makkah-tathweeb.mp3`,
    name: "الصلاة خير من النوم — الحرم المكي",
    region: "مكة",
    role: "الصلاة خير من النوم",
    slot: "tathweeb",
    style: null,
    durationSec: 18,
    format: "mp3",
    rightsStatus: "UNVERIFIED",
  },
  {
    id: "asset:tathweeb-suraihi",
    url: `${LIB}/segment-tathweeb-suraihi.mp3`,
    name: "الصلاة خير من النوم — السريحي",
    region: "عام",
    role: "الصلاة خير من النوم",
    slot: "tathweeb",
    style: null,
    durationSec: 15,
    format: "mp3",
    rightsStatus: "UNVERIFIED",
  },

  /* Segment recordings — catalogued only. The existing audio engine plays a
   * single file per event and has no segment-stitching capability, so these
   * are intentionally not wired into playback. */
  {
    id: "asset:segment-hayya",
    url: `${LIB}/segment-hayya.mp3`,
    name: "حي على الصلاة",
    region: "عام",
    role: "حي على الصلاة",
    slot: "segment",
    style: null,
    durationSec: 15,
    format: "mp3",
    rightsStatus: "UNVERIFIED",
  },
  {
    id: "asset:segment-hayya-aqsa",
    url: `${LIB}/aqsa-hayya.mp3`,
    name: "حي على الصلاة — فلسطيني",
    region: "الأقصى",
    role: "حي على الصلاة",
    slot: "segment",
    style: null,
    durationSec: 17,
    format: "mp3",
    rightsStatus: "UNVERIFIED",
  },
];

/** Byte-for-byte duplicates reported by the package metadata — kept as
 *  documentation only; a single canonical entry exists in the catalog. */
export const ADHAN_ASSET_DUPLICATES = [
  { original: "حي على الصلاة صوت جميل.m4a", duplicateOf: "asset:segment-hayya" },
  { original: "اذان عثماني (أذان كامل).m4a", duplicateOf: "asset:aqsa-short" },
  { original: "المسجد الأقصى (أذان كامل).m4a", duplicateOf: "asset:omar-hashim" },
] as const;

export const ADHAN_ASSET_RIGHTS_NOTICE =
  "حقوق الملفات الصوتية غير مُحقَّقة (UNVERIFIED) — يُرجى التحقق من التراخيص قبل النشر.";

const BY_ID = new Map(ADHAN_ASSETS.map((a) => [a.id, a]));

export function isAdhanAssetId(v: string): v is AdhanAssetId {
  return BY_ID.has(v as AdhanAssetId);
}

export function getAdhanAsset(id: string): AdhanAsset | null {
  return BY_ID.get(id as AdhanAssetId) ?? null;
}

export const ADHAN_ASSETS_BY_SLOT = (slot: AssetSlot) =>
  ADHAN_ASSETS.filter((a) => a.slot === slot);

const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
const ar = (n: number | string) => String(n).replace(/\d/g, (d) => AR_DIGITS[+d]);

export function assetDurationLabel(a: AdhanAsset): string {
  const m = Math.floor(a.durationSec / 60);
  const s = Math.round(a.durationSec % 60);
  return `${ar(m)}:${ar(String(s).padStart(2, "0"))}`;
}

/** Legacy synthetic variant ids → closest supplied recording, so previously
 *  saved user selections keep working with the new library. */
export const LEGACY_VARIANT_MIGRATION: Record<string, AdhanAssetId> = {
  // أذان كامل
  makkah_full: "asset:makkah-mulla-1",
  madinah_full: "asset:madinah-qassas",
  aqsa_full: "asset:aqsa-full",
  gulf_full: "asset:gulf-khushoo",
  egyptian_full: "asset:omar-hashim",
  turkish_full: "asset:qatami",
  hijazi_full: "asset:makkah-mulla-2",
  yemeni_full: "asset:afasy-1",
  // أذان مختصر
  makkah_short: "asset:dossary-short",
  madinah_short: "asset:madinah-short",
  aqsa_short: "asset:aqsa-short",
  gulf_short: "asset:dossary-short",
  egyptian_short: "asset:dossary-short",
  turkish_short: "asset:madinah-short",
  hijazi_short: "asset:dossary-short",
  yemeni_short: "asset:madinah-short",
  // تكبير
  makkah_takbir: "asset:segment-takbir",
  madinah_takbir: "asset:madinah-takbir",
  aqsa_takbir: "asset:segment-takbir",
  gulf_takbir: "asset:segment-takbir",
  egyptian_takbir: "asset:segment-takbir",
  turkish_takbir: "asset:madinah-takbir",
  hijazi_takbir: "asset:segment-takbir",
  yemeni_takbir: "asset:madinah-takbir",
  // الفجر
  fajr_first: "asset:afasy-2",
  fajr_second: "asset:fajr-dossary-second",
  fajr_tathweeb: "asset:tathweeb-madinah",
  // الإقامة (لا تتوفر تسجيلات إقامة مستقلة — نستخدم مقاطع حقيقية مناسبة)
  iqama_full: "asset:segment-hayya",
  iqama_qad: "asset:segment-takbir",
  iqama_short: "asset:madinah-takbir",
  iqama_masjid: "asset:segment-hayya-aqsa",
  // تنبيه قبل الصلاة
  reminder_default: "asset:segment-hayya",
  reminder_chime: "asset:segment-takbir",
};
