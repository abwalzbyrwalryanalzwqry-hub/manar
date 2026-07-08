// ============================================================
// Manar — Quran Data Layer
// Phase 8.4 — Public barrel.
// ------------------------------------------------------------
// All Quran-related screens should import from "@/lib/quran".
// ============================================================

export type {
  RevelationType,
  NumericRange,
  SurahMeta,
  JuzMeta,
  HizbMeta,
  AyahRef,
} from "./types";
export { REVELATION_LABEL_AR } from "./types";

export { SURAH_META } from "./metadata";
export { JUZ_META, HIZB_META } from "./juz-metadata";
export { SURAH_DETAILS, MOCK_SURAH_IDS, type SurahDetail } from "./mock-data";

export { QuranRepository, quranRepository } from "./repository";

export { QuranTextService, quranTextService } from "./text-service";
export type { AyahText, SurahText, QuranIndex } from "./text-types";

export { toArabicDigits, surahDisplayName, formatRangeAr } from "./format";
