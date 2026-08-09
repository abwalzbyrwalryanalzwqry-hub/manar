/* Manar — Supplied Adhan audio package (MANAR_AUDIO_PACKAGE v1.0.0)
 * -----------------------------------------------------------------
 * Centralised, typed catalog for the user-supplied recordings.
 * The existing audio engine (src/lib/audio-engine.ts) plays these
 * URLs unchanged — no second audio system, no transcoding.
 *
 * ⚠ RIGHTS: every recording below is `UNVERIFIED`. The package did not
 * ship license evidence. Nothing here may be treated as royalty-free,
 * copyright-free or cleared for commercial publication. Reciter names,
 * regions and roles are copied verbatim from the supplied metadata —
 * nothing is invented.
 */

import makkahMulla1 from "@/assets/audio/makkah-mulla-full-1.m4a.asset.json";
import makkahMulla2 from "@/assets/audio/makkah-mulla-full-2.m4a.asset.json";
import makkahTathweeb from "@/assets/audio/makkah-tathweeb.m4a.asset.json";
import madinahQassas from "@/assets/audio/madinah-qassas-full.m4a.asset.json";
import madinahShort from "@/assets/audio/madinah-short.m4a.asset.json";
import madinahTakbir from "@/assets/audio/madinah-takbir.m4a.asset.json";
import madinahTathweeb from "@/assets/audio/madinah-tathweeb.m4a.asset.json";
import aqsaFull from "@/assets/audio/aqsa-full.m4a.asset.json";
import aqsaShort from "@/assets/audio/aqsa-short.m4a.asset.json";
import aqsaHayya from "@/assets/audio/aqsa-hayya.m4a.asset.json";
import gulfKhushoo from "@/assets/audio/gulf-khushoo-full.mp3.asset.json";
import afasy1 from "@/assets/audio/afasy-full-1.mp3.asset.json";
import afasy2 from "@/assets/audio/afasy-full-2.mp3.asset.json";
import omarHashim from "@/assets/audio/omar-hashim-full.m4a.asset.json";
import qatami from "@/assets/audio/qatami-full.m4a.asset.json";
import dossaryShort from "@/assets/audio/dossary-short.m4a.asset.json";
import fajrDossarySecond from "@/assets/audio/fajr-dossary-second.m4a.asset.json";
import segTakbir from "@/assets/audio/segment-takbir.m4a.asset.json";
import segHayya from "@/assets/audio/segment-hayya.m4a.asset.json";
import segTathweeb from "@/assets/audio/segment-tathweeb-suraihi.m4a.asset.json";

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
  { id: "asset:makkah-mulla-1", url: makkahMulla1.url, name: "أذان مكي — علي أحمد الملا", region: "مكة", role: "أذان كامل", slot: "adhan", style: "full", durationSec: 205, format: "m4a", rightsStatus: "UNVERIFIED" },
  { id: "asset:makkah-mulla-2", url: makkahMulla2.url, name: "أذان مكي — علي ملا", region: "مكة", role: "أذان كامل", slot: "adhan", style: "full", durationSec: 248, format: "m4a", rightsStatus: "UNVERIFIED" },
  { id: "asset:madinah-qassas", url: madinahQassas.url, name: "المسجد النبوي — محمد القصاص", region: "المدينة", role: "أذان كامل", slot: "adhan", style: "full", durationSec: 234, format: "m4a", rightsStatus: "UNVERIFIED" },
  { id: "asset:aqsa-full", url: aqsaFull.url, name: "أذان المسجد الأقصى", region: "الأقصى", role: "أذان كامل", slot: "adhan", style: "full", durationSec: 220, format: "m4a", rightsStatus: "UNVERIFIED" },
  { id: "asset:gulf-khushoo", url: gulfKhushoo.url, name: "أذان خليجي — خشوع", region: "خليجي", role: "أذان كامل", slot: "adhan", style: "full", durationSec: 214, format: "mp3", rightsStatus: "UNVERIFIED" },
  { id: "asset:afasy-1", url: afasy1.url, name: "العفاسي — أذان كامل ١", region: "عام", role: "أذان كامل", slot: "adhan", style: "full", durationSec: 215, format: "mp3", rightsStatus: "UNVERIFIED" },
  { id: "asset:afasy-2", url: afasy2.url, name: "العفاسي — أذان كامل ٢", region: "عام", role: "أذان كامل", slot: "adhan", style: "full", durationSec: 243, format: "mp3", rightsStatus: "UNVERIFIED" },
  { id: "asset:omar-hashim", url: omarHashim.url, name: "عمر هاشم", region: "عام", role: "أذان كامل", slot: "adhan", style: "full", durationSec: 180, format: "m4a", rightsStatus: "UNVERIFIED" },
  { id: "asset:qatami", url: qatami.url, name: "ناصر القطامي", region: "عام", role: "أذان كامل", slot: "adhan", style: "full", durationSec: 127, format: "m4a", rightsStatus: "UNVERIFIED" },

  { id: "asset:aqsa-short", url: aqsaShort.url, name: "أذان المسجد الأقصى — قصير", region: "الأقصى", role: "أذان قصير", slot: "adhan", style: "short", durationSec: 29, format: "m4a", rightsStatus: "UNVERIFIED" },
  { id: "asset:madinah-short", url: madinahShort.url, name: "أذان مدني — قصير", region: "المدينة", role: "أذان قصير", slot: "adhan", style: "short", durationSec: 13, format: "m4a", rightsStatus: "UNVERIFIED" },
  { id: "asset:dossary-short", url: dossaryShort.url, name: "ياسر الدوسري — قصير", region: "عام", role: "أذان قصير", slot: "adhan", style: "short", durationSec: 60, format: "m4a", rightsStatus: "UNVERIFIED" },

  { id: "asset:madinah-takbir", url: madinahTakbir.url, name: "أذان مدني — تكبيرتان", region: "المدينة", role: "تكبيرتان", slot: "adhan", style: "takbir", durationSec: 14, format: "m4a", rightsStatus: "UNVERIFIED" },
  { id: "asset:segment-takbir", url: segTakbir.url, name: "الله أكبر — تكبير", region: "عام", role: "تكبير", slot: "adhan", style: "takbir", durationSec: 15, format: "m4a", rightsStatus: "UNVERIFIED" },

  { id: "asset:fajr-dossary-second", url: fajrDossarySecond.url, name: "ياسر الدوسري — الأذان الثاني للفجر", region: "الفجر", role: "الأذان الثاني للفجر", slot: "fajr_second", style: "full", durationSec: 195, format: "m4a", rightsStatus: "UNVERIFIED" },

  { id: "asset:tathweeb-madinah", url: madinahTathweeb.url, name: "الصلاة خير من النوم — الحرم المدني", region: "المدينة", role: "الصلاة خير من النوم", slot: "tathweeb", style: null, durationSec: 17, format: "m4a", rightsStatus: "UNVERIFIED" },
  { id: "asset:tathweeb-makkah", url: makkahTathweeb.url, name: "الصلاة خير من النوم — الحرم المكي", region: "مكة", role: "الصلاة خير من النوم", slot: "tathweeb", style: null, durationSec: 18, format: "m4a", rightsStatus: "UNVERIFIED" },
  { id: "asset:tathweeb-suraihi", url: segTathweeb.url, name: "الصلاة خير من النوم — السريحي", region: "عام", role: "الصلاة خير من النوم", slot: "tathweeb", style: null, durationSec: 15, format: "m4a", rightsStatus: "UNVERIFIED" },

  /* Segment recordings — catalogued only. The existing audio engine plays a
   * single file per event and has no segment-stitching capability, so these
   * are intentionally not wired into playback. */
  { id: "asset:segment-hayya", url: segHayya.url, name: "حي على الصلاة", region: "عام", role: "حي على الصلاة", slot: "segment", style: null, durationSec: 15, format: "m4a", rightsStatus: "UNVERIFIED" },
  { id: "asset:segment-hayya-aqsa", url: aqsaHayya.url, name: "حي على الصلاة — فلسطيني", region: "الأقصى", role: "حي على الصلاة", slot: "segment", style: null, durationSec: 17, format: "m4a", rightsStatus: "UNVERIFIED" },
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

export const ADHAN_ASSETS_BY_SLOT = (slot: AssetSlot) => ADHAN_ASSETS.filter((a) => a.slot === slot);

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
  makkah_full: "asset:makkah-mulla-1",
  madinah_full: "asset:madinah-qassas",
  aqsa_full: "asset:aqsa-full",
  gulf_full: "asset:gulf-khushoo",
  aqsa_short: "asset:aqsa-short",
  madinah_short: "asset:madinah-short",
  madinah_takbir: "asset:madinah-takbir",
  fajr_second: "asset:fajr-dossary-second",
  fajr_tathweeb: "asset:tathweeb-madinah",
};
