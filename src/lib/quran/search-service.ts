// ============================================================
// Manar — Quran Module
// Full-text search across the bundled Uthmani dataset
// ------------------------------------------------------------
// The index is built once, lazily, from the same local JSON files
// the reader uses (`/data/quran/uthmani/{id}.json`) — no network,
// no second copy of the text on disk.
// ============================================================

import { SURAH_META } from "./metadata";
import { quranTextService } from "./text-service";
import {
  containsAllTokens,
  matchedWordIndices,
  normalizeArabic,
  splitWords,
  tokenizeArabic,
} from "./normalize";

export type SearchScope = "all" | "surah" | "juz";

export interface SearchOptions {
  scope?: SearchScope;
  surah?: number;
  juz?: number;
  limit?: number;
}

export interface AyahHit {
  surah: number;
  nameAr: string;
  ayah: number;
  page: number;
  juz: number;
  /** Original, fully vocalized text. */
  text: string;
  /** Original words — so the UI can highlight without re-splitting. */
  words: string[];
  /** Indices inside `words` that matched the query. */
  matches: number[];
  score: number;
}

interface Entry {
  s: number;
  n: number;
  p: number;
  j: number;
  t: string;
  /** Normalized, space-joined text. */
  hay: string;
  words: string[];
  norm: string[];
}

export type BuildProgress = (loaded: number, total: number) => void;

const RECENT_KEY = "manar.quran.search.recent.v1";
const RECENT_MAX = 8;

class QuranSearchService {
  private entries: Entry[] = [];
  private building: Promise<void> | null = null;
  private listeners = new Set<BuildProgress>();
  private loaded = 0;

  get ready(): boolean {
    return this.entries.length > 0 && !this.building;
  }

  get progress(): { loaded: number; total: number } {
    return { loaded: this.loaded, total: SURAH_META.length };
  }

  onProgress(fn: BuildProgress): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn(this.loaded, SURAH_META.length);
  }

  /** Build (or await) the in-memory index. Safe to call repeatedly. */
  async build(): Promise<void> {
    if (this.ready) return;
    if (this.building) return this.building;

    this.building = (async () => {
      const next: Entry[] = [];
      this.loaded = 0;
      this.emit();

      // Load in small batches to keep the UI responsive on mid-range phones.
      const BATCH = 6;
      for (let start = 1; start <= SURAH_META.length; start += BATCH) {
        const ids: number[] = [];
        for (let id = start; id < start + BATCH && id <= SURAH_META.length; id++) ids.push(id);
        const surahs = await Promise.all(ids.map((id) => quranTextService.loadSurah(id)));
        for (const surah of surahs) {
          for (const a of surah.ayahs) {
            const { words, norm } = splitWords(a.t);
            next.push({
              s: surah.id,
              n: a.n,
              p: a.p,
              j: a.j,
              t: a.t,
              hay: norm.join(" "),
              words,
              norm,
            });
          }
          this.loaded++;
        }
        this.emit();
        // Yield to the event loop between batches.
        await new Promise<void>((r) => setTimeout(r, 0));
      }
      this.entries = next;
    })();

    try {
      await this.building;
    } finally {
      this.building = null;
      this.emit();
    }
  }

  /** Total indexed ayahs. */
  get size(): number {
    return this.entries.length;
  }

  search(query: string, opts: SearchOptions = {}): AyahHit[] {
    const tokens = tokenizeArabic(query);
    if (!tokens.length || !this.entries.length) return [];

    const phrase = normalizeArabic(query);
    const limit = opts.limit ?? 120;
    const scope = opts.scope ?? "all";
    const hits: AyahHit[] = [];

    for (const e of this.entries) {
      if (scope === "surah" && opts.surah && e.s !== opts.surah) continue;
      if (scope === "juz" && opts.juz && e.j !== opts.juz) continue;

      const isPhrase = tokens.length > 1 && e.hay.includes(phrase);
      if (!isPhrase && !containsAllTokens(e.hay, tokens)) continue;

      const matches = matchedWordIndices(e.norm, tokens);
      if (!matches.length) continue;

      // Exact-word matches and phrase hits rank above partial ones.
      let score = isPhrase ? 120 : 0;
      for (const i of matches) {
        if (tokens.includes(e.norm[i])) score += 8;
        else score += 3;
      }
      // Shorter ayahs with the same match are more likely to be the target.
      score += Math.max(0, 40 - e.norm.length) / 10;

      hits.push({
        surah: e.s,
        nameAr: SURAH_META[e.s - 1].nameAr,
        ayah: e.n,
        page: e.p,
        juz: e.j,
        text: e.t,
        words: e.words,
        matches,
        score,
      });
    }

    return hits
      .sort((a, b) => b.score - a.score || a.surah - b.surah || a.ayah - b.ayah)
      .slice(0, limit);
  }

  /** How many ayahs match, ignoring the display limit. */
  count(query: string, opts: SearchOptions = {}): number {
    return this.search(query, { ...opts, limit: Number.MAX_SAFE_INTEGER }).length;
  }
}

export const quranSearchService = new QuranSearchService();

/* ---------- Surah-name lookup (instant, needs no index) ---------- */

export function searchSurahNames(query: string, limit = 8) {
  const q = normalizeArabic(query);
  if (!q) return [];
  const digits = q.replace(/\D/g, "");
  return SURAH_META.filter((s) => {
    const nameAr = normalizeArabic(s.nameAr);
    return (
      nameAr.includes(q) ||
      s.nameEn.toLowerCase().includes(query.trim().toLowerCase()) ||
      (digits.length > 0 && String(s.id) === digits)
    );
  }).slice(0, limit);
}

/* ---------- Recent queries ---------- */

export function readRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed.filter((v) => typeof v === "string") as string[]) : [];
  } catch {
    return [];
  }
}

export function pushRecentSearch(query: string): string[] {
  const q = query.trim();
  if (q.length < 2) return readRecentSearches();
  const next = [q, ...readRecentSearches().filter((v) => v !== q)].slice(0, RECENT_MAX);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / privacy errors */
  }
  return next;
}

export function clearRecentSearches(): void {
  try {
    window.localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignore */
  }
}
