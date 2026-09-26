// ============================================================
// Manar — Azkar Module
// Repository: loads «حصن المسلم» dataset + search / lookup API
// ============================================================

import type { AzkarBook, AzkarChapter, AzkarGroup, Zikr, ZikrHit, ZikrTime } from "./types";
import { buildExcerpt, normalizeArabic, tokenize } from "./normalize";

const URL = "/data/azkar/hisn-al-muslim.json";

let cache: AzkarBook | null = null;
let inflight: Promise<AzkarBook> | null = null;
/** normalized chapter title + text, per zikr, for search. */
let index: {
  chapter: AzkarChapter;
  zikr: Zikr;
  hay: string;
  title: string;
  /** لفظ الصباح وحده ولفظ المساء وحده (للذكر الذي يختلف لفظه). */
  morning: string;
  evening: string | null;
}[] = [];

function buildIndex(book: AzkarBook) {
  index = [];
  for (const chapter of book.chapters) {
    const title = normalizeArabic(chapter.title);
    for (const zikr of chapter.azkar) {
      // صيغة المساء تُفهرس مع الصباح ليجدها البحث بأيّ اللفظين.
      const body = zikr.evening ? `${zikr.text} ${zikr.evening}` : zikr.text;
      index.push({
        chapter,
        zikr,
        hay: normalizeArabic(body),
        title,
        morning: normalizeArabic(zikr.text),
        evening: zikr.evening ? normalizeArabic(zikr.evening) : null,
      });
    }
  }
}

export class AzkarRepository {
  async load(): Promise<AzkarBook> {
    if (cache) return cache;
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const res = await fetch(URL, { cache: "force-cache" });
        if (!res.ok) throw new Error(`تعذّر تحميل حصن المسلم (${res.status})`);
        const data = (await res.json()) as AzkarBook;
        // Guard against a truncated / corrupted local file.
        if (!data || !Array.isArray(data.chapters) || data.chapters.length === 0) {
          throw new Error("ملف الأذكار المحلي غير مكتمل — أعد المحاولة");
        }
        cache = data;
        buildIndex(data);
        return data;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  getCached(): AzkarBook | null {
    return cache;
  }

  chapters(): AzkarChapter[] {
    return cache?.chapters ?? [];
  }

  groups(): AzkarGroup[] {
    return cache?.groups ?? [];
  }

  chapter(id: number): AzkarChapter | undefined {
    return cache?.chapters.find((c) => c.id === id);
  }

  chaptersOfGroup(groupId: string): AzkarChapter[] {
    return this.chapters().filter((c) => c.group === groupId);
  }

  totalAzkar(): number {
    return this.chapters().reduce((n, c) => n + c.azkar.length, 0);
  }

  /** Smart search across chapter titles and zikr bodies. */
  search(query: string, limit = 60): ZikrHit[] {
    const tokens = tokenize(query);
    if (!tokens.length) return [];
    const hits: ZikrHit[] = [];
    for (const entry of index) {
      let score = 0;
      let matchedAll = true;
      for (const t of tokens) {
        const inTitle = entry.title.includes(t);
        const inBody = entry.hay.includes(t);
        if (!inTitle && !inBody) {
          matchedAll = false;
          break;
        }
        score += inTitle ? 5 : 0;
        score += inBody ? 2 : 0;
        if (entry.hay.startsWith(t)) score += 2;
      }
      if (!matchedAll) continue;
      /* إن طابق لفظُ المساء وحده فالنتيجة تُفتح على المساء وتُقتطف منه. */
      const eveningOnly =
        entry.evening != null &&
        tokens.every((t) => entry.evening!.includes(t) || entry.title.includes(t)) &&
        !tokens.every((t) => entry.morning.includes(t) || entry.title.includes(t));
      const time: ZikrTime | undefined = entry.zikr.time ?? (eveningOnly ? "evening" : undefined);
      hits.push({
        chapter: entry.chapter,
        zikr: entry.zikr,
        score,
        excerpt: buildExcerpt(
          eveningOnly && entry.zikr.evening ? entry.zikr.evening : entry.zikr.text,
          tokens[0],
        ),
        ...(time ? { time } : {}),
      });
    }
    return hits.sort((a, b) => b.score - a.score || a.zikr.id - b.zikr.id).slice(0, limit);
  }

  /** Chapter title search only — used for quick chapter jump. */
  searchChapters(query: string, limit = 40): AzkarChapter[] {
    const tokens = tokenize(query);
    if (!tokens.length) return this.chapters().slice(0, limit);
    return this.chapters()
      .filter((c) => {
        const t = normalizeArabic(c.title);
        return tokens.every((tok) => t.includes(tok));
      })
      .slice(0, limit);
  }
}

export const azkarRepository = new AzkarRepository();
