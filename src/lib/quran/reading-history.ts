// ============================================================
// Manar — Quran Module
// Reading history: resume points, daily streak, khatmah progress
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { SURAH_META } from "./metadata";
import type { ReaderMode } from "@/lib/quran-reader-state";

const KEY = "manar.quran.history.v1";
const EVENT = "manar:quran-history";
const MAX_ENTRIES = 40;
/** Two visits to the same surah inside this window are one entry. */
const MERGE_WINDOW_MS = 30 * 60 * 1000;

export interface ReadEntry {
  surah: number;
  ayah: number;
  page: number;
  /** Juz (1..30) — shown in the history list. */
  juz: number;
  mode?: ReaderMode;
  /** Last time this position was open. */
  at: number;
}

export interface HistoryState {
  entries: ReadEntry[];
  /** `YYYY-MM-DD` → number of reading sessions recorded that day. */
  days: Record<string, number>;
  /** Furthest position ever reached, as a global ayah ordinal (1..6236). */
  furthest: number;
}

const EMPTY: HistoryState = { entries: [], days: {}, furthest: 0 };

/* ---------- Global ayah ordinals ---------- */

const OFFSETS: number[] = (() => {
  const out: number[] = [0];
  let acc = 0;
  for (const s of SURAH_META) {
    out.push(acc);
    acc += s.ayatCount;
  }
  return out;
})();

export const TOTAL_AYAHS = SURAH_META.reduce((n, s) => n + s.ayatCount, 0);

/** 1-based ordinal of an ayah across the whole Mushaf. */
export function globalAyahIndex(surah: number, ayah: number): number {
  const s = Math.min(114, Math.max(1, surah));
  const meta = SURAH_META[s - 1];
  const a = Math.min(meta.ayatCount, Math.max(1, ayah));
  return OFFSETS[s] + a;
}

/* ---------- Storage ---------- */

function dayKey(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function read(): HistoryState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<HistoryState>;
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries.slice(0, MAX_ENTRIES) : [],
      days: parsed.days && typeof parsed.days === "object" ? parsed.days : {},
      furthest: typeof parsed.furthest === "number" ? parsed.furthest : 0,
    };
  } catch {
    return EMPTY;
  }
}

function write(state: HistoryState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore quota / privacy errors */
  }
}

export function readHistory(): HistoryState {
  return read();
}

/** Records (or refreshes) a reading position. */
export function recordRead(entry: Omit<ReadEntry, "at">): void {
  const now = Date.now();
  const state = read();
  const rest = state.entries.filter(
    (e) => !(e.surah === entry.surah && now - e.at < MERGE_WINDOW_MS),
  );
  const entries = [{ ...entry, at: now }, ...rest].slice(0, MAX_ENTRIES);

  const key = dayKey(now);
  const days = { ...state.days };
  // Count one session per day per surah change.
  const sameDayRecent = state.entries.some(
    (e) => dayKey(e.at) === key && e.surah === entry.surah && now - e.at < MERGE_WINDOW_MS,
  );
  if (!sameDayRecent) days[key] = (days[key] ?? 0) + 1;

  const furthest = Math.max(state.furthest, globalAyahIndex(entry.surah, entry.ayah));
  write({ entries, days, furthest });
}

export function clearHistory(): void {
  write(EMPTY);
}

export function removeHistoryEntry(at: number): void {
  const state = read();
  write({ ...state, entries: state.entries.filter((e) => e.at !== at) });
}

/* ---------- Derived stats ---------- */

/** Consecutive days ending today (or yesterday) with at least one session. */
export function computeStreak(days: Record<string, number>): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = dayKey(d.getTime());
    if ((days[key] ?? 0) > 0) {
      streak++;
    } else if (i === 0) {
      // Today may not have started yet — keep looking at yesterday.
      continue;
    } else {
      break;
    }
  }
  return streak;
}

/** The last 7 days, oldest first, for the mini chart. */
export function lastSevenDays(
  days: Record<string, number>,
): { key: string; label: string; count: number }[] {
  const labels = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const out: { key: string; label: string; count: number }[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = dayKey(d.getTime());
    out.push({ key, label: labels[d.getDay()], count: days[key] ?? 0 });
  }
  return out;
}

export interface HistorySummary {
  entries: ReadEntry[];
  last: ReadEntry | undefined;
  streak: number;
  week: { key: string; label: string; count: number }[];
  sessionsToday: number;
  totalSessions: number;
  /** 0..1 — furthest ayah reached over the whole Mushaf. */
  progress: number;
  furthest: number;
}

function summarize(state: HistoryState): HistorySummary {
  const week = lastSevenDays(state.days);
  const totals = Object.values(state.days).reduce((n, v) => n + v, 0);
  return {
    entries: state.entries,
    last: state.entries[0],
    streak: computeStreak(state.days),
    week,
    sessionsToday: week[week.length - 1]?.count ?? 0,
    totalSessions: totals,
    progress: Math.min(1, state.furthest / TOTAL_AYAHS),
    furthest: state.furthest,
  };
}

/** Reactive reading history, synced across screens and tabs. */
export function useReadingHistory(): HistorySummary & {
  clear: () => void;
  remove: (at: number) => void;
} {
  const [state, setState] = useState<HistoryState>(EMPTY);

  useEffect(() => {
    const sync = () => setState(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const clear = useCallback(() => clearHistory(), []);
  const remove = useCallback((at: number) => removeHistoryEntry(at), []);

  return { ...summarize(state), clear, remove };
}
