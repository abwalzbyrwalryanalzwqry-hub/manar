import { useCallback, useEffect, useState } from "react";

const KEY = "manar.quran.reader.v1";

export type ReaderMode = "surah" | "mushaf";

export type ReaderState = {
  surah: number; // 1..114
  juz: number; // 1..30
  bookmarked: boolean;
  mode: ReaderMode;
  page: number; // 1..604 — last opened Mushaf page
  updatedAt: number; // ms
};

const DEFAULT: ReaderState = {
  surah: 1,
  juz: 1,
  bookmarked: false,
  mode: "surah",
  page: 1,
  updatedAt: Date.now(),
};


function read(): ReaderState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<ReaderState>;
    return { ...DEFAULT, ...parsed };
  } catch {
    return DEFAULT;
  }
}

export function useReaderState() {
  const [state, setState] = useState<ReaderState>(DEFAULT);

  useEffect(() => {
    setState(read());
  }, []);

  const update = useCallback((patch: Partial<ReaderState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch, updatedAt: Date.now() };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore quota / privacy errors */
      }
      return next;
    });
  }, []);

  return [state, update] as const;
}

export function formatRelativeArabic(ms: number): string {
  const diff = Math.max(0, Date.now() - ms);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "قبل لحظات";
  const min = Math.floor(sec / 60);
  if (min < 60) return `قبل ${toAr(min)} دقيقة`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `قبل ${toAr(hr)} ساعة`;
  const day = Math.floor(hr / 24);
  return `قبل ${toAr(day)} يوم`;
}

function toAr(n: number) {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}
