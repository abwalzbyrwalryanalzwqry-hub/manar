import { useEffect, useState } from "react";
import { azkarRepository } from "@/lib/azkar/repository";
import type { AzkarBook } from "@/lib/azkar/types";

/** Loads the «حصن المسلم» dataset once and shares it across screens. */
export function useAzkarBook() {
  const [book, setBook] = useState<AzkarBook | null>(() => azkarRepository.getCached());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (book) return;
    let alive = true;
    azkarRepository
      .load()
      .then((b) => alive && setBook(b))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "تعذّر تحميل الأذكار"));
    return () => {
      alive = false;
    };
  }, [book]);

  return { book, loading: !book && !error, error };
}
