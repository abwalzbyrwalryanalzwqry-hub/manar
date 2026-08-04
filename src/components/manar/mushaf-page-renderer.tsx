import { Icon, icons } from "@/components/manar/shell";
import { toArabicDigits } from "@/lib/quran";
import { useReadingPrefs } from "@/lib/quran/reading-prefs";
import { BASMALA, type MushafSegment } from "@/lib/quran/page-service";
import type { MushafPageState } from "@/hooks/use-mushaf-page";

interface Props {
  page: number;
  state: MushafPageState;
  onRetry: () => void;
}

/**
 * Renders a single Madani-Mushaf page (1..604) using the same
 * authentic Uthmani text service as the Surah reader.
 */
export function MushafPageRenderer({ page, state, onRetry }: Props) {
  const { style } = useReadingPrefs();

  if (state.status === "loading") return <PageLoading page={page} />;
  if (state.status === "error")
    return <PageError error={state.error} onRetry={onRetry} />;

  const { segments } = state.data;

  return (
    <div key={page} className="animate-fade-up">
      <div className="mx-auto" style={{ maxWidth: style.maxWidth }}>
        {segments.map((seg, i) => (
          <Segment
            key={`${seg.surahId}-${i}`}
            seg={seg}
            style={style}
            withTopRule={i > 0}
          />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-center gap-2 text-gold/70">
        <span className="h-px w-8 bg-gold/40" />
        <span className="text-[11px] tabular-nums text-muted-foreground">
          صفحة {toArabicDigits(page)}
        </span>
        <span className="h-px w-8 bg-gold/40" />
      </div>
    </div>
  );
}

function Segment({
  seg,
  style,
  withTopRule,
}: {
  seg: MushafSegment;
  style: ReturnType<typeof useReadingPrefs>["style"];
  withTopRule: boolean;
}) {
  return (
    <div className={withTopRule ? "mt-8 border-t border-gold/20 pt-7" : ""}>
      {seg.startsSurah && (
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-3">
            <span className="h-px w-10 bg-gold/40" />
            <span className="font-display text-[11px] uppercase tracking-[0.3em] text-gold">
              سورة
            </span>
            <span className="h-px w-10 bg-gold/40" />
          </div>
          <div className="font-display text-2xl font-medium leading-none">
            {seg.nameAr}
          </div>
          {seg.showBasmala && (
            <div
              className="mt-4 text-foreground/90"
              style={{
                fontFamily: style.fontFamily,
                fontSize: `${Math.round(style.fontSizePx * 0.92)}px`,
                lineHeight: 2,
              }}
              lang="ar"
            >
              {BASMALA}
            </div>
          )}
        </div>
      )}

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
        {seg.ayahs.map((a) => (
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
  );
}

function PageLoading({ page }: { page: number }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.3em] text-gold">
        جارٍ التحميل
      </span>
      <div className="font-display text-lg text-foreground/80">
        صفحة {toArabicDigits(page)}
      </div>
      <div className="mt-2 grid w-full gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
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

function PageError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Icon d={icons.info} size={20} />
      </span>
      <div className="font-display text-base">تعذّر تحميل الصفحة</div>
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
