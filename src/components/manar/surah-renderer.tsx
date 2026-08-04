import { Icon, icons } from "@/components/manar/shell";
import { toArabicDigits } from "@/lib/quran";
import { useReadingPrefs } from "@/lib/quran/reading-prefs";
import type { SurahText } from "@/lib/quran/text-types";
import { useEffect, useState } from "react";

interface Props {
  surahId: number;
  surahNameAr: string;
  state:
    | { status: "loading"; data: undefined; error: undefined }
    | { status: "ready"; data: SurahText; error: undefined }
    | { status: "error"; data: undefined; error: Error };
  onRetry: () => void;
}

/** Canonical Basmala, as authored in the Uthmani dataset. */
const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

/**
 * Renders a Surah's Uthmani text inside the reading container.
 * Text comes from the QuranTextService — never hardcoded.
 */
export function SurahRenderer({ surahId, surahNameAr, state, onRetry }: Props) {
  // Force fade animation on surah change
  const [tick, setTick] = useState(0);
  useEffect(() => setTick((t) => t + 1), [surahId]);
  const { style } = useReadingPrefs();

  if (state.status === "loading") {
    return <ReaderLoading nameAr={surahNameAr} />;
  }

  if (state.status === "error") {
    return <ReaderError error={state.error} onRetry={onRetry} />;
  }

  const isFatihah = surahId === 1;
  // Al-Fatihah's first ayah IS the Basmala — keep it as a verse, no header.
  // At-Tawbah (9) has no Basmala at all.
  // Every other surah carries the Basmala prefixed onto ayah 1 in the dataset:
  // lift it into the decorative header and strip it from the verse so it
  // appears exactly once.
  const rawAyahs = state.data.ayahs;
  let ayahs = rawAyahs;
  let showBasmalaHeader = false;

  if (!isFatihah && rawAyahs.length > 0) {
    const first = rawAyahs[0];
    if (first.t.startsWith(BASMALA)) {
      showBasmalaHeader = true;
      const stripped = first.t.slice(BASMALA.length).trim();
      ayahs = [{ ...first, t: stripped }, ...rawAyahs.slice(1)];
    }
  }

  return (
    <div key={tick} className="animate-fade-up">
      {/* Ornamental surah header */}
      <div className="mb-7 flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-3">
          <span className="h-px w-10 bg-gold/40" />
          <span className="font-display text-[11px] uppercase tracking-[0.3em] text-gold">
            سورة
          </span>
          <span className="h-px w-10 bg-gold/40" />
        </div>
        <div className="font-display text-3xl font-medium leading-none">
          {surahNameAr}
        </div>
        {showBasmalaHeader && (
          <div
            className="mt-5 text-[1.35em] leading-[2.1] text-foreground/90"
            style={{
              fontFamily: style.fontFamily,
              fontSize: `${Math.round(style.fontSizePx * 0.92)}px`,
            }}
            lang="ar"
          >
            {BASMALA}
          </div>
        )}
      </div>

      {/* Verses — flowing mushaf-style paragraph */}
      <div className="mx-auto" style={{ maxWidth: style.maxWidth }}>
        <p
          className="text-justify text-foreground"
          style={{
            fontFamily: style.fontFamily,
            fontSize: `${style.fontSizePx}px`,
            lineHeight: style.lineHeight,
            textAlignLast: "center",
            wordSpacing: "0.06em",
            paddingInline: "0.15rem",
          }}
          lang="ar"
        >
          {ayahs.map((a) => (
            <span key={a.n} className="inline">
              <span>{a.t}</span>
              <span
                className="mx-1.5 inline-flex h-8 min-w-8 select-none items-center justify-center rounded-full border border-gold/50 bg-gold/15 px-1 align-middle text-[13px] font-medium leading-none tabular-nums text-gold"
                aria-label={`آية ${a.n}`}
                title={`آية ${a.n}`}
              >
                {toArabicDigits(a.n)}
              </span>{" "}
            </span>
          ))}
        </p>
      </div>

      {/* End-of-surah ornament */}
      <div className="mt-10 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-gold/70">
          <span className="h-px w-8 bg-gold/40" />
          <Icon d={icons.sparkle} size={14} />
          <span className="h-px w-8 bg-gold/40" />
        </div>
        <p className="text-[11px] text-muted-foreground">
          صدق الله العظيم · {toArabicDigits(rawAyahs.length)} آية
        </p>
      </div>
    </div>
  );
}

function ReaderLoading({ nameAr }: { nameAr: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.3em] text-gold">
        جارٍ التحميل
      </span>
      <div className="font-display text-lg text-foreground/80">سورة {nameAr}</div>
      <div className="mt-2 grid w-full gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-4 w-full animate-pulse rounded-full bg-muted/70"
            style={{ animationDelay: `${i * 90}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function ReaderError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Icon d={icons.info} size={20} />
      </span>
      <div className="font-display text-base">تعذّر تحميل السورة</div>
      <p className="max-w-[20rem] text-[11px] leading-relaxed text-muted-foreground">
        {error.message}
      </p>
      <button
        onClick={onRetry}
        className="mt-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-[12px] font-medium text-primary transition hover:bg-primary/15 active:scale-95"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
