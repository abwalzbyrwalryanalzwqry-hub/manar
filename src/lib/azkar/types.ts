// ============================================================
// Manar — Azkar Module
// Content source: كتاب «حصن المسلم» — د. سعيد بن علي بن وهف القحطاني
// ============================================================

export interface Zikr {
  /** Global sequential number as printed in the book (١..٢٦٧). */
  id: number;
  /** Verbatim Arabic text (vocalized where available in the source). */
  text: string;
  /** Recommended repetition count (1 when unspecified). */
  repeat: number;
}

export interface AzkarChapter {
  /** Chapter number as printed in the book (١..١٣٢). */
  id: number;
  title: string;
  /** Thematic group id (see AzkarGroup). */
  group: string;
  azkar: Zikr[];
  /** Source references / takhrij lines belonging to the chapter. */
  references: string[];
}

export interface AzkarGroup {
  id: string;
  title: string;
  from: number;
  to: number;
}

export interface AzkarBookMeta {
  title: string;
  subtitle: string;
  author: string;
  edition: string;
}

export interface AzkarBook {
  book: AzkarBookMeta;
  groups: AzkarGroup[];
  chapters: AzkarChapter[];
}

export interface ZikrHit {
  chapter: AzkarChapter;
  zikr: Zikr;
  /** Match score — higher is better. */
  score: number;
  /** Short excerpt around the first match. */
  excerpt: string;
}
