import { useCallback, useEffect, useState } from "react";

const KEY = "manar.quran.reader.v1";
/** يُطلَق بعد كل حفظ، وبعد استيراد نسخة احتياطية. */
export const READER_STATE_EVENT = "manar:reader-state";

export type ReaderMode = "surah" | "mushaf";

export type ReaderState = {
  surah: number; // 1..114
  juz: number; // 1..30
  bookmarked: boolean;
  mode: ReaderMode;
  page: number; // 1..604 — last opened Mushaf page
  /** آخر آية وقف عندها القارئ في وضع السورة. */
  ayah?: number;
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

export function readReaderState(): ReaderState {
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
    const sync = () => setState(readReaderState());
    sync();
    window.addEventListener(READER_STATE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(READER_STATE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((patch: Partial<ReaderState>) => {
    // نبني الحالة من المخزَّن (مصدر الحقيقة) ونحفظها قبل إطلاق الحدث، فلا
    // يقرأ أي مستمع قيمة قديمة.
    const next = { ...readReaderState(), ...patch, updatedAt: Date.now() };
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore quota / privacy errors */
    }
    setState(next);
    window.dispatchEvent(new Event(READER_STATE_EVENT));
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
