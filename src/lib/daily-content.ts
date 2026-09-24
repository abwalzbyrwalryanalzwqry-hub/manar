// ============================================================
// Manar — Daily content (آية اليوم + حديث اليوم)
// ------------------------------------------------------------
// Both cards on the home screen rotate once per LOCAL calendar day,
// fully offline: the verse is read from the bundled Uthmani text
// (/data/quran/uthmani) with its meaning from the bundled Tafsir
// al-Muyassar, and the hadith from the bundled, verified collection
// (/data/hadith/daily.json). The same day always yields the same pick
// on every screen and after restarts; the pick changes at midnight
// even while the app stays open.
// ============================================================

import { useEffect, useState } from "react";
import { quranTextService } from "@/lib/quran/text-service";
import { stripBasmala } from "@/lib/quran/basmala";
import { tafsirService } from "@/lib/quran/tafsir-service";
import { SURAH_META } from "@/lib/quran/metadata";

/* ---------- Day key ---------- */

/** Days since 1970-01-01 in the device's LOCAL calendar (DST-safe). */
export function localDayNumber(date: Date = new Date()): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Deterministic index for `day` within a list of `length` items. A
 * co-prime stride spreads consecutive days across the whole list, so two
 * neighbouring days never land on neighbouring (same-surah) entries.
 */
export function dailyIndex(day: number, length: number, stride: number): number {
  if (length <= 0) return 0;
  const step = gcd(stride, length) === 1 ? stride : 1;
  return (((day * step) % length) + length) % length;
}

/**
 * The local day number, re-evaluated at midnight, when the app returns
 * to the foreground, and when the system clock or timezone changes.
 */
export function useLocalDay(): number {
  const [day, setDay] = useState(() => localDayNumber());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => setDay(localDayNumber());
    const arm = () => {
      if (timer) clearTimeout(timer);
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      // Re-check at least hourly so a sleeping device or clock change
      // can never leave yesterday's card on screen for long.
      const wait = Math.min(Math.max(1000, next.getTime() - now.getTime()), 3_600_000);
      timer = setTimeout(() => {
        sync();
        arm();
      }, wait);
    };
    const onWake = () => {
      sync();
      arm();
    };
    arm();
    // فحص خفيف كل دقيقة يلتقط تغيير الساعة أو المنطقة الزمنية يدوياً.
    const poll = setInterval(sync, 60_000);
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, []);

  return day;
}

/* ---------- آية اليوم ---------- */

/**
 * Curated, self-contained verses (surah, first ayah[, last ayah]). Each
 * reads meaningfully on its own and fits the card; short consecutive
 * ayat that belong together are grouped as one range.
 */
// prettier-ignore
export const DAILY_VERSES: ReadonlyArray<readonly [number, number, number?]> = [
  [2, 152], [2, 153], [2, 186], [2, 201], [3, 8], [3, 26], [3, 92], [3, 133],
  [3, 134], [3, 139], [3, 159], [3, 173], [3, 185], [3, 190], [3, 191], [3, 200],
  [4, 28], [4, 110], [5, 8], [6, 59], [6, 162], [7, 23], [7, 55], [7, 56],
  [7, 156], [7, 199], [7, 205], [8, 2], [9, 51], [9, 129], [10, 57], [10, 62],
  [11, 6], [11, 114], [12, 86], [12, 87], [13, 11], [13, 28], [14, 7], [14, 24],
  [14, 41], [15, 49], [15, 99], [16, 18], [16, 90], [16, 97], [16, 128], [17, 23],
  [17, 24], [17, 80], [17, 82], [18, 10], [18, 46], [18, 109], [19, 4], [20, 14],
  [20, 25], [20, 46], [20, 114], [21, 83], [21, 87], [21, 89], [22, 77], [23, 1],
  [23, 97], [23, 118], [25, 63], [25, 74], [26, 80], [26, 83], [27, 62], [28, 24],
  [28, 77], [29, 45], [29, 69], [30, 21], [31, 17], [31, 18], [32, 16], [33, 41],
  [33, 56], [33, 70], [35, 15], [35, 34], [39, 10], [39, 53], [40, 44], [40, 60],
  [41, 30], [41, 34], [42, 19], [42, 40], [43, 36], [47, 7], [48, 4], [49, 10],
  [49, 13], [50, 16], [51, 56], [52, 48], [55, 13], [55, 60], [57, 4], [57, 21],
  [59, 18], [59, 19], [59, 22], [64, 11], [64, 16], [65, 3], [67, 2], [67, 14],
  [71, 10], [73, 8], [76, 25], [87, 14, 15], [93, 3], [93, 5], [94, 5, 6], [94, 7, 8],
  [96, 1], [97, 3], [99, 7], [103, 1, 3], [108, 1], [112, 1, 4],
];

const VERSE_STRIDE = 37;
const TAFSIR_EDITION = "ar-tafsir-muyassar";

export interface DailyVerse {
  day: number;
  surah: number;
  surahName: string;
  from: number;
  to: number;
  /** Uthmani text; ranges carry an Arabic ayah number after each ayah. */
  text: string;
  /** Plain text of the first ayah — used for the bookmark snapshot. */
  firstText: string;
  meaning: string;
  page: number;
  juz: number;
  /** Estimated murattal recitation length in seconds. */
  seconds: number;
}

export function dailyVerseRef(day: number): { surah: number; from: number; to: number } {
  const [surah, from, to] = DAILY_VERSES[dailyIndex(day, DAILY_VERSES.length, VERSE_STRIDE)];
  return { surah, from, to: to ?? from };
}

const AR = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
const ar = (n: number) => String(n).replace(/\d/g, (d) => AR[Number(d)]);

function cleanAyah(surah: number, n: number, t: string): string {
  // البسملة تُفصل مسبقاً في خدمة النص؛ الاستدعاء هنا احتياط للنص الخام.
  return stripBasmala(surah, n, t).replace(/۞/g, "").replace(/\s+/g, " ").trim();
}

/** ≈ words ÷ 1.6 words/s (a measured murattal pace), rounded to 5 s. */
export function estimateRecitationSeconds(text: string): number {
  const words = text.split(/\s+/).filter((w) => /[\u0621-\u064A]/.test(w)).length;
  return Math.max(5, Math.round(words / 1.6 / 5) * 5);
}

/** "٤٥ ثانية" / "٥ ثوانٍ" / "دقيقة و١٠ ثوانٍ". */
export function formatSecondsAr(total: number): string {
  const unit = (n: number) => (n >= 3 && n <= 10 ? "ثوانٍ" : "ثانية");
  if (total < 60) return `${ar(total)} ${unit(total)}`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  const min = m === 1 ? "دقيقة" : m === 2 ? "دقيقتان" : `${ar(m)} دقائق`;
  return s ? `${min} و${ar(s)} ${unit(s)}` : min;
}

export async function loadDailyVerse(day: number): Promise<DailyVerse> {
  const ref = dailyVerseRef(day);
  const text = await quranTextService.loadSurah(ref.surah);
  const ayahs = text.ayahs.filter((a) => a.n >= ref.from && a.n <= ref.to);
  if (!ayahs.length) throw new Error("تعذّر العثور على آية اليوم");
  const parts = ayahs.map((a) => cleanAyah(ref.surah, a.n, a.t));
  const joined =
    parts.length === 1 ? parts[0] : parts.map((p, i) => `${p} (${ar(ayahs[i].n)})`).join(" ");

  let meaning = "";
  try {
    const tafsir = await tafsirService.load(TAFSIR_EDITION, ref.surah);
    const seen = new Set<string>();
    meaning = ayahs
      .map((a) => (tafsir[String(a.n)] ?? "").trim())
      .filter((m) => m && !seen.has(m) && seen.add(m))
      .join(" ");
  } catch {
    meaning = "";
  }

  return {
    day,
    surah: ref.surah,
    surahName: SURAH_META.find((m) => m.id === ref.surah)?.nameAr ?? text.nameAr,
    from: ref.from,
    to: ref.to,
    text: joined,
    firstText: parts[0],
    meaning,
    page: ayahs[0].p,
    juz: ayahs[0].j,
    seconds: estimateRecitationSeconds(parts.join(" ")),
  };
}

/* ---------- حديث اليوم ---------- */

export interface DailyHadith {
  id: number;
  /** The Prophetic wording shown on the card (verbatim from the source). */
  text: string;
  narrator: string;
  /** "رضي الله عنه" / "رضي الله عنها" / "رضي الله عنهما". */
  suffix: string;
  /** "متفق عليه" | "صحيح البخاري" | "صحيح مسلم". */
  source: string;
  topic: string;
  /** Full narration with its chain, from `book`. */
  full: string;
  book: string;
}

interface HadithFile {
  edition: string;
  source: string;
  count: number;
  items: DailyHadith[];
}

const HADITH_STRIDE = 29;
let hadithCache: Promise<DailyHadith[]> | null = null;

export function loadDailyHadithList(): Promise<DailyHadith[]> {
  if (!hadithCache) {
    hadithCache = fetch("/data/hadith/daily.json", { cache: "force-cache" })
      .then((res) => {
        if (!res.ok) throw new Error(`تعذّر تحميل حديث اليوم (${res.status})`);
        return res.json() as Promise<HadithFile>;
      })
      .then((data) => {
        if (!Array.isArray(data?.items) || !data.items.length) {
          throw new Error("ملف حديث اليوم غير مكتمل");
        }
        return data.items;
      })
      .catch((err) => {
        hadithCache = null;
        throw err;
      });
  }
  return hadithCache;
}

export function pickDailyHadith(list: DailyHadith[], day: number): DailyHadith {
  return list[dailyIndex(day, list.length, HADITH_STRIDE)];
}

/* ---------- Hooks ---------- */

// Memory caches so returning to the home tab renders instantly.
let lastVerse: DailyVerse | null = null;
let lastHadith: { day: number; item: DailyHadith } | null = null;

export function useDailyVerse(day: number): DailyVerse | null {
  const [verse, setVerse] = useState<DailyVerse | null>(() =>
    lastVerse && lastVerse.day === day ? lastVerse : null,
  );
  useEffect(() => {
    let alive = true;
    if (lastVerse && lastVerse.day === day) {
      setVerse(lastVerse);
      return;
    }
    loadDailyVerse(day)
      .then((v) => {
        lastVerse = v;
        if (alive) setVerse(v);
      })
      .catch(() => {
        if (alive) setVerse(null);
      });
    return () => {
      alive = false;
    };
  }, [day]);
  return verse;
}

export function useDailyHadith(day: number): DailyHadith | null {
  const [item, setItem] = useState<DailyHadith | null>(() =>
    lastHadith && lastHadith.day === day ? lastHadith.item : null,
  );
  useEffect(() => {
    let alive = true;
    if (lastHadith && lastHadith.day === day) {
      setItem(lastHadith.item);
      return;
    }
    loadDailyHadithList()
      .then((list) => {
        const picked = pickDailyHadith(list, day);
        lastHadith = { day, item: picked };
        if (alive) setItem(picked);
      })
      .catch(() => {
        if (alive) setItem(null);
      });
    return () => {
      alive = false;
    };
  }, [day]);
  return item;
}
