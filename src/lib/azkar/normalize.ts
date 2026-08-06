// ============================================================
// Manar — Azkar Module
// Arabic text normalization for smart search
// ============================================================

/**
 * Normalizes Arabic text so search works regardless of:
 *  - tashkeel / harakat and tatweel
 *  - hamza forms (أ إ آ ٱ → ا), ى → ي, ة → ه, ؤ/ئ → و/ي
 *  - Arabic-Indic digits, punctuation and quote marks
 */
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const PUNCT = /[«»"'()[\]{}.,!?؟،؛:*\-_/\\|~^`]+/g;

export function normalizeArabic(input: string): string {
  return input
    .replace(DIACRITICS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(PUNCT, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Splits a query into meaningful tokens (drops 1-char noise). */
export function tokenize(query: string): string[] {
  return normalizeArabic(query)
    .split(" ")
    .filter((t) => t.length > 1);
}

/** Builds a short excerpt of the original text around a normalized match. */
export function buildExcerpt(text: string, token: string, radius = 60): string {
  const norm = normalizeArabic(text);
  const at = norm.indexOf(token);
  if (at < 0) return text.slice(0, radius * 2);
  // Map normalized index back approximately by word position.
  const words = text.split(/\s+/);
  let acc = 0;
  let startWord = 0;
  for (let i = 0; i < words.length; i++) {
    const w = normalizeArabic(words[i]);
    if (acc + w.length + 1 > at) {
      startWord = Math.max(0, i - 4);
      break;
    }
    acc += w.length + 1;
  }
  const slice = words.slice(startWord, startWord + 22).join(" ");
  const prefix = startWord > 0 ? "… " : "";
  const suffix = startWord + 22 < words.length ? " …" : "";
  return `${prefix}${slice}${suffix}`;
}
