import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon, icons } from "@/components/manar/shell";
import { toArabicDigits } from "@/lib/quran";
import { useReadingPrefs } from "@/lib/quran/reading-prefs";
import { BASMALA, type MushafSegment } from "@/lib/quran/page-service";
import { bareSurahNameAr, juzLabelAr } from "@/lib/quran/page-labels";
import type { MushafPageState } from "@/hooks/use-mushaf-page";

interface Props {
  page: number;
  state: MushafPageState;
  onRetry: () => void;
}

/**
 * Renders one printed Madani-Mushaf page (1..604) exactly like a physical
 * Mushaf: running head (juz on one side, surah names on the other), ornate
 * surah banners, centred Basmala, justified Uthmani lines with ornamental
 * ayah markers, and a framed page number at the foot.
 *
 * The whole page always fits its viewport — the text block is auto-fitted
 * (shrunk or grown) so no ayah is ever cut off and no scrolling is needed.
 */
export function MushafPageRenderer({ page, state, onRetry }: Props) {
  const { style } = useReadingPrefs();

  if (state.status === "loading") return <PageLoading page={page} />;
  if (state.status === "error")
    return <PageError error={state.error} onRetry={onRetry} />;

  const { segments, juz } = state.data;
  const headSurahs = segments
    .map((s) => bareSurahNameAr(s.nameAr))
    .join("  ");

  return (
    <div className="flex h-full w-full flex-col" dir="rtl">
      {/* Running head */}
      <div className="flex items-center justify-between gap-3 pb-2 text-[12px] text-muted-foreground">
        <span className="truncate font-display">{headSurahs}</span>
        <span className="shrink-0 font-display">{juzLabelAr(juz)}</span>
      </div>

      {/* Page body — auto-fitted so the page is always complete */}
      <FitToPage
        key={page}
        deps={`${page}|${style.fontSizePx}|${style.lineHeight}|${style.fontFamily}`}
      >
        {segments.map((seg, i) => (
          <Segment
            key={`${seg.surahId}-${i}`}
            seg={seg}
            style={style}
            first={i === 0}
          />
        ))}
      </FitToPage>

      {/* Framed page number */}
      <div className="flex justify-center pt-2">
        <PageNumberPlate page={page} />
      </div>
    </div>
  );
}

/* ---------------- Auto-fit engine ---------------- */

/**
 * Fits the page body to the available height by scaling the typographic size
 * (CSS var `--fit`) through a short synchronous convergence loop, so a page is
 * always shown complete — no clipping, no scrolling.
 */
function FitToPage({
  children,
  deps,
}: {
  children: React.ReactNode;
  deps: string;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const scaleRef = useRef(1);
  const framesRef = useRef(0);

  const step = () => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const available = outer.clientHeight;
    const natural = inner.scrollHeight;
    if (!available || !natural) return;
    const ratio = available / natural;
    if (ratio > 0.99 && ratio < 1.02) return;
    if (framesRef.current > 24) return;
    framesRef.current += 1;
    const damped = ratio > 1 ? 1 + (ratio - 1) * 0.5 : ratio * 0.995;
    const next = Math.min(1.6, Math.max(0.34, scaleRef.current * damped));
    if (Math.abs(next - scaleRef.current) < 0.002) return;
    scaleRef.current = next;
    inner.style.setProperty("--fit", String(next));
    requestAnimationFrame(step);
  };

  const refit = () => {
    framesRef.current = 0;
    requestAnimationFrame(step);
  };

  useLayoutEffect(() => {
    scaleRef.current = 1;
    innerRef.current?.style.setProperty("--fit", "1");
    refit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps]);

  useEffect(() => {
    const timers = [220, 700, 1500].map((ms) => window.setTimeout(refit, ms));
    window.addEventListener("resize", refit);
    if (document.fonts?.ready) void document.fonts.ready.then(refit);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("resize", refit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps]);

  return (
    <div ref={outerRef} className="relative min-h-0 flex-1 overflow-hidden">
      <div ref={innerRef} className="animate-fade-up">
        {children}
      </div>
    </div>
  );
}

/* ---------------- Page pieces ---------------- */

function Segment({
  seg,
  style,
  first,
}: {
  seg: MushafSegment;
  style: ReturnType<typeof useReadingPrefs>["style"];
  first: boolean;
}) {
  return (
    <div className={first ? "" : "mt-[0.6em]"}>
      {seg.startsSurah && <SurahBanner nameAr={bareSurahNameAr(seg.nameAr)} />}

      {seg.showBasmala && (
        <div
          className="mb-[0.35em] text-center text-foreground"
          style={{
            fontFamily: style.fontFamily,
            fontSize: `calc(${Math.round(style.fontSizePx * 0.86)}px * var(--fit, 1))`,
            lineHeight: 1.9,
          }}
          lang="ar"
        >
          {BASMALA}
        </div>
      )}

      <p
        className="text-justify text-foreground"
        style={{
          fontFamily: style.fontFamily,
          fontSize: `calc(${style.fontSizePx}px * var(--fit, 1))`,
          lineHeight: style.lineHeight,
          textAlignLast: "center",
          wordSpacing: "0.04em",
        }}
        lang="ar"
      >
        {seg.ayahs.map((a) => (
          <span key={a.n}>
            {a.t}
            <AyahMark n={a.n} />
          </span>
        ))}
      </p>
    </div>
  );
}

/** Ornamental surah headband, as printed in the Madani Mushaf. */
function SurahBanner({ nameAr }: { nameAr: string }) {
  return (
    <div className="my-[0.5em] flex justify-center">
      <div className="relative w-full overflow-hidden rounded-md border-2 border-primary/70 bg-primary/90 p-[3px] shadow-soft">
        <div className="relative flex items-center justify-center overflow-hidden rounded-[3px] border border-gold/50 bg-[color-mix(in_oklab,var(--color-primary)_10%,var(--color-card))] px-8 py-1.5">
          <BannerFlourish className="absolute right-1 top-1/2 h-6 w-16 -translate-y-1/2 text-gold/70" />
          <BannerFlourish className="absolute left-1 top-1/2 h-6 w-16 -translate-y-1/2 scale-x-[-1] text-gold/70" />
          <span
            className="relative font-display font-medium leading-none text-foreground"
            style={{ fontSize: "calc(15px * var(--fit, 1))" }}
          >
            سُورَةُ {nameAr}
          </span>
        </div>
      </div>
    </div>
  );
}

function BannerFlourish({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 24" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12c6-7 12-7 18 0-6 7-12 7-18 0Z" />
        <path d="M39 12c5-5 10-5 15 0-5 5-10 5-15 0Z" />
        <path d="M56 6c4 3 4 9 0 12" />
      </g>
    </svg>
  );
}

/** Ornamental ayah end marker with the ayah number inside. */
function AyahMark({ n }: { n: number }) {
  return (
    <span
      className="relative mx-[0.15em] inline-flex select-none items-center justify-center align-middle"
      style={{ width: "1.5em", height: "1.5em" }}
      aria-label={`آية ${n}`}
      title={`آية ${n}`}
    >
      <svg
        viewBox="0 0 40 40"
        className="absolute inset-0 h-full w-full text-gold"
        aria-hidden="true"
      >
        <g fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="20" cy="20" r="13" />
          <circle cx="20" cy="20" r="16" strokeOpacity="0.45" />
          <path d="M20 2.5 22.6 6.5 20 8.5 17.4 6.5Z" fill="currentColor" strokeWidth="0" />
          <path d="M20 37.5 22.6 33.5 20 31.5 17.4 33.5Z" fill="currentColor" strokeWidth="0" />
          <path d="M2.5 20 6.5 17.4 8.5 20 6.5 22.6Z" fill="currentColor" strokeWidth="0" />
          <path d="M37.5 20 33.5 17.4 31.5 20 33.5 22.6Z" fill="currentColor" strokeWidth="0" />
        </g>
      </svg>
      <span className="relative text-[0.42em] font-medium leading-none tabular-nums text-gold">
        {toArabicDigits(n)}
      </span>
    </span>
  );
}

/** Bottom page-number plate with a small arabesque, as printed. */
function PageNumberPlate({ page }: { page: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <BannerFlourish className="h-4 w-10 scale-x-[-1] text-gold/60" />
      <span className="rounded-md border border-primary/50 bg-primary/10 px-4 py-0.5 text-[12px] font-medium tabular-nums text-foreground">
        {toArabicDigits(page)}
      </span>
      <BannerFlourish className="h-4 w-10 text-gold/60" />
    </div>
  );
}

/* ---------------- States ---------------- */

function PageLoading({ page }: { page: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.3em] text-gold">
        جارٍ التحميل
      </span>
      <div className="font-display text-lg text-foreground/80">
        صفحة {toArabicDigits(page)}
      </div>
      <div className="mt-2 grid w-full gap-3">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
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
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
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
