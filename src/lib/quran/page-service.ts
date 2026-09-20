// ============================================================
// Manar — Quran Data Layer
// Phase 8.7 — Mushaf page service (604-page Madani Mushaf)
// ------------------------------------------------------------
// Builds a page payload by composing the existing text service
// (per-Surah Uthmani JSON, already cached) with the page metadata
// carried on every Ayah (`p`) and the Surah page ranges.
// No new dataset, no images.
// ============================================================

import { SURAH_META } from "./metadata";
import { HIZB_META } from "./juz-metadata";
import { quranTextService } from "./text-service";
import type { AyahText } from "./text-types";

export const MUSHAF_PAGE_COUNT = 604;

/** Canonical Basmala as authored in the Uthmani dataset. */
export const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

export interface MushafSegment {
  surahId: number;
  nameAr: string;
  nameEn: string;
  /** True when this page contains the Surah's first Ayah. */
  startsSurah: boolean;
  /** Render the decorative Basmala above the verses. */
  showBasmala: boolean;
  ayahs: AyahText[];
}

export interface MushafPage {
  page: number;
  juz: number;
  hizb: number | undefined;
  segments: MushafSegment[];
}

export function clampPage(page: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(MUSHAF_PAGE_COUNT, Math.max(1, Math.round(page)));
}

/** Surahs whose page range covers the given Mushaf page. */
export function surahIdsOnPage(page: number): number[] {
  return SURAH_META.filter((s) => page >= s.pages.start && page <= s.pages.end).map((s) => s.id);
}

/** Hizb (1..60) that is in effect at the given page, when derivable. */
export function hizbForPage(page: number): number | undefined {
  let found: number | undefined;
  for (const h of HIZB_META) {
    if (h.startPage <= page) found = h.id;
    else break;
  }
  return found;
}

const pageCache = new Map<number, MushafPage>();
const inflight = new Map<number, Promise<MushafPage>>();

export class QuranPageService {
  async loadPage(pageInput: number): Promise<MushafPage> {
    const page = clampPage(pageInput);
    const cached = pageCache.get(page);
    if (cached) return cached;
    const pending = inflight.get(page);
    if (pending) return pending;

    const p = (async () => {
      const ids = surahIdsOnPage(page);
      const texts = await Promise.all(ids.map((id) => quranTextService.loadSurah(id)));

      const segments: MushafSegment[] = [];
      for (const text of texts) {
        const meta = SURAH_META[text.id - 1];
        let ayahs = text.ayahs.filter((a) => a.p === page);
        if (ayahs.length === 0) continue;

        const startsSurah = ayahs[0].n === 1;
        let showBasmala = false;
        if (startsSurah && text.id !== 1 && text.id !== 9) {
          const first = ayahs[0];
          if (first.t.startsWith(BASMALA)) {
            showBasmala = true;
            ayahs = [{ ...first, t: first.t.slice(BASMALA.length).trim() }, ...ayahs.slice(1)];
          }
        }

        segments.push({
          surahId: text.id,
          nameAr: meta.nameAr,
          nameEn: meta.nameEn,
          startsSurah,
          showBasmala,
          ayahs,
        });
      }

      const juz = segments[0]?.ayahs[0]?.j ?? 1;
      const result: MushafPage = {
        page,
        juz,
        hizb: hizbForPage(page),
        segments,
      };
      pageCache.set(page, result);
      inflight.delete(page);
      return result;
    })();

    inflight.set(page, p);
    return p;
  }

  getCached(page: number): MushafPage | undefined {
    return pageCache.get(clampPage(page));
  }

  /** Warm neighbouring pages for instant swipes. */
  prefetch(pages: number[]): void {
    for (const raw of pages) {
      if (raw < 1 || raw > MUSHAF_PAGE_COUNT) continue;
      const page = clampPage(raw);
      if (pageCache.has(page) || inflight.has(page)) continue;
      void this.loadPage(page).catch(() => {
        /* silent */
      });
    }
  }
}

export const quranPageService = new QuranPageService();
