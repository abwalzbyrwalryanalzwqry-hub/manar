import { useEffect, useState } from "react";
import {
  clampPage,
  quranPageService,
  type MushafPage,
} from "@/lib/quran/page-service";

export type MushafPageState =
  | { status: "loading"; data: undefined; error: undefined }
  | { status: "ready"; data: MushafPage; error: undefined }
  | { status: "error"; data: undefined; error: Error };

/** Load a Mushaf page (1..604) with cache + neighbour prefetch. */
export function useMushafPage(pageInput: number): MushafPageState {
  const page = clampPage(pageInput);
  const [state, setState] = useState<MushafPageState>(() => {
    const cached = quranPageService.getCached(page);
    return cached
      ? { status: "ready", data: cached, error: undefined }
      : { status: "loading", data: undefined, error: undefined };
  });

  useEffect(() => {
    let cancelled = false;
    const cached = quranPageService.getCached(page);
    setState(
      cached
        ? { status: "ready", data: cached, error: undefined }
        : { status: "loading", data: undefined, error: undefined },
    );

    quranPageService
      .loadPage(page)
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

    quranPageService.prefetch([page - 1, page + 1, page + 2]);

    return () => {
      cancelled = true;
    };
  }, [page]);

  return state;
}
