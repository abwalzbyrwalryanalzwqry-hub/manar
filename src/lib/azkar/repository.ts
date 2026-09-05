// ============================================================
// Manar — Azkar Module
// Repository: loads «حصن المسلم» dataset + search / lookup API
// ============================================================

import type { AzkarBook, AzkarChapter, AzkarGroup, Zikr, ZikrHit } from "./types";
import { buildExcerpt, normalizeArabic, tokenize } from "./normalize";

const URL = "/data/azkar/hisn-al-muslim.json";

let cache: AzkarBook | null = null;
let inflight: Promise<AzkarBook> | null = null;
/** normalized chapter title + text, per zikr, for search. */
let index: { chapter: AzkarChapter; zikr: Zikr; hay: string; title: string }[] = [];

function buildIndex(book: AzkarBook) {
  index = [];
  for (const chapter of book.chapters) {
    const title = normalizeArabic(chapter.title);
    for (const zikr of chapter.azkar) {
      index.push({ chapter, zikr, hay: normalizeArabic(zikr.text), title });
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
      hits.push({
        chapter: entry.chapter,
        zikr: entry.zikr,
        score,
        excerpt: buildExcerpt(entry.zikr.text, tokens[0]),
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
