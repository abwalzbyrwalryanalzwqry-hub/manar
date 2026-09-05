import { useCallback, useEffect, useState } from "react";
import { azkarRepository } from "@/lib/azkar/repository";
import type { AzkarBook } from "@/lib/azkar/types";

/** Loads the «حصن المسلم» dataset once and shares it across screens. */
export function useAzkarBook() {
  const [book, setBook] = useState<AzkarBook | null>(() => azkarRepository.getCached());
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (book) return;
    let alive = true;
    setError(null);
    azkarRepository
      .load()
      .then((b) => alive && setBook(b))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "تعذّر تحميل الأذكار"));
    return () => {
      alive = false;
    };
  }, [book, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return { book, loading: !book && !error, error, retry };
}
