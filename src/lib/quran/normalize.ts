// ============================================================
// Manar — Quran Module
// Arabic normalization tuned for the Uthmani script
// ------------------------------------------------------------
// Search must succeed regardless of tashkeel, hamza form,
// dagger alif, tatweel or the alif-wasla used by the Uthmani
// dataset. Word boundaries are preserved so a hit can be
// mapped back onto the original (fully vocalized) text.
// ============================================================

/** Harakat, small Quranic marks, superscript alif, tatweel. */
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08F0-\u08FF\u0640]/g;
const PUNCT = /[«»"'()[\]{}.,!?؟،؛:*\-_/\\|~^`]+/g;

/** Normalize a chunk of Arabic for comparison purposes. */
export function normalizeArabic(input: string): string {
  return input
    .replace(DIACRITICS, "")
    .replace(/[أإآٱٲٳٵ]/g, "ا")
    .replace(/[ىۍێ]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(PUNCT, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split a query into meaningful tokens (single letters are noise). */
export function tokenizeArabic(query: string): string[] {
  return normalizeArabic(query)
    .split(" ")
    .filter((t) => t.length > 1);
}

/** Split text into its original words plus their normalized twins. */
export function splitWords(text: string): { words: string[]; norm: string[] } {
  const words = text.split(/\s+/).filter(Boolean);
  return { words, norm: words.map((w) => normalizeArabic(w)) };
}

/**
 * Indices of the words that match any of the tokens.
 * A word matches when it contains the token — that keeps prefixed
 * particles (فـ، وـ، الـ) and attached pronouns searchable.
 */
export function matchedWordIndices(normWords: string[], tokens: string[]): number[] {
  if (!tokens.length) return [];
  const out: number[] = [];
  for (let i = 0; i < normWords.length; i++) {
    if (tokens.some((t) => normWords[i].includes(t))) out.push(i);
  }
  return out;
}

/** True when every token is present somewhere in the normalized haystack. */
export function containsAllTokens(hay: string, tokens: string[]): boolean {
  for (const t of tokens) if (!hay.includes(t)) return false;
  return true;
}
