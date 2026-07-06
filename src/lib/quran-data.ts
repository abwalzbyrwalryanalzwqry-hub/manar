// ============================================================
// Legacy shim — kept for backward compatibility.
// New code MUST import from "@/lib/quran".
// ============================================================

import { SURAH_META, JUZ_META, toArabicDigits as toAr } from "./quran";
import type { SurahMeta } from "./quran";

/** Legacy shape used by early screens. */
export type Surah = {
  number: number;
  name: string;
  meaning?: string;
  verses: number;
  type: "مكية" | "مدنية";
};

export const SURAHS: Surah[] = SURAH_META.map((s: SurahMeta) => ({
  number: s.id,
  name: s.nameAr,
  meaning: s.meaningEn,
  verses: s.ayatCount,
  type: s.revelation === "makki" ? "مكية" : "مدنية",
}));

export const JUZ_LIST = JUZ_META.map((j) => ({
  number: j.id,
  startsAt: `${SURAH_META[j.start.surah - 1].nameAr} ${toAr(j.start.ayah)}`,
}));

export const toArabicDigits = toAr;
