// ============================================================
// Manar — Quran Data Layer
// Phase 8.4 — Juz & Hizb metadata (Madani Mushaf standard).
// ============================================================

import type { JuzMeta, HizbMeta } from "./types";

const JUZ_STARTS: { surah: number; ayah: number; page: number }[] = [
  { surah: 1, ayah: 1, page: 1 },
  { surah: 2, ayah: 142, page: 22 },
  { surah: 2, ayah: 253, page: 42 },
  { surah: 3, ayah: 93, page: 62 },
  { surah: 4, ayah: 24, page: 82 },
  { surah: 4, ayah: 148, page: 102 },
  { surah: 5, ayah: 82, page: 121 },
  { surah: 6, ayah: 111, page: 142 },
  { surah: 7, ayah: 88, page: 162 },
  { surah: 8, ayah: 41, page: 182 },
  { surah: 9, ayah: 93, page: 201 },
  { surah: 11, ayah: 6, page: 222 },
  { surah: 12, ayah: 53, page: 242 },
  { surah: 15, ayah: 1, page: 262 },
  { surah: 17, ayah: 1, page: 282 },
  { surah: 18, ayah: 75, page: 302 },
  { surah: 21, ayah: 1, page: 322 },
  { surah: 23, ayah: 1, page: 342 },
  { surah: 25, ayah: 21, page: 362 },
  { surah: 27, ayah: 56, page: 382 },
  { surah: 29, ayah: 46, page: 402 },
  { surah: 33, ayah: 31, page: 422 },
  { surah: 36, ayah: 28, page: 442 },
  { surah: 39, ayah: 32, page: 462 },
  { surah: 41, ayah: 47, page: 482 },
  { surah: 46, ayah: 1, page: 502 },
  { surah: 51, ayah: 31, page: 522 },
  { surah: 58, ayah: 1, page: 542 },
  { surah: 67, ayah: 1, page: 562 },
  { surah: 78, ayah: 1, page: 582 },
];

const JUZ_NAMES_AR = [
  "الأول",
  "الثاني",
  "الثالث",
  "الرابع",
  "الخامس",
  "السادس",
  "السابع",
  "الثامن",
  "التاسع",
  "العاشر",
  "الحادي عشر",
  "الثاني عشر",
  "الثالث عشر",
  "الرابع عشر",
  "الخامس عشر",
  "السادس عشر",
  "السابع عشر",
  "الثامن عشر",
  "التاسع عشر",
  "العشرون",
  "الحادي والعشرون",
  "الثاني والعشرون",
  "الثالث والعشرون",
  "الرابع والعشرون",
  "الخامس والعشرون",
  "السادس والعشرون",
  "السابع والعشرون",
  "الثامن والعشرون",
  "التاسع والعشرون",
  "الثلاثون",
];

export const JUZ_META: readonly JuzMeta[] = JUZ_STARTS.map((j, i) => ({
  id: i + 1,
  nameAr: `الجزء ${JUZ_NAMES_AR[i]}`,
  start: { surah: j.surah, ayah: j.ayah },
  startPage: j.page,
}));

/**
 * Hizb metadata — 60 hizbs, 2 per Juz.
 * Exact ayah/page starts require a full ayah index; here we
 * expose Juz-derived starts as a reasonable stub. A later phase
 * will replace this with precise data.
 */
export const HIZB_META: readonly HizbMeta[] = Array.from({ length: 60 }, (_, i) => {
  const juz = Math.floor(i / 2) + 1;
  const juzInfo = JUZ_META[juz - 1];
  return {
    id: i + 1,
    juz,
    start: juzInfo.start,
    startPage: juzInfo.startPage,
  };
});
