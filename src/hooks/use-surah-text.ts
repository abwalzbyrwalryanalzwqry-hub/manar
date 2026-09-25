import { useCallback, useEffect, useState } from "react";
import { quranTextService } from "@/lib/quran/text-service";
import type { SurahText } from "@/lib/quran/text-types";

type State =
  | { status: "loading"; data: undefined; error: undefined }
  | { status: "ready"; data: SurahText; error: undefined }
  | { status: "error"; data: undefined; error: Error };

/** Load the Uthmani text for a Surah with cache + adjacency prefetch. */
export function useSurahText(id: number): State & { retry: () => void } {
  const [state, setState] = useState<State>(() => {
    const cached = quranTextService.getCached(id);
    return cached
      ? { status: "ready", data: cached, error: undefined }
      : { status: "loading", data: undefined, error: undefined };
  });

  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    const cached = quranTextService.getCached(id);
    if (cached) {
      setState({ status: "ready", data: cached, error: undefined });
    } else {
      setState({ status: "loading", data: undefined, error: undefined });
    }

    quranTextService
      .loadSurah(id)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data, error: undefined });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState({
            status: "error",
            data: undefined,
            error: error instanceof Error ? error : new Error(String(error)),
          });
      });

    // Prefetch neighbours for smooth flow.
    quranTextService.prefetch([id - 1, id + 1]);

    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  return { ...state, retry };
}
